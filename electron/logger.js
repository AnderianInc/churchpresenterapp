'use strict';

/**
 * Application error logger.
 *
 * Captures only genuine unhandled failures — not library noise:
 *   - process uncaughtException / unhandledRejection (main process)
 *   - explicit logger.error() / logger.warn() / logger.info() calls
 *   - renderer errors forwarded via the 'log:write' IPC channel
 *
 * Writes NDJSON to <userData>/logs/app.log, rotates at MAX_LOG_BYTES.
 * Keeps the last MAX_ENTRIES lines in memory for the in-app log viewer.
 *
 * Usage in main.js:
 *   const logger = require('./logger');
 *   logger.start(app);   // after app.whenReady(), before other setup
 *   logger.stop();       // on before-quit
 */

const { ipcMain, shell } = require('electron');
const fs   = require('fs');
const path = require('path');

const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2 MB per file
const MAX_ENTRIES   = 200;             // in-memory ring buffer

let _app       = null;
let _logStream = null;
let _logBytes  = 0;
const _entries = [];   // ring buffer: { ts, level, source, message, detail? }

// ─── Internal helpers ─────────────────────────────────────────────────────────

function logDir()  { return path.join(_app.getPath('userData'), 'logs'); }
function logPath() { return path.join(logDir(), 'app.log'); }

function openStream() {
  const dir = logDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const p = logPath();
  if (fs.existsSync(p)) {
    try {
      const stat = fs.statSync(p);
      if (stat.size >= MAX_LOG_BYTES) {
        fs.renameSync(p, p.replace('.log', `_${Date.now()}.log`));
        _logBytes = 0;
      } else {
        _logBytes = stat.size;
      }
    } catch (_) { _logBytes = 0; }
  } else {
    _logBytes = 0;
  }

  _logStream = fs.createWriteStream(p, { flags: 'a' });
  _logStream.on('error', (err) => {
    process.stderr.write(`[logger] stream error: ${err.message}\n`);
    _logStream = null;
  });
}

function write(entry) {
  // Ring buffer
  _entries.push(entry);
  if (_entries.length > MAX_ENTRIES) _entries.shift();

  // File
  if (!_app) return;
  try {
    if (!_logStream) openStream();
    if (!_logStream) return;
    const line = JSON.stringify(entry) + '\n';
    _logStream.write(line);
    _logBytes += line.length;
    if (_logBytes >= MAX_LOG_BYTES) {
      _logStream.end();
      _logStream = null;
    }
  } catch (_) {}
}

function makeEntry(level, source, message, detail) {
  return { ts: Date.now(), level, source, message, ...(detail ? { detail } : {}) };
}

// ─── Public logging API ───────────────────────────────────────────────────────

function error(source, message, detail) { write(makeEntry('error', source, message, detail)); }
function warn(source, message, detail)  { write(makeEntry('warn',  source, message, detail)); }
function info(source, message, detail)  { write(makeEntry('info',  source, message, detail)); }

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function start(app) {
  _app = app;
  openStream();

  // Unhandled main-process crashes — these are always worth logging
  process.on('uncaughtException', (err) => {
    error('main:uncaughtException', err.message, err.stack);
    process.stderr.write(`[uncaughtException] ${err.stack}\n`);
  });

  process.on('unhandledRejection', (reason) => {
    const msg   = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack   : undefined;
    error('main:unhandledRejection', msg, stack);
    process.stderr.write(`[unhandledRejection] ${msg}\n`);
  });

  // Renderer sends errors via IPC
  ipcMain.on('log:write', (_, entry) => {
    if (!entry || !entry.level || !entry.message) return;
    write({
      ts:      Date.now(),
      level:   entry.level,
      source:  entry.source || 'renderer',
      message: entry.message,
      ...(entry.detail ? { detail: entry.detail } : {}),
    });
  });

  // IPC handlers for the log viewer UI
  ipcMain.handle('log:get-entries', () => [..._entries]);
  ipcMain.handle('log:get-path',    () => logPath());
  ipcMain.handle('log:open-folder', () => shell.openPath(logDir()));
  ipcMain.handle('log:clear',       () => { _entries.length = 0; });

  info('main', 'Logger started', { version: app.getVersion(), platform: process.platform });
}

function stop() {
  if (_logStream) { _logStream.end(); _logStream = null; }
}

module.exports = { start, stop, error, warn, info };

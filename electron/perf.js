/**
 * Main-process performance monitor.
 *
 * - Samples CPU and memory every SAMPLE_INTERVAL_MS (default 5 s)
 * - Writes NDJSON lines to <userData>/logs/perf.ndjson (rotates at 5 MB)
 * - Exposes IPC handlers so any renderer can pull the latest snapshot or the
 *   log path (for "open log folder" developer tooling)
 * - Counts slide-change events dispatched through the main process
 *
 * Usage in main.js:
 *   const perf = require('./perf');
 *   perf.start(app);                  // call after app.whenReady()
 *   perf.recordStartup();             // call once the main window is ready
 *   // In slide broadcast handlers:
 *   perf.recordSlideChange();
 */

'use strict';

const { ipcMain } = require('electron');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SAMPLE_INTERVAL_MS = 5_000;
const MAX_LOG_BYTES      = 5 * 1024 * 1024; // 5 MB per log file

const APP_START_MS = Date.now();

let _app           = null;
let _logStream     = null;
let _logBytes      = 0;
let _sampleTimer   = null;
let _lastCpuUsage  = process.cpuUsage();
let _lastCpuTime   = Date.now();
let _slideChanges  = 0;
let _startupMs     = 0;
let _lastSlideTs   = 0;

let _snapshot = {
  startupMs:        0,
  heapUsedMb:       0,
  heapTotalMb:      0,
  rssMb:            0,
  mainCpuPercent:   0,
  slideChanges:     0,
  lastSlideTs:      0,
  sessionUptimeSec: 0,
  platform:         process.platform,
  arch:             process.arch,
};

// ─── Log helpers ──────────────────────────────────────────────────────────────

function logDir() {
  return path.join(_app.getPath('userData'), 'logs');
}

function logPath() {
  return path.join(logDir(), 'perf.ndjson');
}

function openLogStream() {
  const dir = logDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const p = logPath();
  if (fs.existsSync(p)) {
    try {
      const stat = fs.statSync(p);
      if (stat.size >= MAX_LOG_BYTES) {
        const rotated = p.replace('.ndjson', `_${Date.now()}.ndjson`);
        fs.renameSync(p, rotated);
        _logBytes = 0;
      } else {
        _logBytes = stat.size;
      }
    } catch (_) {
      _logBytes = 0;
    }
  } else {
    _logBytes = 0;
  }

  _logStream = fs.createWriteStream(p, { flags: 'a' });
  _logStream.on('error', (err) => {
    console.warn('[perf] log write error:', err.message);
    _logStream = null;
  });
}

function writeLog(event) {
  if (!_app) return;
  try {
    if (!_logStream) openLogStream();
    if (!_logStream) return;

    const line = JSON.stringify({ ts: Date.now(), ...event }) + '\n';
    _logStream.write(line);
    _logBytes += line.length;

    if (_logBytes >= MAX_LOG_BYTES) {
      _logStream.end();
      _logStream = null; // will re-open (and rotate) on next write
    }
  } catch (err) {
    console.warn('[perf] log write failed:', err.message);
  }
}

// ─── Sampling ─────────────────────────────────────────────────────────────────

function sample() {
  const mem   = process.memoryUsage();
  const now   = Date.now();
  const delta = process.cpuUsage(_lastCpuUsage);
  const elapsed = (now - _lastCpuTime) * 1_000; // µs

  const cpuPct = elapsed > 0
    ? Math.min(100, Math.round(((delta.user + delta.system) / elapsed) * 100))
    : 0;

  _lastCpuUsage = process.cpuUsage();
  _lastCpuTime  = now;

  _snapshot = {
    ..._snapshot,
    heapUsedMb:       round1(mem.heapUsed / 1024 / 1024),
    heapTotalMb:      round1(mem.heapTotal / 1024 / 1024),
    rssMb:            round1(mem.rss / 1024 / 1024),
    mainCpuPercent:   cpuPct,
    slideChanges:     _slideChanges,
    lastSlideTs:      _lastSlideTs,
    sessionUptimeSec: Math.floor((now - APP_START_MS) / 1000),
  };

  writeLog({ type: 'sample', ..._snapshot });
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the monitor. Call after app.whenReady() with the Electron `app` object.
 */
function start(app) {
  _app = app;
  openLogStream();

  _sampleTimer = setInterval(sample, SAMPLE_INTERVAL_MS);

  ipcMain.handle('perf:get-snapshot',  () => ({ ..._snapshot }));
  ipcMain.handle('perf:get-log-path',  () => logPath());
  ipcMain.handle('perf:get-log-dir',   () => logDir());

  writeLog({
    type:        'session-start',
    platform:    process.platform,
    arch:        process.arch,
    nodeVersion: process.version,
    cpuModel:    os.cpus()[0]?.model ?? 'unknown',
    totalRamMb:  Math.round(os.totalmem() / 1024 / 1024),
    appVersion:  app.getVersion(),
  });
}

/**
 * Record that the app's main window has finished loading.
 * Call once from the main-window `did-finish-load` or `ready-to-show` event.
 */
function recordStartup() {
  _startupMs = Date.now() - APP_START_MS;
  _snapshot.startupMs = _startupMs;
  writeLog({ type: 'startup', startupMs: _startupMs });
  console.info(`[perf] App ready in ${_startupMs} ms`);
}

/**
 * Increment the slide-change counter (call from send-slide-program handler).
 */
function recordSlideChange() {
  _slideChanges++;
  _lastSlideTs = Date.now();
}

/**
 * Write an arbitrary one-off event to the log. Useful for debugging.
 * @param {string} tag
 * @param {object} [extra]
 */
function logEvent(tag, extra = {}) {
  writeLog({ type: tag, ...extra });
}

/**
 * Stop sampling and flush the log stream. Called on app quit.
 */
function stop() {
  if (_sampleTimer) { clearInterval(_sampleTimer); _sampleTimer = null; }
  if (_logStream)   { _logStream.end(); _logStream = null; }
}

module.exports = { start, stop, recordStartup, recordSlideChange, logEvent };

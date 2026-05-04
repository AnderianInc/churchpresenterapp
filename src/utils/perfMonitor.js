/**
 * Renderer-process performance monitor.
 *
 * Tracks:
 *   - FPS via requestAnimationFrame (60-frame rolling window)
 *   - JS heap usage via performance.memory (Chrome/Electron only)
 *   - Slide-change latency: operator stamps _sentAt (ms) on slide data;
 *     the receiving window measures arrival delta on first paint after setState.
 *
 * Usage:
 *   import { perfMonitor } from './perfMonitor';
 *
 *   // Start once per window (idempotent)
 *   perfMonitor.start();
 *
 *   // Record a slide arrival (call as early as possible in the slide handler)
 *   perfMonitor.recordSlideArrival(slideData._sentAt);
 *
 *   // Read current metrics (for overlay or logging)
 *   const { fps, heapMb, latencyMs, sessionSec } = perfMonitor.getSnapshot();
 *
 *   // Stop (call on component unmount / window unload)
 *   perfMonitor.stop();
 */

const SESSION_START = Date.now();
const FPS_WINDOW    = 60; // frames to average over

let _rafHandle   = null;
let _running     = false;
let _frameTimes  = [];     // circular buffer of frame timestamps (ms)
let _fps         = 0;
let _latencyMs   = null;   // ms between operator send and renderer arrival
let _heapMb      = null;

function _tick(ts) {
  _frameTimes.push(ts);
  if (_frameTimes.length > FPS_WINDOW) _frameTimes.shift();

  if (_frameTimes.length >= 2) {
    const span = _frameTimes[_frameTimes.length - 1] - _frameTimes[0];
    _fps = span > 0
      ? Math.round((_frameTimes.length - 1) / (span / 1000))
      : 0;
  }

  // performance.memory is non-standard but available in Chromium / Electron
  if (performance.memory) {
    _heapMb = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
  }

  if (_running) _rafHandle = requestAnimationFrame(_tick);
}

/**
 * Start the monitor. Safe to call multiple times (noop if already running).
 */
function start() {
  if (_running) return;
  _running = true;
  _rafHandle = requestAnimationFrame(_tick);

  window.addEventListener('unload', stop, { once: true });
}

/**
 * Stop the monitor and cancel the rAF loop.
 */
function stop() {
  _running = false;
  if (_rafHandle != null) { cancelAnimationFrame(_rafHandle); _rafHandle = null; }
}

/**
 * Record the arrival of a slide that was stamped with _sentAt by the operator.
 * Call this as early as possible (in the IPC/BroadcastChannel handler, before setState).
 *
 * @param {number|undefined} sentAt  Date.now() value from the operator process
 */
function recordSlideArrival(sentAt) {
  if (typeof sentAt === 'number' && sentAt > 0) {
    _latencyMs = Date.now() - sentAt;
  }
}

/**
 * Returns a point-in-time snapshot of all tracked metrics.
 */
function getSnapshot() {
  return {
    fps:           _fps,
    heapMb:        _heapMb,
    latencyMs:     _latencyMs,
    sessionSec:    Math.floor((Date.now() - SESSION_START) / 1000),
  };
}

/**
 * Ask the main process for its latest CPU/memory snapshot (Electron only).
 * Returns null in browser mode.
 *
 * @returns {Promise<object|null>}
 */
async function getMainSnapshot() {
  if (!window.electronAPI?.getPerfSnapshot) return null;
  try {
    return await window.electronAPI.getPerfSnapshot();
  } catch {
    return null;
  }
}

export const perfMonitor = { start, stop, recordSlideArrival, getSnapshot, getMainSnapshot };

/**
 * Renderer-side error logger.
 *
 * Hooks only window.onerror and window.onunhandledrejection so we capture
 * genuine crashes without wrapping console.error (which would include library noise).
 *
 * Call logger.error() / logger.warn() / logger.info() explicitly at your own
 * catch sites for structured entries.
 *
 * In Electron: forwards entries to main via IPC (fire-and-forget).
 * In browser dev mode: writes to console only.
 */

const SOURCE = 'renderer';

function send(level, source, message, detail) {
  if (window.electronAPI?.logWrite) {
    window.electronAPI.logWrite({ level, source, message, detail });
  } else {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(`[${source}] ${message}`, detail || '');
  }
}

function installGlobalHandlers() {
  const prev = window.onerror;
  window.onerror = (msg, src, line, col, err) => {
    const message = err?.message || String(msg);
    const detail  = err?.stack   || `${src}:${line}:${col}`;
    send('error', SOURCE + ':onerror', message, detail);
    if (typeof prev === 'function') prev(msg, src, line, col, err);
    return false; // don't suppress default browser behaviour
  };

  const prevRej = window.onunhandledrejection;
  window.onunhandledrejection = (e) => {
    const reason  = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const detail  = reason instanceof Error ? reason.stack   : undefined;
    send('error', SOURCE + ':unhandledrejection', message, detail);
    if (typeof prevRej === 'function') prevRej(e);
  };
}

export const errorLogger = {
  install: installGlobalHandlers,
  error: (source, message, detail) => send('error', source, message, detail),
  warn:  (source, message, detail) => send('warn',  source, message, detail),
  info:  (source, message, detail) => send('info',  source, message, detail),
};

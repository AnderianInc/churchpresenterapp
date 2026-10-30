// Slide transition (fade) preferences, shared across the operator window and all
// output windows. Persisted in localStorage so freshly-opened output windows pick
// up the current setting, and changes are propagated live via the `storage` event
// (fires in *other* same-origin windows) plus a BroadcastChannel fallback.

const KEY = 'cp_slide_transition';
const CHANNEL = 'cp_slide_transition';

const DEFAULTS = { enabled: true, duration: 450 };

function clampDuration(d) {
  const n = Number(d);
  if (!Number.isFinite(n)) return DEFAULTS.duration;
  return Math.max(100, Math.min(2000, Math.round(n)));
}

export function getTransition() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled !== false,
      duration: clampDuration(parsed?.duration),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setTransition(partial) {
  const next = { ...getTransition(), ...partial };
  next.enabled = next.enabled !== false;
  next.duration = clampDuration(next.duration);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
  // Notify windows that don't receive the `storage` event (same window) or that
  // prefer a push channel.
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage(next);
      ch.close();
    }
  } catch { /* ignore */ }
  return next;
}

/** Subscribe to transition changes from any window. Returns an unsubscribe fn. */
export function subscribeTransition(onChange) {
  const handleStorage = (e) => {
    if (e.key === KEY) onChange(getTransition());
  };
  let ch;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = () => onChange(getTransition());
    }
  } catch { /* ignore */ }
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('storage', handleStorage);
    ch?.close();
  };
}

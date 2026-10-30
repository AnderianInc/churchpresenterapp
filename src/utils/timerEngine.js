// Pure timer logic — no React, no side-effects.
// All internal time values are milliseconds.

export const TIMER_TYPES = {
  COUNTDOWN: 'countdown',
  STOPWATCH: 'stopwatch',
  CLOCK:     'clock',
};

/**
 * Create a new timer descriptor.
 * @param {string} name
 * @param {'countdown'|'stopwatch'|'clock'} type
 * @param {number} durationSecs  Only relevant for COUNTDOWN timers.
 */
export function createTimer(name, type = TIMER_TYPES.COUNTDOWN, durationSecs = 300) {
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    name,
    type,
    durationMs:     type === TIMER_TYPES.COUNTDOWN ? durationSecs * 1000 : 0,
    // Wall-clock ms when the current run segment started (null when paused/stopped)
    startedAt:      null,
    // Accumulated ms from all completed run segments
    accumulatedMs:  0,
    running:        false,
    finished:       false,
  };
}

export function startTimer(timer, now = Date.now()) {
  // Clock timers have no internal state to track
  if (timer.type === TIMER_TYPES.CLOCK) return { ...timer, running: true };
  if (timer.running) return timer;
  return { ...timer, running: true, finished: false, startedAt: now };
}

export function pauseTimer(timer, now = Date.now()) {
  if (!timer.running || timer.type === TIMER_TYPES.CLOCK) return timer;
  const segmentMs = timer.startedAt != null ? now - timer.startedAt : 0;
  return {
    ...timer,
    running:       false,
    startedAt:     null,
    accumulatedMs: timer.accumulatedMs + segmentMs,
  };
}

export function resetTimer(timer) {
  return {
    ...timer,
    running:      false,
    finished:     false,
    startedAt:    null,
    accumulatedMs: 0,
  };
}

/** Total elapsed ms for a running or paused timer at the given wall-clock instant. */
export function getElapsedMs(timer, now = Date.now()) {
  if (timer.type === TIMER_TYPES.CLOCK) return 0;
  const currentSegment = (timer.running && timer.startedAt != null) ? now - timer.startedAt : 0;
  return timer.accumulatedMs + currentSegment;
}

/** Remaining ms for a COUNTDOWN timer (clamped to 0). */
export function getRemainingMs(timer, now = Date.now()) {
  if (timer.type !== TIMER_TYPES.COUNTDOWN) return 0;
  return Math.max(0, timer.durationMs - getElapsedMs(timer, now));
}

/**
 * Signed remaining ms for a COUNTDOWN timer — goes negative once the timer
 * passes zero so the display can count up into overtime instead of stopping.
 */
export function getCountdownMs(timer, now = Date.now()) {
  if (timer.type !== TIMER_TYPES.COUNTDOWN) return 0;
  return timer.durationMs - getElapsedMs(timer, now);
}

/** True when a countdown has reached zero. */
export function isExpired(timer, now = Date.now()) {
  return (
    timer.type === TIMER_TYPES.COUNTDOWN &&
    (timer.running || timer.accumulatedMs > 0) &&
    getRemainingMs(timer, now) <= 0
  );
}

/**
 * Format milliseconds as MM:SS or H:MM:SS.
 * @param {number}  ms
 * @param {boolean} forceHours  Always show the hours field.
 */
export function formatMs(ms, forceHours = false) {
  const totalSecs = Math.floor(Math.abs(ms) / 1000);
  const h  = Math.floor(totalSecs / 3600);
  const m  = Math.floor((totalSecs % 3600) / 60);
  const s  = totalSecs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Format a Date (or now) as a 12-hour clock string: H:MM:SS AM/PM */
export function formatClock(date = new Date()) {
  let h    = date.getHours();
  const m  = String(date.getMinutes()).padStart(2, '0');
  const s  = String(date.getSeconds()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m}:${s} ${ap}`;
}

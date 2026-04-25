/**
 * Pure utility functions for YouTube IFrame postMessage control.
 *
 * Keeping these separate from React components makes them testable and
 * prevents cross-concern coupling between the operator UI and the output window.
 */

/**
 * YouTube player state codes (YT.PlayerState enum values).
 */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

/**
 * Parse a raw postMessage data string from a YouTube iframe.
 * Returns a structured event object, or null if the message is not relevant.
 *
 * Relevant events and their shapes:
 *   { event: 'onReady' }
 *   { event: 'onStateChange', isPlaying: boolean, stateCode: number | null }
 *   { event: 'infoDelivery' | 'initialDelivery', isMuted?: boolean, volume?: number }
 */
export function parseYouTubeMessage(rawData) {
  if (!rawData || typeof rawData !== 'string') return null;
  let data;
  try { data = JSON.parse(rawData); } catch { return null; }
  if (!data || typeof data !== 'object') return null;

  if (data.event === 'onReady') return { event: 'onReady' };

  if (data.event === 'onStateChange') {
    const stateCode = typeof data.info === 'number' ? data.info : null;
    return {
      event: 'onStateChange',
      isPlaying: stateCode === YT_STATE.PLAYING || stateCode === YT_STATE.BUFFERING,
      stateCode,
    };
  }

  if (data.event === 'infoDelivery' || data.event === 'initialDelivery') {
    if (!data.info || typeof data.info !== 'object') return null;
    const { muted, volume } = data.info;
    if (muted === undefined && volume === undefined) return null;
    return { event: data.event, isMuted: muted, volume };
  }

  return null;
}

/**
 * Returns true if enough time has elapsed since the last user action to safely
 * apply a confirmed state update received from the YouTube player.
 *
 * This prevents stale infoDelivery events (still carrying the pre-command state)
 * from racing with and overriding a fresh optimistic update from a user click.
 *
 * @param {number} lastActionMs  - timestamp (ms) of the last user action
 * @param {number} nowMs         - current timestamp (ms)
 * @param {number} thresholdMs   - guard window in milliseconds (default 600)
 */
export function shouldAcceptYtState(lastActionMs, nowMs, thresholdMs = 600) {
  return nowMs - lastActionMs >= thresholdMs;
}

/**
 * Returns the YouTube IFrame postMessage command name for the desired mute state.
 *   true  → 'mute'
 *   false → 'unMute'
 */
export function muteCommandFor(targetMuted) {
  return targetMuted ? 'mute' : 'unMute';
}

/**
 * Build a YouTube IFrame postMessage command payload string.
 */
export function buildYtCommand(func, args = []) {
  return JSON.stringify({ event: 'command', func, args });
}

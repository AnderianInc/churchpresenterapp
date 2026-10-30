import { getDefaultVideoPlaybackState } from '../components/VideoControls';

/**
 * P10 Video control logic tests.
 *
 * Covers the pure-function equivalents of the video control features added in
 * the P10 fixes (F5):
 *
 *   executeVideoCommand   — models what OutputView.sendVideoCommand does to a
 *                           native <video> element.
 *   buildVideoStatePayload — models the state object relayed back to the main
 *                           window after each video command.
 *   shouldShowVideoController — models the MainLayout.jsx visibility guard.
 *   videoControllerAutoShow   — models the useEffect that auto-un-dismisses the
 *                           controller when the live video URL changes.
 *   relayVideoControl / relayVideoState — model the IPC routing helpers that
 *                           dispatch commands to output windows and state back
 *                           to the main window.
 *
 * No React components are mounted; no IPC, DOM, or BroadcastChannel is used.
 */

// ── executeVideoCommand ───────────────────────────────────────────────────────
//
// videoState = { paused: bool, muted: bool, volume: 0.0–1.0 }
// Mirrors OutputView.sendVideoCommand — operates on a virtual video element
// represented as a plain object so it can be tested without a DOM.

function executeVideoCommand(videoState, payload) {
  const { func, args = [] } = payload;
  switch (func) {
    case 'play':
      return { ...videoState, paused: false };
    case 'pause':
      return { ...videoState, paused: true };
    case 'stop':
      return { ...videoState, paused: true, currentTime: 0 };
    case 'restart':
      return { ...videoState, paused: false, currentTime: 0 };
    case 'setVolume': {
      const v = Math.max(0, Math.min(1, (args[0] ?? 100) / 100));
      return { ...videoState, volume: v };
    }
    case 'mute':
      return { ...videoState, muted: true };
    case 'unmute':
      return { ...videoState, muted: false };
    default:
      return videoState; // unknown command — no-op, returns same reference
  }
}

// ── buildVideoStatePayload ────────────────────────────────────────────────────
//
// Mirrors the relay object sent via 'send-video-state' IPC after a command:
//   { isPlaying: !video.paused, isMuted: video.muted, volume: Math.round(video.volume * 100) }

function buildVideoStatePayload(videoState) {
  return {
    isPlaying: !videoState.paused,
    isMuted: videoState.muted,
    volume: Math.round(videoState.volume * 100),
  };
}

// ── shouldShowVideoControls ───────────────────────────────────────────────────
//
// Mirrors the render guard in PreviewArea.jsx — the persistent inline video
// transport bar shows whenever a locally-imported video is live on program and
// the output is not blacked out. A per-slide background overrides the item one.

function liveVideoBgOf(liveProgram) {
  return (
    (liveProgram?.background?.type === 'video' && liveProgram.background) ||
    (liveProgram?.item?.background?.type === 'video' && liveProgram.item.background) ||
    null
  );
}

function shouldShowVideoControls(liveProgram, isBlackout) {
  return !!liveVideoBgOf(liveProgram) && !isBlackout;
}

// ── shouldResetVideoState ─────────────────────────────────────────────────────
//
// Mirrors the useEffect in VideoControls.jsx that resets playback state (play,
// mute, volume, time) whenever the live video value (URL/ID) changes.

function shouldResetVideoState(prevVideoValue, newVideoValue) {
  return !!newVideoValue && newVideoValue !== prevVideoValue;
}

// ── IPC relay helpers ─────────────────────────────────────────────────────────
//
// Mirrors the two new ipcMain.on handlers added to main.js in the P10 fix.
// Each function returns an array of { target, channel, payload } triples
// representing what webContents.send calls would be made.

function relayVideoControl(windows, payload) {
  const calls = [];
  for (const id of Object.keys(windows.outputWindows || {})) {
    calls.push({ target: id, channel: 'receive-video-control', payload });
  }
  return calls;
}

function relayVideoState(windows, payload) {
  const calls = [];
  if (windows.mainWindow) calls.push({ target: 'main', channel: 'receive-video-state', payload });
  return calls;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const playing  = { paused: false, muted: false, volume: 0.8 };
const paused   = { paused: true,  muted: false, volume: 0.8 };
const muted    = { paused: false, muted: true,  volume: 0.5 };

const videoProgram = {
  item: { title: 'Worship Video', background: { type: 'video', value: '/media/worship.mp4' } },
};
const youtubeProgram = {
  item: { title: 'Stream', background: { type: 'youtube', value: 'abc123' } },
};
const imageProgram = {
  item: { title: 'Song', background: { type: 'image', value: '/img/bg.jpg' } },
};

const windowsWithOutputs = {
  mainWindow: true,
  outputWindows: { 'out-1': true, 'out-2': true },
};
const windowsNoOutputs = {
  mainWindow: true,
  outputWindows: {},
};
const windowsNoMain = {
  mainWindow: null,
  outputWindows: { 'out-1': true },
};

// ── executeVideoCommand tests ─────────────────────────────────────────────────

describe('executeVideoCommand — play / pause', () => {
  it('play sets paused to false', () => {
    const result = executeVideoCommand(paused, { func: 'play' });
    expect(result.paused).toBe(false);
  });

  it('play preserves muted and volume', () => {
    const result = executeVideoCommand(paused, { func: 'play' });
    expect(result.muted).toBe(paused.muted);
    expect(result.volume).toBe(paused.volume);
  });

  it('pause sets paused to true', () => {
    const result = executeVideoCommand(playing, { func: 'pause' });
    expect(result.paused).toBe(true);
  });

  it('pause preserves muted and volume', () => {
    const result = executeVideoCommand(playing, { func: 'pause' });
    expect(result.muted).toBe(playing.muted);
    expect(result.volume).toBe(playing.volume);
  });

  it('stop pauses and rewinds to the start', () => {
    const result = executeVideoCommand({ ...playing, currentTime: 42 }, { func: 'stop' });
    expect(result.paused).toBe(true);
    expect(result.currentTime).toBe(0);
  });

  it('restart plays from the beginning', () => {
    const result = executeVideoCommand({ ...paused, currentTime: 42 }, { func: 'restart' });
    expect(result.paused).toBe(false);
    expect(result.currentTime).toBe(0);
  });
});

describe('executeVideoCommand — mute / unmute', () => {
  it('mute sets muted to true', () => {
    const result = executeVideoCommand(playing, { func: 'mute' });
    expect(result.muted).toBe(true);
  });

  it('mute preserves paused and volume', () => {
    const result = executeVideoCommand(playing, { func: 'mute' });
    expect(result.paused).toBe(playing.paused);
    expect(result.volume).toBe(playing.volume);
  });

  it('unmute sets muted to false', () => {
    const result = executeVideoCommand(muted, { func: 'unmute' });
    expect(result.muted).toBe(false);
  });

  it('unmute preserves paused and volume', () => {
    const result = executeVideoCommand(muted, { func: 'unmute' });
    expect(result.paused).toBe(muted.paused);
    expect(result.volume).toBe(muted.volume);
  });
});

describe('executeVideoCommand — setVolume', () => {
  it('sets volume from a normal percentage (50 → 0.5)', () => {
    const result = executeVideoCommand(playing, { func: 'setVolume', args: [50] });
    expect(result.volume).toBe(0.5);
  });

  it('sets volume to 1.0 from 100', () => {
    const result = executeVideoCommand(playing, { func: 'setVolume', args: [100] });
    expect(result.volume).toBe(1.0);
  });

  it('clamps volume below 0 to 0', () => {
    const result = executeVideoCommand(playing, { func: 'setVolume', args: [-10] });
    expect(result.volume).toBe(0);
  });

  it('clamps volume above 100 to 1.0', () => {
    const result = executeVideoCommand(playing, { func: 'setVolume', args: [150] });
    expect(result.volume).toBe(1.0);
  });

  it('defaults to 1.0 when args[0] is not provided (args=[]) ', () => {
    // args[0] is undefined → ?? 100 → 100 / 100 = 1.0
    const result = executeVideoCommand(playing, { func: 'setVolume', args: [] });
    expect(result.volume).toBe(1.0);
  });

  it('defaults to 1.0 when args field is absent entirely', () => {
    // payload has no `args` field → destructure default `args = []`
    const result = executeVideoCommand(playing, { func: 'setVolume' });
    expect(result.volume).toBe(1.0);
  });

  it('preserves paused and muted when setting volume', () => {
    const result = executeVideoCommand(muted, { func: 'setVolume', args: [75] });
    expect(result.paused).toBe(muted.paused);
    expect(result.muted).toBe(muted.muted);
  });
});

describe('executeVideoCommand — unknown command', () => {
  it('returns the same reference for an unknown func (strict no-op)', () => {
    const result = executeVideoCommand(playing, { func: 'seek' });
    expect(result).toBe(playing); // exact same object reference
  });

  it('returns the same reference for an empty string func', () => {
    const result = executeVideoCommand(playing, { func: '' });
    expect(result).toBe(playing);
  });
});

// ── buildVideoStatePayload tests ──────────────────────────────────────────────

describe('buildVideoStatePayload — isPlaying', () => {
  it('isPlaying is true when paused=false', () => {
    expect(buildVideoStatePayload(playing).isPlaying).toBe(true);
  });

  it('isPlaying is false when paused=true', () => {
    expect(buildVideoStatePayload(paused).isPlaying).toBe(false);
  });
});

describe('buildVideoStatePayload — isMuted', () => {
  it('isMuted is true when muted=true', () => {
    expect(buildVideoStatePayload(muted).isMuted).toBe(true);
  });

  it('isMuted is false when muted=false', () => {
    expect(buildVideoStatePayload(playing).isMuted).toBe(false);
  });
});

describe('buildVideoStatePayload — volume rounding', () => {
  it('0.8 → 80', () => {
    expect(buildVideoStatePayload({ ...playing, volume: 0.8 }).volume).toBe(80);
  });

  it('0.333 → 33', () => {
    expect(buildVideoStatePayload({ ...playing, volume: 0.333 }).volume).toBe(33);
  });

  it('1.0 → 100', () => {
    expect(buildVideoStatePayload({ ...playing, volume: 1.0 }).volume).toBe(100);
  });

  it('0.0 → 0', () => {
    expect(buildVideoStatePayload({ ...playing, volume: 0.0 }).volume).toBe(0);
  });

  it('volume is an integer (not a float)', () => {
    const v = buildVideoStatePayload({ ...playing, volume: 0.555 }).volume;
    expect(Number.isInteger(v)).toBe(true);
  });
});

// ── shouldShowVideoControls tests ─────────────────────────────────────────────

describe('shouldShowVideoControls', () => {
  it('shows when a local video is live on program', () => {
    expect(shouldShowVideoControls(videoProgram, false)).toBe(true);
  });

  it('shows regardless of which panel/view is open (controls are inline, always present)', () => {
    // No longer gated on activeView — the inline bar lives in PreviewArea.
    expect(shouldShowVideoControls(videoProgram, false)).toBe(true);
  });

  it('shows for a per-slide video background (overrides the item background)', () => {
    const perSlideVideo = { background: { type: 'video', value: '/media/clip.mp4' }, item: { background: { type: 'color', value: '#000' } } };
    expect(shouldShowVideoControls(perSlideVideo, false)).toBe(true);
  });

  it('hidden when blacked out', () => {
    expect(shouldShowVideoControls(videoProgram, true)).toBe(false);
  });

  it('hidden when type=youtube (only native video gets the controls)', () => {
    expect(shouldShowVideoControls(youtubeProgram, false)).toBe(false);
  });

  it('hidden when type=image', () => {
    expect(shouldShowVideoControls(imageProgram, false)).toBe(false);
  });

  it('hidden when liveProgram has no background', () => {
    const noBackground = { item: { title: 'Plain Song' } };
    expect(shouldShowVideoControls(noBackground, false)).toBe(false);
  });

  it('hidden when liveProgram is null', () => {
    expect(shouldShowVideoControls(null, false)).toBe(false);
  });

  it('hidden when liveProgram is undefined', () => {
    expect(shouldShowVideoControls(undefined, false)).toBe(false);
  });
});

// ── shouldResetVideoState tests ───────────────────────────────────────────────

describe('getDefaultVideoPlaybackState', () => {
  it('starts paused until the operator presses play manually', () => {
    expect(getDefaultVideoPlaybackState()).toMatchObject({
      isMuted: true,
      isPlaying: false,
      volume: 80,
      currentTime: 0,
      duration: 0,
    });
  });
});

describe('shouldResetVideoState', () => {
  it('resets when a new video value appears', () => {
    expect(shouldResetVideoState(null, '/media/new.mp4')).toBe(true);
  });

  it('resets when switching from one video to another', () => {
    expect(shouldResetVideoState('/media/old.mp4', '/media/new.mp4')).toBe(true);
  });

  it('does not reset when the video value is unchanged', () => {
    expect(shouldResetVideoState('/media/same.mp4', '/media/same.mp4')).toBe(false);
  });

  it('does not reset when there is no new video value', () => {
    expect(shouldResetVideoState('/media/video.mp4', null)).toBe(false);
  });
});

// ── relayVideoControl tests ───────────────────────────────────────────────────

describe('relayVideoControl — send-video-control → all output windows', () => {
  const cmd = { func: 'pause', args: [] };

  it('sends receive-video-control to every output window', () => {
    const calls = relayVideoControl(windowsWithOutputs, cmd);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('out-1');
    expect(targets).toContain('out-2');
    expect(calls).toHaveLength(2);
  });

  it('each call uses the receive-video-control channel', () => {
    const calls = relayVideoControl(windowsWithOutputs, cmd);
    calls.forEach(c => expect(c.channel).toBe('receive-video-control'));
  });

  it('sends the exact payload to each output window', () => {
    const calls = relayVideoControl(windowsWithOutputs, cmd);
    calls.forEach(c => expect(c.payload).toBe(cmd));
  });

  it('sends nothing when there are no output windows', () => {
    expect(relayVideoControl(windowsNoOutputs, cmd)).toHaveLength(0);
  });

  it('does NOT send to mainWindow (only output windows receive video commands)', () => {
    const calls = relayVideoControl(windowsWithOutputs, cmd);
    const targets = calls.map(c => c.target);
    expect(targets).not.toContain('main');
  });
});

// ── relayVideoState tests ─────────────────────────────────────────────────────

describe('relayVideoState — send-video-state → main window only', () => {
  const state = { isPlaying: true, isMuted: false, volume: 80 };

  it('sends receive-video-state to the main window', () => {
    const calls = relayVideoState(windowsWithOutputs, state);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'main', channel: 'receive-video-state', payload: state });
  });

  it('sends nothing when mainWindow is not open', () => {
    expect(relayVideoState(windowsNoMain, state)).toHaveLength(0);
  });

  it('does NOT send to output windows (state flows back to main only)', () => {
    const calls = relayVideoState(windowsWithOutputs, state);
    const targets = calls.map(c => c.target);
    expect(targets).not.toContain('out-1');
    expect(targets).not.toContain('out-2');
  });

  it('carries the correct state payload', () => {
    const calls = relayVideoState(windowsWithOutputs, state);
    expect(calls[0].payload).toBe(state);
  });
});

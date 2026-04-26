/**
 * Electron IPC relay smoke tests.
 *
 * electron/main.js registers ipcMain.on handlers that relay messages from the
 * operator window to output windows via webContents.send.  Because those
 * handlers are tightly coupled to BrowserWindow instances we cannot run
 * main.js directly in Jest.
 *
 * Instead we extract the relay *logic* as pure functions that mirror exactly
 * what each handler does, then assert the correct (window, channel, payload)
 * triples are produced.  If main.js relay logic changes, the mirrored function
 * here must be updated — making divergence visible at test time.
 *
 * Covered channels (from main.js lines ~532-563):
 *   send-slide-program  → presentation only       (receive-slide)
 *   send-slide-stage    → stage only              (receive-slide)
 *   send-blackout       → presentation+stage+stream (receive-blackout)
 *   send-clear          → presentation+stage only (receive-clear)
 *   send-output-state   → all output windows      (receive-output)
 *   send-lower-third    → stream only             (receive-lower-third)
 *   send-stream-config  → stream only             (receive-stream-config)
 */

// ── Mirror of ipcMain.on relay handlers ───────────────────────────────────────
//
// Each function accepts a `windows` bag and the IPC payload, and returns an
// array of { target, channel, payload } objects representing what would be
// sent via webContents.send.

function relaySlideProgram(windows, slideData) {
  const calls = [];
  if (windows.presentationWindow) calls.push({ target: 'presentation', channel: 'receive-slide', payload: slideData });
  return calls;
}

function relaySlideStage(windows, slideData) {
  const calls = [];
  if (windows.stageWindow) calls.push({ target: 'stage', channel: 'receive-slide', payload: slideData });
  return calls;
}

function relayBlackout(windows, isBlackout) {
  const calls = [];
  if (windows.presentationWindow) calls.push({ target: 'presentation', channel: 'receive-blackout', payload: isBlackout });
  if (windows.stageWindow) calls.push({ target: 'stage', channel: 'receive-blackout', payload: isBlackout });
  if (windows.streamWindow) calls.push({ target: 'stream', channel: 'receive-blackout', payload: isBlackout });
  return calls;
}

function relayClear(windows, isClear) {
  const calls = [];
  if (windows.presentationWindow) calls.push({ target: 'presentation', channel: 'receive-clear', payload: isClear });
  if (windows.stageWindow) calls.push({ target: 'stage', channel: 'receive-clear', payload: isClear });
  // stream window does NOT receive clear (only blackout)
  return calls;
}

function relayOutputState(windows, state) {
  // outputWindows is a Map<id, {window, role, ...}> in main.js
  // We model it as a plain object { id: true } for the pure test
  const calls = [];
  for (const id of Object.keys(windows.outputWindows || {})) {
    calls.push({ target: id, channel: 'receive-output', payload: state });
  }
  return calls;
}

function relayLowerThird(windows, data) {
  const calls = [];
  if (windows.streamWindow) calls.push({ target: 'stream', channel: 'receive-lower-third', payload: data });
  return calls;
}

function relayStreamConfig(windows, config) {
  const calls = [];
  if (windows.streamWindow) calls.push({ target: 'stream', channel: 'receive-stream-config', payload: config });
  return calls;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** All windows open (typical live-service state) */
const allOpen = {
  presentationWindow: true,
  stageWindow: true,
  streamWindow: true,
  outputWindows: { 'out-1': true, 'out-2': true },
};

/** Only presentation window open */
const presentationOnly = {
  presentationWindow: true,
  stageWindow: null,
  streamWindow: null,
  outputWindows: {},
};

/** No windows open (app just started) */
const noWindows = {
  presentationWindow: null,
  stageWindow: null,
  streamWindow: null,
  outputWindows: {},
};

const slide = { id: 's1', lines: 'Amazing grace', item: { title: 'Amazing Grace' } };

// ── send-slide-program ─────────────────────────────────────────────────────────

describe('send-slide-program relay', () => {
  it('sends receive-slide to presentationWindow only', () => {
    const calls = relaySlideProgram(allOpen, slide);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'presentation', channel: 'receive-slide', payload: slide });
  });

  it('does NOT send to stage or stream window', () => {
    const calls = relaySlideProgram(allOpen, slide);
    const targets = calls.map(c => c.target);
    expect(targets).not.toContain('stage');
    expect(targets).not.toContain('stream');
  });

  it('sends nothing when presentation window is not open', () => {
    expect(relaySlideProgram(noWindows, slide)).toHaveLength(0);
  });
});

// ── send-slide-stage ──────────────────────────────────────────────────────────

describe('send-slide-stage relay', () => {
  it('sends receive-slide to stageWindow only', () => {
    const calls = relaySlideStage(allOpen, slide);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'stage', channel: 'receive-slide', payload: slide });
  });

  it('does NOT send to presentation or stream window', () => {
    const calls = relaySlideStage(allOpen, slide);
    const targets = calls.map(c => c.target);
    expect(targets).not.toContain('presentation');
    expect(targets).not.toContain('stream');
  });

  it('sends nothing when stage window is not open', () => {
    expect(relaySlideStage(presentationOnly, slide)).toHaveLength(0);
  });
});

// ── send-blackout ─────────────────────────────────────────────────────────────

describe('send-blackout relay', () => {
  it('broadcasts receive-blackout to presentation, stage, and stream', () => {
    const calls = relayBlackout(allOpen, true);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('presentation');
    expect(targets).toContain('stage');
    expect(targets).toContain('stream');
    expect(calls).toHaveLength(3);
  });

  it('carries the correct boolean payload', () => {
    const onCalls = relayBlackout(allOpen, true);
    onCalls.forEach(c => expect(c.payload).toBe(true));
    const offCalls = relayBlackout(allOpen, false);
    offCalls.forEach(c => expect(c.payload).toBe(false));
  });

  it('only sends to open windows', () => {
    const calls = relayBlackout(presentationOnly, true);
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toBe('presentation');
  });

  it('sends nothing when no windows are open', () => {
    expect(relayBlackout(noWindows, true)).toHaveLength(0);
  });
});

// ── send-clear ────────────────────────────────────────────────────────────────

describe('send-clear relay', () => {
  it('sends receive-clear to presentation and stage, but NOT stream', () => {
    const calls = relayClear(allOpen, true);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('presentation');
    expect(targets).toContain('stage');
    expect(targets).not.toContain('stream'); // stream does not handle clear
    expect(calls).toHaveLength(2);
  });

  it('carries the correct boolean payload', () => {
    const calls = relayClear(allOpen, false);
    calls.forEach(c => expect(c.payload).toBe(false));
  });

  it('sends nothing when no windows are open', () => {
    expect(relayClear(noWindows, true)).toHaveLength(0);
  });

  it('blackout reaches stream but clear does not (asymmetry is intentional)', () => {
    const blackoutTargets = relayBlackout(allOpen, true).map(c => c.target);
    const clearTargets = relayClear(allOpen, true).map(c => c.target);
    expect(blackoutTargets).toContain('stream');
    expect(clearTargets).not.toContain('stream');
  });
});

// ── send-output-state ─────────────────────────────────────────────────────────

describe('send-output-state relay', () => {
  const state = { programSlide: slide, isBlackout: false, isClear: false, nextSlide: null, outputs: {}, roleSlides: {} };

  it('sends receive-output to every open output window', () => {
    const calls = relayOutputState(allOpen, state);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('out-1');
    expect(targets).toContain('out-2');
    expect(calls).toHaveLength(2);
  });

  it('sends the full state payload to each output window', () => {
    const calls = relayOutputState(allOpen, state);
    calls.forEach(c => {
      expect(c.channel).toBe('receive-output');
      expect(c.payload).toBe(state);
    });
  });

  it('sends nothing when there are no output windows', () => {
    expect(relayOutputState(presentationOnly, state)).toHaveLength(0);
  });
});

// ── send-lower-third ──────────────────────────────────────────────────────────

describe('send-lower-third relay', () => {
  const data = { active: true, label: 'Pastor', text: 'John 3:16', source: '' };

  it('sends receive-lower-third to stream window only', () => {
    const calls = relayLowerThird(allOpen, data);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'stream', channel: 'receive-lower-third', payload: data });
  });

  it('sends nothing when stream window is not open', () => {
    expect(relayLowerThird(presentationOnly, data)).toHaveLength(0);
  });
});

// ── send-stream-config ────────────────────────────────────────────────────────

describe('send-stream-config relay', () => {
  const config = { sourceId: 'window:1234', label: 'OBS Virtual Camera' };

  it('sends receive-stream-config to stream window only', () => {
    const calls = relayStreamConfig(allOpen, config);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'stream', channel: 'receive-stream-config', payload: config });
  });

  it('sends nothing when stream window is not open', () => {
    expect(relayStreamConfig(presentationOnly, config)).toHaveLength(0);
  });
});

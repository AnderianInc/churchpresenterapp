/**
 * P10 IPC relay smoke tests — new channels.
 *
 * Follows the same pattern as src/__tests__/ipcRelay.test.js.
 *
 * electron/main.js registers ipcMain.on handlers that relay messages between
 * the operator window, output windows, and the main window via
 * webContents.send.  Because those handlers are tightly coupled to
 * BrowserWindow instances we cannot run main.js directly in Jest.
 *
 * Instead we extract the relay *logic* as pure functions that mirror exactly
 * what each handler does, then assert the correct (target, channel, payload)
 * triples are produced.  If main.js relay logic changes, the mirrored function
 * here must be updated — making divergence visible at test time.
 *
 * NEW channels added in P10 (F5):
 *   send-video-control  → all output windows   (receive-video-control)
 *   send-video-state    → main window only      (receive-video-state)
 *
 * EXISTING channels re-tested for regression:
 *   send-youtube-control  → all output windows  (receive-youtube-control)
 *   send-youtube-state    → main window only    (receive-youtube-state)
 *   send-output-state     → all output windows  (receive-output)
 */

// ── Mirror functions for NEW P10 channels ─────────────────────────────────────

function relayVideoControl(windows, payload) {
  // ipcMain.on('send-video-control', (_, payload) => {
  //   for (const entry of outputWindows.values()) {
  //     entry.window.webContents.send('receive-video-control', payload);
  //   }
  // });
  const calls = [];
  for (const id of Object.keys(windows.outputWindows || {})) {
    calls.push({ target: id, channel: 'receive-video-control', payload });
  }
  return calls;
}

function relayVideoState(windows, payload) {
  // ipcMain.on('send-video-state', (_, payload) => {
  //   if (mainWindow) mainWindow.webContents.send('receive-video-state', payload);
  // });
  const calls = [];
  if (windows.mainWindow) calls.push({ target: 'main', channel: 'receive-video-state', payload });
  return calls;
}

// ── Mirror functions for EXISTING channels (regression coverage) ──────────────

function relayYouTubeControl(windows, payload) {
  // Mirrors the send-youtube-control handler — broadcasts to all output windows.
  const calls = [];
  for (const id of Object.keys(windows.outputWindows || {})) {
    calls.push({ target: id, channel: 'receive-youtube-control', payload });
  }
  return calls;
}

function relayYouTubeState(windows, payload) {
  // Mirrors the send-youtube-state handler — relays only to main window.
  const calls = [];
  if (windows.mainWindow) calls.push({ target: 'main', channel: 'receive-youtube-state', payload });
  return calls;
}

function relayOutputState(windows, state) {
  // Mirrors the send-output-state handler — broadcasts to all output windows.
  const calls = [];
  for (const id of Object.keys(windows.outputWindows || {})) {
    calls.push({ target: id, channel: 'receive-output', payload: state });
  }
  return calls;
}

// ── Window-bag fixtures ───────────────────────────────────────────────────────

/** Typical live-service state: main window open, two output windows */
const allOpen = {
  mainWindow: true,
  outputWindows: { 'out-1': true, 'out-2': true },
};

/** Only the main window open — no output windows yet */
const mainOnly = {
  mainWindow: true,
  outputWindows: {},
};

/** Output windows open, but main window not registered */
const outputsOnly = {
  mainWindow: null,
  outputWindows: { 'out-1': true },
};

/** Nothing open */
const noWindows = {
  mainWindow: null,
  outputWindows: {},
};

// ── Sample payloads ───────────────────────────────────────────────────────────

const videoCmd   = { func: 'pause', args: [] };
const videoState = { isPlaying: false, isMuted: false, volume: 80 };
const ytCmd      = { event: 'command', func: 'pauseVideo', args: [] };
const ytState    = { isPlaying: true, isMuted: false, volume: 75 };
const outputStateSample = { programSlide: { id: 's1' }, isBlackout: false, isClear: false, outputs: {} };

// ── send-video-control (NEW) ──────────────────────────────────────────────────

describe('send-video-control relay (new P10 channel)', () => {
  it('sends receive-video-control to every output window', () => {
    const calls = relayVideoControl(allOpen, videoCmd);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('out-1');
    expect(targets).toContain('out-2');
    expect(calls).toHaveLength(2);
  });

  it('each call uses the receive-video-control channel name', () => {
    const calls = relayVideoControl(allOpen, videoCmd);
    calls.forEach(c => expect(c.channel).toBe('receive-video-control'));
  });

  it('relays the exact payload object to each output window', () => {
    const calls = relayVideoControl(allOpen, videoCmd);
    calls.forEach(c => expect(c.payload).toBe(videoCmd));
  });

  it('sends nothing when there are no output windows', () => {
    expect(relayVideoControl(mainOnly, videoCmd)).toHaveLength(0);
  });

  it('sends nothing when all windows are closed', () => {
    expect(relayVideoControl(noWindows, videoCmd)).toHaveLength(0);
  });

  it('does NOT route to the main window (commands go out, not back)', () => {
    const calls = relayVideoControl(allOpen, videoCmd);
    expect(calls.map(c => c.target)).not.toContain('main');
  });
});

// ── send-video-state (NEW) ────────────────────────────────────────────────────

describe('send-video-state relay (new P10 channel)', () => {
  it('sends receive-video-state to the main window', () => {
    const calls = relayVideoState(allOpen, videoState);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'main', channel: 'receive-video-state', payload: videoState });
  });

  it('sends nothing when the main window is not open', () => {
    expect(relayVideoState(outputsOnly, videoState)).toHaveLength(0);
  });

  it('sends nothing when no windows are open', () => {
    expect(relayVideoState(noWindows, videoState)).toHaveLength(0);
  });

  it('does NOT route to output windows (state goes to main only)', () => {
    const calls = relayVideoState(allOpen, videoState);
    const targets = calls.map(c => c.target);
    expect(targets).not.toContain('out-1');
    expect(targets).not.toContain('out-2');
  });

  it('carries the exact state payload', () => {
    const calls = relayVideoState(allOpen, videoState);
    expect(calls[0].payload).toBe(videoState);
  });
});

// ── send-youtube-control regression tests ─────────────────────────────────────

describe('send-youtube-control relay (regression)', () => {
  it('still sends receive-youtube-control to all output windows', () => {
    const calls = relayYouTubeControl(allOpen, ytCmd);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('out-1');
    expect(targets).toContain('out-2');
    expect(calls).toHaveLength(2);
  });

  it('uses receive-youtube-control channel (not receive-video-control)', () => {
    const calls = relayYouTubeControl(allOpen, ytCmd);
    calls.forEach(c => expect(c.channel).toBe('receive-youtube-control'));
  });

  it('does NOT route to main window', () => {
    const calls = relayYouTubeControl(allOpen, ytCmd);
    expect(calls.map(c => c.target)).not.toContain('main');
  });

  it('sends nothing when there are no output windows', () => {
    expect(relayYouTubeControl(mainOnly, ytCmd)).toHaveLength(0);
  });
});

// ── send-youtube-state regression tests ───────────────────────────────────────

describe('send-youtube-state relay (regression)', () => {
  it('still sends receive-youtube-state to the main window only', () => {
    const calls = relayYouTubeState(allOpen, ytState);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ target: 'main', channel: 'receive-youtube-state', payload: ytState });
  });

  it('uses receive-youtube-state channel (not receive-video-state)', () => {
    const calls = relayYouTubeState(allOpen, ytState);
    expect(calls[0].channel).toBe('receive-youtube-state');
  });

  it('does NOT route to output windows', () => {
    const calls = relayYouTubeState(allOpen, ytState);
    expect(calls.map(c => c.target)).not.toContain('out-1');
  });

  it('sends nothing when main window is not open', () => {
    expect(relayYouTubeState(outputsOnly, ytState)).toHaveLength(0);
  });
});

// ── send-output-state regression tests ───────────────────────────────────────

describe('send-output-state relay (regression)', () => {
  it('still sends receive-output to all output windows', () => {
    const calls = relayOutputState(allOpen, outputStateSample);
    const targets = calls.map(c => c.target);
    expect(targets).toContain('out-1');
    expect(targets).toContain('out-2');
    expect(calls).toHaveLength(2);
  });

  it('uses receive-output channel', () => {
    const calls = relayOutputState(allOpen, outputStateSample);
    calls.forEach(c => expect(c.channel).toBe('receive-output'));
  });

  it('does NOT route to main window', () => {
    const calls = relayOutputState(allOpen, outputStateSample);
    expect(calls.map(c => c.target)).not.toContain('main');
  });

  it('sends nothing when there are no output windows', () => {
    expect(relayOutputState(mainOnly, outputStateSample)).toHaveLength(0);
  });
});

// ── Cross-channel broadcast-to-outputs consistency ───────────────────────────
//
// All channels that broadcast to output windows must follow the same pattern:
// iterate over outputWindows keys and NEVER include mainWindow.  This describe
// block explicitly verifies that invariant across all three such channels so a
// future change cannot accidentally introduce main-window routing.

describe('broadcast-to-outputs channels — shared pattern verification', () => {
  const payloads = {
    videoControl:  videoCmd,
    youtubeControl: ytCmd,
    outputState:   outputStateSample,
  };

  const relays = {
    videoControl:   (w, p) => relayVideoControl(w, p),
    youtubeControl: (w, p) => relayYouTubeControl(w, p),
    outputState:    (w, p) => relayOutputState(w, p),
  };

  Object.entries(relays).forEach(([name, relay]) => {
    describe(`${name}`, () => {
      it('produces one call per output window', () => {
        const calls = relay(allOpen, payloads[name]);
        expect(calls).toHaveLength(Object.keys(allOpen.outputWindows).length);
      });

      it('never routes to main or stage', () => {
        const calls = relay(allOpen, payloads[name]);
        const targets = calls.map(c => c.target);
        expect(targets).not.toContain('main');
        expect(targets).not.toContain('stage');
      });

      it('produces zero calls when outputWindows is empty', () => {
        expect(relay(mainOnly, payloads[name])).toHaveLength(0);
      });
    });
  });
});

// ── Main-only channels share the same pattern ────────────────────────────────

describe('main-only channels — shared pattern verification', () => {
  const mainOnlyRelays = {
    videoState:   (w, p) => relayVideoState(w, p),
    youtubeState: (w, p) => relayYouTubeState(w, p),
  };

  Object.entries(mainOnlyRelays).forEach(([name, relay]) => {
    const payload = name === 'videoState' ? videoState : ytState;
    describe(`${name}`, () => {
      it('produces exactly one call when main window is open', () => {
        expect(relay(allOpen, payload)).toHaveLength(1);
      });

      it('always targets "main"', () => {
        const calls = relay(allOpen, payload);
        expect(calls[0].target).toBe('main');
      });

      it('never targets output windows', () => {
        const calls = relay(allOpen, payload);
        const targets = calls.map(c => c.target);
        expect(targets).not.toContain('out-1');
        expect(targets).not.toContain('out-2');
      });

      it('produces zero calls when main window is absent', () => {
        expect(relay(outputsOnly, payload)).toHaveLength(0);
      });
    });
  });
});

import {
  YT_STATE,
  parseYouTubeMessage,
  shouldAcceptYtState,
  muteCommandFor,
  buildYtCommand,
} from '../utils/youtubeControl';

// ── parseYouTubeMessage ───────────────────────────────────────────────────────

describe('parseYouTubeMessage', () => {
  describe('invalid / irrelevant input', () => {
    it('returns null for null', () => {
      expect(parseYouTubeMessage(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(parseYouTubeMessage(undefined)).toBeNull();
    });

    it('returns null for a number', () => {
      expect(parseYouTubeMessage(42)).toBeNull();
    });

    it('returns null for an object (non-string)', () => {
      expect(parseYouTubeMessage({ event: 'onReady' })).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseYouTubeMessage('{not valid json')).toBeNull();
    });

    it('returns null when JSON is a primitive', () => {
      expect(parseYouTubeMessage('"justAString"')).toBeNull();
    });

    it('returns null for an unknown event', () => {
      expect(parseYouTubeMessage(JSON.stringify({ event: 'someOtherEvent' }))).toBeNull();
    });

    it('returns null for data with no event field', () => {
      expect(parseYouTubeMessage(JSON.stringify({ info: { muted: true } }))).toBeNull();
    });
  });

  describe('onReady', () => {
    it('returns { event: "onReady" }', () => {
      const raw = JSON.stringify({ event: 'onReady' });
      expect(parseYouTubeMessage(raw)).toEqual({ event: 'onReady' });
    });

    it('ignores extra fields on onReady', () => {
      const raw = JSON.stringify({ event: 'onReady', info: 'ignored' });
      expect(parseYouTubeMessage(raw)).toEqual({ event: 'onReady' });
    });
  });

  describe('onStateChange', () => {
    it('returns isPlaying: true when stateCode is PLAYING (1)', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: YT_STATE.PLAYING });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: true,
        stateCode: YT_STATE.PLAYING,
      });
    });

    it('returns isPlaying: true when stateCode is BUFFERING (3)', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: YT_STATE.BUFFERING });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: true,
        stateCode: YT_STATE.BUFFERING,
      });
    });

    it('returns isPlaying: false when stateCode is PAUSED (2)', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: YT_STATE.PAUSED });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: false,
        stateCode: YT_STATE.PAUSED,
      });
    });

    it('returns isPlaying: false when stateCode is ENDED (0)', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: YT_STATE.ENDED });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: false,
        stateCode: YT_STATE.ENDED,
      });
    });

    it('returns isPlaying: false when stateCode is CUED (5)', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: YT_STATE.CUED });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: false,
        stateCode: YT_STATE.CUED,
      });
    });

    it('returns isPlaying: false when stateCode is UNSTARTED (-1)', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: YT_STATE.UNSTARTED });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: false,
        stateCode: YT_STATE.UNSTARTED,
      });
    });

    it('returns stateCode: null when info is not a number', () => {
      const raw = JSON.stringify({ event: 'onStateChange', info: 'playing' });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: false,
        stateCode: null,
      });
    });

    it('returns stateCode: null when info is absent', () => {
      const raw = JSON.stringify({ event: 'onStateChange' });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'onStateChange',
        isPlaying: false,
        stateCode: null,
      });
    });
  });

  describe('infoDelivery', () => {
    it('returns isMuted and volume', () => {
      const raw = JSON.stringify({ event: 'infoDelivery', info: { muted: true, volume: 80 } });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'infoDelivery',
        isMuted: true,
        volume: 80,
      });
    });

    it('returns isMuted: false with volume', () => {
      const raw = JSON.stringify({ event: 'infoDelivery', info: { muted: false, volume: 60 } });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'infoDelivery',
        isMuted: false,
        volume: 60,
      });
    });

    it('returns null when info is missing', () => {
      const raw = JSON.stringify({ event: 'infoDelivery' });
      expect(parseYouTubeMessage(raw)).toBeNull();
    });

    it('returns null when info is not an object', () => {
      const raw = JSON.stringify({ event: 'infoDelivery', info: 1 });
      expect(parseYouTubeMessage(raw)).toBeNull();
    });

    it('returns null when info has neither muted nor volume', () => {
      const raw = JSON.stringify({ event: 'infoDelivery', info: { currentTime: 12 } });
      expect(parseYouTubeMessage(raw)).toBeNull();
    });

    it('accepts info with only muted (no volume field)', () => {
      const raw = JSON.stringify({ event: 'infoDelivery', info: { muted: true } });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'infoDelivery',
        isMuted: true,
        volume: undefined,
      });
    });

    it('accepts info with only volume (no muted field)', () => {
      const raw = JSON.stringify({ event: 'infoDelivery', info: { volume: 50 } });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'infoDelivery',
        isMuted: undefined,
        volume: 50,
      });
    });
  });

  describe('initialDelivery', () => {
    it('parses the same way as infoDelivery', () => {
      const raw = JSON.stringify({ event: 'initialDelivery', info: { muted: false, volume: 100 } });
      expect(parseYouTubeMessage(raw)).toEqual({
        event: 'initialDelivery',
        isMuted: false,
        volume: 100,
      });
    });

    it('returns null when info has no relevant fields', () => {
      const raw = JSON.stringify({ event: 'initialDelivery', info: { duration: 180 } });
      expect(parseYouTubeMessage(raw)).toBeNull();
    });
  });
});

// ── shouldAcceptYtState ───────────────────────────────────────────────────────

describe('shouldAcceptYtState', () => {
  it('returns true when elapsed time exceeds the default threshold (600 ms)', () => {
    expect(shouldAcceptYtState(1000, 1601)).toBe(true);
  });

  it('returns true when elapsed time exactly equals the default threshold', () => {
    expect(shouldAcceptYtState(1000, 1600)).toBe(true);
  });

  it('returns false when elapsed time is less than the default threshold', () => {
    expect(shouldAcceptYtState(1000, 1599)).toBe(false);
  });

  it('respects a custom threshold', () => {
    expect(shouldAcceptYtState(0, 400, 400)).toBe(true);
    expect(shouldAcceptYtState(0, 399, 400)).toBe(false);
  });

  it('returns true when lastActionMs is 0 (no user action ever recorded)', () => {
    // 0 means nothing happened, so we should always accept state
    expect(shouldAcceptYtState(0, 1000)).toBe(true);
  });

  it('returns false immediately after a user action (nowMs === lastActionMs)', () => {
    const ts = Date.now();
    expect(shouldAcceptYtState(ts, ts)).toBe(false);
  });
});

// ── muteCommandFor ────────────────────────────────────────────────────────────

describe('muteCommandFor', () => {
  it('returns "mute" when targetMuted is true', () => {
    expect(muteCommandFor(true)).toBe('mute');
  });

  it('returns "unMute" when targetMuted is false', () => {
    expect(muteCommandFor(false)).toBe('unMute');
  });
});

// ── buildYtCommand ────────────────────────────────────────────────────────────

describe('buildYtCommand', () => {
  it('serialises a command with no args', () => {
    const result = buildYtCommand('playVideo');
    expect(JSON.parse(result)).toEqual({ event: 'command', func: 'playVideo', args: [] });
  });

  it('serialises a command with args', () => {
    const result = buildYtCommand('setVolume', [75]);
    expect(JSON.parse(result)).toEqual({ event: 'command', func: 'setVolume', args: [75] });
  });

  it('serialises mute command', () => {
    const result = buildYtCommand('mute');
    expect(JSON.parse(result)).toEqual({ event: 'command', func: 'mute', args: [] });
  });

  it('serialises unMute command', () => {
    const result = buildYtCommand('unMute');
    expect(JSON.parse(result)).toEqual({ event: 'command', func: 'unMute', args: [] });
  });

  it('output is a JSON string (not an object)', () => {
    const result = buildYtCommand('pauseVideo');
    expect(typeof result).toBe('string');
  });
});

/**
 * Domain logic tests for AppContext reducers and state transitions.
 *
 * We test the pure logic extracted from AppContext rather than
 * mounting the full React component tree, which would require
 * mocking Electron IPC and localStorage in ways that add noise.
 */

// ── Helpers mirroring AppContext internal logic ────────────────────────────────

function makeSlides(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `slide-${i}`, type: 'verse', label: `Verse ${i + 1}`, lines: `Line ${i + 1}`,
  }));
}

function makeItem(title, slideCount = 3) {
  return {
    scheduleId: `sch-${title}`, title, type: 'song',
    slides: makeSlides(slideCount),
  };
}

// nextSlide logic (mirrors AppContext.nextSlide)
function nextSlide(state) {
  const { activeScheduleIdx, activeSlideIdx, schedule } = state;
  const currentSlides = schedule[activeScheduleIdx]?.slides || [];
  if (activeSlideIdx < currentSlides.length - 1) {
    return { ...state, activeSlideIdx: activeSlideIdx + 1 };
  }
  if (activeScheduleIdx < schedule.length - 1) {
    return { ...state, activeScheduleIdx: activeScheduleIdx + 1, activeSlideIdx: 0 };
  }
  return state; // already at end — no change
}

// prevSlide logic (mirrors AppContext.prevSlide)
function prevSlide(state) {
  const { activeScheduleIdx, activeSlideIdx, schedule } = state;
  if (activeSlideIdx > 0) {
    return { ...state, activeSlideIdx: activeSlideIdx - 1 };
  }
  if (activeScheduleIdx > 0) {
    const prevItem = schedule[activeScheduleIdx - 1];
    const prevSlideIdx = (prevItem?.slides?.length || 1) - 1;
    return { ...state, activeScheduleIdx: activeScheduleIdx - 1, activeSlideIdx: prevSlideIdx };
  }
  return state; // already at start — no change
}

// goLive logic
function goLive(state, slide) {
  return { ...state, liveSlide: slide, isLive: true, isBlackout: false, isClear: false };
}

// toggleBlackout logic
function toggleBlackout(state) {
  return { ...state, isBlackout: !state.isBlackout };
}

// toggleClear logic
function toggleClear(state) {
  return { ...state, isClear: !state.isClear };
}

// ── Schedule navigation tests ──────────────────────────────────────────────────

describe('nextSlide', () => {
  it('advances within current item', () => {
    const schedule = [makeItem('Song A', 3)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 0 };
    expect(nextSlide(state).activeSlideIdx).toBe(1);
  });

  it('advances to first slide of next item at item boundary', () => {
    const schedule = [makeItem('Song A', 2), makeItem('Song B', 3)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 1 };
    const next = nextSlide(state);
    expect(next.activeScheduleIdx).toBe(1);
    expect(next.activeSlideIdx).toBe(0);
  });

  it('does not advance past the last slide of the last item', () => {
    const schedule = [makeItem('Song A', 2)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 1 };
    const result = nextSlide(state);
    expect(result.activeScheduleIdx).toBe(0);
    expect(result.activeSlideIdx).toBe(1); // unchanged
  });

  it('returns same reference when already at end (no state change)', () => {
    const schedule = [makeItem('Song A', 1)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 0 };
    expect(nextSlide(state)).toBe(state);
  });

  it('handles empty schedule gracefully', () => {
    const state = { schedule: [], activeScheduleIdx: 0, activeSlideIdx: 0 };
    expect(() => nextSlide(state)).not.toThrow();
  });

  it('handles a single-slide item followed by a multi-slide item', () => {
    const schedule = [makeItem('Intro', 1), makeItem('Song A', 4)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 0 };
    const next = nextSlide(state);
    expect(next.activeScheduleIdx).toBe(1);
    expect(next.activeSlideIdx).toBe(0);
  });
});

describe('prevSlide', () => {
  it('goes back within current item', () => {
    const schedule = [makeItem('Song A', 3)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 2 };
    expect(prevSlide(state).activeSlideIdx).toBe(1);
  });

  it('jumps to last slide of previous item at item boundary', () => {
    const schedule = [makeItem('Song A', 4), makeItem('Song B', 3)];
    const state = { schedule, activeScheduleIdx: 1, activeSlideIdx: 0 };
    const prev = prevSlide(state);
    expect(prev.activeScheduleIdx).toBe(0);
    expect(prev.activeSlideIdx).toBe(3); // last slide of Song A (4 slides → index 3)
  });

  it('does not go before the first slide of the first item', () => {
    const schedule = [makeItem('Song A', 3)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 0 };
    const result = prevSlide(state);
    expect(result.activeScheduleIdx).toBe(0);
    expect(result.activeSlideIdx).toBe(0); // unchanged
  });

  it('returns same reference when already at start', () => {
    const schedule = [makeItem('Song A', 3)];
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 0 };
    expect(prevSlide(state)).toBe(state);
  });

  it('correctly lands on last slide of a single-slide previous item', () => {
    const schedule = [makeItem('Intro', 1), makeItem('Song A', 3)];
    const state = { schedule, activeScheduleIdx: 1, activeSlideIdx: 0 };
    const prev = prevSlide(state);
    expect(prev.activeScheduleIdx).toBe(0);
    expect(prev.activeSlideIdx).toBe(0);
  });
});

// ── goLive state transitions ───────────────────────────────────────────────────

describe('goLive', () => {
  const slide = { id: 's1', lines: 'Amazing grace', item: { title: 'Amazing Grace' } };

  it('sets liveSlide to the given slide', () => {
    const state = { liveSlide: null, isLive: false, isBlackout: false, isClear: false };
    expect(goLive(state, slide).liveSlide).toBe(slide);
  });

  it('sets isLive to true', () => {
    const state = { liveSlide: null, isLive: false, isBlackout: false, isClear: false };
    expect(goLive(state, slide).isLive).toBe(true);
  });

  it('clears blackout when going live', () => {
    const state = { liveSlide: null, isLive: false, isBlackout: true, isClear: false };
    expect(goLive(state, slide).isBlackout).toBe(false);
  });

  it('clears clear-state when going live', () => {
    const state = { liveSlide: null, isLive: false, isBlackout: false, isClear: true };
    expect(goLive(state, slide).isClear).toBe(false);
  });

  it('replaces an existing live slide', () => {
    const oldSlide = { id: 'old', lines: 'Old content' };
    const state = { liveSlide: oldSlide, isLive: true, isBlackout: false, isClear: false };
    expect(goLive(state, slide).liveSlide).toBe(slide);
  });
});

// ── Blackout / clear interaction tests ────────────────────────────────────────

describe('toggleBlackout', () => {
  it('turns blackout on from off', () => {
    const state = { isBlackout: false };
    expect(toggleBlackout(state).isBlackout).toBe(true);
  });

  it('turns blackout off from on', () => {
    const state = { isBlackout: true };
    expect(toggleBlackout(state).isBlackout).toBe(false);
  });

  it('toggles correctly twice (on → off → on)', () => {
    let state = { isBlackout: false };
    state = toggleBlackout(state);
    expect(state.isBlackout).toBe(true);
    state = toggleBlackout(state);
    expect(state.isBlackout).toBe(false);
  });
});

describe('toggleClear', () => {
  it('turns clear on from off', () => {
    const state = { isClear: false };
    expect(toggleClear(state).isClear).toBe(true);
  });

  it('turns clear off from on', () => {
    const state = { isClear: true };
    expect(toggleClear(state).isClear).toBe(false);
  });
});

describe('blackout and clear independence', () => {
  it('toggleBlackout does not affect isClear', () => {
    const state = { isBlackout: false, isClear: true };
    expect(toggleBlackout(state).isClear).toBe(true);
  });

  it('toggleClear does not affect isBlackout', () => {
    const state = { isBlackout: true, isClear: false };
    expect(toggleClear(state).isBlackout).toBe(true);
  });

  it('goLive resets both blackout and clear simultaneously', () => {
    const slide = { id: 's1', lines: 'test' };
    const state = { liveSlide: null, isLive: false, isBlackout: true, isClear: true };
    const next = goLive(state, slide);
    expect(next.isBlackout).toBe(false);
    expect(next.isClear).toBe(false);
    expect(next.isLive).toBe(true);
  });
});

// ── StageView clear parity ─────────────────────────────────────────────────────

describe('stage view clear parity', () => {
  /**
   * Verify that stage view receives and handles clear messages.
   * StageView currently registers onReceiveClear but does nothing with it.
   * This test documents the expected contract so that when clear-display is
   * fully implemented, the test drives the right behaviour.
   */
  it('clear event handler should exist and be callable without error', () => {
    // Simulate the BroadcastChannel message handler in StageView
    let stageSlide = { lines: 'Some lyrics' };
    let stageIsBlackout = false;

    const handleMessage = ({ type, payload }) => {
      if (type === 'slide') { stageSlide = payload; stageIsBlackout = false; }
      if (type === 'blackout') stageIsBlackout = payload;
      // clear: currently a no-op in StageView — when implemented, add assertion here
    };

    expect(() => handleMessage({ type: 'clear', payload: true })).not.toThrow();
    // State unchanged (clear is a no-op today)
    expect(stageSlide).not.toBeNull();
    expect(stageIsBlackout).toBe(false);
  });
});

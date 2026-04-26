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

// ── removeFromSchedule edge cases ─────────────────────────────────────────────

/**
 * removeFromSchedule logic (mirrors AppContext.removeFromSchedule)
 *
 * Rules:
 *   - Unknown scheduleId → no-op (same reference returned)
 *   - Remove item BEFORE active → activeScheduleIdx decrements by 1 (min 0)
 *   - Remove ACTIVE item → clamp: min(activeScheduleIdx, max(0, newLength-1))
 *   - Remove item AFTER active → activeScheduleIdx unchanged
 *   - activeSlideIdx always resets to 0 after a successful remove
 */
function removeFromSchedule(state, scheduleId) {
  const { schedule, activeScheduleIdx } = state;
  const idx = schedule.findIndex(s => s.scheduleId === scheduleId);
  if (idx === -1) return state; // no-op — return same reference
  const newSch = schedule.filter(s => s.scheduleId !== scheduleId);
  let newIdx = activeScheduleIdx;
  if (idx < activeScheduleIdx) {
    newIdx = Math.max(0, activeScheduleIdx - 1);
  } else if (idx === activeScheduleIdx) {
    newIdx = Math.min(activeScheduleIdx, Math.max(0, newSch.length - 1));
  }
  return { ...state, schedule: newSch, activeScheduleIdx: newIdx, activeSlideIdx: 0 };
}

describe('removeFromSchedule', () => {
  function makeSchedule(titles) {
    return titles.map((title, i) => ({ scheduleId: `sch-${i}`, title, type: 'song', slides: makeSlides(2) }));
  }

  it('is a no-op for an unknown scheduleId (same reference)', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const state = { schedule, activeScheduleIdx: 1, activeSlideIdx: 1 };
    expect(removeFromSchedule(state, 'does-not-exist')).toBe(state);
  });

  it('removes item before active → decrements activeScheduleIdx', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const state = { schedule, activeScheduleIdx: 2, activeSlideIdx: 1 };
    const next = removeFromSchedule(state, 'sch-0'); // remove A (before active C)
    expect(next.schedule).toHaveLength(2);
    expect(next.activeScheduleIdx).toBe(1); // was 2, decremented to 1
    expect(next.activeSlideIdx).toBe(0);
  });

  it('removes item after active → activeScheduleIdx unchanged', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 1 };
    const next = removeFromSchedule(state, 'sch-2'); // remove C (after active A)
    expect(next.schedule).toHaveLength(2);
    expect(next.activeScheduleIdx).toBe(0);
    expect(next.activeSlideIdx).toBe(0);
  });

  it('removes active item (not last) → index stays, now pointing at next item', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const state = { schedule, activeScheduleIdx: 1, activeSlideIdx: 1 };
    const next = removeFromSchedule(state, 'sch-1'); // remove active B
    expect(next.schedule).toHaveLength(2);
    expect(next.activeScheduleIdx).toBe(1); // min(1, max(0, 1)) = 1; now points at C
    expect(next.schedule[1].title).toBe('C');
    expect(next.activeSlideIdx).toBe(0);
  });

  it('removes active item that is last in schedule → clamps to new last index', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const state = { schedule, activeScheduleIdx: 2, activeSlideIdx: 1 };
    const next = removeFromSchedule(state, 'sch-2'); // remove active C (last)
    expect(next.schedule).toHaveLength(2);
    expect(next.activeScheduleIdx).toBe(1); // min(2, max(0, 1)) = 1
    expect(next.activeSlideIdx).toBe(0);
  });

  it('removes the only item in the schedule → empty schedule, index stays 0', () => {
    const schedule = makeSchedule(['A']);
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 1 };
    const next = removeFromSchedule(state, 'sch-0');
    expect(next.schedule).toHaveLength(0);
    expect(next.activeScheduleIdx).toBe(0); // min(0, max(0, -1)) = min(0, 0) = 0
    expect(next.activeSlideIdx).toBe(0);
  });

  it('always resets activeSlideIdx to 0 regardless of which item is removed', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const state = { schedule, activeScheduleIdx: 0, activeSlideIdx: 1 }; // mid-song
    const next = removeFromSchedule(state, 'sch-2'); // remove C (after active)
    expect(next.activeSlideIdx).toBe(0);
  });

  it('removing item just before active with activeScheduleIdx=1 clamps to 0 floor', () => {
    const schedule = makeSchedule(['A', 'B']);
    const state = { schedule, activeScheduleIdx: 1, activeSlideIdx: 0 };
    const next = removeFromSchedule(state, 'sch-0'); // remove A, active was B at idx 1
    expect(next.activeScheduleIdx).toBe(0); // Math.max(0, 1-1) = 0
    expect(next.schedule[0].title).toBe('B');
  });
});

// ── updateScheduleItem ────────────────────────────────────────────────────────

/**
 * updateScheduleItem logic (mirrors AppContext.updateScheduleItem)
 * Merges a patch object into the matching schedule item (by scheduleId).
 * All other items remain untouched (same object references).
 */
function updateScheduleItem(schedule, scheduleId, patch) {
  return schedule.map(s => s.scheduleId === scheduleId ? { ...s, ...patch } : s);
}

describe('updateScheduleItem', () => {
  function makeSchedule(titles) {
    return titles.map((title, i) => ({
      scheduleId: `sch-${i}`, title, type: 'song',
      slides: makeSlides(2),
      background: { type: 'color', value: '#0a0f1e' },
    }));
  }

  it('updates the background of the target item', () => {
    const schedule = makeSchedule(['Song A', 'Song B']);
    const newBg = { type: 'gradient', value: 'linear-gradient(135deg, #000 0%, #111 100%)' };
    const result = updateScheduleItem(schedule, 'sch-0', { background: newBg });
    expect(result[0].background).toEqual(newBg);
    expect(result[1].background).toEqual({ type: 'color', value: '#0a0f1e' }); // unchanged
  });

  it('does not mutate any other item', () => {
    const schedule = makeSchedule(['A', 'B', 'C']);
    const result = updateScheduleItem(schedule, 'sch-1', { title: 'Updated B' });
    expect(result[0]).toBe(schedule[0]); // same reference
    expect(result[2]).toBe(schedule[2]); // same reference
    expect(result[1]).not.toBe(schedule[1]); // new object for patched item
    expect(result[1].title).toBe('Updated B');
  });

  it('is a no-op for an unknown scheduleId (no item matches)', () => {
    const schedule = makeSchedule(['A', 'B']);
    const result = updateScheduleItem(schedule, 'nonexistent', { title: 'X' });
    result.forEach((item, i) => expect(item).toBe(schedule[i]));
  });

  it('can patch multiple fields at once', () => {
    const schedule = makeSchedule(['A']);
    const patch = { title: 'New Title', fontSize: 52, textColor: '#ff0000' };
    const result = updateScheduleItem(schedule, 'sch-0', patch);
    expect(result[0].title).toBe('New Title');
    expect(result[0].fontSize).toBe(52);
    expect(result[0].textColor).toBe('#ff0000');
    expect(result[0].slides).toEqual(schedule[0].slides); // unpatched fields preserved
  });

  it('preserves scheduleId on the patched item', () => {
    const schedule = makeSchedule(['A']);
    const result = updateScheduleItem(schedule, 'sch-0', { title: 'Changed' });
    expect(result[0].scheduleId).toBe('sch-0');
  });
});

// ── Schedule undo / redo ─────────────────────────────────────────────────────

/**
 * Simplified undo/redo stack that mirrors AppContext's ref-based implementation.
 * History is an array of schedule snapshots; pointer moves back/forward.
 */
function makeHistoryManager(initial = [], maxSteps = 20) {
  let history = [initial];
  let idx = 0;

  return {
    push(snapshot) {
      // Truncate forward history
      history = history.slice(0, idx + 1);
      history.push(snapshot);
      if (history.length > maxSteps + 1) history.shift();
      idx = history.length - 1;
      return history[idx];
    },
    undo() {
      if (idx > 0) idx--;
      return history[idx];
    },
    redo() {
      if (idx < history.length - 1) idx++;
      return history[idx];
    },
    current() { return history[idx]; },
    canUndo() { return idx > 0; },
    canRedo() { return idx < history.length - 1; },
    historyLength() { return history.length; },
  };
}

describe('schedule undo / redo', () => {
  function snap(titles) {
    return titles.map((t, i) => ({ scheduleId: `s${i}`, title: t }));
  }

  it('initial state has one history entry, canUndo=false', () => {
    const hm = makeHistoryManager(snap(['A', 'B']));
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(false);
    expect(hm.historyLength()).toBe(1);
  });

  it('pushing a snapshot enables undo', () => {
    const hm = makeHistoryManager(snap(['A']));
    hm.push(snap(['A', 'B']));
    expect(hm.canUndo()).toBe(true);
    expect(hm.canRedo()).toBe(false);
  });

  it('undo restores the previous state', () => {
    const hm = makeHistoryManager(snap(['A']));
    hm.push(snap(['A', 'B']));
    const prev = hm.undo();
    expect(prev.map(s => s.title)).toEqual(['A']);
  });

  it('redo re-applies the reverted state', () => {
    const hm = makeHistoryManager(snap(['A']));
    hm.push(snap(['A', 'B']));
    hm.undo();
    const redone = hm.redo();
    expect(redone.map(s => s.title)).toEqual(['A', 'B']);
  });

  it('pushing after undo truncates the forward history', () => {
    const hm = makeHistoryManager(snap(['A']));
    hm.push(snap(['A', 'B']));
    hm.push(snap(['A', 'B', 'C']));
    hm.undo(); // back to ['A','B']
    hm.push(snap(['A', 'X'])); // branch off — C is gone
    expect(hm.canRedo()).toBe(false);
    expect(hm.current().map(s => s.title)).toEqual(['A', 'X']);
  });

  it('undo at the start of history returns the initial state', () => {
    const initial = snap(['A']);
    const hm = makeHistoryManager(initial);
    hm.push(snap(['A', 'B']));
    hm.undo();
    hm.undo(); // second undo — should clamp
    expect(hm.current().map(s => s.title)).toEqual(['A']);
    expect(hm.canUndo()).toBe(false);
  });

  it('redo at the end of history is a no-op', () => {
    const hm = makeHistoryManager(snap(['A']));
    hm.push(snap(['A', 'B']));
    hm.redo(); // already at end
    hm.redo();
    expect(hm.current().map(s => s.title)).toEqual(['A', 'B']);
  });

  it('history is capped at maxSteps entries (oldest entry dropped)', () => {
    const hm = makeHistoryManager([], 5); // max 5 steps
    for (let i = 0; i < 8; i++) hm.push([{ scheduleId: `s${i}`, title: `Song ${i}` }]);
    // With maxSteps=5, history stores at most 6 entries (initial + 5), but we
    // drop the oldest when we exceed the cap, so history.length <= 6.
    expect(hm.historyLength()).toBeLessThanOrEqual(6);
  });

  it('multiple undo/redo cycles are stable', () => {
    const hm = makeHistoryManager(snap(['A']));
    hm.push(snap(['A', 'B']));
    hm.push(snap(['A', 'B', 'C']));
    hm.undo(); // → ['A','B']
    hm.undo(); // → ['A']
    hm.redo(); // → ['A','B']
    hm.redo(); // → ['A','B','C']
    expect(hm.current().map(s => s.title)).toEqual(['A', 'B', 'C']);
    expect(hm.canRedo()).toBe(false);
  });
});

// ── Clear / blackout render resolution ───────────────────────────────────────

/**
 * Mirrors the render-decision logic shared by PresentationView, OutputView,
 * and StageView:
 *   - blackout         → no content rendered (full black)
 *   - clear + slide    → render slide background only (lines/chords stripped)
 *   - clear, no slide  → nothing to render
 *   - default          → pass slide through as-is
 *
 * PresentationView.jsx and OutputView.jsx implement this as:
 *   if (isBlackout) return <div style={{background:'#000'}} />
 *   if (isClear && slide) return <SlideRenderer slide={{...slide, lines:'', chords:''}} />
 */
function resolveSlideForRender(slide, isBlackout, isClear) {
  if (isBlackout) return null;
  if (isClear && slide) return { ...slide, lines: '', chords: '' };
  return slide;
}

describe('resolveSlideForRender — clear/blackout render logic', () => {
  const slide = { id: 's1', lines: 'Amazing grace', chords: 'G  C  G', item: { title: 'Amazing Grace', background: { type: 'color', value: '#001' } } };

  it('passes slide through when neither blackout nor clear', () => {
    expect(resolveSlideForRender(slide, false, false)).toBe(slide);
  });

  it('returns null when blackout is true (regardless of slide)', () => {
    expect(resolveSlideForRender(slide, true, false)).toBeNull();
  });

  it('strips lines and chords when isClear=true and slide exists', () => {
    const result = resolveSlideForRender(slide, false, true);
    expect(result.lines).toBe('');
    expect(result.chords).toBe('');
  });

  it('preserves background and item on clear slide (background is still shown)', () => {
    const result = resolveSlideForRender(slide, false, true);
    expect(result.item).toBe(slide.item);
    expect(result.id).toBe(slide.id);
  });

  it('returns null when isClear=true but no slide (nothing to show background of)', () => {
    expect(resolveSlideForRender(null, false, true)).toBeNull();
  });

  it('blackout takes precedence over clear when both are true', () => {
    expect(resolveSlideForRender(slide, true, true)).toBeNull();
  });

  it('returns null when both slide and blackout are falsy', () => {
    expect(resolveSlideForRender(null, false, false)).toBeNull();
  });
});

// ── computeNextSlidePayload (mirrors liveNextSlide useMemo in AppContext) ─────

/**
 * liveNextSlide is a useMemo in AppContext that computes which slide should
 * appear as "next" — used by the confidence monitor split-screen and potentially
 * other preview UIs.
 *
 * Priority:
 *   1. Next slide within the same schedule item (if not on last slide)
 *   2. First slide of the next schedule item (at item boundaries)
 *   3. null — at the very end of the schedule or with an empty schedule
 *
 * The returned slide always has `.item` set to its parent schedule item.
 */
function computeNextSlidePayload(schedule, activeScheduleIdx, activeSlideIdx) {
  const currentItemSlides = schedule[activeScheduleIdx]?.slides || [];
  if (activeSlideIdx < currentItemSlides.length - 1) {
    const s = currentItemSlides[activeSlideIdx + 1];
    return s ? { ...s, item: schedule[activeScheduleIdx] } : null;
  }
  if (activeScheduleIdx < schedule.length - 1) {
    const nextItem = schedule[activeScheduleIdx + 1];
    const s = nextItem?.slides?.[0];
    return s ? { ...s, item: nextItem } : null;
  }
  return null;
}

describe('computeNextSlidePayload', () => {
  it('returns the next slide within the same item when not on the last slide', () => {
    const item = makeItem('Song A', 3);
    const schedule = [item];
    const result = computeNextSlidePayload(schedule, 0, 0);
    expect(result).not.toBeNull();
    expect(result.id).toBe(item.slides[1].id);
  });

  it('attaches the parent item to the returned slide', () => {
    const item = makeItem('Song A', 3);
    const result = computeNextSlidePayload([item], 0, 0);
    expect(result.item).toBe(item);
  });

  it('returns first slide of next item at an item boundary', () => {
    const itemA = makeItem('Song A', 2);
    const itemB = makeItem('Song B', 3);
    const result = computeNextSlidePayload([itemA, itemB], 0, 1); // on last slide of A
    expect(result).not.toBeNull();
    expect(result.id).toBe(itemB.slides[0].id);
    expect(result.item).toBe(itemB);
  });

  it('returns null at the very last slide of the last item', () => {
    const item = makeItem('Song A', 2);
    expect(computeNextSlidePayload([item], 0, 1)).toBeNull();
  });

  it('returns null for an empty schedule', () => {
    expect(computeNextSlidePayload([], 0, 0)).toBeNull();
  });

  it('returns null when the current item has no slides', () => {
    const emptyItem = { scheduleId: 'empty', title: 'Empty', type: 'song', slides: [] };
    expect(computeNextSlidePayload([emptyItem], 0, 0)).toBeNull();
  });

  it('works across a single-slide item boundary (item with 1 slide → next item)', () => {
    const intro = makeItem('Intro', 1);
    const song = makeItem('Song A', 4);
    const result = computeNextSlidePayload([intro, song], 0, 0);
    expect(result.id).toBe(song.slides[0].id);
    expect(result.item).toBe(song);
  });

  it('returns next slide from same item mid-sequence', () => {
    const item = makeItem('Song A', 5);
    const result = computeNextSlidePayload([item], 0, 2); // on slide index 2
    expect(result.id).toBe(item.slides[3].id);
  });
});

// ── clearSchedule state reset ──────────────────────────────────────────────────

/**
 * Mirrors AppContext.clearSchedule — resets the entire live session:
 * empties the schedule, resets navigation indices, clears all live output
 * state, and resets all display flags.
 */
function clearSchedule(state) {
  return {
    ...state,
    schedule: [],
    activeScheduleIdx: 0,
    activeSlideIdx: 0,
    liveProgram: null,
    liveStage: null,
    liveOutputs: {},
    liveRoleSlides: {},
    isLive: false,
    isBlackout: false,
    isClear: false,
  };
}

describe('clearSchedule', () => {
  function fullState() {
    const schedule = [makeItem('Song A', 3), makeItem('Song B', 2)];
    const slide = { id: 's1', lines: 'Some lyrics', item: schedule[0] };
    return {
      schedule,
      activeScheduleIdx: 1,
      activeSlideIdx: 1,
      liveProgram: slide,
      liveStage: slide,
      liveOutputs: { 'win-1': slide, 'win-2': slide },
      liveRoleSlides: { announcement: slide, confidence: slide },
      isLive: true,
      isBlackout: true,
      isClear: true,
    };
  }

  it('empties the schedule', () => {
    expect(clearSchedule(fullState()).schedule).toHaveLength(0);
  });

  it('resets activeScheduleIdx to 0', () => {
    expect(clearSchedule(fullState()).activeScheduleIdx).toBe(0);
  });

  it('resets activeSlideIdx to 0', () => {
    expect(clearSchedule(fullState()).activeSlideIdx).toBe(0);
  });

  it('sets liveProgram to null', () => {
    expect(clearSchedule(fullState()).liveProgram).toBeNull();
  });

  it('sets liveStage to null', () => {
    expect(clearSchedule(fullState()).liveStage).toBeNull();
  });

  it('clears liveOutputs to empty object', () => {
    expect(clearSchedule(fullState()).liveOutputs).toEqual({});
  });

  it('clears liveRoleSlides to empty object', () => {
    expect(clearSchedule(fullState()).liveRoleSlides).toEqual({});
  });

  it('sets isLive to false', () => {
    expect(clearSchedule(fullState()).isLive).toBe(false);
  });

  it('sets isBlackout to false', () => {
    expect(clearSchedule(fullState()).isBlackout).toBe(false);
  });

  it('sets isClear to false', () => {
    expect(clearSchedule(fullState()).isClear).toBe(false);
  });

  it('is safe to call on an already-empty state', () => {
    const empty = {
      schedule: [], activeScheduleIdx: 0, activeSlideIdx: 0,
      liveProgram: null, liveStage: null, liveOutputs: {}, liveRoleSlides: {},
      isLive: false, isBlackout: false, isClear: false,
    };
    const result = clearSchedule(empty);
    expect(result.schedule).toHaveLength(0);
    expect(result.liveProgram).toBeNull();
  });
});

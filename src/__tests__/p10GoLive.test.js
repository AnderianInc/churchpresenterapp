/**
 * P10 Go-Live logic tests.
 *
 * Covers the pure-function equivalents of three pieces of logic introduced in
 * the P10 fixes:
 *
 *   F1 — handleGoLive in Toolbar.jsx: auto-creates an output window when none
 *        exist, picks the best display index, and builds the slide payload.
 *
 *   F2 — OutputView.jsx startup: the NEW behavior unconditionally sets the
 *        startup slide (including YouTube-background slides) instead of
 *        filtering them out like the old code did.
 *
 *   State — goLiveProgram state transition used by AppContext.goLive.
 *
 * No React components are mounted; no IPC or DOM is required.
 */

// ── F1: shouldAutoCreate ───────────────────────────────────────────────────────
//
// Mirrors: `if (outputWindows.length === 0)` in Toolbar.jsx handleGoLive.
// Treats null/undefined as an empty list (no windows open).

function shouldAutoCreate(outputWindows) {
  if (outputWindows == null) return true;
  return outputWindows.length === 0;
}

// ── F1: bestDisplayFor ────────────────────────────────────────────────────────
//
// Mirrors: `(displays?.length ?? 0) > 1 ? 1 : 0` in Toolbar.jsx handleGoLive.
// Returns display index 1 when multiple displays are detected, otherwise 0.

function bestDisplayFor(displays) {
  return (displays?.length ?? 0) > 1 ? 1 : 0;
}

// ── F1: buildGoLiveSlide ──────────────────────────────────────────────────────
//
// Mirrors: `{ ...currentSlide, item: currentItem }` in Toolbar.jsx handleGoLive.
// Returns null when either argument is missing (the guard `if (!currentSlide || !currentItem)`).

function buildGoLiveSlide(currentSlide, currentItem) {
  if (!currentSlide || !currentItem) return null;
  return { ...currentSlide, item: currentItem };
}

// ── F2: resolveStartupSlide (NEW behavior) ────────────────────────────────────
//
// Mirrors: `setSlide(startSlide)` — the P10 fix that removes the stale-YouTube
// filter.  The slide is always passed through as-is.

function resolveStartupSlide(startSlide) {
  return startSlide ?? null;
}

// ── F2: resolveStartupSlideOld (OLD behavior — documented for comparison) ─────
//
// Mirrors the OLD code that was removed:
//   const isStaleYt = startSlide?.item?.background?.type === 'youtube';
//   setSlide(isStaleYt ? null : startSlide);
//
// Bug: When an output window is opened while a YouTube slide is live, the
// startup payload has type 'youtube'.  The old code discarded it, causing the
// output to remain blank instead of showing the correct background.  The new
// behavior (resolveStartupSlide) simply accepts every slide.

function resolveStartupSlideOld(startSlide) {
  const isStaleYt = startSlide?.item?.background?.type === 'youtube';
  return isStaleYt ? null : startSlide;
}

// ── goLiveProgram state transition ────────────────────────────────────────────
//
// Mirrors the state update triggered by AppContext.goLive after the slide is
// dispatched:  liveProgram is set, isLive turns true, blackout/clear reset.

function goLiveProgram(state, slide) {
  return {
    ...state,
    liveProgram: slide,
    isLive: true,
    isBlackout: false,
    isClear: false,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ytSlide = {
  id: 'yt-1',
  lines: '',
  item: {
    title: 'Worship Stream',
    background: { type: 'youtube', value: 'dQw4w9WgXcQ' },
  },
};

const imageSlide = {
  id: 'img-1',
  lines: 'Amazing grace',
  item: {
    title: 'Amazing Grace',
    background: { type: 'image', value: '/img/bg.jpg' },
  },
};

const noBackgroundSlide = {
  id: 'plain-1',
  lines: 'Some lyrics',
  item: { title: 'Plain Song' },
};

// ── shouldAutoCreate tests ────────────────────────────────────────────────────

describe('shouldAutoCreate', () => {
  it('returns true when outputWindows is empty', () => {
    expect(shouldAutoCreate([])).toBe(true);
  });

  it('returns false when outputWindows has one entry', () => {
    expect(shouldAutoCreate([{ id: 'win-1' }])).toBe(false);
  });

  it('returns false when outputWindows has multiple entries', () => {
    expect(shouldAutoCreate([{ id: 'win-1' }, { id: 'win-2' }])).toBe(false);
  });

  it('returns true for null (treated as no windows)', () => {
    expect(shouldAutoCreate(null)).toBe(true);
  });

  it('returns true for undefined (treated as no windows)', () => {
    expect(shouldAutoCreate(undefined)).toBe(true);
  });
});

// ── bestDisplayFor tests ──────────────────────────────────────────────────────

describe('bestDisplayFor', () => {
  it('returns 1 when displays has exactly 2 entries', () => {
    expect(bestDisplayFor([{}, {}])).toBe(1);
  });

  it('returns 1 when displays has 3+ entries', () => {
    expect(bestDisplayFor([{}, {}, {}])).toBe(1);
  });

  it('returns 0 when displays has exactly 1 entry', () => {
    expect(bestDisplayFor([{}])).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(bestDisplayFor([])).toBe(0);
  });

  it('returns 0 for null (no display info available)', () => {
    expect(bestDisplayFor(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(bestDisplayFor(undefined)).toBe(0);
  });
});

// ── buildGoLiveSlide tests ────────────────────────────────────────────────────

describe('buildGoLiveSlide', () => {
  const slide = { id: 's1', lines: 'Verse 1', extra: 'preserved' };
  const item  = { title: 'Amazing Grace', scheduleId: 'sch-1' };

  it('spreads currentSlide and attaches item', () => {
    const result = buildGoLiveSlide(slide, item);
    expect(result.id).toBe('s1');
    expect(result.lines).toBe('Verse 1');
    expect(result.item).toBe(item);
  });

  it('item property on result is the exact currentItem reference', () => {
    const result = buildGoLiveSlide(slide, item);
    expect(result.item).toBe(item);
  });

  it('preserves all extra fields from currentSlide', () => {
    const result = buildGoLiveSlide(slide, item);
    expect(result.extra).toBe('preserved');
  });

  it('returns null when currentSlide is null', () => {
    expect(buildGoLiveSlide(null, item)).toBeNull();
  });

  it('returns null when currentItem is null', () => {
    expect(buildGoLiveSlide(slide, null)).toBeNull();
  });

  it('returns null when both args are null', () => {
    expect(buildGoLiveSlide(null, null)).toBeNull();
  });

  it('returns null when currentSlide is undefined', () => {
    expect(buildGoLiveSlide(undefined, item)).toBeNull();
  });

  it('overrides any existing item field that was on the slide', () => {
    const slideWithItem = { ...slide, item: { title: 'Old Item' } };
    const result = buildGoLiveSlide(slideWithItem, item);
    expect(result.item).toBe(item); // new item wins
  });
});

// ── resolveStartupSlide (F2 NEW behavior) tests ───────────────────────────────

describe('resolveStartupSlide — F2 NEW behavior', () => {
  it('returns a YouTube-background slide as-is (the key fix)', () => {
    expect(resolveStartupSlide(ytSlide)).toBe(ytSlide);
  });

  it('returns an image-background slide as-is', () => {
    expect(resolveStartupSlide(imageSlide)).toBe(imageSlide);
  });

  it('returns a slide with no background as-is', () => {
    expect(resolveStartupSlide(noBackgroundSlide)).toBe(noBackgroundSlide);
  });

  it('returns null when slide is null', () => {
    expect(resolveStartupSlide(null)).toBeNull();
  });

  it('returns null when slide is undefined', () => {
    expect(resolveStartupSlide(undefined)).toBeNull();
  });
});

// ── resolveStartupSlideOld (F2 OLD behavior — bug documentation) ──────────────

describe('resolveStartupSlideOld — F2 OLD behavior (documents the bug)', () => {
  it('returns null for a YouTube-background slide (the bug: output stays blank)', () => {
    // This is exactly the bug that F2 fixed: opening an output window while a
    // YouTube slide was live caused the window to receive null and show nothing.
    expect(resolveStartupSlideOld(ytSlide)).toBeNull();
  });

  it('returns the slide when background type is image', () => {
    expect(resolveStartupSlideOld(imageSlide)).toBe(imageSlide);
  });

  it('returns the slide when background is missing', () => {
    expect(resolveStartupSlideOld(noBackgroundSlide)).toBe(noBackgroundSlide);
  });

  it('returns null when slide itself is null', () => {
    expect(resolveStartupSlideOld(null)).toBeNull();
  });

  it('new behavior differs from old behavior for YouTube slides', () => {
    // The old code would discard the slide; the new code keeps it.
    expect(resolveStartupSlideOld(ytSlide)).toBeNull();
    expect(resolveStartupSlide(ytSlide)).toBe(ytSlide);
  });
});

// ── goLiveProgram state transition tests ──────────────────────────────────────

describe('goLiveProgram', () => {
  const baseState = {
    liveProgram: null,
    isLive: false,
    isBlackout: false,
    isClear: false,
    schedule: [],
    activeScheduleIdx: 0,
  };

  it('sets liveProgram to the given slide', () => {
    const next = goLiveProgram(baseState, imageSlide);
    expect(next.liveProgram).toBe(imageSlide);
  });

  it('sets isLive to true', () => {
    const next = goLiveProgram(baseState, imageSlide);
    expect(next.isLive).toBe(true);
  });

  it('clears isBlackout', () => {
    const state = { ...baseState, isBlackout: true };
    expect(goLiveProgram(state, imageSlide).isBlackout).toBe(false);
  });

  it('clears isClear', () => {
    const state = { ...baseState, isClear: true };
    expect(goLiveProgram(state, imageSlide).isClear).toBe(false);
  });

  it('preserves other state fields', () => {
    const next = goLiveProgram(baseState, imageSlide);
    expect(next.schedule).toBe(baseState.schedule);
    expect(next.activeScheduleIdx).toBe(0);
  });

  it('replaces an existing liveProgram', () => {
    const state = { ...baseState, liveProgram: imageSlide, isLive: true };
    const next = goLiveProgram(state, ytSlide);
    expect(next.liveProgram).toBe(ytSlide);
  });

  it('works even when slide has a YouTube background (F2 regression guard)', () => {
    // After the F2 fix, goLiveProgram must accept YouTube slides without filtering.
    const next = goLiveProgram(baseState, ytSlide);
    expect(next.liveProgram).toBe(ytSlide);
    expect(next.isLive).toBe(true);
  });
});

/**
 * Multi-output routing tests.
 *
 * Tests three related systems that work together to route content to multiple
 * simultaneous output windows:
 *
 *  1. resolveSlideForRole — pure function in OutputView.jsx that determines
 *     which slide an output window should display based on its role, the
 *     explicit per-id overrides (liveOutputs), role-level overrides
 *     (liveRoleSlides), and the fallback program/stage slides.
 *
 *  2. goLiveOutput state transitions — mirrors AppContext.goLiveOutput;
 *     routes a slide to a specific window (by id) or to all windows with a
 *     given role.
 *
 *  3. goLiveAll state transitions — mirrors AppContext.goLiveAll; pushes the
 *     same slide to every open output window and all named role slots.
 *
 *  4. sendOutputState resolution — mirrors the reduce in AppContext.sendOutputState
 *     that computes the per-window slide map sent to Electron IPC.
 */

// ── resolveSlideForRole (mirrored from src/components/OutputView.jsx) ─────────
//
// Priority chain:
//   1. outputs[outputId].slide  (per-window override by id)
//   2. roleSlides[role]         (role-level override)
//   3. role-specific fallback   (stage → stageMirror logic; announcement/background/confidence → programSlide)
//   4. programSlide             (default for presentation / unknown roles)

function resolveSlideForRole(role, outputId, payload) {
  if (!payload) return null;
  if (outputId && payload.outputs?.[outputId]?.slide) {
    return payload.outputs[outputId].slide;
  }
  if (payload.roleSlides?.[role]) {
    return payload.roleSlides[role];
  }
  if (role === 'stage') {
    const mirror = payload.stageMirror !== false;
    return mirror ? payload.programSlide : (payload.stageSlide || payload.programSlide);
  }
  if (role === 'announcement') {
    return payload.announcementSlide || payload.programSlide;
  }
  if (role === 'background') {
    return payload.backgroundSlide || payload.programSlide;
  }
  if (role === 'confidence') {
    return payload.confidenceSlide || payload.programSlide;
  }
  return payload.programSlide;
}

// ── goLiveOutput state transition (mirrors AppContext.goLiveOutput) ───────────

function goLiveOutput(state, idOrRole, slide) {
  const isOpenOutput = state.outputWindows.some(w => w.id === idOrRole);
  const liveOutputs = isOpenOutput
    ? { ...state.liveOutputs, [idOrRole]: slide }
    : state.liveOutputs;
  const liveRoleSlides = !isOpenOutput
    ? { ...state.liveRoleSlides, [idOrRole]: slide }
    : state.liveRoleSlides;
  return {
    ...state,
    liveOutputs,
    liveRoleSlides,
    isLive: true,
    isBlackout: false,
    isClear: false,
  };
}

// ── goLiveAll state transition (mirrors AppContext.goLiveAll) ─────────────────

function goLiveAll(state, slide) {
  const outputs = state.outputWindows.reduce((acc, output) => ({
    ...acc,
    [output.id]: slide,
  }), {});
  return {
    ...state,
    liveProgram: slide,
    liveStage: slide,
    liveOutputs: outputs,
    liveRoleSlides: {
      ...state.liveRoleSlides,
      announcement: slide,
      background: slide,
      confidence: slide,
    },
    isLive: true,
    isBlackout: false,
    isClear: false,
  };
}

// ── sendOutputState resolution (mirrors AppContext.sendOutputState reduce) ────

function resolveOutputStateMap(state) {
  const { outputWindows, liveOutputs, liveRoleSlides, stageMirrorProgram, liveProgram, liveStage } = state;
  return outputWindows.reduce((acc, output) => {
    const slide = liveOutputs[output.id]
      ?? liveRoleSlides[output.role]
      ?? (output.role === 'stage'
        ? (stageMirrorProgram ? liveProgram : liveStage)
        : liveProgram);
    acc[output.id] = { role: output.role, slide };
    return acc;
  }, {});
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const slideA = { id: 'slide-a', lines: 'Amazing grace, how sweet the sound', item: { title: 'Amazing Grace' } };
const slideB = { id: 'slide-b', lines: 'How great thou art', item: { title: 'How Great Thou Art' } };
const slideC = { id: 'slide-c', lines: 'Announcement text', item: { title: 'Announcement' } };

const outputWindows = [
  { id: 'win-1', role: 'presentation' },
  { id: 'win-2', role: 'stage' },
  { id: 'win-3', role: 'announcement' },
];

function baseState(overrides = {}) {
  return {
    outputWindows,
    liveProgram: slideA,
    liveStage: slideA,
    liveOutputs: {},
    liveRoleSlides: {},
    stageMirrorProgram: true,
    isLive: false,
    isBlackout: false,
    isClear: false,
    ...overrides,
  };
}

// ── resolveSlideForRole tests ─────────────────────────────────────────────────

describe('resolveSlideForRole — per-id override (highest priority)', () => {
  it('returns the id-specific override when one exists', () => {
    const payload = {
      programSlide: slideA,
      outputs: { 'win-1': { slide: slideB } },
      roleSlides: {},
    };
    expect(resolveSlideForRole('presentation', 'win-1', payload)).toBe(slideB);
  });

  it('id override takes precedence over role override', () => {
    const payload = {
      programSlide: slideA,
      outputs: { 'win-1': { slide: slideB } },
      roleSlides: { presentation: slideC },
    };
    expect(resolveSlideForRole('presentation', 'win-1', payload)).toBe(slideB);
  });

  it('falls through to role override when outputId is absent from outputs map', () => {
    const payload = {
      programSlide: slideA,
      outputs: {},
      roleSlides: { presentation: slideC },
    };
    expect(resolveSlideForRole('presentation', 'win-1', payload)).toBe(slideC);
  });
});

describe('resolveSlideForRole — role-level override (second priority)', () => {
  it('returns roleSlides[role] when no id override exists', () => {
    const payload = { programSlide: slideA, roleSlides: { announcement: slideC }, outputs: {} };
    expect(resolveSlideForRole('announcement', 'win-3', payload)).toBe(slideC);
  });
});

describe('resolveSlideForRole — stage role', () => {
  it('mirrors programSlide when stageMirror is true (default)', () => {
    const payload = { programSlide: slideA, stageSlide: slideB, roleSlides: {}, outputs: {}, stageMirror: true };
    expect(resolveSlideForRole('stage', 'win-2', payload)).toBe(slideA);
  });

  it('uses stageSlide when stageMirror is false', () => {
    const payload = { programSlide: slideA, stageSlide: slideB, roleSlides: {}, outputs: {}, stageMirror: false };
    expect(resolveSlideForRole('stage', 'win-2', payload)).toBe(slideB);
  });

  it('falls back to programSlide when stageMirror=false and stageSlide is null', () => {
    const payload = { programSlide: slideA, stageSlide: null, roleSlides: {}, outputs: {}, stageMirror: false };
    expect(resolveSlideForRole('stage', 'win-2', payload)).toBe(slideA);
  });

  it('treats missing stageMirror key as true (mirror on by default)', () => {
    const payload = { programSlide: slideA, stageSlide: slideB, roleSlides: {}, outputs: {} };
    // stageMirror key is absent — `payload.stageMirror !== false` evaluates true
    expect(resolveSlideForRole('stage', 'win-2', payload)).toBe(slideA);
  });
});

describe('resolveSlideForRole — announcement / background / confidence roles', () => {
  it('announcement falls back to programSlide when no override', () => {
    const payload = { programSlide: slideA, roleSlides: {}, outputs: {} };
    expect(resolveSlideForRole('announcement', 'win-3', payload)).toBe(slideA);
  });

  it('background falls back to programSlide when no override', () => {
    const payload = { programSlide: slideA, roleSlides: {}, outputs: {} };
    expect(resolveSlideForRole('background', 'win-4', payload)).toBe(slideA);
  });

  it('confidence falls back to programSlide when no override', () => {
    const payload = { programSlide: slideA, roleSlides: {}, outputs: {} };
    expect(resolveSlideForRole('confidence', 'win-5', payload)).toBe(slideA);
  });
});

describe('resolveSlideForRole — null / missing payload', () => {
  it('returns null when payload is null', () => {
    expect(resolveSlideForRole('presentation', 'win-1', null)).toBeNull();
  });

  it('returns null when payload is undefined', () => {
    expect(resolveSlideForRole('presentation', 'win-1', undefined)).toBeNull();
  });
});

// ── goLiveOutput tests ────────────────────────────────────────────────────────

describe('goLiveOutput — routing by window id', () => {
  it('stores slide in liveOutputs keyed by the window id', () => {
    const next = goLiveOutput(baseState(), 'win-1', slideB);
    expect(next.liveOutputs['win-1']).toBe(slideB);
  });

  it('does NOT add the id to liveRoleSlides when routing by id', () => {
    const next = goLiveOutput(baseState(), 'win-1', slideB);
    expect(next.liveRoleSlides['win-1']).toBeUndefined();
  });

  it('leaves other outputs untouched', () => {
    const state = baseState({ liveOutputs: { 'win-2': slideA } });
    const next = goLiveOutput(state, 'win-1', slideB);
    expect(next.liveOutputs['win-2']).toBe(slideA); // unchanged
  });

  it('sets isLive=true and clears blackout/clear', () => {
    const state = baseState({ isLive: false, isBlackout: true, isClear: true });
    const next = goLiveOutput(state, 'win-1', slideB);
    expect(next.isLive).toBe(true);
    expect(next.isBlackout).toBe(false);
    expect(next.isClear).toBe(false);
  });
});

describe('goLiveOutput — routing by role', () => {
  it('stores slide in liveRoleSlides keyed by role when id does not match any window', () => {
    const next = goLiveOutput(baseState(), 'announcement', slideC);
    expect(next.liveRoleSlides['announcement']).toBe(slideC);
  });

  it('does NOT add role to liveOutputs when routing by role', () => {
    const next = goLiveOutput(baseState(), 'announcement', slideC);
    expect(next.liveOutputs['announcement']).toBeUndefined();
  });

  it('replaces an existing role entry', () => {
    const state = baseState({ liveRoleSlides: { announcement: slideA } });
    const next = goLiveOutput(state, 'announcement', slideC);
    expect(next.liveRoleSlides['announcement']).toBe(slideC);
  });
});

// ── goLiveAll tests ───────────────────────────────────────────────────────────

describe('goLiveAll', () => {
  it('sets liveProgram and liveStage to the given slide', () => {
    const next = goLiveAll(baseState(), slideB);
    expect(next.liveProgram).toBe(slideB);
    expect(next.liveStage).toBe(slideB);
  });

  it('puts the slide into liveOutputs for every open output window', () => {
    const next = goLiveAll(baseState(), slideB);
    outputWindows.forEach(w => {
      expect(next.liveOutputs[w.id]).toBe(slideB);
    });
  });

  it('sets announcement, background, confidence role slots', () => {
    const next = goLiveAll(baseState(), slideB);
    expect(next.liveRoleSlides.announcement).toBe(slideB);
    expect(next.liveRoleSlides.background).toBe(slideB);
    expect(next.liveRoleSlides.confidence).toBe(slideB);
  });

  it('preserves other existing roleSlides entries not covered by goLiveAll', () => {
    const state = baseState({ liveRoleSlides: { custom: slideA } });
    const next = goLiveAll(state, slideB);
    expect(next.liveRoleSlides.custom).toBe(slideA); // untouched
  });

  it('sets isLive=true and clears blackout/clear', () => {
    const state = baseState({ isLive: false, isBlackout: true, isClear: true });
    const next = goLiveAll(state, slideB);
    expect(next.isLive).toBe(true);
    expect(next.isBlackout).toBe(false);
    expect(next.isClear).toBe(false);
  });

  it('works correctly with an empty outputWindows list', () => {
    const state = baseState({ outputWindows: [] });
    const next = goLiveAll(state, slideB);
    expect(next.liveOutputs).toEqual({});
    expect(next.liveProgram).toBe(slideB);
  });
});

// ── sendOutputState resolution precedence tests ───────────────────────────────

describe('sendOutputState resolution — per-window id override (highest priority)', () => {
  it('uses liveOutputs[id] over role fallback', () => {
    const state = baseState({
      liveOutputs: { 'win-1': slideB },
      liveRoleSlides: { presentation: slideC },
    });
    const map = resolveOutputStateMap(state);
    expect(map['win-1'].slide).toBe(slideB);
  });
});

describe('sendOutputState resolution — role override (second priority)', () => {
  it('uses liveRoleSlides[role] when no id override exists', () => {
    const state = baseState({ liveRoleSlides: { announcement: slideC } });
    const map = resolveOutputStateMap(state);
    expect(map['win-3'].slide).toBe(slideC); // win-3 has role 'announcement'
  });
});

describe('sendOutputState resolution — stage mirror fallback', () => {
  it('mirrors programSlide to stage window when stageMirrorProgram=true', () => {
    const state = baseState({ liveProgram: slideA, liveStage: slideB, stageMirrorProgram: true });
    const map = resolveOutputStateMap(state);
    expect(map['win-2'].slide).toBe(slideA); // win-2 is stage; mirror → programSlide
  });

  it('uses liveStage for stage window when stageMirrorProgram=false', () => {
    const state = baseState({ liveProgram: slideA, liveStage: slideB, stageMirrorProgram: false });
    const map = resolveOutputStateMap(state);
    expect(map['win-2'].slide).toBe(slideB);
  });
});

describe('sendOutputState resolution — default programSlide fallback', () => {
  it('falls back to programSlide for presentation role when no overrides exist', () => {
    const state = baseState();
    const map = resolveOutputStateMap(state);
    expect(map['win-1'].slide).toBe(slideA); // liveProgram = slideA
  });

  it('includes role in every entry', () => {
    const map = resolveOutputStateMap(baseState());
    expect(map['win-1'].role).toBe('presentation');
    expect(map['win-2'].role).toBe('stage');
    expect(map['win-3'].role).toBe('announcement');
  });

  it('produces an entry for every open output window', () => {
    const map = resolveOutputStateMap(baseState());
    expect(Object.keys(map)).toHaveLength(outputWindows.length);
  });

  it('returns an empty map when there are no output windows', () => {
    const state = baseState({ outputWindows: [] });
    expect(resolveOutputStateMap(state)).toEqual({});
  });
});

describe('sendOutputState resolution — override precedence order', () => {
  it('id override > role override > fallback', () => {
    const state = baseState({
      liveOutputs: { 'win-3': slideA },         // id override for win-3 (announcement)
      liveRoleSlides: { announcement: slideB },  // role override for announcement
      liveProgram: slideC,                       // fallback
    });
    const map = resolveOutputStateMap(state);
    // id override wins
    expect(map['win-3'].slide).toBe(slideA);
  });

  it('role override > fallback when no id override', () => {
    const state = baseState({
      liveOutputs: {},
      liveRoleSlides: { announcement: slideB },
      liveProgram: slideC,
    });
    const map = resolveOutputStateMap(state);
    expect(map['win-3'].slide).toBe(slideB);
  });
});

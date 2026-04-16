const LIVE_STATE_KEY = 'cp_live_state';

const defaultLiveState = {
  programSlide: null,
  stageSlide: null,
  stageMirror: true,
  isBlackout: false,
  isClear: false,
  outputs: {},
};

/** Migrate older single-slide payload to program+stage */
function normalizeStored(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ...defaultLiveState };
  if ('programSlide' in parsed || 'stageSlide' in parsed) {
    return {
      programSlide: parsed.programSlide || null,
      stageSlide: parsed.stageSlide || null,
      stageMirror: parsed.stageMirror !== false,
      isBlackout: !!parsed.isBlackout,
      isClear: !!parsed.isClear,
      outputs: parsed.outputs || {},
    };
  }
  const legacy = parsed.slide || null;
  return {
    programSlide: legacy,
    stageSlide: legacy,
    stageMirror: true,
    isBlackout: !!parsed.isBlackout,
    isClear: !!parsed.isClear,
  };
}

export function readLiveState() {
  try {
    const raw = localStorage.getItem(LIVE_STATE_KEY);
    if (!raw) return defaultLiveState;
    const parsed = JSON.parse(raw);
    return normalizeStored(parsed);
  } catch {
    return defaultLiveState;
  }
}

export function writeLiveState(state) {
  try {
    localStorage.setItem(LIVE_STATE_KEY, JSON.stringify({
      programSlide: state?.programSlide ?? null,
      stageSlide: state?.stageSlide ?? null,
      stageMirror: state?.stageMirror !== false,
      isBlackout: !!state?.isBlackout,
      isClear: !!state?.isClear,
      outputs: typeof state?.outputs === 'object' && state.outputs !== null ? state.outputs : {},
    }));
  } catch {
    // Ignore quota/security errors; BroadcastChannel still handles live updates.
  }
}


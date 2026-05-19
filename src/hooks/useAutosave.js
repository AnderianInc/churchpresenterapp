import { useEffect, useRef, useState } from 'react';

/**
 * Debounced autosave hook.
 *
 *   const status = useAutosave(value, save, { enabled, delay });
 *
 * - `value` is whatever changes you want to react to. Pass an object/array
 *   and the hook will refire when its identity changes.
 * - `save(value)` is called once `delay` ms have passed without further
 *   changes. May return a promise; the status indicator waits on it.
 * - `enabled` (default true) turns the autosave off without unmounting.
 * - `delay` (default 400) is the debounce window in ms.
 *
 * The returned `status` is one of `'idle' | 'pending' | 'saving' | 'saved' | 'error'`.
 * 'saved' auto-resets to 'idle' after 2s so it can act as a transient toast.
 *
 * The first render is treated as the baseline — no save is fired until the
 * value actually changes after mount. This lets callers initialise local
 * editor state from props without triggering a write.
 */
export default function useAutosave(value, save, { enabled = true, delay = 400 } = {}) {
  const [status, setStatus] = useState('idle');
  const firstRender = useRef(true);
  const timer = useRef(null);
  const savedTimer = useRef(null);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!enabled) return;

    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; }

    timer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await save(value);
        setStatus('saved');
        savedTimer.current = setTimeout(() => setStatus('idle'), 2000);
      } catch (_) {
        setStatus('error');
      }
    }, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  // The caller is responsible for `value` identity changing meaningfully;
  // `save` should be stable (useCallback) to avoid re-arming on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, delay]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  return status;
}

import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for live control.
 * Only active on the main window — not in modals (checked via target tag).
 *
 * Space / ArrowRight / PageDown  → next slide
 * ArrowLeft  / PageUp            → previous slide
 * Enter                          → send current slide to program (go live)
 * B                              → toggle blackout
 * C                              → toggle clear
 * Cmd/Ctrl+Z                     → undo schedule change
 * Cmd/Ctrl+Shift+Z / Ctrl+Y      → redo schedule change
 * F11                            → toggle fullscreen (Electron)
 */
export function useKeyboardShortcuts({ onNext, onPrev, onGoLive, onBlackout, onClear, onUndo, onRedo }) {
  useEffect(() => {
    const handler = (e) => {
      // Undo/redo work even when focused in inputs (Cmd/Ctrl+Z is expected everywhere)
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Skip remaining shortcuts if focus is inside an input/textarea/select
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.key) {
        case ' ':
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          onNext?.();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          onPrev?.();
          break;
        case 'Enter':
          e.preventDefault();
          onGoLive?.();
          break;
        case 'b':
        case 'B':
          onBlackout?.();
          break;
        case 'c':
        case 'C':
          onClear?.();
          break;
        case 'F11':
          e.preventDefault();
          if (window.electronAPI) {
            // Let Electron handle fullscreen natively; nothing to do here
          } else {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
            else document.exitFullscreen?.();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNext, onPrev, onGoLive, onBlackout, onClear, onUndo, onRedo]);
}

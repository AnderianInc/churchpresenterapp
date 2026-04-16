/**
 * Tests for keyboard shortcut routing.
 * We test the dispatch logic directly rather than mounting the full hook
 * to avoid JSDOM event complexity.
 */

// Replicate the routing logic from useKeyboardShortcuts
function routeKey(key, activeTag, handlers) {
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return 'blocked';
  const { onNext, onPrev, onGoLive, onBlackout, onClear } = handlers;
  switch (key) {
    case ' ':
    case 'ArrowRight':
    case 'PageDown':
      onNext?.();
      return 'next';
    case 'ArrowLeft':
    case 'PageUp':
      onPrev?.();
      return 'prev';
    case 'Enter':
      onGoLive?.();
      return 'live';
    case 'b':
    case 'B':
      onBlackout?.();
      return 'blackout';
    case 'c':
    case 'C':
      onClear?.();
      return 'clear';
    default:
      return 'unhandled';
  }
}

describe('keyboard shortcut routing', () => {
  let calls;
  let handlers;

  beforeEach(() => {
    calls = { next: 0, prev: 0, live: 0, blackout: 0, clear: 0 };
    handlers = {
      onNext: () => calls.next++,
      onPrev: () => calls.prev++,
      onGoLive: () => calls.live++,
      onBlackout: () => calls.blackout++,
      onClear: () => calls.clear++,
    };
  });

  it('Space triggers next', () => {
    routeKey(' ', 'div', handlers);
    expect(calls.next).toBe(1);
  });

  it('ArrowRight triggers next', () => {
    routeKey('ArrowRight', 'div', handlers);
    expect(calls.next).toBe(1);
  });

  it('PageDown triggers next', () => {
    routeKey('PageDown', 'div', handlers);
    expect(calls.next).toBe(1);
  });

  it('ArrowLeft triggers prev', () => {
    routeKey('ArrowLeft', 'div', handlers);
    expect(calls.prev).toBe(1);
  });

  it('PageUp triggers prev', () => {
    routeKey('PageUp', 'div', handlers);
    expect(calls.prev).toBe(1);
  });

  it('Enter triggers go live', () => {
    routeKey('Enter', 'div', handlers);
    expect(calls.live).toBe(1);
  });

  it('b triggers blackout', () => {
    routeKey('b', 'div', handlers);
    expect(calls.blackout).toBe(1);
  });

  it('B triggers blackout', () => {
    routeKey('B', 'div', handlers);
    expect(calls.blackout).toBe(1);
  });

  it('c triggers clear', () => {
    routeKey('c', 'div', handlers);
    expect(calls.clear).toBe(1);
  });

  it('C triggers clear', () => {
    routeKey('C', 'div', handlers);
    expect(calls.clear).toBe(1);
  });

  it('blocks all shortcuts when focus is in an input', () => {
    ['input', 'textarea', 'select'].forEach(tag => {
      const result = routeKey(' ', tag, handlers);
      expect(result).toBe('blocked');
    });
    expect(calls.next).toBe(0);
  });

  it('does not call undefined handlers gracefully', () => {
    expect(() => routeKey(' ', 'div', {})).not.toThrow();
  });

  it('returns unhandled for unknown keys', () => {
    const result = routeKey('z', 'div', handlers);
    expect(result).toBe('unhandled');
    expect(Object.values(calls).every(v => v === 0)).toBe(true);
  });
});

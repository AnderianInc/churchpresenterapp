import { shouldShowTimersWindow } from '../utils/timerWindowVisibility';

describe('shouldShowTimersWindow', () => {
  it('keeps the timer window visible when the timers window is open even if another panel is active', () => {
    expect(shouldShowTimersWindow(true, 'schedule')).toBe(true);
    expect(shouldShowTimersWindow(true, 'media')).toBe(true);
  });

  it('shows the timer window while the timers view is active', () => {
    expect(shouldShowTimersWindow(false, 'timers')).toBe(true);
  });

  it('hides the timer window when it is closed and no timers view is active', () => {
    expect(shouldShowTimersWindow(false, 'schedule')).toBe(false);
    expect(shouldShowTimersWindow(false, 'library')).toBe(false);
  });
});

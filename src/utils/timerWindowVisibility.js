export function shouldShowTimersWindow(isTimerWindowOpen, activeView) {
  return isTimerWindowOpen || activeView === 'timers';
}

export function getFloatingWindowBodyStyle(minimized) {
  return {
    display: minimized ? 'none' : 'flex',
    flex: 1,
    overflow: 'hidden',
    flexDirection: 'column',
    minHeight: 0,
  };
}

import { getFloatingWindowBodyStyle } from '../utils/floatingWindowState';

describe('getFloatingWindowBodyStyle', () => {
  it('hides the content while preserving the mounted node when minimized', () => {
    const style = getFloatingWindowBodyStyle(true);
    expect(style.display).toBe('none');
    expect(style.flex).toBe(1);
  });

  it('shows the content again when expanded', () => {
    const style = getFloatingWindowBodyStyle(false);
    expect(style.display).toBe('flex');
    expect(style.flex).toBe(1);
  });
});

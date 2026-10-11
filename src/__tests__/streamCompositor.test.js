import { coverRect, wrapText, overlayLayout } from '../utils/streamCompositor';

// Fake 2D context: measures text width as chars * 10 for deterministic wrapping.
function fakeCtx(charW = 10) {
  return { measureText: (s) => ({ width: s.length * charW }) };
}

describe('coverRect', () => {
  it('crops horizontally when source is wider than dest aspect', () => {
    // 1920x1080 source into 1280x720 dest — same 16:9, no crop
    const r = coverRect(1920, 1080, 1280, 720);
    expect(Math.round(r.sWidth)).toBe(1920);
    expect(Math.round(r.sHeight)).toBe(1080);
    expect(Math.round(r.sx)).toBe(0);
    expect(Math.round(r.sy)).toBe(0);
  });

  it('crops the sides when source is wider (e.g. 2:1 into 16:9)', () => {
    const r = coverRect(2000, 1000, 1280, 720); // source 2:1, dest 16:9 -> crop width
    expect(r.sWidth).toBeLessThan(2000);
    expect(Math.round(r.sHeight)).toBe(1000);
    expect(r.sx).toBeGreaterThan(0);
  });

  it('crops top/bottom when source is taller (e.g. 1:1 into 16:9)', () => {
    const r = coverRect(1000, 1000, 1280, 720);
    expect(Math.round(r.sWidth)).toBe(1000);
    expect(r.sHeight).toBeLessThan(1000);
    expect(r.sy).toBeGreaterThan(0);
  });

  it('handles zero source dimensions safely', () => {
    const r = coverRect(0, 0, 1280, 720);
    expect(r.sWidth).toBe(0);
    expect(r.sHeight).toBe(0);
  });
});

describe('wrapText', () => {
  it('returns [] for empty text', () => {
    expect(wrapText(fakeCtx(), '', 100)).toEqual([]);
    expect(wrapText(fakeCtx(), '   ', 100)).toEqual([]);
  });

  it('keeps short text on one line', () => {
    expect(wrapText(fakeCtx(), 'hello world', 1000)).toEqual(['hello world']);
  });

  it('wraps when a line exceeds maxWidth', () => {
    // each word 5 chars * 10 = 50px; maxWidth 110 fits ~2 words ("aaaaa aaaaa"=11 chars=110)
    const lines = wrapText(fakeCtx(), 'aaaaa aaaaa aaaaa', 110);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('aaaaa aaaaa');
    expect(lines[1]).toBe('aaaaa');
  });

  it('puts an over-long single word on its own line', () => {
    const lines = wrapText(fakeCtx(), 'short superlongword', 60);
    expect(lines).toEqual(['short', 'superlongword']);
  });
});

describe('overlayLayout', () => {
  it('bottom band sits at the bottom', () => {
    const l = overlayLayout('bottom', 1280, 720);
    expect(l.bandY + l.bandH).toBe(720);
  });

  it('top band sits at the top', () => {
    const l = overlayLayout('top', 1280, 720);
    expect(l.bandY).toBe(0);
    expect(l.fromTop).toBe(true);
  });

  it('center band is vertically centered', () => {
    const l = overlayLayout('center', 1280, 720);
    expect(l.bandY).toBeGreaterThan(0);
    expect(l.bandY + l.bandH).toBeLessThan(720);
  });

  it('defaults unknown position to bottom', () => {
    const l = overlayLayout('whatever', 1280, 720);
    expect(l.bandY + l.bandH).toBe(720);
  });
});

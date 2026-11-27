import {
  SLIDE_DRAG_MIME, startSlideDrag, hasSlideDrag, readSlideDrag, copySlideForTarget,
  startScheduleItemDrag, hasScheduleItemDrag, readScheduleItemDrag, pickItemStyle,
} from '../utils/slideDnd';

function fakeDataTransfer() {
  const store = {};
  return {
    effectAllowed: 'none',
    setData: (type, value) => { store[type] = value; },
    getData: (type) => store[type] ?? '',
    get types() { return Object.keys(store); },
  };
}

describe('slide drag payload', () => {
  const slide = { id: 's1', type: 'verse', label: 'Verse 1', lines: 'Line one' };

  it('round-trips a slide through dataTransfer', () => {
    const dt = fakeDataTransfer();
    const e = { dataTransfer: dt };
    startSlideDrag(e, slide, { background: { type: 'color', value: '#111' }, textColor: '#fff' });
    expect(dt.effectAllowed).toBe('copy');
    expect(hasSlideDrag(e)).toBe(true);
    expect(readSlideDrag(e)).toEqual({
      slide,
      itemStyle: { background: { type: 'color', value: '#111' }, textColor: '#fff' },
    });
  });

  it('ignores drags that carry no slide payload (e.g. schedule reorder)', () => {
    const e = { dataTransfer: fakeDataTransfer() };
    expect(hasSlideDrag(e)).toBe(false);
    expect(readSlideDrag(e)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    const dt = fakeDataTransfer();
    dt.setData(SLIDE_DRAG_MIME, '{not json');
    expect(readSlideDrag({ dataTransfer: dt })).toBeNull();
  });

  it('copies get a fresh id and keep their content', () => {
    const copy = copySlideForTarget(slide);
    expect(copy.id).not.toBe(slide.id);
    expect(copy).toMatchObject({ type: 'verse', label: 'Verse 1', lines: 'Line one' });
    expect(slide.id).toBe('s1');
  });
});

describe('schedule item drag payload', () => {
  it('round-trips a schedule item id and is distinct from slide drags', () => {
    const dt = fakeDataTransfer();
    const e = { dataTransfer: dt };
    startScheduleItemDrag(e, 'sch-42');
    expect(hasScheduleItemDrag(e)).toBe(true);
    expect(hasSlideDrag(e)).toBe(false);
    expect(readScheduleItemDrag(e)).toBe('sch-42');
  });

  it('returns null when no schedule item is being dragged', () => {
    const e = { dataTransfer: fakeDataTransfer() };
    expect(hasScheduleItemDrag(e)).toBe(false);
    expect(readScheduleItemDrag(e)).toBeNull();
  });
});

describe('pickItemStyle', () => {
  it('keeps only the presentation fields that are set', () => {
    expect(pickItemStyle({ title: 'x', textColor: '#fff', fontSize: 40, background: { type: 'color', value: '#000' } }))
      .toEqual({ background: { type: 'color', value: '#000' }, textColor: '#fff', fontSize: 40 });
    expect(pickItemStyle(undefined)).toEqual({});
  });
});

const { buildScriptureLowerThird } = require('../utils/lowerThird');

describe('buildScriptureLowerThird', () => {
  it('creates a stream-ready lower-third for scripture slides', () => {
    const slide = {
      id: 'v1',
      type: 'scripture',
      label: 'John 3:16',
      reference: 'John 3:16',
      version: 'KJV',
      item: { type: 'scripture', reference: 'John 3:16', version: 'KJV' },
      lines: 'For God so loved the world...\n\n— John 3:16 (KJV)',
    };

    expect(buildScriptureLowerThird(slide)).toEqual({
      active: true,
      label: 'Scripture',
      text: 'John 3:16',
      source: 'KJV',
    });
  });

  it('returns null for non-scripture slides', () => {
    expect(buildScriptureLowerThird({ id: 's1', type: 'announcement', label: 'Welcome' })).toBeNull();
  });
});

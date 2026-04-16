import { validateSong, validateSongsArray, validateScheduleArray, validateSettings, safeJsonParse } from '../store/persistence';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });
  it('returns null on invalid JSON', () => {
    expect(safeJsonParse('not json {')).toBeNull();
  });
  it('returns null on empty string', () => {
    expect(safeJsonParse('')).toBeNull();
  });
});

describe('validateSong', () => {
  const validSong = {
    id: 'abc-123', title: 'Amazing Grace', author: 'John Newton',
    key: 'G', tempo: 'Slow', tags: ['hymn'],
    slides: [{ id: 's1', type: 'verse', label: 'Verse 1', lines: 'Amazing grace' }],
    background: { type: 'color', value: '#0a0f1e' },
    textColor: '#ffffff', fontSize: 44, fontFamily: 'Georgia',
  };

  it('accepts a fully valid song', () => {
    const result = validateSong(validSong);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null input', () => {
    expect(validateSong(null).valid).toBe(false);
    expect(validateSong(null).errors[0]).toMatch(/not an object/);
  });

  it('rejects song with missing id', () => {
    const result = validateSong({ ...validSong, id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing id');
  });

  it('rejects song with blank title', () => {
    const result = validateSong({ ...validSong, title: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing title');
  });

  it('rejects song with non-array slides', () => {
    const result = validateSong({ ...validSong, slides: 'not an array' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('slides must be array');
  });

  it('provides sensible defaults for optional fields', () => {
    const minimal = { id: 'x', title: 'Test', slides: [] };
    const result = validateSong(minimal);
    expect(result.data.author).toBe('');
    expect(result.data.tags).toEqual([]);
    expect(result.data.fontSize).toBe(44);
    expect(result.data.fontFamily).toBe('Georgia');
  });
});

describe('validateSongsArray', () => {
  it('returns empty array for non-array input', () => {
    expect(validateSongsArray(null)).toEqual([]);
    expect(validateSongsArray('string')).toEqual([]);
    expect(validateSongsArray(42)).toEqual([]);
  });

  it('filters and normalizes a mixed array', () => {
    const input = [
      { id: 'a', title: 'Good Song', slides: [] },
      null,
      { id: 'b', title: 'Also Good', slides: [] },
    ];
    const result = validateSongsArray(input);
    // null is coerced to a song with generated id (validateSong returns data regardless)
    expect(result.length).toBe(3);
    expect(result[0].title).toBe('Good Song');
  });
});

describe('validateScheduleArray', () => {
  it('returns empty array for non-array input', () => {
    expect(validateScheduleArray(null)).toEqual([]);
  });

  it('filters items missing scheduleId or title', () => {
    const input = [
      { scheduleId: 's1', title: 'Amazing Grace', type: 'song', slides: [] },
      { title: 'No ID' },           // missing scheduleId
      { scheduleId: 's3' },         // missing title
      null,
    ];
    const result = validateScheduleArray(input);
    expect(result).toHaveLength(1);
    expect(result[0].scheduleId).toBe('s1');
  });
});

describe('validateSettings', () => {
  it('returns defaults for null input', () => {
    const result = validateSettings(null);
    expect(result.theme).toBe('dark');
    expect(result.defaultFontSize).toBe(44);
    expect(result.defaultFont).toBe('Georgia');
  });

  it('merges provided values over defaults', () => {
    const result = validateSettings({ theme: 'light', defaultFontSize: 52 });
    expect(result.theme).toBe('light');
    expect(result.defaultFontSize).toBe(52);
    expect(result.defaultFont).toBe('Georgia'); // default preserved
  });
});

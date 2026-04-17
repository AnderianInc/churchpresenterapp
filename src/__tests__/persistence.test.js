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

describe('validateSong — slide field preservation (P6/P8 fields)', () => {
  it('preserves textAlign on slides', () => {
    const song = {
      id: 's1', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello', textAlign: 'center' },
      ],
    };
    const result = validateSong(song);
    expect(result.data.slides[0].textAlign).toBe('center');
  });

  it('preserves chords on slides', () => {
    const song = {
      id: 's2', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello', chords: 'G  D  Em' },
      ],
    };
    const result = validateSong(song);
    expect(result.data.slides[0].chords).toBe('G  D  Em');
  });

  it('preserves per-slide color background override', () => {
    const song = {
      id: 's3', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello', background: { type: 'color', value: '#ff0000' } },
      ],
    };
    const result = validateSong(song);
    expect(result.data.slides[0].background).toEqual({ type: 'color', value: '#ff0000' });
  });

  it('preserves per-slide gradient background override', () => {
    const css = 'linear-gradient(135deg, #000 0%, #111 100%)';
    const song = {
      id: 's4', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello', background: { type: 'gradient', value: css } },
      ],
    };
    const result = validateSong(song);
    expect(result.data.slides[0].background).toEqual({ type: 'gradient', value: css });
  });

  it('preserves per-slide image background override', () => {
    const song = {
      id: 's5', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello', background: { type: 'image', value: 'file:///foo.jpg', brightness: 0.7 } },
      ],
    };
    const result = validateSong(song);
    expect(result.data.slides[0].background).toEqual({ type: 'image', value: 'file:///foo.jpg', brightness: 0.7 });
  });

  it('omits background when slide has no override (not set to null/default)', () => {
    const song = {
      id: 's6', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello' },
      ],
    };
    const result = validateSong(song);
    expect(result.data.slides[0].background).toBeUndefined();
  });

  it('drops unknown background types gracefully (no crash)', () => {
    const song = {
      id: 's7', title: 'Test', slides: [
        { id: 'sl1', type: 'verse', label: 'V1', lines: 'Hello', background: { type: 'unknown', value: 'xyz' } },
      ],
    };
    expect(() => validateSong(song)).not.toThrow();
    const result = validateSong(song);
    expect(result.data.slides[0].background).toBeUndefined();
  });

  it('preserves all three P6/P8 fields together on one slide', () => {
    const song = {
      id: 's8', title: 'Test', slides: [
        {
          id: 'sl1', type: 'chorus', label: 'Chorus', lines: 'Words',
          textAlign: 'right',
          chords: 'Am  F  C  G',
          background: { type: 'color', value: '#111' },
        },
      ],
    };
    const slide = validateSong(song).data.slides[0];
    expect(slide.textAlign).toBe('right');
    expect(slide.chords).toBe('Am  F  C  G');
    expect(slide.background).toEqual({ type: 'color', value: '#111' });
  });
});

describe('validateSong — song-level background', () => {
  it('accepts a color background', () => {
    const song = { id: 'x', title: 'T', slides: [], background: { type: 'color', value: '#123456' } };
    expect(validateSong(song).data.background).toEqual({ type: 'color', value: '#123456' });
  });

  it('accepts an image background with brightness', () => {
    const bg = { type: 'image', value: 'file:///bg.jpg', brightness: 0.5 };
    const song = { id: 'x', title: 'T', slides: [], background: bg };
    expect(validateSong(song).data.background).toEqual(bg);
  });

  it('falls back to default color when background is missing', () => {
    const song = { id: 'x', title: 'T', slides: [] };
    expect(validateSong(song).data.background).toEqual({ type: 'color', value: '#0a0f1e' });
  });

  it('falls back to default color when background type is unrecognised', () => {
    const song = { id: 'x', title: 'T', slides: [], background: { type: 'neon', value: '#f0f' } };
    expect(validateSong(song).data.background).toEqual({ type: 'color', value: '#0a0f1e' });
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

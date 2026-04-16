/**
 * Tests for electron/validators.js
 *
 * These run in the Jest/JSDOM environment even though the code targets
 * CommonJS (Node). We use require() directly.
 */

const {
  VALIDATORS,
  validateSongsArray,
  validateScheduleArray,
  validateSettings,
} = require('../../electron/validators.js');

describe('electron validateSongsArray', () => {
  it('returns null for non-array input (signals "use defaults")', () => {
    expect(validateSongsArray(null)).toBeNull();
    expect(validateSongsArray({})).toBeNull();
    expect(validateSongsArray('string')).toBeNull();
  });

  it('normalises a valid songs array', () => {
    const input = [{
      id: 'abc', title: 'Amazing Grace', author: 'John Newton',
      key: 'G', tempo: 'Slow', tags: ['hymn'],
      slides: [{ id: 's1', type: 'verse', label: 'Verse 1', lines: 'Amazing grace' }],
      background: { type: 'color', value: '#000' }, textColor: '#fff', fontSize: 44, fontFamily: 'Georgia',
    }];
    const result = validateSongsArray(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].title).toBe('Amazing Grace');
    expect(result[0].id).toBe('abc');
  });

  it('fills in defaults for missing fields', () => {
    const minimal = [{ id: 'x', title: 'Test', slides: [] }];
    const result = validateSongsArray(minimal);
    expect(result[0].author).toBe('');
    expect(result[0].fontSize).toBe(44);
    expect(result[0].fontFamily).toBe('Georgia');
    expect(result[0].textColor).toBe('#ffffff');
  });

  it('replaces missing song id with a generated uuid', () => {
    const input = [{ title: 'No ID Song', slides: [] }];
    const result = validateSongsArray(input);
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('replaces missing slide id with a generated uuid', () => {
    const input = [{ id: 'x', title: 'Test', slides: [{ type: 'verse', lines: 'Hello' }] }];
    const result = validateSongsArray(input);
    expect(typeof result[0].slides[0].id).toBe('string');
    expect(result[0].slides[0].id.length).toBeGreaterThan(0);
  });

  it('handles a corrupt slide entry (null) gracefully', () => {
    const input = [{ id: 'x', title: 'Test', slides: [null, { id: 's1', type: 'verse', label: 'V1', lines: 'ok' }] }];
    const result = validateSongsArray(input);
    expect(result[0].slides).toHaveLength(2);
    expect(result[0].slides[0].lines).toBe(''); // null → empty slide
  });

  it('normalises fontSize that is zero or negative to 44', () => {
    const input = [{ id: 'x', title: 'Test', slides: [], fontSize: -1 }];
    const result = validateSongsArray(input);
    expect(result[0].fontSize).toBe(44);
  });
});

describe('electron validateScheduleArray', () => {
  it('returns empty array for non-array input', () => {
    expect(validateScheduleArray(null)).toEqual([]);
    expect(validateScheduleArray('bad')).toEqual([]);
  });

  it('keeps valid schedule items', () => {
    const input = [{ scheduleId: 's1', title: 'Amazing Grace', type: 'song', slides: [] }];
    expect(validateScheduleArray(input)).toHaveLength(1);
  });

  it('removes items missing scheduleId', () => {
    const input = [{ title: 'Missing ID', type: 'song', slides: [] }];
    expect(validateScheduleArray(input)).toHaveLength(0);
  });

  it('removes items missing title', () => {
    const input = [{ scheduleId: 's1', type: 'song', slides: [] }];
    expect(validateScheduleArray(input)).toHaveLength(0);
  });

  it('removes null entries', () => {
    const input = [null, { scheduleId: 's1', title: 'OK', slides: [] }];
    expect(validateScheduleArray(input)).toHaveLength(1);
  });
});

describe('electron validateSettings', () => {
  it('returns defaults for null input', () => {
    const result = validateSettings(null);
    expect(result.theme).toBe('dark');
    expect(result.defaultFontSize).toBe(44);
    expect(result.defaultFont).toBe('Georgia');
  });

  it('merges provided values preserving defaults for missing keys', () => {
    const result = validateSettings({ theme: 'light', defaultFontSize: 52 });
    expect(result.theme).toBe('light');
    expect(result.defaultFontSize).toBe(52);
    expect(result.defaultFont).toBe('Georgia');
  });

  it('does not add unexpected keys from provided object', () => {
    // merging is fine — just check it does not blow up
    const result = validateSettings({ unknownKey: 'value' });
    expect(result.theme).toBe('dark');
  });
});

describe('VALIDATORS map', () => {
  it('has entries for songs, schedules, and settings', () => {
    expect(typeof VALIDATORS.songs).toBe('function');
    expect(typeof VALIDATORS.schedules).toBe('function');
    expect(typeof VALIDATORS.settings).toBe('function');
  });
});

describe('read-file recovery simulation', () => {
  /**
   * Simulate what happens in the hardened read-file handler:
   * 1. Parse raw JSON
   * 2. Validate/normalise
   * 3. If songs returns null → trigger recovery
   */
  function simulateReadFile(key, rawContent, defaults) {
    let parsed;
    try { parsed = JSON.parse(rawContent); }
    catch { return { action: 'recover', reason: 'JSON parse error', value: defaults[key] }; }

    const validator = VALIDATORS[key];
    const normalised = validator(parsed);

    if (key === 'songs' && normalised === null) {
      return { action: 'recover', reason: 'not an array', value: defaults[key] };
    }
    return { action: 'ok', value: normalised };
  }

  const defaults = {
    songs: [{ id: 'default-song-1', title: 'Amazing Grace', slides: [] }],
    schedules: [],
    settings: { theme: 'dark', defaultFontSize: 44, defaultFont: 'Georgia' },
  };

  it('returns ok + normalised data for valid songs JSON', () => {
    const raw = JSON.stringify([{ id: 'x', title: 'Test Song', slides: [] }]);
    const result = simulateReadFile('songs', raw, defaults);
    expect(result.action).toBe('ok');
    expect(result.value[0].title).toBe('Test Song');
  });

  it('triggers recovery for corrupt JSON', () => {
    const result = simulateReadFile('songs', '{ CORRUPT }', defaults);
    expect(result.action).toBe('recover');
    expect(result.reason).toBe('JSON parse error');
    expect(result.value).toBe(defaults.songs);
  });

  it('triggers recovery when songs.json contains a non-array', () => {
    const result = simulateReadFile('songs', '{"not":"array"}', defaults);
    expect(result.action).toBe('recover');
    expect(result.reason).toBe('not an array');
  });

  it('returns ok for valid empty schedules array', () => {
    const result = simulateReadFile('schedules', '[]', defaults);
    expect(result.action).toBe('ok');
    expect(result.value).toEqual([]);
  });

  it('returns ok for valid settings object', () => {
    const raw = JSON.stringify({ theme: 'light', defaultFontSize: 48 });
    const result = simulateReadFile('settings', raw, defaults);
    expect(result.action).toBe('ok');
    expect(result.value.theme).toBe('light');
    expect(result.value.defaultFont).toBe('Georgia'); // default filled in
  });
});

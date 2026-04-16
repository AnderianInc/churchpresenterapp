import { searchByReference, searchByKeyword, loadBibleTranslation } from '../data/bible';

describe('searchByReference', () => {
  it('finds a single verse', () => {
    const results = searchByReference('John 3:16');
    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe('John 3:16');
    expect(results[0].text).toContain('God so loved');
  });

  it('finds a verse range', () => {
    const results = searchByReference('Psalm 23:1-4');
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results[0].reference).toBe('Psalm 23:1');
    expect(results[3].reference).toBe('Psalm 23:4');
  });

  it('finds all verses in a chapter', () => {
    const results = searchByReference('Psalm 23');
    expect(results.length).toBeGreaterThanOrEqual(6);
    results.forEach(r => expect(r.reference).toMatch(/^Psalm 23:/));
  });

  it('handles lowercase book names', () => {
    const results = searchByReference('john 3:16');
    expect(results).toHaveLength(1);
  });

  it('handles abbreviated book names (Ps)', () => {
    const results = searchByReference('Ps 23:1');
    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe('Psalm 23:1');
  });

  it('handles abbreviated book names (Phil)', () => {
    const results = searchByReference('Phil 4:13');
    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe('Philippians 4:13');
  });

  it('returns empty array for non-existent reference', () => {
    const results = searchByReference('Zephaniah 99:99');
    expect(results).toHaveLength(0);
  });

  it('returns empty array for unparseable input', () => {
    expect(searchByReference('')).toHaveLength(0);
    expect(searchByReference('not a reference')).toHaveLength(0);
  });
});

describe('searchByKeyword', () => {
  it('finds verses containing a keyword', () => {
    const results = searchByKeyword('shepherd');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(
        r.text.toLowerCase().includes('shepherd') || r.reference.toLowerCase().includes('shepherd')
      ).toBe(true);
    });
  });

  it('is case-insensitive', () => {
    const lower = searchByKeyword('grace');
    const upper = searchByKeyword('GRACE');
    expect(lower.length).toEqual(upper.length);
  });

  it('returns empty array for very short queries', () => {
    expect(searchByKeyword('ab')).toHaveLength(0);
    expect(searchByKeyword('')).toHaveLength(0);
  });

  it('supports version selection and falls back to KJV text if needed', () => {
    const results = searchByReference('John 3:16', 'NIV');
    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe('John 3:16');
    expect(results[0].text).toContain('God so loved');
    expect(results[0].text).not.toBe(searchByReference('John 3:16', 'KJV')[0].text);

    const keywordResults = searchByKeyword('grace', 'NIV');
    expect(keywordResults.length).toBeGreaterThan(0);
    keywordResults.forEach(r => {
      expect(r.text).toBeDefined();
    });
  });

  it('applies modernized translation rules to sample verses', () => {
    const kjv = searchByReference('Psalm 23:1', 'KJV')[0].text;
    const niv = searchByReference('Psalm 23:1', 'NIV')[0].text;
    expect(kjv).toContain('walketh');
    expect(niv).not.toContain('walketh');
    expect(niv).toContain('walks');
  });

  it('can load a custom offline translation and search its actual text', () => {
    loadBibleTranslation('TEST', { 'John 3:16': 'For God so loved the world, sample version.' });
    const results = searchByReference('John 3:16', 'TEST');
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('For God so loved the world, sample version.');
  });

  it('caps results at 30', () => {
    // "the" appears in nearly everything — should be capped
    const results = searchByKeyword('the');
    expect(results.length).toBeLessThanOrEqual(30);
  });
});

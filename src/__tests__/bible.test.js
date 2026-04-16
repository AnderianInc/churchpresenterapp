import { searchByReference, searchByKeyword, loadBibleTranslation } from '../data/bible';

/**
 * Seed a minimal KJV and NIV corpus before any test runs.
 * searchByReference / searchByKeyword are synchronous and read from BIBLE_TEXTS
 * in-memory — they never fetch on their own.  The async fetch helpers
 * (fetchBibleBookIfNeeded, fetchBibleTranslationFromAsset) are tested by the
 * integration paths in BiblePanel; these unit tests only exercise the pure
 * search logic.
 *
 * Key format used by parseBiblePackageJson from the bundled offline files:
 *   "Psalms 23:1"  (book name comes from payload.book = "Psalms")
 *   "John 3:16"    (book name comes from payload.book = "John")
 */
beforeAll(() => {
  loadBibleTranslation('KJV', {
    'John 3:16': 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    'Psalms 23:1': 'The LORD is my shepherd; I shall not want.',
    'Psalms 23:2': 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.',
    'Psalms 23:3': 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.',
    'Psalms 23:4': 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.',
    'Psalms 23:5': 'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.',
    'Psalms 23:6': 'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.',
    'Philippians 4:13': 'I can do all things through Christ which strengtheneth me.',
    'Ephesians 2:8': 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:',
  });
  loadBibleTranslation('NIV', {
    'John 3:16': 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    'Psalms 23:1': 'The LORD is my shepherd, I lack nothing.',
    'Psalms 23:2': 'He makes me lie down in green pastures, he leads me beside quiet waters,',
    'Psalms 23:3': 'he refreshes my soul. He guides me along the right paths for his name\'s sake.',
    'Psalms 23:4': 'Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.',
    'Psalms 23:5': 'You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows.',
    'Psalms 23:6': 'Surely your goodness and love will follow me all the days of my life, and I will dwell in the house of the LORD forever.',
    'Philippians 4:13': 'I can do all this through him who gives me strength.',
    'Ephesians 2:8': 'For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God—',
  });
});

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
    expect(results[0].reference).toBe('Psalms 23:1');
    expect(results[3].reference).toBe('Psalms 23:4');
  });

  it('finds all verses in a chapter', () => {
    const results = searchByReference('Psalm 23');
    expect(results.length).toBeGreaterThanOrEqual(6);
    results.forEach(r => expect(r.reference).toMatch(/^Psalms 23:/));
  });

  it('handles lowercase book names', () => {
    const results = searchByReference('john 3:16');
    expect(results).toHaveLength(1);
  });

  it('handles abbreviated book names (Ps)', () => {
    const results = searchByReference('Ps 23:1');
    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe('Psalms 23:1');
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

  it('KJV and NIV differ in translation style for the same reference', () => {
    // KJV uses archaic language; NIV uses modern phrasing.
    const kjv = searchByReference('Psalms 23:1', 'KJV')[0].text;
    const niv = searchByReference('Psalms 23:1', 'NIV')[0].text;
    expect(kjv).toContain('I shall not want');
    expect(niv).not.toContain('I shall not want');
    expect(niv).toContain('I lack nothing');
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

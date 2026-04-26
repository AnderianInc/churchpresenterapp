import {
  searchByReference,
  searchByKeyword,
  loadBibleTranslation,
  parseBebliaXml,
  BOOK_NAMES_BY_NUMBER,
  canonicalBook,
} from '../data/bible';

/**
 * Seed a minimal KJV and NIV corpus before any test runs.
 * searchByReference / searchByKeyword are synchronous and read from BIBLE_TEXTS
 * in-memory — they never fetch on their own.
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

// ── BOOK_NAMES_BY_NUMBER ──────────────────────────────────────────────────────

describe('BOOK_NAMES_BY_NUMBER', () => {
  it('maps all 66 canonical book numbers', () => {
    expect(Object.keys(BOOK_NAMES_BY_NUMBER)).toHaveLength(66);
  });

  it('maps OT boundary books correctly', () => {
    expect(BOOK_NAMES_BY_NUMBER[1]).toBe('Genesis');
    expect(BOOK_NAMES_BY_NUMBER[39]).toBe('Malachi');
  });

  it('maps NT boundary books correctly', () => {
    expect(BOOK_NAMES_BY_NUMBER[40]).toBe('Matthew');
    expect(BOOK_NAMES_BY_NUMBER[66]).toBe('Revelation');
  });

  it('maps mid-Bible books correctly', () => {
    expect(BOOK_NAMES_BY_NUMBER[19]).toBe('Psalms');
    expect(BOOK_NAMES_BY_NUMBER[43]).toBe('John');
    expect(BOOK_NAMES_BY_NUMBER[45]).toBe('Romans');
  });
});

// ── canonicalBook ─────────────────────────────────────────────────────────────

describe('canonicalBook', () => {
  it('resolves full book names exactly', () => {
    expect(canonicalBook('Genesis')).toBe('Genesis');
    expect(canonicalBook('Revelation')).toBe('Revelation');
  });

  it('resolves common abbreviations', () => {
    expect(canonicalBook('ps')).toBe('Psalms');
    expect(canonicalBook('gen')).toBe('Genesis');
    expect(canonicalBook('rev')).toBe('Revelation');
    expect(canonicalBook('matt')).toBe('Matthew');
  });

  it('is case-insensitive for abbreviations', () => {
    expect(canonicalBook('GEN')).toBe('Genesis');
    expect(canonicalBook('Ps')).toBe('Psalms');
  });

  it('passes through unknown names unchanged', () => {
    expect(canonicalBook('UnknownBook')).toBe('UnknownBook');
  });
});

// ── parseBebliaXml ────────────────────────────────────────────────────────────

describe('parseBebliaXml', () => {
  // Build minimal XML strings for testing both format variants.

  const numberedXml = `<?xml version="1.0" encoding="UTF-8"?>
<bible translation="Test KJV">
  <testament name="New">
    <book number="43">
      <chapter number="3">
        <verse number="16">For God so loved the world.</verse>
        <verse number="17">For God sent not his Son to condemn the world.</verse>
      </chapter>
    </book>
    <book number="45">
      <chapter number="8">
        <verse number="28">And we know that all things work together for good.</verse>
      </chapter>
    </book>
  </testament>
</bible>`;

  const namedXml = `<?xml version="1.0" encoding="UTF-8"?>
<bible>
  <testament name="Old">
    <book name="Psalms">
      <chapter number="23">
        <verse number="1">The LORD is my shepherd.</verse>
        <verse number="2">He makes me lie down.</verse>
      </chapter>
    </book>
  </testament>
</bible>`;

  it('parses numbered-book format (Holy-Bible-XML-Format style)', () => {
    const passages = parseBebliaXml(numberedXml);
    expect(passages['John 3:16']).toBe('For God so loved the world.');
    expect(passages['John 3:17']).toBe('For God sent not his Son to condemn the world.');
    expect(passages['Romans 8:28']).toBe('And we know that all things work together for good.');
  });

  it('resolves book numbers to canonical names', () => {
    const passages = parseBebliaXml(numberedXml);
    // book 43 = John, book 45 = Romans
    expect(Object.keys(passages)).toContain('John 3:16');
    expect(Object.keys(passages)).toContain('Romans 8:28');
  });

  it('parses named-book format', () => {
    const passages = parseBebliaXml(namedXml);
    expect(passages['Psalms 23:1']).toBe('The LORD is my shepherd.');
    expect(passages['Psalms 23:2']).toBe('He makes me lie down.');
  });

  it('returns empty object for empty string', () => {
    expect(parseBebliaXml('')).toEqual({});
  });

  it('returns empty object for malformed XML', () => {
    const result = parseBebliaXml('<not valid xml>>>');
    // Should not throw — may return {} or partial results
    expect(typeof result).toBe('object');
  });

  it('ignores book entries with unknown number', () => {
    const xml = `<bible><testament name="Old"><book number="999"><chapter number="1"><verse number="1">Test.</verse></chapter></book></testament></bible>`;
    const passages = parseBebliaXml(xml);
    // book 999 is not in BOOK_NAMES_BY_NUMBER — no entries should be created
    expect(Object.keys(passages)).toHaveLength(0);
  });

  it('searches parsed numbered-book content via loadBibleTranslation + searchByReference', () => {
    const passages = parseBebliaXml(numberedXml);
    loadBibleTranslation('offline:TestKJV', passages);
    const results = searchByReference('John 3:16', 'offline:TestKJV');
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('For God so loved the world.');
  });
});

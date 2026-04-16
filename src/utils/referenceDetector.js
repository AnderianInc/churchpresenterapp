/**
 * Bible reference detector.
 * Parses transcript text and returns structured scripture references.
 * Handles standard format (John 3:16), explicit chapter/verse words,
 * and spoken ordinal prefixes (First Corinthians → 1 Corinthians).
 */

// All 66 books with their common abbreviation variants
const BOOK_ENTRIES = [
  { canonical: 'Genesis',          patterns: ['genesis', 'gen'] },
  { canonical: 'Exodus',           patterns: ['exodus', 'exo', 'ex'] },
  { canonical: 'Leviticus',        patterns: ['leviticus', 'lev'] },
  { canonical: 'Numbers',          patterns: ['numbers', 'num', 'numb'] },
  { canonical: 'Deuteronomy',      patterns: ['deuteronomy', 'deut', 'deu'] },
  { canonical: 'Joshua',           patterns: ['joshua', 'josh'] },
  { canonical: 'Judges',           patterns: ['judges', 'judg'] },
  { canonical: 'Ruth',             patterns: ['ruth'] },
  { canonical: '1 Samuel',         patterns: ['1 samuel', '1samuel', '1 sam', '1sam', 'first samuel'] },
  { canonical: '2 Samuel',         patterns: ['2 samuel', '2samuel', '2 sam', '2sam', 'second samuel'] },
  { canonical: '1 Kings',          patterns: ['1 kings', '1kings', '1 kgs', '1kgs', 'first kings'] },
  { canonical: '2 Kings',          patterns: ['2 kings', '2kings', '2 kgs', '2kgs', 'second kings'] },
  { canonical: '1 Chronicles',     patterns: ['1 chronicles', '1chronicles', '1 chron', '1chron', '1 chr', '1chr', 'first chronicles'] },
  { canonical: '2 Chronicles',     patterns: ['2 chronicles', '2chronicles', '2 chron', '2chron', '2 chr', '2chr', 'second chronicles'] },
  { canonical: 'Ezra',             patterns: ['ezra'] },
  { canonical: 'Nehemiah',         patterns: ['nehemiah', 'neh'] },
  { canonical: 'Esther',           patterns: ['esther', 'esth'] },
  { canonical: 'Job',              patterns: ['job'] },
  { canonical: 'Psalms',           patterns: ['psalms', 'psalm', 'psa', 'ps'] },
  { canonical: 'Proverbs',         patterns: ['proverbs', 'prov', 'pro', 'prv'] },
  { canonical: 'Ecclesiastes',     patterns: ['ecclesiastes', 'eccl', 'ecc'] },
  { canonical: 'Song of Solomon',  patterns: ['song of solomon', 'song of songs', 'song', 'sos', 'cant'] },
  { canonical: 'Isaiah',           patterns: ['isaiah', 'isa'] },
  { canonical: 'Jeremiah',         patterns: ['jeremiah', 'jer'] },
  { canonical: 'Lamentations',     patterns: ['lamentations', 'lam'] },
  { canonical: 'Ezekiel',          patterns: ['ezekiel', 'ezek', 'eze'] },
  { canonical: 'Daniel',           patterns: ['daniel', 'dan'] },
  { canonical: 'Hosea',            patterns: ['hosea', 'hos'] },
  { canonical: 'Joel',             patterns: ['joel'] },
  { canonical: 'Amos',             patterns: ['amos'] },
  { canonical: 'Obadiah',          patterns: ['obadiah', 'obad'] },
  { canonical: 'Jonah',            patterns: ['jonah', 'jon'] },
  { canonical: 'Micah',            patterns: ['micah', 'mic'] },
  { canonical: 'Nahum',            patterns: ['nahum', 'nah'] },
  { canonical: 'Habakkuk',         patterns: ['habakkuk', 'hab'] },
  { canonical: 'Zephaniah',        patterns: ['zephaniah', 'zeph'] },
  { canonical: 'Haggai',           patterns: ['haggai', 'hag'] },
  { canonical: 'Zechariah',        patterns: ['zechariah', 'zech'] },
  { canonical: 'Malachi',          patterns: ['malachi', 'mal'] },
  { canonical: 'Matthew',          patterns: ['matthew', 'matt', 'mat'] },
  { canonical: 'Mark',             patterns: ['mark'] },
  { canonical: 'Luke',             patterns: ['luke'] },
  { canonical: 'John',             patterns: ['john', 'joh'] },
  { canonical: 'Acts',             patterns: ['acts'] },
  { canonical: 'Romans',           patterns: ['romans', 'rom'] },
  { canonical: '1 Corinthians',    patterns: ['1 corinthians', '1corinthians', '1 cor', '1cor', 'first corinthians'] },
  { canonical: '2 Corinthians',    patterns: ['2 corinthians', '2corinthians', '2 cor', '2cor', 'second corinthians'] },
  { canonical: 'Galatians',        patterns: ['galatians', 'gal'] },
  { canonical: 'Ephesians',        patterns: ['ephesians', 'eph'] },
  { canonical: 'Philippians',      patterns: ['philippians', 'phil', 'php'] },
  { canonical: 'Colossians',       patterns: ['colossians', 'col'] },
  { canonical: '1 Thessalonians',  patterns: ['1 thessalonians', '1thessalonians', '1 thess', '1thess', '1 thes', 'first thessalonians'] },
  { canonical: '2 Thessalonians',  patterns: ['2 thessalonians', '2thessalonians', '2 thess', '2thess', '2 thes', 'second thessalonians'] },
  { canonical: '1 Timothy',        patterns: ['1 timothy', '1timothy', '1 tim', '1tim', 'first timothy'] },
  { canonical: '2 Timothy',        patterns: ['2 timothy', '2timothy', '2 tim', '2tim', 'second timothy'] },
  { canonical: 'Titus',            patterns: ['titus', 'tit'] },
  { canonical: 'Philemon',         patterns: ['philemon', 'phlm', 'phm'] },
  { canonical: 'Hebrews',          patterns: ['hebrews', 'heb'] },
  { canonical: 'James',            patterns: ['james', 'jas'] },
  { canonical: '1 Peter',          patterns: ['1 peter', '1peter', '1 pet', '1pet', 'first peter'] },
  { canonical: '2 Peter',          patterns: ['2 peter', '2peter', '2 pet', '2pet', 'second peter'] },
  { canonical: '1 John',           patterns: ['1 john', '1john', '1 jn', '1jn', 'first john'] },
  { canonical: '2 John',           patterns: ['2 john', '2john', '2 jn', '2jn', 'second john'] },
  { canonical: '3 John',           patterns: ['3 john', '3john', '3 jn', '3jn', 'third john'] },
  { canonical: 'Jude',             patterns: ['jude'] },
  { canonical: 'Revelation',       patterns: ['revelation', 'revelations', 'rev'] },
];

// Build lookup map: lowercase variant → canonical name
const BOOK_MAP = new Map();
BOOK_ENTRIES.forEach(({ canonical, patterns }) => {
  patterns.forEach(p => BOOK_MAP.set(p, canonical));
});

/** Replace "first/second/third" with "1/2/3" to normalize spoken book prefixes. */
function normalizeOrdinals(text) {
  return text
    .replace(/\bfirst\s+/gi, '1 ')
    .replace(/\bsecond\s+/gi, '2 ')
    .replace(/\bthird\s+/gi, '3 ');
}

// Build regex: all book patterns sorted longest-first to prevent partial matches
const escapedPatterns = [...BOOK_MAP.keys()]
  .sort((a, b) => b.length - a.length)
  .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));

const BOOK_RE_SRC = `(?:${escapedPatterns.join('|')})`;

/**
 * Main reference regex. Matches:
 *   John 3:16           (standard colon format)
 *   John 3 16           (space separated)
 *   John chapter 3 verse 16   (explicit words)
 *   John chapter 3      (chapter only)
 *   Romans 8            (chapter only, no verse)
 *   1 Corinthians 13:4-7       (multi-verse range)
 */
const REF_RE = new RegExp(
  `\\b(${BOOK_RE_SRC})\\s+` +
  `(?:chapter\\s+)?(\\d{1,3})` +
  `(?:\\s*(?::|verse\\s+)(\\d{1,3})(?:\\s*-\\s*(\\d{1,3}))?)?`,
  'gi'
);

/**
 * Detect Bible references in `text`.
 * Returns an array of unique reference objects.
 *
 * @param {string} text
 * @returns {{ id: string, reference: string, book: string, chapter: number, verse: number|null, verseEnd: number|null }[]}
 */
export function detectReferences(text = '') {
  if (!text.trim()) return [];

  const normalized = normalizeOrdinals(text);
  const found = [];
  const seen = new Set();

  REF_RE.lastIndex = 0; // reset for global regex reuse
  let match;
  while ((match = REF_RE.exec(normalized)) !== null) {
    const rawBook = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
    const canonical = BOOK_MAP.get(rawBook);
    if (!canonical) continue;

    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? parseInt(match[3], 10) : null;
    const verseEnd = match[4] ? parseInt(match[4], 10) : null;

    // Build canonical reference string
    let reference = `${canonical} ${chapter}`;
    if (verse !== null) {
      reference += `:${verse}`;
      if (verseEnd !== null) reference += `-${verseEnd}`;
    }

    if (!seen.has(reference)) {
      seen.add(reference);
      found.push({
        id: `${reference}-${Date.now()}-${Math.random()}`,
        reference,
        book: canonical,
        chapter,
        verse,
        verseEnd,
      });
    }
  }

  return found;
}

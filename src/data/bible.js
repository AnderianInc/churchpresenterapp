export const BIBLE_VERSIONS = ['KJV', 'NIV', 'ESV', 'NKJV', 'NLT', 'AMP', 'TPT', 'MSG'];

export const BIBLE_VERSION_LABELS = {
  KJV: 'King James Version',
  NIV: 'New International Version',
  ESV: 'English Standard Version',
  NKJV: 'New King James Version',
  NLT: 'New Living Translation',
  AMP: 'Amplified Bible',
  TPT: 'The Passion Translation',
  MSG: 'The Message',
};

export const QUICK_REFERENCES = [
  'John 3:16', 'Psalm 23:1-6', 'Romans 8:28',
  'Isaiah 40:31', 'Philippians 4:13', 'Jeremiah 29:11',
  'Hebrews 11:1', 'Matthew 6:9-13', 'Psalm 100:1-5',
  '1 Corinthians 13:4', 'Ephesians 2:8-9', 'Romans 12:1-2',
];

export const OFFLINE_BIBLE_FOLDERS = {
  KJV: 'KJV BIBLE',
  NIV: 'NIV BIBLE',
};

export const BIBLE_TEXTS = {};

let offlineBibleFolderCache = null;

export async function getOfflineBibleFolderMapping() {
  if (offlineBibleFolderCache) return offlineBibleFolderCache;
  if (typeof fetch === 'undefined') {
    offlineBibleFolderCache = OFFLINE_BIBLE_FOLDERS;
    return offlineBibleFolderCache;
  }

  const publicUrl = process.env.PUBLIC_URL || '';
  const manifestUrl = `${publicUrl}/bibles/index.json`;

  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('Offline Bible manifest unavailable.');
    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      throw new Error('Offline Bible manifest is malformed.');
    }
    offlineBibleFolderCache = payload;
    return offlineBibleFolderCache;
  } catch (_) {
    offlineBibleFolderCache = OFFLINE_BIBLE_FOLDERS;
    return offlineBibleFolderCache;
  }
}

function normalizeBibleFilename(bookName) {
  const base = bookName.replace(/\s+/g, '');
  return [
    `${bookName}.json`,
    `${base}.json`,
    `${bookName.replace(/\s+/g, '-')}.json`,
    `${bookName.replace(/\s+/g, '_')}.json`,
  ];
}

function parseBiblePackageJson(payload) {
  if (!payload) return null;

  // Nested format: { book, chapters: [{ chapter, verses: [{ verse, text }] }] }
  // This is the format used by the bundled KJV and NIV files in /public/bibles/.
  if (payload.book && Array.isArray(payload.chapters)) {
    const passages = {};
    const bookName = String(payload.book);
    for (const ch of payload.chapters) {
      const chNum = String(ch.chapter);
      if (!Array.isArray(ch.verses)) continue;
      for (const v of ch.verses) {
        const key = `${bookName} ${chNum}:${v.verse}`;
        passages[key] = String(v.text || '');
      }
    }
    return passages;
  }

  // Flat format: { "Genesis 1:1": "text", ... } or { passages: { ... } }
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.passages && typeof payload.passages === 'object') return payload.passages;
    return payload;
  }

  return null;
}

async function fetchBibleBookFromFolder(basePath, bookName) {
  const candidates = normalizeBibleFilename(bookName);
  for (const filename of candidates) {
    const response = await fetch(`${basePath}/${encodeURIComponent(filename)}`);
    if (!response.ok) continue;
    const payload = await response.json();
    const passages = parseBiblePackageJson(payload);
    if (passages && Object.keys(passages).length > 0) {
      return passages;
    }
  }
  return null;
}

export async function fetchBibleTranslationFromPublicFolder(folderName, version) {
  if (typeof fetch === 'undefined') {
    throw new Error('Fetch is not available in this environment.');
  }

  const publicUrl = process.env.PUBLIC_URL || '';
  const basePath = `${publicUrl}/bibles/${encodeURIComponent(folderName)}`;
  const indexResponse = await fetch(`${basePath}/Books.json`);
  if (!indexResponse.ok) {
    throw new Error(`Offline Bible folder not found for ${version}.`);
  }

  const books = await indexResponse.json();
  if (!Array.isArray(books)) {
    throw new Error(`Invalid Books.json format for ${version}.`);
  }

  const passages = {};
  for (const bookName of books) {
    const bookPassages = await fetchBibleBookFromFolder(basePath, bookName);
    if (bookPassages) {
      Object.assign(passages, bookPassages);
    }
  }

  if (Object.keys(passages).length === 0) {
    throw new Error(`No passages were loaded for ${version} from offline folder.`);
  }

  loadBibleTranslation(version, passages);
  return passages;
}

export async function fetchBibleTranslationFromAsset(version) {
  const offlineFolders = await getOfflineBibleFolderMapping();
  const folderName = offlineFolders[version];
  if (folderName) {
    return await fetchBibleTranslationFromPublicFolder(folderName, version);
  }
  throw new Error(`Offline translation asset not found for ${version}.`);
}

export function loadBibleTranslation(version, passages = {}) {
  if (!version || typeof version !== 'string') return;
  BIBLE_TEXTS[version] = { ...passages };
  return BIBLE_TEXTS[version];
}

export function bibleSource(version = 'KJV', extraTexts = {}) {
  return extraTexts[version] || BIBLE_TEXTS[version] || {};
}

const ALIASES = {
  gen: 'Genesis', exod: 'Exodus', lev: 'Leviticus', num: 'Numbers', deut: 'Deuteronomy',
  josh: 'Joshua', judg: 'Judges', rth: 'Ruth', '1 sam': '1 Samuel', '2 sam': '2 Samuel',
  '1 kings': '1 Kings', '2 kings': '2 Kings', '1 chr': '1 Chronicles', '2 chr': '2 Chronicles',
  ezra: 'Ezra', neh: 'Nehemiah', esth: 'Esther', job: 'Job', ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms', psalms: 'Psalms',
  prov: 'Proverbs', eccl: 'Ecclesiastes', song: 'Song of Solomon', sos: 'Song of Solomon',
  isa: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations', ezek: 'Ezekiel', dan: 'Daniel',
  hos: 'Hosea', joel: 'Joel', amos: 'Amos', obad: 'Obadiah', jon: 'Jonah', mic: 'Micah',
  nah: 'Nahum', hab: 'Habakkuk', zeph: 'Zephaniah', hag: 'Haggai', zech: 'Zechariah',
  mal: 'Malachi', matt: 'Matthew', mark: 'Mark', luke: 'Luke', john: 'John', acts: 'Acts',
  rom: 'Romans', '1 cor': '1 Corinthians', '2 cor': '2 Corinthians', gal: 'Galatians',
  eph: 'Ephesians', phil: 'Philippians', col: 'Colossians', '1 thess': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '1 tim': '1 Timothy', '2 tim': '2 Timothy', tit: 'Titus',
  phlm: 'Philemon', heb: 'Hebrews', jas: 'James', '1 pet': '1 Peter', '2 pet': '2 Peter',
  '1 jn': '1 John', '2 jn': '2 John', '3 jn': '3 John', jude: 'Jude', rev: 'Revelation',
};

const BIBLE_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah',
  'Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah',
  'Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah',
  'Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke',
  'John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
];

export function canonicalBook(raw) {
  const lower = raw.trim().toLowerCase();
  return ALIASES[lower] || BIBLE_BOOKS.find(b => b.toLowerCase() === lower) || raw.trim();
}

// Tracks which individual books have been loaded into BIBLE_TEXTS per version.
export const LOADED_BOOKS = {};

/**
 * Load a single book into BIBLE_TEXTS[version] on demand.
 * Returns true if the book is now available, false if it could not be loaded.
 * Safe to call repeatedly — skips the fetch if already cached.
 */
export async function fetchBibleBookIfNeeded(version, bookName) {
  if (!LOADED_BOOKS[version]) LOADED_BOOKS[version] = new Set();
  if (LOADED_BOOKS[version].has(bookName)) return true;

  const offlineFolders = await getOfflineBibleFolderMapping();
  const folderName = offlineFolders[version];
  if (!folderName) return false;

  const publicUrl = process.env.PUBLIC_URL || '';
  const basePath = `${publicUrl}/bibles/${encodeURIComponent(folderName)}`;

  try {
    const bookPassages = await fetchBibleBookFromFolder(basePath, bookName);
    if (bookPassages && Object.keys(bookPassages).length > 0) {
      if (!BIBLE_TEXTS[version]) BIBLE_TEXTS[version] = {};
      Object.assign(BIBLE_TEXTS[version], bookPassages);
      LOADED_BOOKS[version].add(bookName);
      return true;
    }
  } catch {
    // Network error or file not found — not fatal, search returns empty.
  }
  return false;
}

export function searchByReference(query, version = 'KJV', extraTexts = {}) {
  const q = query.trim();
  const refMatch = q.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (!refMatch) return [];

  const book = canonicalBook(refMatch[1]);
  const chapter = parseInt(refMatch[2], 10);
  const startVerse = refMatch[3] ? parseInt(refMatch[3], 10) : null;
  const endVerse = refMatch[4] ? parseInt(refMatch[4], 10) : startVerse;
  const results = [];
  const source = bibleSource(version, extraTexts);

  if (startVerse === null) {
    const prefix = `${book} ${chapter}:`;
    Object.entries(source).forEach(([ref, text]) => {
      if (ref.startsWith(prefix)) results.push({ reference: ref, text });
    });
    results.sort((a, b) => {
      const va = parseInt(a.reference.split(':')[1], 10);
      const vb = parseInt(b.reference.split(':')[1], 10);
      return va - vb;
    });
  } else {
    for (let v = startVerse; v <= endVerse; v += 1) {
      const key = `${book} ${chapter}:${v}`;
      const text = source[key];
      if (text) results.push({ reference: key, text });
    }
  }
  return results;
}

export function searchByKeyword(query, version = 'KJV', extraTexts = {}) {
  const q = String(query).toLowerCase().trim();
  if (!q || q.length < 3) return [];
  const source = bibleSource(version, extraTexts);
  return Object.entries(source)
    .filter(([ref, text]) => ref.toLowerCase().includes(q) || text.toLowerCase().includes(q))
    .map(([reference, text]) => ({ reference, text }))
    .slice(0, 30);
}

export function getVerseText(reference, version = 'KJV', extraTexts = {}) {
  const source = bibleSource(version, extraTexts);
  return source[reference] || '';
}

function getYouVersionApi() {
  if (!window?.electronAPI) {
    throw new Error('YouVersion support requires Electron with electronAPI enabled.');
  }
  if (!window.electronAPI.fetchYouVersionPassage) {
    throw new Error('YouVersion API is not available in this Electron build.');
  }
  return window.electronAPI;
}

export async function fetchYouVersionPassage(appKey, versionId, reference, format = 'text') {
  if (!versionId) {
    throw new Error('YouVersion version ID is required.');
  }
  const api = getYouVersionApi();
  const osis = bibleReferenceToOsis(reference);
  return api.fetchYouVersionPassage(appKey, versionId, osis, format);
}

const OSIS_BOOK_CODES = {
  Genesis: 'GEN', Exodus: 'EXO', Leviticus: 'LEV', Numbers: 'NUM', Deuteronomy: 'DEU',
  Joshua: 'JOS', Judges: 'JDG', Ruth: 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
  '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH',
  Ezra: 'EZR', Nehemiah: 'NEH', Esther: 'EST', Job: 'JOB', Psalms: 'PSA', Psalm: 'PSA',
  Proverbs: 'PRO', Ecclesiastes: 'ECC', 'Song of Solomon': 'SNG', Isaiah: 'ISA',
  Jeremiah: 'JER', Lamentations: 'LAM', Ezekiel: 'EZK', Daniel: 'DAN', Hosea: 'HOS',
  Joel: 'JOL', Amos: 'AMO', Obadiah: 'OBA', Jonah: 'JON', Micah: 'MIC', Nahum: 'NAM',
  Habakkuk: 'HAB', Zephaniah: 'ZEP', Haggai: 'HAG', Zechariah: 'ZEC', Malachi: 'MAL',
  Matthew: 'MAT', Mark: 'MRK', Luke: 'LUK', John: 'JHN', Acts: 'ACT', Romans: 'ROM',
  '1 Corinthians': '1CO', '2 Corinthians': '2CO', Galatians: 'GAL', Ephesians: 'EPH',
  Philippians: 'PHP', Colossians: 'COL', '1 Thessalonians': '1TH', '2 Thessalonians': '2TH',
  '1 Timothy': '1TI', '2 Timothy': '2TI', Titus: 'TIT', Philemon: 'PHM', Hebrews: 'HEB',
  James: 'JAS', '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JN', '2 John': '2JN',
  '3 John': '3JN', Jude: 'JUD', Revelation: 'REV', 'Song of Solomon': 'SNG',
};

export function bibleReferenceToOsis(reference) {
  const trimmed = String(reference || '').trim();
  const match = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) return trimmed;
  const book = canonicalBook(match[1]);
  const chapter = match[2];
  const verse = match[3];
  const endVerse = match[4];
  const bookCode = OSIS_BOOK_CODES[book] || book;
  if (!verse) return `${bookCode}.${chapter}`;
  if (endVerse) return `${bookCode}.${chapter}.${verse}-${bookCode}.${chapter}.${endVerse}`;
  return `${bookCode}.${chapter}.${verse}`;
}

// ── HelloAO Bible API (https://bible.helloao.org) ──────────────────────────
// Free public API, no authentication required.
export const HELLOAO_BASE = 'https://bible.helloao.org/api';
const HELLOAO_TRANSLATIONS_URL = `${HELLOAO_BASE}/available_translations.json`;

// ── Book number → canonical name (Beblia XML format uses numbers 1-66) ──────
export const BOOK_NAMES_BY_NUMBER = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
  33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
  38: 'Zechariah', 39: 'Malachi', 40: 'Matthew', 41: 'Mark', 42: 'Luke',
  43: 'John', 44: 'Acts', 45: 'Romans', 46: '1 Corinthians', 47: '2 Corinthians',
  48: 'Galatians', 49: 'Ephesians', 50: 'Philippians', 51: 'Colossians',
  52: '1 Thessalonians', 53: '2 Thessalonians', 54: '1 Timothy', 55: '2 Timothy',
  56: 'Titus', 57: 'Philemon', 58: 'Hebrews', 59: 'James', 60: '1 Peter',
  61: '2 Peter', 62: '1 John', 63: '2 John', 64: '3 John', 65: 'Jude',
  66: 'Revelation',
};

let _helloaoVersionsCache = null;
let _helloaoVersionsPromise = null;

function _normalizeVersionList(raw) {
  const list = Array.isArray(raw) ? raw : (raw.versions || raw.translations || []);
  return list
    .filter(v => v && typeof v.id === 'string')
    .map(v => ({
      id:           v.id,
      name:         v.name || v.englishName || v.id,
      shortName:    v.shortName || v.id,
      language:     v.language || '',
      languageName: v.languageEnglishName || v.languageName || v.language || '',
    }));
}

/**
 * Fetch all available translations.
 * 1. Loads the bundled /bibles/translations.json immediately (fast, works offline).
 * 2. In the background, refreshes from the live API; calls onUpdate(freshVersions)
 *    if the live list is larger than the bundled list.
 *
 * @param {function} [onUpdate] - optional callback(versions[]) for live refresh
 */
export async function fetchHelloaoVersions(onUpdate) {
  if (_helloaoVersionsCache) {
    // Already loaded — still schedule a background refresh if caller wants updates
    if (onUpdate) _refreshHelloaoVersions(onUpdate, _helloaoVersionsCache.length);
    return _helloaoVersionsCache;
  }
  if (_helloaoVersionsPromise) return _helloaoVersionsPromise;

  _helloaoVersionsPromise = (async () => {
    // ── Step 1: try bundled file (instant, works offline) ──────────────────
    try {
      const publicUrl = process.env.PUBLIC_URL || '';
      const r = await fetch(`${publicUrl}/bibles/translations.json`);
      if (r.ok) {
        const data = await r.json();
        const versions = _normalizeVersionList(data);
        if (versions.length > 0) {
          _helloaoVersionsCache = versions;
          _helloaoVersionsPromise = null;
          // Background refresh — update cache silently for the session
          _refreshHelloaoVersions(onUpdate, versions.length);
          return versions;
        }
      }
    } catch { /* bundled file unavailable — fall through to live API */ }

    // ── Step 2: live API (first-launch or bundled file missing) ────────────
    const r2 = await fetch(HELLOAO_TRANSLATIONS_URL);
    if (!r2.ok) throw new Error('Could not load Bible translations');
    const data2 = await r2.json();
    const versions2 = _normalizeVersionList(data2);
    _helloaoVersionsCache = versions2;
    _helloaoVersionsPromise = null;
    return versions2;
  })().catch(err => {
    _helloaoVersionsPromise = null;
    throw err;
  });

  return _helloaoVersionsPromise;
}

/** Background live refresh — updates cache and calls onUpdate if list grew. */
async function _refreshHelloaoVersions(onUpdate, currentCount) {
  try {
    const r = await fetch(HELLOAO_TRANSLATIONS_URL);
    if (!r.ok) return;
    const data = await r.json();
    const fresh = _normalizeVersionList(data);
    if (fresh.length > 0) {
      _helloaoVersionsCache = fresh;
      if (onUpdate && fresh.length > currentCount) onUpdate(fresh);
    }
  } catch { /* silently ignored — live refresh is best-effort */ }
}

// ── Offline translation index ─────────────────────────────────────────────
let _offlineIndexCache = null;

/**
 * Load the offline translation index from public/bibles/offline-index.json.
 * Returns an array of { id, name, filename } entries sorted by name.
 */
export async function fetchOfflineTranslations() {
  if (_offlineIndexCache) return _offlineIndexCache;
  const publicUrl = process.env.PUBLIC_URL || '';
  try {
    const r = await fetch(`${publicUrl}/bibles/offline-index.json`);
    if (!r.ok) throw new Error('offline-index.json unavailable');
    const data = await r.json();
    const list = Array.isArray(data.translations) ? data.translations : [];
    _offlineIndexCache = list;
    return list;
  } catch {
    _offlineIndexCache = [];
    return [];
  }
}

// ── Online translation index ──────────────────────────────────────────────
let _onlineIndexCache = null;

/**
 * Load the online translation index.
 * 1. Reads public/bibles/online-index.json (fast, works offline).
 * 2. Background-refreshes from the live API; calls onUpdate(list) if the
 *    live list is larger than the bundled one.
 *
 * Returns an array of { id, name, language, languageCode, ... } entries.
 */
export async function fetchOnlineTranslations(onUpdate) {
  if (_onlineIndexCache) {
    if (onUpdate) _refreshOnlineTranslations(onUpdate, _onlineIndexCache.length);
    return _onlineIndexCache;
  }

  const publicUrl = process.env.PUBLIC_URL || '';
  try {
    const r = await fetch(`${publicUrl}/bibles/online-index.json`);
    if (r.ok) {
      const data = await r.json();
      const list = Array.isArray(data.translations) ? data.translations : [];
      if (list.length > 0) {
        _onlineIndexCache = list;
        _refreshOnlineTranslations(onUpdate, list.length);
        return list;
      }
    }
  } catch { /* fall through to live API */ }

  // Live API fallback
  try {
    const r2 = await fetch(HELLOAO_TRANSLATIONS_URL);
    if (!r2.ok) throw new Error('Could not load online translations');
    const raw = await r2.json();
    const list = _normalizeVersionList(raw);
    _onlineIndexCache = list;
    return list;
  } catch (err) {
    _onlineIndexCache = [];
    throw err;
  }
}

async function _refreshOnlineTranslations(onUpdate, currentCount) {
  try {
    const r = await fetch(HELLOAO_TRANSLATIONS_URL);
    if (!r.ok) return;
    const raw = await r.json();
    const fresh = _normalizeVersionList(raw);
    if (fresh.length > 0) {
      _onlineIndexCache = fresh;
      if (onUpdate && fresh.length > currentCount) onUpdate(fresh);
    }
  } catch { /* best-effort */ }
}

// ── Offline XML translation loader ────────────────────────────────────────
const OFFLINE_CACHE_PREFIX = 'cp_bible_offline_';
const OFFLINE_XML_BASE = '/Holy-Bible-XML-Format-master';

/**
 * Load an offline translation by its id and filename.
 * Checks localStorage first, then fetches and parses the XML file.
 *
 * @param {string} id       e.g. "EnglishKJBible"
 * @param {string} filename e.g. "EnglishKJBible.xml"
 * @returns {Promise<{[ref: string]: string}>} flat passages dict
 */
export async function loadOfflineTranslation(id, filename) {
  const cacheKey = `${OFFLINE_CACHE_PREFIX}${id}`;

  // Try localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const passages = JSON.parse(cached);
      if (passages && Object.keys(passages).length > 0) {
        BIBLE_TEXTS[`offline:${id}`] = passages;
        return passages;
      }
    }
  } catch { /* localStorage unavailable or parse error — fetch fresh */ }

  // Fetch from public/Holy-Bible-XML-Format-master/
  const publicUrl = process.env.PUBLIC_URL || '';
  const url = `${publicUrl}${OFFLINE_XML_BASE}/${encodeURIComponent(filename)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load offline translation: ${filename}`);
  const xml = await r.text();

  const passages = parseBebliaXml(xml);
  if (Object.keys(passages).length === 0) {
    throw new Error(`No verses found in ${filename}. The file may use an unsupported format.`);
  }

  // Cache in localStorage (best-effort — may fail if storage is full)
  try {
    localStorage.setItem(cacheKey, JSON.stringify(passages));
  } catch (err) {
    console.warn(`[bible] localStorage quota exceeded — offline cache skipped for "${id}". Consider removing unused translations.`, err);
  }

  BIBLE_TEXTS[`offline:${id}`] = passages;
  return passages;
}

/**
 * Clear the localStorage cache for a specific offline translation.
 * @param {string} id  e.g. "EnglishKJBible"
 */
export function clearOfflineTranslationCache(id) {
  try {
    localStorage.removeItem(`${OFFLINE_CACHE_PREFIX}${id}`);
  } catch { /* ignore */ }
  delete BIBLE_TEXTS[`offline:${id}`];
}

/** Map canonical book name → USFM book code used by helloao */
const HELLOAO_BOOK_IDS = {
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
  '3 John': '3JN', Jude: 'JUD', Revelation: 'REV',
};

/**
 * Fetch a single chapter from helloao and return [{reference, text}].
 * @param {string} versionId  e.g. "en_kjv"
 * @param {string} bookName   canonical name, e.g. "John"
 * @param {number} chapterNum  e.g. 3
 */
export async function fetchHelloaoChapter(versionId, bookName, chapterNum) {
  const bookId = HELLOAO_BOOK_IDS[bookName] || bookName.toUpperCase().replace(/\s+/g, '');
  const url = `${HELLOAO_BASE}/${versionId}/${bookId}/${chapterNum}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${bookName} ${chapterNum} not found in ${versionId}`);
  const data = await r.json();
  const verses = data.verses || data.chapter?.verses || [];
  return verses.map(v => ({
    reference: `${bookName} ${chapterNum}:${v.number || v.verseNumber || v.verse}`,
    text: (v.text || v.content || '').trim(),
  })).filter(v => v.text);
}

/**
 * Search helloao by scripture reference. Returns [{reference, text}].
 * Supports: "John 3:16", "John 3:16-18", "John 3" (whole chapter).
 */
export async function searchHelloaoByReference(query, versionId) {
  const refMatch = query.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (!refMatch) return [];

  const bookName = canonicalBook(refMatch[1]);
  const chapter = parseInt(refMatch[2], 10);
  const startVerse = refMatch[3] ? parseInt(refMatch[3], 10) : null;
  const endVerse = refMatch[4] ? parseInt(refMatch[4], 10) : startVerse;

  const allVerses = await fetchHelloaoChapter(versionId, bookName, chapter);
  if (startVerse === null) return allVerses; // whole chapter
  return allVerses.filter(v => {
    const vNum = parseInt(v.reference.split(':')[1], 10);
    return vNum >= startVerse && vNum <= (endVerse ?? startVerse);
  });
}

// ── Beblia Holy-Bible-XML-Format parser ────────────────────────────────────
/**
 * Parse a Beblia-format XML string into the flat passages dict
 * { "Genesis 1:1": "In the beginning...", ... }.
 *
 * Supports both named-book format (name="Genesis") and the numbered-book
 * format used by the Holy-Bible-XML-Format collection (number="1").
 */
export function parseBebliaXml(xmlString) {
  if (typeof DOMParser === 'undefined') return {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const passages = {};

  // Tolerate whole-bible root (<bible>) or single-book root (<book>)
  const bookEls = doc.querySelectorAll('bible > b, bible > book, book');
  bookEls.forEach(bookEl => {
    // Numbered format: <book number="1"> → look up canonical name
    const numAttr = bookEl.getAttribute('number') || bookEl.getAttribute('num');
    let bookName;
    if (numAttr) {
      bookName = BOOK_NAMES_BY_NUMBER[parseInt(numAttr, 10)] || null;
    } else {
      const rawName = bookEl.getAttribute('n') || bookEl.getAttribute('name') || '';
      bookName = rawName ? canonicalBook(rawName) : null;
    }
    if (!bookName) return;

    const chEls = bookEl.querySelectorAll('c, chapter');
    chEls.forEach(chEl => {
      const chNum = chEl.getAttribute('n') || chEl.getAttribute('number') || chEl.getAttribute('num') || '';
      if (!chNum) return;

      const vEls = chEl.querySelectorAll('v, verse');
      vEls.forEach(vEl => {
        const vNum = vEl.getAttribute('n') || vEl.getAttribute('number') || vEl.getAttribute('num') || '';
        const text = (vEl.textContent || '').trim();
        if (vNum && text) {
          passages[`${bookName} ${chNum}:${vNum}`] = text;
        }
      });
    });
  });

  return passages;
}

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


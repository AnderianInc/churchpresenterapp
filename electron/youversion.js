const { ApiClient, BibleClient } = require('@youversion/platform-core');
const path = require('path');
const fs = require('fs');

let defaultAppKey = process.env.YOUVERSION_APP_KEY || process.env.YV_APP_KEY || '';
try {
  const config = require('../config');
  defaultAppKey = defaultAppKey || config.YOUVERSION_APP_KEY || '';
} catch {
  // config file is optional
}

function createYouVersionClient(appKey) {
  const key = String(appKey || defaultAppKey || '').trim();
  if (!key) throw new Error('YouVersion App Key is required.');
  return new BibleClient(new ApiClient({ appKey: key }));
}

function hasDefaultAppKey() { return !!defaultAppKey; }

function normalizeVersionName(v) { return String(v || '').trim().toLowerCase(); }

function findVersionMatch(versionCode, data) {
  const code = normalizeVersionName(versionCode);
  return data.find(v => {
    const abbr = String(v.abbreviation || '').toLowerCase();
    const title = String(v.title || '').toLowerCase();
    return abbr === code || title === code || abbr.includes(code);
  });
}

// ── Local versions database ────────────────────────────────────────────────────
// Bundled JSON of 50+ YouVersion translations with copyright strings.
// Used for instant version browsing with no API calls required.
let LOCAL_VERSIONS = null;
function getLocalVersions() {
  if (LOCAL_VERSIONS) return LOCAL_VERSIONS;
  try {
    // In production the file is in the build root; in dev it is in public/
    const candidates = [
      path.join(__dirname, '../build/youversion-versions.json'),
      path.join(__dirname, '../public/youversion-versions.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        LOCAL_VERSIONS = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return LOCAL_VERSIONS;
      }
    }
  } catch { }
  LOCAL_VERSIONS = [];
  return LOCAL_VERSIONS;
}

// ── Version cache ──────────────────────────────────────────────────────────────
// { [maskedKey]: version[] }  — populated once per API key per session
const allVersionsCache = {};

/**
 * Returns all known YouVersion translations.
 * - Always seeds from the bundled local JSON (fast, no network).
 * - If an API key is provided, supplements with live SDK results (parallel
 *   requests across language wildcards) on the first call, then caches.
 */
async function getAllYouVersionVersions(appKey) {
  const effectiveKey = String(appKey || defaultAppKey || '').trim();

  // Seed from local JSON
  const localVersions = getLocalVersions();
  const collected = new Map(localVersions.map(v => [v.id, v]));

  if (!effectiveKey) return { data: Array.from(collected.values()) };

  const cacheKey = effectiveKey.slice(-8);
  if (allVersionsCache[cacheKey]) return { data: allVersionsCache[cacheKey] };

  // Fetch API versions in parallel across all major language families
  const client = createYouVersionClient(appKey);
  const languageQueries = ['', 'en*', 'es*', 'pt*', 'fr*', 'de*', 'zh*', 'ko*', 'ja*', 'ar*', 'ru*', 'hi*', 'id*', 'sw*', 'tl*', 'it*', 'nl*', 'pl*', 'ro*'];
  const results = await Promise.allSettled(languageQueries.map(lang => client.getVersions(lang)));
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const v of (result.value?.data || [])) {
      if (v?.id && !collected.has(v.id)) {
        collected.set(v.id, {
          id: v.id,
          abbreviation: (v.abbreviation || '').toUpperCase(),
          title: v.local_title || v.title || v.abbreviation || '',
          language_tag: v.language_tag || '',
          copyright: v.copyright || '',
        });
      }
    }
  }

  const versions = Array.from(collected.values());
  allVersionsCache[cacheKey] = versions;
  return { data: versions };
}

// ── Version ID resolver ────────────────────────────────────────────────────────
const versionIdCache = {};

async function findYouVersionId(appKey, versionCode) {
  const effectiveKey = String(appKey || defaultAppKey || '').trim();
  const cacheKey = `${effectiveKey.slice(-6)}:${normalizeVersionName(versionCode)}`;
  if (versionIdCache[cacheKey]) return versionIdCache[cacheKey];

  const response = await getAllYouVersionVersions(appKey);
  const match = findVersionMatch(versionCode, response?.data || []);
  if (!match) throw new Error(`Could not resolve YouVersion version for "${versionCode}".`);
  versionIdCache[cacheKey] = match.id;
  return match.id;
}

async function getYouVersionVersions(appKey) {
  return getAllYouVersionVersions(appKey);
}

async function getYouVersionVersion(appKey, versionCode) {
  const versionId = await findYouVersionId(appKey, versionCode);
  return createYouVersionClient(appKey).getVersion(versionId);
}

async function getYouVersionPassage(appKey, versionCode, reference, format = 'text') {
  const asNum = Number(versionCode);
  const versionId = (!isNaN(asNum) && asNum > 0) ? asNum : await findYouVersionId(appKey, versionCode);
  const response = await createYouVersionClient(appKey).getPassage(versionId, reference, format);
  // Normalise copyright from wherever the SDK puts it
  const copyright = response?.copyright || response?.data?.copyright || response?.meta?.copyright || '';
  return { ...response, _copyright: copyright };
}

// ── Bible.com keyword search ───────────────────────────────────────────────────
/**
 * Keyword search via the bible.com public website (Next.js / __NEXT_DATA__).
 * The YouVersion private SDK does not expose keyword search; this parses the
 * same content the official bible.com website delivers to users.
 *
 * Returns: [{ human_reference, text }]
 */
async function searchBibleCom(versionId, query) {
  const { net } = require('electron');
  const url = `https://www.bible.com/search/bible?q=${encodeURIComponent(query)}&version_id=${versionId}`;

  const res = await net.fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
  });

  if (!res.ok) throw new Error(`bible.com returned ${res.status} for search query.`);
  const html = await res.text();

  // Extract embedded Next.js page data
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not locate __NEXT_DATA__ in bible.com response.');

  let nextData;
  try { nextData = JSON.parse(match[1]); }
  catch { throw new Error('Failed to parse bible.com page data as JSON.'); }

  const pp = nextData?.props?.pageProps || {};

  // bible.com's Next.js data structure has changed over time — try all known paths
  const candidates = [
    pp?.data?.verses,
    pp?.results?.verses,
    pp?.searchResults?.hits,
    pp?.searchData?.hits,
    pp?.verses,
    pp?.hits,
  ];
  const verses = candidates.find(c => Array.isArray(c) && c.length > 0) || [];

  if (verses.length === 0) {
    // Try to detect a "no results" signal vs a parsing failure
    if (html.includes('no results') || html.includes('No results')) {
      return [];
    }
    throw new Error('Could not extract verse results from bible.com. The page format may have changed.');
  }

  return verses.map(v => ({
    human_reference: v.human_reference || v.reference || (Array.isArray(v.usfm) ? v.usfm[0] : '') || '',
    text: (v.content || v.text || '').replace(/<[^>]+>/g, '').trim(),
  })).filter(v => v.human_reference && v.text);
}

module.exports = {
  createYouVersionClient,
  hasDefaultAppKey,
  getAllYouVersionVersions,
  getYouVersionVersions,
  getYouVersionVersion,
  getYouVersionPassage,
  findYouVersionId,
  searchBibleCom,
};

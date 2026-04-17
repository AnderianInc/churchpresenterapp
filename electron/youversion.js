const { ApiClient, BibleClient } = require('@youversion/platform-core');
let defaultAppKey = process.env.YOUVERSION_APP_KEY || process.env.YV_APP_KEY || '';
try {
  const config = require('../config');
  defaultAppKey = defaultAppKey || config.YOUVERSION_APP_KEY || '';
} catch {
  // config file is optional; environment variables are preferred
}

function createYouVersionClient(appKey) {
  const key = String(appKey || defaultAppKey || '').trim();
  if (!key) {
    throw new Error('YouVersion App Key is required. Set YOUVERSION_APP_KEY in your environment or pass it from the renderer.');
  }
  const apiClient = new ApiClient({ appKey: key });
  return new BibleClient(apiClient);
}

/** Returns true if an API key is available in the main process (env or config file). */
function hasDefaultAppKey() {
  return !!defaultAppKey;
}

function normalizeVersionName(versionCode) {
  return String(versionCode || '').trim().toLowerCase();
}

function findVersionMatch(version, data) {
  const code = normalizeVersionName(version);
  return data.find(v => {
    const title = String(v.title || '').toLowerCase();
    const abbreviation = String(v.abbreviation || '').toLowerCase();
    return abbreviation === code || title === code || title.includes(code) || abbreviation.includes(code);
  });
}

// Cache: { [maskedKey]: version[] }
const allVersionsCache = {};

/**
 * Fetch available YouVersion translations using the SDK (which has the correct API URL).
 * Queries several language wildcards and merges results so we capture more than just
 * the default English set that 'en*' returns.
 */
async function getAllYouVersionVersions(appKey) {
  const effectiveKey = String(appKey || defaultAppKey || '').trim();
  if (!effectiveKey) throw new Error('YouVersion App Key is required.');

  const cacheKey = effectiveKey.slice(-8);
  if (allVersionsCache[cacheKey]) return { data: allVersionsCache[cacheKey] };

  const client = createYouVersionClient(appKey);
  const collected = new Map(); // keyed by version id to deduplicate

  // Query broad language wildcards; the SDK resolves the correct API base URL.
  // An empty string attempts to fetch without a language filter.
  const queries = ['', 'en*', 'es*', 'pt*', 'fr*', 'de*', 'zh*', 'ko*', 'ja*', 'ar*', 'ru*', 'hi*'];
  for (const lang of queries) {
    try {
      const response = await client.getVersions(lang);
      for (const v of (response?.data || [])) {
        if (v?.id && !collected.has(v.id)) collected.set(v.id, v);
      }
    } catch {
      // Some language codes may not return results — continue
    }
  }

  const versions = Array.from(collected.values());
  allVersionsCache[cacheKey] = versions;
  return { data: versions };
}

// Cache: { [resolveKey]: numericVersionId }
const versionIdCache = {};

async function findYouVersionId(appKey, versionCode) {
  const effectiveKey = String(appKey || defaultAppKey || '').trim();
  const cacheKey = `${effectiveKey.slice(-6)}:${normalizeVersionName(versionCode)}`;
  if (versionIdCache[cacheKey]) return versionIdCache[cacheKey];

  // Use the complete paginated list so non-English/obscure versions resolve correctly
  const response = await getAllYouVersionVersions(appKey);
  const versions = response?.data || [];
  const match = findVersionMatch(versionCode, versions);
  if (!match) throw new Error(`Could not resolve YouVersion version for "${versionCode}".`);
  versionIdCache[cacheKey] = match.id;
  return match.id;
}

async function getYouVersionVersions(appKey) {
  return getAllYouVersionVersions(appKey);
}

async function getYouVersionVersion(appKey, versionCode) {
  const versionId = await findYouVersionId(appKey, versionCode);
  const client = createYouVersionClient(appKey);
  return await client.getVersion(versionId);
}

async function getYouVersionPassage(appKey, versionCode, reference, format = 'text') {
  // Accept a pre-resolved numeric ID directly to avoid a redundant API round-trip
  const asNum = Number(versionCode);
  const versionId = (!isNaN(asNum) && asNum > 0) ? asNum : await findYouVersionId(appKey, versionCode);
  const client = createYouVersionClient(appKey);
  return await client.getPassage(versionId, reference, format);
}

/**
 * Keyword search using whatever search method the SDK exposes.
 * The YouVersion private developer API does not publicly document a search
 * endpoint, so we probe the BibleClient for known method names.
 * Throws YOUVERSION_SEARCH_UNSUPPORTED if none are found so the UI can
 * redirect the user to offline mode.
 */
async function searchYouVersionVerses(appKey, versionCode, query) {
  const asNum = Number(versionCode);
  const versionId = (!isNaN(asNum) && asNum > 0) ? asNum : await findYouVersionId(appKey, versionCode);

  const client = createYouVersionClient(appKey);

  for (const method of ['search', 'searchVerses', 'getSearchResults']) {
    if (typeof client[method] === 'function') {
      return await client[method](versionId, query);
    }
  }

  const err = new Error(
    'Keyword search is not available with this YouVersion API plan. ' +
    'Switch to Offline mode to search by text across your local translations.'
  );
  err.code = 'YOUVERSION_SEARCH_UNSUPPORTED';
  throw err;
}

module.exports = {
  createYouVersionClient,
  hasDefaultAppKey,
  getAllYouVersionVersions,
  getYouVersionVersions,
  getYouVersionVersion,
  getYouVersionPassage,
  findYouVersionId,
  searchYouVersionVerses,
};

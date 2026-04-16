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

// Cache: { [resolveKey]: numericVersionId }
// resolveKey = `${maskedAppKey}:${versionCode.toLowerCase()}`
const versionIdCache = {};

async function findYouVersionId(appKey, versionCode) {
  const effectiveKey = String(appKey || defaultAppKey || '').trim();
  const cacheKey = `${effectiveKey.slice(-6)}:${normalizeVersionName(versionCode)}`;
  if (versionIdCache[cacheKey]) return versionIdCache[cacheKey];

  const client = createYouVersionClient(appKey);
  const response = await client.getVersions('en*');
  const versions = response?.data || [];
  const match = findVersionMatch(versionCode, versions);
  if (!match) throw new Error(`Could not resolve YouVersion version for ${versionCode}.`);
  versionIdCache[cacheKey] = match.id;
  return match.id;
}

async function getYouVersionVersions(appKey, language = 'en*') {
  const client = createYouVersionClient(appKey);
  return await client.getVersions(language);
}

async function getYouVersionVersion(appKey, versionCode) {
  const versionId = await findYouVersionId(appKey, versionCode);
  const client = createYouVersionClient(appKey);
  return await client.getVersion(versionId);
}

async function getYouVersionPassage(appKey, versionCode, reference, format = 'text') {
  const versionId = await findYouVersionId(appKey, versionCode);
  const client = createYouVersionClient(appKey);
  return await client.getPassage(versionId, reference, format);
}

module.exports = {
  createYouVersionClient,
  hasDefaultAppKey,
  getYouVersionVersions,
  getYouVersionVersion,
  getYouVersionPassage,
  findYouVersionId,
};

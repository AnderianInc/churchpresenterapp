/**
 * scripts/update-online-index.js
 *
 * Fetches the list of available Bible translations from bible.helloao.org and
 * writes a local index to public/bibles/online-index.json.
 *
 * Each entry: { id, name, language, languageCode, countryCode, website, licenseUrl }
 *
 * Usage: node scripts/update-online-index.js
 *
 * Runs automatically during electron:build. Also scheduled monthly via GitHub Actions.
 */

const fs   = require('fs');
const path = require('path');

const API_URL  = 'https://bible.helloao.org/api/available_translations.json';
const OUT_DIR  = path.join(__dirname, '../public/bibles');
const OUT_FILE = path.join(OUT_DIR, 'online-index.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log(`Fetching ${API_URL} ...`);
  let res;
  try {
    res = await fetch(API_URL);
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    process.exit(1);
  }

  const data = await res.json();

  // The API returns { translations: [...] } where each entry has:
  //   id, name, language, languageCode, countryCode, website, licenseUrl
  const raw = Array.isArray(data) ? data
    : Array.isArray(data.translations) ? data.translations
    : [];

  if (raw.length === 0) {
    console.error('No translations found in API response');
    process.exit(1);
  }

  const translations = raw.map(t => ({
    id:           t.id            || t.shortName || t.abbreviation || '',
    name:         t.name          || t.fullName  || '',
    language:     t.language      || '',
    languageCode: t.languageCode  || t.language  || '',
    countryCode:  t.countryCode   || '',
    website:      t.website       || '',
    licenseUrl:   t.licenseUrl    || '',
  })).filter(t => t.id && t.name);

  const output = {
    generatedAt:  new Date().toISOString(),
    count:        translations.length,
    translations,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Wrote ${translations.length} online translations to ${path.relative(process.cwd(), OUT_FILE)}`);
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

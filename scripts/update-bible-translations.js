#!/usr/bin/env node
/**
 * scripts/update-bible-translations.js
 *
 * Fetches the latest translation list from bible.helloao.org and merges it
 * with the app's bundled offline version list, then writes the result to
 * public/bibles/translations.json.
 *
 * Run:
 *   node scripts/update-bible-translations.js
 *
 * Requires Node 18+ (built-in fetch). No extra dependencies needed.
 *
 * Run this before every release so the bundled list stays current.
 * The .github/workflows/update-translations.yml job automates this monthly.
 */

const fs = require('fs');
const path = require('path');

const HELLOAO_URL = 'https://bible.helloao.org/api/available_translations.json';
const OUT_FILE    = path.resolve(__dirname, '../public/bibles/translations.json');
const INDEX_FILE  = path.resolve(__dirname, '../public/bibles/index.json');

/** Normalize a raw version object from helloao into our canonical shape. */
function normalize(v) {
  return {
    id:           v.id,
    name:         v.name              || v.englishName || v.id,
    shortName:    v.shortName         || v.id,
    language:     v.language          || '',
    languageName: v.languageEnglishName || v.languageName || v.language || '',
  };
}

async function main() {
  // ── 1. Fetch online translations ───────────────────────────────────────────
  console.log(`Fetching ${HELLOAO_URL} …`);
  let onlineVersions = [];
  try {
    const res = await fetch(HELLOAO_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (raw.translations || raw.versions || raw.data || []);
    onlineVersions = list
      .filter(v => v && typeof v.id === 'string')
      .map(normalize);
    console.log(`  → ${onlineVersions.length} online translations`);
  } catch (err) {
    console.error(`  ✗ Could not fetch online translations: ${err.message}`);
    console.error('  Bundled file will contain offline versions only.');
  }

  // ── 2. Read bundled offline versions from index.json ──────────────────────
  let offlineVersions = [];
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    offlineVersions = Object.keys(raw).map(abbr => ({
      id:           abbr,
      name:         raw[abbr] || abbr,
      shortName:    abbr,
      language:     'en',
      languageName: 'English',
      isOffline:    true,
    }));
    console.log(`  → ${offlineVersions.length} offline translations from index.json`);
  } catch {
    console.warn('  index.json not found or unreadable — skipping offline versions');
  }

  // ── 3. Merge: offline entries take precedence (they're marked isOffline) ──
  const onlineIds = new Set(onlineVersions.map(v => v.id));
  const merged = [
    ...offlineVersions,
    ...onlineVersions.filter(v => !offlineVersions.some(o => o.id === v.id)),
  ];

  // ── 4. Write output ────────────────────────────────────────────────────────
  const output = {
    generatedAt:    new Date().toISOString(),
    source:         HELLOAO_URL,
    offlineCount:   offlineVersions.length,
    onlineCount:    onlineVersions.length,
    totalCount:     merged.length,
    versions:       merged,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n');
  console.log(`\n✓ Wrote ${merged.length} translations to ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  Generated at: ${output.generatedAt}`);
}

main().catch(err => { console.error(err); process.exit(1); });

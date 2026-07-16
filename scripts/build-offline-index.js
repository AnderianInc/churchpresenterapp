/**
 * scripts/build-offline-index.js
 *
 * Maintainer-only tool. Reads every .xml file in the Beblia collection, extracts
 * the `translation` attribute from the <bible> root element, and writes a compact
 * JSON *catalog* (translation names only — not the Bible text) to
 * public/bibles/offline-index.json.
 *
 * The Bible text itself is NOT bundled into the app: users download the Beblia
 * collection themselves and point the app at it (Settings → Bible XML Folder).
 * This script therefore does NOT read from public/; it reads the collection from
 * the BIBLE_XML_DIR environment variable, and when that is unset or missing it
 * skips silently and the committed offline-index.json is used as-is.
 *
 *   BIBLE_XML_DIR=/path/to/Holy-Bible-XML-Format-master node scripts/build-offline-index.js
 *
 * Each catalog entry: { id, name, filename }
 *   id       — filename without extension (used as a stable key and cache key)
 *   name     — full translation name from the translation="" attribute
 *   filename — the .xml filename relative to the collection folder
 */

const fs   = require('fs');
const path = require('path');

const XML_DIR  = process.env.BIBLE_XML_DIR ? path.resolve(process.env.BIBLE_XML_DIR) : null;
const OUT_DIR  = path.join(__dirname, '../public/bibles');
const OUT_FILE = path.join(OUT_DIR, 'offline-index.json');

if (!XML_DIR || !fs.existsSync(XML_DIR)) {
  console.warn(XML_DIR
    ? `Warning: Bible XML directory not found: ${XML_DIR}`
    : 'BIBLE_XML_DIR not set — skipping catalog rebuild.');
  console.warn('Using the committed public/bibles/offline-index.json as-is.');
  console.warn('To rebuild the catalog, download the Beblia collection from:');
  console.warn('  https://github.com/Beblia/Holy-Bible-XML-Format');
  console.warn('then run: BIBLE_XML_DIR=/path/to/Holy-Bible-XML-Format-master node scripts/build-offline-index.js');
  process.exit(0);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(XML_DIR)
  .filter(f => f.toLowerCase().endsWith('.xml'))
  .sort();

const entries = [];
let errors = 0;

for (const filename of files) {
  const filePath = path.join(XML_DIR, filename);
  try {
    // Read only first 2 KB — the <bible> root tag is always near the top
    const buf  = Buffer.alloc(2048);
    const fd   = fs.openSync(filePath, 'r');
    const read = fs.readSync(fd, buf, 0, 2048, 0);
    fs.closeSync(fd);
    const head = buf.slice(0, read).toString('utf-8');

    // Files use various attributes on the <bible> root — try all known variants
    const mTrans = head.match(/<bible[^>]+\btranslation="([^"]+)"/);
    const mLang  = head.match(/<bible[^>]+\blanguage="([^"]+)"/);
    const mName  = head.match(/<bible[^>]+\bname="([^"]+)"/);
    const mTitle = head.match(/<bible[^>]+\btitle="([^"]+)"/);
    const mBible = head.match(/<bible[^>]+\bbible="([^"]+)"/);
    const m = mTrans || mLang || mName || mTitle || mBible;
    if (!m) {
      console.warn(`  [skip] No translation/language attribute found: ${filename}`);
      errors++;
      continue;
    }

    const id   = path.basename(filename, '.xml');
    const name = m[1].trim();
    entries.push({ id, name, filename });
  } catch (err) {
    console.warn(`  [error] Could not read ${filename}: ${err.message}`);
    errors++;
  }
}

// Sort by translation name for consistent ordering
entries.sort((a, b) => a.name.localeCompare(b.name));

const output = {
  generatedAt: new Date().toISOString(),
  count: entries.length,
  translations: entries,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`Wrote ${entries.length} offline translations to ${path.relative(process.cwd(), OUT_FILE)}`);
if (errors > 0) console.warn(`  (${errors} file(s) skipped due to errors)`);

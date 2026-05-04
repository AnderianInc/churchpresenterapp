#!/usr/bin/env node
/**
 * generate-test-presentation.js
 *
 * Generates a large benchmark presentation and writes it to the Church Presenter
 * data file (schedules.json) so you can load it straight into the app for
 * stress testing.
 *
 * Usage:
 *   node scripts/generate-test-presentation.js [--slides N] [--items M] [--out PATH]
 *
 *   --slides N   Slides per schedule item (default: 8)
 *   --items  M   Number of schedule items (default: 15, giving 120 slides total)
 *   --out PATH   Output path (default: auto-detect userData schedules.json)
 *   --stdout     Print JSON to stdout instead of writing a file
 *
 * Benchmark scenarios covered:
 *   - Long text (tests layout thrashing on rapid slide changes)
 *   - Short text (tests transition speed baseline)
 *   - Color backgrounds (CPU-only rendering)
 *   - Image backgrounds (GPU texture upload)
 *   - Mixed backgrounds (realistic service pattern)
 *
 * After loading the generated schedule, run the app and:
 *   1. Open the Presentation window.
 *   2. Press F9 to open the performance overlay.
 *   3. Use keyboard arrow keys to cycle through slides at 1–2 s intervals.
 *   4. Record FPS, latency, and heap MB from the overlay.
 *   5. Note any frame drops or latency spikes above 100 ms.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { randomUUID } = require('crypto');

// ─── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}
const SLIDES_PER_ITEM = parseInt(getArg('--slides', '8'), 10);
const ITEM_COUNT      = parseInt(getArg('--items',  '15'), 10);
const TO_STDOUT       = args.includes('--stdout');
const CUSTOM_OUT      = getArg('--out', null);

// ─── Benchmark content pools ───────────────────────────────────────────────────

const SONG_TITLES = [
  'Amazing Grace', 'How Great Thou Art', 'Blessed Assurance', '10,000 Reasons',
  'Way Maker', 'Build My Life', 'Goodness of God', 'What a Beautiful Name',
  'Great Are You Lord', 'Holy Spirit', 'Oceans', 'King of My Heart',
  'Living Hope', 'The Blessing', 'Raise a Hallelujah',
];

const LONG_LINES = [
  'Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see',
  'When we\'ve been there ten thousand years\nBright shining as the sun\nWe\'ve no less days to sing God\'s praise\nThan when we\'d first begun',
  'How great Thou art how great Thou art\nThen sings my soul my Savior God to Thee\nHow great Thou art how great Thou art',
  '\'Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed',
  'Through many dangers toils and snares\nI have already come\n\'Tis grace that brought me safe thus far\nAnd grace will lead me home',
  'Bless the Lord O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI\'ll worship Your holy name',
  'You give and take away\nYou give and take away\nMy heart will choose to say\nLord blessed be Your name',
  'I will bless the Lord at all times\nHis praise shall continually be in my mouth\nMy soul shall make its boast in the Lord\nThe humble shall hear of it and be glad',
];

const SHORT_LINES = [
  'Hallelujah', 'Holy holy holy', 'Praise the Lord', 'Glory to God',
  'Let everything that has breath praise the Lord',
  'Great is Thy faithfulness', 'O God of our salvation',
  'He is risen', 'Come now is the time to worship',
];

const SLIDE_LABELS = ['Verse 1', 'Chorus', 'Verse 2', 'Bridge', 'Tag', 'Outro', 'Intro', 'Pre-Chorus'];

const BG_COLORS = [
  '#0a0a1a', '#1a0a0a', '#0a1a0a', '#0d0d22', '#1a1000',
  '#000000', '#0c1220', '#1c0c20',
];

// Mix of realistic background types — matches what a real service would use
function pickBackground(itemIndex, slideIndex) {
  const seed = (itemIndex * 7 + slideIndex * 3) % 5;
  if (seed === 0) return { type: 'color', value: BG_COLORS[itemIndex % BG_COLORS.length] };
  if (seed === 1) return { type: 'color', value: BG_COLORS[(itemIndex + 2) % BG_COLORS.length] };
  // Remaining use color — in a real app you'd use file:// paths here
  return { type: 'color', value: BG_COLORS[(itemIndex + slideIndex) % BG_COLORS.length] };
}

// ─── Generation ────────────────────────────────────────────────────────────────

function makeSlide(itemIndex, slideIndex) {
  const labelIdx  = slideIndex % SLIDE_LABELS.length;
  const longIdx   = (itemIndex * SLIDES_PER_ITEM + slideIndex) % LONG_LINES.length;
  const shortIdx  = (itemIndex + slideIndex) % SHORT_LINES.length;
  const isChorus  = labelIdx === 1 || labelIdx === 4; // Chorus / Tag = short
  const lines     = isChorus ? SHORT_LINES[shortIdx] : LONG_LINES[longIdx];

  return {
    id:         randomUUID(),
    lines,
    label:      SLIDE_LABELS[labelIdx],
    textAlign:  'center',
    background: pickBackground(itemIndex, slideIndex),
  };
}

function makeItem(index) {
  const title   = SONG_TITLES[index % SONG_TITLES.length];
  const slides  = Array.from({ length: SLIDES_PER_ITEM }, (_, si) => makeSlide(index, si));

  return {
    scheduleId:  randomUUID(),
    id:          randomUUID(),
    title:       `${title} (bench-${index + 1})`,
    author:      'Benchmark Generator',
    type:        'song',
    fontSize:    44,
    fontFamily:  'Georgia',
    textColor:   '#ffffff',
    key:         ['C', 'G', 'D', 'A', 'E', 'F'][index % 6],
    background:  { type: 'color', value: BG_COLORS[index % BG_COLORS.length] },
    slides,
  };
}

const schedule = Array.from({ length: ITEM_COUNT }, (_, i) => makeItem(i));

const totalSlides = schedule.reduce((n, item) => n + item.slides.length, 0);

// ─── Output ────────────────────────────────────────────────────────────────────

const json = JSON.stringify(schedule, null, 2);

if (TO_STDOUT) {
  process.stdout.write(json + '\n');
  process.stderr.write(`Generated ${ITEM_COUNT} items / ${totalSlides} slides.\n`);
  process.exit(0);
}

function detectDataDir() {
  if (CUSTOM_OUT) return CUSTOM_OUT;

  // Try to find the app's userData schedules.json
  const platform = os.platform();
  let base;
  if (platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else if (platform === 'win32') {
    base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else {
    base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }

  const candidates = ['church-presenter', 'ChurchPresenter', 'church_presenter'];
  for (const name of candidates) {
    const p = path.join(base, name, 'data', 'schedules.json');
    if (fs.existsSync(p)) return p;
  }

  // Fallback: write next to this script
  return path.join(__dirname, 'benchmark-schedules.json');
}

const outPath = detectDataDir();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, json, 'utf-8');

console.log(`
Benchmark presentation generated
─────────────────────────────────
  Items  : ${ITEM_COUNT}
  Slides : ${totalSlides}
  Output : ${outPath}

Next steps
──────────
  1. (Re)start Church Presenter — it will load the new schedule automatically.
  2. Open the Presentation window on your second display.
  3. Press F9 in any window to open the performance overlay.
  4. Cycle through all ${totalSlides} slides using the arrow keys (aim for ~1 s per slide).
  5. Watch for:
       FPS   < 55 → rendering bottleneck
       Latency > 100 ms → IPC or layout thrashing
       Heap  > 400 MB → potential memory leak
  6. Run twice and compare to detect regressions.
`);

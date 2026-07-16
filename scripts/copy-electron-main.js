/**
 * scripts/copy-electron-main.js
 *
 * Copies the Electron main-process files from electron/ into build/ so the
 * packaged app can run them.
 *
 * Why this exists: the packaged app's main entry is build/electron.js (see
 * package.json → build.extraMetadata.main), but `react-scripts build` copies the
 * placeholder public/electron.js (a no-op stub) into build/electron.js. Without
 * this step the packaged app launches a main process that creates no windows —
 * the app "runs" but nothing appears. `electron:dev` is unaffected because it
 * uses electron/main.js directly (package.json → main).
 *
 * This MUST run after `react-scripts build` and before `electron-builder`. It is
 * wired into every electron:build* script and reused by the CI release workflow
 * so the two never drift.
 */
const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');

if (!fs.existsSync(buildDir)) {
  console.error('build/ does not exist — run `react-scripts build` before copying Electron files.');
  process.exit(1);
}

// electron/main.js becomes build/electron.js (the packaged main entry).
// The rest keep their names — main.js require()s them as ./siblings, and
// preload.js is loaded from __dirname/preload.js at runtime.
const RENAMES  = [['main.js', 'electron.js']];
const SIBLINGS = ['preload.js', 'validators.js', 'defaultData.js', 'perf.js', 'logger.js'];

const copies = [
  ...RENAMES.map(([src, dest]) => [src, dest]),
  ...SIBLINGS.map(name => [name, name]),
];

for (const [src, dest] of copies) {
  const from = path.join(root, 'electron', src);
  const to   = path.join(buildDir, dest);
  if (!fs.existsSync(from)) {
    console.error(`Missing expected Electron file: electron/${src}`);
    process.exit(1);
  }
  fs.copyFileSync(from, to);
}

console.log(`Copied Electron main-process files into build/ (${copies.map(c => c[1]).join(', ')}).`);

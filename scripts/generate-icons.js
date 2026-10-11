/**
 * scripts/generate-icons.js
 *
 * Regenerates the platform app-icon files from a single committed master PNG,
 * build-resources/icon.png (the "CP" mark, 1024×1024, full-bleed square). Run
 * this whenever the logo changes:
 *
 *   node scripts/generate-icons.js
 *
 * Outputs (all committed so CI builds pick them up):
 *   build-resources/icon.icns  — macOS app icon, shaped to Apple's rounded
 *                                "squircle" grid with transparent padding so it
 *                                sits in the Dock like a native app (not a tile)
 *   build-resources/icon.ico   — Windows app icon (multi-size, full-bleed square)
 *   build-resources/icon.png   — Linux app icon / electron-builder source (square)
 *   public/app-icon.png        — 512px icon for the renderer favicon + window icon
 *
 * macOS-only tool: relies on `sips` + `iconutil` (ship with macOS) and `python3`
 * with Pillow (for the rounded macOS mask). No ImageMagick required — the .ico is
 * packed by hand. CI does not run this; it consumes the committed outputs.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const MASTER = path.join(root, 'build-resources', 'icon.png');

if (!fs.existsSync(MASTER)) {
  console.error(`Master icon not found: ${MASTER}`);
  console.error('Add the 1024×1024 "CP" mark there first, then re-run.');
  process.exit(1);
}

const resize = (src, size, out) =>
  execFileSync('sips', ['-z', String(size), String(size), src, '--out', out], { stdio: 'ignore' });

// Apple's macOS icon grid (Big Sur+): on a 1024 canvas the rounded body is
// 824×824, inset 100px, with a ~185px corner radius. Producing the icon this
// way is what gives it the native rounded-with-padding Dock appearance instead
// of a full white square.
const PY_ROUND = `
import sys
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]
CANVAS, BODY, RADIUS = 1024, 824, 186
MARGIN = (CANVAS - BODY) // 2
logo = Image.open(src).convert("RGBA").resize((BODY, BODY), Image.LANCZOS)
mask = Image.new("L", (BODY, BODY), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, BODY - 1, BODY - 1], radius=RADIUS, fill=255)
canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
canvas.paste(logo, (MARGIN, MARGIN), mask)
canvas.save(dst)
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-icons-'));

try {
  // ── macOS .icns (rounded squircle master) ─────────────────────────────────
  const macMaster = path.join(tmp, 'icon-macos-1024.png');
  execFileSync('python3', ['-c', PY_ROUND, MASTER, macMaster], { stdio: 'inherit' });

  const iconset = path.join(tmp, 'icon.iconset');
  fs.mkdirSync(iconset);
  for (const s of [16, 32, 128, 256, 512]) {
    resize(macMaster, s, path.join(iconset, `icon_${s}x${s}.png`));
    resize(macMaster, s * 2, path.join(iconset, `icon_${s}x${s}@2x.png`));
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'build-resources', 'icon.icns')], { stdio: 'inherit' });

  // ── Windows .ico (dependency-free packer, full-bleed square) ───────────────
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngs = icoSizes.map(s => {
    const p = path.join(tmp, `ico_${s}.png`);
    resize(MASTER, s, p);
    return { size: s, data: fs.readFileSync(p) };
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type: 1 = icon
  header.writeUInt16LE(pngs.length, 4);  // image count

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach((img, i) => {
    const e = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 0); // width  (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1); // height (0 = 256)
    dir.writeUInt8(0, e + 2);            // palette
    dir.writeUInt8(0, e + 3);            // reserved
    dir.writeUInt16LE(1, e + 4);         // color planes
    dir.writeUInt16LE(32, e + 6);        // bits per pixel
    dir.writeUInt32LE(img.data.length, e + 8);  // image data size
    dir.writeUInt32LE(offset, e + 12);          // image data offset
    offset += img.data.length;
  });

  fs.writeFileSync(
    path.join(root, 'build-resources', 'icon.ico'),
    Buffer.concat([header, dir, ...pngs.map(p => p.data)])
  );

  // ── Renderer favicon / BrowserWindow icon (square) ─────────────────────────
  resize(MASTER, 512, path.join(root, 'public', 'app-icon.png'));

  // Rounded macOS PNG for the runtime Dock icon in dev (app.dock.setIcon).
  // Packaged macOS apps get the rounded look from icon.icns automatically, but
  // in dev the Dock icon is set from a PNG, which macOS shows as-is — so it must
  // already be rounded.
  resize(macMaster, 512, path.join(root, 'public', 'app-icon-macos.png'));

  console.log('Generated icon.icns (rounded macOS), icon.ico, public/app-icon.png, and public/app-icon-macos.png');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

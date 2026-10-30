# build-resources/

This directory contains assets used by electron-builder during packaging.

## App icons (committed)

The app's brand icons are committed so CI and local builds all produce the same
branded installers.

| File | Purpose |
|---|---|
| `icon.png` | Master "CP" mark (1024×1024) — Linux app icon + electron-builder source |
| `icon.icns` | macOS app icon (generated from `icon.png`) |
| `icon.ico` | Windows app icon, multi-size (generated from `icon.png`) |

The renderer favicon / in-app window icon lives at `public/app-icon.png`
(512×512), and the startup splash logo at `public/splash-logo.png`.

## Regenerating icons after a logo change

1. Replace `build-resources/icon.png` with the new 1024×1024 "CP" mark.
2. Run:
   ```bash
   node scripts/generate-icons.js
   ```
   This regenerates `icon.icns`, `icon.ico`, and `public/app-icon.png`.
3. To change the splash, replace `public/splash-logo.png` with the new full logo.
4. Commit the updated files.

The generator uses macOS `sips` + `iconutil` plus `python3` with Pillow (for the
rounded macOS "squircle" mask), and packs the `.ico` by hand — no ImageMagick
needed. It only runs on macOS; CI consumes the committed outputs. The macOS icon
is shaped to Apple's rounded grid with transparent padding so it sits in the
Dock like a native app; the Windows/Linux icons stay full-bleed square.

## Other included files

| File | Purpose |
|---|---|
| `entitlements.mac.plist` | macOS Hardened Runtime entitlements for code signing and notarization |

# build-resources/

This directory contains assets used by electron-builder during packaging.

## Required files (not committed — add before building for distribution)

| File | Purpose |
|---|---|
| `icon.icns` | macOS app icon (1024×1024 recommended; generate with `iconutil`) |
| `icon.ico` | Windows app icon (256×256 recommended; multi-size ICO) |
| `icon.png` | Linux app icon (512×512 PNG) |

## Included files

| File | Purpose |
|---|---|
| `entitlements.mac.plist` | macOS Hardened Runtime entitlements for code signing and notarization |

## Generating icons from a source PNG

```bash
# Requires ImageMagick and Apple's iconutil (macOS)

# 1. Create iconset directory
mkdir icon.iconset

# 2. Generate all required sizes
for size in 16 32 64 128 256 512; do
  convert source-1024.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
  convert source-1024.png -resize $((size*2))x$((size*2)) icon.iconset/icon_${size}x${size}@2x.png
done

# 3. Build .icns
iconutil -c icns icon.iconset

# 4. Build .ico (Windows)
convert source-1024.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# 5. Copy PNG for Linux
cp source-1024.png icon.png
```

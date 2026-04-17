# Changelog

All notable changes to Church Presenter are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Image backgrounds in `BackgroundPicker` — file picker, thumbnail preview, brightness dimmer
- Item background editor in PreviewArea — edit the background of any schedule item without reopening the song editor
- Video favorites in Media panel — 4 persistent slots assignable to video files; one-off import still available
- Settings window opens centered on screen
- `❔ Help` moved to floating Settings overlay (Help tab); removed from main nav tabs
- `updateScheduleItem` AppContext action for patching schedule items in place
- `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` macOS entitlements for production builds

### Fixed
- `validateSlide` in both `electron/validators.js` and `src/store/persistence.js` now preserves `textAlign`, `background` (all types), and `chords` — previously these P6/P8 fields were silently dropped on corruption-recovery load
- `electron/defaultData.js` now `require()`s `src/data/defaultSongs.js` directly — eliminates manual sync risk between two copies of the same data

### Changed
- `src/data/defaultSongs.js` uses `module.exports` (compatible with both webpack and Node.js `require()`)
- `electron-builder` config expanded: DMG layout, NSIS installer options, Linux deb target, code-signing stubs, GitHub publish provider, macOS Hardened Runtime entitlements

### Tests
- 186 tests (up from 160): added `updateScheduleItem`, undo/redo history (10 cases), validator field preservation (16 cases including all background types)

---

## [1.0.0] — Initial Release

### Core Features
- Song library with full lyrics editor (verse/chorus/bridge/intro/ending/tag/blank slide types)
- Per-slide text alignment (L/C/R), chord chart tab, style presets, BPM/CCLI metadata
- Song import: Genius Lyrics, Planning Center Online, OpenLyrics XML, paste with `[Section]` markers
- Offline Bible search (KJV + NIV bundled, all translations searched simultaneously)
- YouVersion online Bible search (reference lookup)
- Service schedule with drag-to-reorder, undo/redo (Cmd/Ctrl+Z), crash-safe autosave + recovery banner
- Fullscreen presentation output with Electron IPC + browser BroadcastChannel fallback
- Stage display: lyrics, key, tempo, clock, chord charts
- Multi-output windows: announcement, background, confidence, custom — any role on any display
- Output Manager: visual routing panel, named display labels, routing presets
- Background editor: 12 solid presets, 8 gradient presets, custom gradient builder, image backgrounds, per-slide overrides
- Media panel: solid/gradient backgrounds, video import (Electron-persistent), 4 video favorite slots
- Announcement panel with live 16:9 preview
- Streaming: OBS Virtual Camera, lower-third overlays, Blackout forwarded to stream window
- Social Media streaming via FFmpeg RTMP: Facebook Live, YouTube Live, Instagram Live, custom RTMP; multi-destination, stream health indicators
- Sermon Assistant: Web Speech API mic, real-time Bible reference detection, Claude AI verse suggestions
- Settings floating window: API Keys, Social Media, Devices tabs + Help tab
- Keyboard shortcuts: Space/→ next, ←/Backspace prev, Enter go live, B blackout, C clear, Cmd+Z undo, Cmd+Shift+Z redo
- GitHub Actions CI (tests on push/PR) + release workflow (macOS/Windows/Linux installers on tag)

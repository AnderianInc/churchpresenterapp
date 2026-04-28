# Changelog

All notable changes to Church Presenter are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] — 2026-04-28

### Added

#### Timer System & Stage Communications
- **⏱ Timers panel** — new nav tab with countdown, stopwatch, and clock timer types; operator controls include start / pause / reset; progress bar turns amber at <20% remaining, red at expiry
- **Stage Announcements** — private operator messages (text box in Timers panel) broadcast instantly to every open Confidence Monitor window; press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send without the mouse; never shown on audience-facing outputs
- **BroadcastChannel + Electron IPC relay** for timer state and stage announcements so all output windows stay in sync

#### Confidence Monitor (Four-Quadrant Display)
- **Rebuilt Confidence Monitor** — full-screen four-quadrant display designed for a stage-facing TV:
  - Upper-left: current live slide (text + background)
  - Upper-right: next slide, dimmed so the worship team can prepare
  - Lower-left: all active timers (wall clock always visible; countdown/stopwatch with progress bars)
  - Lower-right: stage announcements from the operator

#### YouTube Playback
- **Operator-controlled playback** — YouTube video backgrounds load paused; operator clicks Play in the YouTube controller to start; no unexpected autoplay on Go Live
- **Unified controls** — play/pause/mute/volume commands now reach every output window including Confidence Monitor, using the YouTube embed postMessage protocol (`enablejsapi=1`)
- **Single audio source** — only the Program (presentation) output ever unmutes; stage/confidence/announcement outputs stay muted, eliminating competing audio from multiple windows

#### Documentation & Help
- **📺 Outputs tab in Settings** — inline reference guide covering Confidence Monitor quadrant layout, Timer types, and Stage Announcement workflow
- **Help: Confidence Monitor section** — new accordion in ❔ Help explaining all four quadrants and how to open a Confidence Monitor output
- **Help: Timers & Stage Announcements section** — explains timer types, add/control flow, announcement keyboard shortcut, and Clear behaviour

#### Core Features
- Song library with full lyrics editor (verse / chorus / bridge / intro / ending / tag / blank slide types)
- Per-slide text alignment (L/C/R), chord chart tab, style presets (Large Title / Subtitle / Body / Compact), BPM / CCLI / copyright metadata
- Song import: Genius Lyrics, Planning Center Online, OpenLyrics XML, paste with `[Section]` markers
- Offline Bible search — KJV + NIV bundled; all installed translations searched simultaneously; verse multi-select, Add All, result clear
- Online Bible search via bible.helloao.org — any translation, no API key required
- Service schedule with drag-to-reorder, undo/redo (Cmd/Ctrl+Z), crash-safe autosave every 60 s with restore banner
- Fullscreen presentation output — Electron IPC for production, BroadcastChannel fallback for browser/dev
- Stage display — current + next slide split-screen, chord chart, BPM/tempo, live wall clock
- Multi-output windows — any role (Program / Stage / Announcement / Background / Confidence) on any display, created on the fly
- Output Manager — visual routing panel, named display labels, one-click routing presets
- Background editor — 12 solid presets, 8 gradient presets, custom gradient builder, image backgrounds with brightness control, video backgrounds, per-slide background overrides
- Item background editor in PreviewArea — change a schedule item's background without reopening the song editor
- Media panel — solid/gradient backgrounds, video import (Electron-persistent via userData/media/), 4 video favourite slots
- Announcement panel with live 16:9 preview before adding to the schedule
- Streaming panel — OBS Virtual Camera / webcam source, in-panel live preview, lower-third overlays with animated slide-up, Blackout forwarded to stream window
- Social Media streaming via FFmpeg RTMP — Facebook Live, YouTube Live, Instagram Live, custom RTMP; multi-destination, per-stream bitrate badge and duration counter; Go Live button disabled with install instructions if FFmpeg not found
- Sermon Assistant — continuous Web Speech API mic, real-time Bible reference detection, Claude AI verse suggestions every ~45 s of new speech; 14-bar VU level meter; privacy notice
- Settings floating window — API Keys tab (Genius / PCO / YouVersion / Anthropic), Social Media tab (RTMP destinations), Devices tab (preferred mic + live VU meter test, preferred camera, presentation font defaults), Help tab (inline ❔ Help with search)
- Keyboard shortcuts: Space / → next slide, ← / Backspace prev, Enter go live, B blackout, C clear, Cmd+Z undo, Cmd+Shift+Z redo, Cmd+Enter send stage announcement
- Go Live auto-creates a Program output on the best available display when no outputs are open
- Crash-safe recovery — autosave snapshot every 60 s; restore banner on next launch if data changed since last save

#### Infrastructure
- GitHub Actions CI — tests on every push and pull request (Node 18 + Node 20 matrix)
- GitHub Actions release pipeline — macOS (arm64 + x64 DMG + zip), Windows (x64 NSIS installer), Linux (x64 AppImage) built in parallel on every `v*` tag
- electron-builder config — DMG window layout, NSIS directory picker + desktop shortcut, macOS Hardened Runtime + entitlements (camera, mic, audio input, network, file read/write), code-signing environment variable stubs for CI
- Documentation: setup guide, service-day runbook, display setup guide, troubleshooting guide, backup & restore guide, CONTRIBUTING.md

### Fixed
- **YouTube removeChild crash** — replaced YT.Player API (which physically replaced React-managed DOM nodes with iframes, breaking React's reconciliation) with the YouTube embed postMessage protocol; slide navigation no longer throws `removeChild: node is not a child` errors
- `validateSlide` in both `electron/validators.js` and `src/store/persistence.js` now preserves `textAlign`, `background` (all types), and `chords` — previously these fields were silently dropped during corruption-recovery loads
- `electron/defaultData.js` now `require()`s `src/data/defaultSongs.js` directly — eliminates manual sync risk between two copies of the same starter data
- macOS screen-capture permission prompt — now only triggered when status is `not-determined`; no longer re-prompts when status is `denied`

### Changed
- `src/data/defaultSongs.js` uses `module.exports` (compatible with both webpack and Node.js `require()`)
- `BROADCAST_CHANNEL` renamed from `ew_presentation` → `cp_presentation`; localStorage keys renamed `ew_*` → `cp_*`; migration runs automatically on first launch

### Tests
- 365 passing tests: slide navigation, goLive transitions, blackout/clear, undo/redo history, multi-output routing, persistence validators, timerEngine pure functions (createTimer, start/pause/reset, elapsed/remaining/expired calculations)

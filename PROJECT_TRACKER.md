# Church Presenter — Project Tracker

This document tracks architecture, completed work, and remaining priorities for Church Presenter — a free, offline-first church presentation app for desktop and browser.

---

## Product Vision

Build a reliable, offline-first church presentation app that is easy to use on Sunday mornings and free for churches. It should support fast song/scripture/media preparation, dependable live output, and multi-screen operation with no paid subscription. The goal is to preserve EasyWorship-level simplicity and speed while offering ProPresenter-style flexibility: multiple dynamic output windows, separate presentation zones for lyrics/announcements/backgrounds/stage, lower-third overlays for streaming, and clear content routing without added operator complexity.

---

## Current Architecture

### Runtime Modes

- **Desktop (primary):** React renderer inside Electron windows.
- **Browser (fallback/dev):** React app in browser windows via `BroadcastChannel`.

### View Routing (`src/App.jsx`)

| Path | Component | Purpose |
|---|---|---|
| `/` | `MainLayout` | Operator control surface |
| `/presentation` | `PresentationView` | Fullscreen audience output |
| `/stage` | `StageView` | Worship team stage display |
| `/output` | `OutputView` | Generic role-based output window |
| `/stream` | `StreamView` | Stream output (OBS/Zoom screen share) |

### State (`src/store/AppContext.jsx`)

Central state and action layer. Owns:
- Songs, schedule, settings, active selection
- Live slide state (program + stage independently)
- Output window registry (id, role, displayIndex)
- Blackout / clear flags
- Stream window state (open/closed, lower-third data)

Actions: song CRUD, schedule lifecycle, slide navigation, `goLiveProgram`, `goLiveStage`, `goLiveOutput`, `goLiveAll`, blackout/clear toggles, output window lifecycle, `openStream` / `closeStream`, `pushLowerThird`, `sendStreamConfig`.

### Persistence

| Mode | Storage |
|---|---|
| Electron | JSON files via IPC: `songs.json`, `schedules.json`, `settings.json` |
| Browser | `localStorage` (`ew_songs`, `ew_schedule`, `ew_settings`) |

Electron uses atomic writes (`.tmp` rename). Both modes validate data on load and recover corrupt files to safe defaults.

### Electron Windows

`electron/main.js` manages five window types:
- **Main control window** — operator UI
- **Presentation window** — fullscreen program output on target display
- **Stage window** — worship team monitor
- **Output windows** (N, dynamically created) — announcement, background, confidence, etc.
- **Stream window** — 1280×720, designed for screen sharing to Zoom/Teams/OBS

IPC channels:
- `send-slide-program` / `send-slide-stage` → `receive-slide`
- `send-blackout` → `receive-blackout` (broadcast to all windows including stream)
- `send-clear` → `receive-clear`
- `send-output-state` → `receive-output`
- `send-lower-third` → `receive-lower-third` (stream window only)
- `send-stream-config` → `receive-stream-config` (stream window only)

### UI Panels (`src/components/`)

| Panel | Tab | Purpose |
|---|---|---|
| `LibraryPanel` | 🎵 Songs | Song library browse + search |
| `BiblePanel` | 📖 Bible | Scripture search (offline + YouVersion) |
| `MediaPanel` | 🖼️ Media | Backgrounds and video import |
| `AnnouncementPanel` | 📢 Announcements | Announcement slide builder |
| `StreamPanel` | 📡 Stream | Camera source, lower-third, stream window |
| `OutputManager` | 📺 Outputs | Output routing panel (previews, labels, presets) |
| `SettingsPanel` | ⚙ Settings | API keys, RTMP destinations, presentation defaults |
| `HelpPanel` | ❔ Help | Keyboard shortcut reference |
| `SongImportModal` | — | Song import modal (PCO, OpenLyrics, paste) |

---

## Completed Work

### Foundation

- [x] Core song library and lyrics slide model
- [x] Service schedule with add / remove / drag-to-reorder
- [x] Preview + program dual-view operator workflow
- [x] Slide navigation (next/prev across items)
- [x] Operator keyboard shortcuts (Space, Arrow, Enter, B, C) via `useKeyboardShortcuts`
- [x] Live transport: Electron IPC + browser BroadcastChannel (`ew_presentation`)
- [x] BroadcastChannel contract standardised (`BROADCAST_CHANNEL` / `makeBroadcastMsg`)
- [x] Initial live-state recovery in output windows (`liveStateSync.js`, state-request/sync messages)
- [x] Toolbar save-status indicator (saving / saved / error)
- [x] Cross-platform packaging config (`electron-builder`; macOS DMG, Windows EXE, Linux AppImage)

### Persistence & Stability

- [x] Electron JSON persistence hardened: validators (`electron/validators.js`), corrupt-file backup + safe-default recovery, atomic write (`.tmp` rename)
- [x] Browser `localStorage` hardened: `validateSongsArray` / `validateScheduleArray` / `validateSettings` on load; corrupt data backed up to timestamped key
- [x] `electron/defaultData.js` supplies starter songs for new installs

### Multi-Output System

- [x] Dynamic output window creation (`createOutputWindow`) with role, display, and title
- [x] Output roles: `presentation`, `stage`, `announcement`, `background`, `confidence`
- [x] `OutputView.jsx` — generic role-aware output window with startup state recovery
- [x] Per-output content routing (`liveOutputs`, `liveRoleSlides`) with override support
- [x] `goLiveOutput` / `goLiveAll` — route content to specific windows or all at once
- [x] Display picker in toolbar for multi-screen presentation window targeting
- [x] Move output to any display; update role in-flight

### Bug Fixes (2026-04-15)

- [x] `SlideRenderer`: `position: 'relative'` on containers — fixes absolute-positioned backgrounds escaping
- [x] `SlideRenderer`: gradient backgrounds now render correctly (type check includes `'gradient'`)
- [x] `OutputView`: fixed `resolveSlideForRole` argument order (state object was passed as `outputId`)
- [x] `PreviewArea`: Stage (independent) button now calls `goLiveStage` directly instead of `handleSend()`
- [x] `Toolbar`: clock interval fixed 10 000 ms → 1 000 ms
- [x] `AppContext`: stale closure in `sendOutputState` fixed via `overrideProgram`/`overrideStage` params

### Bible Module

- [x] Offline Bible auto-detection from `/public/bibles/index.json` — no hardcoded paths
- [x] KJV + NIV bundled (66 books each); additional translations added by dropping a folder + updating `index.json`
- [x] Lazy per-book loading (`fetchBibleBookIfNeeded`) — reference search triggers one HTTP fetch, not 66
- [x] **Multi-translation search** — offline search queries ALL available translations simultaneously; results labelled with version badge (KJV / NIV)
- [x] Verse selection queue with multi-select, "Add Selected", "Add All", and "Clear" (✕) to reset search
- [x] YouVersion API fully integrated: auto-detects pre-configured key (env var or `config.local.js`) without exposing the key to the renderer
- [x] Version ID caching in `electron/youversion.js` to avoid redundant API calls
- [x] `parseBiblePackageJson` handles actual nested `{book, chapters, verses}` file format
- [x] Psalm/Psalms alias normalised; `canonicalBook` exported from `bible.js`

### Streaming (OBS / Zoom)

- [x] **StreamView.jsx** — dedicated stream output window at `/stream` route; fullscreen video feed + animated lower-third overlay + blackout support
- [x] **StreamPanel.jsx** — operator controls: open/close stream window, camera source selection (OBS Virtual Camera, webcam, capture cards), in-panel live preview, source status badge (LIVE), Stop / Switch Source / Restart Source actions
- [x] Lower-third overlay: label + main text + source line; animated slide-up transition with gradient bar
- [x] Quick send from active schedule item (auto-strips attribution line from Bible verses)
- [x] Manual lower-third text input with "Send Lower-Third" and "Clear"
- [x] Blackout forwarded to stream window alongside presentation and stage windows
- [x] BroadcastChannel support for lower-third and stream-config in browser mode

---

## Remaining Work

### P0 — Identity & Branding ✅ Complete

- [x] Rename app identity in `package.json`:
  - [x] `name`: `church-presenter`
  - [x] `productName`: `Church Presenter`
  - [x] `appId`: `com.church.churchpresenter`
- [x] `description` updated to remove "clone" language
- [x] `public/index.html` title updated to "Church Presenter"
- [x] Toolbar logo updated from "EW" → "CP"
- [x] `BROADCAST_CHANNEL` renamed `ew_presentation` → `cp_presentation` in `AppContext.jsx`; all three hardcoded view files (`PresentationView`, `StageView`, `OutputView`) now import and use the constant
- [x] localStorage keys renamed `ew_*` → `cp_*`; `migrateLegacyStorage()` in `persistence.js` copies existing data on first launch
- [x] `liveStateSync.js` key renamed `ew_live_state` → `cp_live_state`; covered by same migration
- [x] `electron/main.js` `migrateLegacyDataDir()` copies `songs.json`, `schedules.json`, `settings.json` from old `easyworship-clone` userData path to `church-presenter` on first launch
- [x] README data directory table updated to `church-presenter` paths
- [x] `broadcast.test.js` assertion updated to `cp_presentation`

---

### P1 — Output Control Manager ✅ Complete

- [x] **Output routing panel** (`OutputManager.jsx`) — dedicated "Outputs" tab in the nav with:
  - [x] 2-column grid of output cards, each showing a slide preview thumbnail (SlideRenderer at scale)
  - [x] Role badge (Program, Stage, Announcement, Background, Confidence) with role-specific colors
  - [x] Display label (from named label or "Display N" fallback)
  - [x] Live indicator badge on active outputs
  - [x] "Send Preview" — pushes current preview slide to that output in one click
  - [x] "Sync Program" — copies live program slide to that output
  - [x] Inline close button per output
- [x] **Add output section** — role + display selectors + Open button directly in the panel
- [x] **Named connection channels** — display label editor; labels keyed by display index and persisted in `settings.json`
- [x] **Routing presets** — save current output layout by name; load (closes current, recreates) or delete presets; persisted in `settings.json`
- [x] **AppContext actions**: `saveSettings`, `updateDisplayLabel`, `saveRoutingPreset`, `loadRoutingPreset`, `deleteRoutingPreset`
- [x] `FILE_DEFAULTS.settings` in `electron/main.js` updated to include `displayLabels: {}` and `routingPresets: []`

---

### P2 — Social Media Streaming ✅ Complete

- [x] **RTMP output** — FFmpeg-based RTMP encoder: stream window is captured via Electron `desktopCapturer` + `getDisplayMedia`, encoded by `MediaRecorder` (WebM/H.264), piped via IPC to a `child_process` FFmpeg subprocess → FLV/RTMP
- [x] **Platform stream key management** — stream keys stored per destination in `settings.rtmpDestinations`; keys stored locally, never logged or uploaded
- [x] **Platform presets** — pre-filled RTMP URLs for:
  - [x] Facebook Live (`rtmps://live-api-s.facebook.com:443/rtmp/`)
  - [x] YouTube Live (`rtmp://a.rtmp.youtube.com/live2/`)
  - [x] Instagram Live (`rtmp://live-upload.instagram.com:80/rtmp/` — no official public API; documented as workaround)
  - [x] Custom RTMP endpoint (user-editable URL + key)
- [x] **Stream health indicator** — live duration timer (MM:SS) and per-stream bitrate badge while streaming
- [x] **Multi-destination** — each destination has an enable/disable checkbox; all enabled destinations receive the same encoded stream simultaneously
- [x] **FFmpeg detection** — checked at startup via `check-ffmpeg` IPC; if not found, shows install instructions (`brew install ffmpeg` / `winget install ffmpeg`) and disables the Go Live button
- [x] **Fallback guidance** — FFmpeg not found banner shows OBS RTMP forwarder as alternative
- [x] **`electron/main.js`**: `rtmpProcesses` Map, `findFFmpegPath()`, `stopRtmpProcess()`, `setDisplayMediaRequestHandler` for auto-approving window capture, IPC handlers: `check-ffmpeg`, `get-stream-sources`, `set-rtmp-source`, `start-rtmp`, `stop-rtmp`, `rtmp-chunk`
- [x] **`electron/preload.js`**: exposes `checkFfmpeg`, `getStreamSources`, `setRtmpSource`, `startRtmp`, `stopRtmp`, `sendRtmpChunk`, `onRtmpStatus`

---

### P3 — Song Internet Integration ✅ Complete

Allow operators to search for songs by title or artist from public worship databases and import them directly into the library — no manual lyrics entry.

- [x] **Song Import modal** (`SongImportModal.jsx`) — three-tab import UI accessible via "↓ Import" button in the Songs panel header:
  - [x] **Planning Center tab** — search PCO song library by title/artist; select song → select arrangement → parse chord chart into slides; live preview pane; title/author editable before import
  - [x] **OpenLyrics XML tab** — file picker for `.xml` files; browser `FileReader` + `DOMParser` parse `<verse>` nodes into typed slides; supports v1/v2/c/b/e name conventions
  - [x] **Paste Lyrics tab** — text area with real-time slide parsing as-you-type; title, author, key, tempo metadata fields; `[Section]` marker format documented inline
- [x] **Lyrics parsers** — `parseSectionedText()` handles PCO chord charts and plain pasted text; `parseOpenLyricsXml()` handles OpenLyrics XML; both map section names to typed slides (verse / chorus / bridge / intro / ending / tag / prechorus)
- [x] **Import flow** — `addSong()` from AppContext called with full song model including default background, textColor, fontSize, fontFamily; imported song immediately appears in library
- [x] **Planning Center API integration** (`electron/main.js`) — `search-pco-songs` and `fetch-pco-arrangements` IPC handlers using Basic auth; exposed via preload
- [x] **PCO credential management** — App ID + Secret stored in `settings.pcoAppId` / `settings.pcoSecret`; new "Planning Center" section in `SettingsPanel.jsx` with masked secret field and save confirmation
- [x] **`FILE_DEFAULTS.settings`** updated to include `pcoAppId: ''` and `pcoSecret: ''`
- [x] **README** updated with Song Import section covering all three import paths, PCO setup, and troubleshooting
- [x] **HelpPanel** updated with "Song Import" section explaining all three tabs

---

### P4 — AI Bible Verse Lookup During Live Preaching ✅ Complete

Surface relevant scripture references in real time as the pastor preaches, so the presenter can instantly pull up or display verses without interrupting the service flow.

- [x] **`src/utils/referenceDetector.js`** — rule-based Bible reference parser:
  - [x] All 66 canonical books with abbreviations and spoken-form variants (Gen, Exo, 1 Cor, etc.)
  - [x] Spoken ordinal normalization: "First Corinthians" → "1 Corinthians", "Second Timothy" → "2 Timothy"
  - [x] Standard format: `Book N:N`, `Book N:N-N` (with colon)
  - [x] Space-separated: `Book N N` (speech API sometimes omits colons)
  - [x] Explicit keywords: `Book chapter N verse N`
  - [x] Chapter-only: `Romans 8`, `Psalm 23`
  - [x] Deduplication — same reference only appears once in results
- [x] **`src/components/SermonAssistPanel.jsx`** — 🎙 Sermon tab panel:
  - [x] **Web Speech API** — `continuous: true`, `interimResults: true`; auto-restarts after silence timeout; mic error handling (not-allowed, service-not-allowed)
  - [x] **Rolling transcript** — final results accumulated (capped at 3000 chars); interim text displayed in italic
  - [x] **Real-time reference detection** — `detectReferences()` called on every transcript update; new refs merged (dedup); each card has ＋ Add to Schedule and LT (lower-third) buttons
  - [x] **AI suggestions** — "✦ Suggest Verses from Sermon" button calls `suggestVerses` IPC with transcript; result shows reference + reason; only re-calls if transcript changed since last call
  - [x] **Privacy notice** — visible inline; opt-in mic capture; transcript sent to Anthropic only on explicit button click; no audio stored
  - [x] **No-API-key fallback** — reference detection works without any key; AI section shows informational prompt pointing to Settings
- [x] **IPC: `suggest-verses`** (`electron/main.js`) — calls `POST api.anthropic.com/v1/messages` with `claude-haiku-4-5-20251001`; parses JSON array from response; handles markdown code-fence stripping; surfaces errors to renderer
- [x] **Preload: `suggestVerses`** (`electron/preload.js`) — exposes IPC to renderer
- [x] **`FILE_DEFAULTS.settings`** updated to include `anthropicApiKey: ''`
- [x] **SettingsPanel** — new "AI (Sermon Assistant)" section with masked API key field, show/hide, save + confirmation; note pointing to `console.anthropic.com`
- [x] **Toolbar** — new 🎙 Sermon nav tab
- [x] **MainLayout** — renders `<SermonAssistPanel />` when `activeView === 'sermon'`
- [x] **HelpPanel** — new "Sermon Assistant" section explaining the full workflow
- [x] **README** — P4 documented with setup and usage
- [x] **PROJECT_TRACKER.md** — P4 marked complete

---

### P5 — Test Coverage

- [ ] AppContext domain tests: `goLive` transitions, `toggleBlackout/Clear`, `removeFromSchedule` edge cases, `nextSlide`/`prevSlide` at boundaries
- [ ] Electron IPC smoke test: slide/blackout/clear relay to output windows (including stream window)
- [ ] Multi-output routing tests: `goLiveOutput`, `goLiveAll`, `liveRoleSlides` resolution

---

### P6 — Song Editor Depth & Web Lyrics Import

#### Genius.com Lyrics Integration

Pull professional lyrics directly from Genius into the import modal, giving operators a fast path to any contemporary song without manual typing.

- [ ] **Genius API credential management** — add Genius Client Access Token field to `SettingsPanel` under a new "Lyrics Search" section; token stored in `settings.geniusApiKey`; link to `genius.com/api-clients`
- [ ] **`search-genius-songs` IPC handler** (`electron/main.js`) — `GET https://api.genius.com/search?q=...` with `Authorization: Bearer <token>`; returns hit list (title, artist, Genius song ID, thumbnail URL)
- [ ] **`fetch-genius-lyrics` IPC handler** — fetches the song's web page URL from the hits, then scrapes the lyrics container (`data-lyrics-container` divs) via Electron's `net.fetch`; strips HTML tags; returns plain text
- [ ] **Genius tab in `SongImportModal`** — search input + results list (title, artist, album art thumbnail); on selection, fetch and parse lyrics → auto-detect `[Verse]` / `[Chorus]` / `[Bridge]` / `[Pre-Chorus]` section markers that Genius embeds in its lyrics → populate slide preview; import button calls `addSong()` with full metadata (title, artist, key left blank, tags: `['contemporary']`)
- [ ] **Fallback scraping notice** — Genius does not expose lyrics via their public API; scraping is a grey area. Display a one-time notice: "Lyrics sourced from Genius are for internal, non-commercial church use only. Ensure you hold a valid CCLI license for any songs displayed publicly."
- [ ] **preload exposure**: `searchGeniusSongs`, `fetchGeniusLyrics`

#### Editor Improvements

- [ ] Richer formatting controls — text alignment (left / center / right) per slide; style presets (large title, subtitle, body)
- [ ] Duplicate / reorder slides within a song in the editor (drag-to-reorder within `SongEditorModal`)
- [ ] Chord chart tab — display chord chart alongside lyrics in the editor; stored as `slide.chords` string; visible in Stage Display
- [ ] Metadata fields — BPM number input, CCLI number field, copyright year, tags autocomplete

---

### P7 — Session Reliability

- [ ] Undo/redo for critical edits (songs, slides, schedule)
- [ ] Crash-safe recovery — persist in-progress session snapshot; restore on unclean exit
- [ ] Remember preferred presentation display in `settings.json`; restore on startup
- [ ] Graceful handling when a previously used display is no longer connected

---

### P8 — Media Pipeline & Background Editor

#### Background Color Editor

- [ ] **Solid color picker** — replace the current plain hex input in `SongEditorModal` / `MediaPanel` with a full HSL color wheel + hex field + opacity slider; preview updates live on the slide thumbnail
- [ ] **Gradient editor** — 2-stop linear gradient with angle control (0–360°), color picker per stop, stop position sliders; result stored as `{ type: 'gradient', stops: [{color, position}], angle }` in slide/song background
- [ ] **Preset palette** — 8–12 curated background presets (dark navy, deep purple, forest green, warm amber, etc.) for one-click application; presets appear in both `SongEditorModal` and `AnnouncementPanel`
- [ ] **Per-slide background override** — allow individual slides within a song to carry their own background color/gradient, independent of the song-level default; toggle between "inherit" and "custom" per slide
- [ ] **Global background broadcast** — a separate "Background" output role already exists; add a quick-pick color/gradient panel in `OutputManager` to push a solid color to all background-role outputs without needing a slide

#### Video Pipeline

- [ ] Video background lifecycle controls (play/pause/loop, visible progress bar in operator view)
- [ ] Imported video persistence — copy video to app data directory on import instead of using a blob URL; path stored in `settings.mediaLibrary[]`
- [ ] Transition effects between slide backgrounds (cross-fade, cut, zoom)

---

### P9 — Release & Distribution

- [ ] Define release pipeline for macOS/Windows/Linux installers
- [ ] Church-facing setup guide and service-day runbook
- [ ] Projector/stage monitor operations guide
- [ ] Troubleshooting and backup/restore procedures
- [ ] `CONTRIBUTING.md` for volunteer contributors

---

## Known Gaps & Risks

| Area | Risk |
|---|---|
| Default data drift | Starter songs exist in both `electron/defaultData.js` and `src/data/defaultSongs.js` — divergence risk |
| App identity | `package.json` still uses `easyworship-clone`; data directory on disk uses old name |
| Video import persistence | Blob URLs die on restart; no persistence layer for imported video assets |
| Test coverage | Schedule/live transitions still under-tested vs. production risk |
| Camera permissions | macOS requires camera usage description in `Info.plist` for production builds; works in dev mode |
| Stream window focus | Stream window is not fullscreen by default; user must screen-share or manually fullscreen for streaming |
| RTMP / FFmpeg | Native FFmpeg binaries in Electron require platform-specific bundling and code signing — adds build complexity |
| Instagram Live | No public RTMP API; streaming requires a third-party RTMP bridge or OBS workaround |
| AI transcription privacy | On-device Whisper requires a native Electron addon (build/sign complexity); remote APIs send audio to third parties |
| CCLI licensing | SongSelect song import requires a valid CCLI license — app cannot import CCLI-protected lyrics without one |
| Genius lyrics scraping | Genius does not expose lyrics via their public API; the planned integration scrapes the HTML page. Terms of service restrict automated access — usage should be limited to internal, non-commercial church use with a valid CCLI license |
| Background color model | Current background shape is `{ type, value }` (color) or `{ type, stops, angle }` (gradient); per-slide overrides require a schema change and migration in `electron/validators.js` |

---

## Tracking

- **Last updated:** 2026-04-15
- **Current focus:** P5 test coverage
- **Next up:** P6 song editor depth
- **Status:** Active development — P0 + P1 + P2 + P3 + P4 complete

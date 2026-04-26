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
- Sermon assist state (transcript, interim, references, suggestions, listening/suggesting flags)
- Settings overlay visibility (`settingsOpen`)
- Schedule undo/redo history (ref-based, up to 20 steps)
- Crash recovery snapshot detection (`recoveryData`)

Actions: song CRUD, schedule lifecycle (`addToSchedule`, `removeFromSchedule`, `reorderSchedule`, `clearSchedule` — all push to undo history), `undoSchedule`, `redoSchedule`, `restoreRecovery`, slide navigation, `goLiveProgram`, `goLiveStage`, `goLiveOutput`, `goLiveAll`, blackout/clear toggles, output window lifecycle, `openStream` / `closeStream`, `pushLowerThird`, `sendStreamConfig`.

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
| `StreamPanel` | 📡 Stream | Sermon Assistant (mic, transcript, AI verse suggestions, → LT), camera source, lower-third, social streaming |
| `OutputManager` | 📺 Outputs | Output routing panel (previews, labels, presets) |
| `SettingsPanel` | ⚙ Settings (floating overlay) | 3-tab panel: API Keys / Social Media / Devices; opens as a non-blocking floating dock over the main UI |
| `HelpPanel` | ❔ Help | Keyboard shortcut reference |
| `SongImportModal` | — | Song import modal (PCO, OpenLyrics, paste) |

**Settings is a floating overlay** — triggered by the ⚙ Settings toolbar button; renders at `position: fixed` (z-index 300) with a semi-transparent backdrop. Clicking outside dismisses it without affecting any other panel.

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
- [x] **`src/components/SermonAssistPanel.jsx`** — 🎙 Sermon tab panel (full mic + AI control hub):
  - [x] **Web Speech API** — `continuous: true`, `interimResults: true`; auto-restarts after silence timeout; mic error handling (not-allowed, service-not-allowed)
  - [x] **Rolling transcript** — final results accumulated (capped at 4000 chars); interim text displayed in italic
  - [x] **Mic level meter** — 14-bar VU visualization via `AudioContext` + `AnalyserNode`; green/yellow/red thresholds; "No audio detected" warning when level < 3 while listening
  - [x] **Mic device selector** — shown when multiple audio inputs available; switching while listening restarts level meter on new device
  - [x] **Auto-suggest** — 45s debounce after speech, min 40 new words since last call; AUTO ON/OFF toggle badge; `lastSuggestWordsRef` guards against stale closure re-fires
  - [x] **Manual trigger** — "✦ Suggest Now" button always available for immediate request
  - [x] **Real-time reference detection** — `detectReferences()` called on every transcript update; new refs merged (dedup); each card has ＋ Add to Schedule and LT buttons
  - [x] **Privacy notice** — opt-in mic; transcript sent to Anthropic only when suggestions are generated; no audio stored
  - [x] **No-API-key fallback** — reference detection works without any key; AI section prompts to Settings
- [x] **Shared sermon state in `AppContext`** — `sermonTranscript`, `sermonInterim`, `sermonReferences`, `sermonSuggestions`, `sermonListening`, `sermonSuggesting`, `clearSermon` lifted to context so both `SermonAssistPanel` and `StreamPanel` read from the same source
- [x] **`StreamPanel` Sermon Assist section** — collapsible "🎙 Sermon Assist" section in the stream panel:
  - [x] Mic status indicator (green pulsing dot + MIC ON badge when listening)
  - [x] Word count + listening status line
  - [x] Last 3 detected references with "→ LT" button (sends immediately as lower-third AND pre-fills the LT input)
  - [x] Top 3 AI suggestions (reference + reason) with "→ LT" button
  - [x] Link to full 🎙 Sermon tab for mic control
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

### P5 — Test Coverage ✅ Complete

- [x] AppContext domain tests: `goLive` transitions, `toggleBlackout/Clear`, `removeFromSchedule` edge cases, `nextSlide`/`prevSlide` at boundaries
- [x] Electron IPC smoke test: slide/blackout/clear relay to output windows (including stream window) — `src/__tests__/ipcRelay.test.js`
- [x] Multi-output routing tests: `goLiveOutput`, `goLiveAll`, `liveRoleSlides` resolution, `sendOutputState` precedence — `src/__tests__/multiOutput.test.js`

---

### P6 — Song Editor Depth & Web Lyrics Import ✅ Complete

#### Genius.com Lyrics Integration

Pull professional lyrics directly from Genius into the import modal, giving operators a fast path to any contemporary song without manual typing.

- [x] **Genius API credential management** — Genius Client Access Token field added to `SettingsPanel` under "Lyrics Search" section; token stored in `settings.geniusApiKey`; link to `genius.com/api-clients`; CCLI notice in orange
- [x] **`search-genius-songs` IPC handler** (`electron/main.js`) — `GET https://api.genius.com/search?q=...` with `Authorization: Bearer <token>`; returns hit list (title, artist, Genius song ID, thumbnail URL)
- [x] **`fetch-genius-lyrics` IPC handler** — fetches the song's web page via Electron `net.fetch`; scrapes `data-lyrics-container` divs; strips HTML tags and decodes entities; returns plain text
- [x] **Genius tab in `SongImportModal`** — search input + results list (title, artist, album art thumbnail); on selection, fetches lyrics and parses with `parseSectionedText()`; slide preview pane; editable title/artist; import button calls `addSong()` with `tags: ['contemporary']`
- [x] **CCLI scraping notice** — dismissable orange banner on the Genius tab; also shown in Settings next to the token field
- [x] **preload exposure**: `searchGeniusSongs`, `fetchGeniusLyrics`
- [x] **No-key fallback** — Genius tab shows "configure in Settings → Lyrics Search" when no token is set

#### Editor Improvements

- [x] **Text alignment per slide** — L / C / R toggle buttons in slide header; `slide.textAlign` field stored on each slide; `SlideRenderer` respects alignment for both preview and live output
- [x] **Style presets** — Large Title (72px Georgia), Subtitle (52px), Body (36px), Compact (28px Inter) in the Appearance tab
- [x] **Chord chart tab** — 🎸 Chords sub-tab in slide editor; `slide.chords` string stored per slide; chord chart rendered in `StageView` in monospace below lyrics (not visible to audience)
- [x] **Metadata tab** — dedicated "📋 Metadata" tab in `SongEditorModal`: BPM (number input), CCLI song number, copyright year; BPM displayed on Stage Display next to Tempo
- [x] **Tags autocomplete** — preset tags + free-text custom tag input (Enter or + to add); custom tags shown as dismissable chips
- [x] **HelpPanel** updated with "Genius Lyrics Import" and "Song Editor" sections
- [x] **README.md** updated with Genius Lyrics Integration section, Song Editor section, and troubleshooting entries

---

### P7 — Session Reliability ✅ Complete

#### UX Architecture Improvements (delivered with P7)

- [x] **Sermon Assistant unified into Stream panel** — `SermonAssistPanel` removed as a separate tab; full sermon assist (mic, Web Speech API, VU level meter, transcript, reference detection, AI suggestions, → LT buttons) now lives inside `StreamPanel` as the primary feature. No need to switch tabs between streaming and sermon control.
- [x] **Settings as floating overlay** — ⚙ Settings is now a toolbar toggle button (not a nav tab). Clicking it opens `SettingsPanel` as a fixed-position dock (z-index 300) over the right side of the UI. Clicking the backdrop or ✕ dismisses it. All other panels (Stream, Schedule, PreviewArea) remain fully interactive while Settings is open.
- [x] **Settings 3-tab layout** — `SettingsPanel` reorganized into: `🔑 API Keys` (YouVersion, Genius, Planning Center, Anthropic), `📡 Social Media` (RTMP destinations), `🎙 Devices` (microphone selection + live VU meter + test, camera selection, presentation font/size defaults).
- [x] **Camera device picker moved to Settings → Devices** — `StreamPanel` no longer has a camera picker; it reads `settings.preferredCameraId` directly.
- [x] **Microphone management in Settings → Devices** — grant mic access, select preferred mic, test with live 20-bar level meter. The `DevicesTab` also explains that Web Speech API always uses the system default mic (OS limitation).
- [x] **Help panel updated** — Sermon Assistant, Streaming, and Settings sections updated to match new unified architecture; mic and camera now documented under Settings → Devices.

#### Session Reliability

- [x] **Schedule undo/redo** — `undoSchedule` / `redoSchedule` actions in `AppContext`; `addToSchedule`, `removeFromSchedule`, `reorderSchedule`, `clearSchedule` all push to a ref-based history stack (up to 20 steps). `Cmd/Ctrl+Z` undoes, `Cmd/Ctrl+Shift+Z` / `Ctrl+Y` redoes via `useKeyboardShortcuts`.
- [x] **Crash-safe recovery** — autosave writes `cp_recovery_snapshot` to `localStorage` every 60 seconds (uses stable refs, not closure captures). On next startup, the load `useEffect` compares the snapshot to the last saved state; if they differ, `recoveryData` is set and a banner appears at the bottom of the main UI offering Restore / Dismiss. `restoreRecovery(snap)` applies the snapshot and clears the banner.
- [x] **Preferred presentation display persisted** — Toolbar reads `settings.preferredDisplayIndex` on mount; if the display is connected it is used immediately. Selecting a display via the picker saves `preferredDisplayIndex` to `settings.json`.
- [x] **Graceful fallback when preferred display disconnected** — if `preferredDisplayIndex` refers to a display that is no longer enumerated, Toolbar silently falls back to the first non-primary display (or primary if only one exists). No error is shown; the user can re-select via the chevron picker.

---

### P8 — Media Pipeline & Background Editor ✅ Complete

#### Background Color Editor

- [x] **`BackgroundPicker` component** (`src/components/BackgroundPicker.jsx`) — reusable solid/gradient picker with:
  - 12-swatch solid preset palette (Deep Navy → Charcoal) + native `<input type="color">` for custom hex
  - 8 gradient presets (Blue Gradient, Purple Night, Forest Dawn, Golden Hour, Sunset Red, Deep Space, Ocean Depth, Verdant) displayed as 2-col swatch grid
  - Custom gradient builder: two color stops + angle slider (0–360°) with live preview strip; generates CSS `linear-gradient()`
  - `compact` prop for tight per-slide contexts
  - `bgToCss(bg)` exported helper — handles `{ type: 'color' }`, `{ type: 'gradient', value }` (legacy CSS string), and `{ type: 'gradient', angle, stops }` (structured)
- [x] **`SongEditorModal` Appearance tab** — hex color input replaced with `BackgroundPicker`; live preview uses `bgToCss()`; saves `background` object (not just `{ type: 'color' }`)
- [x] **Per-slide background override** — new `🎨 BG` sub-tab in the slide editor (alongside 📝 Lyrics and 🎸 Chords); shows `BackgroundPicker compact` for the selected slide; slide list shows amber `●` indicator when a slide has an override; "Clear override" button restores inheritance; mini preview shows the effective background (slide override → song default)
- [x] **`SlideRenderer`** updated — resolves `slide.background || item.background` (per-slide override takes precedence); `bgToCss()` imported; `videoRef`, `videoLoop`, `videoBrightness` props added for external video lifecycle control
- [x] **`AnnouncementPanel`** — fully redesigned with `BackgroundPicker`, text color swatches, font size slider, and live 16:9 mini preview before adding to schedule
- [x] **Global background broadcast** (`OutputManager`) — `BackgroundBroadcastSection` component: collapsible section with `BackgroundPicker compact`; "Push to Background Outputs" button builds a blank slide carrying the chosen background and sends it to every open `background`-role output window + the `background` role slot

#### Video Pipeline

- [x] **Video file persistence (Electron)** — `copy-media-file` IPC handler in `electron/main.js` copies the imported file to `<userData>/media/` with a UUID filename; `MediaPanel` calls `window.electronAPI.copyMediaFile(file.path)` in Electron mode and receives a persistent `file://` path; falls back to blob URL in browser or on IPC error
- [x] **`videoRef` / `videoLoop` / `videoBrightness` props** on `SlideRenderer` — callers can attach a ref to the underlying `<video>` element and control playback externally
- [ ] Video background lifecycle controls in operator PreviewArea (play/pause toggle UI) — deferred to P8.1
- [ ] Transition effects between slide backgrounds (cross-fade, cut, zoom) — deferred to P8.2

#### Settings UX (delivered alongside P8)

- [x] **`❔ Help` tab in Settings** — `SettingsPanel` gains a fourth tab that renders `<HelpPanel inline />` with full search; the Settings floating window becomes a unified control + help reference panel
- [x] **`HelpPanel` `inline` prop** — when `inline={true}` the component fills its parent container without the outer sidebar wrapper or title heading

---

### P8.1 — UX improvements (delivered post-P8)

- [x] **FloatingWindow opens centered** — initial position computed as `(window.innerWidth - w) / 2`, `(window.innerHeight - h) / 2` instead of top-right corner
- [x] **Help opens floating** — `❔ Help` nav tab replaced with a right-side Help button that opens the Settings floating window with the Help tab pre-selected; `SettingsPanel` accepts `initialTab` prop synced via `useEffect`
- [x] **Item background editor in PreviewArea** — collapsible `BackgroundPicker` below the slide counter allows changing the background of any selected schedule item on the fly; powered by new `updateScheduleItem` AppContext action
- [x] **Image backgrounds in BackgroundPicker** — third `🖼 Image` tab with file picker (Electron-persistent via `copyMediaFile`), thumbnail preview, and Dim slider; `bgToCss()` updated to handle `{ type: 'image', value, brightness }`
- [x] **Video favorites in MediaPanel** — 4 persistent favorite slots stored in `settings.videoFavorites`; slots show name + ▶ play / 🔄 reassign / ✕ clear when filled; empty slots prompt to assign; one-off import still available; `videoFavorites: []` added to `FILE_DEFAULTS.settings`

---

### P9 — Release & Distribution ✅ Complete

- [x] **GitHub Actions CI** — `ci.yml` runs all tests on every push and pull request to `main` (Node 18 + 20 matrix)
- [x] **GitHub Actions release pipeline** — `release.yml` triggers on `v*` tags; builds macOS (arm64 + x64 DMG + zip), Windows (x64 NSIS installer), and Linux (x64 AppImage + deb) in parallel; creates a GitHub Release with all installers attached
- [x] **`electron-builder` config hardened** — DMG layout, NSIS installer options (directory picker, desktop shortcut), Linux deb target, macOS Hardened Runtime + entitlements, GitHub publish provider, code-signing environment variable stubs for CI
- [x] **macOS entitlements** — `build-resources/entitlements.mac.plist` with camera, microphone, audio input, network client, and file read/write entitlements for Hardened Runtime
- [x] **`build-resources/`** — icon placeholder README with generation commands; icons gitignored with instructions
- [x] **`CHANGELOG.md`** — Keep a Changelog format; `[Unreleased]` section pre-populated with all recent changes; `[1.0.0]` section with full feature list
- [x] **Setup guide** (`docs/setup-guide.md`) — installation on macOS/Windows/Linux, first launch, display setup, API key configuration (Genius, PCO, YouVersion, Anthropic), FFmpeg install, data locations, upgrade from legacy build
- [x] **Service-day runbook** (`docs/service-day-runbook.md`) — Thursday–Saturday prep checklist, 60-minute pre-service setup checklist, during-service operation, after-service teardown, quick reference keyboard shortcut table
- [x] **Display setup guide** (`docs/display-setup.md`) — hardware overview, connecting displays, presentation window, Stage Display (mirror vs. independent mode), Output Manager routing, named labels, routing presets, background outputs, browser mode limitations
- [x] **Troubleshooting guide** (`docs/troubleshooting.md`) — installation, presentation/output, songs/library, Bible search, streaming, Sermon Assistant, data persistence; developer console instructions; GitHub issue link
- [x] **Backup & Restore guide** (`docs/backup-restore.md`) — data directory locations, manual backup (macOS/Windows/Linux), recommended schedule, cloud sync with symlinks, full restore, partial restore (recovering deleted songs), automatic corruption recovery, JSON schema reference
- [x] **`CONTRIBUTING.md`** — project structure, running tests, code conventions, change workflow, bug report template, release process, code-signing secret reference table
- [x] **README updated** — Docs table linking all guides, updated Build an Installer section with automated release instructions and icon requirements

---

### P10 — Output System Stability & Unified Flow ✅ Complete

This milestone corrects architectural drift introduced during YouTube and output-control work. The goal is a clean, unified program flow where **all output types obey a single source of truth (the main program)** and YouTube/video controls are addons — not special branches of the rendering pipeline.

---

#### Background: What the Architecture Must Look Like

```
Operator selects slide (any type: text, video, YouTube, image)
  └─► Go Live  ─────────────────────────────────────────────────►  liveProgram
                                                                        │
                              ┌─────────────────────────────────────────┘
                              ▼
                     sendOutputState()
                        │        │        │        │
                     OutputView OutputView OutputView ...
                     (Program)  (Stage)  (Confidence)
                        │
                   SlideRenderer
                   renders background type:
                     color / gradient / image / video / youtube
                        │
              (youtube background only)
              YT.Player addon — plays/pauses/mutes based on operator commands
```

Key invariants:
1. **Go Live always works.** If no output windows are open, one is auto-created on the best available display.
2. **Every slide type flows uniformly.** Text → YouTube → video → image transitions are seamless; no special "mode" is entered.
3. **OutputView is type-agnostic.** The only YouTube-specific logic it needs is the `window.YT.Player` lifecycle (required because Electron's `file://` origin blocks raw postMessage to cross-origin iframes). This is transparent background plumbing, not a special rendering path.
4. **YouTube controls and video controls are operator addons.** They appear in the floating controller / PreviewArea when the relevant background type is live, but do not alter how the slide flows through the system.
5. **The confidence monitor shows current + next slide side-by-side.** This requires `nextSlide` to be correctly propagated in every state update path.

---

#### Issues Found (code review 2026-04-19)

| # | Symptom | Root cause |
|---|---|---|
| **I1** | Go Live does nothing visible in Electron | Toolbar now calls `goLive(currentSlide)` which sends via `sendOutputState` to `outputWindows`. But if no output windows are configured (user hasn't opened any via Output Manager), `sendOutputState` iterates zero windows — nothing appears. The old "open presentationWindow on a display" path was removed but no fallback was added. |
| **I2** | OutputView couples slide rendering to YouTube type | `currentYtId` derived state and the YT player lifecycle effects make `OutputView` YouTube-aware. The `isStaleYt` check (which blocks any YouTube-background slide on startup) is a blunt-instrument workaround that also prevents legitimate slide restoration. |
| **I3** | YouTube → text → video transitions may stall | The YT player destroy/create cycle runs inside a `useEffect` keyed on `currentYtId`. If a slide with YouTube background is replaced by another slide type, the effect cleanup should destroy the player and `SlideRenderer` renders the new type. In practice, race conditions between the YT API script loading and slide state changes can cause the output window to show a blank frame. |
| **I4** | Confidence monitor split screen not verifiable | `ConfidencePanel` code exists and is correct in structure, but `nextSlide` may not reach the output window. The `resolveSlideForRole` function sets `slide` from the payload, while `nextSlide` is read directly from `payload.nextSlide`. If `nextSlide` is missing from the `receive-output` IPC payload, the right panel will always be empty. |
| **I5** | No video background playback controls | `SlideRenderer` renders `<video autoPlay muted loop>` for video backgrounds. The `videoRef` prop exists but nothing uses it. No operator controls exist to pause, seek, or adjust volume for video backgrounds. |
| **I6** | `goLiveAll` does not update `liveProgram` | `goLiveAll` (used by PreviewArea "All Outputs" button) sends to all output windows but never calls `setLiveProgram(slide)`. This means `liveProgram` (used by the YouTube floating controller and anywhere that checks `liveProgram?.item?.background`) stays stale. |

---

#### Fix Plan

##### F1 — Go Live auto-creates output window when none exist (fixes I1)

**File:** `src/components/Toolbar.jsx`

In `handleGoLive`, if `outputWindows.length === 0`, before calling `goLive()`, call `createOutputWindow({ role: 'presentation', displayIdx: <best display>, title: 'Program' })`. "Best display" = first non-primary display index, falling back to 0.

After creating the window, there is a brief delay before it is ready to receive slides. Use a short timeout (300ms) before calling `goLive()`, or listen for the window-open acknowledgement.

In **Electron**, the `createOutputWindow` call is async (IPC). Chain: `await createOutputWindow(...)` then `goLive(slide)`.
In **browser** mode, `createOutputWindow` opens a new tab synchronously; calling `goLive` immediately is fine because BroadcastChannel delivery is async anyway.

```
Toolbar.handleGoLive():
  if outputWindows.length === 0:
    displays = await window.electronAPI.getDisplays() (cache from state)
    bestDisplay = displays.find(!isPrimary) ?? displays[0]
    await createOutputWindow({ role: 'presentation', displayIdx: bestDisplay.index, title: 'Program' })
    await sleep(300ms)   // let the window mount and subscribe
  goLive({ ...currentSlide, item: currentItem })
```

Add `createOutputWindow` and `displays` to Toolbar's `useApp()` destructuring. Keep a local `displays` state loaded once on mount.

##### F2 — Remove `isStaleYt` check; fix YT startup correctly (fixes I2, I3)

**File:** `src/components/OutputView.jsx`

The `isStaleYt` check:
```js
const isStaleYt = startSlide?.item?.background?.type === 'youtube';
setSlide(isStaleYt ? null : startSlide);  // ← blocks ALL YouTube slides on startup
```
…was added to prevent autoplay before Go Live. But it's wrong: it prevents YouTube slides from being shown even when the operator deliberately restores state (e.g., after a crash).

**Correct fix for startup autoplay:** The YT player creation already handles this. The player starts muted (`mute: 1` in `playerVars`) — the operator must explicitly unmute. No slide-blocking is needed. Remove `isStaleYt` and restore `setSlide(startSlide)`.

The `currentYtId` effect should remain — it is the mechanism that creates/destroys the `YT.Player` for YouTube-background slides. But it must be robust against the case where `window.YT` isn't available yet (already handled by `registerYtReadyCallback`).

##### F3 — Verify and fix `nextSlide` delivery to confidence monitor (fixes I4)

**File:** `src/store/AppContext.jsx`, `src/components/OutputView.jsx`

Audit `sendOutputState` to confirm `nextSlide: liveNextSlide` is included in the IPC payload sent to output windows. Currently `computeNextSlidePayload` is used — verify it includes `nextSlide`.

Also audit the Electron IPC path: `window.electronAPI.sendOutputState(payload)` → `main.js` `send-output-state` → `receive-output`. Confirm the payload is forwarded verbatim (not filtered).

In `OutputView`, confirm that the `data.nextSlide` field in the `receive-output` handler is used to set `nextSlide` state.

##### F4 — Fix `goLiveAll` to update `liveProgram` (fixes I6)

**File:** `src/store/AppContext.jsx`

`goLiveAll` sends to all output windows but leaves `liveProgram = null`. Add:
```js
setLiveProgram(slide);
setIsLive(true);
setIsBlackout(false);
setIsClear(false);
```
at the top of `goLiveAll` (same as `goLiveProgram` does).

##### F5 — Video background playback controls (fixes I5)

**File:** `src/components/MainLayout.jsx` (new `VideoController` component, mirroring `YouTubeController`)

When `liveProgram?.item?.background?.type === 'video'` AND `activeView !== 'media'`, show a floating controller similar to the YouTube one. It needs to control the `<video>` element rendered inside the output window.

Since the video element lives in a separate Electron window, we need an IPC command channel similar to `send-youtube-control`. Add:
- IPC: `send-video-control` (commands: `play`, `pause`, `setVolume`, `seek`)  
- `electron/main.js`: relay to all `outputWindows` as `receive-video-control`
- `electron/preload.js`: expose `sendVideoControl`, `onReceiveVideoControl`
- `OutputView.jsx`: listen for `receive-video-control` and call methods on a `videoRef` attached to the `<video>` in `SlideRenderer`
- `SlideRenderer.jsx`: the existing `videoRef` prop already supports external control — use it
- `MainLayout.jsx`: `VideoController` floating panel with play/pause and volume slider

In browser mode, relay via BroadcastChannel `video-control` messages (same pattern as `youtube-control`).

---

#### Implementation Order

1. **F1** (Go Live auto-create) — highest user impact, unblocks everything else
2. **F2** (remove `isStaleYt`) — simple one-line fix, removes incorrect guard
3. **F3** (confidence monitor nextSlide audit) — verify then fix
4. **F4** (fix `goLiveAll` liveProgram) — simple addition to AppContext
5. **F5** (video controls) — new feature, implement last

- [x] F1: Toolbar auto-creates presentation output when Go Live clicked with no outputs open
- [x] F2: Remove `isStaleYt` guard from OutputView startup; YouTube slides now restore correctly on startup
- [x] F3: Audited `nextSlide` propagation — `sendOutputState` carries `liveNextSlide`, `receive-output` sets `nextSlide` state, `ConfidencePanel` renders it; flow is correct by design
- [x] F4: `goLiveAll` already calls `setLiveProgram` + `setIsLive` + `setIsBlackout(false)` + `setIsClear(false)` — no fix needed
- [x] F5: Video background playback controls — IPC channel `send-video-control` / `receive-video-control`, floating `VideoController` in `MainLayout.jsx`, `videoRef` wired through `SlideRenderer` in `OutputView`

---

---

### P11 — Live Stream Recording 🔲 Planned

This milestone adds an in-app recording module that captures the stream window to memory in real time, embeds chapter markers on every Go Live event, and exports to an edit-friendly format. The goal is a self-contained record of every service that a video editor can open immediately — no screen-capture software required.

---

#### Goal & Design Principles

1. **Zero extra hardware.** Reuse the same display-capture source already open for RTMP streaming (`captureStreamRef`). No second `getDisplayMedia` call.
2. **Non-destructive to streaming.** Recording runs concurrently with RTMP output. Stopping a recording does not affect the live stream.
3. **Edit-friendly output.** Chunks are stored as `Blob[]` in memory during the service. On export, they are assembled and written as a `.webm` file. A sidecar `.json` file contains the full chapter timeline (slide ID, item title, lyrics excerpt, wall-clock timestamp). Video editors (DaVinci Resolve, Premiere, FFmpeg) can import both.
4. **Optional MP4 transcode.** If FFmpeg is available (already bundled for RTMP), the operator can request an MP4 on export. The `.webm` is always written first as a lossless fallback; FFmpeg runs as a background subprocess.
5. **Memory-safe.** The UI displays a running size estimate. At ~500 MB accumulated the operator is warned. No hard limit — a 90-minute 720p WebM is typically 600–900 MB.

---

#### Architecture

```
StreamPanel (Start/Stop/Pause recording controls)
      │
      ▼
RecordingController (new module: src/recording/RecordingController.js)
  ├── MediaRecorder(captureStreamRef.current, { mimeType: 'video/webm; codecs=vp9,opus', timeslice: 1000 })
  ├── chunks: Blob[]        ← ondataavailable accumulates chunks
  ├── markers: Marker[]     ← stamped on every goLive / blackout / clear event
  ├── totalBytes: number    ← running size for memory warning
  └── state: idle | recording | paused | stopped

AppContext.goLive / goLiveAll
  └── fires addRecordingMarker({ slideId, itemTitle, lines, timestamp: Date.now() })

Export flow (main process):
  Renderer ──send── 'save-recording' ──IPC──► main.js
                                               │
                              ┌────────────────┴───────────────┐
                              ▼                                ▼
                    write <uuid>.webm                 write <uuid>.json
                    to <userData>/recordings/         (chapter timeline sidecar)
                              │
                    (optional, if FFmpeg available)
                              ▼
                    spawn ffmpeg -i input.webm -c copy output.mp4
                    (stream-copy, no re-encode — fast)
```

---

#### New IPC Channels

| Channel (renderer → main) | Payload | Description |
|---|---|---|
| `save-recording` | `{ webmBuffer: ArrayBuffer, markers: Marker[], filename: string, transcode: bool }` | Triggers save dialog; writes `.webm` + `.json`; optionally spawns FFmpeg MP4 copy |
| `open-recording-location` | `{ dirPath: string }` | Opens `<userData>/recordings/` in Finder/Explorer |

| Channel (main → renderer) | Payload | Description |
|---|---|---|
| `recording-save-progress` | `{ phase: 'writing' | 'transcoding' | 'done', percent: number }` | Progress updates shown in StreamPanel |
| `recording-save-error` | `{ message: string }` | Surfaces disk-write or FFmpeg errors to the operator |

---

#### Data Structures

```js
// Chapter marker — appended on every Go Live and control event
Marker {
  timestamp: number,       // Date.now() relative to recording start (ms)
  wallClock: string,       // ISO-8601 wall time for the sidecar JSON
  event: 'go-live' | 'blackout' | 'clear' | 'pause-recording' | 'resume-recording',
  slideId: string | null,
  itemTitle: string | null,
  lines: string | null,    // first ~80 chars of slide text (lyrics / scripture)
  backgroundType: string | null, // 'image' | 'video' | 'youtube' | 'color' etc.
}

// Sidecar JSON written alongside the .webm
RecordingManifest {
  version: 1,
  recordedAt: string,      // ISO wall-clock of recording start
  durationMs: number,
  totalBytes: number,
  chapters: Marker[],
}
```

---

#### Component Breakdown

##### R1 — RecordingController module (`src/recording/RecordingController.js`)

Pure-JS class (no React). Wraps `MediaRecorder` lifecycle.

```
new RecordingController(stream: MediaStream)
  .start(timeslice = 1000)  → sets state=recording, registers ondataavailable
  .pause()                  → MediaRecorder.pause(), appends pause marker
  .resume()                 → MediaRecorder.resume(), appends resume marker
  .stop()                   → MediaRecorder.stop(), returns Promise<{ blob, markers }>
  .addMarker(markerObj)     → stamps a chapter marker at Date.now() - startTime
  .getSizeEstimate()        → sum of chunk sizes in bytes
  .getState()               → 'idle' | 'recording' | 'paused' | 'stopped'
```

`captureStreamRef.current` is already open in `StreamPanel`. Pass it to `RecordingController` at start time. No second `getDisplayMedia` call needed.

**Browser-mode fallback:** `captureStreamRef` may be null in browser mode (no Electron display capture). In that case, prompt the user to grant `getDisplayMedia` permission directly. Degrade gracefully — recording is an Electron-first feature.

##### R2 — StreamPanel recording controls (`src/components/StreamPanel.jsx`)

Add a **Recording** subsection below the RTMP controls:

```
[ ● Start Recording ]   ← idle state
[ ■ Stop   ⏸ Pause ]   ← recording state
[ ⏵ Resume  ■ Stop  ]  ← paused state

Size: 0.0 MB  Duration: 00:00
⚠ 487 MB — recording is large, consider stopping soon  (shown > 500 MB)
[ Export & Save ]   ← enabled once stopped; opens dialog
  ☐ Also export as MP4 (requires FFmpeg)
[ 📂 Open Recordings Folder ]
```

State is held in `useRef` / `useState` local to `StreamPanel` (the recording is transient — it doesn't need to survive remounts). `RecordingController` instance lives in a `useRef`.

Size estimate and duration are polled with `setInterval(500ms)` while recording is active.

##### R3 — AppContext marker integration (`src/store/AppContext.jsx`)

Add a `recordingControllerRef` to `AppContext` (or pass a callback from `StreamPanel`). The cleanest approach: expose `addRecordingMarker(marker)` from AppContext via a callback registered by `StreamPanel` on mount:

```js
// StreamPanel registers:
registerMarkerCallback((marker) => recordingControllerRef.current?.addMarker(marker));

// AppContext.goLive, goLiveAll, setIsBlackout, setIsClear call:
markerCallbackRef.current?.({ event: 'go-live', slideId, itemTitle, lines, backgroundType });
```

This keeps AppContext decoupled from `RecordingController` — it only fires a generic callback.

##### R4 — IPC: save-recording handler (`electron/main.js`)

```js
ipcMain.handle('save-recording', async (_, { webmBuffer, markers, filename, transcode }) => {
  const savePath = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('userData'), 'recordings', filename),
    filters: [{ name: 'WebM Video', extensions: ['webm'] }],
  });
  if (savePath.canceled) return { canceled: true };

  const webmPath = savePath.filePath;
  await fs.promises.writeFile(webmPath, Buffer.from(webmBuffer));

  const jsonPath = webmPath.replace(/\.webm$/, '.json');
  await fs.promises.writeFile(jsonPath, JSON.stringify({ version: 1, chapters: markers }, null, 2));

  if (transcode) {
    // Spawn ffmpeg -i webmPath -c copy mp4Path
    const mp4Path = webmPath.replace(/\.webm$/, '.mp4');
    await spawnFfmpegCopy(webmPath, mp4Path, (percent) => {
      mainWindow.webContents.send('recording-save-progress', { phase: 'transcoding', percent });
    });
  }

  return { webmPath, jsonPath };
});
```

Reuse the existing `findFFmpegPath()` helper. The MP4 export uses `-c copy` (stream-copy, no re-encode) — very fast and lossless.

##### R5 — preload.js additions

```js
saveRecording: (payload) => ipcRenderer.invoke('save-recording', payload),
openRecordingLocation: (dirPath) => ipcRenderer.send('open-recording-location', dirPath),
onRecordingSaveProgress: (cb) => ipcRenderer.on('recording-save-progress', (_, d) => cb(d)),
onRecordingSaveError: (cb) => ipcRenderer.on('recording-save-error', (_, d) => cb(d)),
```

---

#### File Storage Layout

```
<userData>/
  recordings/
    2026-04-20-14-30-service.webm
    2026-04-20-14-30-service.json
    2026-04-20-14-30-service.mp4   (optional, if FFmpeg transcode requested)
```

Default filename: `<YYYY-MM-DD-HH-MM>-service.webm`. User can rename in the save dialog.

---

#### Memory Management

| Threshold | Action |
|---|---|
| < 500 MB | Normal operation, show size counter |
| ≥ 500 MB | Show warning banner in StreamPanel: "Recording is large — consider stopping soon" |
| Operator stops recording | Chunks converted to Blob URL in renderer, held until Export is clicked |
| Export clicked | `Blob[]` joined into single ArrayBuffer, sent via IPC to main for disk write |
| After successful export | Chunks and Blob URL released (`URL.revokeObjectURL`) |

---

#### Test Coverage (`src/__tests__/p11Recording.test.js`)

Pure-function tests, no MediaRecorder mock needed — extract logic:

- `buildRecordingFilename(date)` → `2026-04-20-14-30-service.webm`
- `buildManifest(markers, durationMs, totalBytes)` → correct JSON structure
- `addMarker(markers, markerObj, startTime)` → correct timestamp offset, immutable
- `sizeWarning(totalBytes)` → false below 500 MB, true at or above
- `estimateDuration(startTime, now)` → correct ms difference
- `joinChunks(blobs)` → returns a single Blob with correct mimeType
- `ffmpegCopyArgs(inputPath, outputPath)` → correct `-c copy` argument array
- Marker event coverage: go-live, blackout, clear, pause-recording, resume-recording
- `buildManifest` with zero chapters (empty service edge case)
- `sizeWarning` boundary: exactly 500 MB → true; 499 MB → false

---

#### README Section

Add "Live Stream Recording" section to `README.md` explaining:
- Click "Start Recording" in StreamPanel (requires active stream capture)
- Go Live events are automatically marked as chapters
- Click "Stop" then "Export & Save" to write `.webm` + chapter `.json` to disk
- Optional: check "Also export as MP4" for broad compatibility (requires FFmpeg)
- Open `<userData>/recordings/` to find past recordings

#### HelpPanel Section

Add "Recording" accordion item to `src/components/HelpPanel.jsx`:
- How to start/stop/pause a recording
- Where files are saved
- What the chapter JSON is for
- MP4 export requirement (FFmpeg)
- Memory warning at 500 MB

---

#### Implementation Order

1. **R1** — `RecordingController.js` module (pure JS, no React, testable immediately)
2. **R4 + R5** — IPC handlers and preload additions (unblocks export without UI)
3. **R2** — StreamPanel recording controls (UI for start/stop/pause/export)
4. **R3** — AppContext marker callback (chapter markers on Go Live events)
5. Tests, README, HelpPanel

- [ ] R1: `src/recording/RecordingController.js` — `start`, `pause`, `resume`, `stop`, `addMarker`, `getSizeEstimate`
- [ ] R2: StreamPanel recording controls — Start/Stop/Pause buttons, size/duration counter, Export button, memory warning at 500 MB
- [ ] R3: AppContext marker callback — fires on `goLive`, `goLiveAll`, blackout, clear
- [ ] R4: `electron/main.js` — `save-recording` IPC handler with native save dialog, `.webm` + `.json` write, optional FFmpeg MP4 copy
- [ ] R5: `electron/preload.js` — expose `saveRecording`, `openRecordingLocation`, `onRecordingSaveProgress`, `onRecordingSaveError`
- [ ] Tests: `src/__tests__/p11Recording.test.js` — pure-function coverage for all extracted logic
- [ ] README: "Live Stream Recording" section
- [ ] HelpPanel: "Recording" accordion item

---

## Known Gaps & Risks

### Resolved

| Area | Resolution |
|---|---|
| Default data drift | `electron/defaultData.js` now `require()`s `src/data/defaultSongs.js` directly — single source of truth, no duplication |
| App identity | Resolved in P0 — `package.json` uses `church-presenter`; legacy data migrated on first launch |
| Video import persistence | Resolved in P8 — `copy-media-file` IPC copies to `<userData>/media/`; returns persistent `file://` path |
| Background color model / validator data loss | Fixed — `validateSlide` in both `electron/validators.js` and `src/store/persistence.js` now preserves `textAlign`, `background` (color/gradient/image/video), and `chords`; `validateBackground()` helper handles all types |
| Camera/mic permissions | `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` added to `package.json` `build.mac.extendInfo` |
| Test coverage | 186 tests now cover: slide navigation, goLive transitions, blackout/clear, removeFromSchedule edge cases, **updateScheduleItem**, **undo/redo history** (10 cases), **validator field preservation** (P6/P8 slide fields and song-level backgrounds) |

### Remaining (deferred / structural)

| Area | Risk | Notes |
|---|---|---|
| Stream window focus | Stream window is 1280×720 by design for screen-sharing; user must screen-share or manually fullscreen | By design — OBS/Zoom picks it as a window source |
| RTMP / FFmpeg | Native FFmpeg binaries require platform-specific bundling and code signing | Deferred to P9 release pipeline |
| Instagram Live | No public RTMP API; requires third-party RTMP bridge or OBS workaround | Documented in Settings panel |
| AI transcription privacy | On-device Whisper needs a native Electron addon (build/sign complexity); remote APIs send audio to third parties | Current implementation uses Web Speech API (on-device); Anthropic only receives transcript text for verse suggestions |
| CCLI licensing | SongSelect/Genius lyrics require a valid CCLI license for public display | Documented with in-app CCLI notice |
| Genius lyrics scraping | Genius ToS restricts automated access — for internal, non-commercial church use only with a valid CCLI license | Documented in Settings and Help panel |

---

## Tracking

- **Last updated:** 2026-04-19
- **Current focus:** P11 — Live Stream Recording (planned, not started)
- **Status:** P0–P10 complete. P11 plan written; implementation pending.

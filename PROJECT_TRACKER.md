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

- **Last updated:** 2026-04-17
- **Current focus:** Complete — all milestones shipped
- **Next up:** P8.2 video lifecycle controls (play/pause in PreviewArea), P8.3 transition effects, post-v1 feature requests
- **Status:** Active development — P0 + P1 + P2 + P3 + P4 + P5 + P6 + P7 + P8 + P8.1 + P9 complete

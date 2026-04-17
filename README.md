# Church Presenter

A free, offline-first church presentation app built with Electron + React. Runs as a desktop app or in the browser — no subscription, no cloud required.

---

## Features

- **Song Library** — store and manage your full song collection with lyrics, author, key, and tempo
- **Song Import** — import songs from Genius Lyrics, Planning Center Online, OpenLyrics XML files, or paste lyrics with automatic slide parsing
- **Lyrics Editor** — multi-slide editor with verse/chorus/bridge slide types, per-slide text alignment, chord chart tab for worship team, style presets, and metadata fields (BPM, CCLI number, copyright year)
- **Bible Search** — search by reference (John 3:16) or keyword; offline KJV and NIV included; searches all translations simultaneously; online search via YouVersion API
- **Live Presentation Output** — fullscreen slide output for projectors and second screens
- **Stage Display** — dedicated monitor for the worship team with lyrics, key, tempo, and live clock
- **Multi-Output Windows** — create announcement, background, confidence, and custom output windows on any display
- **Output Manager** — visual routing panel with live slide previews per screen, named display labels, one-click content routing, and saved routing presets
- **Media and Backgrounds** — solid colors, gradients, and video background support
- **Service Schedule** — drag-and-drop reordering, add/remove items, clear all
- **Blackout and Clear** — instant screen controls during live services
- **Keyboard Shortcuts** — Space/Arrow = next/prev, Enter = go live, B = blackout, C = clear
- **Streaming** — receive OBS Virtual Camera input, display a lower-third text overlay, and screen-share the stream window into Zoom or Teams
- **Social Media Streaming** — push directly to Facebook Live, YouTube Live, Instagram Live, or any custom RTMP endpoint via FFmpeg; multi-destination support; stream key management stored locally
- **Sermon Assistant** — live mic capture detects Bible references as they are spoken; one-click add to schedule or lower-third; optional Claude AI thematic verse suggestions

---

## Quick Start

### Requirements
- Node.js v18 or higher: https://nodejs.org

### Setup

```bash
cd ChurchPresenterApp
npm install
```

### Run as Desktop App (Electron)
```bash
npm run electron:dev
```

### Run in Browser Only
```bash
npm start
# Open http://localhost:3000
```

---

## Configuration

### YouVersion API (Online Bible Search)

Online Bible search is powered by the YouVersion API and **requires Electron** (it is not available in browser mode).

#### Option 1 — Config file (recommended)

```bash
cp config.example.js config.local.js
```

Edit `config.local.js` and add your API key:

```js
module.exports = {
  YOUVERSION_APP_KEY: 'your-youversion-app-key',
};
```

`config.local.js` is gitignored — your key will not be committed.

#### Option 2 — Environment variable

```bash
# macOS / Linux
export YOUVERSION_APP_KEY="your-youversion-app-key"
npm run electron:dev

# Windows PowerShell
$env:YOUVERSION_APP_KEY = "your-youversion-app-key"
npm run electron:dev
```

The app also reads `YV_APP_KEY` as a fallback.

#### Using online Bible search

Once the key is configured, switch to **Online** mode in the Bible panel. If the key is detected automatically from your config file or environment, you will see **"API key configured"** and available translations will load immediately. If not, enter the key manually in the input field that appears.

Online mode supports **reference lookups only** (e.g. `John 3:16`, `Psalm 23:1-6`). Keyword search requires offline mode.

---

## Offline Bible Assets

The app includes full offline Bible support in `public/bibles`:

- `public/bibles/KJV BIBLE/` — King James Version (66 books)
- `public/bibles/NIV BIBLE/` — New International Version (66 books)

Offline searches query **all available translations simultaneously** — results are returned with a version badge (KJV / NIV) on each verse so you can compare translations side by side.

Offline Bible data is loaded **on demand per book** — searching `John 3:16` fetches only `John.json`, making reference lookups instant.

To add additional offline translations, create a sibling folder under `public/bibles` containing:
- `Books.json` — JSON array of book names in canonical order
- One JSON file per book in the format `{ "book": "Genesis", "chapters": [{ "chapter": "1", "verses": [{ "verse": "1", "text": "..." }] }] }`

Then add the version to `public/bibles/index.json`:

```json
{
  "KJV": "KJV BIBLE",
  "NIV": "NIV BIBLE",
  "ESV": "ESV BIBLE"
}
```

The app will detect it automatically.

---

## How to Use

1. **Add a song to the schedule** — open the Songs tab, find a song in the library, click **+** to add it to the schedule
2. **Select it** — click the song in the Service Order (left panel)
3. **Pick a slide** — click any thumbnail in the slide strip at the top
4. **Preview it** — the center area shows a live preview
5. **Go live** — click **Send** in the preview area, then **Go Live** in the toolbar to open the presentation window
6. **Navigate** — use Prev/Next buttons, click slides directly, or use keyboard shortcuts (Space = next)
7. **Control output** — Blackout (B) and Clear (C) work instantly from the toolbar or keyboard

---

## Multiple Screens

### Electron (Desktop)
- Click **Go Live** — presentation opens fullscreen on your second screen automatically
- Click **Stage** — opens a dedicated stage display for the worship team
- Click **Outputs** — opens the Output Manager panel to create and route additional output windows

### Browser
- Click **Go Live** — a new browser window opens; move it to your projector and press F11 for fullscreen
- Both windows communicate via BroadcastChannel (no server required)
- Online Bible search is not available in browser mode

---

## Song Import

Click **↓ Import** in the Songs panel header to open the Song Import modal. Four import paths are available:

### Genius Lyrics

Search Genius.com for worship song lyrics and import them directly with automatic slide parsing.

**Setup:**
1. Go to `genius.com/api-clients` and create a new API client
2. Copy the **Client Access Token** (not the secret — the public read token)
3. In Church Presenter, open **⚙ Settings → Lyrics Search** and save the token

**Importing:**
1. Open **Songs → ↓ Import → 🎵 Genius Lyrics**
2. Search by song title or artist and press **Search**
3. Select a result — lyrics are fetched and parsed automatically
4. Review slides in the preview pane, edit title/artist if needed, and click **Import**

> **CCLI notice:** Lyrics sourced from Genius are for internal, non-commercial church use only. Ensure you hold a valid CCLI license for any songs displayed publicly.

### Planning Center Online

Search your PCO song library by title or artist and import arrangements directly.

**Setup:**
1. Log in to Planning Center and go to `api.planningcenteronline.com/oauth/applications`
2. Create a new app → select **Personal Access Token** → copy the App ID and Secret
3. In Church Presenter, open **⚙ Settings → Planning Center** and save your credentials

**Importing:**
1. Open **Songs → ↓ Import → Planning Center**
2. Type a song title or artist and press **Search**
3. Select a song from the results, then select an arrangement
4. Review the parsed slides in the preview pane, edit the title/author if needed, and click **Import**

### OpenLyrics XML

Import `.xml` files exported from SongSelect (via ChordPro export), OpenLP, or downloaded from `openlyrics.info`.

1. Open **Songs → ↓ Import → OpenLyrics XML**
2. Click **Choose XML file** and select your `.xml` file
3. Preview the parsed slides, then click **Import "Song Title"**

### Paste Lyrics

Paste raw lyrics with `[Section]` markers to create slides automatically.

```
[Verse 1]
Amazing grace! How sweet the sound
That saved a wretch like me

[Chorus]
My chains are gone, I've been set free
My God, my Savior has ransomed me

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
```

Supported section types: `[Verse N]`, `[Chorus]`, `[Bridge]`, `[Pre-Chorus]`, `[Intro]`, `[Outro]`, `[Tag]`, `[Ending]`. The slide type and label are set automatically based on the marker text.

1. Open **Songs → ↓ Import → Paste Lyrics**
2. Fill in the song title, author, key, and tempo
3. Paste lyrics with `[Section]` markers — slides update in real time on the right
4. Click **Import Song**

---

## Song Editor

Click the pencil icon on any song in the library to open the full Song Editor modal.

### Lyrics & Slides tab
- Add, remove, duplicate, and reorder slides using the sidebar
- Set slide **type** (verse, chorus, bridge, intro, ending, tag, blank) and **label**
- Set per-slide **text alignment** — Left (L), Center (C), or Right (R) — affects both the editor preview and the live output
- **🎸 Chords sub-tab** — enter a chord chart for a slide. Chords are displayed on the **Stage Display** for the worship team and are never shown to the audience

### Appearance tab
- Set background color, text color, font family, and font size
- **Style presets** — Large Title (72px Georgia), Subtitle (52px), Body (36px), Compact (28px Inter) — quickly configure the most common slide styles

### Metadata tab
- **BPM** — beats per minute (shown on Stage Display next to tempo)
- **CCLI Song Number** — for CCLI license reporting; find song numbers at `songselect.ccli.com`
- **Copyright Year** — stored alongside song data

### Tags
- Click preset tags (hymn, contemporary, worship, etc.) to toggle them
- Type any custom tag in the input and press **Enter** or **+** to add it

---

## Output Manager

Click **📺 Outputs** in the toolbar (next to Stage and Go Live) to open the Output Manager panel.

### Creating outputs
Select a role (Program, Stage, Announcement, Background, Confidence) and a target display, then click **＋ Open**. Each output opens as a dedicated fullscreen window on the chosen display.

### Routing content
Each output card shows a live slide preview thumbnail. Use:
- **Send Preview** — pushes the currently selected preview slide to that output instantly
- **Sync Program** — copies whatever is live on the main program output to that window

### Named display labels
Edit the label for each connected display (e.g. "Main Projector", "Stage TV", "Lobby Screen") in the Display Labels section. Labels persist across sessions and appear on each output card.

### Routing presets
Save the current set of output windows as a named preset ("Sunday Morning", "Evening Service", "Rehearsal"). Loading a preset closes the current outputs and recreates the saved configuration so setup is repeatable week to week.

---

## Streaming (OBS / Zoom)

The **📡 Stream** tab opens the streaming control panel:

1. **Open Stream Window** — launches a 1280×720 stream output window
2. **Select a video source** — the panel lists all video inputs (webcams, capture cards, OBS Virtual Camera). Click a device to preview it, then click **Send to Stream** to push it to the stream window
3. **Screen share in Zoom** — in Zoom, use screen share and select the "Stream View — Church Presenter" window
4. **Lower-third overlay** — type a label, main text, and source line, then click **Send Lower-Third** to display an animated text bar at the bottom of the stream. Click **Clear** to remove it
5. **Quick lower-third** — if a Bible verse or announcement is selected in the schedule, click **Send as Lower-Third** to push it directly without retyping

### OBS Virtual Camera workflow

1. In OBS, add your scenes as usual, then click **Start Virtual Camera**
2. In Church Presenter, open the **Stream** tab and click **Allow Camera Access**
3. Select **OBS Virtual Camera** from the device list — the panel shows a live preview
4. Click **Send to Stream** to push the OBS feed to the stream window
5. Add a **Window Capture** source in OBS pointed at the stream window, or screen-share the stream window directly in Zoom/Teams

The stream window also receives the **Blackout** control from the toolbar.

---

## Sermon Assistant (AI Bible Verse Lookup)

The **🎙 Sermon** tab opens a live sermon assistant that listens to the pastor's microphone, detects Bible references in real time, and optionally asks Claude AI for thematically relevant verse suggestions.

### What it does

| Feature | How it works |
|---|---|
| Reference detection | Web Speech API captures mic audio; recognized text is scanned for `Book Chapter:Verse` patterns (all 66 books, common abbreviations, spoken ordinals like "First Corinthians") |
| Detected references | Each reference appears immediately with **＋ Add** (adds to service schedule) and **LT** (sends as lower-third overlay to the stream window) |
| AI suggestions | Sends the sermon transcript to Claude Haiku; returns 3–5 thematically relevant verses with a brief reason for each |
| Privacy | Microphone is opt-in. Transcript stays local until you click "Suggest Verses" — at that point it is sent to Anthropic's API. No audio is ever stored. |

### Setup

**Reference detection** works with no setup — just open the 🎙 Sermon tab and click **Start Listening**.

**AI suggestions** require an Anthropic API key:
1. Go to `console.anthropic.com` → API Keys → Create Key
2. In Church Presenter, open **⚙ Settings → AI (Sermon Assistant)** and save the key

### Using during a service

1. Open the **🎙 Sermon** tab before the sermon begins
2. Click **Start Listening** — the mic activates (browser permission prompt may appear on first use)
3. As the pastor mentions a scripture reference (e.g. "turn to John 3:16"), it appears in "Detected References" within seconds
4. Click **＋ Add** to add it to the schedule, or **LT** to send it as a lower-third overlay on the stream window
5. At any point, click **✦ Suggest Verses from Sermon** to ask Claude for additional relevant verses based on the sermon theme
6. Click **Clear** to reset the transcript and references between services

### Supported reference formats

- Standard: `John 3:16`, `Romans 8:28`, `1 Corinthians 13:4-7`
- Spoken ordinals: `First Corinthians 13`, `Second Timothy 3`, `Third John 1`
- Chapter only: `Psalm 23`, `Romans 8`
- Explicit words: `John chapter 3 verse 16`
- Common abbreviations: `Gen 1:1`, `Rev 22:3`, `Ps 23`, `Phil 4:13`

---

## Social Media Streaming (RTMP)

The **📡 Stream** tab includes a **Social Media Streaming** section for pushing directly to Facebook Live, YouTube Live, Instagram, or a custom RTMP server — no OBS required.

### Requirements
FFmpeg must be installed on the system:
```bash
# macOS
brew install ffmpeg

# Windows
winget install ffmpeg
```

If FFmpeg is not found, Church Presenter shows installation instructions and disables the Go Live button. The stream window can still be screen-shared to OBS as a fallback.

### Setup
1. Click **＋ Add Platform** and select your streaming platform (Facebook, YouTube, Instagram, or Custom RTMP)
2. Click the destination to expand it and paste your **stream key** from the platform's live dashboard
3. Enable or disable individual destinations using the checkbox
4. Open the **Stream Window** (required — it is the source that gets streamed)
5. Click **▶ Go Live — Social**

Multiple platforms can be enabled simultaneously — all active destinations receive the same encoded stream.

### Stream health
While live, each destination shows:
- A **LIVE** badge
- Real-time **bitrate** (kbps from FFmpeg output)
- A **live duration** timer (MM:SS) in the section header

### Security
Stream keys are stored in your local `settings.json` only. They are never transmitted to Anthropic, Church Presenter servers, or any third party — only to the RTMP endpoint you configure.

---

## Documentation

| Guide | Description |
|---|---|
| [Setup Guide](docs/setup-guide.md) | Installation, display hardware, API keys, FFmpeg |
| [Service Day Runbook](docs/service-day-runbook.md) | Step-by-step Sunday morning checklist |
| [Display Setup](docs/display-setup.md) | Projectors, stage display, multi-output routing, presets |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and fixes |
| [Backup & Restore](docs/backup-restore.md) | Protecting your song library and settings |
| [Contributing](CONTRIBUTING.md) | Development setup, conventions, release process |

---

## Build an Installer

```bash
npm run electron:build
# Output in /dist:
#   macOS   -> Church Presenter-x.x.x-arm64.dmg  (Apple Silicon)
#             Church Presenter-x.x.x-x64.dmg     (Intel)
#   Windows -> Church Presenter Setup x.x.x.exe
#   Linux   -> Church Presenter-x.x.x.AppImage
#             church-presenter_x.x.x_amd64.deb
```

Icons (`build-resources/icon.icns`, `icon.ico`, `icon.png`) must be present before building a production installer. See [build-resources/README.md](build-resources/README.md) for generation instructions.

### Automated releases via GitHub Actions

Tagging a commit triggers the release pipeline automatically:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds macOS (arm64 + x64), Windows (x64), and Linux (x64 AppImage + .deb) installers and creates a GitHub Release with all artifacts attached. Code-signing is applied when the appropriate secrets are set — see [CONTRIBUTING.md](CONTRIBUTING.md#release-process-maintainers) for the required secrets.

---

## Data Storage

All data is stored as local JSON — no database required.

| Platform | Location |
|---|---|
| macOS | `~/Library/Application Support/church-presenter/data/` |
| Windows | `%APPDATA%\church-presenter\data\` |
| Linux | `~/.config/church-presenter/data/` |
| Browser | `localStorage` |

Files: `songs.json`, `schedules.json`, `settings.json`

> **Upgrading from an earlier build?** If a `easyworship-clone` data directory exists on your machine, the app will automatically copy your songs, schedules, and settings to the new `church-presenter` directory on first launch. No data is lost.

---

## Project Structure

```
ChurchPresenterApp/
├── electron/
│   ├── main.js               Window management, IPC, file I/O
│   ├── preload.js            Secure renderer bridge (contextBridge)
│   ├── validators.js         JSON schema validators (CommonJS)
│   ├── defaultData.js        Starter songs
│   └── youversion.js         YouVersion API client wrapper
├── public/
│   └── bibles/
│       ├── index.json        Version → folder mapping (auto-detected)
│       ├── KJV BIBLE/        King James Version (66 book JSON files)
│       └── NIV BIBLE/        New International Version (66 book JSON files)
└── src/
    ├── App.jsx               Router: main / presentation / stage / output / stream
    ├── store/
    │   ├── AppContext.jsx     All state management and live transport
    │   ├── persistence.js    localStorage validators and storage helpers
    │   └── liveStateSync.js  Browser live-state recovery
    ├── data/
    │   ├── defaultSongs.js   Starter song data
    │   └── bible.js          Bible search logic, offline loader, YouVersion bridge
    ├── hooks/
    │   └── useKeyboardShortcuts.js
    ├── styles/global.css
    └── components/
        ├── MainLayout.jsx        Operator control surface
        ├── Toolbar.jsx           Go Live, Blackout, Stage, Outputs, clock
        ├── SchedulePanel.jsx     Service order (drag to reorder)
        ├── SlideEditor.jsx       Slide thumbnail strip
        ├── PreviewArea.jsx       Preview + live output monitors
        ├── SlideRenderer.jsx     Renders slides at any scale
        ├── LibraryPanel.jsx      Song library browser
        ├── BiblePanel.jsx        Scripture search (offline + YouVersion)
        ├── MediaPanel.jsx        Backgrounds and video
        ├── AnnouncementPanel.jsx Announcement content
        ├── StreamPanel.jsx       Streaming controls (camera, lower-third)
        ├── OutputManager.jsx     Output routing panel (previews, labels, presets)
        ├── HelpPanel.jsx         Keyboard shortcut reference
        ├── SongEditorModal.jsx   Full lyrics editor
        ├── SongImportModal.jsx   Song import (PCO / OpenLyrics / paste)
        ├── SermonAssistPanel.jsx Live sermon mic, reference detection, AI suggestions
        ├── SettingsPanel.jsx     API keys, RTMP destinations, presentation defaults
        ├── PresentationView.jsx  Fullscreen program output window
        ├── StageView.jsx         Worship team stage display
        ├── OutputView.jsx        Generic flexible output window
        └── StreamView.jsx        Stream output window (OBS/Zoom)
```

---

## Troubleshooting

For a comprehensive list of issues and solutions, see the [Troubleshooting Guide](docs/troubleshooting.md).

**Quick answers:**

| Problem | Fix |
|---|---|
| "electron: command not found" | Run `npm install` first |
| Blank presentation window | Click **Send** before **Go Live** |
| Second screen not detected | Connect display before launching; use Extended (not Mirror) mode |
| App blocked by macOS Gatekeeper | Right-click → Open, or run `xattr -cr "/Applications/Church Presenter.app"` |
| Songs not saving (browser) | Check localStorage is enabled; clear `*_backup_*` keys if storage is full |
| Bible search returns no results | Check `/public/bibles/` folder is intact; see browser console for 404s |
| YouVersion "No translations found" | Verify API key is valid; online search requires Electron |
| FFmpeg not found | `brew install ffmpeg` (macOS) or `winget install Gyan.FFmpeg` (Windows) |

**Stream panel shows no camera devices** — click **Allow Camera Access** to trigger the OS permission dialog. On macOS, camera permission must be granted to the app in System Settings → Privacy & Security → Camera.

**OBS Virtual Camera not visible** — make sure OBS is running and **Start Virtual Camera** has been clicked in OBS before opening the Stream panel. Click **Refresh** in the device list after starting OBS.

**Lower-third not appearing** — the stream window must be open (click **Open Stream Window** first) and the source must be active before the lower-third overlay renders.

**Sermon Assistant mic does not start / "Microphone access denied"** — on macOS, grant microphone permission to Electron in System Settings → Privacy & Security → Microphone. On Windows, check Settings → Privacy → Microphone.

**Sermon transcript is empty / not updating** — the Web Speech API requires an internet connection in Chromium (it uses Google's speech service internally on most platforms). Offline operation may not produce transcriptions.

**Detected references are missing** — the parser requires at least a book name and chapter number. Short abbreviations (e.g. "Gen 1") are supported; check that the book name is followed by a digit.

**"Anthropic API 401" in AI suggestions** — the API key is invalid or has been revoked. Generate a new key at `console.anthropic.com`.

**Genius search returns "No Genius API key configured"** — open ⚙ Settings → Lyrics Search and save your Client Access Token from `genius.com/api-clients`.

**Genius search returns 401 / authorization error** — the token has expired or is incorrect. Generate a new Client Access Token at `genius.com/api-clients`.

**Genius lyrics are blank after selecting a song** — Genius occasionally changes their HTML structure. The scraper looks for `data-lyrics-container` divs; if lyrics are empty, the song may use a layout that is not yet supported.

**Planning Center search returns "PCO API 401"** — your App ID or Secret is incorrect, or the Personal Access Token does not have Services (Songs) read access. Regenerate the token in the PCO developer portal.

**OpenLyrics import shows "No verses found"** — the XML may use a non-standard namespace or an unsupported format. Try re-exporting from your source application or check that the file uses `<verse name="v1">` tags.

**"FFmpeg required" banner in Social Streaming** — install FFmpeg (`brew install ffmpeg` on macOS, `winget install ffmpeg` on Windows), then restart the app. The banner disappears once FFmpeg is detected on startup.

**Social streaming fails immediately** — verify the stream key matches the platform's current live event. Stream keys expire when a live event ends; generate a new one from the platform dashboard.

**Bitrate shows 0 or stream drops** — ensure the stream window is visible (not minimized) during capture. Low bitrate may indicate a slow upload connection; reduce video quality in a future settings update.

---

## Tech Stack

React 18, Electron 28, electron-builder, react-beautiful-dnd, uuid, localStorage + JSON files (no database)

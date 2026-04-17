# Church Presenter — Setup Guide

This guide walks through installing Church Presenter, configuring your display hardware, and entering API keys for optional online features.

---

## System requirements

| | Minimum | Recommended |
|---|---|---|
| **OS** | macOS 12, Windows 10, Ubuntu 20.04 | macOS 13+, Windows 11, Ubuntu 22.04 |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 500 MB free | 2 GB free (for video loops and media) |
| **Displays** | 1 (operator + projected share same screen) | 2+ (one for operator, one per output) |
| **Internet** | Not required | Needed only for Genius, PCO, YouVersion, and AI features |

---

## Installation

### macOS

1. Download `Church Presenter-x.x.x-arm64.dmg` (Apple Silicon) or `Church Presenter-x.x.x-x64.dmg` (Intel) from the [Releases page](https://github.com/anderianinc/churchpresenterapp/releases)
2. Open the `.dmg` and drag **Church Presenter** into your **Applications** folder
3. On first launch, macOS may show a security warning because the app is from an independent developer:
   - Right-click the app in Applications → **Open** → **Open** in the dialog

   Alternatively, go to **System Settings → Privacy & Security → Security** and click **Open Anyway** next to the Church Presenter entry.
4. When prompted, grant **camera** and **microphone** access if you plan to use streaming or the Sermon Assistant

### Windows

1. Download `Church Presenter Setup x.x.x.exe` from the [Releases page](https://github.com/anderianinc/churchpresenterapp/releases)
2. Run the installer — if Windows SmartScreen appears, click **More info** → **Run anyway**
3. Choose an install location (default: `C:\Program Files\Church Presenter`) and click **Install**
4. A desktop shortcut and Start Menu entry are created automatically

### Linux

1. Download `Church Presenter-x.x.x.AppImage` from the [Releases page](https://github.com/anderianinc/churchpresenterapp/releases)
2. Make it executable: `chmod +x "Church Presenter-x.x.x.AppImage"`
3. Run it: `./Church\ Presenter-x.x.x.AppImage`
4. To add to your applications menu, use AppImageLauncher or place the file in `~/.local/bin/`

### Running from source

```bash
# Requires Node.js 18+
git clone https://github.com/anderianinc/churchpresenterapp.git
cd ChurchPresenterApp
npm install
npm run electron:dev
```

---

## First launch

On first launch, Church Presenter:
- Creates a data directory (see [Data locations](#data-locations))
- Seeds your song library with 6 starter worship songs
- Detects all connected displays
- Checks whether FFmpeg is installed (required for RTMP social media streaming)

The app is immediately usable with no configuration required. Songs, schedules, and settings are saved automatically.

---

## Display setup (projectors and monitors)

Connect your projector or second monitor **before launching** the app. Electron detects displays at startup.

1. In the toolbar, click **▶ Go Live** — if a second display is detected, a display picker appears automatically
2. Select your projector from the list
3. The presentation window opens fullscreen on that display
4. Your selection is saved — the same display is used automatically next Sunday

For detailed display routing, routing presets, and multi-output setup, see [Display Setup Guide](display-setup.md).

---

## Optional API keys

All API keys are optional. The app is fully functional for local use without any keys.

Open **⚙ Settings** in the toolbar to configure keys.

### 🔑 API Keys tab

#### Genius Lyrics (song import)

Search Genius.com for contemporary worship lyrics and import them with automatic slide parsing.

1. Go to [genius.com/api-clients](https://genius.com/api-clients) and sign in
2. Click **New API Client** — fill in any app name (e.g. "Church Presenter")
3. Copy the **Client Access Token** (the long string under "Generate Access Token")
4. Paste it into **⚙ Settings → API Keys → Genius Client Access Token** and click Save

> CCLI notice: lyrics from Genius are for internal, non-commercial church use. Ensure you hold a valid CCLI license for songs displayed publicly.

#### Planning Center Online (song import)

Import songs directly from your PCO song library.

1. Sign in to Planning Center and go to [api.planningcenteronline.com/oauth/applications](https://api.planningcenteronline.com/oauth/applications)
2. Click **New Application** → choose **Personal Access Token**
3. Copy the **Application ID** and **Secret**
4. Enter both in **⚙ Settings → API Keys → Planning Center** and click Save

#### YouVersion (online Bible lookup)

Enables online Bible reference lookup via YouVersion.

1. Apply for API access at [developer.youversion.com](https://developer.youversion.com)
2. Once approved, copy your **App Key**
3. Enter it in **⚙ Settings → API Keys → YouVersion App Key** and click Save

> YouVersion is optional. The app ships with full offline KJV and NIV translations built in.

#### Anthropic (AI verse suggestions)

Enables the Claude AI verse suggestion feature in the Sermon Assistant.

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys** → **Create Key**
2. Copy the key
3. Enter it in **⚙ Settings → API Keys → Anthropic API Key** and click Save

---

## Devices tab (mic, camera, font defaults)

Open **⚙ Settings → Devices** to:

- **Preferred microphone** — select which mic the Sermon Assistant level meter uses. The 20-bar VU meter confirms the selection is working. Note: Web Speech API for voice-to-text always uses the system default input; change that in your OS settings.
- **Preferred camera** — select which camera the Stream panel uses for live video.
- **Font and size defaults** — set the default slide font and size for new songs and announcements.

---

## FFmpeg (social media streaming)

FFmpeg is required to stream to Facebook Live, YouTube Live, Instagram, or a custom RTMP server.

```bash
# macOS (Homebrew)
brew install ffmpeg

# Windows (winget)
winget install Gyan.FFmpeg

# Linux (apt)
sudo apt install ffmpeg
```

After installing, restart Church Presenter — the FFmpeg status in the Stream panel should change from a warning to a green checkmark.

---

## Data locations

All data is stored as plain JSON files. No database or server is required.

| Platform | Location |
|---|---|
| macOS | `~/Library/Application Support/church-presenter/data/` |
| Windows | `%APPDATA%\church-presenter\data\` |
| Linux | `~/.config/church-presenter/data/` |

Files:
- `songs.json` — your full song library
- `schedules.json` — saved service schedules
- `settings.json` — API keys, display labels, routing presets, device preferences

Back up these three files regularly. See [Backup & Restore Guide](backup-restore.md) for detailed procedures.

---

## Upgrading from an earlier version

If you have an existing `easyworship-clone` data directory (from an earlier beta build), Church Presenter automatically copies your songs, schedules, and settings to the new `church-presenter` directory on first launch. No manual migration is needed.

---

## Next steps

- [Service Day Runbook](service-day-runbook.md) — step-by-step Sunday morning checklist
- [Display Setup Guide](display-setup.md) — projectors, stage display, multi-output routing
- [Troubleshooting](troubleshooting.md) — common issues and solutions
- [Backup & Restore](backup-restore.md) — protecting your song library and settings

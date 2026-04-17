# Troubleshooting Guide

Solutions to common issues with Church Presenter.

---

## Installation and launch

### "App is damaged and can't be opened" (macOS)

This message appears when macOS cannot verify the developer signature on an unsigned build.

**Fix:**
1. Open **Terminal** and run:
   ```bash
   xattr -cr "/Applications/Church Presenter.app"
   ```
2. Launch the app normally

**Alternative:** Right-click the app in Finder → Open → click Open in the dialog.

### SmartScreen warning (Windows)

Windows shows "Windows protected your PC" for unsigned builds.

**Fix:** Click **More info** → **Run anyway**.

### "electron: command not found" (running from source)

**Fix:** Run `npm install` first to install all dependencies including Electron.

### App opens but shows a white screen

**Fix:** The React app may still be compiling. Wait 10–15 seconds and reload (Ctrl/Cmd+R). If it persists, check the terminal for build errors.

---

## Presentation and output

### Presentation window doesn't open

**Check:**
1. Click the ▾ chevron next to Go Live — are displays listed?
2. Is your projector connected and powered on?
3. Try disconnecting and reconnecting the HDMI cable, then restart the app

**If only one display is listed even though you have two connected:** On macOS, verify the projector is in **Extended** (not Mirror) mode in System Settings → Displays. On Windows, press Win+P → Extend.

### Presentation window opens on the wrong screen

**Fix:** Click the ▾ chevron next to **Go Live** (while not live) and select the correct display from the picker. Your choice is saved for next time.

### Blank presentation window (no slide content)

The presentation window is open but showing nothing.

**Fix:** A slide must be selected and sent before going live.
1. Click an item in the Schedule panel
2. Click a slide thumbnail in the strip
3. Click **Send** (or press Enter) in the preview area
4. Then click **▶ Go Live**

### Projector shows black even though Blackout is off

**Check:**
1. Is the **⬛ Blackout** button in the toolbar highlighted? Press **B** to toggle
2. Is the HDMI cable fully seated?
3. Is the projector on the correct input?

### Stage display not showing lyrics

**Check:**
1. Is **🖥️ Stage** highlighted in the toolbar (stage window is open)?
2. Is a slide selected and live?
3. Is **Stage mirrors program** checked in the preview area?

### Stage display showing wrong content / lag

The stage display always receives slides independently via IPC. There is no lag under normal conditions.

**Fix:** Close and reopen the stage window (click 🖥️ Stage twice).

### Output window opened on the wrong display

**Fix:** In **📺 Outputs**, click the three-dot menu on the output card and click **Move to Display**, then select the correct display.

---

## Songs and library

### Song not saving

In browser mode, songs save to `localStorage`. If localStorage is full or disabled:

**Check:** Open browser DevTools (F12) → Console — look for a `[storage] Error saving` message.

**Fix:** Clear old backup keys (`cp_songs_backup_*`) from localStorage, or increase the storage quota in browser settings.

In Electron mode, songs write to `songs.json`. If there's a file permission error:

**Fix:** Check that the data directory is writable:
- macOS: `~/Library/Application Support/church-presenter/data/`
- Windows: `%APPDATA%\church-presenter\data\`

### Song library is empty after update

**Cause:** A corrupted `songs.json` was detected and the app fell back to defaults, or the data directory changed.

**Fix:**
1. Close the app
2. Navigate to the data directory (see [Data locations](#data-locations))
3. Check for a `songs.json.bak.*` file — this is the corrupted backup
4. If you have a recent manual backup, copy it over `songs.json`
5. Relaunch the app

### Import from Genius returns "No results"

**Check:**
1. Is your Genius API token saved in **⚙ Settings → API Keys**?
2. Is the token the **Client Access Token** (not the Client Secret)?
3. Do you have an internet connection?

### Planning Center import shows "Authentication failed"

**Check:**
1. Are both **App ID** and **Secret** saved in Settings?
2. Did you create a **Personal Access Token** (not an OAuth client)?
3. Does your PCO account have Songs access?

---

## Bible search

### Offline search returns no results

**Check:**
1. Is the search term a recognized book name? (e.g. `John 3:16`, not `Jn 3:16`)
2. For keyword search, try fewer or different words
3. Check the browser console (F12) for 404 errors loading Bible JSON files

**Common fix:** Make sure the `public/bibles/` folder is intact. If running from source, the Bible files must be in `public/bibles/KJV BIBLE/` and `public/bibles/NIV BIBLE/`.

### YouVersion shows "No translations found"

**Check:**
1. Is your YouVersion API key saved in **⚙ Settings → API Keys**?
2. Is the key still active in the YouVersion developer portal?
3. YouVersion requires Electron — online Bible search is not available in browser mode

---

## Streaming

### Camera not appearing in Stream panel

**Check (macOS):** System Settings → Privacy & Security → Camera → make sure Church Presenter is enabled.

**Check (Windows):** Settings → Privacy & Security → Camera → Camera access → On.

**Check (all):** Is the camera connected and recognized by the OS? Test in another app (FaceTime, Camera, etc.) first.

### "FFmpeg not found" warning

Social media RTMP streaming requires FFmpeg installed on your system.

**Fix:**
```bash
# macOS
brew install ffmpeg

# Windows
winget install Gyan.FFmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg
```

After installing, restart Church Presenter.

### RTMP stream starts but immediately disconnects

**Check:**
1. Is your stream key correct? Copy it directly from the platform's live dashboard
2. Is your internet connection stable? RTMP requires ~3–6 Mbps upload
3. Is the stream window open? RTMP captures the stream window — it must be open before going live
4. Check the terminal output for FFmpeg error messages

### Stream window not appearing in Zoom/Teams window picker

The stream window title is "Stream View — Church Presenter". If it's not listed:
1. Make sure the stream window is open (click **Open Stream Window** in the Stream panel)
2. In Zoom, use **Share Screen → Window** (not Desktop)
3. If it still doesn't appear, try screen-sharing your entire screen instead

---

## Sermon Assistant

### Microphone not detecting audio (all bars flat)

**Check (macOS):** System Settings → Privacy & Security → Microphone → Church Presenter → enabled.

**Check (Windows):** Settings → Privacy & Security → Microphone → Microphone access → On.

**Note:** Web Speech API always uses the **system default** microphone, not the "preferred mic" set in Settings. Set the correct mic as default in your OS audio settings.

**Check:** Is the correct mic selected as the system default? Test it in a recording app.

### Speech recognition not detecting references

**Check:**
1. Is the mic picking up audio? The level meter should show bars when someone speaks
2. Is the pastor speaking clearly and at normal pace?
3. Try speaking a reference yourself while standing near the mic
4. References must match recognized book names — see the [Sermon Assistant section in README](../README.md#sermon-assistant-ai-bible-verse-lookup) for supported formats

### AI verse suggestions not working

**Check:**
1. Is the Anthropic API key saved in **⚙ Settings → API Keys**?
2. Is there at least 40 words of new speech since the last suggestion?
3. Check the browser console for API error messages (quota exceeded, invalid key, etc.)

---

## Data and persistence

### "Unsaved session found" banner at startup

This is the crash-safe autosave recovery banner. It means the app closed unexpectedly while there were unsaved schedule changes.

- Click **Restore** to recover the previous session's schedule
- Click **Dismiss** to ignore and keep the currently saved data

### Schedule keeps reverting to an old version

**Cause:** The 60-second autosave hasn't run yet, and the app was closed before the normal save completed.

**Fix:** After making schedule changes, wait a few seconds for the "Saved" indicator in the toolbar to appear before closing.

### Settings keep resetting

**Cause:** `settings.json` may be corrupt or unwritable.

**Fix:**
1. Close the app
2. Navigate to the data directory
3. Delete or rename `settings.json`
4. Relaunch — settings are recreated from defaults (API keys will need to be re-entered)

---

## Data locations

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/church-presenter/data/` |
| Windows | `%APPDATA%\church-presenter\data\` |
| Linux | `~/.config/church-presenter/data/` |
| Browser | `localStorage` (open DevTools → Application → Local Storage) |

---

## Opening the developer console

DevTools shows errors, warnings, and network requests useful for diagnosing issues.

- **Electron (macOS/Linux):** `Cmd+Option+I` or `View → Toggle Developer Tools`
- **Electron (Windows):** `Ctrl+Shift+I`
- **Browser:** `F12` or `Ctrl+Shift+I` / `Cmd+Option+I`

---

## Still stuck?

Open a GitHub issue at [github.com/anderianinc/churchpresenterapp/issues](https://github.com/anderianinc/churchpresenterapp/issues) and include:
- Church Presenter version
- Operating system and version
- Steps to reproduce
- Console errors (copy/paste from DevTools)

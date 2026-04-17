# Backup & Restore Guide

Church Presenter stores all data as plain JSON files. Backing up is as simple as copying three files. This guide explains where those files live, how to back them up, and how to restore them.

---

## What to back up

| File | Contains |
|---|---|
| `songs.json` | Your entire song library — all lyrics, slide arrangements, backgrounds, metadata |
| `schedules.json` | Saved service schedules |
| `settings.json` | API keys, display labels, routing presets, device preferences, streaming destinations |

**Media files** (imported video loops and image backgrounds) are stored separately in a `media/` subfolder of the data directory. Back this up too if you use custom video backgrounds.

---

## Data directory locations

| Platform | Data directory |
|---|---|
| macOS | `~/Library/Application Support/church-presenter/data/` |
| Windows | `%APPDATA%\church-presenter\data\` — type this path in File Explorer's address bar |
| Linux | `~/.config/church-presenter/data/` |

---

## Manual backup

### macOS / Linux

```bash
# Create a dated backup
cp -r ~/Library/Application\ Support/church-presenter/data/ \
  ~/Desktop/church-presenter-backup-$(date +%Y-%m-%d)/
```

Or open Finder → Go → Go to Folder (`⇧⌘G`) → paste `~/Library/Application Support/church-presenter/data/` → copy the folder to an external drive or cloud folder.

### Windows

1. Press `Win + R`, type `%APPDATA%\church-presenter\data\` and press Enter
2. Select all files (`Ctrl+A`) and copy them (`Ctrl+C`)
3. Navigate to your backup destination and paste (`Ctrl+V`)

---

## Recommended backup schedule

| When | What to back up |
|---|---|
| After adding or editing songs | `songs.json` |
| After building a new service schedule | `schedules.json` |
| After changing settings (new API keys, routing presets) | `settings.json` |
| Weekly (whole data directory) | All three files + `media/` folder |

A simple approach: at the end of each Sunday, copy the entire data directory to a shared cloud folder (Google Drive, Dropbox, OneDrive) or a USB drive kept at the church.

---

## Cloud sync

Because the data files are plain JSON, they work well with any file sync tool:

1. Move the data directory to a cloud-synced folder:
   ```bash
   # macOS example — move data to iCloud Drive
   mv ~/Library/Application\ Support/church-presenter/data/ ~/Library/Mobile\ Documents/com~apple~CloudDocs/church-presenter-data/
   ```
2. Create a symlink so Church Presenter still finds its data in the expected location:
   ```bash
   ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/church-presenter-data/ \
     ~/Library/Application\ Support/church-presenter/data
   ```

**Caution:** If two computers sync the same folder and both run Church Presenter simultaneously, the last write wins. Do not run Church Presenter on two computers pointing at the same cloud-synced folder at the same time.

---

## Restoring from backup

### Full restore (replace all data)

1. Close Church Presenter completely
2. Navigate to the data directory
3. Replace the existing files with your backup copies:

```bash
# macOS / Linux — restore from a dated backup
cp ~/Desktop/church-presenter-backup-2024-12-01/songs.json \
   ~/Library/Application\ Support/church-presenter/data/songs.json

cp ~/Desktop/church-presenter-backup-2024-12-01/schedules.json \
   ~/Library/Application\ Support/church-presenter/data/schedules.json

cp ~/Desktop/church-presenter-backup-2024-12-01/settings.json \
   ~/Library/Application\ Support/church-presenter/data/settings.json
```

4. Relaunch Church Presenter — your library and settings are restored

### Restore to a new computer

1. Install Church Presenter on the new computer
2. Launch it once (creates the data directory), then close it
3. Copy your backed-up JSON files into the data directory
4. Relaunch — your songs, schedules, and settings appear immediately

### Partial restore (recover deleted songs)

If you accidentally deleted songs from the library and want to recover them from a backup:

1. Open the backup `songs.json` in a text editor
2. Find the song objects you need (search for the song title)
3. Open the current `songs.json` in the same editor
4. Copy the missing song objects from the backup into the current file
5. Save and relaunch Church Presenter

The `songs.json` is a JSON array — each song is an object `{ "id": "...", "title": "...", "slides": [...], ... }`. Be careful to maintain valid JSON (commas between array items, balanced brackets).

---

## Automatic corruption recovery

Church Presenter validates JSON files on every load. If a file is corrupted:
- The corrupted data is automatically backed up to a timestamped file (e.g. `songs.json.bak.1704067200000`)
- The app falls back to safe defaults (empty library for songs, empty schedule)
- The original backup file is preserved so you can recover manually

If you see "Unsaved session found" at startup, it means the app closed unexpectedly. Click **Restore** to recover the most recent autosaved state (written every 60 seconds).

---

## Exporting songs for another system

`songs.json` is a self-contained JSON array of song objects with a simple schema. It can be imported into other systems or processed with scripts. Each song follows this structure:

```json
{
  "id": "unique-string",
  "title": "Song Title",
  "author": "Author Name",
  "key": "G",
  "tempo": "Medium",
  "tags": ["contemporary", "worship"],
  "slides": [
    {
      "id": "slide-id",
      "type": "verse",
      "label": "Verse 1",
      "lines": "First line\nSecond line",
      "textAlign": "center",
      "chords": "G  D  Em  C"
    }
  ],
  "background": { "type": "color", "value": "#0a0f1e" },
  "textColor": "#ffffff",
  "fontSize": 44,
  "fontFamily": "Georgia",
  "bpm": 0,
  "ccliNumber": "",
  "copyrightYear": ""
}
```

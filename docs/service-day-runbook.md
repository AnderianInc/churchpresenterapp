# Service Day Runbook

A step-by-step checklist for using Church Presenter on Sunday morning (or any service). Designed for a single operator — adapt as needed for your team.

---

## Before service day — preparation (Thursday–Saturday)

### Build the service order

1. Open Church Presenter and go to the **🎵 Songs** tab
2. Search for each worship song — click **＋** to add it to the schedule
3. Repeat for Bible passages (**📖 Bible**) and announcements (**📢 Announcements**)
4. Open the **📅 Schedule** panel and drag items into service order
5. Preview each song: click it in the Schedule panel, then step through slides with Space or →

### Adjust backgrounds and appearance

- To change a song's background: click it in the schedule → the **Item Background** picker appears below the preview area
- To change a slide's appearance globally: open the song in **🎵 Songs** → click the pencil icon → **Appearance** tab
- To override a single slide: pencil icon → select the slide → **🎨 BG** sub-tab

### Check content

- Read every slide for typos, alignment, and overflow
- Confirm Bible references are correct (verse/chapter numbers)
- Verify announcement dates and times are current

### Save a routing preset (if using multi-output)

1. Open **📺 Outputs** and create your output windows (Program, Stage, Announcement, etc.)
2. Click **Save Preset** and name it (e.g. "Sunday Morning")
3. Next week, click the preset name to recreate the same layout in seconds

---

## Sunday morning — 60 minutes before service

### Power on and connect

- [ ] Power on your computer
- [ ] Connect projector/LED screen HDMI before launching Church Presenter
- [ ] Connect stage monitor HDMI (if using Stage Display)
- [ ] Connect any external audio interface or webcam if streaming
- [ ] Launch Church Presenter

### Verify displays are detected

- In the toolbar, click **▶ Go Live** — the display picker should list all connected displays
- If a display is missing: unplug and replug the HDMI, then restart the app

### Load service schedule

- If you prepared the schedule earlier, it loads automatically on startup
- If starting fresh: add songs, Bible passages, and announcements as above

### Open the presentation window

1. Click **▶ Go Live** → select your projector display
2. Confirm the projector shows a slide (send one with **Enter** or **Send**)
3. The presentation window header turns green and "Program live" appears in the preview area

### Open the stage display (if applicable)

1. Click **🖥️ Stage** in the toolbar
2. Move the stage window to the monitor facing the worship team if needed
3. Confirm the team can see lyrics, key, tempo, and clock
4. If stage should show independent content (not what's on the projector), uncheck **Stage mirrors program** in the preview area

### Test blackout and clear

- Press **B** — projector goes black ✓
- Press **B** again — content returns ✓
- Press **C** — text disappears, background stays ✓
- Press **C** again — text returns ✓

### Load routing preset (if using multi-output)

1. Open **📺 Outputs**
2. Click your saved preset name under **Routing Presets**
3. All output windows recreate on their assigned displays

### Test streaming (if applicable)

1. Open **📡 Stream** tab
2. Click **Open Stream Window**
3. Select your camera source — preview should appear in the panel
4. In Zoom or Teams, click **Share Screen** → select the "Stream View — Church Presenter" window
5. Test a lower-third: type text in the Lower-Third section and click **Send Lower-Third**
6. For RTMP (social media), confirm **FFmpeg found** status is green, then click **▶ Go Live — Social**

### Sermon Assistant (if using)

1. Still in the **📡 Stream** tab, scroll to the **🎙 Sermon Assist** section
2. Click **🎙 Listen** — grant microphone permission if prompted
3. Say a Bible reference aloud — it should appear in the Detected References list within a few seconds
4. Confirm the mic level meter shows bars (if all bars are flat, check OS privacy settings)

---

## During the service

### Advancing slides

| Action | Keyboard | Mouse |
|---|---|---|
| Next slide | Space or → | Click Next button |
| Previous slide | ← or Backspace | Click Prev button |
| Go live with selected slide | Enter | Click Send button |
| Advance across items | Space at last slide | Click next schedule item |

### Blackout and clear

| Situation | Use |
|---|---|
| Need to hide everything (prayer, offering) | **B** Blackout — screen goes black |
| Speaker at podium, no slides | **B** Blackout |
| Keep background visible, hide text | **C** Clear |
| Return to content | Press the same key again |

### Switching between items

- Click an item in the Schedule panel (left side) to jump to it immediately
- The slide strip at the top updates — click a specific slide or use arrow keys

### Sending a Bible verse as lower-third

1. Select the Bible verse slide in the schedule
2. In the Stream panel, click **Send as Lower-Third** in the Sermon Assist section
3. The verse appears as an animated overlay at the bottom of the stream window

### Recovering from a mistake

- **Undo** the last schedule change: **Cmd+Z** (Mac) or **Ctrl+Z** (Windows/Linux)
- **Redo**: **Cmd+Shift+Z** / **Ctrl+Shift+Z**

---

## After the service

### Close outputs

- Click **⏹ Stop Live** in the toolbar to close the presentation window
- Click **🖥️ Stage** again to close the stage display
- Close any output windows via **📺 Outputs** → close buttons

### Stop streaming

- In the Stream panel, click **⏹ Stop** for each active RTMP destination
- Click the stream window's close button to close it

### Back up your data

- See [Backup & Restore Guide](backup-restore.md) for how to copy your data files
- Recommended: copy `songs.json`, `schedules.json`, and `settings.json` to a USB drive or cloud folder after every service

### Clear the sermon transcript

- In the **📡 Stream** tab → **Sermon Assist** section, click **🗑 Clear** to reset the transcript and reference list for next week

---

## Quick reference — keyboard shortcuts

| Key | Action |
|---|---|
| Space or → | Next slide |
| ← or Backspace | Previous slide |
| Enter | Send current slide live |
| B | Toggle Blackout |
| C | Toggle Clear |
| Cmd/Ctrl + Z | Undo schedule change |
| Cmd/Ctrl + Shift + Z | Redo schedule change |

---

## Common issues during the service

| Problem | Fix |
|---|---|
| Projector goes blank | Press B to toggle Blackout off; or check HDMI cable |
| Wrong slide sent | Press ← to go back one slide; or click the correct slide |
| Stage display not updating | Check "Stage mirrors program" checkbox in the preview area |
| Lower-third won't clear | Click **Clear** in the Stream panel lower-third section |
| Stream window frozen | Close and reopen via Stream tab → **Open Stream Window** |
| App crash | Relaunch — the recovery banner offers to restore your last session |

For more, see the full [Troubleshooting Guide](troubleshooting.md).

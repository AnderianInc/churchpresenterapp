# Display Setup Guide

This guide covers connecting projectors and monitors, configuring the Stage Display for the worship team, setting up additional output windows, and saving routing presets.

---

## Hardware setup overview

Church Presenter supports any number of connected displays. A typical setup uses:

| Display | Content | Who sees it |
|---|---|---|
| Operator laptop / desktop | Church Presenter control UI | Operator only |
| Main projector or LED screen | Song lyrics, Bible verses, announcements | Congregation |
| Stage monitor (TV facing worship team) | Lyrics, key, tempo, clock, chords | Worship team |
| Lobby screen (optional) | Announcements, countdown | Lobby |
| Confidence monitor (optional) | What the pastor or host can see | Speaker |

---

## Connecting displays

1. Connect all displays **before launching** Church Presenter. Electron reads connected displays at startup.
2. If you connect a display after launch, close and relaunch the app.
3. On macOS, set your projector to **Mirror Off** (extended desktop) in System Settings → Displays.
4. On Windows, press **Win + P** and select **Extend**.

---

## Opening the main presentation window

1. Click **▶ Go Live** in the toolbar
2. If two or more displays are detected, a display picker dropdown appears next to the button — click it (▾ chevron) to select which display to use
3. The presentation window opens fullscreen on the chosen display
4. Your display selection is saved — it will be used automatically next time

**Changing the display while not live:** click the ▾ chevron next to Go Live and select a different display from the picker.

---

## Stage Display

The Stage Display is a dedicated window for the worship team. It shows:
- Current slide lyrics (large, easy to read from a distance)
- Song key and tempo (from song metadata)
- BPM (if set in the song's Metadata tab)
- Live clock
- Chord chart for the current slide (if entered in the 🎸 Chords sub-tab) — only visible on stage, never on the main projector

### Opening the stage display

1. Click **🖥️ Stage** in the toolbar
2. The stage window opens — drag it to your stage monitor and it will go fullscreen automatically (or press F11 on the stage monitor)

### Mirror vs. independent mode

By default, the stage display mirrors the program output — both show the same slide.

To send **different content** to the stage (e.g., next verse so the worship team can see ahead):
1. In the preview area, uncheck **Stage mirrors program**
2. A **▶ Stage (independent)** button appears below the main Send button
3. Select a slide and click **▶ Stage (independent)** — it goes to the stage monitor only

---

## Output Manager — multi-output routing

The Output Manager lets you create dedicated windows for different zones (lobby, confidence monitor, background screen, etc.) and assign each to any connected display.

### Opening the Output Manager

Click **📺 Outputs** in the toolbar.

### Creating an output window

1. In the **Add Output** section at the top of the panel, select a **Role**:
   - **Program** — mirrors the main presentation
   - **Stage** — mirrors the stage display
   - **Announcement** — dedicated announcement content
   - **Background** — background-only (no text)
   - **Confidence** — confidence monitor for the speaker
2. Select the **Display** to assign it to
3. Enter a **Title** (e.g. "Lobby Screen", "Confidence Monitor")
4. Click **＋ Open**

### Routing content to outputs

Each output card in the panel has two quick actions:
- **Send Preview** — pushes whatever slide is currently selected in the preview area to that output
- **Sync Program** — copies the live program slide to that output

For announcements, select the announcement slide in the schedule, then click **Send Preview** on the Announcement output card.

### Named display labels

Give each physical screen a name so it's easy to identify in the picker:
1. In the **Display Labels** section of the Output Manager, click **Edit** next to any display
2. Enter a descriptive name (e.g. "Main Projector", "Stage TV", "Lobby Monitor")
3. Labels are saved and appear in output cards and display pickers

### Routing presets

Save your entire output layout as a named preset so Sunday setup is repeatable:

1. Create all your output windows (as above)
2. In the **Routing Presets** section, type a preset name (e.g. "Sunday Morning") and click **Save**
3. Next Sunday, click **Load** next to the preset — the app closes current outputs and recreates the saved layout automatically

---

## Background outputs

The **Background** role is designed for a dedicated background screen (e.g. a rear wall projection behind the stage).

To push a background to all Background-role outputs at once:
1. Open **📺 Outputs**
2. Scroll to the **Push Background Color** section
3. Choose a background using the picker
4. Click **Push to Background Outputs**

### Video backgrounds

You can also use video files as slide or item backgrounds. Open **🖼️ Media & Backgrounds**, switch to **🎬 Video**, and choose an MP4, MOV, or WebM file. The picker lets you toggle looping on or off; looped clips are ideal for ambient worship backgrounds, while one-shot clips can be used for timed visual moments.

---

## Browser mode (no Electron)

When running in the browser (`npm start`), Church Presenter uses BroadcastChannel instead of Electron IPC. Output windows still work — they open as separate browser tabs/windows that you can move to your projector and press F11 to fullscreen.

Limitations in browser mode:
- No automatic display detection or targeting
- Online Bible search (YouVersion) not available
- RTMP social media streaming not available
- Video file persistence not available (blob URLs reset on reload)

---

## Tips

- **Always connect displays before launching** — Electron reads displays once at startup
- **Use routing presets** — saves 5–10 minutes of setup every week
- **Label your displays** — makes it obvious which output goes to which screen in a multi-display setup
- **Zoom in / fullscreen** — if the presentation window isn't filling the projector, make sure your OS is set to extended (not mirrored) display mode
- **Test blackout** — always press B and verify the projector goes black before service. If it doesn't, your presentation window may be on the wrong screen

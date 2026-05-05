import React, { useState, useMemo } from 'react';
import ExternalLink from './ExternalLink';

const sections = [
  {
    title: 'Keyboard Shortcuts',
    icon: '⌨',
    items: [
      { key: 'Space / →', desc: 'Next slide' },
      { key: '← / Backspace', desc: 'Previous slide' },
      { key: 'Enter', desc: 'Send current slide live' },
      { key: 'B', desc: 'Toggle blackout' },
      { key: 'C', desc: 'Toggle clear (text only)' },
      { key: 'F9', desc: 'Toggle performance overlay (debug)' },
      { key: 'F11', desc: 'Toggle fullscreen (Stage / Output windows)' },
    ],
  },
  {
    title: 'Service Workflow',
    icon: '📅',
    body: [
      'Add songs, scripture, or announcements to the schedule from the left panel tabs.',
      'Select an item in the Service Order to preview its slides.',
      'Click a slide thumbnail to preview it, then press Enter or click Send to go live.',
      'Use Prev / Next or keyboard arrows to advance slides during the service.',
    ],
  },
  {
    title: 'Output Manager',
    icon: '📺',
    body: [
      'Click Outputs in the toolbar (next to Stage and Go Live) to open the Output Manager.',
      'Create output windows for Program, Stage, Announcements, Background, or Confidence — each can target a different display.',
      'Confidence Monitor opens a four-quadrant stage display (current slide, next slide, timers, announcements) — ideal for a monitor facing the worship team.',
      '"Send Preview" pushes the currently selected slide to that output.',
      '"Sync Program" mirrors whatever is live on the main program output.',
      'Name each display (e.g. "Main Projector", "Stage TV") and save routing presets for fast Sunday setup.',
    ],
  },
  {
    title: 'Stage Display',
    icon: '🖥',
    body: [
      'Click Stage in the toolbar to open a dedicated monitor for the worship team.',
      'Stage shows a split-screen: current live slide on the left, next slide dimmed on the right.',
      'A live clock is always shown in the header.',
      'By default stage mirrors the program output. Uncheck "Stage mirrors program" in the Preview area to send different content to stage.',
    ],
  },
  {
    title: 'Confidence Monitor',
    icon: '🗂',
    body: [
      'The Confidence Monitor is a four-quadrant full-screen display designed for a monitor facing the worship team or stage crew.',
      'Upper-left: current live slide (text and background).',
      'Upper-right: next slide, shown dimmed so the team can prepare.',
      'Lower-left: Timers — wall clock always visible, plus any countdown or stopwatch timers you have running.',
      'Lower-right: Stage Announcements — private messages from the operator, visible only on this display.',
      'To open one: click Outputs in the toolbar → Add Output → set role to Confidence Monitor → assign it to your stage TV.',
      'Timer and announcement data are broadcast automatically when you use the ⏱ Timers tab.',
    ],
  },
  {
    title: 'Timers & Stage Announcements',
    icon: '⏱',
    body: [
      'Click ⏱ Timers in the nav bar to open the Timers panel.',
      'Three timer types: Countdown (counts down from a set duration), Stopwatch (counts up), Clock (shows the current wall clock).',
      'Add a timer: type an optional name, choose the type, set minutes and seconds (for countdown), then click + Add.',
      'Start a countdown or stopwatch with ▶ Start. Pause with ⏸, restart with ↺.',
      'The progress bar turns amber at 20% remaining and red when expired — matching the display on the Confidence Monitor.',
      'Stage Announcement: type a short message in the text box and click Send to Stage. It appears immediately in the lower-right quadrant of every open Confidence Monitor.',
      'Announcements are private — they are never shown on audience-facing output windows.',
      'Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send an announcement without reaching for the mouse.',
      'Click ✕ Clear to dismiss the current announcement from all Confidence Monitors.',
    ],
  },
  {
    title: 'Song Import',
    icon: '📥',
    body: [
      'Click "↓ Import" in the Songs panel header to open the Song Import modal.',
      'Genius Lyrics: search Genius.com for worship song lyrics — configure your Client Access Token in ⚙ Settings → Lyrics Search first.',
      'Planning Center: search your PCO song library by title or artist — configure your App ID and Secret in ⚙ Settings → Planning Center first.',
      'OpenLyrics XML: import .xml files exported from SongSelect, OpenLP, or downloaded from openlyrics.info.',
      'Paste Lyrics: paste lyrics with [Verse 1], [Chorus], [Bridge] section markers — slides are created automatically as you type.',
      'After import the song is added to your library and ready to add to the schedule.',
    ],
  },
  {
    title: 'Genius Lyrics Import',
    icon: '🎵',
    body: [
      'Search Genius.com for any worship song and import parsed lyrics directly into your library.',
      'Setup: go to genius.com/api-clients, create a new API client, and copy the Client Access Token. Paste it in ⚙ Settings → Lyrics Search.',
      'Search: type a song title or artist and press Search. Select a result to fetch lyrics automatically.',
      'Lyrics are split into slides using [Section] markers when present — otherwise the whole song becomes one slide.',
      'Edit the title and artist in the preview pane before importing.',
      'CCLI notice: lyrics from Genius are for internal, non-commercial church use. Ensure you hold a valid CCLI license for songs displayed publicly.',
    ],
  },
  {
    title: 'Song Editor',
    icon: '✏️',
    body: [
      'Open the editor by clicking Edit (pencil icon) on any song in the library.',
      'Lyrics tab: edit slides, set slide type (verse/chorus/bridge/etc.), label, and text alignment (L / C / R).',
      'Chord Chart: click the 🎸 Chords sub-tab to enter a chord chart for a slide — chords are shown on the Stage Display for the worship team and not visible to the audience.',
      'Appearance tab: choose background color, text color, font family, font size, and style presets (Large Title, Subtitle, Body, Compact).',
      'Metadata tab: record BPM, CCLI song number, and copyright year for license reporting.',
      'Tags: click preset tags or type a custom tag and press Enter to add it.',
    ],
  },
  {
    title: 'Bible Search',
    icon: '📖',
    body: [
      'KJV and NIV are bundled and work offline with no setup — open the Bible panel (📖), switch to Offline mode, and search by reference (John 3:16) or keyword.',
      'Online mode: search by reference across any of 1,000+ translations via bible.helloao.org — no account or API key required, internet connection needed.',
      'To unlock all 1,000+ offline translations from the Beblia collection:',
      '  1. Download the zip from github.com/Beblia/Holy-Bible-XML-Format (green Code → Download ZIP).',
      '  2. Extract the zip anywhere on your computer (e.g. Documents/Bibles).',
      '  3. Open the Bible panel → Browse Translations → Offline tab → Browse… and select the extracted Holy-Bible-XML-Format-master folder.',
      '  4. Star any translation to favorite it. On your first search it will load from that folder and cache automatically.',
      'The folder path is saved in settings and remembered across restarts — you only need to set it once.',
      'Single-file import: you can also drag-and-drop or use Import XML Bible (same Offline tab) to import one .xml file at a time without setting up the full folder.',
      'Add verses to the schedule: select individual results or use "Add All". Click ✕ in the search bar to clear results.',
    ],
  },
  {
    title: 'Sermon Assistant',
    icon: '🎙',
    body: [
      'The Sermon Assistant lives inside the 📡 Stream panel — open Stream to access all sermon and live-output controls in one place.',
      'Click "🎙 Listen" to activate the microphone. The app transcribes speech and detects Bible references in real time.',
      'Detected references (e.g. "John 3:16", "Romans 8:28") appear with ＋ Add (puts them in the schedule) and → LT (sends as a lower-third overlay) buttons.',
      'Verse Suggestions: Claude AI suggests thematically relevant verses automatically every ~45 seconds of new speech. Requires an Anthropic API key in ⚙ Settings → API Keys.',
      'The 14-bar level meter confirms your mic is picking up audio. If all bars stay flat, check OS privacy settings or configure in ⚙ Settings → Devices.',
      'Preferred microphone: set and test it in ⚙ Settings → Devices (live VU meter included). Speech recognition always uses your system default audio input.',
      'Privacy: no audio is stored. The transcript is sent to Anthropic only when verse suggestions are generated.',
    ],
  },
  {
    title: 'Streaming (OBS / Zoom)',
    icon: '📡',
    body: [
      'Open the 📡 Stream tab to access all stream, sermon, and lower-third controls in one place.',
      'Open Stream Window launches a 1280×720 window — screen-share this in Zoom or Teams.',
      'Camera: set your preferred camera in ⚙ Settings → Devices. The Stream panel previews and sends that camera automatically.',
      'Lower-Third sends an animated text overlay to the bottom of the stream window.',
      'Blackout from the toolbar also clears the stream window instantly.',
    ],
  },
  {
    title: 'Social Media Streaming',
    icon: '🔴',
    body: [
      'Configure platforms and stream keys in ⚙ Settings → 📡 Social Media tab.',
      'Supported: Facebook Live, YouTube Live, Instagram Live, and any custom RTMP endpoint.',
      'Requires FFmpeg installed on your system (brew install ffmpeg on macOS, winget install ffmpeg on Windows).',
      'Open the Stream Window first, then click Go Live — Social in the Stream panel.',
      'Multiple platforms can stream simultaneously — each enabled destination receives the same feed.',
    ],
  },
  {
    title: 'Settings',
    icon: '⚙',
    body: [
      'Open ⚙ Settings from the nav bar. Settings are organized into tabs:',
      '🔑 API Keys — Genius (lyrics import), Planning Center (song library import), Anthropic (AI verse suggestions), and the Offline Bible XML folder for the full Beblia translation library. All keys and paths are stored locally and never uploaded.',
      '📡 Social Media — Add and manage RTMP streaming destinations (Facebook Live, YouTube Live, Instagram, custom RTMP). Configure stream keys here, then go live from the 📡 Stream panel.',
      '🎙 Devices — Set your preferred microphone for the Sermon Assistant level meter, preferred camera for the Stream panel, and presentation font/size defaults.',
      'Offline Bible folder: set it in ⚙ Settings → API Keys → Offline Bible — Beblia Collection → Browse… to enable all 1,000+ offline translations. See the Bible Search help topic above for the full setup steps.',
      'Timers and the Confidence Monitor require no settings configuration — open ⏱ Timers in the nav bar to get started immediately.',
    ],
  },
  {
    title: 'Performance & Diagnostics',
    icon: '📊',
    body: [
      'Press F9 anywhere in the app to toggle the Performance Overlay — a draggable HUD showing live metrics.',
      'Renderer section: FPS (frames per second), JS heap usage, slide-change latency (time from operator click to screen update), and session uptime.',
      'Main process section: RSS memory, Node heap, CPU%, slide change count, and startup time.',
      'Color coding — green: healthy, yellow: watch, red: investigate. Targets: ≥55 FPS, <200 MB heap growth per 2-hour session, <100 ms slide latency.',
      'The overlay has zero cost when hidden — it only polls every 500 ms while visible.',
      'Performance logs are written to <userData>/logs/perf.ndjson (rotated at 5 MB). Path shown in the overlay header.',
      'Error log: ⚙ Settings → 📋 Logs shows all captured errors and warnings with timestamps, source, and stack traces. Use the filter buttons to focus on errors only.',
      'Log actions: Refresh reloads from memory, Copy copies all visible entries to the clipboard, Open Folder reveals the log files on disk, Clear wipes the in-memory list.',
      'macOS log path: ~/Library/Application Support/church-presenter/logs/app.log',
      'Windows log path: %APPDATA%\\church-presenter\\logs\\app.log',
    ],
  },
  {
    title: 'Blackout & Clear',
    icon: '⬛',
    body: [
      'Blackout (B) hides all content on every output window — the screen goes black.',
      'Clear (C) hides only the text/slides while keeping the background visible.',
      'Both controls apply to Program, Stage, all Output windows, and the Stream window.',
    ],
  },
  {
    title: 'Data & Backup',
    icon: '💾',
    body: [
      'All data is stored as local JSON — no internet connection required after setup.',
      'macOS: ~/Library/Application Support/church-presenter/data/',
      'Windows: %APPDATA%\\church-presenter\\data\\',
      'Files: songs.json, schedules.json, settings.json — back these up regularly.',
    ],
  },
];

function ShortcutRow({ kb, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <kbd style={{
        background: '#1e2430', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4, padding: '2px 7px', fontSize: 10, fontFamily: 'monospace',
        color: 'var(--text)', flexShrink: 0, minWidth: 80, textAlign: 'center',
        boxShadow: '0 1px 0 rgba(255,255,255,0.1)',
      }}>{kb}</kbd>
      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</span>
    </div>
  );
}

function HelpSection({ section, forceOpen }) {
  const [open, setOpen] = useState(true);
  const isOpen = forceOpen || open;
  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: isOpen ? 'rgba(79,142,247,0.06)' : 'rgba(255,255,255,0.02)',
          border: 'none', padding: '9px 12px', cursor: 'pointer',
          borderBottom: isOpen ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: 14 }}>{section.icon}</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>{section.title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.01)' }}>
          {section.items ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item, i) => (
                <ShortcutRow key={i} kb={item.key} desc={item.desc} />
              ))}
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {section.body.map((line, i) => (
                <li key={i} style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpPanel({ inline = false }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(s => {
      if (s.title.toLowerCase().includes(q)) return true;
      if (s.items) return s.items.some(it => it.key.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q));
      if (s.body) return s.body.some(line => line.toLowerCase().includes(q));
      return false;
    });
  }, [search]);

  const inner = (
    <>
      {/* Search bar */}
      <div style={{ padding: inline ? '8px 14px' : '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {!inline && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Help & Quick Reference</div>}
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search help topics…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text)', padding: '5px 28px 5px 9px',
              fontSize: 11, fontFamily: 'var(--font)', outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {search ? (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
            }}>✕</button>
          ) : (
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-dim)', pointerEvents: 'none' }}>🔍</span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
            No results for "{search}"
          </div>
        ) : (
          filtered.map(s => <HelpSection key={s.title} section={s} forceOpen={!!search} />)
        )}

        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Found a bug or need help?<br />
            <ExternalLink href="https://github.com/anderianinc/churchpresenterapp">github.com/anderianinc/churchpresenterapp</ExternalLink>
          </div>
        </div>
      </div>
    </>
  );

  // inline = rendered inside another panel (e.g. Settings Help tab) — no outer sidebar wrapper
  if (inline) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{
      width: 280, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {inner}
    </div>
  );
}

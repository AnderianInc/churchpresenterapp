import React, { useState } from 'react';

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
      'Stage shows lyrics, song key, tempo, and a live clock.',
      'By default stage mirrors the program output. Uncheck "Stage mirrors program" in the Preview area to send different content to stage.',
    ],
  },
  {
    title: 'Song Import',
    icon: '📥',
    body: [
      'Click "↓ Import" in the Songs panel header to open the Song Import modal.',
      'Planning Center: search your PCO song library by title or artist — configure your App ID and Secret in ⚙ Settings → Planning Center first.',
      'OpenLyrics XML: import .xml files exported from SongSelect, OpenLP, or downloaded from openlyrics.info.',
      'Paste Lyrics: paste lyrics with [Verse 1], [Chorus], [Bridge] section markers — slides are created automatically as you type.',
      'After import the song is added to your library and ready to add to the schedule.',
    ],
  },
  {
    title: 'Bible Search',
    icon: '📖',
    body: [
      'Offline: search by reference (John 3:16) or keyword across all installed translations simultaneously (KJV and NIV included).',
      'Online (YouVersion): set up your API key in ⚙ Settings → API Keys to enable online reference lookup.',
      'Select individual verses or use "Add All" to add them to the schedule as slides.',
      'Click ✕ in the search bar to clear results and start a new search.',
    ],
  },
  {
    title: 'Sermon Assistant',
    icon: '🎙',
    body: [
      'Click the 🎙 Sermon tab to open the Sermon Assistant panel.',
      'Click "Start Listening" to activate the microphone — the app listens for Bible references in real time.',
      'Detected references (e.g. "John 3:16", "Romans 8:28") appear instantly. Click ＋ Add to add them to the schedule, or LT to send as a lower-third overlay.',
      'Click "Suggest Verses from Sermon" to ask Claude AI for thematically relevant verses based on what has been transcribed. Requires an Anthropic API key in ⚙ Settings → AI.',
      'Privacy: no audio is stored. The transcript is only sent to Anthropic when you click "Suggest Verses".',
    ],
  },
  {
    title: 'Streaming (OBS / Zoom)',
    icon: '📡',
    body: [
      'Open the Stream tab to access streaming controls.',
      'Open Stream Window launches a 1280×720 window — screen-share this in Zoom or Teams.',
      'Select a camera source (webcam or OBS Virtual Camera) and click Send to Stream to show it in the stream window.',
      'Lower-Third sends an animated text overlay to the bottom of the stream window.',
      'Blackout from the toolbar also clears the stream window instantly.',
    ],
  },
  {
    title: 'Social Media Streaming',
    icon: '🔴',
    body: [
      'Configure platforms and stream keys in ⚙ Settings → Social Media Streaming.',
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
      'Open ⚙ Settings from the nav bar.',
      'API Keys: save your YouVersion API key here — it persists across sessions and auto-fills in the Bible panel.',
      'Social Media Streaming: add and manage RTMP destinations and stream keys.',
      'Presentation Defaults: set the default font and font size for new slides.',
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

function HelpSection({ section }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: open ? 'rgba(79,142,247,0.06)' : 'rgba(255,255,255,0.02)',
          border: 'none', padding: '9px 12px', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: 14 }}>{section.icon}</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>{section.title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
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

export default function HelpPanel() {
  return (
    <div style={{
      width: 280, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Help & Quick Reference</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Click a section to expand or collapse</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {sections.map(s => <HelpSection key={s.title} section={s} />)}

        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Found a bug or need help?<br />
            Report issues at{' '}
            <span style={{ color: 'var(--accent)' }}>github.com/anderianinc/churchpresenterapp</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';

const btn = (extra = {}) => ({
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'transparent', border: 'none',
  color: 'var(--text-muted)', padding: '5px 10px',
  borderRadius: 'var(--radius)', cursor: 'pointer',
  fontSize: 12, fontFamily: 'var(--font)',
  transition: 'all 0.15s', ...extra,
});

export default function Toolbar({ onNewSong, onOpenSettings }) {
  const {
    isBlackout, isClear,
    toggleBlackout, toggleClear,
    stageOpen, outputWindows,
    openStage, closeStage,
    activeView, setActiveView,
    settingsOpen, setSettingsOpen,
    saveStatus,
    goLive, currentSlide, currentItem,
    createOutputWindow, displays,
  } = useApp();

  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setClock(`${h}:${m} ${ap}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleGoLive = async () => {
    if (!currentSlide || !currentItem) return;
    const slide = { ...currentSlide, item: currentItem };

    if (outputWindows.length === 0) {
      // No output windows configured — auto-create a presentation output on the
      // best available display (second display if present, otherwise primary).
      const bestDisplay = (displays?.length ?? 0) > 1 ? 1 : 0;
      await createOutputWindow({ role: 'presentation', displayIdx: bestDisplay, title: 'Program' });
      // Give the output window a moment to mount and register its IPC listener
      await new Promise(r => setTimeout(r, 400));
    }

    goLive(slide);
  };

  const canGoLive = !!(currentSlide && currentItem);

  const tabStyle = (view) => ({
    ...btn(),
    color: activeView === view ? 'var(--accent)' : 'var(--text-muted)',
    background: activeView === view ? 'rgba(79,142,247,0.1)' : 'transparent',
    borderBottom: activeView === view ? '2px solid var(--accent)' : '2px solid transparent',
    borderRadius: 0, padding: '6px 12px',
  });

  const SaveIndicator = () => {
    if (!saveStatus || saveStatus === 'saved') return null;
    const colors = { saving: 'var(--yellow)', error: 'var(--red)' };
    const labels = { saving: '● Saving…', error: '⚠ Save failed' };
    return (
      <span style={{ fontSize: 10, color: colors[saveStatus] || 'var(--text-dim)', marginRight: 4 }}>
        {labels[saveStatus] || ''}
      </span>
    );
  };

  return (
    <div style={{
      background: '#141720', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 8px',
      gap: 2, height: 44, flexShrink: 0,
      WebkitAppRegion: 'drag',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12, WebkitAppRegion: 'no-drag' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>CP</span>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', WebkitAppRegion: 'no-drag' }}>
        <button style={tabStyle('schedule')} onClick={() => setActiveView('schedule')}>📅 Schedule</button>
        <button style={tabStyle('library')} onClick={() => setActiveView('library')}>🎵 Songs</button>
        <button style={tabStyle('bible')} onClick={() => setActiveView('bible')}>📖 Bible</button>
        <button style={tabStyle('media')} onClick={() => setActiveView('media')}>🖼️ Media</button>
        <button style={tabStyle('announcements')} onClick={() => setActiveView('announcements')}>📢 Announcements</button>
        <button style={tabStyle('stream')} onClick={() => setActiveView('stream')}>📡 Stream</button>
        <button style={tabStyle('timers')} onClick={() => setActiveView('timers')}>⏱ Timers</button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' }}>
        <SaveIndicator />

        {/* Keyboard shortcut hint */}
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>
          Space=Next · B=Blackout · Enter=Live
        </span>

        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />

        <button onClick={toggleBlackout} title="Blackout (B)"
          style={{
            ...btn(), color: isBlackout ? '#fff' : 'var(--text-muted)',
            background: isBlackout ? '#222' : 'transparent',
            border: isBlackout ? '1px solid #555' : '1px solid transparent',
          }}
          onMouseEnter={e => !isBlackout && (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => !isBlackout && (e.currentTarget.style.background = 'transparent')}
        >⬛ Blackout</button>

        <button onClick={toggleClear} title="Clear (C)"
          style={{
            ...btn(), color: isClear ? 'var(--orange)' : 'var(--text-muted)',
            background: isClear ? 'rgba(249,115,22,0.1)' : 'transparent',
            border: isClear ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent',
          }}
          onMouseEnter={e => !isClear && (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => !isClear && (e.currentTarget.style.background = 'transparent')}
        >✕ Clear</button>

        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />

        <button onClick={stageOpen ? closeStage : openStage} title="Stage Display"
          style={{
            ...btn(),
            color: stageOpen ? 'var(--purple)' : 'var(--text-muted)',
            background: stageOpen ? 'rgba(168,85,247,0.1)' : 'transparent',
          }}
          onMouseEnter={e => !stageOpen && (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => !stageOpen && (e.currentTarget.style.background = 'transparent')}
        >🖥️ Stage</button>

        <button
          onClick={() => onOpenSettings ? onOpenSettings('keys') : setSettingsOpen(v => !v)}
          title="Settings"
          style={{
            ...btn(),
            color: settingsOpen ? 'var(--text)' : 'var(--text-muted)',
            background: settingsOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: settingsOpen ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
          }}
          onMouseEnter={e => !settingsOpen && (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => !settingsOpen && (e.currentTarget.style.background = 'transparent')}
        >⚙ Settings</button>

        <button
          onClick={() => onOpenSettings ? onOpenSettings('help') : setSettingsOpen(true)}
          title="Help"
          style={{
            ...btn(),
            color: 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >❔ Help</button>

        <button
          onClick={() => setActiveView('outputs')}
          title="Output Manager"
          style={{
            ...btn(),
            color: activeView === 'outputs' ? 'var(--accent)' : outputWindows.length ? 'var(--accent)' : 'var(--text-muted)',
            background: activeView === 'outputs' ? 'rgba(79,142,247,0.15)' : outputWindows.length ? 'rgba(79,142,247,0.07)' : 'transparent',
            border: activeView === 'outputs' ? '1px solid rgba(79,142,247,0.4)' : '1px solid transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = activeView === 'outputs' ? 'rgba(79,142,247,0.15)' : outputWindows.length ? 'rgba(79,142,247,0.07)' : 'transparent'}
        >
          📺 {outputWindows.length > 0 ? `Outputs (${outputWindows.length})` : 'Outputs'}
        </button>

        {/* Go Live — pushes current slide to all configured output windows */}
        <button
          onClick={handleGoLive}
          disabled={!canGoLive}
          title={canGoLive ? 'Go Live (Enter)' : 'Select a slide first'}
          style={{
            background: 'var(--accent)',
            border: 'none', color: '#fff',
            padding: '6px 16px',
            cursor: canGoLive ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600,
            fontFamily: 'var(--font)',
            borderRadius: 'var(--radius)',
            opacity: canGoLive ? 1 : 0.45,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (canGoLive) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { if (canGoLive) e.currentTarget.style.opacity = '1'; }}
        >▶ Go Live</button>

        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>{clock}</span>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';

const btn = (extra = {}) => ({
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'transparent', border: 'none',
  color: 'var(--text-muted)', padding: '5px 10px',
  borderRadius: 'var(--radius)', cursor: 'pointer',
  fontSize: 12, fontFamily: 'var(--font)',
  transition: 'all 0.15s', ...extra,
});

function DisplayPicker({ displays, onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 46, right: 0, zIndex: 200,
      background: '#1e2128', border: '1px solid var(--border)',
      borderRadius: 8, padding: 6, minWidth: 220,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '4px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Select output display
      </div>
      {displays.map(d => (
        <button key={d.index} onClick={() => { onSelect(d.index); onClose(); }} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'transparent', border: 'none', color: 'var(--text)',
          padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
          fontFamily: 'var(--font)', fontSize: 12, textAlign: 'left',
          transition: 'background 0.12s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 16 }}>{d.isPrimary ? '🖥️' : '📺'}</span>
          <div>
            <div style={{ fontWeight: 500 }}>{d.label}</div>
            {d.isPrimary && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Primary (this screen)</div>}
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Toolbar({ onNewSong, onOpenSettings }) {
  const {
    isBlackout, isClear,
    toggleBlackout, toggleClear,
    presentationOpen, stageOpen, outputWindows,
    openPresentation, closePresentation,
    openStage, closeStage,
    activeView, setActiveView,
    settingsOpen, setSettingsOpen,
    saveStatus,
    settings, saveSettings,
  } = useApp();

  const [clock, setClock] = useState('');
  const [displays, setDisplays] = useState([]);
  const [showDisplayPicker, setShowDisplayPicker] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState(1);
  const goLiveBtnRef = useRef(null);

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

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDisplays().then(d => {
        setDisplays(d);
        // Restore preferred display from settings if it still exists
        const preferred = settings?.preferredDisplayIndex;
        if (preferred != null) {
          const found = d.find(x => x.index === preferred);
          if (found) { setSelectedDisplay(preferred); return; }
          // Preferred display no longer connected — fall through to default
        }
        // Default to first non-primary display if available
        const ext = d.find(x => !x.isPrimary);
        if (ext) setSelectedDisplay(ext.index);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; settings are loaded before Toolbar mounts

  const handleGoLive = () => {
    if (presentationOpen) {
      closePresentation();
    } else if (displays.length > 1) {
      setShowDisplayPicker(true);
    } else {
      openPresentation(selectedDisplay);
    }
  };

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

        {/* Go Live button + display picker */}
        <div style={{ position: 'relative' }} ref={goLiveBtnRef}>
          <div style={{ display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <button onClick={handleGoLive} title="Go Live (Enter)"
              style={{
                background: presentationOpen ? 'var(--red)' : 'var(--accent)',
                border: 'none', color: '#fff',
                padding: '6px 14px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font)', transition: 'opacity 0.15s',
                borderRadius: displays.length > 1 && !presentationOpen ? '6px 0 0 6px' : 'var(--radius)',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {presentationOpen ? '⏹ Stop Live' : '▶ Go Live'}
            </button>

            {/* Display selector chevron — only in Electron with multiple displays, not while live */}
            {displays.length > 1 && !presentationOpen && (
              <button onClick={() => setShowDisplayPicker(v => !v)}
                title="Choose output display"
                style={{
                  background: 'var(--accent-dark)', border: 'none', color: '#fff',
                  padding: '6px 7px', cursor: 'pointer', fontSize: 10,
                  borderLeft: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '0 6px 6px 0',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >▾</button>
            )}
          </div>

          {showDisplayPicker && displays.length > 0 && (
            <DisplayPicker
              displays={displays}
              onSelect={(idx) => {
                setSelectedDisplay(idx);
                saveSettings({ preferredDisplayIndex: idx });
                openPresentation(idx);
              }}
              onClose={() => setShowDisplayPicker(false)}
            />
          )}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>{clock}</span>
      </div>
    </div>
  );
}

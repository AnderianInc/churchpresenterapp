import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import Toolbar from './Toolbar';
import SchedulePanel from './SchedulePanel';
import SlideEditor from './SlideEditor';
import PreviewArea from './PreviewArea';
import LibraryPanel from './LibraryPanel';
import BiblePanel from './BiblePanel';
import MediaPanel from './MediaPanel';
import AnnouncementPanel from './AnnouncementPanel';
import StreamPanel from './StreamPanel';
import OutputManager from './OutputManager';
import SettingsPanel from './SettingsPanel';
import SongEditorModal from './SongEditorModal';

// ── Draggable / resizable floating window shell ───────────────────────────────
function FloatingWindow({ title, icon, onClose, children }) {
  const [size, setSize] = useState(() => ({
    w: 360,
    h: Math.min(700, window.innerHeight - 70),
  }));
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, Math.round((window.innerWidth - 360) / 2)),
    y: Math.max(44, Math.round((window.innerHeight - Math.min(700, window.innerHeight - 70)) / 2)),
  }));
  const [minimized, setMinimized] = useState(false);
  const dragging = useRef(null); // { startMX, startMY, startPX, startPY }
  const resizing = useRef(null); // { startMX, startMY, startW, startH }

  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        const { startMX, startMY, startPX, startPY } = dragging.current;
        setPos({
          x: Math.max(0, startPX + e.clientX - startMX),
          y: Math.max(44, startPY + e.clientY - startMY),
        });
      }
      if (resizing.current) {
        const { startMX, startMY, startW, startH } = resizing.current;
        setSize({
          w: Math.max(300, startW + e.clientX - startMX),
          h: Math.max(220, startH + e.clientY - startMY),
        });
      }
    };
    const onUp = () => { dragging.current = null; resizing.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onDragStart = (e) => {
    if (e.button !== 0) return;
    dragging.current = { startMX: e.clientX, startMY: e.clientY, startPX: pos.x, startPY: pos.y };
    e.preventDefault();
  };

  const onResizeStart = (e) => {
    if (e.button !== 0) return;
    resizing.current = { startMX: e.clientX, startMY: e.clientY, startW: size.w, startH: size.h };
    e.preventDefault();
    e.stopPropagation();
  };

  const titleBtnStyle = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-dim)', width: 22, height: 22, borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, lineHeight: 1, padding: 0, fontFamily: 'var(--font)', flexShrink: 0,
    transition: 'background 0.12s, color 0.12s',
  };

  return (
    <div style={{
      position: 'fixed',
      left: pos.x, top: pos.y,
      width: size.w,
      height: minimized ? 'auto' : size.h,
      zIndex: 300,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-sidebar)',
      border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: 10,
      boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
      overflow: 'hidden',
      minWidth: 300,
    }}>
      {/* Drag handle / title bar */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 10px',
          background: '#15181f',
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.07)',
          cursor: 'grab', flexShrink: 0, userSelect: 'none',
        }}
      >
        {icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>}
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>

        {/* Minimize */}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setMinimized(v => !v)}
          title={minimized ? 'Expand' : 'Minimize'}
          style={titleBtnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
        >
          {minimized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          )}
        </button>

        {/* Close */}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          title="Close"
          style={titleBtnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Content */}
      {!minimized && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </div>
      )}

      {/* Resize grip (bottom-right) */}
      {!minimized && (
        <div
          onMouseDown={onResizeStart}
          title="Drag to resize"
          style={{
            position: 'absolute', right: 0, bottom: 0,
            width: 20, height: 20, cursor: 'nwse-resize', zIndex: 1,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: 3,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
            <line x1="9" y1="1" x2="1" y2="9" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="9" y1="5" x2="5" y2="9" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

const styles = {
  app: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: 'var(--bg)', overflow: 'hidden',
  },
  main: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  center: {
    display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
  },
};

export default function MainLayout() {
  const { activeView, loaded, nextSlide, prevSlide, goLive, currentSlide, currentItem, toggleBlackout, toggleClear, settingsOpen, setSettingsOpen, undoSchedule, redoSchedule, recoveryData, setRecoveryData, restoreRecovery } = useApp();
  const [songEditorOpen, setSongEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState('keys');

  const openSettings = useCallback((tab = 'keys') => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  const openNewSong = () => { setEditingSong(null); setSongEditorOpen(true); };
  const openEditSong = (song) => { setEditingSong(song); setSongEditorOpen(true); };

  const handleGoLive = useCallback(() => {
    if (currentSlide && currentItem) goLive({ ...currentSlide, item: currentItem });
  }, [currentSlide, currentItem, goLive]);

  useKeyboardShortcuts({
    onNext: nextSlide,
    onPrev: prevSlide,
    onGoLive: handleGoLive,
    onBlackout: toggleBlackout,
    onClear: toggleClear,
    onUndo: undoSchedule,
    onRedo: redoSchedule,
  });

  if (!loaded) {
    return (
      <div style={{ ...styles.app, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <Toolbar onNewSong={openNewSong} onOpenSettings={openSettings} />
      <div style={styles.main}>
        <SchedulePanel />
        <div style={styles.center}>
          <SlideEditor />
          <PreviewArea />
        </div>
        {activeView === 'library' && <LibraryPanel onEditSong={openEditSong} onNewSong={openNewSong} />}
        {activeView === 'bible' && <BiblePanel />}
        {activeView === 'media' && <MediaPanel />}
        {activeView === 'announcements' && <AnnouncementPanel />}
        {activeView === 'stream' && <StreamPanel />}
        {activeView === 'outputs' && <OutputManager />}
        {activeView === 'schedule' && (
          <div style={{
            width: 260, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 12, padding: 16,
          }}>
            Use the schedule panel on the left to manage service order and preview selections.
          </div>
        )}
      </div>
      {songEditorOpen && (
        <SongEditorModal
          song={editingSong}
          onClose={() => setSongEditorOpen(false)}
        />
      )}

      {/* Floating Settings window — draggable, resizable, minimizable */}
      {settingsOpen && (
        <FloatingWindow
          title="Settings"
          icon="⚙"
          onClose={() => setSettingsOpen(false)}
        >
          <SettingsPanel hideTitle initialTab={settingsInitialTab} />
        </FloatingWindow>
      )}

      {/* Crash-safe recovery banner */}
      {recoveryData && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1e2a', border: '1px solid #d97706',
          borderRadius: 10, padding: '12px 16px', zIndex: 400,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxWidth: 480, width: 'calc(100vw - 40px)',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>Unsaved session found</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              A previous session had unsaved changes. Restore to recover your work.
            </div>
          </div>
          <button
            onClick={() => restoreRecovery(recoveryData)}
            style={{
              background: '#d97706', border: 'none', color: '#fff',
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)', flexShrink: 0,
            }}
          >Restore</button>
          <button
            onClick={() => { localStorage.removeItem('cp_recovery_snapshot'); setRecoveryData(null); }}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-dim)', padding: '6px 10px', borderRadius: 6,
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', flexShrink: 0,
            }}
          >Dismiss</button>
        </div>
      )}
    </div>
  );
}

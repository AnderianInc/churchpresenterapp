import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp, BROADCAST_CHANNEL } from '../store/AppContext';
import { shouldAcceptYtState, muteCommandFor } from '../utils/youtubeControl';
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
import TimerPanel from './TimerPanel';
import OutputManager from './OutputManager';
import SettingsPanel from './SettingsPanel';
import SongEditorModal from './SongEditorModal';

function fmtTime(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ── Draggable / resizable floating window shell ───────────────────────────────
function FloatingWindow({ title, icon, onClose, children, initialW = 360, initialH }) {
  const defaultH = initialH ?? Math.min(700, window.innerHeight - 70);
  const [size, setSize] = useState(() => ({
    w: initialW,
    h: defaultH,
  }));
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, Math.round((window.innerWidth - initialW) / 2)),
    y: Math.max(44, Math.round((window.innerHeight - defaultH) / 2)),
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

// ── Floating YouTube playback controller ──────────────────────────────────────

function YouTubeController({ liveYt, sendYouTubeControl, setActiveView }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [dismissed, setDismissed] = useState(false);
  const lastActionRef = useRef(0);
  const prevIdRef = useRef(null);

  // Auto-show when a new video goes live
  useEffect(() => {
    if (liveYt?.value && liveYt.value !== prevIdRef.current) {
      prevIdRef.current = liveYt.value;
      setIsMuted(true);
      setIsPlaying(false);
      setVolume(80);
      lastActionRef.current = 0;
      setDismissed(false);
    }
  }, [liveYt]);

  // Subscribe to youtube-state relay from output window
  useEffect(() => {
    const handleState = (payload) => {
      if (!shouldAcceptYtState(lastActionRef.current, Date.now())) return;
      if (payload.isMuted !== undefined) setIsMuted(payload.isMuted);
      if (payload.isPlaying !== undefined) setIsPlaying(payload.isPlaying);
      if (payload.volume !== undefined && payload.volume >= 0) setVolume(payload.volume);
    };

    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'youtube-state') handleState(payload);
      };
    }
    let offYt;
    if (window.electronAPI?.onReceiveYouTubeState) {
      offYt = window.electronAPI.onReceiveYouTubeState(handleState);
    }
    return () => {
      ch?.close();
      offYt?.();
    };
  }, []);

  if (!liveYt || dismissed) return null;

  const sliderTrackStyle = {
    flex: 1, height: 4, borderRadius: 2,
    background: `linear-gradient(to right, #4f8ef7 ${volume}%, rgba(255,255,255,0.15) ${volume}%)`,
    cursor: 'pointer', outline: 'none', appearance: 'none',
    WebkitAppearance: 'none',
  };

  const ctrlBtn = (active) => ({
    flex: 1, padding: '5px 0', borderRadius: 5,
    background: active ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.07)',
    border: active ? '1px solid rgba(79,142,247,0.4)' : '1px solid rgba(255,255,255,0.12)',
    color: active ? '#4f8ef7' : 'var(--text)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
  });

  return (
    <FloatingWindow
      title={liveYt.name || `YouTube: ${liveYt.value}`}
      icon={<span style={{ color: '#ef4444', fontSize: 10 }}>●</span>}
      onClose={() => setDismissed(true)}
      initialW={300}
      initialH={220}
    >
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Thumbnail */}
        <div style={{
          borderRadius: 6, overflow: 'hidden', flexShrink: 0,
          aspectRatio: '16/9', background: '#000', position: 'relative',
        }}>
          <img
            src={`https://img.youtube.com/vi/${liveYt.value}/hqdefault.jpg`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
              color: '#ef4444', background: 'rgba(0,0,0,0.65)', padding: '2px 7px', borderRadius: 3,
            }}>● Live</div>
          </div>
        </div>

        {/* Play / Pause + Mute row */}
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={() => {
              const next = !isPlaying;
              lastActionRef.current = Date.now();
              setIsPlaying(next);
              sendYouTubeControl(next ? 'playVideo' : 'pauseVideo', []);
            }}
            style={ctrlBtn(isPlaying)}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >{isPlaying ? '⏸ Pause' : '▶ Play'}</button>

          <button
            onClick={() => {
              lastActionRef.current = Date.now();
              sendYouTubeControl('seekTo', [0, true]);
              setIsPlaying(true);
              sendYouTubeControl('playVideo', []);
            }}
            style={{ ...ctrlBtn(false), flex: 'none', padding: '5px 12px' }}
            title="Restart from beginning"
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >↩</button>

          <button
            onClick={() => {
              const next = !isMuted;
              lastActionRef.current = Date.now();
              setIsMuted(next);
              sendYouTubeControl(muteCommandFor(next), []);
            }}
            style={{ ...ctrlBtn(false), flex: 'none', padding: '5px 12px' }}
            title={isMuted ? 'Unmute' : 'Mute'}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >{isMuted ? '🔇' : '🔊'}</button>
        </div>

        {/* Volume slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 44 }}>Vol {volume}</span>
          <input
            type="range" min={0} max={100} value={volume}
            style={sliderTrackStyle}
            onChange={(e) => {
              const v = Number(e.target.value);
              lastActionRef.current = Date.now();
              setVolume(v);
              sendYouTubeControl('setVolume', [v]);
              if (v > 0 && isMuted) { setIsMuted(false); sendYouTubeControl('unMute', []); }
            }}
          />
        </div>

        {/* Open in Media link */}
        <button
          onClick={() => setActiveView('media')}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-dim)',
            fontSize: 10, cursor: 'pointer', textAlign: 'left', padding: 0,
            fontFamily: 'var(--font)', textDecoration: 'underline',
          }}
        >Open in Media &amp; Backgrounds</button>
      </div>
    </FloatingWindow>
  );
}

// ── Floating video background playback controller ─────────────────────────────

function VideoController({ liveVideo, sendVideoControl, setActiveView }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true); // video autoPlays on mount
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const isSeekingRef = useRef(false);
  const lastActionRef = useRef(0);
  const prevValueRef = useRef(null);

  // Auto-show and reset state when a new video goes live
  useEffect(() => {
    if (liveVideo?.value && liveVideo.value !== prevValueRef.current) {
      prevValueRef.current = liveVideo.value;
      setIsMuted(true);
      setIsPlaying(true);
      setVolume(80);
      setCurrentTime(0);
      setDuration(0);
      lastActionRef.current = 0;
      setDismissed(false);
    }
  }, [liveVideo]);

  // Subscribe to video-state relay from output window
  useEffect(() => {
    const handleState = (payload) => {
      if (!shouldAcceptYtState(lastActionRef.current, Date.now())) return;
      if (payload.isMuted !== undefined) setIsMuted(payload.isMuted);
      if (payload.isPlaying !== undefined) setIsPlaying(payload.isPlaying);
      if (payload.volume !== undefined && payload.volume >= 0) setVolume(payload.volume);
      if (!isSeekingRef.current) {
        if (payload.currentTime !== undefined) setCurrentTime(payload.currentTime);
        if (payload.duration !== undefined && payload.duration > 0) setDuration(payload.duration);
      }
    };

    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'video-state') handleState(payload);
      };
    }
    let offVideo;
    if (window.electronAPI?.onReceiveVideoState) {
      offVideo = window.electronAPI.onReceiveVideoState(handleState);
    }
    return () => {
      ch?.close();
      offVideo?.();
    };
  }, []);

  if (!liveVideo || dismissed) return null;

  const sliderTrackStyle = {
    flex: 1, height: 4, borderRadius: 2,
    background: `linear-gradient(to right, #4f8ef7 ${volume}%, rgba(255,255,255,0.15) ${volume}%)`,
    cursor: 'pointer', outline: 'none', appearance: 'none',
    WebkitAppearance: 'none',
  };

  const ctrlBtn = (active) => ({
    flex: 1, padding: '5px 0', borderRadius: 5,
    background: active ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.07)',
    border: active ? '1px solid rgba(79,142,247,0.4)' : '1px solid rgba(255,255,255,0.12)',
    color: active ? '#4f8ef7' : 'var(--text)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
  });

  return (
    <FloatingWindow
      title={liveVideo.name || 'Video Background'}
      icon="🎬"
      onClose={() => setDismissed(true)}
      initialW={300}
      initialH={220}
    >
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '1px' }}>● LIVE</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {liveVideo.name || 'Video Background'}
          </span>
        </div>

        {/* Play / Pause + Mute row */}
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={() => {
              const next = !isPlaying;
              lastActionRef.current = Date.now();
              setIsPlaying(next);
              sendVideoControl(next ? 'play' : 'pause', []);
            }}
            style={ctrlBtn(isPlaying)}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >{isPlaying ? '⏸ Pause' : '▶ Play'}</button>

          <button
            onClick={() => {
              const next = !isMuted;
              lastActionRef.current = Date.now();
              setIsMuted(next);
              sendVideoControl(next ? 'mute' : 'unmute', []);
            }}
            style={{ ...ctrlBtn(false), flex: 'none', padding: '5px 12px' }}
            title={isMuted ? 'Unmute' : 'Mute'}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >{isMuted ? '🔇' : '🔊'}</button>
        </div>

        {/* Seek slider */}
        {duration > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 44, flexShrink: 0 }}>
              {fmtTime(currentTime)}
            </span>
            <input
              type="range" min={0} max={duration} step={0.5}
              value={currentTime}
              style={{
                ...sliderTrackStyle,
                background: `linear-gradient(to right, #4f8ef7 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.15) ${(currentTime / duration) * 100}%)`,
              }}
              onMouseDown={() => { isSeekingRef.current = true; }}
              onMouseUp={(e) => {
                const t = Number(e.target.value);
                isSeekingRef.current = false;
                setCurrentTime(t);
                lastActionRef.current = Date.now();
                sendVideoControl('seek', [t]);
              }}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
            />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 44, flexShrink: 0, textAlign: 'right' }}>
              {fmtTime(duration)}
            </span>
          </div>
        )}

        {/* Volume slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 44 }}>Vol {volume}</span>
          <input
            type="range" min={0} max={100} value={volume}
            style={sliderTrackStyle}
            onChange={(e) => {
              const v = Number(e.target.value);
              lastActionRef.current = Date.now();
              setVolume(v);
              sendVideoControl('setVolume', [v]);
              if (v > 0 && isMuted) { setIsMuted(false); sendVideoControl('unmute', []); }
            }}
          />
        </div>

        {/* Open in Media link */}
        <button
          onClick={() => setActiveView('media')}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-dim)',
            fontSize: 10, cursor: 'pointer', textAlign: 'left', padding: 0,
            fontFamily: 'var(--font)', textDecoration: 'underline',
          }}
        >Open in Media &amp; Backgrounds</button>
      </div>
    </FloatingWindow>
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
  const { activeView, setActiveView, loaded, nextSlide, prevSlide, goLive, currentSlide, currentItem, toggleBlackout, toggleClear, settingsOpen, setSettingsOpen, undoSchedule, redoSchedule, recoveryData, setRecoveryData, restoreRecovery, liveProgram, sendYouTubeControl, sendVideoControl, updateScheduleItem } = useApp();
  const [songEditorOpen, setSongEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState('keys');

  const openSettings = useCallback((tab = 'keys') => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  const openNewSong = () => { setEditingSong(null); setEditingScheduleId(null); setSongEditorOpen(true); };
  const openEditSong = (song, scheduleId = null) => { setEditingSong(song); setEditingScheduleId(scheduleId); setSongEditorOpen(true); };

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
        <SchedulePanel onEditSong={openEditSong} />
        <div style={styles.center}>
          <SlideEditor />
          <PreviewArea />
        </div>
        {activeView === 'library' && <LibraryPanel onEditSong={openEditSong} onNewSong={openNewSong} />}
        {activeView === 'bible' && <BiblePanel />}
        {activeView === 'media' && <MediaPanel />}
        {activeView === 'announcements' && <AnnouncementPanel />}
        {activeView === 'stream' && <StreamPanel />}
        {activeView === 'timers' && <TimerPanel />}
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
          onClose={() => { setSongEditorOpen(false); setEditingScheduleId(null); }}
          onAfterSave={editingScheduleId ? (data) => updateScheduleItem(editingScheduleId, data) : undefined}
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

      {/* Floating YouTube controller — only when YouTube is live and not already on media tab */}
      {activeView !== 'media' && (
        <YouTubeController
          liveYt={liveProgram?.item?.background?.type === 'youtube' ? liveProgram.item.background : null}
          sendYouTubeControl={sendYouTubeControl}
          setActiveView={setActiveView}
        />
      )}

      {/* Floating video controller — only when a video background is live and not on media tab */}
      {activeView !== 'media' && (
        <VideoController
          liveVideo={liveProgram?.item?.background?.type === 'video' ? liveProgram.item.background : null}
          sendVideoControl={sendVideoControl}
          setActiveView={setActiveView}
        />
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

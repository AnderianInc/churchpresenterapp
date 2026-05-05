import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlideRenderer from './SlideRenderer';
import ConfidenceMonitor from './ConfidenceMonitor';
import { readLiveState } from '../store/liveStateSync';
import { makeBroadcastMsg, BROADCAST_CHANNEL } from '../store/AppContext';

function getQueryParams() {
  const search = window.location.search || '';
  if (search) return new URLSearchParams(search);

  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) {
    return new URLSearchParams(hash.slice(queryIndex));
  }
  return new URLSearchParams();
}

function resolveSlideForRole(role, outputId, payload) {
  if (!payload) return null;
  if (outputId && payload.outputs?.[outputId]?.slide) {
    return payload.outputs[outputId].slide;
  }
  if (payload.roleSlides?.[role]) {
    return payload.roleSlides[role];
  }
  if (role === 'stage') {
    const mirror = payload.stageMirror !== false;
    return mirror ? payload.programSlide : (payload.stageSlide || payload.programSlide);
  }
  if (role === 'announcement') {
    return payload.announcementSlide || payload.programSlide;
  }
  if (role === 'background') {
    return payload.backgroundSlide || payload.programSlide;
  }
  if (role === 'confidence') {
    return payload.confidenceSlide || payload.programSlide;
  }
  return payload.programSlide;
}


/** Relay a YouTube player state update to the operator window. */
function relayYtState(payload) {
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.postMessage({ type: 'youtube-state', payload });
    ch.close();
  }
  if (window.electronAPI?.sendYouTubeState) {
    window.electronAPI.sendYouTubeState(payload);
  }
}

/** Relay a video element state update to the operator window. */
function relayVideoState(payload) {
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.postMessage({ type: 'video-state', payload });
    ch.close();
  }
  if (window.electronAPI?.sendVideoState) {
    window.electronAPI.sendVideoState(payload);
  }
}

// ── Output window hover toolbar (Electron only) ───────────────────────────────

function HoverToolbar({ outputId }) {
  const [visible, setVisible] = useState(false);
  if (!window.electronAPI) return null;

  const btnStyle = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#ccc',
    borderRadius: 4,
    width: 26, height: 22,
    cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace', flexShrink: 0,
  };

  return (
    <div
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      style={{
        position: 'fixed', top: 0, right: 0,
        width: 80, height: 36,
        zIndex: 9999,
      }}
    >
      {visible && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          display: 'flex', gap: 4, padding: '5px 8px',
          background: 'rgba(0,0,0,0.78)',
          borderBottomLeftRadius: 8,
          backdropFilter: 'blur(4px)',
        }}>
          <button
            style={btnStyle}
            title="Minimize"
            onClick={() => window.electronAPI.minimizeOutputWindow(outputId)}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >–</button>
          <button
            style={{ ...btnStyle, borderColor: 'rgba(239,68,68,0.45)', color: '#f87171' }}
            title="Close"
            onClick={() => window.close()}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >✕</button>
        </div>
      )}
    </div>
  );
}

// ── Main OutputView ───────────────────────────────────────────────────────────

export default function OutputView() {
  const params = getQueryParams();
  const role = params.get('role') || 'presentation';
  const outputId = params.get('id');
  const [slide, setSlide] = useState(null);
  const [nextSlide, setNextSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);
  const [roleLabel, setRoleLabel] = useState(role.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
  useEffect(() => { document.title = roleLabel; }, [roleLabel]);

  // Native <video> element ref (for video background control)
  const videoRef = useRef(null);

  // ── YouTube control via embed postMessage (works in every output window) ──────
  // Only the program output receives audio — other outputs always stay muted so
  // there is no overlapping sound from stage/confidence/announcement windows.
  const sendYouTubeCommand = useCallback(({ func, args = [] }) => {
    if (role !== 'presentation' && (func === 'unMute' || func === 'setVolume')) return;
    const cmdArgs = Array.isArray(args) && args.length > 0 ? args : '';
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func, args: cmdArgs }), '*'
        );
      } catch (_) {}
    });
  }, [role]);

  // Relay YouTube iframe state back to the operator window
  useEffect(() => {
    if (role === 'confidence') return;
    const handleMsg = (e) => {
      if (!e.origin?.includes('youtube')) return;
      let data;
      try { data = JSON.parse(typeof e.data === 'string' ? e.data : '{}'); } catch { return; }
      if (!data?.event) return;
      if (data.event === 'onReady') {
        document.querySelectorAll('iframe').forEach(iframe => {
          try { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*'); } catch (_) {}
        });
        relayYtState({ isPlaying: false, isMuted: true, volume: 100 });
      }
      if (data.event === 'infoDelivery' && data.info) {
        const { playerState, muted, volume } = data.info;
        if (playerState !== undefined || muted !== undefined || volume !== undefined) {
          relayYtState({
            isPlaying: playerState === 1 || playerState === 3,
            isMuted: muted ?? true,
            volume: volume ?? 100,
          });
        }
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [role]);

  // ── Video element control commands from operator window ───────────────────
  const sendVideoCommand = useCallback((payload) => {
    const { func, args = [] } = payload;
    const video = videoRef.current;
    if (!video) return;
    switch (func) {
      case 'play':      video.play(); break;
      case 'pause':     video.pause(); break;
      case 'setVolume': video.volume = Math.max(0, Math.min(1, (args[0] ?? 100) / 100)); break;
      case 'mute':      video.muted = true; break;
      case 'unmute':    video.muted = false; break;
      default: break;
    }
    // Relay updated state back to operator
    relayVideoState({
      isPlaying: !video.paused,
      isMuted: video.muted,
      volume: Math.round(video.volume * 100),
    });
  }, []);

  // Relay native video events so the operator controller stays in sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video || slide?.item?.background?.type !== 'video') return;
    const relay = () => relayVideoState({
      isPlaying: !video.paused,
      isMuted: video.muted,
      volume: Math.round(video.volume * 100),
    });
    video.addEventListener('play', relay);
    video.addEventListener('pause', relay);
    video.addEventListener('volumechange', relay);
    return () => {
      video.removeEventListener('play', relay);
      video.removeEventListener('pause', relay);
      video.removeEventListener('volumechange', relay);
    };
  }, [slide]);

  // ── Slide / output state listeners ────────────────────────────────────────
  useEffect(() => {
    const initial = readLiveState();
    const startSlide = resolveSlideForRole(role, outputId, initial);
    setSlide(startSlide);
    setNextSlide(initial.nextSlide ?? null);
    setIsBlackout(initial.isBlackout);
    setIsClear(initial.isClear);

    if (window.electronAPI) {
      const offs = [
        window.electronAPI.onReceiveOutput((data) => {
          setSlide(resolveSlideForRole(role, outputId, data));
          setNextSlide(data.nextSlide ?? null);
          setRoleLabel((data.outputs?.[outputId]?.role || role).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
          setIsBlackout(!!data.isBlackout);
          setIsClear(!!data.isClear);
        }),
        window.electronAPI.onReceiveYouTubeControl(sendYouTubeCommand),
        window.electronAPI.onReceiveVideoControl(sendVideoCommand),
      ];
      return () => offs.forEach(f => f());
    }

    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channel.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type === 'state-sync') {
        setSlide(resolveSlideForRole(role, outputId, payload));
        setNextSlide(payload?.nextSlide ?? null);
        setIsBlackout(!!payload?.isBlackout);
        setIsClear(!!payload?.isClear);
      }
      if (type === 'blackout') setIsBlackout(payload);
      if (type === 'clear') setIsClear(payload);
      if (type === 'youtube-control') sendYouTubeCommand(payload);
      if (type === 'video-control') sendVideoCommand(payload);
      if (type === 'slide-program' && role !== 'stage') {
        setSlide(payload);
        setIsBlackout(false);
        setIsClear(false);
      }
      if (type === 'slide-stage' && role === 'stage') {
        setSlide(payload);
        setNextSlide(payload?.nextSlide ?? null);
        setIsBlackout(false);
        setIsClear(false);
      }
      if (type === 'output-target' && outputId && payload?.id === outputId) {
        setSlide(payload.slide);
        setIsBlackout(false);
        setIsClear(false);
      }
      if (type === 'output-role-target' && payload?.role === role) {
        setSlide(payload.slide);
        setIsBlackout(false);
        setIsClear(false);
      }
    };
    channel.postMessage(makeBroadcastMsg('state-request', null));
    return () => channel.close();
  }, [role, outputId, sendYouTubeCommand, sendVideoCommand]);

  // ── F11 fullscreen toggle ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key !== 'F11') return;
      e.preventDefault();
      if (window.electronAPI?.toggleFullscreen) {
        window.electronAPI.toggleFullscreen();
      } else if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Thin drag strip so macOS titleBarStyle:'hidden' traffic lights stay accessible
  const macDragStrip = window.electronAPI?.platform === 'darwin' && (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 28,
      WebkitAppRegion: 'drag', zIndex: 9999, pointerEvents: 'none',
    }} />
  );

  // ── Confidence monitor: four-quadrant view ───────────────────────────────
  if (role === 'confidence') {
    return (
      <>
        {macDragStrip}
        <ConfidenceMonitor
          slide={isClear ? null : slide}
          nextSlide={nextSlide}
          isBlackout={isBlackout}
        />
        <HoverToolbar outputId={outputId} />
      </>
    );
  }

  // ── Standard output views ─────────────────────────────────────────────────
  if (isBlackout) {
    return (
      <>
        {macDragStrip}
        <div style={{ width: '100vw', height: '100vh', background: '#000000' }} />
        <HoverToolbar outputId={outputId} />
      </>
    );
  }

  // Clear: show the item background without text (YouTube bg keeps playing)
  if (isClear && slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {macDragStrip}
        <SlideRenderer
          slide={{ ...slide, lines: '', chords: '' }}
          item={slide?.item}
          fullscreen
          videoRef={videoRef}
        />
        <HoverToolbar outputId={outputId} />
      </div>
    );
  }

  if (!slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {macDragStrip}
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✝</div>
          <div style={{ fontSize: 16, fontFamily: 'Georgia', letterSpacing: '0.1em' }}>Waiting for content</div>
        </div>
        <HoverToolbar outputId={outputId} />
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {macDragStrip}
      <SlideRenderer slide={slide} item={slide?.item} fullscreen videoRef={videoRef} />
      <HoverToolbar outputId={outputId} />
    </div>
  );
}

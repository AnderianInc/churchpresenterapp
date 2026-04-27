import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlideRenderer from './SlideRenderer';
import { SlideCanvas } from './SlideCanvas';
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


// ── YouTube IFrame API helpers ────────────────────────────────────────────────

const YT_PLAYER_DIV_ID = 'yt-output-player';

/** Load the YouTube IFrame Player API script once per page load. */
function loadYtApiScript() {
  if (window.YT || document.getElementById('yt-api-script')) return;
  const s = document.createElement('script');
  s.id = 'yt-api-script';
  s.src = 'https://www.youtube.com/iframe_api';
  s.async = true;
  document.head.appendChild(s);
}

/**
 * Register a callback to run once the YouTube IFrame API is ready.
 * Uses a global listener registry so it survives React StrictMode's
 * double-invocation of effects without chaining window.onYouTubeIframeAPIReady.
 * Returns an unregister function — call it from the effect cleanup.
 */
function registerYtReadyCallback(cb) {
  if (window.YT?.Player) {
    const t = setTimeout(cb, 50);
    return () => clearTimeout(t);
  }
  if (!window.__ytReadyListeners) {
    window.__ytReadyListeners = [];
    window.onYouTubeIframeAPIReady = () => {
      const fns = window.__ytReadyListeners ?? [];
      window.__ytReadyListeners = [];
      fns.forEach(fn => fn());
    };
  }
  window.__ytReadyListeners.push(cb);
  return () => {
    window.__ytReadyListeners = (window.__ytReadyListeners ?? []).filter(fn => fn !== cb);
  };
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

  // YouTube IFrame Player API player instance
  const ytPlayerRef = useRef(null);
  const ytVideoIdRef = useRef(null);

  // Native <video> element ref (for video background control)
  const videoRef = useRef(null);

  // Current YouTube video ID from the live slide (null when no YouTube bg)
  const currentYtId = (slide?.item?.background?.type === 'youtube' && !isBlackout)
    ? (slide.item.background.value || null)
    : null;

  // ── Load the YT IFrame API script once (non-confidence windows only) ────────
  useEffect(() => {
    if (role === 'confidence') return;
    loadYtApiScript();
  }, [role]);

  // ── Create / destroy YT.Player when the active YouTube video changes ─────────
  useEffect(() => {
    if (role === 'confidence') return;

    if (!currentYtId) {
      // No YouTube slide active — stop and destroy the player
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch (_) {}
        try { ytPlayerRef.current.destroy(); } catch (_) {}
        ytPlayerRef.current = null;
        ytVideoIdRef.current = null;
      }
      return;
    }

    // Same video already playing — no need to recreate
    if (ytVideoIdRef.current === currentYtId && ytPlayerRef.current) return;
    ytVideoIdRef.current = currentYtId;

    const videoId = currentYtId; // capture for closure

    let aborted = false;

    const createPlayer = () => {
      if (aborted) return;
      // The div#YT_PLAYER_DIV_ID must be in the DOM (rendered by SlideRenderer)
      const container = document.getElementById(YT_PLAYER_DIV_ID);
      if (!container) {
        setTimeout(createPlayer, 150);
        return;
      }
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_) {}
        ytPlayerRef.current = null;
      }
      // Create the player inside an imperatively-managed child div so that the
      // YT API's DOM replacement doesn't touch the React-managed container element,
      // preventing "removeChild" reconciliation errors on slide navigation.
      container.textContent = '';
      const playerTarget = document.createElement('div');
      container.appendChild(playerTarget);
      ytPlayerRef.current = new window.YT.Player(playerTarget, {
        height: '100%',
        width: '100%',
        videoId,
        playerVars: {
          autoplay: 0,   // don't autoplay — operator starts playback manually
          mute: 1,       // start muted; operator unmutes via controls
          loop: 1,
          playlist: videoId,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            // Relay initial mute/volume; isPlaying comes from onStateChange
            relayYtState({ isMuted: true, volume: e.target.getVolume() });
          },
          onStateChange: (e) => {
            const YTState = window.YT?.PlayerState;
            const isPlaying = e.data === YTState?.PLAYING || e.data === YTState?.BUFFERING;
            try {
              relayYtState({
                isPlaying,
                isMuted: e.target.isMuted(),
                volume: e.target.getVolume(),
              });
            } catch (_) {}
          },
        },
      });
    };

    // StrictMode-safe: uses a global listener registry instead of chaining
    // window.onYouTubeIframeAPIReady, so effects can be registered/cleaned up
    // multiple times without losing the callback.
    const unregister = registerYtReadyCallback(createPlayer);

    return () => {
      aborted = true;
      unregister();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch (_) {}
        try { ytPlayerRef.current.destroy(); } catch (_) {}
        ytPlayerRef.current = null;
        ytVideoIdRef.current = null;
      }
    };
  }, [currentYtId, role]);

  // ── YouTube control commands from operator window ─────────────────────────
  const sendYouTubeCommand = useCallback((payload) => {
    const { func, args } = payload;
    const player = ytPlayerRef.current;
    if (player && typeof player[func] === 'function') {
      try {
        player[func](...(Array.isArray(args) ? args : []));
        return;
      } catch (_) {}
    }
  }, []);

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
      window.electronAPI.onReceiveOutput((data) => {
        setSlide(resolveSlideForRole(role, outputId, data));
        setNextSlide(data.nextSlide ?? null);
        setRoleLabel((data.outputs?.[outputId]?.role || role).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
        setIsBlackout(!!data.isBlackout);
        setIsClear(!!data.isClear);
      });
      window.electronAPI.onReceiveYouTubeControl(sendYouTubeCommand);
      window.electronAPI.onReceiveVideoControl(sendVideoCommand);
      return () => {
        window.electronAPI.removeAllListeners('receive-output');
        window.electronAPI.removeAllListeners('receive-youtube-control');
        window.electronAPI.removeAllListeners('receive-video-control');
      };
    }

    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channel.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type === 'state-sync') {
        setSlide(resolveSlideForRole(role, outputId, payload));
        setNextSlide(payload?.nextSlide ?? null);
        setRoleLabel((payload.outputs?.[outputId]?.role || role).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
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

  // ── Confidence monitor: four-quadrant view ───────────────────────────────
  if (role === 'confidence') {
    return (
      <>
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
        <div style={{ width: '100vw', height: '100vh', background: '#000000' }} />
        <HoverToolbar outputId={outputId} />
      </>
    );
  }

  // Clear: show the item background without text (YouTube bg keeps playing)
  if (isClear && slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <SlideRenderer
          slide={{ ...slide, lines: '', chords: '' }}
          item={slide?.item}
          fullscreen
          ytPlayerId={YT_PLAYER_DIV_ID}
          videoRef={videoRef}
        />
        <HoverToolbar outputId={outputId} />
      </div>
    );
  }

  if (!slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, left: 16, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
          {roleLabel}
        </div>
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
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        {roleLabel}
      </div>
      <SlideRenderer slide={slide} item={slide?.item} fullscreen ytPlayerId={YT_PLAYER_DIV_ID} videoRef={videoRef} />
      <HoverToolbar outputId={outputId} />
    </div>
  );
}

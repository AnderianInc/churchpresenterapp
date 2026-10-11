import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlideRenderer from './SlideRenderer';
import FadeSlide from './FadeSlide';
import LowerThird from './LowerThird';
import { readLiveState } from '../store/liveStateSync';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import { perfMonitor } from '../utils/perfMonitor';

export default function PresentationView() {
  const [slide, setSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => { perfMonitor.start(); return () => perfMonitor.stop(); }, []);

  // ── Local video background control (the program window carries audio) ─────────
  const relayVideoState = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const payload = {
      isPlaying: !v.paused, isMuted: v.muted,
      volume: Math.round(v.volume * 100),
      currentTime: v.currentTime, duration: v.duration || 0,
    };
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.postMessage({ type: 'video-state', payload });
      ch.close();
    }
    window.electronAPI?.sendVideoState?.(payload);
  }, []);

  const sendVideoCommand = useCallback((payload) => {
    const { func, args = [] } = payload || {};
    const v = videoRef.current;
    if (!v) return;
    switch (func) {
      case 'play':    v.play(); break;
      case 'pause':   v.pause(); break;
      case 'stop':    v.pause(); try { v.currentTime = 0; } catch (_) {} break;
      case 'restart': try { v.currentTime = 0; } catch (_) {} v.play(); break;
      case 'mute':    v.muted = true; break;
      case 'unmute':  v.muted = false; break; // program output is allowed audio
      case 'seek':    v.currentTime = Math.max(0, Math.min(v.duration || 0, args[0] ?? 0)); break;
      case 'setVolume': v.volume = Math.max(0, Math.min(1, (args[0] ?? 100) / 100)); break;
      default: break;
    }
    relayVideoState();
  }, [relayVideoState]);

  // Relay native <video> events so the operator's controls stay in sync.
  useEffect(() => {
    const v = videoRef.current;
    const bgType = slide?.background?.type || slide?.item?.background?.type;
    if (!v || bgType !== 'video') return undefined;
    const relay = () => relayVideoState();
    const events = ['play', 'pause', 'volumechange', 'timeupdate', 'durationchange'];
    events.forEach(ev => v.addEventListener(ev, relay));
    return () => events.forEach(ev => v.removeEventListener(ev, relay));
  }, [slide, relayVideoState]);

  useEffect(() => {
    if (window.electronAPI) {
      const offs = [
        window.electronAPI.onReceiveSlide((data) => {
          perfMonitor.recordSlideArrival(data?._sentAt);
          setSlide(data);
          setIsBlackout(false);
          setIsClear(false);
        }),
        window.electronAPI.onReceiveBlackout((v) => setIsBlackout(v)),
        window.electronAPI.onReceiveClear((v) => setIsClear(v)),
        window.electronAPI.onReceiveVideoControl?.(sendVideoCommand),
      ].filter(Boolean);
      return () => offs.forEach(f => f());
    } else {
      const initial = readLiveState();
      if (initial.programSlide) setSlide(initial.programSlide);
      setIsBlackout(initial.isBlackout);
      setIsClear(initial.isClear);

      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'slide-program') { perfMonitor.recordSlideArrival(payload?._sentAt); setSlide(payload); setIsBlackout(false); setIsClear(false); }
        if (type === 'blackout') setIsBlackout(payload);
        if (type === 'clear') setIsClear(payload);
        if (type === 'state-sync') {
          setSlide(payload?.programSlide || null);
          setIsBlackout(!!payload?.isBlackout);
          setIsClear(!!payload?.isClear);
        }
        if (type === 'video-control') sendVideoCommand(payload);
      };
      channel.postMessage({ type: 'state-request', payload: null });
      return () => channel.close();
    }
  // sendVideoCommand is stable (memoised), so this still runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendVideoCommand]);

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

  if (isBlackout) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000000', position: 'relative' }}>
        {macDragStrip}
      </div>
    );
  }

  // Clear: show the item background without text
  if (isClear && slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {macDragStrip}
        <SlideRenderer slide={{ ...slide, lines: '', chords: '' }} item={slide.item} fullscreen videoRef={videoRef} />
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
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {macDragStrip}
      <FadeSlide slide={slide} item={slide.item} videoRef={videoRef} />
      <LowerThird />
    </div>
  );
}

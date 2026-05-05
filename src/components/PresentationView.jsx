import React, { useState, useEffect } from 'react';
import SlideRenderer from './SlideRenderer';
import { readLiveState } from '../store/liveStateSync';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import { perfMonitor } from '../utils/perfMonitor';

export default function PresentationView() {
  const [slide, setSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);

  useEffect(() => { perfMonitor.start(); return () => perfMonitor.stop(); }, []);

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
      ];
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
      };
      channel.postMessage({ type: 'state-request', payload: null });
      return () => channel.close();
    }
  }, []);

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
        <SlideRenderer slide={{ ...slide, lines: '', chords: '' }} item={slide.item} fullscreen />
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
      <SlideRenderer slide={slide} item={slide.item} fullscreen />
    </div>
  );
}

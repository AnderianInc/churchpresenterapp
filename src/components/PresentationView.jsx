import React, { useState, useEffect } from 'react';
import SlideRenderer from './SlideRenderer';
import { readLiveState } from '../store/liveStateSync';
import { BROADCAST_CHANNEL } from '../store/AppContext';

export default function PresentationView() {
  const [slide, setSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onReceiveSlide((data) => {
        setSlide(data);
        setIsBlackout(false);
        setIsClear(false);
      });
      window.electronAPI.onReceiveBlackout((v) => setIsBlackout(v));
      window.electronAPI.onReceiveClear((v) => setIsClear(v));
      return () => {
        window.electronAPI.removeAllListeners('receive-slide');
        window.electronAPI.removeAllListeners('receive-blackout');
        window.electronAPI.removeAllListeners('receive-clear');
      };
    } else {
      const initial = readLiveState();
      if (initial.programSlide) setSlide(initial.programSlide);
      setIsBlackout(initial.isBlackout);
      setIsClear(initial.isClear);

      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'slide-program') { setSlide(payload); setIsBlackout(false); setIsClear(false); }
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

  if (isBlackout) {
    return <div style={{ width: '100vw', height: '100vh', background: '#000000' }} />;
  }

  if (isClear || !slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!slide && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✝</div>
            <div style={{ fontSize: 16, fontFamily: 'Georgia', letterSpacing: '0.1em' }}>Waiting for content</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <SlideRenderer slide={slide} item={slide.item} fullscreen />
    </div>
  );
}

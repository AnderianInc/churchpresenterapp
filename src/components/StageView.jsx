import React, { useState, useEffect } from 'react';
import { readLiveState } from '../store/liveStateSync';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import { SlideCanvas } from './SlideCanvas';

// ── Main StageView ────────────────────────────────────────────────────────────

export default function StageView() {
  const [slide, setSlide] = useState(null);
  const [nextSlide, setNextSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);
  const [clock, setClock] = useState('');

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setClock(`${h}:${m}:${s} ${ap}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Slide receive
  useEffect(() => {
    if (window.electronAPI) {
      const offs = [
        window.electronAPI.onReceiveSlide((data) => {
          // nextSlide is attached to the payload by AppContext when broadcasting
          setNextSlide(data?.nextSlide ?? null);
          // Strip nextSlide from the current slide display object
          const { nextSlide: _ns, ...currentSlide } = data || {};
          setSlide(Object.keys(currentSlide).length ? currentSlide : null);
          setIsBlackout(false);
          setIsClear(false);
        }),
        window.electronAPI.onReceiveBlackout((v) => setIsBlackout(v)),
        window.electronAPI.onReceiveClear((v) => setIsClear(v)),
      ];
      return () => offs.forEach(f => f());
    } else {
      const initial = readLiveState();
      const eff = initial.stageMirror !== false
        ? initial.programSlide
        : (initial.stageSlide ?? initial.programSlide);
      if (eff) {
        const { nextSlide: ns, ...cur } = eff;
        setSlide(Object.keys(cur).length ? cur : null);
        setNextSlide(ns ?? null);
      }
      setIsBlackout(initial.isBlackout);
      setIsClear(initial.isClear);

      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'slide-stage') {
          const { nextSlide: ns, ...cur } = payload || {};
          setSlide(Object.keys(cur).length ? cur : null);
          setNextSlide(ns ?? null);
          setIsBlackout(false);
          setIsClear(false);
        }
        if (type === 'blackout') setIsBlackout(payload);
        if (type === 'clear') setIsClear(payload);
        if (type === 'state-sync') {
          const mirror = payload?.stageMirror !== false;
          const raw = mirror ? payload?.programSlide : (payload?.stageSlide ?? payload?.programSlide);
          if (raw) {
            const { nextSlide: ns, ...cur } = raw;
            setSlide(Object.keys(cur).length ? cur : null);
            setNextSlide(ns ?? null);
          } else {
            setSlide(null);
          }
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

  if (isClear) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>CLEAR</span>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0a0c10',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Top bar — extra left padding on macOS to clear the traffic-light buttons */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 20px',
        paddingLeft: window.electronAPI?.platform === 'darwin' ? 80 : 20,
        background: '#12151c', borderBottom: '1px solid rgba(255,255,255,0.07)',
        WebkitAppRegion: 'drag',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, background: '#4f8ef7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>CP</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Stage Display</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, fontFamily: 'Georgia', letterSpacing: '0.05em' }}>
          {clock}
        </div>
        {isBlackout && (
          <div style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
            BLACKOUT
          </div>
        )}
        {!isBlackout && (
          <div style={{ width: 90 }} /> // spacer to keep clock centred
        )}
      </div>

      {/* Body: split slide panels + info sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* CURRENT slide panel */}
        <SlideCanvas
          slide={isBlackout ? null : slide}
          isBlackout={isBlackout}
          label="Current"
          accent="#4f8ef7"
        />

        {/* Divider */}
        <div style={{ width: 2, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

        {/* NEXT slide panel */}
        <SlideCanvas
          slide={nextSlide}
          label="Next"
          accent="rgba(255,255,255,0.35)"
          dimmed
        />

        {/* Right info sidebar */}
        <div style={{
          width: 180, background: '#12151c', borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', padding: 14, gap: 14, flexShrink: 0,
        }}>
          {/* Now Live */}
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
              Now Live
            </div>
            {slide ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3, lineHeight: 1.3 }}>
                  {slide?.item?.title || 'Unknown'}
                </div>
                {slide?.item?.author && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    {slide.item.author}
                  </div>
                )}
                {slide.label && (
                  <div style={{
                    marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.3)',
                    padding: '2px 7px', borderRadius: 4,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4f8ef7' }} />
                    <span style={{ fontSize: 10, color: '#4f8ef7' }}>{slide.label}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No active content</div>
            )}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Song Key */}
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
              Song Key
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', fontFamily: 'Georgia' }}>
              {slide?.item?.key || '–'}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Tempo */}
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
              Tempo
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
              {slide?.item?.tempo || '–'}
            </div>
            {slide?.item?.bpm && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                {slide.item.bpm} BPM
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Status */}
          <div style={{
            background: isBlackout
              ? 'rgba(239,68,68,0.12)'
              : slide
                ? 'rgba(34,197,94,0.1)'
                : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isBlackout ? 'rgba(239,68,68,0.3)' : slide ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6, padding: '7px 10px', textAlign: 'center',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              color: isBlackout ? '#ef4444' : slide ? '#22c55e' : 'rgba(255,255,255,0.3)',
            }}>
              {isBlackout ? '⬛ BLACKOUT' : slide ? '● LIVE' : '○ STANDBY'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

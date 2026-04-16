import React, { useState, useEffect } from 'react';
import { readLiveState } from '../store/liveStateSync';
import { BROADCAST_CHANNEL } from '../store/AppContext';

export default function StageView() {
  const [slide, setSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);
  const [clock, setClock] = useState('');

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

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onReceiveSlide((data) => { setSlide(data); setIsBlackout(false); setIsClear(false); });
      window.electronAPI.onReceiveBlackout((v) => setIsBlackout(v));
      window.electronAPI.onReceiveClear((v) => setIsClear(v));
      return () => {
        window.electronAPI.removeAllListeners('receive-slide');
        window.electronAPI.removeAllListeners('receive-blackout');
        window.electronAPI.removeAllListeners('receive-clear');
      };
    } else {
      const initial = readLiveState();
      const eff = initial.stageMirror !== false
        ? initial.programSlide
        : (initial.stageSlide ?? initial.programSlide);
      if (eff) setSlide(eff);
      setIsBlackout(initial.isBlackout);
      setIsClear(initial.isClear);

      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'slide-stage') { setSlide(payload); setIsBlackout(false); setIsClear(false); }
        if (type === 'blackout') setIsBlackout(payload);
        if (type === 'clear') setIsClear(payload);
        if (type === 'state-sync') {
          const mirror = payload?.stageMirror !== false;
          const next = mirror ? payload?.programSlide : (payload?.stageSlide ?? payload?.programSlide);
          setSlide(next || null);
          setIsBlackout(!!payload?.isBlackout);
          setIsClear(!!payload?.isClear);
        }
      };
      channel.postMessage({ type: 'state-request', payload: null });
      return () => channel.close();
    }
  }, []);

  const bg = slide?.item?.background?.value || '#0d1117';
  const textColor = slide?.item?.textColor || '#ffffff';
  const fontFamily = slide?.item?.fontFamily || 'Georgia';

  if (isBlackout) {
    return <div style={{ width: '100vw', height: '100vh', background: '#000000' }} />;
  }

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
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', background: '#12151c', borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, background: '#4f8ef7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>EW</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Stage Display</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontFamily: 'Georgia', letterSpacing: '0.05em' }}>
          {clock}
        </div>
        {isBlackout && (
          <div style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
            BLACKOUT
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main lyrics area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '4% 8%', textAlign: 'center',
          background: isBlackout ? '#000' : bg,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {slide?.item?.background?.type === 'image' && !isBlackout && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${slide.item.background.value})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: `brightness(${slide.item.background.brightness || 0.4})`,
              zIndex: 0,
            }} />
          )}
          {slide?.item?.background?.type === 'video' && !isBlackout && (
            <video
              autoPlay
              muted
              loop
              playsInline
              src={slide.item.background.value}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                filter: 'brightness(0.4)',
                zIndex: 0,
              }}
            />
          )}
          {slide && !isBlackout ? (
            <>
              <div style={{
                fontSize: 'clamp(24px, 4vw, 52px)',
                color: textColor, fontFamily,
                lineHeight: 1.55, whiteSpace: 'pre-line',
                textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                maxWidth: '85%',
              }}>
                {slide.lines}
              </div>
              {slide.label && (
                <div style={{ marginTop: 16, fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
                  {slide.label}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✝</div>
              <div style={{ fontSize: 14 }}>Waiting for content</div>
            </div>
          )}
        </div>

        {/* Right info panel */}
        <div style={{
          width: 220, background: '#12151c', borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', padding: 16, gap: 16, flexShrink: 0,
        }}>
          {/* Current item info */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
              Now Live
            </div>
            {slide ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  {slide?.item?.title || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  {slide?.item?.author || ''}
                </div>
                <div style={{
                  marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.3)',
                  padding: '3px 8px', borderRadius: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f8ef7' }} />
                  <span style={{ fontSize: 11, color: '#4f8ef7' }}>{slide.label}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No active content</div>
            )}
          </div>

          {/* Visual divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Notes area */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
              Song Key
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: 'Georgia' }}>
              {slide?.item?.key || '–'}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Tempo */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
              Tempo
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>
              {slide?.item?.tempo || '–'}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Status */}
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 6, padding: '8px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, letterSpacing: '0.5px' }}>
              {isBlackout ? '⬛ BLACKOUT' : slide ? '● LIVE' : '○ STANDBY'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

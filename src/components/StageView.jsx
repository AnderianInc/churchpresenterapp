import React, { useState, useEffect } from 'react';
import { readLiveState } from '../store/liveStateSync';
import { BROADCAST_CHANNEL } from '../store/AppContext';

// ── Slide panel (current or next) ─────────────────────────────────────────────

function SlidePanel({ slide, isBlackout, label, accent, dimmed }) {
  const bg = slide?.item?.background?.value || (dimmed ? '#0a0c12' : '#0d1117');
  const textColor = slide?.item?.textColor || '#ffffff';
  const fontFamily = slide?.item?.fontFamily || 'Georgia';

  const textOpacity = dimmed ? 0.55 : 1;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      background: isBlackout ? '#000' : bg,
    }}>
      {/* Background image */}
      {slide?.item?.background?.type === 'image' && !isBlackout && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${slide.item.background.value})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: `brightness(${(slide.item.background.brightness || 0.4) * (dimmed ? 0.6 : 1)})`,
          zIndex: 0,
        }} />
      )}
      {/* Background video */}
      {slide?.item?.background?.type === 'video' && !isBlackout && (
        <video
          autoPlay muted loop playsInline
          src={slide.item.background.value}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            filter: `brightness(${dimmed ? 0.25 : 0.4})`,
            zIndex: 0,
          }}
        />
      )}

      {/* Slide content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6% 8%',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
      }}>
        {isBlackout ? (
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>BLACKOUT</div>
        ) : slide ? (
          <>
            <div style={{
              fontSize: 'clamp(18px, 3vw, 42px)',
              color: textColor,
              fontFamily,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
              maxWidth: '90%',
              textAlign: slide.textAlign || 'center',
              opacity: textOpacity,
            }}>
              {slide.lines}
            </div>
            {slide.chords && !dimmed && (
              <div style={{
                marginTop: 20, width: '90%', padding: '12px 16px',
                background: 'rgba(0,0,0,0.45)', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <pre style={{
                  margin: 0,
                  fontSize: 'clamp(11px, 1.4vw, 17px)',
                  color: 'rgba(255,220,100,0.9)',
                  fontFamily: 'monospace',
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>{slide.chords}</pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.12)', textAlign: 'center' }}>
            {dimmed
              ? <span style={{ fontSize: 13 }}>No next slide</span>
              : <><div style={{ fontSize: 40, marginBottom: 10 }}>✝</div><div style={{ fontSize: 13 }}>Waiting for content</div></>
            }
          </div>
        )}
      </div>

      {/* Label bar at the bottom */}
      <div style={{
        flexShrink: 0,
        padding: '5px 12px',
        background: 'rgba(0,0,0,0.55)',
        borderTop: `1px solid ${accent}33`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 2,
        position: 'relative',
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: accent,
          fontFamily: 'Inter, sans-serif',
        }}>{label}</span>
        {slide?.label && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
            {slide.label}
          </span>
        )}
        {slide?.item?.title && (
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.25)',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginLeft: 'auto',
          }}>
            {slide.item.title}
          </span>
        )}
      </div>
    </div>
  );
}

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
      window.electronAPI.onReceiveSlide((data) => {
        // nextSlide is attached to the payload by AppContext when broadcasting
        setNextSlide(data?.nextSlide ?? null);
        // Strip nextSlide from the current slide display object
        const { nextSlide: _ns, ...currentSlide } = data || {};
        setSlide(Object.keys(currentSlide).length ? currentSlide : null);
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
        padding: '7px 20px', background: '#12151c', borderBottom: '1px solid rgba(255,255,255,0.07)',
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
        <SlidePanel
          slide={isBlackout ? null : slide}
          isBlackout={isBlackout}
          label="Current"
          accent="#4f8ef7"
          dimmed={false}
        />

        {/* Divider */}
        <div style={{ width: 2, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

        {/* NEXT slide panel */}
        <SlidePanel
          slide={nextSlide}
          isBlackout={false}
          label="Next"
          accent="rgba(255,255,255,0.35)"
          dimmed={true}
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

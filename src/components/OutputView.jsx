import React, { useState, useEffect } from 'react';
import SlideRenderer from './SlideRenderer';
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

// ── Confidence Monitor — split-screen panel ───────────────────────────────────

function ConfidencePanel({ slide, nextSlide, isBlackout }) {
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

  if (isBlackout) {
    return <div style={{ width: '100vw', height: '100vh', background: '#000' }} />;
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0a0c10', fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 16px',
        background: '#12151c', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, background: '#4f8ef7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 9 }}>CP</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Confidence Monitor</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, fontFamily: 'Georgia', letterSpacing: '0.05em' }}>
          {clock}
        </span>
        <div style={{ width: 140 }} />
      </div>

      {/* Body — current left (65%) + next right (35%) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* CURRENT slide */}
        <SlideSection slide={slide} label="Current" accent="#4f8ef7" dimmed={false} />

        {/* Divider */}
        <div style={{ width: 2, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

        {/* NEXT slide */}
        <SlideSection slide={nextSlide} label="Next" accent="rgba(255,255,255,0.3)" dimmed flex="35%" />

      </div>
    </div>
  );
}

// Individual panel inside the confidence monitor
function SlideSection({ slide, label, accent, dimmed, flex = '65%' }) {
  const bg = slide?.item?.background?.value || (dimmed ? '#0a0c12' : '#0d1117');
  const textColor = slide?.item?.textColor || '#ffffff';
  const fontFamily = slide?.item?.fontFamily || 'Georgia';
  const textOpacity = dimmed ? 0.55 : 1;

  return (
    <div style={{
      flex: `0 0 ${flex}`, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
      background: slide?.item?.background?.type === 'color' ? (slide.item.background.value || bg) : bg,
    }}>
      {/* Background image */}
      {slide?.item?.background?.type === 'image' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${slide.item.background.value})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: `brightness(${(slide.item.background.brightness || 0.4) * (dimmed ? 0.55 : 1)})`,
          zIndex: 0,
        }} />
      )}
      {/* Background video */}
      {slide?.item?.background?.type === 'video' && (
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

      {/* Slide text */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '6% 8%', textAlign: 'center',
        position: 'relative', zIndex: 1, overflow: 'hidden',
      }}>
        {slide ? (
          <>
            <div style={{
              fontSize: 'clamp(16px, 2.8vw, 40px)',
              color: textColor, fontFamily, lineHeight: 1.55,
              whiteSpace: 'pre-line',
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
              maxWidth: '92%',
              textAlign: slide.textAlign || 'center',
              opacity: textOpacity,
            }}>
              {slide.lines}
            </div>
            {slide.chords && !dimmed && (
              <div style={{
                marginTop: 16, width: '90%', padding: '10px 14px',
                background: 'rgba(0,0,0,0.45)', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <pre style={{
                  margin: 0, fontSize: 'clamp(10px, 1.2vw, 15px)',
                  color: 'rgba(255,220,100,0.9)', fontFamily: 'monospace',
                  lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{slide.chords}</pre>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.12)', textAlign: 'center' }}>
            {dimmed
              ? <span style={{ fontSize: 12 }}>No next slide</span>
              : <><div style={{ fontSize: 36, marginBottom: 8 }}>✝</div><div style={{ fontSize: 12 }}>Waiting for content</div></>
            }
          </div>
        )}
      </div>

      {/* Label bar */}
      <div style={{
        flexShrink: 0, padding: '4px 10px',
        background: 'rgba(0,0,0,0.55)', borderTop: `1px solid ${accent}33`,
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 2, position: 'relative',
      }}>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif',
        }}>{label}</span>
        {slide?.label && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
            {slide.label}
          </span>
        )}
        {slide?.item?.title && (
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter, sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 'auto',
          }}>
            {slide.item.title}
          </span>
        )}
      </div>
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
      return () => {
        window.electronAPI.removeAllListeners('receive-output');
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
  }, [role, outputId]);

  // ── Confidence monitor: split-screen view ─────────────────────────────────
  if (role === 'confidence') {
    return (
      <ConfidencePanel
        slide={isClear ? null : slide}
        nextSlide={nextSlide}
        isBlackout={isBlackout}
      />
    );
  }

  // ── Standard output views ─────────────────────────────────────────────────
  if (isBlackout) {
    return <div style={{ width: '100vw', height: '100vh', background: '#000000' }} />;
  }

  // Clear: show the item background without text
  if (isClear && slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <SlideRenderer slide={{ ...slide, lines: '', chords: '' }} item={slide?.item} fullscreen />
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
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        {roleLabel}
      </div>
      <SlideRenderer slide={slide} item={slide?.item} fullscreen />
    </div>
  );
}

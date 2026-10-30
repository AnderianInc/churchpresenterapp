import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import SlideRenderer from './SlideRenderer';
import BackgroundPicker, { bgToCss } from './BackgroundPicker';
import VideoControls from './VideoControls';
import ConfidenceMonitor from './ConfidenceMonitor';

// ── Output monitor grid primitives ─────────────────────────────────────────────

// ConfidenceMonitor is laid out in viewport units (100vw/100vh) like the real
// output window. Rather than reimplement it at tile scale, render it at full
// viewport size and visually scale the whole thing down with a CSS transform —
// this keeps all 4 quadrants (current/next/timers/stage) proportional and in sync
// with the real monitor's layout instead of just showing the current slide.
function ScaledConfidencePreview({ slide, nextSlide, isBlackout }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / window.innerWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <div style={{ width: window.innerWidth, height: window.innerHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <ConfidenceMonitor slide={slide} nextSlide={nextSlide} isBlackout={isBlackout} />
      </div>
    </div>
  );
}

function MonitorPlaceholder({ label, dim }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: dim ? '#0d1117' : '#000', color: 'rgba(255,255,255,0.3)', fontSize: 12, letterSpacing: '0.5px',
    }}>{label}</div>
  );
}

// Renders the live preview inside a monitor card, honouring blackout / hide-text /
// hide-background exactly like the real output.
function MonitorBody({ slide, isBlackout, isClear, hideBackground, scale = 0.2, emptyLabel = 'No output' }) {
  if (isBlackout) return <MonitorPlaceholder label="BLACKOUT" />;
  if (isClear && !hideBackground) return <MonitorPlaceholder label="HIDE TEXT" />;
  if (hideBackground && slide?.item) {
    const black = { type: 'color', value: '#000000' };
    return (
      <SlideRenderer
        slide={{ ...slide, ...(isClear ? { lines: '', chords: '' } : {}), background: black }}
        item={{ ...slide.item, background: black }}
        scale={scale}
      />
    );
  }
  // This grid only ever renders a small, bounded set of console monitor tiles
  // (Stage + however many outputs are open), so a live camera feed per tile is
  // safe here — unlike slide-list thumbnails, which can number in the dozens.
  if (slide?.item) return <SlideRenderer slide={slide} item={slide.item} scale={scale} allowLiveCamera />;
  return <MonitorPlaceholder label={emptyLabel} dim />;
}

function MonitorCard({ title, subtitle, accent = 'var(--border)', live = false, children }) {
  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden', background: '#090b10',
      border: `1px solid ${live ? accent : 'var(--border)'}`,
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <div style={{ padding: '6px 10px', background: '#0f1218', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {live && <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0, animation: 'pulse 1.5s infinite' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', background: '#000' }}>
        {children}
      </div>
    </div>
  );
}

export default function PreviewArea() {
  const [target, setTarget] = useState('program');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const {
    currentItem, currentSlide, currentSlides,
    liveProgram, liveStage, stageMirrorProgram, setStageMirrorProgram,
    liveOutputs, liveRoleSlides, liveNextSlide,
    activeSlideIdx, isBlackout, isClear,
    goLiveProgram, goLiveStage, goLiveOutput, goLiveAll, nextSlide, prevSlide,
    displays, outputWindows,
    updateScheduleItem, sendVideoControl,
  } = useApp();

  // Live, locally-imported video background — checked across every destination
  // (program, individual outputs, and role sends) so the transport controls show
  // up even when a video was only sent to one output, not the whole program.
  const liveVideoBg = (() => {
    const candidates = [liveProgram, ...Object.values(liveOutputs || {}), ...Object.values(liveRoleSlides || {})];
    for (const slide of candidates) {
      const bg = (slide?.background?.type === 'video' && slide.background)
        || (slide?.item?.background?.type === 'video' && slide.item.background)
        || null;
      if (bg) return bg;
    }
    return null;
  })();

  const effectiveStage = stageMirrorProgram ? liveProgram : liveStage;

  const resolveOutputSlide = (output) => {
    if (liveOutputs[output.id]) return liveOutputs[output.id];
    if (liveRoleSlides[output.role]) return liveRoleSlides[output.role];
    if (output.role === 'stage') return effectiveStage;
    return liveProgram;
  };

  const displayOutputs = displays.map((display) => ({
    display,
    output: outputWindows.find((output) => output.displayIdx === display.index),
  }));

  const ROLE_TILE_COLORS = {
    presentation: 'var(--green)',
    stage: 'var(--purple)',
    announcement: 'var(--yellow)',
    background: 'var(--cyan)',
    confidence: 'var(--purple)',
    timer: 'var(--cyan)',
    stream: 'var(--pink, #ec4899)',
  };

  // Any output not already shown as a physical-screen tile gets its own tile here,
  // in creation order — so every output a user opens (including Stage, duplicates
  // of a role, or roles with no dedicated tile) is visible and manageable the
  // same way, with no special-cased/undeletable tiles.
  const shownOutputIds = new Set(displayOutputs.filter((d) => d.output).map((d) => d.output.id));
  const remainingOutputs = outputWindows.filter((o) => o.isOpen !== false && !shownOutputIds.has(o.id));

  const handleSend = () => {
    if (!currentSlide || !currentItem) return;
    const slideToSend = { ...currentSlide, item: currentItem };
    if (target === 'program') {
      goLiveProgram(slideToSend);
      return;
    }
    if (target === 'all') {
      goLiveAll(slideToSend);
      return;
    }
    goLiveOutput(target, slideToSend);
  };

  // Static role entries (stage/announcement/background/confidence) only appear
  // when no actual output window has been opened for that role — otherwise the
  // real output window entry (with its user-facing title) is used instead, to
  // avoid listing the same destination twice.
  const openRoles = new Set(outputWindows.map((output) => output.role));
  const targetOptions = [
    { value: 'program', label: 'Program' },
    ...(openRoles.has('stage') ? [] : [{ value: 'stage', label: 'Stage' }]),
    { value: 'all', label: 'All Outputs' },
    ...outputWindows.map((output) => ({
      value: output.id,
      label: `${output.title} (${output.role})`,
    })),
    ...(openRoles.has('announcement') ? [] : [{ value: 'announcement', label: 'Announcements' }]),
    ...(openRoles.has('background') ? [] : [{ value: 'background', label: 'Background' }]),
    ...(openRoles.has('confidence') ? [] : [{ value: 'confidence', label: 'Confidence' }]),
  ];

  const btnStyle = (primary = false) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 'var(--radius)',
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'var(--accent)' : 'var(--bg-panel)',
    color: primary ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
    fontWeight: primary ? 600 : 400, transition: 'all 0.15s',
  });

  return (
    <div style={{
      flex: 1, display: 'flex', background: 'var(--bg)',
      alignItems: 'flex-start', gap: 20,
      padding: 16, overflow: 'auto',
    }}>
      {/* Preview screen — operator's editor column, fixed width outside the output grid */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 340, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Preview
        </div>
        <div style={{
          width: 320, height: 200, borderRadius: 8,
          border: '2px solid var(--border)', overflow: 'hidden', position: 'relative',
          background: '#000',
        }}>
          {currentSlide && currentItem ? (
            <SlideRenderer slide={currentSlide} item={currentItem} scale={0.28} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No slide selected</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%', maxWidth: 340 }}>
          {/* Navigation + Send row — equal-width grid so buttons always align */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 1fr', gap: 6, width: '100%' }}>
            <button type="button" style={{ ...btnStyle(), justifyContent: 'center' }} onClick={prevSlide}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              ◀ Prev
            </button>
            <button type="button" style={{ ...btnStyle(true), justifyContent: 'center', padding: '7px 18px' }} onClick={handleSend}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              disabled={!currentSlide}>
              ▶ Send
            </button>
            <button type="button" style={{ ...btnStyle(true), background: 'var(--cyan)', justifyContent: 'center', padding: '7px 14px' }}
              onClick={() => { if (currentSlide && currentItem) goLiveAll({ ...currentSlide, item: currentItem }); }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              disabled={!currentSlide}>
              ▶▶ All
            </button>
            <button type="button" style={{ ...btnStyle(), justifyContent: 'center' }} onClick={nextSlide}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              Next ▶
            </button>
          </div>
          {/* Send target — full width below the button row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To:</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={{ flex: 1, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', padding: '6px 10px', fontSize: 12 }}
            >
              {targetOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <label style={{
          fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={stageMirrorProgram}
            onChange={(e) => setStageMirrorProgram(e.target.checked)}
          />
          Stage mirrors program
        </label>
        {!stageMirrorProgram && (
          <button
            type="button"
            style={{ ...btnStyle(true), background: 'var(--purple)', opacity: currentSlide ? 1 : 0.45 }}
            onClick={() => {
              if (currentSlide && currentItem) goLiveStage({ ...currentSlide, item: currentItem });
            }}
            disabled={!currentSlide}
          >
            ▶ Stage (independent)
          </button>
        )}
        {currentItem && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {activeSlideIdx + 1} / {currentSlides.length} · {currentItem.title}
          </div>
        )}

        {/* Background editor for current schedule item */}
        {currentItem && (
          <div style={{ width: '100%', maxWidth: 340 }}>
            <button
              onClick={() => setShowBgPicker(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                fontFamily: 'var(--font)', color: 'var(--text-muted)', fontSize: 11,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                background: bgToCss(currentItem.background),
                border: '1px solid rgba(255,255,255,0.2)',
              }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Screen Background</span>
              <span style={{ fontSize: 10 }}>{showBgPicker ? '▲' : '▼'}</span>
            </button>
            {showBgPicker && (
              <div style={{
                marginTop: 4, padding: 10, background: 'var(--bg-panel)',
                border: '1px solid var(--border)', borderRadius: 8,
              }}>
                <BackgroundPicker
                  value={currentItem.background}
                  onChange={bg => updateScheduleItem(currentItem.scheduleId, { background: bg })}
                  compact
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output monitors — uniform 3-column grid so every screen lines up consistently */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 12,
        }}>
          {/* Physical screens */}
          {displayOutputs.map(({ display, output }) => {
            const slide = output ? resolveOutputSlide(output) : null;
            return (
              <MonitorCard
                key={display.id}
                title={output ? output.title : display.label}
                subtitle={output ? `${display.label}${display.isPrimary ? ' · Primary' : ''}` : `${display.label} · no output`}
                accent="var(--cyan)"
                live={!!output}
              >
                <MonitorBody
                  slide={slide}
                  isBlackout={isBlackout}
                  isClear={isClear}
                  emptyLabel={output ? 'Waiting for content' : 'No output assigned'}
                />
              </MonitorCard>
            );
          })}

          {/* Every other open output, in the order it was created */}
          {remainingOutputs.map((output) => {
            const slide = resolveOutputSlide(output);
            return (
              <MonitorCard
                key={output.id}
                title={output.title}
                subtitle={slide?.item?.title || 'No active content'}
                accent={ROLE_TILE_COLORS[output.role] || 'var(--accent)'}
                live={!!slide}
              >
                {output.role === 'confidence' ? (
                  <ScaledConfidencePreview slide={slide} nextSlide={liveNextSlide} isBlackout={isBlackout} />
                ) : (
                  <MonitorBody slide={slide} isBlackout={isBlackout} isClear={isClear} emptyLabel="Waiting for content" />
                )}
              </MonitorCard>
            );
          })}
        </div>

        {/* Transport controls for a live local video background on Program */}
        {liveVideoBg && !isBlackout && (
          <div style={{ marginTop: 12, maxWidth: 320 }}>
            <VideoControls liveVideo={liveVideoBg} sendVideoControl={sendVideoControl} />
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

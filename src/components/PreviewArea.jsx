import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import SlideRenderer from './SlideRenderer';
import BackgroundPicker, { bgToCss } from './BackgroundPicker';

export default function PreviewArea() {
  const [target, setTarget] = useState('program');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const {
    currentItem, currentSlide, currentSlides,
    liveProgram, liveStage, stageMirrorProgram, setStageMirrorProgram,
    liveOutputs, liveRoleSlides,
    activeSlideIdx, isBlackout, isClear,
    goLiveProgram, goLiveStage, goLiveOutput, goLiveAll, nextSlide, prevSlide,
    presentationOpen, stageOpen, displays, outputWindows,
    updateScheduleItem,
  } = useApp();

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

  const builtInRoles = [
    { id: 'announcement', label: 'Announcement Screen', color: 'var(--yellow)' },
    { id: 'background', label: 'Background Screen', color: 'var(--cyan)' },
    { id: 'confidence', label: 'Confidence Monitor', color: 'var(--purple)' },
  ];

  const resolveRoleSlide = (role) => {
    if (liveRoleSlides[role]) return liveRoleSlides[role];
    const output = outputWindows.find((item) => item.role === role);
    return output ? resolveOutputSlide(output) : null;
  };

  const handleSend = () => {
    if (!currentSlide || !currentItem) return;
    const slideToSend = { ...currentSlide, item: currentItem };
    if (target === 'program') {
      goLiveProgram(slideToSend);
      return;
    }
    if (target === 'stage') {
      if (!stageMirrorProgram) {
        goLiveStage(slideToSend);
      }
      return;
    }
    if (target === 'all') {
      goLiveAll(slideToSend);
      return;
    }
    goLiveOutput(target, slideToSend);
  };

  const targetOptions = [
    { value: 'program', label: 'Program' },
    { value: 'stage', label: 'Stage' },
    { value: 'all', label: 'All Outputs' },
    ...outputWindows.map((output) => ({
      value: output.id,
      label: `${output.title} (${output.role})`,
    })),
    { value: 'announcement', label: 'Announcements' },
    { value: 'background', label: 'Background' },
    { value: 'confidence', label: 'Confidence' },
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

  const liveBox = (open, colorVar) => ({
    width: 320, height: 200, borderRadius: 8, overflow: 'hidden', position: 'relative',
    border: `2px solid ${open ? colorVar : 'var(--border)'}`,
    background: '#000',
  });

  return (
    <div style={{
      flex: 1, display: 'flex', background: 'var(--bg)',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      padding: 16, overflow: 'auto', flexWrap: 'wrap',
    }}>
      {/* Preview screen */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', maxWidth: 340 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <button type="button" style={btnStyle()} onClick={prevSlide}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              ◀ Prev
            </button>
            <button type="button" style={btnStyle(true)} onClick={handleSend}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              disabled={!currentSlide}>
              ▶ Send
            </button>
            <button type="button" style={{ ...btnStyle(true), background: 'var(--cyan)' }} onClick={() => { if (currentSlide && currentItem) goLiveAll({ ...currentSlide, item: currentItem }); }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              disabled={!currentSlide}>
              ▶ Send All
            </button>
            <button type="button" style={btnStyle()} onClick={nextSlide}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              Next ▶
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Send to</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={{ flex: 1, minWidth: 150, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', padding: '7px 10px', fontSize: 12 }}
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
              <span style={{ flex: 1, textAlign: 'left' }}>Item Background</span>
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

      {/* Program output monitor */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {presentationOpen && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          )}
          <span style={{ color: presentationOpen ? 'var(--green)' : 'var(--text-muted)' }}>
            {presentationOpen ? 'Program live' : 'Program (offline)'}
          </span>
        </div>
        <div style={liveBox(presentationOpen, 'var(--green)')}>
          {isBlackout ? (
            <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>BLACKOUT</span>
            </div>
          ) : isClear ? (
            <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>CLEAR</span>
            </div>
          ) : liveProgram && liveProgram.item ? (
            <SlideRenderer slide={liveProgram} item={liveProgram.item} scale={0.28} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No output</span>
            </div>
          )}
        </div>
        {liveProgram && (
          <div style={{ fontSize: 11, color: 'var(--green)' }}>
            ● {liveProgram.label} — {liveProgram.item?.title}
          </div>
        )}
      </div>

      {/* Available screens */}
      {displays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Screens
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr', minWidth: 260 }}>
            {displayOutputs.map(({ display, output }) => {
              const title = output ? `${output.title} (${output.role})` : display.label;
              const slide = output ? resolveOutputSlide(output) : null;
              const subtitle = output ? `Screen ${display.index + 1}` : `Screen ${display.index + 1} • no output`;
              return (
                <div key={display.id} style={{ borderRadius: 12, overflow: 'hidden', background: '#090b10', border: '1px solid var(--border)' }}>
                  <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#0f1218' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{subtitle}</div>
                    </div>
                    {display.isPrimary && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Primary</div>}
                  </div>
                  <div style={{ width: '100%', height: 140, position: 'relative' }}>
                    {slide && slide.item ? (
                      <SlideRenderer slide={slide} item={slide.item} scale={0.18} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                        {output ? 'Waiting for content' : 'No output assigned'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Role outputs
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr', minWidth: 260 }}>
          {builtInRoles.map((roleMeta) => {
            const slide = resolveRoleSlide(roleMeta.id);
            return (
              <div key={roleMeta.id} style={{ borderRadius: 12, overflow: 'hidden', background: '#090b10', border: '1px solid var(--border)' }}>
                <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#0f1218' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{roleMeta.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {slide?.item?.title || 'No active content'}
                    </div>
                  </div>
                </div>
                <div style={{ width: '100%', height: 140, position: 'relative' }}>
                  {slide && slide.item ? (
                    <SlideRenderer slide={slide} item={slide.item} scale={0.18} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                      Waiting for role content
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage output monitor */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {stageOpen && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          )}
          <span style={{ color: stageOpen ? 'var(--purple)' : 'var(--text-muted)' }}>
            {stageOpen ? 'Stage live' : 'Stage (offline)'}
            {stageMirrorProgram && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)' }}>(mirrored)</span>}
          </span>
        </div>
        <div style={liveBox(stageOpen, 'var(--purple)')}>
          {isBlackout ? (
            <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>BLACKOUT</span>
            </div>
          ) : isClear ? (
            <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>CLEAR</span>
            </div>
          ) : effectiveStage && effectiveStage.item ? (
            <SlideRenderer slide={effectiveStage} item={effectiveStage.item} scale={0.28} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No output</span>
            </div>
          )}
        </div>
        {effectiveStage && (
          <div style={{ fontSize: 11, color: 'var(--purple)' }}>
            ● {effectiveStage.label} — {effectiveStage.item?.title}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

import React from 'react';

/**
 * Shared slide preview panel used by both StageView and ConfidenceMonitor.
 *
 * @param {object}  slide        - Slide payload with .lines, .item, .chords, etc.
 * @param {boolean} isBlackout   - Show solid black instead of content.
 * @param {string}  label        - Badge text shown in the label bar (e.g. "Current").
 * @param {string}  accent       - CSS colour used for the label bar accent line.
 * @param {boolean} dimmed       - Reduced opacity mode for the "Next" panel.
 * @param {string}  flex         - CSS flex value for the outer container (default '1').
 */
export function SlideCanvas({ slide, isBlackout = false, label, accent, dimmed = false, flex = '1' }) {
  const bg = slide?.item?.background?.value || (dimmed ? '#0a0c12' : '#0d1117');
  const textColor = slide?.item?.textColor || '#ffffff';
  const fontFamily = slide?.item?.fontFamily || 'Georgia';
  const textOpacity = dimmed ? 0.55 : 1;

  const resolvedBg = isBlackout
    ? '#000'
    : slide?.item?.background?.type === 'color'
      ? (slide.item.background.value || bg)
      : bg;

  return (
    <div style={{
      flex,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
      background: resolvedBg,
    }}>
      {/* Background image */}
      {slide?.item?.background?.type === 'image' && !isBlackout && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${slide.item.background.value})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: `brightness(${(slide.item.background.brightness || 0.4) * (dimmed ? 0.55 : 1)})`,
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

      {/* YouTube background — live iframe for current, static thumbnail for dimmed (next) */}
      {slide?.item?.background?.type === 'youtube' && slide.item.background.value && !isBlackout && (
        <>
          {!dimmed ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${slide.item.background.value}?autoplay=1&mute=1&loop=1&playlist=${slide.item.background.value}&controls=0&disablekb=1&modestbranding=1&playsinline=1&iv_load_policy=3`}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                border: 'none', pointerEvents: 'none', zIndex: 0,
              }}
              allow="autoplay; encrypted-media"
              title="YouTube background"
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(https://img.youtube.com/vi/${slide.item.background.value}/hqdefault.jpg)`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'brightness(0.25)',
              zIndex: 0,
            }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${dimmed ? 0.6 : 0.45})`, zIndex: 0 }} />
        </>
      )}

      {/* Slide content */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '6% 8%', textAlign: 'center',
        position: 'relative', zIndex: 1, overflow: 'hidden',
      }}>
        {isBlackout ? (
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>BLACKOUT</div>
        ) : slide ? (
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

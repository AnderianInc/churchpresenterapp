import React, { useRef, useEffect } from 'react';
import { bgToCss } from './BackgroundPicker';

/**
 * Renders a single slide for preview thumbnails, live output, and stage views.
 *
 * Background resolution order:
 *   slide.background  (per-slide override)  → item.background  (song/item default)
 *
 * Video lifecycle:
 *   Pass videoRef to receive a ref to the <video> element for external play/pause control.
 *   Pass videoLoop={false} to disable looping.
 *   Pass videoBrightness to override the dim filter (default 0.45).
 */
export default function SlideRenderer({
  slide,
  item,
  scale = 1,
  fullscreen = false,
  videoRef: externalVideoRef,
  iframeRef: externalIframeRef,
  ytPlayerId,
  videoLoop = true,
  videoBrightness,
}) {
  // Per-slide background overrides item-level background
  const effectiveBg = slide?.background || item?.background;
  const bgType = effectiveBg?.type;
  const bg = bgToCss(effectiveBg);

  const textColor = item?.textColor || '#ffffff';
  const fontSize = (item?.fontSize || 44) * scale;
  const fontFamily = item?.fontFamily || 'Georgia';
  const lines = slide?.lines || '';
  const textAlign = slide?.textAlign || 'center';
  const hAlign = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  // Internal video ref — merged with external if provided
  const internalVideoRef = useRef(null);
  useEffect(() => {
    if (externalVideoRef) {
      if (typeof externalVideoRef === 'function') externalVideoRef(internalVideoRef.current);
      else externalVideoRef.current = internalVideoRef.current;
    }
  });

  // Internal iframe ref — merged with external if provided
  const internalIframeRef = useRef(null);
  useEffect(() => {
    if (externalIframeRef) {
      if (typeof externalIframeRef === 'function') externalIframeRef(internalIframeRef.current);
      else externalIframeRef.current = internalIframeRef.current;
    }
  });

  const containerStyle = fullscreen ? {
    width: '100vw', height: '100vh',
    display: 'flex', flexDirection: 'column',
    alignItems: hAlign, justifyContent: 'center',
    background: bg, padding: '5%', textAlign,
    position: 'relative',
  } : {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: hAlign, justifyContent: 'center',
    background: bg, padding: '8%', textAlign,
    position: 'relative',
  };

  const dimLevel = videoBrightness ?? 0.45;

  return (
    <div style={containerStyle}>
      {/* Image background */}
      {bgType === 'image' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${effectiveBg.value})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: `brightness(${effectiveBg.brightness || 0.6})`,
        }} />
      )}

      {/* Video background */}
      {bgType === 'video' && (
        <video
          ref={internalVideoRef}
          autoPlay
          muted
          loop={videoLoop}
          playsInline
          src={effectiveBg.value}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            filter: `brightness(${dimLevel})`,
          }}
        />
      )}

      {/* YouTube background
            fullscreen + ytPlayerId → empty div; the YT IFrame API player is injected here
                                       by the parent (OutputView) which manages the player lifecycle
            fullscreen, no ytPlayerId → raw iframe (e.g. ConfidencePanel's SlideSection)
            thumbnail               → static hqdefault.jpg image
      */}
      {bgType === 'youtube' && effectiveBg.value && (
        <>
          {fullscreen && ytPlayerId ? (
            // Placeholder — OutputView's YT.Player injects its iframe here
            <div
              id={ytPlayerId}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          ) : fullscreen ? (
            // Fallback raw iframe (no YT API, e.g. ConfidencePanel)
            <iframe
              ref={internalIframeRef}
              src={`https://www.youtube-nocookie.com/embed/${effectiveBg.value}?autoplay=1&mute=1&loop=1&playlist=${effectiveBg.value}&controls=0&disablekb=1&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 'none', pointerEvents: 'none',
              }}
              allow="autoplay; encrypted-media"
              title="YouTube background"
            />
          ) : (
            // Thumbnail preview
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(https://img.youtube.com/vi/${effectiveBg.value}/hqdefault.jpg)`,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
          )}
          {/* Dimming overlay — replaces CSS filter which can't cross iframe boundaries */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(0,0,0,${1 - dimLevel})`,
          }} />
        </>
      )}

      {/* Text layer */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign }}>
        <div style={{
          fontSize, fontFamily, color: textColor,
          lineHeight: 1.4, fontWeight: 400,
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
          whiteSpace: 'pre-line',
          letterSpacing: fullscreen ? '0.02em' : '0.01em',
        }}>
          {lines}
        </div>
        {slide?.label && !fullscreen && (
          <div style={{
            position: 'absolute', bottom: -20, right: 0,
            fontSize: fontSize * 0.5, color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {slide.label}
          </div>
        )}
      </div>
    </div>
  );
}

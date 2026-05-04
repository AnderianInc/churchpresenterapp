import React, { useRef, useEffect, useState } from 'react';
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

  // Video error state — cleared whenever the source changes
  const [videoError, setVideoError] = useState(null);
  const videoSrc = bgType === 'video' ? effectiveBg?.value : null;
  useEffect(() => { setVideoError(null); }, [videoSrc]);

  const handleVideoError = (e) => {
    const code = e.target?.error?.code;
    const messages = {
      1: 'Video playback was aborted.',
      2: 'Could not load video — network or file-path error.',
      3: 'Video could not be decoded — file may be corrupt.',
      4: 'Video format / codec not supported. Convert the file to H.264 MP4 or VP9 WebM and re-import.',
    };
    setVideoError(messages[code] || 'Unknown video error.');
  };

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
        <>
          <video
            ref={internalVideoRef}
            autoPlay
            muted
            loop={videoLoop}
            playsInline
            src={effectiveBg.value}
            onError={handleVideoError}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
              filter: `brightness(${dimLevel})`,
              display: videoError ? 'none' : 'block',
            }}
          />
          {videoError && (
            <div style={{
              position: 'absolute', inset: 0,
              background: '#0a0a0a',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}>
              {fullscreen && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(239,68,68,0.12)',
                  borderTop: '1px solid rgba(239,68,68,0.35)',
                  color: '#fca5a5',
                  padding: '10px 20px',
                  fontSize: 13,
                  fontFamily: 'Inter, monospace',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>⚠</span>
                  <span>{videoError}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* YouTube background
            fullscreen → postMessage-controlled iframe (autoplay=0, enablejsapi=1)
            thumbnail  → static hqdefault.jpg for slide previews
      */}
      {bgType === 'youtube' && effectiveBg.value && (
        <>
          {fullscreen ? (
            <iframe
              ref={internalIframeRef}
              src={`https://www.youtube-nocookie.com/embed/${effectiveBg.value}?autoplay=0&mute=1&loop=1&playlist=${effectiveBg.value}&controls=0&disablekb=1&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(window.location.origin && window.location.origin !== 'null' ? window.location.origin : window.location.href.split('/').slice(0, 3).join('/'))}`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 'none', pointerEvents: 'none',
              }}
              allow="autoplay; encrypted-media"
              title="YouTube background"
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(https://img.youtube.com/vi/${effectiveBg.value}/hqdefault.jpg)`,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
          )}
          {/* Dimming overlay */}
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

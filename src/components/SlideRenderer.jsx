import React, { useRef, useEffect, useState, memo } from 'react';
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
function SlideRenderer({
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
  const shouldLoopVideo = videoLoop && effectiveBg?.loop !== false;

  // In Electron, rewrite file:// video URLs to media:// so they go through the
  // registered protocol handler that adds proper byte-range streaming support.
  const rawVideoSrc = bgType === 'video' ? (effectiveBg?.value || null) : null;
  const videoSrc = rawVideoSrc && window.electronAPI
    ? rawVideoSrc.replace(/^file:/, 'media:')
    : rawVideoSrc;

  // Video error state — cleared whenever the source changes
  const [videoError, setVideoError] = useState(null);
  useEffect(() => { setVideoError(null); }, [videoSrc]);

  // Internal video ref — merged with external if provided
  const internalVideoRef = useRef(null);

  // Auto-recovery: background videos can silently freeze (decoder stall, a
  // dropped media:// stream) with no error event, which previously forced an app
  // restart. A watchdog detects a frozen frame and transient errors, then reloads
  // the element and resumes where it left off. Only truly fatal cases (unsupported
  // codec, or repeated failed recoveries) surface the error overlay.
  const recoverRef = useRef(null);
  const fatalMsgRef = useRef('Video playback stalled repeatedly. Re-import the file or convert it to H.264 MP4 / VP9 WebM.');

  const handleVideoError = (e) => {
    const code = e.target?.error?.code;
    const messages = {
      1: 'Video playback was aborted.',
      2: 'Could not load video — network or file-path error.',
      3: 'Video could not be decoded — file may be corrupt.',
      4: 'Video format / codec not supported. Convert the file to H.264 MP4 or VP9 WebM and re-import.',
    };
    // Unsupported codec will never recover — show immediately.
    if (code === 4) { setVideoError(messages[4]); return; }
    // Transient errors (abort/network/decode): remember the message, then try to
    // recover rather than giving up on the first blip.
    fatalMsgRef.current = messages[code] || 'Video playback error.';
    recoverRef.current?.('error');
  };

  // Watchdog + recovery driver — active only while a video background is mounted.
  useEffect(() => {
    if (bgType !== 'video' || !videoSrc) return undefined;
    const video = internalVideoRef.current;
    if (!video) return undefined;

    let disposed = false;
    let attempts = 0;
    let lastTime = -1;
    let frozenTicks = 0;

    const tryRecover = () => {
      if (disposed) return;
      if (attempts >= 6) { setVideoError(fatalMsgRef.current); return; }
      attempts += 1;
      const resumeAt = video.currentTime || 0;
      const onReady = () => {
        video.removeEventListener('loadeddata', onReady);
        try {
          if (resumeAt > 0 && resumeAt < (video.duration || Infinity)) video.currentTime = resumeAt;
        } catch (_) {}
        video.play().catch(() => {});
      };
      try {
        video.addEventListener('loadeddata', onReady);
        video.load();
        video.play().catch(() => {});
      } catch (_) {}
    };
    recoverRef.current = tryRecover;

    const onPlaying = () => { attempts = 0; frozenTicks = 0; setVideoError(null); };
    const onStalled = () => tryRecover();
    video.addEventListener('playing', onPlaying);
    video.addEventListener('stalled', onStalled);

    const watchdog = setInterval(() => {
      if (disposed) return;
      // Only judge "frozen" when the element believes it is actively playing.
      if (video.paused || video.ended || video.readyState < 2) { lastTime = video.currentTime; frozenTicks = 0; return; }
      if (Math.abs(video.currentTime - lastTime) < 0.01) {
        frozenTicks += 1;
        if (frozenTicks >= 2) { frozenTicks = 0; tryRecover(); } // ~4s with no progress
      } else {
        frozenTicks = 0;
        if (attempts > 0) attempts = 0; // real progress clears the recovery budget
      }
      lastTime = video.currentTime;
    }, 2000);

    return () => {
      disposed = true;
      recoverRef.current = null;
      clearInterval(watchdog);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('stalled', onStalled);
    };
  }, [bgType, videoSrc]);
  useEffect(() => {
    if (externalVideoRef) {
      if (typeof externalVideoRef === 'function') externalVideoRef(internalVideoRef.current);
      else externalVideoRef.current = internalVideoRef.current;
    }
  // externalVideoRef is a ref object or callback — safe to list; bgType gates whether the
  // video element is mounted so we re-sync whenever the background type changes too.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgType, externalVideoRef]);

  // Internal iframe ref — merged with external if provided
  const internalIframeRef = useRef(null);
  useEffect(() => {
    if (externalIframeRef) {
      if (typeof externalIframeRef === 'function') externalIframeRef(internalIframeRef.current);
      else externalIframeRef.current = internalIframeRef.current;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgType, externalIframeRef]);

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

  // Per-background brightness (stored on video backgrounds via the picker) takes
  // precedence, then an explicit prop override, then the default dim level.
  const dimLevel = effectiveBg?.brightness ?? videoBrightness ?? 0.45;

  return (
    <div style={containerStyle}>
      {/* Image background
            fit:   'cover' (default) fills + crops; 'contain' shows the whole image
            scale: 0..1, used with 'contain' to reduce the image below 100% of the slide.
                   Areas outside the image fall through to the slide's base background. */}
      {bgType === 'image' && (() => {
        const fit = effectiveBg.fit === 'contain' ? 'contain' : 'cover';
        const scale = typeof effectiveBg.scale === 'number'
          ? Math.max(0.1, Math.min(1, effectiveBg.scale))
          : 1;
        // Single-value backgroundSize sets width; height auto-scales preserving
        // aspect ratio. So `${pct}%` gives a width=pct, aspect-preserved image.
        const sizeValue = fit === 'cover'
          ? 'cover'
          : scale >= 0.999 ? 'contain' : `${Math.round(scale * 100)}%`;
        return (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${effectiveBg.value})`,
            backgroundSize: sizeValue,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: `brightness(${effectiveBg.brightness || 0.6})`,
          }} />
        );
      })()}

      {/* Video background */}
      {bgType === 'video' && (
        <>
          <video
            ref={internalVideoRef}
            autoPlay
            muted
            loop={shouldLoopVideo}
            playsInline
            src={videoSrc}
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
              src={`https://www.youtube-nocookie.com/embed/${effectiveBg.value}?autoplay=0&mute=1&loop=1&playlist=${effectiveBg.value}&controls=0&disablekb=1&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1${/^https?:\/\//.test(window.location.origin || '') ? `&origin=${encodeURIComponent(window.location.origin)}` : ''}`}
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

export default memo(SlideRenderer);

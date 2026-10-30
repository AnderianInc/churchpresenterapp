import React, { useRef, useState, useEffect } from 'react';
import SlideRenderer from './SlideRenderer';
import { getTransition, subscribeTransition } from '../store/transitionSettings';

// ── Signatures ────────────────────────────────────────────────────────────────

function bgOf(slide) {
  return slide?.background || slide?.item?.background || null;
}

// Local-video source of a slide's background, or null. Used to keep a background
// video playing continuously across a slide change (no remount → no restart).
function videoSrcOf(slide) {
  const bg = bgOf(slide);
  return bg?.type === 'video' ? (bg.value || null) : null;
}

// Visible-content signature — a crossfade is triggered only when this changes, so
// re-sends of the same slide (e.g. relayed video state) don't restart anything.
function sigOf(slide) {
  if (!slide) return 'none';
  const bg = bgOf(slide);
  return [
    slide.id ?? '', slide.lines ?? '', slide.chords ?? '', slide.label ?? '',
    slide.textAlign ?? '', bg?.type ?? '', bg?.value ?? '', bg?.brightness ?? '',
  ].join('|');
}

/**
 * Fullscreen slide with an optional crossfade when the slide changes.
 *
 * The outgoing slide stays painted beneath while the incoming slide fades in over
 * it, giving a smooth dissolve. The fade is skipped (instant swap) when:
 *   - the transition is disabled in settings, or
 *   - the same background video continues across the change (so it keeps playing).
 */
export default function FadeSlide({ slide, item, videoRef }) {
  const [config, setConfig] = useState(getTransition);
  useEffect(() => subscribeTransition(setConfig), []);

  const [top, setTop] = useState({ key: 0, slide, item });
  const [under, setUnder] = useState(null);
  const [fading, setFading] = useState(false);

  const keyRef = useRef(0);
  const curRef = useRef({ slide, item });
  const timerRef = useRef(null);
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useEffect(() => {
    const prev = curRef.current;
    curRef.current = { slide, item };

    // Same visible content → refresh refs in place; never remount (keeps a
    // playing video and its operator-controlled state intact).
    if (sigOf(prev.slide) === sigOf(slide)) {
      setTop(t => ({ ...t, slide, item }));
      return;
    }

    const { enabled, duration } = cfgRef.current;
    const sameVideo = videoSrcOf(prev.slide) && videoSrcOf(prev.slide) === videoSrcOf(slide);
    const doFade = enabled && !sameVideo;

    keyRef.current += 1;
    const nextTop = { key: keyRef.current, slide, item };

    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    if (!doFade) {
      setUnder(null);
      setFading(false);
      setTop(nextTop);
      return;
    }

    // Snapshot the outgoing slide beneath, then fade the new one in over it.
    setUnder(prev.slide ? { key: `u${keyRef.current}`, slide: prev.slide, item: prev.item } : null);
    setTop(nextTop);
    setFading(true);
    timerRef.current = setTimeout(() => {
      setUnder(null);
      setFading(false);
      timerRef.current = null;
    }, duration + 60);
  // Re-run whenever the incoming slide/item references change.
  }, [slide, item]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const duration = config.duration;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <style>{`@keyframes cpSlideFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* Outgoing slide (fading out beneath) */}
      {under && (
        <div key={under.key} style={{ position: 'absolute', inset: 0 }}>
          <SlideRenderer slide={under.slide} item={under.item} fullscreen />
        </div>
      )}

      {/* Incoming / current slide */}
      <div
        key={top.key}
        style={{
          position: 'absolute', inset: 0,
          animation: fading ? `cpSlideFadeIn ${duration}ms ease` : 'none',
        }}
      >
        <SlideRenderer slide={top.slide} item={top.item} fullscreen videoRef={videoRef} />
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';

/**
 * ImageCropModal — pick a rectangular crop region from an image and return
 * the cropped result as a data URL.
 *
 * Props:
 *   src      — image URL / data URL / blob URL to crop
 *   onApply  — called with the cropped data URL (image/png) when user clicks Apply
 *   onCancel — called when user dismisses without cropping
 *
 * Behaviour:
 *   - Aspect ratio presets: free / 16:9 / 4:3 / 1:1. Selecting one re-fits the
 *     crop rect to the chosen aspect, anchored to the centre.
 *   - Drag inside the rect to move; drag corner handles to resize.
 *   - Apply renders the cropped pixels (in native image resolution) via canvas.
 */

const ASPECTS = {
  free: null,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
};

const HANDLE_SIZE = 12;

export default function ImageCropModal({ src, onApply, onCancel }) {
  // Natural image dimensions (set after load)
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  // Display dimensions and ratio (image scaled into the display area)
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [display, setDisplay] = useState({ w: 0, h: 0, scale: 1 });
  // Crop rect in *image natural* coordinates
  const [crop, setCrop] = useState(null); // { x, y, w, h }
  const [aspect, setAspect] = useState('free');
  // Mouse-drag state — null when idle
  const drag = useRef(null);

  // When the image finishes loading, fit it into the display and start with
  // a crop rect that covers the whole image.
  const handleLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    setNatural({ w: W, h: H });
    const maxW = Math.min(720, window.innerWidth - 80);
    const maxH = Math.min(480, window.innerHeight - 240);
    const scale = Math.min(maxW / W, maxH / H, 1);
    setDisplay({ w: W * scale, h: H * scale, scale });
    setCrop({ x: 0, y: 0, w: W, h: H });
  };

  // Re-fit the crop rect to the selected aspect, anchored on the image centre.
  useEffect(() => {
    if (!natural.w || !natural.h) return;
    const a = ASPECTS[aspect];
    if (a === null) return; // 'free' — keep current rect
    setCrop(prev => {
      if (!prev) return prev;
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      // Largest rect of the target aspect that fits the image
      let w = Math.min(natural.w, prev.w);
      let h = w / a;
      if (h > natural.h) { h = natural.h; w = h * a; }
      let x = cx - w / 2, y = cy - h / 2;
      x = Math.max(0, Math.min(x, natural.w - w));
      y = Math.max(0, Math.min(y, natural.h - h));
      return { x, y, w, h };
    });
  }, [aspect, natural.w, natural.h]);

  // ── Drag helpers ──────────────────────────────────────────────────────────
  // Convert client mouse coords → image natural coords
  const clientToImage = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    return { x: dx / display.scale, y: dy / display.scale };
  };

  const beginDrag = (mode, corner) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = {
      mode, corner,
      start: clientToImage(e),
      startCrop: { ...crop },
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', endDrag);
  };

  const onMove = (e) => {
    if (!drag.current || !natural.w) return;
    const here = clientToImage(e);
    const { mode, corner, start, startCrop } = drag.current;
    const a = ASPECTS[aspect];
    if (mode === 'move') {
      let nx = startCrop.x + (here.x - start.x);
      let ny = startCrop.y + (here.y - start.y);
      nx = Math.max(0, Math.min(nx, natural.w - startCrop.w));
      ny = Math.max(0, Math.min(ny, natural.h - startCrop.h));
      setCrop({ ...startCrop, x: nx, y: ny });
    } else if (mode === 'resize') {
      const { x: sx, y: sy, w: sw, h: sh } = startCrop;
      const minSide = 16;
      let nx = sx, ny = sy, nw = sw, nh = sh;
      if (corner.includes('r')) nw = Math.max(minSide, here.x - sx);
      if (corner.includes('l')) { const right = sx + sw; nx = Math.min(here.x, right - minSide); nw = right - nx; }
      if (corner.includes('b')) nh = Math.max(minSide, here.y - sy);
      if (corner.includes('t')) { const bot = sy + sh; ny = Math.min(here.y, bot - minSide); nh = bot - ny; }
      if (a) {
        // Maintain aspect: prefer width as driver
        nh = nw / a;
        if (corner.includes('t')) ny = (sy + sh) - nh;
      }
      // Clamp within image bounds
      if (nx < 0) { nw += nx; nx = 0; if (a) nh = nw / a; }
      if (ny < 0) { nh += ny; ny = 0; if (a) nw = nh * a; }
      if (nx + nw > natural.w) { nw = natural.w - nx; if (a) nh = nw / a; }
      if (ny + nh > natural.h) { nh = natural.h - ny; if (a) nw = nh * a; }
      setCrop({ x: nx, y: ny, w: nw, h: nh });
    }
  };

  const endDrag = () => {
    drag.current = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', endDrag);
  };

  // Apply: render the cropped region to a hidden canvas and return its data URL.
  const apply = () => {
    if (!crop || !imgRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(crop.w);
    canvas.height = Math.round(crop.h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    onApply(canvas.toDataURL('image/png'));
  };

  // Escape closes
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  // Display-space crop rect (for the overlay)
  const dCrop = crop ? {
    x: crop.x * display.scale,
    y: crop.y * display.scale,
    w: crop.w * display.scale,
    h: crop.h * display.scale,
  } : null;

  const cornerStyle = (cls) => ({
    position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE,
    background: '#fff', border: '1px solid #000',
    borderRadius: 2, cursor: `${cls}-resize`,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-panel)', borderRadius: 10, border: '1px solid var(--border)',
        padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16 }}>✂</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Crop image</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.keys(ASPECTS).map(k => (
              <button key={k} onClick={() => setAspect(k)} style={{
                padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                fontSize: 11, fontFamily: 'var(--font)',
                background: aspect === k ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: aspect === k ? '#fff' : 'var(--text-dim)',
                border: '1px solid ' + (aspect === k ? 'var(--accent)' : 'var(--border)'),
              }}>{k}</button>
            ))}
          </div>
        </div>

        <div
          ref={containerRef}
          style={{
            position: 'relative', userSelect: 'none',
            width: display.w || 400, height: display.h || 240,
            background: '#000',
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            ref={imgRef}
            src={src}
            onLoad={handleLoad}
            draggable={false}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
          {dCrop && (
            <>
              {/* Darkened mask outside the crop rect — four rectangles around it */}
              <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: dCrop.y, background: 'rgba(0,0,0,0.55)' }} />
              <div style={{ position: 'absolute', left: 0, top: dCrop.y + dCrop.h, width: '100%', height: display.h - dCrop.y - dCrop.h, background: 'rgba(0,0,0,0.55)' }} />
              <div style={{ position: 'absolute', left: 0, top: dCrop.y, width: dCrop.x, height: dCrop.h, background: 'rgba(0,0,0,0.55)' }} />
              <div style={{ position: 'absolute', left: dCrop.x + dCrop.w, top: dCrop.y, width: display.w - dCrop.x - dCrop.w, height: dCrop.h, background: 'rgba(0,0,0,0.55)' }} />
              {/* Crop rect outline + drag-to-move surface */}
              <div
                onMouseDown={beginDrag('move')}
                style={{
                  position: 'absolute', left: dCrop.x, top: dCrop.y, width: dCrop.w, height: dCrop.h,
                  border: '1px dashed #fff', cursor: 'move',
                }}
              />
              {/* Corner handles */}
              <div onMouseDown={beginDrag('resize', 'tl')} style={{ ...cornerStyle('nw'), left: dCrop.x - HANDLE_SIZE / 2, top: dCrop.y - HANDLE_SIZE / 2 }} />
              <div onMouseDown={beginDrag('resize', 'tr')} style={{ ...cornerStyle('ne'), left: dCrop.x + dCrop.w - HANDLE_SIZE / 2, top: dCrop.y - HANDLE_SIZE / 2 }} />
              <div onMouseDown={beginDrag('resize', 'bl')} style={{ ...cornerStyle('sw'), left: dCrop.x - HANDLE_SIZE / 2, top: dCrop.y + dCrop.h - HANDLE_SIZE / 2 }} />
              <div onMouseDown={beginDrag('resize', 'br')} style={{ ...cornerStyle('se'), left: dCrop.x + dCrop.w - HANDLE_SIZE / 2, top: dCrop.y + dCrop.h - HANDLE_SIZE / 2 }} />
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {crop && natural.w
              ? `Output ${Math.round(crop.w)} × ${Math.round(crop.h)} px from ${natural.w} × ${natural.h}`
              : 'Loading image…'}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onCancel} style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
          }}>Cancel</button>
          <button onClick={apply} disabled={!crop} style={{
            background: 'var(--accent)', border: 'none', color: '#fff',
            padding: '6px 16px', borderRadius: 4, cursor: crop ? 'pointer' : 'not-allowed',
            fontSize: 12, fontFamily: 'var(--font)', fontWeight: 600,
            opacity: crop ? 1 : 0.5,
          }}>Apply crop</button>
        </div>
      </div>
    </div>
  );
}

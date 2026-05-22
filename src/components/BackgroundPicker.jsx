import React, { useState, useRef } from 'react';
import ImageCropModal from './ImageCropModal';

// ── Preset palettes ───────────────────────────────────────────────────────────

const SOLID_PRESETS = [
  { name: 'Deep Navy',    value: '#0a0f1e' },
  { name: 'Midnight',     value: '#0d1117' },
  { name: 'Deep Purple',  value: '#0d0a1e' },
  { name: 'Forest',       value: '#0a1a0f' },
  { name: 'Dark Slate',   value: '#0f1219' },
  { name: 'Black',        value: '#000000' },
  { name: 'Ocean Blue',   value: '#061525' },
  { name: 'Deep Maroon',  value: '#1a0a0a' },
  { name: 'Rich Teal',    value: '#041e1a' },
  { name: 'Dark Crimson', value: '#1a0510' },
  { name: 'Warm Black',   value: '#0f0d08' },
  { name: 'Charcoal',     value: '#1c1c1c' },
];

const GRADIENT_PRESETS = [
  { name: 'Blue Gradient',  value: 'linear-gradient(135deg, #0a0f1e 0%, #1a3a6a 100%)' },
  { name: 'Purple Night',   value: 'linear-gradient(135deg, #0d0a1e 0%, #2a1a4a 100%)' },
  { name: 'Forest Dawn',    value: 'linear-gradient(135deg, #0a1a0f 0%, #1a3a2a 100%)' },
  { name: 'Golden Hour',    value: 'linear-gradient(135deg, #1a0f00 0%, #3a2a0a 100%)' },
  { name: 'Sunset Red',     value: 'linear-gradient(135deg, #1a0a0a 0%, #3a0f0f 100%)' },
  { name: 'Deep Space',     value: 'linear-gradient(180deg, #000000 0%, #0a0f1e 100%)' },
  { name: 'Ocean Depth',    value: 'linear-gradient(180deg, #020d1a 0%, #0a2a40 100%)' },
  { name: 'Verdant',        value: 'linear-gradient(135deg, #050e08 0%, #0f2a18 100%)' },
];

// ── CSS helper ────────────────────────────────────────────────────────────────

/**
 * Convert a background object to a CSS background string.
 * Handles legacy CSS-string gradients AND the structured { angle, stops } format.
 */
export function bgToCss(bg) {
  if (!bg) return '#0d1117';
  if (bg.type === 'color') return bg.value || '#0d1117';
  if (bg.type === 'image') {
    if (!bg.value) return '#0d1117';
    const brightness = bg.brightness != null ? bg.brightness : 1;
    return brightness < 1
      ? `linear-gradient(rgba(0,0,0,${1 - brightness}),rgba(0,0,0,${1 - brightness})), url(${JSON.stringify(bg.value)}) center/cover no-repeat`
      : `url(${JSON.stringify(bg.value)}) center/cover no-repeat`;
  }
  if (bg.type === 'gradient') {
    if (bg.value) return bg.value; // legacy / preset CSS string
    if (bg.stops && bg.stops.length >= 2) {
      const stops = bg.stops.map(s => `${s.color} ${s.position}%`).join(', ');
      return `linear-gradient(${bg.angle ?? 135}deg, ${stops})`;
    }
  }
  if (bg.type === 'youtube') return '#000000'; // iframe renders on top; CSS bg is a dark placeholder
  return '#0d1117';
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * BackgroundPicker
 *
 * Props:
 *   value    – current background object { type, value } | { type, angle, stops }
 *   onChange – called with the new background object
 *   compact  – smaller layout (no labels, tighter grid) for per-slide use
 */
export default function BackgroundPicker({ value, onChange, compact = false }) {
  const initialMode = value?.type === 'gradient' ? 'gradient' : value?.type === 'image' ? 'image' : 'solid';
  const [mode, setMode] = useState(initialMode);
  const imgInputRef = useRef(null);

  // Custom gradient builder state
  const [gradAngle, setGradAngle] = useState(135);
  const [gradStop1, setGradStop1] = useState('#0a0f1e');
  const [gradStop2, setGradStop2] = useState('#1a3a6a');

  const currentCss = bgToCss(value);

  const selectSolid = (hex) => onChange({ type: 'color', value: hex });
  const selectGradient = (css) => onChange({ type: 'gradient', value: css });
  const applyCustomGradient = () =>
    onChange({ type: 'gradient', value: `linear-gradient(${gradAngle}deg, ${gradStop1} 0%, ${gradStop2} 100%)` });

  // Crop-modal state. cropSrc is the URL the user just picked; the modal opens
  // when it's non-null. Users may also re-open the cropper on an existing image
  // via the "✂ Crop" button below.
  const [cropSrc, setCropSrc] = useState(null);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let url;
    if (window.electronAPI?.copyMediaFile && file.path) {
      try { url = await window.electronAPI.copyMediaFile(file.path); }
      catch { url = URL.createObjectURL(file); }
    } else {
      url = URL.createObjectURL(file);
    }
    onChange({ type: 'image', value: url, brightness: 0.7 });
    setCropSrc(url);
    e.target.value = '';
  };

  const applyCrop = (croppedDataUrl) => {
    onChange({ ...(value || {}), type: 'image', value: croppedDataUrl, brightness: value?.brightness ?? 0.7 });
    setCropSrc(null);
  };

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setMode(id)}
      style={{
        padding: compact ? '3px 8px' : '4px 12px',
        borderRadius: 4, border: 'none', cursor: 'pointer',
        background: mode === id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
        color: mode === id ? '#fff' : 'var(--text-dim)',
        fontSize: 11, fontFamily: 'var(--font)', transition: 'all 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div>
      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: compact ? 8 : 12 }}>
        {tabBtn('solid', '🎨 Solid')}
        {tabBtn('gradient', '🌈 Gradient')}
        {tabBtn('image', '🖼 Image')}
      </div>

      {/* ── Solid ── */}
      {mode === 'solid' && (
        <div>
          {/* Custom color input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: compact ? 8 : 10 }}>
            <input
              type="color"
              value={value?.type === 'color' ? value.value : '#0a0f1e'}
              onChange={e => selectSolid(e.target.value)}
              style={{ width: 44, height: 34, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
              {value?.type === 'color' ? value.value : '#0a0f1e'}
            </span>
          </div>
          {/* Preset swatches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: compact ? 4 : 5 }}>
            {SOLID_PRESETS.map(p => (
              <div
                key={p.value}
                title={p.name}
                onClick={() => selectSolid(p.value)}
                style={{
                  height: compact ? 22 : 28,
                  borderRadius: 4, background: p.value, cursor: 'pointer',
                  border: value?.type === 'color' && value.value === p.value
                    ? '2px solid var(--accent)'
                    : '2px solid rgba(255,255,255,0.1)',
                  transition: 'transform 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Gradient ── */}
      {mode === 'gradient' && (
        <div>
          {/* Preset gradient grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 4 : 5, marginBottom: compact ? 8 : 10 }}>
            {GRADIENT_PRESETS.map(g => (
              <div
                key={g.name}
                title={g.name}
                onClick={() => selectGradient(g.value)}
                style={{
                  height: compact ? 32 : 40,
                  borderRadius: 4, background: g.value, cursor: 'pointer',
                  border: value?.type === 'gradient' && value.value === g.value
                    ? '2px solid var(--accent)'
                    : '2px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'flex-end', padding: '0 4px 2px',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', background: 'rgba(0,0,0,0.35)', padding: '1px 3px', borderRadius: 2 }}>
                  {g.name}
                </span>
              </div>
            ))}
          </div>

              {/* Custom gradient builder */}
          {!compact && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Custom Gradient
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <input
                    type="color" value={gradStop1}
                    onChange={e => setGradStop1(e.target.value)}
                    style={{ width: 36, height: 28, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', padding: 0 }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>From</span>
                </div>
                {/* Live preview strip */}
                <div style={{
                  flex: 1, height: 28, borderRadius: 4,
                  background: `linear-gradient(${gradAngle}deg, ${gradStop1} 0%, ${gradStop2} 100%)`,
                  border: '1px solid var(--border)',
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <input
                    type="color" value={gradStop2}
                    onChange={e => setGradStop2(e.target.value)}
                    style={{ width: 36, height: 28, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', padding: 0 }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>To</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', minWidth: 60 }}>
                  Angle: {gradAngle}°
                </span>
                <input
                  type="range" min={0} max={360} value={gradAngle}
                  onChange={e => setGradAngle(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </div>
              <button
                onClick={applyCustomGradient}
                style={{
                  width: '100%', background: 'var(--accent)', border: 'none', color: '#fff',
                  padding: '6px', borderRadius: 4, cursor: 'pointer',
                  fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600,
                }}
              >
                Apply Custom Gradient
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Image ── */}
      {mode === 'image' && (
        <div>
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageFile}
          />
          {value?.type === 'image' && value.value ? (
            <div style={{ marginBottom: compact ? 8 : 10 }}>
              {/* Thumbnail preview */}
              <div style={{
                width: '100%', height: compact ? 60 : 80, borderRadius: 6,
                background: `url(${JSON.stringify(value.value)}) center/cover no-repeat`,
                border: '1px solid var(--border)', marginBottom: 6, position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `rgba(0,0,0,${1 - (value.brightness ?? 0.7)})`,
                }} />
                <span style={{
                  position: 'absolute', bottom: 4, right: 6,
                  fontSize: 9, color: 'rgba(255,255,255,0.7)',
                  background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: 2,
                }}>Current image</span>
              </div>
              {/* Brightness slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', minWidth: 64 }}>
                  Dim: {Math.round((1 - (value.brightness ?? 0.7)) * 100)}%
                </span>
                <input
                  type="range" min={0} max={100}
                  value={Math.round((1 - (value.brightness ?? 0.7)) * 100)}
                  onChange={e => onChange({ ...value, brightness: 1 - Number(e.target.value) / 100 })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => imgInputRef.current?.click()}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', padding: '5px', borderRadius: 4,
                    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >🔄 Change</button>
                <button
                  onClick={() => setCropSrc(value.value)}
                  title="Crop this image"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', padding: '5px', borderRadius: 4,
                    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >✂ Crop</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
                Select an image file to use as the slide background.
              </div>
              <button
                onClick={() => imgInputRef.current?.click()}
                style={{
                  width: '100%', background: 'none', border: '1px dashed var(--border)',
                  color: 'var(--text-muted)', padding: compact ? '8px' : '12px', borderRadius: 6,
                  cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >📁 Select Image File</button>
            </div>
          )}
        </div>
      )}

      {/* Current selection preview strip */}
      <div style={{
        marginTop: compact ? 6 : 10,
        height: 6, borderRadius: 3,
        background: currentCss,
        border: '1px solid rgba(255,255,255,0.1)',
      }} />

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onApply={applyCrop}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

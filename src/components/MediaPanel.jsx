import React, { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { v4 as uuidv4 } from 'uuid';

const PRESET_BACKGROUNDS = [
  { id: 'b1', name: 'Deep Navy', type: 'color', value: '#0a0f1e', category: 'solid' },
  { id: 'b2', name: 'Midnight', type: 'color', value: '#0d1117', category: 'solid' },
  { id: 'b3', name: 'Deep Purple', type: 'color', value: '#0d0a1e', category: 'solid' },
  { id: 'b4', name: 'Forest', type: 'color', value: '#0a1a0f', category: 'solid' },
  { id: 'b5', name: 'Dark Slate', type: 'color', value: '#0f1219', category: 'solid' },
  { id: 'b6', name: 'Black', type: 'color', value: '#000000', category: 'solid' },
  { id: 'b7', name: 'Ocean Blue', type: 'color', value: '#061525', category: 'solid' },
  { id: 'b8', name: 'Deep Maroon', type: 'color', value: '#1a0a0a', category: 'solid' },
  { id: 'g1', name: 'Blue Gradient', type: 'gradient', value: 'linear-gradient(135deg, #0a0f1e 0%, #1a3a6a 100%)', category: 'gradient' },
  { id: 'g2', name: 'Purple Night', type: 'gradient', value: 'linear-gradient(135deg, #0d0a1e 0%, #2a1a4a 100%)', category: 'gradient' },
  { id: 'g3', name: 'Forest Dawn', type: 'gradient', value: 'linear-gradient(135deg, #0a1a0f 0%, #1a3a2a 100%)', category: 'gradient' },
  { id: 'g4', name: 'Golden Hour', type: 'gradient', value: 'linear-gradient(135deg, #1a0f00 0%, #3a2a0a 100%)', category: 'gradient' },
];

const VIDEO_BACKGROUNDS = [
  { id: 'v1', name: 'Worship Loop 1', type: 'video-placeholder', category: 'video', icon: '🌊' },
  { id: 'v2', name: 'Candle Glow', type: 'video-placeholder', category: 'video', icon: '🕯️' },
  { id: 'v3', name: 'Cross Silhouette', type: 'video-placeholder', category: 'video', icon: '✝️' },
  { id: 'v4', name: 'Stars Loop', type: 'video-placeholder', category: 'video', icon: '⭐' },
];

export default function MediaPanel() {
  const { addToSchedule } = useApp();
  const [category, setCategory] = useState('solid');
  const [customColor, setCustomColor] = useState('#0a0f1e');
  const fileInputRef = useRef(null);

  const handleVideoImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    addToSchedule({
      type: 'video',
      title: file.name,
      slides: [{ id: uuidv4(), type: 'video', label: file.name, lines: '' }],
      background: { type: 'video', value: url, name: file.name },
      textColor: '#ffffff',
      fontSize: 44,
      fontFamily: 'Georgia',
    });
    event.target.value = '';
  };

  const applyBackground = (bg) => {
    // Add as a blank slide item
    addToSchedule({
      type: 'announcement',
      title: bg.name || 'Background',
      slides: [{ id: uuidv4(), type: 'blank', label: bg.name || 'Slide', lines: '' }],
      background: bg, textColor: '#ffffff', fontSize: 44, fontFamily: 'Georgia',
    });
  };

  const bgsByCategory = PRESET_BACKGROUNDS.filter(b => b.category === category);

  return (
    <div style={{
      width: 260, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
      }}>
        Media & Backgrounds
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {['solid', 'gradient', 'video'].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} style={{
            flex: 1, padding: '7px 4px', fontSize: 11, cursor: 'pointer',
            background: 'transparent', border: 'none',
            borderBottom: category === cat ? '2px solid var(--accent)' : '2px solid transparent',
            color: category === cat ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'var(--font)', textTransform: 'capitalize', transition: 'all 0.15s',
          }}>{cat === 'solid' ? '🎨 Solid' : cat === 'gradient' ? '🌈 Gradient' : '🎬 Video'}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {category === 'solid' && (
          <>
            {/* Custom color */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Custom Color</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
                  style={{ width: 48, height: 36, borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{customColor}</span>
                <button onClick={() => applyBackground({ type: 'color', value: customColor, name: 'Custom' })} style={{
                  marginLeft: 'auto', background: 'var(--accent)', border: 'none', color: '#fff',
                  padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                }}>Add</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Presets</div>
          </>
        )}

        {(category === 'solid' || category === 'gradient') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {bgsByCategory.map(bg => (
              <div
                key={bg.id}
                onClick={() => applyBackground(bg)}
                style={{
                  height: 60, borderRadius: 'var(--radius)', cursor: 'pointer',
                  background: bg.value, border: '2px solid var(--border)',
                  display: 'flex', alignItems: 'flex-end', padding: 4,
                  transition: 'border-color 0.15s, transform 0.1s',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: 2 }}>
                  {bg.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {category === 'video' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
              Video backgrounds require local video files. Add your own video loops using the button below.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleVideoImport}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {VIDEO_BACKGROUNDS.map(v => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 'var(--radius)',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(79,142,247,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: 22 }}>{v.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>MP4 Loop</div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" style={{
              marginTop: 12, width: '100%', background: 'none', border: '1px dashed var(--border)',
              color: 'var(--text-muted)', padding: '10px', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
            }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              📁 Import Video File
            </button>
          </>
        )}
      </div>

      {/* Blank slide */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <button onClick={() => addToSchedule({
          type: 'blank', title: 'Blank Slide',
          slides: [{ id: uuidv4(), type: 'blank', label: 'Blank', lines: '' }],
          background: { type: 'color', value: '#000' }, textColor: '#fff', fontSize: 44, fontFamily: 'Georgia',
        })} style={{
          width: '100%', background: 'none', border: '1px solid var(--border)',
          color: 'var(--text-muted)', padding: '7px', borderRadius: 'var(--radius)',
          cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >＋ Add Blank Slide</button>
      </div>
    </div>
  );
}

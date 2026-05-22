import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../store/AppContext';
import BackgroundPicker, { bgToCss } from './BackgroundPicker';

const newSlideDraft = () => ({ id: uuidv4(), message: '' });

export default function AnnouncementPanel() {
  const { addToSchedule } = useApp();
  const [title, setTitle] = useState('Announcement');
  const [slideDrafts, setSlideDrafts] = useState([{ id: uuidv4(), message: 'Enter announcement text here…' }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(48);
  const [background, setBackground] = useState({ type: 'color', value: '#0d1117' });
  const [showBgPicker, setShowBgPicker] = useState(false);

  const updateDraft = (idx, message) => {
    setSlideDrafts(prev => prev.map((d, i) => i === idx ? { ...d, message } : d));
  };
  const addDraft = () => {
    setSlideDrafts(prev => {
      const next = [...prev, newSlideDraft()];
      setActiveIdx(next.length - 1);
      return next;
    });
  };
  const removeDraft = (idx) => {
    setSlideDrafts(prev => {
      if (prev.length === 1) return [newSlideDraft()];
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx(Math.min(activeIdx, next.length - 1));
      return next;
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    const slides = slideDrafts
      .map((d, i) => ({
        id: uuidv4(),
        type: 'announcement',
        label: slideDrafts.length === 1 ? title.trim() : `Slide ${i + 1}`,
        lines: d.message.trim(),
      }))
      .filter(s => s.lines);
    if (!slides.length) return;
    addToSchedule({
      type: 'announcement',
      title: title.trim(),
      slides,
      background,
      textColor,
      fontSize,
      fontFamily: 'Georgia',
    });
    // Reset drafts to a single empty slide so the panel is ready for the next one
    setSlideDrafts([newSlideDraft()]);
    setActiveIdx(0);
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px',
    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: 'var(--bg-panel)', color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: 12, boxSizing: 'border-box',
  };

  const active = slideDrafts[activeIdx] || slideDrafts[0];

  return (
    <div style={{
      width: 280, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        Announcements
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            style={inputStyle}
          />
        </div>

        {/* Slide tabs — one chip per draft, click to switch, ✕ to remove */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Slides ({slideDrafts.length})
            </label>
            <button onClick={addDraft} title="Add another slide to this announcement" style={{
              background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)',
              color: 'var(--accent)', borderRadius: 4, padding: '2px 8px',
              cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font)',
            }}>＋ Slide</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {slideDrafts.map((d, i) => (
              <div
                key={d.id}
                onClick={() => setActiveIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 4px 2px 8px', borderRadius: 4,
                  background: i === activeIdx ? 'rgba(79,142,247,0.2)' : 'var(--bg-hover)',
                  border: `1px solid ${i === activeIdx ? 'rgba(79,142,247,0.4)' : 'var(--border)'}`,
                  fontSize: 10, color: i === activeIdx ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                <span>{i + 1}</span>
                {slideDrafts.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); removeDraft(i); }}
                    title="Remove this slide"
                    style={{
                      background: 'none', border: 'none', color: 'inherit',
                      cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '0 2px',
                    }}
                  >✕</button>
                )}
              </div>
            ))}
          </div>
          <textarea
            value={active.message}
            onChange={(e) => updateDraft(activeIdx, e.target.value)}
            placeholder={`Slide ${activeIdx + 1} text…`}
            rows={6}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Background picker — shared across all slides in the announcement */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Background</label>
            <button
              onClick={() => setShowBgPicker(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-muted)', borderRadius: 4, padding: '2px 7px',
                cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 2, background: bgToCss(background), border: '1px solid rgba(255,255,255,0.2)' }} />
              {showBgPicker ? 'Close' : 'Change'}
            </button>
          </div>
          {showBgPicker && (
            <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <BackgroundPicker value={background} onChange={(bg) => { setBackground(bg); }} compact />
            </div>
          )}
        </div>

        {/* Text color */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Text Color</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
              style={{ width: 36, height: 28, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', padding: 0 }} />
            <div style={{ display: 'flex', gap: 3 }}>
              {['#ffffff', '#f5f5f0', '#ffe89a', '#b3d4ff'].map(c => (
                <div key={c} onClick={() => setTextColor(c)} style={{
                  width: 20, height: 20, borderRadius: 3, background: c, cursor: 'pointer',
                  border: textColor === c ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.15)',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Font size */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Font Size: <strong style={{ color: 'var(--text)' }}>{fontSize}px</strong>
          </label>
          <input type="range" min={24} max={80} step={2} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>

        {/* Live mini-preview — shows the active slide */}
        <div style={{
          aspectRatio: '16/9', background: bgToCss(background), borderRadius: 6,
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '8%', textAlign: 'center', overflow: 'hidden',
        }}>
          <div style={{
            fontSize: Math.max(9, fontSize * 0.2), color: textColor, fontFamily: 'Georgia',
            lineHeight: 1.4, whiteSpace: 'pre-line', textShadow: '0 1px 6px rgba(0,0,0,0.8)',
          }}>
            {active.message || `Slide ${activeIdx + 1}`}
          </div>
        </div>

        <button onClick={handleSubmit} style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          padding: '10px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
        }}>
          Add {slideDrafts.length > 1 ? `${slideDrafts.length} slides` : 'to Schedule'}
        </button>
      </div>
    </div>
  );
}

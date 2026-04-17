import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import BackgroundPicker, { bgToCss } from './BackgroundPicker';

export default function AnnouncementPanel() {
  const { addToSchedule } = useApp();
  const [title, setTitle] = useState('Announcement');
  const [message, setMessage] = useState('Enter announcement text here...');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(48);
  const [background, setBackground] = useState({ type: 'color', value: '#0d1117' });
  const [showBgPicker, setShowBgPicker] = useState(false);

  const handleSubmit = () => {
    if (!title.trim() || !message.trim()) return;
    addToSchedule({
      type: 'announcement',
      title: title.trim(),
      slides: [{ id: crypto.randomUUID(), type: 'announcement', label: title.trim(), lines: message.trim() }],
      background,
      textColor,
      fontSize,
      fontFamily: 'Georgia',
    });
    setMessage('');
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px',
    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: 'var(--bg-panel)', color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: 12, boxSizing: 'border-box',
  };

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

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type announcement text here..."
            rows={6}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Background picker */}
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

        {/* Live mini-preview */}
        <div style={{
          aspectRatio: '16/9', background: bgToCss(background), borderRadius: 6,
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '8%', textAlign: 'center', overflow: 'hidden',
        }}>
          <div style={{
            fontSize: Math.max(9, fontSize * 0.2), color: textColor, fontFamily: 'Georgia',
            lineHeight: 1.4, whiteSpace: 'pre-line', textShadow: '0 1px 6px rgba(0,0,0,0.8)',
          }}>
            {message || title}
          </div>
        </div>

        <button onClick={handleSubmit} style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          padding: '10px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
        }}>
          Add to Schedule
        </button>
      </div>
    </div>
  );
}

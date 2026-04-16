import React, { useState } from 'react';
import { useApp } from '../store/AppContext';

export default function AnnouncementPanel() {
  const { addToSchedule } = useApp();
  const [title, setTitle] = useState('Announcement');
  const [message, setMessage] = useState('Enter announcement text here...');

  const handleSubmit = () => {
    if (!title.trim() || !message.trim()) return;
    addToSchedule({
      type: 'announcement',
      title: title.trim(),
      slides: [{ id: crypto.randomUUID(), type: 'announcement', label: title.trim(), lines: message.trim() }],
      background: { type: 'color', value: '#0d1117' },
      textColor: '#ffffff',
      fontSize: 48,
      fontFamily: 'Georgia',
    });
    setMessage('');
  };

  return (
    <div style={{
      width: 260, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        borderBottom: '1px solid var(--border)',
      }}>
        Announcements
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }}
        />

        <label style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type announcement text here..."
          rows={8}
          style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)', resize: 'vertical', fontFamily: 'var(--font)' }}
        />

        <button onClick={handleSubmit} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          Add to Schedule
        </button>
      </div>
    </div>
  );
}

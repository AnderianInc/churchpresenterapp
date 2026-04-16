import React, { useState } from 'react';
import { useApp } from '../store/AppContext';

const typeColors = {
  song: '#4f8ef7', scripture: '#22c55e', video: '#a855f7', announcement: '#f97316', blank: '#8b90a0'
};
const typeIcons = { song: '🎵', scripture: '📖', video: '🎬', announcement: '📢', blank: '⬜' };

export default function SchedulePanel() {
  const {
    schedule, activeScheduleIdx, setActiveScheduleIdx,
    setActiveSlideIdx, removeFromSchedule, clearSchedule, reorderSchedule,
  } = useApp();
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const select = (i) => { setActiveScheduleIdx(i); setActiveSlideIdx(0); };

  const handleDragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, i) => { e.preventDefault(); setDragOverIdx(i); };
  const handleDrop = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const newOrder = [...schedule];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(i, 0, moved);
    reorderSchedule(newOrder);
    setActiveScheduleIdx(i);
    setDragIdx(null); setDragOverIdx(null);
  };

  return (
    <div style={{
      width: 230, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        Service Order
        {schedule.length > 0 && (
          <button onClick={clearSchedule} title="Clear schedule" style={{
            background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
            fontSize: 16, padding: '0 2px', lineHeight: 1,
          }}>🗑</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {schedule.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            Add songs, scripture, or media from the panels on the right
          </div>
        )}
        {schedule.map((item, i) => (
          <div
            key={item.scheduleId}
            draggable
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={e => handleDrop(e, i)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            onClick={() => select(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 'var(--radius)',
              cursor: 'pointer', marginBottom: 2,
              background: i === activeScheduleIdx ? 'var(--bg-selected)' : dragOverIdx === i ? 'var(--bg-hover)' : 'transparent',
              border: i === activeScheduleIdx ? '1px solid rgba(79,142,247,0.3)' : '1px solid transparent',
              transition: 'all 0.12s',
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 6, flexShrink: 0,
              background: `${typeColors[item.type] || '#8b90a0'}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, border: `1px solid ${typeColors[item.type] || '#8b90a0'}44`,
            }}>
              {typeIcons[item.type] || '📄'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {item.author || item.reference || ''} · {item.slides?.length || 0} slides
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); removeFromSchedule(item.scheduleId); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 3, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >✕</button>
          </div>
        ))}
      </div>

      {schedule.length > 0 && (
        <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
          {schedule.length} items · drag to reorder
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useApp } from '../store/AppContext';

const typeColors = {
  song: '#4f8ef7', scripture: '#22c55e', video: '#a855f7', announcement: '#f97316', blank: '#8b90a0'
};
const typeIcons = { song: '🎵', scripture: '📖', video: '🎬', announcement: '📢', blank: '⬜' };

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export default function SchedulePanel() {
  const {
    schedule, settings, activeScheduleIdx, setActiveScheduleIdx,
    setActiveSlideIdx, removeFromSchedule, clearSchedule, reorderSchedule,
    saveServiceOrder, loadServiceOrder, deleteSavedService,
  } = useApp();

  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Saved services panel state
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [confirmLoad, setConfirmLoad] = useState(null); // id of service pending load confirm

  const savedServices = settings?.savedServices || [];

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

  const handleSave = () => {
    if (!schedule.length) return;
    const name = saveName.trim() || `Service ${formatDate(new Date().toISOString())}`;
    saveServiceOrder(name);
    setSaveName('');
  };

  const handleLoad = (svc) => {
    if (schedule.length > 0 && confirmLoad !== svc.id) {
      setConfirmLoad(svc.id);
      return;
    }
    loadServiceOrder(svc);
    setConfirmLoad(null);
    setShowSaved(false);
  };

  return (
    <div style={{
      width: 230, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        Service Order
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => { setShowSaved(s => !s); setConfirmLoad(null); }}
            title={showSaved ? 'Hide saved services' : 'Save / load service orders'}
            style={{
              background: showSaved ? 'rgba(79,142,247,0.15)' : 'none',
              border: showSaved ? '1px solid rgba(79,142,247,0.3)' : 'none',
              color: showSaved ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer', fontSize: 14, padding: '0 3px', lineHeight: 1, borderRadius: 4,
            }}
          >💾</button>
          {schedule.length > 0 && (
            <button onClick={clearSchedule} title="Clear schedule" style={{
              background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
              fontSize: 16, padding: '0 2px', lineHeight: 1,
            }}>🗑</button>
          )}
        </div>
      </div>

      {/* ── Saved Services Panel ── */}
      {showSaved && (
        <div style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(79,142,247,0.04)',
        }}>
          {/* Save current */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Save current order
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder={`e.g. Easter ${new Date().getFullYear()}`}
                style={{
                  flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '4px 7px', fontSize: 11, color: 'var(--text)',
                  fontFamily: 'var(--font)', outline: 'none',
                }}
              />
              <button
                onClick={handleSave}
                disabled={!schedule.length}
                style={{
                  background: schedule.length ? 'var(--accent)' : 'var(--bg-hover)',
                  border: 'none', borderRadius: 4, padding: '4px 10px',
                  color: schedule.length ? '#fff' : 'var(--text-dim)',
                  cursor: schedule.length ? 'pointer' : 'not-allowed',
                  fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
                }}
              >Save</button>
            </div>
            {!schedule.length && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                Add items to the service order first.
              </div>
            )}
          </div>

          {/* Saved list */}
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '6px 6px' }}>
            {savedServices.length === 0 ? (
              <div style={{ padding: '10px 4px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                No saved services yet.
              </div>
            ) : (
              savedServices.map(svc => (
                <div key={svc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 6px', borderRadius: 5, marginBottom: 3,
                  background: confirmLoad === svc.id ? 'rgba(251,191,36,0.08)' : 'var(--bg-hover)',
                  border: `1px solid ${confirmLoad === svc.id ? 'rgba(251,191,36,0.25)' : 'var(--border)'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {svc.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {formatDate(svc.savedAt)} · {svc.items?.length || 0} items
                    </div>
                    {confirmLoad === svc.id && (
                      <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>
                        This will replace current order. Click Load again to confirm.
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleLoad(svc)}
                    title="Load this service order"
                    style={{
                      background: confirmLoad === svc.id ? 'rgba(251,191,36,0.15)' : 'rgba(79,142,247,0.1)',
                      border: `1px solid ${confirmLoad === svc.id ? 'rgba(251,191,36,0.3)' : 'rgba(79,142,247,0.25)'}`,
                      color: confirmLoad === svc.id ? '#fbbf24' : 'var(--accent)',
                      borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                      fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
                    }}
                  >{confirmLoad === svc.id ? 'Confirm' : 'Load'}</button>
                  <button
                    onClick={() => { deleteSavedService(svc.id); if (confirmLoad === svc.id) setConfirmLoad(null); }}
                    title="Delete saved service"
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--text-dim)',
                      cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Schedule items ── */}
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

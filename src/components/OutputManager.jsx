import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import BackgroundPicker, { bgToCss } from './BackgroundPicker';
import { v4 as uuidv4 } from 'uuid';

const ROLE_LABELS = {
  presentation: 'Program',
  stage: 'Stage',
  announcement: 'Announcement',
  background: 'Background',
  confidence: 'Confidence',
  timer: 'Timer',
  stream: 'Stream',
};

const ROLE_COLORS = {
  presentation: '#4f8ef7',
  stage: '#a855f7',
  announcement: '#f59e0b',
  background: '#10b981',
  confidence: '#ef4444',
  timer: '#06b6d4',
  stream: '#ec4899',
};

function resolveOutputSlide(output, ctx) {
  const { liveOutputs, liveRoleSlides, liveProgram, liveStage, stageMirrorProgram } = ctx;
  if (liveOutputs[output.id]) return liveOutputs[output.id];
  if (liveRoleSlides[output.role]) return liveRoleSlides[output.role];
  if (output.role === 'stage') {
    return stageMirrorProgram ? liveProgram : (liveStage || liveProgram);
  }
  return liveProgram;
}

// Compact row — no mirrored video preview (that's what bloats screen usage);
// the console itself shows LIVE state via the toolbar's Go Live/End Live button.
function OutputCard({ output, ctx, onSendCurrent, onSyncProgram, onClose, onDelete, onReopen, onRename, displayLabel }) {
  const { liveOutputs, liveRoleSlides, liveProgram } = ctx;
  const isOpen = output.isOpen !== false;
  const isTimerRole = output.role === 'timer';
  const slide = isTimerRole ? null : resolveOutputSlide(output, ctx);
  const isLive = isOpen && (isTimerRole || !!(liveOutputs[output.id] || liveRoleSlides[output.role] || liveProgram));
  const roleColor = ROLE_COLORS[output.role] || '#4f8ef7';

  // Inline-editable, user-facing name
  const [name, setName] = useState(output.title || '');
  useEffect(() => { setName(output.title || ''); }, [output.title]);
  const commitName = () => { const t = name.trim(); if (t && t !== output.title) onRename?.(output.id, t); else setName(output.title || ''); };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${isLive ? roleColor + '55' : 'var(--border)'}`,
      borderRadius: 8, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isOpen ? (
          isLive && <span title="Live" style={{ width: 7, height: 7, borderRadius: '50%', background: roleColor, flexShrink: 0 }} />
        ) : (
          <span title="Closed — reopen to use" style={{ width: 7, height: 7, borderRadius: '50%', border: '1px solid var(--text-dim)', flexShrink: 0 }} />
        )}
        {/* Editable name */}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(output.title || ''); e.currentTarget.blur(); } }}
          title="Rename this output"
          style={{
            flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'transparent',
            border: '1px solid transparent', borderRadius: 4, color: isOpen ? 'var(--text)' : 'var(--text-dim)',
            fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)', padding: '3px 5px', outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = roleColor; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseEnter={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--border)'; }}
          onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'transparent'; }}
        />
        {isOpen ? (
          <button onClick={() => onClose(output.id)} title="Close window (keeps this output saved)" style={{
            background: 'transparent', border: 'none', color: 'var(--text-dim)',
            width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
            fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent'; }}
          >⏻</button>
        ) : (
          <button onClick={() => onReopen(output.id)} title="Reopen this output's window" style={{
            background: roleColor + '22', border: `1px solid ${roleColor}44`, color: roleColor,
            borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
            fontSize: 10, flexShrink: 0, fontFamily: 'var(--font)',
          }}
          >▶ Open</button>
        )}
        <button onClick={() => onDelete(output.id)} title="Delete this output permanently" style={{
          background: 'transparent', border: 'none', color: 'var(--text-dim)',
          width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
          fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent'; }}
        >✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px',
          background: roleColor + '22', color: roleColor,
          borderRadius: 4, letterSpacing: '0.4px',
        }}>{ROLE_LABELS[output.role] || output.role}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {isOpen ? (displayLabel || `Display ${output.displayIdx}`) : 'Closed'}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isTimerRole ? 'Timers & announcements' : (slide?.lines?.split('\n')[0] || 'No slide')}
      </div>

      {/* Action buttons */}
      {isOpen && (
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onSendCurrent(output.id)} style={{
          flex: 1, background: '#4f8ef722', border: '1px solid #4f8ef744',
          color: '#4f8ef7', borderRadius: 5, padding: '4px 0',
          fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#4f8ef733'}
          onMouseLeave={e => e.currentTarget.style.background = '#4f8ef722'}
        >▶ Send Preview</button>
        <button onClick={() => onSyncProgram(output.id)} style={{
          flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', borderRadius: 5, padding: '4px 0',
          fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        >⟳ Sync Program</button>
      </div>
      )}
    </div>
  );
}

function DisplayLabelsSection({ displays, displayLabels, onUpdateLabel }) {
  const [editing, setEditing] = useState({});

  if (displays.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
        Display Labels
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {displays.map(d => (
          <div key={d.index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{d.isPrimary ? '🖥️' : '📺'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>Display {d.index}</span>
            <input
              value={editing[d.index] !== undefined ? editing[d.index] : (displayLabels?.[d.index] || '')}
              placeholder={d.label || `Display ${d.index}`}
              onChange={e => setEditing(prev => ({ ...prev, [d.index]: e.target.value }))}
              onBlur={e => {
                const val = e.target.value.trim();
                onUpdateLabel(d.index, val || null);
                setEditing(prev => { const n = { ...prev }; delete n[d.index]; return n; });
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') {
                  setEditing(prev => { const n = { ...prev }; delete n[d.index]; return n; });
                  e.target.blur();
                }
              }}
              style={{
                flex: 1, background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5, color: '#fff', padding: '5px 8px', fontSize: 11,
                fontFamily: 'var(--font)', outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#4f8ef7'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutingPresetsSection({ presets, outputWindows, onSave, onLoad, onDelete }) {
  const [newName, setNewName] = useState('');

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
        Routing Presets
      </div>

      {presets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {presets.map(preset => (
            <div key={preset.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.03)', borderRadius: 6,
              padding: '6px 8px', border: '1px solid var(--border)',
            }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{preset.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{preset.outputs.length} outputs</span>
              <button onClick={() => onLoad(preset)} style={{
                background: '#4f8ef722', border: '1px solid #4f8ef744', color: '#4f8ef7',
                borderRadius: 4, padding: '3px 8px', fontSize: 10, cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}>Load</button>
              <button onClick={() => onDelete(preset.id)} style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                borderRadius: 4, padding: '3px 6px', fontSize: 11, cursor: 'pointer',
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {presets.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
          No presets saved yet.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={newName}
          placeholder={outputWindows.length ? `Save current (${outputWindows.length} outputs)…` : 'No outputs open'}
          onChange={e => setNewName(e.target.value)}
          disabled={outputWindows.length === 0}
          onKeyDown={e => {
            if (e.key === 'Enter' && newName.trim() && outputWindows.length > 0) {
              onSave(newName.trim()); setNewName('');
            }
          }}
          style={{
            flex: 1, background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, color: '#fff', padding: '5px 8px', fontSize: 11,
            fontFamily: 'var(--font)', outline: 'none',
            opacity: outputWindows.length === 0 ? 0.4 : 1,
          }}
          onFocus={e => e.currentTarget.style.borderColor = '#4f8ef7'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
        <button
          onClick={() => { if (newName.trim() && outputWindows.length > 0) { onSave(newName.trim()); setNewName(''); } }}
          disabled={!newName.trim() || outputWindows.length === 0}
          style={{
            background: '#4f8ef7', border: 'none', color: '#fff',
            borderRadius: 5, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font)', opacity: (!newName.trim() || outputWindows.length === 0) ? 0.4 : 1,
          }}
        >Save</button>
      </div>
    </div>
  );
}

function CreateOutputSection({ displays, onCreateOutput }) {
  const roles = [
    { key: 'presentation', label: 'Program / Audience' },
    { key: 'stage', label: 'Stage Monitor' },
    { key: 'announcement', label: 'Announcements' },
    { key: 'background', label: 'Background Screen' },
    { key: 'confidence', label: 'Confidence Monitor' },
    { key: 'timer', label: 'Timer + Announcement' },
  ];
  const [selectedRole, setSelectedRole] = useState('presentation');
  const [selectedDisplay, setSelectedDisplay] = useState(displays.find(d => !d.isPrimary)?.index ?? 1);
  const [name, setName] = useState('');

  const roleLabel = roles.find(r => r.key === selectedRole)?.label || selectedRole;
  const create = () => {
    onCreateOutput(selectedRole, selectedDisplay, name.trim());
    setName('');
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
        Add Output Window
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') create(); }}
          placeholder={`Name (optional) — e.g. "${roleLabel}"`}
          style={{
            width: '100%', boxSizing: 'border-box', background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, color: '#fff', padding: '6px 8px', fontSize: 11, fontFamily: 'var(--font)', outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = '#4f8ef7'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} style={{
            flex: 1, minWidth: 130, background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, color: '#fff', padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font)',
          }}>
            {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {displays.length > 1 && (
            <select value={selectedDisplay} onChange={e => setSelectedDisplay(Number(e.target.value))} style={{
              flex: 1, minWidth: 100, background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 5, color: '#fff', padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font)',
            }}>
              {displays.map(d => <option key={d.index} value={d.index}>{d.label}</option>)}
            </select>
          )}
          <button onClick={create} style={{
            background: '#4f8ef7', border: 'none', color: '#fff',
            borderRadius: 5, padding: '5px 14px', fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font)', fontWeight: 600,
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >＋ Open</button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          The <strong>role</strong> sets how the screen behaves; the <strong>name</strong> is just your label — rename any output later on its card.
        </div>
      </div>
    </div>
  );
}

// ── Background color broadcast (pushes a solid/gradient to all background-role outputs) ──
function BackgroundBroadcastSection({ onPush }) {
  const [bg, setBg] = useState({ type: 'color', value: '#0a0f1e' });
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: expanded ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${expanded ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
          borderRadius: 7, padding: '8px 10px', cursor: 'pointer',
          marginBottom: expanded ? 8 : 0,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 3, background: bgToCss(bg), border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>
          Push Background Color
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '10px 10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 7px 7px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
            Push a solid color or gradient to all <strong style={{ color: '#10b981' }}>Background</strong> role outputs — no slide content needed.
          </div>
          <BackgroundPicker value={bg} onChange={setBg} compact />
          <button
            onClick={() => onPush(bg)}
            style={{
              marginTop: 10, width: '100%', background: '#10b981', border: 'none', color: '#fff',
              padding: '7px', borderRadius: 5, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Push to Background Outputs
          </button>
        </div>
      )}
    </div>
  );
}

export default function OutputManager() {
  const {
    outputWindows, displays, liveOutputs, liveRoleSlides,
    liveProgram, liveStage, stageMirrorProgram,
    currentSlide, currentItem, settings,
    goLiveOutput, closeOutputWindow, closeOutputWindowOnly, reopenOutputWindow, createOutputWindow, renameOutputWindow,
    updateDisplayLabel, saveRoutingPreset, loadRoutingPreset, deleteRoutingPreset,
  } = useApp();

  const ctx = { liveOutputs, liveRoleSlides, liveProgram, liveStage, stageMirrorProgram };
  const displayLabels = settings.displayLabels || {};
  const routingPresets = settings.routingPresets || [];

  const handleSendCurrent = (outputId) => {
    if (!currentSlide || !currentItem) return;
    goLiveOutput(outputId, { ...currentSlide, item: currentItem });
  };

  const handleSyncProgram = (outputId) => {
    if (!liveProgram) return;
    goLiveOutput(outputId, liveProgram);
  };

  const handleCreateOutput = (role, displayIdx, name) => {
    createOutputWindow({ role, displayIdx, title: (name && name.trim()) || ROLE_LABELS[role] || role });
  };

  const handleLoadPreset = async (preset) => {
    await loadRoutingPreset(preset);
  };

  const handleDeleteOutput = (outputId) => {
    const output = outputWindows.find(w => w.id === outputId);
    const name = output?.title || output?.role || 'this output';
    if (!window.confirm(`Delete "${name}" permanently? This removes it from Output Manager — it won't be reusable unless you create it again.`)) return;
    closeOutputWindow(outputId);
  };

  const handlePushBackground = (bg) => {
    // Build a blank slide carrying the chosen background and push it to every background-role output
    const blankSlide = {
      id: uuidv4(), type: 'blank', label: 'Background', lines: '',
      item: { type: 'background', title: 'Background', background: bg, textColor: '#fff', fontSize: 44, fontFamily: 'Georgia' },
    };
    blankSlide.item = { ...blankSlide.item };
    // Push to every open background-role output
    outputWindows.filter(w => w.role === 'background').forEach(w => goLiveOutput(w.id, blankSlide));
    // Also push to the background role slot (covers future windows)
    goLiveOutput('background', blankSlide);
  };

  return (
    <div style={{
      width: 320, background: 'var(--bg-sidebar)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Output Manager</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          {outputWindows.length === 0
            ? 'Add outputs below, then Go Live sends to all of them'
            : `${outputWindows.length} output${outputWindows.length !== 1 ? 's' : ''} active — Go Live sends to all`}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {/* Output cards */}
        {outputWindows.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
              Active Outputs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outputWindows.map(output => (
                <OutputCard
                  key={output.id}
                  output={output}
                  ctx={ctx}
                  displayLabel={displayLabels[output.displayIdx]}
                  onSendCurrent={handleSendCurrent}
                  onSyncProgram={handleSyncProgram}
                  onClose={closeOutputWindowOnly}
                  onDelete={handleDeleteOutput}
                  onReopen={reopenOutputWindow}
                  onRename={renameOutputWindow}
                />
              ))}
            </div>
          </div>
        )}

        {outputWindows.length === 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed var(--border)',
            borderRadius: 8, padding: 20,
            textAlign: 'center', color: 'var(--text-dim)',
            fontSize: 12, marginBottom: 16,
          }}>
            No output windows open.<br />Create one below to get started.
          </div>
        )}

        <CreateOutputSection displays={displays} onCreateOutput={handleCreateOutput} />

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 16 }} />

        <RoutingPresetsSection
          presets={routingPresets}
          outputWindows={outputWindows}
          onSave={saveRoutingPreset}
          onLoad={handleLoadPreset}
          onDelete={deleteRoutingPreset}
        />

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 16 }} />

        <DisplayLabelsSection
          displays={displays}
          displayLabels={displayLabels}
          onUpdateLabel={updateDisplayLabel}
        />

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, marginBottom: 16 }} />

        <BackgroundBroadcastSection onPush={handlePushBackground} />
      </div>
    </div>
  );
}

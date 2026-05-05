import React, { useState, useEffect, useCallback } from 'react';

const LEVEL_COLOR = {
  error: { fg: '#f87171', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)' },
  warn:  { fg: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
  info:  { fg: 'rgba(255,255,255,0.5)', bg: 'transparent', border: 'transparent' },
};

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function LevelBadge({ level }) {
  const c = LEVEL_COLOR[level] || LEVEL_COLOR.info;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
      textTransform: 'uppercase', color: c.fg,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 3, padding: '1px 5px', flexShrink: 0,
    }}>
      {level}
    </span>
  );
}

function LogRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const c = LEVEL_COLOR[entry.level] || LEVEL_COLOR.info;
  return (
    <div
      onClick={() => entry.detail && setExpanded(v => !v)}
      style={{
        padding: '5px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: entry.detail ? 'pointer' : 'default',
        background: expanded ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 1, fontFamily: 'monospace' }}>
          {fmt(entry.ts)}
        </span>
        <LevelBadge level={entry.level} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: 1, fontFamily: 'monospace' }}>
          {entry.source}
        </span>
        <span style={{ fontSize: 11, color: c.fg, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {entry.message}
        </span>
        {entry.detail && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      {expanded && entry.detail && (
        <pre style={{
          margin: '6px 0 2px 0', padding: '6px 8px',
          background: 'rgba(0,0,0,0.35)', borderRadius: 4,
          fontSize: 10, color: 'rgba(255,255,255,0.55)',
          fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 200, overflow: 'auto',
        }}>
          {entry.detail}
        </pre>
      )}
    </div>
  );
}

export default function LogsTab() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter]   = useState('all'); // all | error | warn | info
  const [logPath, setLogPath] = useState('');
  const isElectron = !!window.electronAPI;

  const refresh = useCallback(async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.getLogEntries();
    setEntries(rows || []);
  }, [isElectron]);

  useEffect(() => {
    refresh();
    if (isElectron) {
      window.electronAPI.getLogPath().then(setLogPath).catch(() => {});
    }
  }, [refresh, isElectron]);

  const visible = filter === 'all' ? entries : entries.filter(e => e.level === filter);
  const counts  = {
    error: entries.filter(e => e.level === 'error').length,
    warn:  entries.filter(e => e.level === 'warn').length,
  };

  const copyAll = () => {
    const text = visible.map(e =>
      `[${new Date(e.ts).toISOString()}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}${e.detail ? '\n' + e.detail : ''}`
    ).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const clearLog = async () => {
    if (!isElectron) return;
    await window.electronAPI.clearLog();
    setEntries([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, padding: 14, boxSizing: 'border-box' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {['all', 'error', 'warn', 'info'].map(f => {
          const active = filter === f;
          const badge  = f === 'error' ? counts.error : f === 'warn' ? counts.warn : null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: active ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(79,142,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#4f8ef7' : 'rgba(255,255,255,0.6)',
                borderRadius: 5, padding: '3px 10px', fontSize: 11,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {badge > 0 && (
                <span style={{
                  background: f === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.2)',
                  color: f === 'error' ? '#f87171' : '#fbbf24',
                  borderRadius: 8, padding: '0 5px', fontSize: 9, fontWeight: 700,
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button onClick={refresh} style={actionBtn}>↻ Refresh</button>
        <button onClick={copyAll} style={actionBtn}>Copy</button>
        {isElectron && (
          <button onClick={() => window.electronAPI.openLogFolder()} style={actionBtn}>Open Folder</button>
        )}
        <button onClick={clearLog} style={{ ...actionBtn, color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>Clear</button>
      </div>

      {/* Log path */}
      {logPath && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {logPath}
        </div>
      )}

      {/* Entries */}
      <div style={{
        flex: 1, overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 6, background: 'rgba(0,0,0,0.2)',
        minHeight: 0,
      }}>
        {visible.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            {isElectron ? 'No log entries.' : 'Log viewer requires the desktop app.'}
          </div>
        ) : (
          [...visible].reverse().map((e, i) => <LogRow key={i} entry={e} />)
        )}
      </div>
    </div>
  );
}

const actionBtn = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.6)',
  borderRadius: 5, padding: '3px 9px', fontSize: 11, cursor: 'pointer',
};

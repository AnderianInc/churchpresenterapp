import React, { useState, useEffect, useRef, useCallback } from 'react';
import { perfMonitor } from '../utils/perfMonitor';

/**
 * Toggleable performance debug overlay.
 *
 * - Keyboard shortcut: F9 (works in every window)
 * - Updates every POLL_MS (default 500 ms) to stay readable without flooding renders
 * - Shows: FPS, JS-heap MB, slide IPC latency, main-process RSS, session uptime
 * - Draggable: click-and-drag the header bar to reposition
 * - Zero overhead when hidden (rAF loop is started separately by perfMonitor.start())
 *
 * Mount once per window in App.jsx:
 *   import PerfOverlay from './components/PerfOverlay';
 *   // inside JSX:
 *   <PerfOverlay />
 */

const POLL_MS = 500;

const COLORS = {
  good:    '#4ade80',
  warn:    '#facc15',
  bad:     '#f87171',
  muted:   'rgba(255,255,255,0.45)',
  label:   'rgba(255,255,255,0.6)',
  bg:      'rgba(0,0,0,0.82)',
  border:  'rgba(255,255,255,0.12)',
  header:  'rgba(255,255,255,0.07)',
};

function fpsColor(fps) {
  if (fps >= 55) return COLORS.good;
  if (fps >= 30) return COLORS.warn;
  return COLORS.bad;
}

function latencyColor(ms) {
  if (ms == null) return COLORS.muted;
  if (ms < 50)  return COLORS.good;
  if (ms < 150) return COLORS.warn;
  return COLORS.bad;
}

function heapColor(mb) {
  if (mb == null) return COLORS.muted;
  if (mb < 200) return COLORS.good;
  if (mb < 400) return COLORS.warn;
  return COLORS.bad;
}

function rssColor(mb) {
  if (mb == null) return COLORS.muted;
  if (mb < 300) return COLORS.good;
  if (mb < 600) return COLORS.warn;
  return COLORS.bad;
}

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function Row({ label, value, color, unit = '' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
      <span style={{ color: COLORS.label, fontSize: 10, fontFamily: 'monospace' }}>{label}</span>
      <span style={{ color: color || COLORS.muted, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
        {value != null ? `${value}${unit}` : '—'}
      </span>
    </div>
  );
}

export default function PerfOverlay() {
  const [visible,  setVisible]  = useState(false);
  const [metrics,  setMetrics]  = useState(null);
  const [pos,      setPos]      = useState({ x: 12, y: 12 });
  const dragRef    = useRef(null);
  const intervalRef = useRef(null);

  // F9 toggle
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F9') setVisible(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Poll metrics when visible
  useEffect(() => {
    if (!visible) {
      clearInterval(intervalRef.current);
      return;
    }

    async function poll() {
      const renderer = perfMonitor.getSnapshot();
      const main     = await perfMonitor.getMainSnapshot();
      setMetrics({ ...renderer, main });
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [visible]);

  // Drag logic
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    dragRef.current = { startX, startY };

    const onMove = (me) => {
      setPos({
        x: Math.max(0, me.clientX - dragRef.current.startX),
        y: Math.max(0, me.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [pos]);

  if (!visible) return null;

  const { fps, heapMb, latencyMs, sessionSec, main } = metrics || {};

  return (
    <div
      style={{
        position:      'fixed',
        left:          pos.x,
        top:           pos.y,
        zIndex:        99999,
        width:         192,
        background:    COLORS.bg,
        border:        `1px solid ${COLORS.border}`,
        borderRadius:  6,
        backdropFilter:'blur(8px)',
        boxShadow:     '0 4px 20px rgba(0,0,0,0.6)',
        userSelect:    'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Header / drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          background:    COLORS.header,
          borderBottom:  `1px solid ${COLORS.border}`,
          borderRadius:  '6px 6px 0 0',
          padding:       '5px 10px',
          cursor:        'move',
          display:       'flex',
          justifyContent:'space-between',
          alignItems:    'center',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
          PERF  F9
        </span>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: 'none', border: 'none', color: COLORS.muted,
            cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
          }}
        >✕</button>
      </div>

      {/* Metrics */}
      <div style={{ padding: '6px 10px 8px' }}>
        <div style={{ color: COLORS.label, fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 4 }}>
          RENDERER
        </div>
        <Row label="FPS"      value={fps}       color={fpsColor(fps)}         unit=" fps" />
        <Row label="Heap"     value={heapMb}    color={heapColor(heapMb)}     unit=" MB"  />
        <Row label="Latency"  value={latencyMs} color={latencyColor(latencyMs)} unit=" ms" />
        <Row label="Uptime"   value={sessionSec != null ? formatUptime(sessionSec) : null} />

        {main && (
          <>
            <div style={{ color: COLORS.label, fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em', marginTop: 8, marginBottom: 4 }}>
              MAIN PROCESS
            </div>
            <Row label="RSS"      value={main.rssMb}          color={rssColor(main.rssMb)}   unit=" MB" />
            <Row label="Heap"     value={main.heapUsedMb}     color={heapColor(main.heapUsedMb)} unit=" MB" />
            <Row label="CPU"      value={main.mainCpuPercent} color={main.mainCpuPercent > 50 ? COLORS.bad : main.mainCpuPercent > 20 ? COLORS.warn : COLORS.good} unit="%" />
            <Row label="Slides"   value={main.slideChanges} />
            <Row label="Startup"  value={main.startupMs}    unit=" ms" />
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import {
  TIMER_TYPES,
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  getElapsedMs,
  getRemainingMs,
  getCountdownMs,
  formatMs,
  formatClock,
} from '../utils/timerEngine';

// ── Broadcast helpers ─────────────────────────────────────────────────────────

function broadcastTimers(timers) {
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.postMessage({ type: 'timer-state', payload: timers });
    ch.close();
  }
  window.electronAPI?.sendTimerState?.(timers);
}

function broadcastAnnouncement(text) {
  const payload = { text, sentAt: Date.now() };
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.postMessage({ type: 'stage-announcement', payload });
    ch.close();
  }
  window.electronAPI?.sendStageAnnouncement?.(payload);
}

// ── TimerPanel ────────────────────────────────────────────────────────────────

export default function TimerPanel() {
  const [timers, setTimers]               = useState([]);
  const [newName, setNewName]             = useState('');
  const [newType, setNewType]             = useState(TIMER_TYPES.COUNTDOWN);
  const [newMins, setNewMins]             = useState(5);
  const [newSecs, setNewSecs]             = useState(0);
  const [announcement, setAnnouncement]   = useState('');
  const [lastSent, setLastSent]           = useState('');
  const [clock, setClock]                 = useState(formatClock());
  const [, forceUpdate]                   = useState(0);

  // Tick every 500 ms: update clock and rerender timers. Countdowns are NOT
  // auto-stopped at zero — they keep running and count up into negative overtime
  // until the operator pauses or resets them. Receiving windows run their own
  // tick, so no per-frame broadcast is needed here.
  useEffect(() => {
    const id = setInterval(() => {
      setClock(formatClock());
      forceUpdate(n => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Broadcast whenever timers array reference changes
  useEffect(() => { broadcastTimers(timers); }, [timers]);

  // Respond to newly-opened Timer / Confidence windows asking for current state,
  // so they populate immediately instead of waiting for the next change.
  const timersRef = useRef(timers);
  const lastSentRef = useRef(lastSent);
  useEffect(() => { timersRef.current = timers; }, [timers]);
  useEffect(() => { lastSentRef.current = lastSent; }, [lastSent]);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    ch.onmessage = (e) => {
      if (e.data?.type !== 'timer-state-request') return;
      broadcastTimers(timersRef.current);
      if (lastSentRef.current) broadcastAnnouncement(lastSentRef.current);
    };
    return () => ch.close();
  }, []);

  const mutateTimer = useCallback((id, fn) => {
    setTimers(prev => prev.map(t => t.id === id ? fn(t) : t));
  }, []);

  const addTimer = useCallback(() => {
    const name = newName.trim() || { [TIMER_TYPES.COUNTDOWN]: 'Timer', [TIMER_TYPES.STOPWATCH]: 'Stopwatch', [TIMER_TYPES.CLOCK]: 'Clock' }[newType];
    const durationSecs = newType === TIMER_TYPES.COUNTDOWN ? newMins * 60 + newSecs : 0;
    const timer = createTimer(name, newType, Math.max(1, durationSecs));
    setTimers(prev => [...prev, timer]);
    setNewName('');
  }, [newName, newType, newMins, newSecs]);

  const removeTimer = useCallback((id) => setTimers(prev => prev.filter(t => t.id !== id)), []);

  const sendAnnouncement = useCallback(() => {
    const text = announcement.trim();
    if (!text) return;
    broadcastAnnouncement(text);
    setLastSent(text);
    setAnnouncement('');
  }, [announcement]);

  const clearAnnouncement = useCallback(() => {
    broadcastAnnouncement('');
    setLastSent('');
  }, []);

  const now = Date.now();

  // ── Shared style tokens ──────────────────────────────────────────────────────
  const sectionHead = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
    textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8,
  };
  const input = {
    background: 'var(--bg-hover)', border: '1px solid var(--border)',
    borderRadius: 5, color: 'var(--text)', fontFamily: 'var(--font)',
    fontSize: 12, padding: '5px 8px', outline: 'none', boxSizing: 'border-box',
  };
  const primaryBtn = (bg = 'var(--accent)') => ({
    background: bg, border: 'none', borderRadius: 5, color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, padding: '5px 12px',
  });
  const ghostBtn = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
    borderRadius: 5, color: 'var(--text-dim)', cursor: 'pointer',
    fontFamily: 'var(--font)', fontSize: 11, padding: '4px 8px',
  };
  const typeBtn = (active) => ({
    ...ghostBtn, flex: 1,
    background: active ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.06)',
    border:     active ? '1px solid rgba(79,142,247,0.5)' : '1px solid var(--border)',
    color:      active ? '#4f8ef7' : 'var(--text-dim)',
    textTransform: 'capitalize',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--font)' }}>

      {/* ── Current time readout ─────────────────────────────────────── */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Current Time</span>
        <span style={{ fontSize: 20, fontFamily: 'Georgia', color: 'var(--text)', letterSpacing: '0.05em' }}>{clock}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Add timer form ───────────────────────────────────────────── */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionHead}>Add Timer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              style={{ ...input, width: '100%' }}
              placeholder="Timer name (optional)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTimer()}
            />

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 5 }}>
              {[TIMER_TYPES.COUNTDOWN, TIMER_TYPES.STOPWATCH, TIMER_TYPES.CLOCK].map(type => (
                <button key={type} onClick={() => setNewType(type)} style={typeBtn(newType === type)}>
                  {type}
                </button>
              ))}
            </div>

            {/* Duration inputs for countdown */}
            {newType === TIMER_TYPES.COUNTDOWN && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="number" min={0} max={99} value={newMins}
                  onChange={e => setNewMins(Math.max(0, Number(e.target.value)))}
                  style={{ ...input, width: 52, textAlign: 'center' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>min</span>
                <input
                  type="number" min={0} max={59} value={newSecs}
                  onChange={e => setNewSecs(Math.max(0, Math.min(59, Number(e.target.value))))}
                  style={{ ...input, width: 52, textAlign: 'center' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>sec</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
                  = {formatMs((newMins * 60 + newSecs) * 1000)}
                </span>
              </div>
            )}

            <button onClick={addTimer} style={{ ...primaryBtn(), alignSelf: 'flex-end', paddingLeft: 18, paddingRight: 18 }}>
              + Add
            </button>
          </div>
        </div>

        {/* ── Active timers ────────────────────────────────────────────── */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionHead}>
            Timers {timers.length > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }}>({timers.length})</span>}
          </div>

          {timers.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: '14px 0' }}>
              No timers yet — add one above
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {timers.map(timer => {
              const elapsed   = getElapsedMs(timer, now);
              const remaining = getRemainingMs(timer, now);
              const countdown = getCountdownMs(timer, now); // signed — negative in overtime
              const overtime  = timer.type === TIMER_TYPES.COUNTDOWN && countdown < 0 && elapsed > 0;
              const expired   = overtime || (timer.type === TIMER_TYPES.COUNTDOWN && remaining <= 0 && elapsed > 0);
              const nearEnd   = !expired && timer.type === TIMER_TYPES.COUNTDOWN && timer.durationMs > 0 && (remaining / timer.durationMs) < 0.2;
              const pct       = timer.type === TIMER_TYPES.COUNTDOWN && timer.durationMs > 0
                ? Math.max(0, remaining / timer.durationMs) : null;

              const displayTime = timer.type === TIMER_TYPES.CLOCK     ? clock
                : timer.type === TIMER_TYPES.COUNTDOWN ? (overtime ? '-' : '') + formatMs(countdown)
                : formatMs(elapsed);

              const timeColor = expired ? '#ef4444' : nearEnd ? '#fbbf24' : 'var(--text)';

              return (
                <div key={timer.id} style={{
                  background: 'var(--bg-hover)',
                  border: `1px solid ${expired ? 'rgba(239,68,68,0.4)' : nearEnd ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                  borderRadius: 7, padding: '8px 10px',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {timer.name}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {timer.type}
                    </span>
                    <button
                      onClick={() => removeTimer(timer.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, padding: 0 }}
                    >✕</button>
                  </div>

                  {/* Time display */}
                  <div style={{
                    fontSize: 28, fontFamily: 'Georgia', letterSpacing: '0.05em',
                    textAlign: 'center', color: timeColor, lineHeight: 1,
                    textShadow: expired ? '0 0 16px rgba(239,68,68,0.5)' : nearEnd ? '0 0 16px rgba(251,191,36,0.35)' : 'none',
                    marginBottom: pct !== null ? 5 : 4,
                  }}>
                    {displayTime}
                  </div>

                  {/* Progress bar (countdown only) */}
                  {pct !== null && (
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct * 100}%`,
                        background: expired ? '#ef4444' : nearEnd ? '#fbbf24' : '#4f8ef7',
                        borderRadius: 2, transition: 'width 0.5s linear',
                      }} />
                    </div>
                  )}

                  {/* Controls */}
                  {timer.type === TIMER_TYPES.CLOCK ? (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>Live clock — always shown</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {!timer.running && !timer.finished && (
                        <button onClick={() => mutateTimer(timer.id, t => startTimer(t))} style={{ ...primaryBtn('#16a34a'), flex: 1, padding: '4px 0' }}>
                          ▶ Start
                        </button>
                      )}
                      {timer.running && (
                        <button onClick={() => mutateTimer(timer.id, t => pauseTimer(t))} style={{ ...ghostBtn, flex: 1, padding: '4px 0' }}>
                          ⏸ Pause
                        </button>
                      )}
                      {timer.finished && (
                        <button onClick={() => mutateTimer(timer.id, t => startTimer(resetTimer(t)))} style={{ ...primaryBtn('#16a34a'), flex: 1, padding: '4px 0' }}>
                          ↺ Restart
                        </button>
                      )}
                      <button onClick={() => mutateTimer(timer.id, t => resetTimer(t))} style={{ ...ghostBtn, padding: '4px 9px' }} title="Reset">
                        ↺
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Stage announcement ───────────────────────────────────────── */}
        <div style={{ padding: '10px 14px' }}>
          <div style={sectionHead}>Stage Announcement</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            Shown on the confidence monitor only — not visible to the audience.
          </div>
          <textarea
            style={{ ...input, width: '100%', resize: 'vertical', minHeight: 60 }}
            placeholder="Type a message for stage crew…"
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendAnnouncement(); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, gap: 8 }}>
            {lastSent
              ? (
                <button onClick={clearAnnouncement} style={{ ...ghostBtn, fontSize: 10, padding: '3px 8px' }}>
                  ✕ Clear
                </button>
              )
              : <span />
            }
            <button onClick={sendAnnouncement} style={{ ...primaryBtn(), padding: '5px 16px' }}>
              Send to Stage
            </button>
          </div>
          {lastSent && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#22c55e' }}>
              ✓ Showing: "{lastSent.length > 48 ? lastSent.slice(0, 48) + '…' : lastSent}"
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

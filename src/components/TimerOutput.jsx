import React, { useState, useEffect } from 'react';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import {
  TIMER_TYPES,
  getElapsedMs,
  getRemainingMs,
  getCountdownMs,
  isExpired,
  formatMs,
  formatClock,
} from '../utils/timerEngine';

/**
 * Full-screen Timer output — shows the wall clock, active countdown / stopwatch
 * timers (large), and the current stage announcement. Dedicated to timers and
 * announcements only (no slide content), e.g. a monitor facing speakers.
 *
 * Subscribes to the same `timer-state` / `stage-announcement` broadcasts the
 * confidence monitor uses, so it stays in sync with the operator's Timer panel.
 */
export default function TimerOutput({ isBlackout }) {
  const [timers, setTimers] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [clock, setClock] = useState(formatClock());
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => { setClock(formatClock()); tick(n => n + 1); }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'timer-state') setTimers(payload || []);
        if (type === 'stage-announcement') setAnnouncement(payload?.text ? payload : null);
      };
    }
    const offs = [
      window.electronAPI?.onReceiveTimerState?.(setTimers),
      window.electronAPI?.onReceiveStageAnnouncement?.((p) => setAnnouncement(p?.text ? p : null)),
    ].filter(Boolean);
    // Ask the operator's Timer panel to re-broadcast current state now.
    if (typeof BroadcastChannel !== 'undefined') {
      const req = new BroadcastChannel(BROADCAST_CHANNEL);
      req.postMessage({ type: 'timer-state-request' });
      req.close();
    }
    return () => { ch?.close(); offs.forEach(f => f()); };
  }, []);

  if (isBlackout) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase' }}>Blackout</span>
      </div>
    );
  }

  const now = Date.now();
  const activeTimers = timers.filter(t =>
    t.type !== TIMER_TYPES.CLOCK && (t.running || t.finished || t.accumulatedMs > 0)
  );
  const hasMsg = !!announcement?.text;

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0a0c10',
      fontFamily: 'Inter, sans-serif', color: '#fff',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Wall clock — compact header once a timer is running, hero otherwise */}
      <div style={{
        flexShrink: 0, textAlign: 'center',
        padding: activeTimers.length ? '18px 24px 10px' : '0',
        display: activeTimers.length ? 'block' : 'flex',
        alignItems: 'center', justifyContent: 'center',
        flex: activeTimers.length ? '0 0 auto' : 1,
      }}>
        <div style={{
          fontSize: activeTimers.length ? 'clamp(22px, 3vw, 44px)' : 'clamp(48px, 12vw, 220px)',
          fontFamily: 'Georgia', color: 'rgba(255,255,255,0.9)',
          letterSpacing: '0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>
          {clock}
        </div>
        {activeTimers.length === 0 && (
          <div style={{ marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Current Time
          </div>
        )}
      </div>

      {/* Active timers — dominant */}
      {activeTimers.length > 0 && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 32, padding: '0 24px', overflow: 'hidden',
        }}>
          {activeTimers.map(timer => {
            const elapsed   = getElapsedMs(timer, now);
            const remaining = getRemainingMs(timer, now);
            const countdown = getCountdownMs(timer, now); // signed — negative in overtime
            const overtime  = timer.type === TIMER_TYPES.COUNTDOWN && countdown < 0 && elapsed > 0;
            const expired   = overtime || isExpired(timer, now) || timer.finished;
            const nearEnd   = !expired && timer.type === TIMER_TYPES.COUNTDOWN &&
                              timer.durationMs > 0 && (remaining / timer.durationMs) < 0.2;
            const pct       = timer.type === TIMER_TYPES.COUNTDOWN && timer.durationMs > 0
              ? Math.max(0, remaining / timer.durationMs) : null;
            const displayTime = timer.type === TIMER_TYPES.COUNTDOWN
              ? (overtime ? '-' : '') + formatMs(countdown)
              : formatMs(elapsed);
            const timeColor = expired ? '#ef4444' : nearEnd ? '#fbbf24' : '#ffffff';

            return (
              <div key={timer.id} style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
                  <span style={{ fontSize: 'clamp(14px, 1.8vw, 24px)', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    {timer.name}
                  </span>
                  {expired && (
                    <span style={{ fontSize: 'clamp(14px, 1.6vw, 22px)', fontWeight: 700, color: '#ef4444', letterSpacing: '3px' }}>
                      {overtime ? 'OVERTIME' : 'TIME'}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 'clamp(72px, 18vw, 340px)', fontFamily: 'Georgia', fontWeight: 500,
                  color: timeColor, letterSpacing: '0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                  textShadow: expired ? '0 0 48px rgba(239,68,68,0.6)'
                    : nearEnd ? '0 0 40px rgba(251,191,36,0.5)' : 'none',
                }}>
                  {displayTime}
                </div>
                {pct !== null && (
                  <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, marginTop: 22, overflow: 'hidden', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
                    <div style={{
                      height: '100%', width: `${pct * 100}%`,
                      background: expired ? '#ef4444' : nearEnd ? '#fbbf24' : '#4f8ef7',
                      borderRadius: 5,
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stage announcement */}
      {hasMsg && (
        <div style={{
          flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '20px 32px', textAlign: 'center',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{
            fontSize: 'clamp(20px, 3vw, 48px)', color: '#ffffff', fontFamily: 'Georgia',
            lineHeight: 1.4, whiteSpace: 'pre-line', textShadow: '0 2px 16px rgba(0,0,0,0.8)',
          }}>
            {announcement.text}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Announcement
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { SlideCanvas } from './SlideCanvas';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import {
  TIMER_TYPES,
  getElapsedMs,
  getRemainingMs,
  isExpired,
  formatMs,
  formatClock,
} from '../utils/timerEngine';

// ── Bottom-left quadrant: timer display ───────────────────────────────────────

function TimerQuadrant({ timers }) {
  const [clock, setClock] = useState(formatClock());
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(formatClock());
      tick(n => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const activeTimers = timers.filter(t =>
    t.type !== TIMER_TYPES.CLOCK && (t.running || t.finished || t.accumulatedMs > 0)
  );
  const clockTimers = timers.filter(t => t.type === TIMER_TYPES.CLOCK);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      padding: '12px 16px', gap: 10,
    }}>
      {/* Always show wall clock prominently */}
      <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
        <div style={{ fontSize: 'clamp(24px, 3.5vw, 44px)', fontFamily: 'Georgia', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em', lineHeight: 1 }}>
          {clock}
        </div>
        {clockTimers.length > 0 && clockTimers.map(t => (
          <div key={t.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{t.name}</div>
        ))}
      </div>

      {/* Active countdown / stopwatch timers */}
      {activeTimers.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            No active timers
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTimers.map(timer => {
            const elapsed   = getElapsedMs(timer, now);
            const remaining = getRemainingMs(timer, now);
            const expired   = isExpired(timer, now) || timer.finished;
            const nearEnd   = !expired && timer.type === TIMER_TYPES.COUNTDOWN &&
                              timer.durationMs > 0 && (remaining / timer.durationMs) < 0.2;
            const pct       = timer.type === TIMER_TYPES.COUNTDOWN && timer.durationMs > 0
              ? Math.max(0, remaining / timer.durationMs) : null;
            const displayTime = timer.type === TIMER_TYPES.COUNTDOWN ? formatMs(remaining) : formatMs(elapsed);
            const timeColor   = expired ? '#ef4444' : nearEnd ? '#fbbf24' : '#ffffff';

            return (
              <div key={timer.id} style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    {timer.name}
                  </span>
                  {expired && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '1.5px' }}>TIME</span>
                  )}
                </div>
                <div style={{
                  fontSize: 'clamp(26px, 3.8vw, 52px)', fontFamily: 'Georgia',
                  color: timeColor, letterSpacing: '0.05em', lineHeight: 1,
                  textShadow: expired ? '0 0 24px rgba(239,68,68,0.55)'
                    : nearEnd ? '0 0 24px rgba(251,191,36,0.45)' : 'none',
                }}>
                  {displayTime}
                </div>
                {pct !== null && (
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct * 100}%`,
                      background: expired ? '#ef4444' : nearEnd ? '#fbbf24' : '#4f8ef7',
                      borderRadius: 2,
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Bottom-right quadrant: stage announcement ─────────────────────────────────

function AnnouncementQuadrant({ announcement }) {
  const hasMsg = !!announcement?.text;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px 20px', textAlign: 'center', overflow: 'hidden',
    }}>
      {hasMsg ? (
        <>
          <div style={{
            fontSize: 'clamp(14px, 2.2vw, 30px)',
            color: '#ffffff',
            fontFamily: 'Georgia',
            lineHeight: 1.55,
            textShadow: '0 2px 16px rgba(0,0,0,0.8)',
            maxWidth: '92%',
            whiteSpace: 'pre-line',
          }}>
            {announcement.text}
          </div>
          <div style={{ marginTop: 14, fontSize: 9, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
            Stage Announcement
          </div>
        </>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px' }}>
          No announcement
        </div>
      )}
    </div>
  );
}

// ── Quadrant label bar ────────────────────────────────────────────────────────

function QuadrantLabel({ text, accent = 'rgba(255,255,255,0.25)' }) {
  return (
    <div style={{
      flexShrink: 0,
      padding: '3px 10px',
      background: 'rgba(0,0,0,0.45)',
      borderBottom: `1px solid ${accent}33`,
      fontSize: 8, fontWeight: 700, letterSpacing: '1.2px',
      textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif',
    }}>
      {text}
    </div>
  );
}

// ── ConfidenceMonitor (main export) ──────────────────────────────────────────
//
// Receives slide/nextSlide/isBlackout from OutputView (which handles the slide
// subscription), and subscribes internally to timer-state and stage-announcement
// via BroadcastChannel / electronAPI — so no changes to OutputView are needed.

export default function ConfidenceMonitor({ slide, nextSlide, isBlackout }) {
  const [timers, setTimers]           = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [clock, setClock]             = useState(formatClock());

  // Clock for header bar
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to timer-state, stage-announcement, and youtube-control broadcasts
  useEffect(() => {
    // Relay operator YouTube commands to the embed iframe via postMessage.
    // Confidence monitor always stays muted — only play/pause/stop are forwarded.
    const execYtCommand = (payload) => {
      const { func, args = [] } = payload || {};
      if (func === 'unMute' || func === 'setVolume') return;
      const cmdArgs = Array.isArray(args) && args.length > 0 ? args : '';
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func, args: cmdArgs }), '*'
          );
        } catch (_) {}
      });
    };

    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'timer-state') setTimers(payload || []);
        if (type === 'stage-announcement') setAnnouncement(payload?.text ? payload : null);
        if (type === 'youtube-control') execYtCommand(payload);
      };
    }
    if (window.electronAPI?.onReceiveTimerState) {
      window.electronAPI.onReceiveTimerState(setTimers);
    }
    if (window.electronAPI?.onReceiveStageAnnouncement) {
      window.electronAPI.onReceiveStageAnnouncement((p) => setAnnouncement(p?.text ? p : null));
    }
    if (window.electronAPI?.onReceiveYouTubeControl) {
      window.electronAPI.onReceiveYouTubeControl(execYtCommand);
    }
    return () => {
      ch?.close();
      window.electronAPI?.removeAllListeners?.('receive-timer-state');
      window.electronAPI?.removeAllListeners?.('receive-stage-announcement');
      window.electronAPI?.removeAllListeners?.('receive-youtube-control');
    };
  }, []);

  if (isBlackout) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase' }}>Blackout</span>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0a0c10', fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }}>
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 16px',
        background: '#12151c', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, background: '#4f8ef7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 9 }}>CP</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Confidence Monitor</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, fontFamily: 'Georgia', letterSpacing: '0.05em' }}>
          {clock}
        </span>
        <div style={{ width: 140 }} />
      </div>

      {/* ── Four-quadrant body ───────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        overflow: 'hidden',
      }}>

        {/* Upper-left: Current slide */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <QuadrantLabel text="Current" accent="#4f8ef7" />
          <SlideCanvas slide={slide} label="" accent="#4f8ef7" flex="1" />
        </div>

        {/* Upper-right: Next slide */}
        <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <QuadrantLabel text="Next" accent="rgba(255,255,255,0.3)" />
          <SlideCanvas slide={nextSlide} label="" accent="rgba(255,255,255,0.3)" dimmed flex="1" />
        </div>

        {/* Lower-left: Timers */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <QuadrantLabel text="Timers" accent="rgba(79,142,247,0.7)" />
          <TimerQuadrant timers={timers} />
        </div>

        {/* Lower-right: Stage announcement */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <QuadrantLabel text="Stage" accent="rgba(255,255,255,0.25)" />
          <AnnouncementQuadrant announcement={announcement} />
        </div>

      </div>
    </div>
  );
}

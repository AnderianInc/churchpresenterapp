import React, { useState, useEffect, useRef } from 'react';
import { BROADCAST_CHANNEL } from '../store/AppContext';
import { shouldAcceptYtState } from '../utils/youtubeControl';

function fmtTime(sec) {
  const s = Math.floor((sec || 0) % 60);
  const m = Math.floor((sec || 0) / 60) % 60;
  const h = Math.floor((sec || 0) / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getDefaultVideoPlaybackState() {
  return {
    isMuted: true,
    isPlaying: false,
    volume: 80,
    currentTime: 0,
    duration: 0,
  };
}

/**
 * Transport controls for a live, locally-imported video background (NOT YouTube).
 *
 * Sends play / pause / stop / restart / mute / volume / seek commands to every
 * output and stays in sync with the actual <video> element via the video-state
 * relay. Presentational only — pass `liveVideo` (the video background object) and
 * `sendVideoControl(func, args)` from the app store.
 */
export default function VideoControls({ liveVideo, sendVideoControl, compact = false }) {
  const defaults = getDefaultVideoPlaybackState();
  const [isMuted, setIsMuted] = useState(defaults.isMuted);
  const [isPlaying, setIsPlaying] = useState(defaults.isPlaying);
  const [volume, setVolume] = useState(defaults.volume);
  const [currentTime, setCurrentTime] = useState(defaults.currentTime);
  const [duration, setDuration] = useState(defaults.duration);
  const isSeekingRef = useRef(false);
  const lastActionRef = useRef(0);
  const prevValueRef = useRef(null);

  // Reset when a new video goes live
  useEffect(() => {
    if (liveVideo?.value && liveVideo.value !== prevValueRef.current) {
      prevValueRef.current = liveVideo.value;
      const nextDefaults = getDefaultVideoPlaybackState();
      setIsMuted(nextDefaults.isMuted);
      setIsPlaying(nextDefaults.isPlaying);
      setVolume(nextDefaults.volume);
      setCurrentTime(nextDefaults.currentTime);
      setDuration(nextDefaults.duration);
      lastActionRef.current = 0;
    }
  }, [liveVideo]);

  // Keep in sync with the real <video> element on the output
  useEffect(() => {
    const handleState = (payload) => {
      if (!shouldAcceptYtState(lastActionRef.current, Date.now())) return;
      if (payload.isMuted !== undefined) setIsMuted(payload.isMuted);
      if (payload.isPlaying !== undefined) setIsPlaying(payload.isPlaying);
      if (payload.volume !== undefined && payload.volume >= 0) setVolume(payload.volume);
      if (!isSeekingRef.current) {
        if (payload.currentTime !== undefined) setCurrentTime(payload.currentTime);
        if (payload.duration !== undefined && payload.duration > 0) setDuration(payload.duration);
      }
    };
    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => { if (e.data?.type === 'video-state') handleState(e.data.payload); };
    }
    const off = window.electronAPI?.onReceiveVideoState?.(handleState);
    return () => { ch?.close(); off?.(); };
  }, []);

  if (!liveVideo) return null;

  const act = (func, args = []) => { lastActionRef.current = Date.now(); sendVideoControl(func, args); };

  const btn = (active, flex = '1') => ({
    flex, padding: '5px 0', borderRadius: 5,
    background: active ? 'rgba(79,142,247,0.18)' : 'rgba(255,255,255,0.07)',
    border: active ? '1px solid rgba(79,142,247,0.45)' : '1px solid rgba(255,255,255,0.12)',
    color: active ? '#4f8ef7' : 'var(--text)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)', whiteSpace: 'nowrap',
  });
  const slider = (pct) => ({
    flex: 1, height: 4, borderRadius: 2, cursor: 'pointer', outline: 'none',
    appearance: 'none', WebkitAppearance: 'none',
    background: `linear-gradient(to right, #4f8ef7 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: compact ? '8px 10px' : '10px 12px',
      background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.25)',
      borderRadius: 8, width: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>🎬</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: '1px' }}>● LIVE</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {liveVideo.name || 'Video Background'}
        </span>
      </div>

      {/* Play / Pause · Stop · Restart · Mute */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={() => { const next = !isPlaying; setIsPlaying(next); act(next ? 'play' : 'pause'); }}
          style={btn(isPlaying)}
        >{isPlaying ? '⏸ Pause' : '▶ Play'}</button>
        <button
          onClick={() => { setIsPlaying(false); setCurrentTime(0); act('stop'); }}
          style={btn(false)}
          title="Stop and rewind to start"
        >⏹ Stop</button>
        <button
          onClick={() => { setIsPlaying(true); setCurrentTime(0); act('restart'); }}
          style={btn(false)}
          title="Restart from the beginning"
        >↺ Restart</button>
        <button
          onClick={() => { const next = !isMuted; setIsMuted(next); act(next ? 'mute' : 'unmute'); }}
          style={{ ...btn(false), flex: 'none', padding: '5px 12px' }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >{isMuted ? '🔇' : '🔊'}</button>
      </div>

      {/* Seek */}
      {duration > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 42, flexShrink: 0 }}>{fmtTime(currentTime)}</span>
          <input
            type="range" min={0} max={duration} step={0.5} value={Math.min(currentTime, duration)}
            style={slider((currentTime / duration) * 100)}
            onMouseDown={() => { isSeekingRef.current = true; }}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            onMouseUp={(e) => { const t = Number(e.target.value); isSeekingRef.current = false; setCurrentTime(t); act('seek', [t]); }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 42, flexShrink: 0, textAlign: 'right' }}>{fmtTime(duration)}</span>
        </div>
      )}

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 42 }}>Vol {volume}</span>
        <input
          type="range" min={0} max={100} value={volume}
          style={slider(volume)}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            act('setVolume', [v]);
            if (v > 0 && isMuted) { setIsMuted(false); act('unmute'); }
          }}
        />
      </div>
    </div>
  );
}

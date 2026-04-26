import React, { useState, useEffect, useRef } from 'react';
import { BROADCAST_CHANNEL } from '../store/AppContext';

/**
 * StreamView — fullscreen stream output window.
 *
 * Designed to be screen-shared into Zoom, Teams, OBS, etc.
 * Receives:
 *  - Camera device ID via IPC/BroadcastChannel → starts getUserMedia
 *  - Lower-third overlay data → shows text bar at bottom
 *  - Blackout flag → full black overlay
 */
export default function StreamView() {
  const [cameraDeviceId, setCameraDeviceId] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [lowerThird, setLowerThird] = useState({ active: false, text: '', label: '', source: '' });
  const [isBlackout, setIsBlackout] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isElectron = !!window.electronAPI;

  // ── IPC / BroadcastChannel listeners ───────────────────────────────────────
  useEffect(() => {
    if (isElectron) {
      window.electronAPI.onReceiveStreamConfig(({ cameraDeviceId: id }) => {
        setCameraDeviceId(id || null);
      });
      window.electronAPI.onReceiveLowerThird((data) => setLowerThird(data));
      window.electronAPI.onReceiveBlackout((v) => setIsBlackout(v));
      return () => {
        window.electronAPI.removeAllListeners('receive-stream-config');
        window.electronAPI.removeAllListeners('receive-lower-third');
        window.electronAPI.removeAllListeners('receive-blackout');
      };
    } else {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'stream-config') setCameraDeviceId(payload?.cameraDeviceId || null);
        if (type === 'lower-third') setLowerThird(payload);
        if (type === 'blackout') setIsBlackout(payload);
      };
      // Request initial state on mount
      channel.postMessage({ type: 'state-request', payload: null });
      return () => channel.close();
    }
  }, [isElectron]);

  // ── Camera capture ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function startCamera() {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (!cameraDeviceId) return;

try {
  setCameraError('');
  let stream;
  try {
    // First attempt: preferred device with ideal (not exact) constraints
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { ideal: cameraDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (firstErr) {
    console.warn('[StreamView] Preferred camera failed, falling back to any camera:', firstErr.message);
    // Fallback: any available camera
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
  streamRef.current = stream;
  if (videoRef.current) {
    videoRef.current.srcObject = stream;
  }
} catch (err) {
  if (!active) return;
  console.error('[StreamView] Camera error:', err);
  setCameraError(err.message || 'Failed to access camera.');
}
    }

    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [cameraDeviceId]);

  const showLowerThird = lowerThird?.active && lowerThird?.text;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#000',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── Video feed ─────────────────────────────────────────────────────── */}
      {cameraDeviceId && !cameraError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      )}

      {/* ── No-camera placeholder ──────────────────────────────────────────── */}
      {(!cameraDeviceId || cameraError) && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', userSelect: 'none' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Stream View</div>
          <div style={{ fontSize: 12, marginTop: 8, color: 'rgba(255,255,255,0.15)', maxWidth: 340, lineHeight: 1.6 }}>
            {cameraError
              ? `Camera error: ${cameraError}`
              : 'Select a video source in the Stream panel, then share this window in Zoom or OBS.'}
          </div>
        </div>
      )}

      {/* ── Lower-third overlay ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '64px 56px 40px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
        opacity: showLowerThird ? 1 : 0,
        transform: showLowerThird ? 'translateY(0)' : 'translateY(16px)',
        pointerEvents: 'none',
        zIndex: 40,
      }}>
        {/* Accent bar */}
        <div style={{
          width: 4, height: '100%',
          position: 'absolute', left: 40, top: 0, bottom: 0,
          background: 'linear-gradient(to bottom, transparent, #4f8ef7 40%, #4f8ef7 80%, transparent)',
          opacity: showLowerThird ? 0.85 : 0,
          transition: 'opacity 0.45s ease',
        }} />

        {lowerThird.label && (
          <div style={{
            fontSize: 15, fontWeight: 700, color: '#7cb9fa',
            fontFamily: 'Georgia, serif', marginBottom: 6,
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>
            {lowerThird.label}
          </div>
        )}

        <div style={{
          fontSize: 28, color: '#ffffff', fontFamily: 'Georgia, serif',
          lineHeight: 1.5, textShadow: '0 2px 8px rgba(0,0,0,0.95)',
          maxWidth: '80%',
        }}>
          {lowerThird.text}
        </div>

        {lowerThird.source && (
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.6)',
            fontFamily: 'Georgia, serif', marginTop: 6,
            fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}>
            {lowerThird.source}
          </div>
        )}
      </div>

      {/* ── Blackout overlay ──────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: '#000',
        opacity: isBlackout ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: isBlackout ? 'auto' : 'none',
        zIndex: 90,
      }} />
    </div>
  );
}

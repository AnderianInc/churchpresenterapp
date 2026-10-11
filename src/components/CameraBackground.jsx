import React, { useRef, useEffect, useState } from 'react';

/**
 * Live camera feed rendered as a slide background.
 *
 * Opens exactly ONE getUserMedia stream for the given deviceId and tears it down
 * on unmount or when the device changes — this strict single-instance lifecycle is
 * what keeps multiple windows/renders from stacking camera decoders into a loop.
 *
 * Intended to be mounted only on real fullscreen outputs (and the Live tab's own
 * preview). Small previews/thumbnails should render a static placeholder instead,
 * never this component, so the operator window doesn't open the camera many times.
 */
export default function CameraBackground({ deviceId, brightness = 1, objectFit = 'cover', onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const stop = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };

    async function start() {
      stop();
      setError(null);
      try {
        const ideal = { width: { ideal: 1920 }, height: { ideal: 1080 } };
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { ideal: deviceId }, ...ideal } : ideal,
            audio: false,
          });
        } catch (firstErr) {
          // Fall back to any available camera if the preferred device fails
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (!active) return;
        const msg = err?.message || 'Camera unavailable';
        setError(msg);
        onError?.(msg);
      }
    }

    start();
    return () => { active = false; stop(); };
  }, [deviceId, onError]);

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0, background: '#0a0a0a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fca5a5', fontSize: 14, fontFamily: 'Inter, sans-serif', padding: 20, textAlign: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 28 }}>📷</span>
        <span>Camera error: {error}</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%', objectFit,
        filter: `brightness(${brightness})`, background: '#000',
      }}
    />
  );
}

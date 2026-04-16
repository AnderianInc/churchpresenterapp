import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../store/AppContext';

const PLATFORM_COLORS = { facebook: '#1877F2', youtube: '#FF0000', instagram: '#E1306C', custom: '#888' };
const PLATFORM_ICONS  = { facebook: '📘', youtube: '▶️', instagram: '📷', custom: '📡' };

/**
 * StreamPanel — operator controls for the stream output window.
 *
 * Features:
 *  - Open / close the stream output window
 *  - Enumerate and select a video input (OBS Virtual Camera, webcam, etc.)
 *  - Live preview of the selected camera in-panel
 *  - Lower-third text controls: send or clear the overlay
 *  - Quick-send from the current active slide (announcement or Bible verse)
 */
export default function StreamPanel() {
  const {
    streamOpen, openStream, closeStream,
    lowerThird, pushLowerThird, sendStreamConfig,
    currentItem, currentSlide,
    isBlackout, toggleBlackout,
    settings, ffmpegAvailable, isElectron,
  } = useApp();

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [activeStreamDeviceId, setActiveStreamDeviceId] = useState(null); // what's live on stream window
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [previewStream, setPreviewStream] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [ltText, setLtText] = useState('');
  const [ltLabel, setLtLabel] = useState('');
  const [ltSource, setLtSource] = useState('');
  const previewRef = useRef(null);

  // ── Social / RTMP streaming state ───────────────────────────────────────
  const [isRtmpStreaming, setIsRtmpStreaming] = useState(false);
  const [rtmpStatus, setRtmpStatus] = useState({}); // destId → { type, bitrate, elapsed, error }
  const [rtmpError, setRtmpError] = useState('');
  const recorderRef = useRef(null);
  const captureStreamRef = useRef(null);
  const rtmpDurationRef = useRef(null);
  const [rtmpElapsed, setRtmpElapsed] = useState(0);
  const destinations = settings?.rtmpDestinations || [];

  // ── Request camera permission & enumerate devices ───────────────────────────
  const requestPermissionAndEnumerate = useCallback(async () => {
    try {
      setPermissionError('');
      // A brief getUserMedia triggers the OS permission dialog; we stop it immediately.
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());
      setPermissionGranted(true);
    } catch (err) {
      setPermissionError(err.message || 'Camera permission denied.');
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter(d => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      setPermissionError('Failed to list cameras: ' + err.message);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    // Auto-enumerate if permission was already granted (no dialog on re-open)
    navigator.mediaDevices.enumerateDevices()
      .then(all => {
        const videoInputs = all.filter(d => d.kind === 'videoinput');
        if (videoInputs.length > 0 && videoInputs[0].label) {
          // Labels are present → permission already granted
          setPermissionGranted(true);
          setDevices(videoInputs);
          if (!selectedDeviceId) setSelectedDeviceId(videoInputs[0].deviceId);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preview selected device in panel ───────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function startPreview() {
      // Stop any existing preview
      previewStream?.getTracks().forEach(t => t.stop());
      setPreviewStream(null);
      setPreviewError('');
      if (!selectedDeviceId || !permissionGranted) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        setPreviewStream(stream);
      } catch (err) {
        if (!active) return;
        setPreviewError(err.message || 'Could not preview this device.');
      }
    }
    startPreview();
    return () => {
      active = false;
      // cleanup happens via previewStream state
    };
  }, [selectedDeviceId, permissionGranted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach preview stream to video element
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.srcObject = previewStream || null;
    }
    return () => {
      if (!previewStream) return;
      previewStream.getTracks().forEach(t => t.stop());
    };
  }, [previewStream]);

  // ── Send camera to stream window ────────────────────────────────────────────
  const handleUseCamera = () => {
    sendStreamConfig({ cameraDeviceId: selectedDeviceId || null });
    setActiveStreamDeviceId(selectedDeviceId || null);
  };

  const handleStopCamera = () => {
    sendStreamConfig({ cameraDeviceId: null });
    setActiveStreamDeviceId(null);
  };

  // ── Lower-third helpers ─────────────────────────────────────────────────────
  const sendLowerThird = () => {
    if (!ltText.trim()) return;
    pushLowerThird({ active: true, text: ltText.trim(), label: ltLabel.trim(), source: ltSource.trim() });
  };

  const clearLowerThird = () => {
    pushLowerThird({ active: false, text: '', label: '', source: '' });
  };

  // Quick-send the active slide text as a lower-third
  const sendSlideAsLowerThird = () => {
    if (!currentSlide) return;
    const raw = currentSlide.lines || '';
    // Strip the attribution line (everything after \n\n—)
    const textPart = raw.split('\n\n—')[0].trim();
    const attrMatch = raw.match(/— (.+)$/m);
    const source = attrMatch ? attrMatch[1].trim() : '';
    const label = currentItem?.title || currentSlide.label || '';
    pushLowerThird({ active: true, text: textPart, label, source });
    // Mirror fields in the inputs
    setLtText(textPart);
    setLtLabel(label);
    setLtSource(source);
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputStyle = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 10px',
    fontSize: 12, outline: 'none', fontFamily: 'var(--font)', width: '100%',
    boxSizing: 'border-box',
  };

  const sectionLabel = {
    fontSize: 10, fontWeight: 600, color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6,
  };

  const primaryBtn = {
    background: 'var(--accent)', border: 'none', color: '#fff',
    padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'var(--font)', fontWeight: 500,
  };

  const ghostBtn = {
    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
    padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'var(--font)',
  };

  // Clear active source tracker when the stream window closes
  useEffect(() => {
    if (!streamOpen) setActiveStreamDeviceId(null);
  }, [streamOpen]);

  // ── RTMP status listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) return;
    const handler = (data) => {
      setRtmpStatus(prev => ({ ...prev, [data.destId]: data }));
      if (data.type === 'error') setRtmpError(`Stream error: ${data.error}`);
      if (data.type === 'closed' && data.code !== 0) setRtmpError(`FFmpeg exited (code ${data.code})`);
    };
    window.electronAPI.onRtmpStatus(handler);
    return () => window.electronAPI.removeAllListeners('rtmp-status');
  }, [isElectron]);

  // ── Start social streaming ──────────────────────────────────────────────
  const startSocialStream = useCallback(async () => {
    if (!isElectron) return;
    setRtmpError('');
    const activeDests = destinations.filter(d => d.enabled && d.streamKey.trim());
    if (activeDests.length === 0) { setRtmpError('No destinations configured. Add a platform with a stream key.'); return; }
    if (!streamOpen) { setRtmpError('Open the Stream Window first.'); return; }

    try {
      // Find stream window source
      const sources = await window.electronAPI.getStreamSources();
      const streamSrc = sources.find(s => s.name && s.name.includes('Stream View'));
      if (!streamSrc) { setRtmpError('Stream window not found. Make sure it is open.'); return; }

      // Tell main which source to use when getDisplayMedia fires
      await window.electronAPI.setRtmpSource(streamSrc.id);

      // Capture the stream window
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720, frameRate: 30 }, audio: false });
      captureStreamRef.current = stream;

      // Start FFmpeg processes for each destination
      for (const dest of activeDests) {
        const result = await window.electronAPI.startRtmp({ destId: dest.id, rtmpUrl: dest.rtmpUrl + dest.streamKey });
        if (result?.error) { setRtmpError(result.error === 'ffmpeg_not_found' ? 'FFmpeg not found. Install FFmpeg to enable direct streaming.' : result.error); return; }
      }

      // Start MediaRecorder and pipe chunks
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=h264') ? 'video/webm;codecs=h264' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          e.data.arrayBuffer().then(buf => {
            const chunk = new Uint8Array(buf);
            for (const dest of activeDests) {
              window.electronAPI.sendRtmpChunk(dest.id, chunk);
            }
          });
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        captureStreamRef.current = null;
      };

      recorder.start(500); // 500ms chunks
      setIsRtmpStreaming(true);
      setRtmpElapsed(0);
      rtmpDurationRef.current = setInterval(() => setRtmpElapsed(s => s + 1), 1000);
    } catch (err) {
      setRtmpError(err.message || 'Failed to start streaming.');
    }
  }, [isElectron, destinations, streamOpen]);

  // ── Stop social streaming ───────────────────────────────────────────────
  const stopSocialStream = useCallback(async (destId) => {
    if (!isElectron) return;
    if (destId) {
      await window.electronAPI.stopRtmp(destId);
    } else {
      // Stop all
      if (recorderRef.current) { try { recorderRef.current.stop(); } catch {} recorderRef.current = null; }
      if (captureStreamRef.current) { captureStreamRef.current.getTracks().forEach(t => t.stop()); captureStreamRef.current = null; }
      clearInterval(rtmpDurationRef.current);
      await window.electronAPI.stopRtmp();
      setIsRtmpStreaming(false);
      setRtmpStatus({});
      setRtmpElapsed(0);
    }
  }, [isElectron]);

  const isLtActive = lowerThird?.active;

  return (
    <div style={{
      width: 280, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Stream</span>
        {streamOpen && (
          <span style={{ fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700, letterSpacing: '0.5px' }}>
            LIVE
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Stream window control ─────────────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionLabel}>Stream Window</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            {streamOpen
              ? 'Window is open. Screen-share it in Zoom, Teams, or OBS for your audience.'
              : 'Open a dedicated stream output window, then screen-share it in Zoom or OBS.'}
          </div>
          <button
            onClick={streamOpen ? closeStream : () => openStream(0)}
            style={{
              ...primaryBtn,
              background: streamOpen ? 'var(--red)' : 'var(--accent)',
              width: '100%',
            }}
          >
            {streamOpen ? '⏹ Close Stream Window' : '▶ Open Stream Window'}
          </button>
        </div>

        {/* ── Camera / OBS Virtual Camera ───────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionLabel}>Video Source</div>

          {!permissionGranted ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
                Grant camera access to see available devices. OBS Virtual Camera appears here once OBS is running with Virtual Camera enabled.
              </div>
              {permissionError && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{permissionError}</div>
              )}
              <button onClick={requestPermissionAndEnumerate} style={{ ...primaryBtn, width: '100%' }}>
                Allow Camera Access
              </button>
            </>
          ) : (
            <>
              {devices.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                  No video devices found. Start OBS with Virtual Camera enabled and refresh.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {devices.map(d => {
                    const isLive = activeStreamDeviceId === d.deviceId;
                    const isSelected = selectedDeviceId === d.deviceId;
                    return (
                      <label key={d.deviceId} style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        padding: '6px 8px', borderRadius: 5,
                        background: isLive ? 'rgba(34,197,94,0.1)' : isSelected ? 'rgba(79,142,247,0.12)' : 'var(--bg-hover)',
                        border: `1px solid ${isLive ? 'rgba(34,197,94,0.4)' : isSelected ? 'rgba(79,142,247,0.4)' : 'var(--border)'}`,
                        transition: 'all 0.12s',
                      }}>
                        <input
                          type="radio"
                          name="camera"
                          value={d.deviceId}
                          checked={isSelected}
                          onChange={() => setSelectedDeviceId(d.deviceId)}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: isSelected ? 600 : 400 }}>
                            {d.label || `Camera ${devices.indexOf(d) + 1}`}
                          </div>
                          {d.label?.toLowerCase().includes('obs') && (
                            <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '0.3px' }}>OBS Virtual Camera</div>
                          )}
                        </div>
                        {isLive && (
                          <span style={{
                            fontSize: 9, color: 'var(--green)', fontWeight: 700,
                            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                            borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap',
                          }}>LIVE</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* In-panel preview */}
              <div style={{
                width: '100%', aspectRatio: '16/9', background: '#000',
                borderRadius: 6, overflow: 'hidden', marginBottom: 8,
                border: '1px solid var(--border)', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <video
                  ref={previewRef}
                  autoPlay muted playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: previewStream ? 'block' : 'none' }}
                />
                {!previewStream && !previewError && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>No preview</span>
                )}
                {previewError && (
                  <span style={{ fontSize: 10, color: 'var(--red)', textAlign: 'center', padding: 8 }}>{previewError}</span>
                )}
                {previewStream && (
                  <div style={{
                    position: 'absolute', bottom: 4, right: 6,
                    fontSize: 9, color: 'rgba(255,255,255,0.5)',
                    background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: 3,
                  }}>PREVIEW</div>
                )}
              </div>

              {/* Active source status bar */}
              {activeStreamDeviceId && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 8px', borderRadius: 5, marginBottom: 6,
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--green)' }}>
                    ● Streaming: <strong>{devices.find(d => d.deviceId === activeStreamDeviceId)?.label || 'Camera'}</strong>
                  </span>
                  <button
                    onClick={handleStopCamera}
                    style={{
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                      color: '#f87171', padding: '2px 8px', borderRadius: 4,
                      cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
                    }}
                  >
                    Stop
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={requestPermissionAndEnumerate} style={{ ...ghostBtn, flex: 1, fontSize: 11 }}>
                  Refresh
                </button>
                <button
                  onClick={handleUseCamera}
                  disabled={!selectedDeviceId || !streamOpen}
                  style={{
                    ...primaryBtn, flex: 2,
                    opacity: (!selectedDeviceId || !streamOpen) ? 0.45 : 1,
                    cursor: (!selectedDeviceId || !streamOpen) ? 'not-allowed' : 'pointer',
                  }}
                  title={!streamOpen ? 'Open the stream window first' : ''}
                >
                  {activeStreamDeviceId
                    ? (activeStreamDeviceId === selectedDeviceId ? 'Restart Source' : 'Switch Source')
                    : 'Send to Stream'}
                </button>
              </div>
              {!streamOpen && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 5 }}>
                  Open the stream window first to send a camera source.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Lower-third ───────────────────────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={sectionLabel}>Lower-Third Overlay</div>
            {isLtActive && (
              <span style={{ fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>
                ON AIR
              </span>
            )}
          </div>

          {/* Quick-send from current slide */}
          {currentSlide && (
            <div style={{
              padding: '7px 10px', borderRadius: 5, marginBottom: 8,
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Current slide</div>
              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{currentItem?.title}</span>
                {currentSlide.label && <span style={{ color: 'var(--text-muted)' }}> — {currentSlide.label}</span>}
              </div>
              <button onClick={sendSlideAsLowerThird} style={{ ...primaryBtn, fontSize: 11, padding: '4px 10px' }}>
                Send as Lower-Third
              </button>
            </div>
          )}

          {/* Manual lower-third */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              value={ltLabel}
              onChange={e => setLtLabel(e.target.value)}
              placeholder='Label (e.g. John 3:16 · Speaker Name)'
              style={inputStyle}
            />
            <textarea
              value={ltText}
              onChange={e => setLtText(e.target.value)}
              placeholder='Lower-third text (announcement, verse, quote…)'
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
            <input
              value={ltSource}
              onChange={e => setLtSource(e.target.value)}
              placeholder='Source line (e.g. NIV, Pastor Name)'
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={clearLowerThird}
                style={{ ...ghostBtn, flex: 1 }}
                disabled={!isLtActive}
              >
                Clear
              </button>
              <button
                onClick={sendLowerThird}
                style={{
                  ...primaryBtn, flex: 2,
                  background: '#166534', border: '1px solid rgba(34,197,94,0.3)', color: '#a7f3d0',
                  opacity: ltText.trim() ? 1 : 0.45,
                  cursor: ltText.trim() ? 'pointer' : 'not-allowed',
                }}
                disabled={!ltText.trim()}
              >
                Send Lower-Third
              </button>
            </div>
          </div>
        </div>

        {/* ── Blackout control ──────────────────────────────────────────── */}
        <div style={{ padding: '10px 12px' }}>
          <div style={sectionLabel}>Stream Controls</div>
          <button
            onClick={toggleBlackout}
            style={{
              ...ghostBtn,
              width: '100%',
              background: isBlackout ? '#222' : 'transparent',
              color: isBlackout ? '#fff' : 'var(--text-muted)',
              border: isBlackout ? '1px solid #555' : '1px solid var(--border)',
            }}
          >
            ⬛ {isBlackout ? 'Remove Blackout' : 'Blackout Stream'}
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
            Blackout hides all content on the stream window instantly.
          </div>
        </div>

        {/* ── OBS setup tips ────────────────────────────────────────────── */}
        <div style={{
          margin: '0 12px 12px',
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(79,142,247,0.06)',
          border: '1px solid rgba(79,142,247,0.15)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 4, letterSpacing: '0.4px' }}>
            OBS / ZOOM SETUP
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            1. In OBS: enable <strong style={{ color: 'var(--text-muted)' }}>Virtual Camera</strong><br />
            2. Select <strong style={{ color: 'var(--text-muted)' }}>OBS Virtual Camera</strong> above<br />
            3. Open Stream Window and screen-share it in Zoom<br />
            4. Or: add a <strong style={{ color: 'var(--text-muted)' }}>Window Capture</strong> source in OBS
          </div>
        </div>

        {/* ── Social Media Streaming (RTMP) ─────────────────────────────── */}
        {isElectron && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={sectionLabel}>Social Streaming</div>
              {isRtmpStreaming && (
                <span style={{ fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>
                  ● {Math.floor(rtmpElapsed / 60)}:{String(rtmpElapsed % 60).padStart(2, '0')}
                </span>
              )}
            </div>

            {ffmpegAvailable === false && (
              <div style={{ fontSize: 10, color: 'var(--orange)', marginBottom: 8, padding: '5px 8px', background: 'rgba(249,115,22,0.08)', borderRadius: 5, border: '1px solid rgba(249,115,22,0.2)' }}>
                ⚠ FFmpeg not found — configure in ⚙ Settings
              </div>
            )}

            {rtmpError && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 8, padding: '5px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)' }}>
                {rtmpError}
              </div>
            )}

            {destinations.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 8 }}>
                No streaming destinations configured.<br />
                Go to <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Social Streaming</strong> to add Facebook, YouTube, or a custom RTMP endpoint.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                {destinations.filter(d => d.enabled).map(dest => {
                  const color = PLATFORM_COLORS[dest.platform] || '#888';
                  const icon = PLATFORM_ICONS[dest.platform] || '📡';
                  const status = rtmpStatus[dest.id];
                  const isLive = isRtmpStreaming && (status?.type === 'progress' || !status);
                  return (
                    <div key={dest.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 6,
                      background: isLive ? color + '18' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isLive ? color + '55' : 'var(--border)'}`,
                    }}>
                      <span style={{ fontSize: 13 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text)' }}>{dest.name}</span>
                      {isLive && status?.bitrate > 0 && (
                        <span style={{ fontSize: 9, color, fontWeight: 700 }}>{Math.round(status.bitrate)}k</span>
                      )}
                      {isLive && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>LIVE</span>}
                    </div>
                  );
                })}
                {destinations.filter(d => !d.enabled).length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {destinations.filter(d => !d.enabled).length} destination(s) disabled — enable in ⚙ Settings
                  </div>
                )}
              </div>
            )}

            {destinations.length > 0 && (
              isRtmpStreaming ? (
                <button onClick={() => stopSocialStream()} style={{ ...primaryBtn, width: '100%', background: 'var(--red)' }}>
                  ⏹ Stop Social Streaming
                </button>
              ) : (
                <button
                  onClick={startSocialStream}
                  disabled={ffmpegAvailable === false || !streamOpen || destinations.filter(d => d.enabled && d.streamKey?.trim()).length === 0}
                  style={{
                    ...primaryBtn, width: '100%',
                    background: 'linear-gradient(135deg, #1877F2 0%, #FF0000 50%, #E1306C 100%)',
                    opacity: (ffmpegAvailable === false || !streamOpen || destinations.filter(d => d.enabled && d.streamKey?.trim()).length === 0) ? 0.45 : 1,
                    cursor: 'pointer',
                  }}
                  title={!streamOpen ? 'Open the Stream Window first' : ''}
                >▶ Go Live — Social</button>
              )
            )}
            {destinations.length > 0 && !streamOpen && !isRtmpStreaming && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 5 }}>Open the Stream Window first.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

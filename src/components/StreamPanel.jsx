import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { detectReferences } from '../utils/referenceDetector';

const PLATFORM_COLORS = { facebook: '#1877F2', youtube: '#FF0000', instagram: '#E1306C', custom: '#888' };
const PLATFORM_ICONS  = { facebook: '📘', youtube: '▶️', instagram: '📷', custom: '📡' };

const MAX_TRANSCRIPT_CHARS = 4000;
const AUTO_SUGGEST_WORDS   = 40;
const AUTO_SUGGEST_DELAY   = 45000;

function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
function mergeRefs(existing, incoming) {
  const seen = new Set(existing.map(r => r.reference));
  return [...existing, ...incoming.filter(r => !seen.has(r.reference))];
}

// ── Level meter ───────────────────────────────────────────────────────────────
function LevelMeter({ level, active }) {
  return (
    <div style={{ display: 'flex', gap: 2, height: 16, alignItems: 'flex-end', flex: 1 }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const threshold = (i / 14) * 100;
        const lit = active && level > threshold;
        const isHigh = i > 10; const isMid = i > 7;
        return (
          <div key={i} style={{
            flex: 1, height: lit ? `${60 + (i / 14) * 40}%` : '20%',
            background: isHigh ? '#ef4444' : isMid ? '#eab308' : '#22c55e',
            opacity: lit ? 1 : 0.18, borderRadius: 2,
            transition: 'height 60ms linear, opacity 60ms',
          }} />
        );
      })}
    </div>
  );
}

// ── Sermon Assistant section (full feature, embedded in Stream) ───────────────
function SermonSection({ pushLowerThird, setLtText, setLtLabel, setLtSource }) {
  const {
    settings, addToSchedule,
    sermonTranscript, setSermonTranscript,
    sermonInterim, setSermonInterim,
    sermonReferences, setSermonReferences,
    sermonSuggestions, setSermonSuggestions,
    sermonListening, setSermonListening,
    sermonSuggesting, setSermonSuggesting,
    clearSermon,
  } = useApp();

  const hasApiKey = !!(settings?.anthropicApiKey?.trim());
  const hasTranscript = (sermonTranscript + sermonInterim).trim().length > 0;

  // Speech recognition
  const recognitionRef = useRef(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState('');

  // Level meter
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);

  // Auto-suggest
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [aiError, setAiError] = useState('');
  const autoTimerRef = useRef(null);
  const lastSuggestWordsRef = useRef(0);

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) setSpeechSupported(false);
  }, []);

  // Detect references on transcript change
  useEffect(() => {
    if (!sermonTranscript && !sermonInterim) return;
    const detected = detectReferences(sermonTranscript + ' ' + sermonInterim);
    setSermonReferences(prev => mergeRefs(prev, detected));
  }, [sermonTranscript, sermonInterim, setSermonReferences]);

  // Level meter helpers
  const startLevelMeter = useCallback(async (deviceId) => {
    stopLevelMeter();
    try {
      const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setMicLevel(Math.min(100, data.reduce((s, v) => s + v, 0) / data.length * 2.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* level meter fails gracefully */ }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setMicLevel(0);
  }, []);

  // Ask Claude for verse suggestions
  const askClaude = useCallback(async (manual = false) => {
    if (!hasApiKey || !sermonTranscript.trim() || sermonSuggesting) return;
    const currentWords = wordCount(sermonTranscript);
    if (!manual && currentWords - lastSuggestWordsRef.current < AUTO_SUGGEST_WORDS) return;
    setSermonSuggesting(true); setAiError('');
    try {
      const result = await window.electronAPI?.suggestVerses({
        transcript: sermonTranscript.slice(-1500),
        apiKey: settings.anthropicApiKey,
      });
      setSermonSuggestions(result || []);
      lastSuggestWordsRef.current = currentWords;
    } catch (e) {
      setAiError(e.message || 'AI suggestion failed');
    } finally {
      setSermonSuggesting(false);
    }
  }, [hasApiKey, sermonTranscript, sermonSuggesting, settings?.anthropicApiKey, setSermonSuggestions, setSermonSuggesting]);

  // Auto-suggest debounce
  useEffect(() => {
    if (!autoSuggest || !hasApiKey || !sermonListening || !sermonTranscript.trim()) return;
    clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => askClaude(false), AUTO_SUGGEST_DELAY);
    return () => clearTimeout(autoTimerRef.current);
  }, [sermonTranscript, autoSuggest, hasApiKey, sermonListening, askClaude]);

  // Start listening
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }
    setMicError('');
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          setSermonTranscript(prev => {
            const updated = (prev + ' ' + r[0].transcript).trim();
            return updated.length > MAX_TRANSCRIPT_CHARS ? updated.slice(-MAX_TRANSCRIPT_CHARS) : updated;
          });
          setSermonInterim('');
        } else { interim += r[0].transcript; }
      }
      if (interim) setSermonInterim(interim);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) try { recognition.start(); } catch {}
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('Mic access denied. Check OS privacy settings.');
        stopListening();
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setMicError(`Speech error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    setSermonListening(true);
    recognition.start();
    startLevelMeter(settings?.preferredMicId || '');
  }, [settings?.preferredMicId, setSermonListening, setSermonTranscript, setSermonInterim, startLevelMeter]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setSermonListening(false);
    setSermonInterim('');
    stopLevelMeter();
    clearTimeout(autoTimerRef.current);
  }, [setSermonListening, setSermonInterim, stopLevelMeter]);

  useEffect(() => () => { stopListening(); stopLevelMeter(); }, [stopListening, stopLevelMeter]);

  const handleAddToSchedule = useCallback((reference) => {
    addToSchedule({ type: 'scripture', title: reference, slides: [{ id: `ref-${Date.now()}`, type: 'verse', label: reference, lines: reference }] });
  }, [addToSchedule]);

  const sendAsLT = useCallback((reference) => {
    pushLowerThird({ active: true, label: 'Scripture', text: reference, source: '' });
    setLtText(reference); setLtLabel('Scripture'); setLtSource('');
  }, [pushLowerThird, setLtText, setLtLabel, setLtSource]);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Section header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: sermonListening ? '#22c55e' : '#444',
            boxShadow: sermonListening ? '0 0 6px #22c55e' : 'none',
            flexShrink: 0, animation: sermonListening ? 'pulse 1.5s infinite' : 'none',
          }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1 }}>Sermon Assistant</div>
          {sermonListening && hasApiKey && (
            <div
              onClick={() => setAutoSuggest(v => !v)}
              style={{
                fontSize: 9, color: autoSuggest ? '#a855f7' : 'var(--text-dim)',
                background: autoSuggest ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${autoSuggest ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
                borderRadius: 3, padding: '2px 6px', fontWeight: 700, cursor: 'pointer', userSelect: 'none',
              }}
              title="Toggle auto verse suggestions"
            >AUTO {autoSuggest ? 'ON' : 'OFF'}</div>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
          {sermonListening ? 'Listening — detecting Bible references' : 'Activate mic to detect references live'}
        </div>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Mic controls */}
        {!speechSupported ? (
          <div style={{ fontSize: 11, color: 'var(--orange)', padding: '7px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
            Speech recognition not supported in this environment.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={sermonListening ? stopListening : startListening}
                style={{
                  background: sermonListening ? 'rgba(239,68,68,0.12)' : 'rgba(79,142,247,0.12)',
                  border: `1px solid ${sermonListening ? 'rgba(239,68,68,0.4)' : 'rgba(79,142,247,0.3)'}`,
                  color: sermonListening ? '#ef4444' : 'var(--accent)',
                  borderRadius: 7, padding: '7px 12px', cursor: 'pointer',
                  fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
                }}
              >{sermonListening ? '⏹ Stop' : '🎙 Listen'}</button>
              <div style={{ flex: 1 }}>
                {sermonListening
                  ? <LevelMeter level={micLevel} active />
                  : <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>Mic in ⚙ Settings → Devices</div>}
              </div>
              {hasTranscript && (
                <button onClick={() => { clearSermon(); lastSuggestWordsRef.current = 0; setAiError(''); }}
                  title="Clear transcript" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>✕</button>
              )}
            </div>
            {sermonListening && micLevel < 3 && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -6 }}>No signal — check mic is not muted</div>
            )}
            {micError && <div style={{ fontSize: 10, color: 'var(--red)', lineHeight: 1.5 }}>{micError}</div>}
          </>
        )}

        {/* Live transcript */}
        {hasTranscript && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
              Transcript · {wordCount(sermonTranscript)} words
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, padding: '6px 8px',
              background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--border)',
              maxHeight: 80, overflowY: 'auto', wordBreak: 'break-word',
            }}>
              {sermonTranscript}
              {sermonInterim && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> {sermonInterim}</span>}
            </div>
          </div>
        )}

        {/* Detected references */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
            <span>Detected References</span>
            {sermonReferences.length > 0 && <span style={{ color: 'var(--accent)' }}>{sermonReferences.length}</span>}
          </div>
          {sermonReferences.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: '6px 0' }}>
              {sermonListening ? 'Listening for references…' : 'No references yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sermonReferences.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)' }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{r.reference}</span>
                  <button onClick={() => handleAddToSchedule(r.reference)} style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600 }}>＋</button>
                  <button onClick={() => sendAsLT(r.reference)} style={{ background: 'transparent', border: '1px solid rgba(79,142,247,0.4)', color: 'var(--accent)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)' }}>→ LT</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI verse suggestions */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Verse Suggestions</span>
            <span style={{ fontSize: 8, color: '#a855f7', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>Claude</span>
            {sermonSuggesting && <span style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic' }}>updating…</span>}
          </div>
          {!hasApiKey ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '7px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', lineHeight: 1.6 }}>
              Add an Anthropic API key in <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → API Keys</strong>.
            </div>
          ) : (
            <>
              <button
                onClick={() => askClaude(true)}
                disabled={!hasTranscript || sermonSuggesting}
                style={{ width: '100%', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', borderRadius: 7, padding: '6px', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, marginBottom: 6, opacity: (!hasTranscript || sermonSuggesting) ? 0.5 : 1 }}
              >{sermonSuggesting ? '✦ Asking Claude…' : '✦ Suggest Now'}</button>
              {aiError && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 5 }}>{aiError}</div>}
              {sermonSuggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {sermonSuggestions.map((s, i) => (
                    <div key={`${s.reference}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 5, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#a855f7' }}>{s.reference}</div>
                        {s.reason && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{s.reason}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                        <button onClick={() => handleAddToSchedule(s.reference)} style={{ background: '#a855f7', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600 }}>＋</button>
                        <button onClick={() => sendAsLT(s.reference)} style={{ background: 'transparent', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)' }}>→ LT</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sermonSuggestions.length === 0 && !sermonSuggesting && hasTranscript && !aiError && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '4px 0' }}>
                  {autoSuggest ? `Auto-suggest after ~${AUTO_SUGGEST_WORDS} new words.` : 'Click "Suggest Now".'}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '5px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            🔒 Transcript sent to Anthropic only when suggestions are generated. No audio stored.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main StreamPanel ──────────────────────────────────────────────────────────
export default function StreamPanel() {
  const {
    streamOpen, openStream, closeStream,
    lowerThird, pushLowerThird, sendStreamConfig,
    currentItem, currentSlide,
    isBlackout, toggleBlackout,
    settings, saveSettings, ffmpegAvailable, isElectron,
  } = useApp();

  const [previewStream, setPreviewStream] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [activeStreamDeviceId, setActiveStreamDeviceId] = useState(null);
  const [ltText, setLtText] = useState('');
  const [ltLabel, setLtLabel] = useState('');
  const [ltSource, setLtSource] = useState('');
  const previewRef = useRef(null);

  // ── Social / RTMP streaming state ───────────────────────────────────────
  const [isRtmpStreaming, setIsRtmpStreaming] = useState(false);
  const [rtmpStatus, setRtmpStatus] = useState({});
  const [rtmpError, setRtmpError] = useState('');
  const recorderRef = useRef(null);
  const captureStreamRef = useRef(null);
  const rtmpDurationRef = useRef(null);
  const [rtmpElapsed, setRtmpElapsed] = useState(0);
  const destinations = useMemo(() => settings?.rtmpDestinations || [], [settings?.rtmpDestinations]);

  const cameraDeviceId = settings?.preferredCameraId || '';

  // ── Auto-start camera preview using preferred device from settings ───────
  useEffect(() => {
    let active = true;
    if (!cameraDeviceId) { setPreviewStream(null); return; }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraDeviceId } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        setPreviewStream(stream);
        setPreviewError('');
      } catch (err) {
        if (!active) return;
        setPreviewError(
          err.name === 'NotAllowedError'
            ? 'Camera access denied — grant it in ⚙ Settings → Devices'
            : err.name === 'NotFoundError'
              ? 'Camera not found — check ⚙ Settings → Devices'
              : 'Preview unavailable: ' + (err.message || err.name)
        );
      }
    })();
    return () => { active = false; };
  }, [cameraDeviceId]);

  // Attach preview stream to video element
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = previewStream || null;
    return () => { if (previewStream) previewStream.getTracks().forEach(t => t.stop()); };
  }, [previewStream]);

  const handleUseCamera = () => {
    sendStreamConfig({ cameraDeviceId: cameraDeviceId || null });
    setActiveStreamDeviceId(cameraDeviceId || null);
    if (cameraDeviceId) saveSettings({ preferredCameraId: cameraDeviceId });
  };

  const handleStopCamera = () => {
    sendStreamConfig({ cameraDeviceId: null });
    setActiveStreamDeviceId(null);
  };

  // ── Lower-third helpers ─────────────────────────────────────────────────
  const sendLowerThird = () => {
    if (!ltText.trim()) return;
    pushLowerThird({ active: true, text: ltText.trim(), label: ltLabel.trim(), source: ltSource.trim() });
  };
  const clearLowerThird = () => pushLowerThird({ active: false, text: '', label: '', source: '' });
  const sendSlideAsLowerThird = () => {
    if (!currentSlide) return;
    const raw = currentSlide.lines || '';
    const textPart = raw.split('\n\n—')[0].trim();
    const attrMatch = raw.match(/— (.+)$/m);
    const source = attrMatch ? attrMatch[1].trim() : '';
    const label = currentItem?.title || currentSlide.label || '';
    pushLowerThird({ active: true, text: textPart, label, source });
    setLtText(textPart); setLtLabel(label); setLtSource(source);
  };

  useEffect(() => { if (!streamOpen) setActiveStreamDeviceId(null); }, [streamOpen]);

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

  const startSocialStream = useCallback(async () => {
    if (!isElectron) return;
    setRtmpError('');
    const activeDests = destinations.filter(d => d.enabled && d.streamKey.trim());
    if (activeDests.length === 0) { setRtmpError('No destinations configured. Add a platform with a stream key.'); return; }
    if (!streamOpen) { setRtmpError('Open the Stream Window first.'); return; }
    try {
      const sources = await window.electronAPI.getStreamSources();
      const streamSrc = sources.find(s => s.name && s.name.includes('Stream View'));
      if (!streamSrc) { setRtmpError('Stream window not found. Make sure it is open.'); return; }
      await window.electronAPI.setRtmpSource(streamSrc.id);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720, frameRate: 30 }, audio: false });
      captureStreamRef.current = stream;
      for (const dest of activeDests) {
        const result = await window.electronAPI.startRtmp({ destId: dest.id, rtmpUrl: dest.rtmpUrl + dest.streamKey });
        if (result?.error) { setRtmpError(result.error === 'ffmpeg_not_found' ? 'FFmpeg not found. Install FFmpeg to enable streaming.' : result.error); return; }
      }
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=h264') ? 'video/webm;codecs=h264' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) e.data.arrayBuffer().then(buf => {
          const chunk = new Uint8Array(buf);
          for (const dest of activeDests) window.electronAPI.sendRtmpChunk(dest.id, chunk);
        });
      };
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); captureStreamRef.current = null; };
      recorder.start(500);
      setIsRtmpStreaming(true); setRtmpElapsed(0);
      rtmpDurationRef.current = setInterval(() => setRtmpElapsed(s => s + 1), 1000);
    } catch (err) { setRtmpError(err.message || 'Failed to start streaming.'); }
  }, [isElectron, destinations, streamOpen]);

  const stopSocialStream = useCallback(async (destId) => {
    if (!isElectron) return;
    if (destId) {
      await window.electronAPI.stopRtmp(destId);
    } else {
      if (recorderRef.current) { try { recorderRef.current.stop(); } catch {} recorderRef.current = null; }
      if (captureStreamRef.current) { captureStreamRef.current.getTracks().forEach(t => t.stop()); captureStreamRef.current = null; }
      clearInterval(rtmpDurationRef.current);
      await window.electronAPI.stopRtmp();
      setIsRtmpStreaming(false); setRtmpStatus({}); setRtmpElapsed(0);
    }
  }, [isElectron]);

  const isLtActive = lowerThird?.active;

  const inputStyle = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 10px',
    fontSize: 12, outline: 'none', fontFamily: 'var(--font)', width: '100%', boxSizing: 'border-box',
  };
  const sectionLabel = { fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 };
  const primaryBtn = { background: 'var(--accent)', border: 'none', color: '#fff', padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)', fontWeight: 500 };
  const ghostBtn = { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)' };

  return (
    <div style={{ width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Stream</span>
        {streamOpen && (
          <span style={{ fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>LIVE</span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Sermon Assistant (primary feature) ───────────────────────── */}
        <SermonSection
          pushLowerThird={pushLowerThird}
          setLtText={setLtText}
          setLtLabel={setLtLabel}
          setLtSource={setLtSource}
        />

        {/* ── Stream window control ─────────────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionLabel}>Stream Window</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            {streamOpen ? 'Window open — screen-share it in Zoom, Teams, or OBS.' : 'Open a dedicated output window, then screen-share it.'}
          </div>
          <button onClick={streamOpen ? closeStream : () => openStream(0)} style={{ ...primaryBtn, background: streamOpen ? 'var(--red)' : 'var(--accent)', width: '100%' }}>
            {streamOpen ? '⏹ Close Stream Window' : '▶ Open Stream Window'}
          </button>
        </div>

        {/* ── Camera (uses preferred device from Settings → Devices) ────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionLabel}>Camera</div>

          {!cameraDeviceId ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 8 }}>
              Set a preferred camera in <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Devices</strong>.
            </div>
          ) : (
            <>
              {/* Preview */}
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 6, overflow: 'hidden', marginBottom: 8, border: '1px solid var(--border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video ref={previewRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: previewStream ? 'block' : 'none' }} />
                {!previewStream && !previewError && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Loading preview…</span>}
                {previewError && <span style={{ fontSize: 10, color: 'var(--red)', textAlign: 'center', padding: 8, lineHeight: 1.5 }}>{previewError}</span>}
                {previewStream && <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: 3 }}>PREVIEW</div>}
              </div>

              {activeStreamDeviceId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 5, marginBottom: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <span style={{ fontSize: 10, color: 'var(--green)' }}>● Camera live on stream</span>
                  <button onClick={handleStopCamera} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)' }}>Stop</button>
                </div>
              )}

              <button onClick={handleUseCamera} disabled={!streamOpen} style={{ ...primaryBtn, width: '100%', opacity: !streamOpen ? 0.45 : 1, cursor: !streamOpen ? 'not-allowed' : 'pointer' }} title={!streamOpen ? 'Open the stream window first' : ''}>
                {activeStreamDeviceId ? 'Restart Camera Source' : 'Send Camera to Stream'}
              </button>
              {!streamOpen && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 5 }}>Open the stream window first.</div>}
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
                Change camera in <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Devices</strong>.
              </div>
            </>
          )}
        </div>

        {/* ── Lower-third ───────────────────────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={sectionLabel}>Lower-Third Overlay</div>
            {isLtActive && <span style={{ fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>ON AIR</span>}
          </div>

          {currentSlide && (
            <div style={{ padding: '7px 10px', borderRadius: 5, marginBottom: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Current slide</div>
              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{currentItem?.title}</span>
                {currentSlide.label && <span style={{ color: 'var(--text-muted)' }}> — {currentSlide.label}</span>}
              </div>
              <button onClick={sendSlideAsLowerThird} style={{ ...primaryBtn, fontSize: 11, padding: '4px 10px' }}>Send as Lower-Third</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={ltLabel} onChange={e => setLtLabel(e.target.value)} placeholder='Label (e.g. John 3:16 · Speaker Name)' style={inputStyle} />
            <textarea value={ltText} onChange={e => setLtText(e.target.value)} placeholder='Lower-third text…' rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            <input value={ltSource} onChange={e => setLtSource(e.target.value)} placeholder='Source line (e.g. NIV, Pastor Name)' style={inputStyle} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={clearLowerThird} style={{ ...ghostBtn, flex: 1 }} disabled={!isLtActive}>Clear</button>
              <button onClick={sendLowerThird} style={{ ...primaryBtn, flex: 2, background: '#166534', border: '1px solid rgba(34,197,94,0.3)', color: '#a7f3d0', opacity: ltText.trim() ? 1 : 0.45, cursor: ltText.trim() ? 'pointer' : 'not-allowed' }} disabled={!ltText.trim()}>
                Send Lower-Third
              </button>
            </div>
          </div>
        </div>

        {/* ── Stream controls ──────────────────────────────────────────── */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={sectionLabel}>Stream Controls</div>
          <button onClick={toggleBlackout} style={{ ...ghostBtn, width: '100%', background: isBlackout ? '#222' : 'transparent', color: isBlackout ? '#fff' : 'var(--text-muted)', border: isBlackout ? '1px solid #555' : '1px solid var(--border)' }}>
            ⬛ {isBlackout ? 'Remove Blackout' : 'Blackout Stream'}
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>Blackout hides all content on the stream window instantly.</div>
        </div>

        {/* ── Social Media Streaming (RTMP) ─────────────────────────────── */}
        {isElectron && (
          <div style={{ padding: '10px 12px' }}>
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
                ⚠ FFmpeg not found — configure in ⚙ Settings → Social Media
              </div>
            )}
            {rtmpError && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 8, padding: '5px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)' }}>{rtmpError}</div>
            )}

            {destinations.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 8 }}>
                No streaming destinations configured.<br />
                Go to <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Social Media</strong> to add Facebook, YouTube, or a custom RTMP endpoint.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                {destinations.filter(d => d.enabled).map(dest => {
                  const color = PLATFORM_COLORS[dest.platform] || '#888';
                  const icon = PLATFORM_ICONS[dest.platform] || '📡';
                  const status = rtmpStatus[dest.id];
                  const isLive = isRtmpStreaming && (status?.type === 'progress' || !status);
                  return (
                    <div key={dest.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: isLive ? color + '18' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLive ? color + '55' : 'var(--border)'}` }}>
                      <span style={{ fontSize: 13 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text)' }}>{dest.name}</span>
                      {isLive && status?.bitrate > 0 && <span style={{ fontSize: 9, color, fontWeight: 700 }}>{Math.round(status.bitrate)}k</span>}
                      {isLive && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>LIVE</span>}
                    </div>
                  );
                })}
                {destinations.filter(d => !d.enabled).length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{destinations.filter(d => !d.enabled).length} destination(s) disabled — enable in ⚙ Settings → Social Media</div>
                )}
              </div>
            )}

            {destinations.length > 0 && (
              isRtmpStreaming ? (
                <button onClick={() => stopSocialStream()} style={{ ...primaryBtn, width: '100%', background: 'var(--red)' }}>⏹ Stop Social Streaming</button>
              ) : (
                <button onClick={startSocialStream}
                  disabled={ffmpegAvailable === false || !streamOpen || destinations.filter(d => d.enabled && d.streamKey?.trim()).length === 0}
                  style={{ ...primaryBtn, width: '100%', background: 'linear-gradient(135deg, #1877F2 0%, #FF0000 50%, #E1306C 100%)', opacity: (ffmpegAvailable === false || !streamOpen || destinations.filter(d => d.enabled && d.streamKey?.trim()).length === 0) ? 0.45 : 1 }}
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

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

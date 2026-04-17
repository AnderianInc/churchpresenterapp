import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { detectReferences } from '../utils/referenceDetector';

const MAX_TRANSCRIPT_CHARS = 3000;
const AUTO_SUGGEST_MIN_NEW_CHARS = 250;
const AUTO_SUGGEST_COOLDOWN_MS = 35000;

function mergeRefs(existing, incoming) {
  const seen = new Set(existing.map(r => r.reference));
  return [...existing, ...incoming.filter(r => !seen.has(r.reference))];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ active }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: active ? '#22c55e' : '#555',
      boxShadow: active ? '0 0 6px #22c55e' : 'none',
      marginRight: 5,
      animation: active ? 'pulse 1.5s infinite' : 'none',
    }} />
  );
}

/** Animated bar-graph mic level indicator */
function MicMeter({ level }) {
  const BARS = 14;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 18, flexShrink: 0 }}>
      {Array.from({ length: BARS }).map((_, i) => {
        const threshold = (i / BARS) * 100;
        const active = level > threshold;
        const color = i >= 11 ? '#ef4444' : i >= 8 ? '#f59e0b' : '#22c55e';
        return (
          <div key={i} style={{
            width: 3,
            height: `${Math.round(5 + (i / BARS) * 13)}px`,
            background: active ? color : 'rgba(255,255,255,0.08)',
            borderRadius: 1,
            transition: 'background 0.04s',
          }} />
        );
      })}
    </div>
  );
}

function RefCard({ ref: r, onAddToSchedule, onSendLowerThird, streamOpen }) {
  return (
    <div style={{
      borderRadius: 6, border: '1px solid var(--border)',
      background: 'rgba(79,142,247,0.06)', padding: '7px 10px',
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
        {r.reference}
      </div>
      <button
        onClick={() => onAddToSchedule(r.reference)}
        title="Add to schedule"
        style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
          fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
        }}
      >＋ Add</button>
      <button
        onClick={() => onSendLowerThird(r.reference)}
        title={streamOpen ? 'Send to stream as lower-third' : 'Send as lower-third'}
        style={{
          background: streamOpen ? 'rgba(34,197,94,0.12)' : 'transparent',
          border: `1px solid ${streamOpen ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`,
          color: streamOpen ? '#22c55e' : 'var(--text-dim)',
          borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
          fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0,
        }}
      >{streamOpen ? '▶ Stream' : 'LT'}</button>
    </div>
  );
}

function SuggestionCard({ suggestion, onAddToSchedule, onSendLowerThird, streamOpen }) {
  return (
    <div style={{
      borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)',
      background: 'rgba(168,85,247,0.06)', padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: suggestion.reason ? 4 : 0 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#a855f7' }}>{suggestion.reference}</span>
        <button
          onClick={() => onAddToSchedule(suggestion.reference)}
          style={{
            background: '#a855f7', border: 'none', color: '#fff',
            borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
            fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
          }}
        >＋ Add</button>
        <button
          onClick={() => onSendLowerThird(suggestion.reference)}
          title={streamOpen ? 'Send to stream as lower-third' : 'Send as lower-third'}
          style={{
            background: streamOpen ? 'rgba(34,197,94,0.12)' : 'transparent',
            border: `1px solid ${streamOpen ? 'rgba(34,197,94,0.35)' : 'rgba(168,85,247,0.3)'}`,
            color: streamOpen ? '#22c55e' : 'var(--text-dim)',
            borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
            fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0,
          }}
        >{streamOpen ? '▶ Stream' : 'LT'}</button>
      </div>
      {suggestion.reason && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>{suggestion.reason}</div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SermonAssistPanel() {
  const {
    settings, addToSchedule, pushLowerThird,
    streamOpen, openStream, closeStream,
  } = useApp();
  const hasApiKey = !!(settings?.anthropicApiKey?.trim());

  // ── Speech recognition ───────────────────────────────────────────────────
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState('');

  // ── Mic monitoring ───────────────────────────────────────────────────────
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const levelAnimRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micDeviceName, setMicDeviceName] = useState('');
  const [micDevices, setMicDevices] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');

  // ── References + AI ──────────────────────────────────────────────────────
  const [references, setReferences] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const lastAiTranscriptRef = useRef('');

  // ── Auto-suggest ─────────────────────────────────────────────────────────
  const [autoSuggest, setAutoSuggest] = useState(false);
  const lastAutoSuggestAtRef = useRef(0);
  const lastSuggestCharsRef = useRef(0);

  // ── Init: check speech API + enumerate audio devices ────────────────────
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setSpeechSupported(false);
    }
    navigator.mediaDevices.enumerateDevices()
      .then(all => {
        const inputs = all.filter(d => d.kind === 'audioinput');
        setMicDevices(inputs);
        if (inputs.length > 0 && !selectedMicId) setSelectedMicId(inputs[0].deviceId || 'default');
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect references on every transcript/interim change
  useEffect(() => {
    if (!transcript && !interimText) return;
    const detected = detectReferences(transcript + ' ' + interimText);
    setReferences(prev => mergeRefs(prev, detected));
  }, [transcript, interimText]);

  // ── Mic level monitor (Web Audio AnalyserNode) ───────────────────────────

  const startMicMonitor = useCallback(async (deviceId) => {
    try {
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      // Device name + re-enumerate with labels now that permission is granted
      const track = stream.getAudioTracks()[0];
      setMicDeviceName(track?.label || 'Microphone');
      const all = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(all.filter(d => d.kind === 'audioinput'));

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      function animate() {
        levelAnimRef.current = requestAnimationFrame(animate);
        analyser.getByteFrequencyData(data);
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        setMicLevel(Math.min(100, (rms / 55) * 100));
      }
      animate();
    } catch {
      // Non-fatal; the speech recognition error handler surfaces mic errors.
    }
  }, []);

  const stopMicMonitor = useCallback(() => {
    if (levelAnimRef.current) { cancelAnimationFrame(levelAnimRef.current); levelAnimRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    analyserRef.current = null;
    setMicLevel(0);
    setMicDeviceName('');
  }, []);

  // ── Speech recognition control ───────────────────────────────────────────

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }
    setMicError('');
    startMicMonitor(selectedMicId);

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
          setTranscript(prev => {
            const updated = (prev + ' ' + r[0].transcript).trim();
            return updated.length > MAX_TRANSCRIPT_CHARS ? updated.slice(-MAX_TRANSCRIPT_CHARS) : updated;
          });
          setInterimText('');
        } else {
          interim += r[0].transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('Microphone access denied. Allow mic access in your OS/browser privacy settings.');
        stopListeningFn();
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setMicError(`Speech error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [selectedMicId, startMicMonitor]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopListeningFn = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    stopMicMonitor();
    setIsListening(false);
    setInterimText('');
  }, [stopMicMonitor]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListeningFn(); else startListening();
  }, [isListening, startListening, stopListeningFn]);

  useEffect(() => () => stopListeningFn(), [stopListeningFn]);

  // ── AI suggestions ───────────────────────────────────────────────────────

  const askClaude = useCallback(async () => {
    if (!hasApiKey || !transcript.trim() || loadingAI) return;
    if (transcript === lastAiTranscriptRef.current) return;
    setLoadingAI(true);
    setAiError('');
    try {
      const result = await window.electronAPI.suggestVerses({
        transcript: transcript.slice(-1500),
        apiKey: settings.anthropicApiKey,
      });
      setSuggestions(result || []);
      lastAiTranscriptRef.current = transcript;
      lastAutoSuggestAtRef.current = Date.now();
      lastSuggestCharsRef.current = transcript.length;
    } catch (e) {
      setAiError(e.message || 'Failed to get suggestions');
    } finally {
      setLoadingAI(false);
    }
  }, [hasApiKey, transcript, loadingAI, settings?.anthropicApiKey]);

  // Auto-suggest: fires when enough new content has accumulated + cooldown elapsed
  useEffect(() => {
    if (!autoSuggest || !isListening || !hasApiKey || loadingAI) return;
    const newChars = transcript.length - lastSuggestCharsRef.current;
    const elapsed = Date.now() - lastAutoSuggestAtRef.current;
    if (newChars >= AUTO_SUGGEST_MIN_NEW_CHARS && elapsed >= AUTO_SUGGEST_COOLDOWN_MS) {
      askClaude();
    }
  }, [transcript, autoSuggest, isListening, hasApiKey, loadingAI, askClaude]);

  // ── Schedule / lower-third actions ───────────────────────────────────────

  const handleAddToSchedule = useCallback((reference) => {
    addToSchedule({
      type: 'scripture', title: reference,
      slides: [{ id: `ref-${Date.now()}`, type: 'verse', label: reference, lines: reference }],
    });
  }, [addToSchedule]);

  const handleSendLowerThird = useCallback((reference) => {
    pushLowerThird({ active: true, label: 'Scripture', text: reference, source: '' });
  }, [pushLowerThird]);

  const clearSession = useCallback(() => {
    setTranscript('');
    setInterimText('');
    setReferences([]);
    setSuggestions([]);
    lastAiTranscriptRef.current = '';
    lastSuggestCharsRef.current = 0;
    lastAutoSuggestAtRef.current = 0;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const fullText = transcript + (interimText ? ' ' + interimText : '');
  const hasTranscript = fullText.trim().length > 0;

  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot active={isListening} />
            Sermon + Stream
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
            color: streamOpen ? '#22c55e' : 'var(--text-dim)',
            background: streamOpen ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${streamOpen ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            borderRadius: 4, padding: '2px 7px',
          }}>
            {streamOpen ? '● LIVE' : '○ Stream Off'}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {isListening ? 'Listening — references detected in real time' : 'Start mic to detect sermon content live'}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Mic + Stream controls ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Mic device selector (only shown after permission granted) */}
          {micDevices.length > 1 && (
            <select
              value={selectedMicId}
              onChange={e => setSelectedMicId(e.target.value)}
              disabled={isListening}
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text)', borderRadius: 'var(--radius)', padding: '5px 8px',
                fontSize: 11, fontFamily: 'var(--font)', cursor: isListening ? 'default' : 'pointer',
                width: '100%', opacity: isListening ? 0.6 : 1,
              }}
            >
              {micDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
                </option>
              ))}
            </select>
          )}

          {/* Action row */}
          <div style={{ display: 'flex', gap: 6 }}>
            {!speechSupported ? (
              <div style={{
                flex: 1, fontSize: 11, color: 'var(--orange)', padding: '8px 10px',
                borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
              }}>
                Speech recognition unavailable in this browser/version.
              </div>
            ) : (
              <button
                onClick={toggleListening}
                style={{
                  flex: 1,
                  background: isListening ? 'rgba(239,68,68,0.12)' : 'rgba(79,142,247,0.12)',
                  border: `1px solid ${isListening ? 'rgba(239,68,68,0.4)' : 'rgba(79,142,247,0.3)'}`,
                  color: isListening ? '#ef4444' : 'var(--accent)',
                  borderRadius: 7, padding: '8px 10px',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)', fontWeight: 600,
                }}
              >
                {isListening ? '⏹ Stop Mic' : '🎙 Start Mic'}
              </button>
            )}
            <button
              onClick={() => streamOpen ? closeStream() : openStream()}
              title={streamOpen ? 'Close stream window' : 'Open stream window'}
              style={{
                flexShrink: 0,
                background: streamOpen ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${streamOpen ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                color: streamOpen ? '#ef4444' : '#22c55e',
                borderRadius: 7, padding: '8px 10px',
                cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600,
              }}
            >
              {streamOpen ? 'End Stream' : 'Go Live'}
            </button>
            {hasTranscript && (
              <button
                onClick={clearSession}
                title="Clear transcript, references and suggestions"
                style={{
                  flexShrink: 0,
                  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
                  borderRadius: 6, padding: '8px 9px', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
                }}
              >✕</button>
            )}
          </div>

          {/* Mic level meter */}
          {isListening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MicMeter level={micLevel} />
              <span style={{
                fontSize: 9, color: micLevel > 5 ? 'var(--text-dim)' : 'var(--red)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {micLevel > 5
                  ? (micDeviceName || 'Microphone active')
                  : 'No signal — check mic connection'}
              </span>
            </div>
          )}

          {micError && (
            <div style={{ fontSize: 10, color: 'var(--red)', lineHeight: 1.5, padding: '4px 0' }}>
              {micError}
            </div>
          )}
        </div>

        {/* ── Live transcript ────────────────────────────────────────────── */}
        {hasTranscript && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
            }}>
              Live Transcript
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7,
              padding: '8px 10px', background: 'rgba(255,255,255,0.02)',
              borderRadius: 6, border: '1px solid var(--border)',
              maxHeight: 100, overflowY: 'auto', wordBreak: 'break-word',
            }}>
              {transcript}
              {interimText && (
                <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> {interimText}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Detected references ────────────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Detected References</span>
            {references.length > 0 && (
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{references.length}</span>
            )}
          </div>
          {references.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0', textAlign: 'center' }}>
              {isListening ? 'References appear as they are spoken…' : 'No references detected yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {references.map(r => (
                <RefCard
                  key={r.id}
                  ref={r}
                  onAddToSchedule={handleAddToSchedule}
                  onSendLowerThird={handleSendLowerThird}
                  streamOpen={streamOpen}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── AI verse suggestions ───────────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>AI Verse Suggestions</span>
            <span style={{
              fontSize: 8, color: '#a855f7',
              background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
              borderRadius: 3, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
            }}>Claude</span>
            {hasApiKey && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
                cursor: 'pointer', fontSize: 9,
                color: autoSuggest ? '#a855f7' : 'var(--text-dim)',
              }}>
                <input
                  type="checkbox"
                  checked={autoSuggest}
                  onChange={e => setAutoSuggest(e.target.checked)}
                  style={{ accentColor: '#a855f7', width: 11, height: 11, cursor: 'pointer' }}
                />
                Auto
              </label>
            )}
          </div>

          {!hasApiKey ? (
            <div style={{
              fontSize: 11, color: 'var(--text-dim)', padding: '8px 10px',
              borderRadius: 6, background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)', lineHeight: 1.6,
            }}>
              Add an Anthropic API key in{' '}
              <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → AI</strong>{' '}
              to enable live verse suggestions.
            </div>
          ) : (
            <>
              {!autoSuggest && (
                <button
                  onClick={askClaude}
                  disabled={!hasTranscript || loadingAI}
                  style={{
                    width: '100%', background: loadingAI ? 'rgba(168,85,247,0.06)' : 'rgba(168,85,247,0.1)',
                    border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7',
                    borderRadius: 7, padding: '7px', cursor: (!hasTranscript || loadingAI) ? 'default' : 'pointer',
                    fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, marginBottom: 7,
                    opacity: (!hasTranscript || loadingAI) ? 0.5 : 1,
                  }}
                >
                  {loadingAI ? '✦ Asking Claude…' : '✦ Suggest Verses from Sermon'}
                </button>
              )}
              {autoSuggest && (
                <div style={{
                  fontSize: 10, color: loadingAI ? '#a855f7' : 'var(--text-dim)',
                  marginBottom: 7, padding: '5px 8px',
                  background: 'rgba(168,85,247,0.05)', borderRadius: 5,
                  border: '1px solid rgba(168,85,247,0.15)',
                }}>
                  {loadingAI
                    ? '✦ Asking Claude for verse suggestions…'
                    : hasTranscript
                      ? 'Auto-suggesting as sermon content grows'
                      : 'Waiting for sermon audio…'}
                </div>
              )}
              {aiError && (
                <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6, lineHeight: 1.5 }}>{aiError}</div>
              )}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {suggestions.map((s, i) => (
                    <SuggestionCard
                      key={`${s.reference}-${i}`}
                      suggestion={s}
                      onAddToSchedule={handleAddToSchedule}
                      onSendLowerThird={handleSendLowerThird}
                      streamOpen={streamOpen}
                    />
                  ))}
                </div>
              )}
              {suggestions.length === 0 && !loadingAI && hasTranscript && !aiError && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: '6px 0' }}>
                  {autoSuggest
                    ? 'Suggestions will appear as more sermon content accumulates.'
                    : 'Click "Suggest Verses" after some content has been transcribed.'}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Privacy notice ─────────────────────────────────────────────── */}
        <div style={{
          padding: '7px 9px', borderRadius: 6,
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            🔒 <strong style={{ color: 'var(--text-muted)' }}>Privacy:</strong>{' '}
            Mic capture is opt-in and local. Sermon transcript is sent to Anthropic's API
            only when verse suggestions are triggered. No audio is stored or recorded.
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

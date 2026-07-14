import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { detectReferences } from '../utils/referenceDetector';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TRANSCRIPT_CHARS = 4000;
const AUTO_SUGGEST_WORDS = 40;   // min new words since last call to fire auto-suggest
const AUTO_SUGGEST_DELAY = 45000; // ms debounce after speech stops

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function mergeRefs(existing, incoming) {
  const seen = new Set(existing.map(r => r.reference));
  return [...existing, ...incoming.filter(r => !seen.has(r.reference))];
}

// ── Mic level meter (12 animated bars) ───────────────────────────────────────

function LevelMeter({ level, active }) {
  return (
    <div style={{ display: 'flex', gap: 2, height: 16, alignItems: 'flex-end', flex: 1 }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const threshold = (i / 14) * 100;
        const lit = active && level > threshold;
        const isHigh = i > 10;
        const isMid = i > 7;
        return (
          <div key={i} style={{
            flex: 1,
            height: lit ? `${60 + (i / 14) * 40}%` : '20%',
            background: isHigh ? '#ef4444' : isMid ? '#eab308' : '#22c55e',
            opacity: lit ? 1 : 0.18,
            borderRadius: 2,
            transition: 'height 60ms linear, opacity 60ms',
          }} />
        );
      })}
    </div>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, onAddToSchedule, onSendLowerThird }) {
  return (
    <div style={{
      borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)',
      background: 'rgba(168,85,247,0.06)', padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', flex: 1 }}>{suggestion.reference}</span>
        <button onClick={() => onAddToSchedule(suggestion.reference)} style={{
          background: '#a855f7', border: 'none', color: '#fff',
          borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
          fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600,
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >＋</button>
        <button onClick={() => onSendLowerThird(suggestion.reference)} style={{
          background: 'transparent', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7',
          borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >LT</button>
      </div>
      {suggestion.reason && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>{suggestion.reason}</div>
      )}
    </div>
  );
}

// ── Ref card ──────────────────────────────────────────────────────────────────

function RefCard({ r, onAddToSchedule, onSendLowerThird }) {
  return (
    <div style={{
      borderRadius: 6, border: '1px solid var(--border)',
      background: 'rgba(79,142,247,0.06)', padding: '7px 10px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{r.reference}</div>
      <button onClick={() => onAddToSchedule(r.reference)} style={{
        background: 'var(--accent)', border: 'none', color: '#fff',
        borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
        fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600,
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >＋ Add</button>
      <button onClick={() => onSendLowerThird(r.reference)} style={{
        background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
        borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
      >LT</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SermonAssistPanel() {
  const {
    settings, addToSchedule, pushLowerThird,
    sermonTranscript, setSermonTranscript,
    sermonInterim, setSermonInterim,
    sermonReferences, setSermonReferences,
    sermonSuggestions, setSermonSuggestions,
    sermonListening, setSermonListening,
    sermonSuggesting, setSermonSuggesting,
    clearSermon,
  } = useApp();

  const hasApiKey = !!(settings?.anthropicApiKey?.trim());

  // ── Speech recognition ───────────────────────────────────────────────────
  const recognitionRef = useRef(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState('');

  // ── Mic level meter ──────────────────────────────────────────────────────
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);

  // ── Auto-suggest ─────────────────────────────────────────────────────────
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [aiError, setAiError] = useState('');
  const autoTimerRef = useRef(null);
  const lastSuggestWordsRef = useRef(0);
  const networkErrRef = useRef(0);

  // ── Check speech API support ─────────────────────────────────────────────
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // ── Detect references on transcript change ───────────────────────────────
  useEffect(() => {
    if (!sermonTranscript && !sermonInterim) return;
    const detected = detectReferences(sermonTranscript + ' ' + sermonInterim);
    setSermonReferences(prev => mergeRefs(prev, detected));
  }, [sermonTranscript, sermonInterim, setSermonReferences]);

  // ── Mic audio level capture ───────────────────────────────────────────────

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setMicLevel(0);
  }, []);

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
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setMicLevel(Math.min(100, avg * 2.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Level meter fails gracefully — speech recognition still works
    }
  }, [stopLevelMeter]);


  // ── Ask Claude ────────────────────────────────────────────────────────────

  const askClaude = useCallback(async (manual = false) => {
    if (!hasApiKey || !sermonTranscript.trim() || sermonSuggesting) return;
    const currentWords = wordCount(sermonTranscript);
    if (!manual && currentWords - lastSuggestWordsRef.current < AUTO_SUGGEST_WORDS) return;

    setSermonSuggesting(true);
    setAiError('');
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

  // ── Auto-suggest debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!autoSuggest || !hasApiKey || !sermonListening || !sermonTranscript.trim()) return;
    clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => askClaude(false), AUTO_SUGGEST_DELAY);
    return () => clearTimeout(autoTimerRef.current);
  }, [sermonTranscript, autoSuggest, hasApiKey, sermonListening, askClaude]);

  // ── Start / stop listening ────────────────────────────────────────────────

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
      networkErrRef.current = 0;
      setMicError('');
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          setSermonTranscript(prev => {
            const updated = (prev + ' ' + r[0].transcript).trim();
            return updated.length > MAX_TRANSCRIPT_CHARS ? updated.slice(-MAX_TRANSCRIPT_CHARS) : updated;
          });
          setSermonInterim('');
        } else {
          interim += r[0].transcript;
        }
      }
      if (interim) setSermonInterim(interim);
    };

    recognition.onend = () => {
      // Auto-restart to handle silence timeout
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('Microphone access denied. Check OS privacy settings.');
        stopListening();
      } else if (e.error === 'network') {
        // Transient — onend will auto-restart. Only surface after repeated failures.
        networkErrRef.current += 1;
        if (networkErrRef.current >= 4) {
          setMicError('Speech service unreachable — check internet connection. Retrying…');
        }
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setMicError(`Speech error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    setSermonListening(true);
    recognition.start();
    startLevelMeter(settings?.preferredMicId || '');
  }, [settings?.preferredMicId, setSermonListening, setSermonTranscript, setSermonInterim, startLevelMeter, stopListening]);

  // Cleanup on unmount
  useEffect(() => () => { stopListening(); stopLevelMeter(); }, [stopListening, stopLevelMeter]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddToSchedule = useCallback((reference) => {
    addToSchedule({
      type: 'scripture', title: reference,
      slides: [{ id: `ref-${Date.now()}`, type: 'verse', label: reference, lines: reference }],
    });
  }, [addToSchedule]);

  const handleSendLowerThird = useCallback((reference) => {
    pushLowerThird({ active: true, label: 'Scripture', text: reference, source: '' });
  }, [pushLowerThird]);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasTranscript = (sermonTranscript + sermonInterim).trim().length > 0;

  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: sermonListening ? '#22c55e' : '#444',
            boxShadow: sermonListening ? '0 0 6px #22c55e' : 'none',
            flexShrink: 0,
            animation: sermonListening ? 'pulse 1.5s infinite' : 'none',
          }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>Sermon Assistant</div>
          {sermonListening && hasApiKey && (
            <div style={{
              fontSize: 9, color: autoSuggest ? '#a855f7' : 'var(--text-dim)',
              background: autoSuggest ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${autoSuggest ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
              borderRadius: 3, padding: '2px 6px', fontWeight: 700, cursor: 'pointer',
              userSelect: 'none',
            }} onClick={() => setAutoSuggest(v => !v)}
              title="Toggle auto verse suggestions">
              AUTO {autoSuggest ? 'ON' : 'OFF'}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
          {sermonListening ? 'Listening — references detected in real time' : 'Start mic to detect Bible references live'}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Mic section ─────────────────────────────────────────────────── */}
        <div>
          {!speechSupported ? (
            <div style={{ fontSize: 11, color: 'var(--orange)', padding: '8px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              Speech recognition is not supported in this environment.
            </div>
          ) : (
            <>
              {/* Level meter + start/stop in one row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <button
                  onClick={sermonListening ? stopListening : startListening}
                  style={{
                    background: sermonListening ? 'rgba(239,68,68,0.12)' : 'rgba(79,142,247,0.12)',
                    border: `1px solid ${sermonListening ? 'rgba(239,68,68,0.4)' : 'rgba(79,142,247,0.3)'}`,
                    color: sermonListening ? '#ef4444' : 'var(--accent)',
                    borderRadius: 7, padding: '8px 12px',
                    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {sermonListening ? '⏹ Stop' : '🎙 Listen'}
                </button>

                {/* Level meter — shows when listening, "verify mic" prompt otherwise */}
                <div style={{ flex: 1 }}>
                  {sermonListening ? (
                    <LevelMeter level={micLevel} active={sermonListening} />
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Level meter shows when active — set preferred mic in <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Devices</strong>
                    </div>
                  )}
                </div>

                {hasTranscript && (
                  <button
                    onClick={() => { clearSermon(); lastSuggestWordsRef.current = 0; setAiError(''); }}
                    title="Clear transcript, references, and suggestions"
                    style={{
                      background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
                      borderRadius: 6, padding: '7px 9px', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                      flexShrink: 0,
                    }}
                  >✕</button>
                )}
              </div>

              {sermonListening && micLevel < 3 && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                  No audio detected — check mic is not muted
                </div>
              )}
            </>
          )}
          {micError && (
            <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 5, lineHeight: 1.5 }}>{micError}</div>
          )}
        </div>

        {/* ── Live transcript ──────────────────────────────────────────────── */}
        {hasTranscript && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>
              Transcript
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, padding: '7px 9px',
              background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--border)',
              maxHeight: 110, overflowY: 'auto', wordBreak: 'break-word',
            }}>
              {sermonTranscript}
              {sermonInterim && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> {sermonInterim}</span>}
            </div>
          </div>
        )}

        {/* ── Detected references ──────────────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Detected References</span>
            {sermonReferences.length > 0 && <span style={{ color: 'var(--accent)' }}>{sermonReferences.length}</span>}
          </div>
          {sermonReferences.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
              {sermonListening ? 'Listening for references…' : 'No references yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sermonReferences.map(r => (
                <RefCard key={r.id} r={r} onAddToSchedule={handleAddToSchedule} onSendLowerThird={handleSendLowerThird} />
              ))}
            </div>
          )}
        </div>

        {/* ── AI suggestions ───────────────────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>Verse Suggestions</span>
            <span style={{ fontSize: 8, color: '#a855f7', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 3, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase' }}>Claude</span>
            {sermonSuggesting && <span style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic' }}>updating…</span>}
          </div>

          {!hasApiKey ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', lineHeight: 1.6 }}>
              Add an Anthropic API key in <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → AI</strong> to enable suggestions.
            </div>
          ) : (
            <>
              {/* Manual trigger — still available alongside auto */}
              <button
                onClick={() => askClaude(true)}
                disabled={!hasTranscript || sermonSuggesting}
                style={{
                  width: '100%', background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7',
                  borderRadius: 7, padding: '7px', cursor: 'pointer', fontFamily: 'var(--font)',
                  fontSize: 11, fontWeight: 600, marginBottom: 6,
                  opacity: (!hasTranscript || sermonSuggesting) ? 0.5 : 1,
                }}
              >
                {sermonSuggesting ? '✦ Asking Claude…' : '✦ Suggest Now'}
              </button>
              {!autoSuggest && hasApiKey && hasTranscript && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.4 }}>
                  Auto-suggest is off. Click AUTO OFF above to enable automatic suggestions every ~45 seconds.
                </div>
              )}
              {aiError && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 5, lineHeight: 1.5 }}>{aiError}</div>}
              {sermonSuggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sermonSuggestions.map((s, i) => (
                    <SuggestionCard
                      key={`${s.reference}-${i}`}
                      suggestion={s}
                      onAddToSchedule={handleAddToSchedule}
                      onSendLowerThird={handleSendLowerThird}
                    />
                  ))}
                </div>
              )}
              {sermonSuggestions.length === 0 && !sermonSuggesting && hasTranscript && !aiError && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: '6px 0' }}>
                  {autoSuggest ? `Auto-suggest fires after ~${Math.round(AUTO_SUGGEST_WORDS / 3)} seconds of new speech.` : 'Click "Suggest Now" to generate suggestions.'}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Privacy + stream integration note ───────────────────────────── */}
        <div style={{ padding: '7px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            🔒 Mic capture is opt-in. Transcript sent to Anthropic only when suggestions are generated. No audio is stored.
            Verse references and suggestions are also accessible in the <strong style={{ color: 'var(--text-muted)' }}>📡 Stream</strong> panel for quick lower-third insertion.
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { detectReferences } from '../utils/referenceDetector';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_TRANSCRIPT_CHARS = 3000; // Rolling transcript window

/** Deduplicate references by their reference string. */
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

function RefCard({ ref: r, onAddToSchedule, onSendLowerThird }) {
  return (
    <div style={{
      borderRadius: 6, border: '1px solid var(--border)',
      background: 'rgba(79,142,247,0.06)', padding: '7px 10px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{r.reference}</div>
      </div>
      <button
        onClick={() => onAddToSchedule(r.reference)}
        title="Add to schedule"
        style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
          fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >＋ Add</button>
      <button
        onClick={() => onSendLowerThird(r.reference)}
        title="Send as lower-third"
        style={{
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
          borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
          fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
      >LT</button>
    </div>
  );
}

function SuggestionCard({ suggestion, onAddToSchedule, onSendLowerThird }) {
  return (
    <div style={{
      borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)',
      background: 'rgba(168,85,247,0.06)', padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>{suggestion.reference}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onAddToSchedule(suggestion.reference)}
          title="Add to schedule"
          style={{
            background: '#a855f7', border: 'none', color: '#fff',
            borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
            fontSize: 10, fontFamily: 'var(--font)', fontWeight: 600,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >＋ Add</button>
        <button
          onClick={() => onSendLowerThird(suggestion.reference)}
          title="Send as lower-third"
          style={{
            background: 'transparent', border: '1px solid rgba(168,85,247,0.3)', color: 'var(--text-dim)',
            borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
            fontSize: 10, fontFamily: 'var(--font)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >LT</button>
      </div>
      {suggestion.reason && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>{suggestion.reason}</div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SermonAssistPanel() {
  const { settings, addToSchedule, pushLowerThird } = useApp();
  const hasApiKey = !!(settings?.anthropicApiKey?.trim());

  // ── Speech recognition state ─────────────────────────────────────────────
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState('');

  // ── References + AI state ────────────────────────────────────────────────
  const [references, setReferences] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lastAiTranscript, setLastAiTranscript] = useState('');

  // Check speech API support on mount
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Detect references whenever transcript or interim text changes
  useEffect(() => {
    if (!transcript && !interimText) return;
    const detected = detectReferences(transcript + ' ' + interimText);
    setReferences(prev => mergeRefs(prev, detected));
  }, [transcript, interimText]);

  // ── Mic control ───────────────────────────────────────────────────────────

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

    // Auto-restart on silence timeout (speech recognition stops after ~60s of no speech)
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('Microphone access denied. Allow mic access in your OS privacy settings.');
        stopListeningFn();
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setMicError(`Speech recognition error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopListeningFn = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListeningFn();
    else startListening();
  }, [isListening, startListening, stopListeningFn]);

  // Stop recognition when unmounting
  useEffect(() => () => stopListeningFn(), [stopListeningFn]);

  // ── AI suggestions ────────────────────────────────────────────────────────

  const askClaude = useCallback(async () => {
    if (!hasApiKey || !transcript.trim() || loadingAI) return;
    if (transcript === lastAiTranscript) return; // No change since last call

    setLoadingAI(true);
    setAiError('');
    try {
      const result = await window.electronAPI.suggestVerses({
        transcript: transcript.slice(-1500),
        apiKey: settings.anthropicApiKey,
      });
      setSuggestions(result || []);
      setLastAiTranscript(transcript);
    } catch (e) {
      setAiError(e.message || 'Failed to get suggestions');
    } finally {
      setLoadingAI(false);
    }
  }, [hasApiKey, transcript, loadingAI, lastAiTranscript, settings?.anthropicApiKey]);

  // ── Schedule + lower-third actions ───────────────────────────────────────

  const handleAddToSchedule = useCallback((reference) => {
    addToSchedule({
      type: 'scripture',
      title: reference,
      slides: [{
        id: `ref-${Date.now()}`,
        type: 'verse',
        label: reference,
        lines: reference,
      }],
    });
  }, [addToSchedule]);

  const handleSendLowerThird = useCallback((reference) => {
    pushLowerThird({ label: 'Scripture', main: reference, source: '' });
  }, [pushLowerThird]);

  // ── Render ────────────────────────────────────────────────────────────────

  const fullText = transcript + (interimText ? ' ' + interimText : '');
  const hasTranscript = fullText.trim().length > 0;

  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusDot active={isListening} />
          Sermon Assistant
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          {isListening ? 'Listening for scripture references…' : 'Start mic to detect references live'}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Mic control ──────────────────────────────────────────────────── */}
        <div>
          {!speechSupported ? (
            <div style={{ fontSize: 11, color: 'var(--orange)', padding: '8px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              Speech recognition is not available in this browser/Electron version.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={toggleListening}
                style={{
                  flex: 1,
                  background: isListening ? 'rgba(239,68,68,0.12)' : 'rgba(79,142,247,0.12)',
                  border: `1px solid ${isListening ? 'rgba(239,68,68,0.4)' : 'rgba(79,142,247,0.3)'}`,
                  color: isListening ? '#ef4444' : 'var(--accent)',
                  borderRadius: 7, padding: '9px 12px',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)', fontWeight: 600,
                }}
              >
                {isListening ? '⏹ Stop Listening' : '🎙 Start Listening'}
              </button>
              {hasTranscript && (
                <button
                  onClick={() => { setTranscript(''); setInterimText(''); setReferences([]); setSuggestions([]); setLastAiTranscript(''); }}
                  title="Clear transcript and references"
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
                    borderRadius: 6, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
                  }}
                >Clear</button>
              )}
            </div>
          )}
          {micError && (
            <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 6, lineHeight: 1.5 }}>{micError}</div>
          )}
        </div>

        {/* ── Live transcript ───────────────────────────────────────────────── */}
        {hasTranscript && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              Live Transcript
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--border)',
              maxHeight: 120, overflowY: 'auto', wordBreak: 'break-word',
            }}>
              {transcript}
              {interimText && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> {interimText}</span>}
            </div>
          </div>
        )}

        {/* ── Detected references ───────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Detected References</span>
            {references.length > 0 && (
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{references.length}</span>
            )}
          </div>
          {references.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '10px 0', textAlign: 'center' }}>
              {isListening ? 'References will appear here as they are spoken…' : 'No references detected yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {references.map(r => (
                <RefCard
                  key={r.id}
                  ref={r}
                  onAddToSchedule={handleAddToSchedule}
                  onSendLowerThird={handleSendLowerThird}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── AI suggestions ────────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>AI Suggestions</span>
            <span style={{ fontSize: 8, color: '#a855f7', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 3, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Claude</span>
          </div>

          {!hasApiKey ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', lineHeight: 1.6 }}>
              Add an Anthropic API key in{' '}
              <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → AI</strong>{' '}
              to enable thematic verse suggestions.
            </div>
          ) : (
            <>
              <button
                onClick={askClaude}
                disabled={!hasTranscript || loadingAI}
                style={{
                  width: '100%', background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7',
                  borderRadius: 7, padding: '8px', cursor: 'pointer', fontFamily: 'var(--font)',
                  fontSize: 11, fontWeight: 600, marginBottom: 8,
                  opacity: (!hasTranscript || loadingAI) ? 0.5 : 1,
                }}
              >
                {loadingAI ? '✦ Asking Claude…' : '✦ Suggest Verses from Sermon'}
              </button>
              {aiError && (
                <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6, lineHeight: 1.5 }}>{aiError}</div>
              )}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <SuggestionCard
                      key={`${s.reference}-${i}`}
                      suggestion={s}
                      onAddToSchedule={handleAddToSchedule}
                      onSendLowerThird={handleSendLowerThird}
                    />
                  ))}
                </div>
              )}
              {suggestions.length === 0 && !loadingAI && hasTranscript && !aiError && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: '8px 0' }}>
                  Click "Suggest Verses" after some sermon content has been transcribed.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Privacy notice ────────────────────────────────────────────────── */}
        <div style={{ marginTop: 4, padding: '7px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            🔒 <strong style={{ color: 'var(--text-muted)' }}>Privacy:</strong> Microphone capture is opt-in. When AI suggestions are enabled, the sermon transcript is sent to Anthropic's API only when you click "Suggest Verses". No audio is stored or recorded.
          </div>
        </div>

      </div>

      {/* Pulse keyframe — injected inline for simplicity */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

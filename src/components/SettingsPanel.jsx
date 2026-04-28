import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../store/AppContext';
import ExternalLink from './ExternalLink';
import HelpPanel from './HelpPanel';

const PLATFORM_PRESETS = {
  facebook:  { name: 'Facebook Live',   color: '#1877F2', icon: '📘', rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  youtube:   { name: 'YouTube Live',    color: '#FF0000', icon: '▶️',  rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/' },
  instagram: { name: 'Instagram Live',  color: '#E1306C', icon: '📷', rtmpUrl: 'rtmp://live-upload.instagram.com:80/rtmp/' },
  custom:    { name: 'Custom RTMP',     color: '#888',    icon: '📡', rtmpUrl: '' },
};

const FONT_OPTIONS = ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Impact'];

const TABS = [
  { id: 'keys',    label: '🔑 API Keys' },
  { id: 'social',  label: '📡 Social Media' },
  { id: 'devices', label: '🎙 Devices' },
  { id: 'outputs', label: '📺 Outputs' },
  { id: 'help',    label: '❔ Help' },
];

const inputStyle = {
  background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: 12,
  fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const sectionLabel = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10,
};

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={sectionLabel}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function SaveRow({ onSave, saved, disabled, label = 'Save' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <button
        onClick={onSave}
        disabled={disabled}
        style={{
          background: saved ? 'var(--green)' : 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 6, padding: '5px 14px', fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font)', fontWeight: 600, opacity: disabled ? 0.45 : 1,
        }}
      >{saved ? '✓ Saved' : label}</button>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Stored locally only.</div>
    </div>
  );
}

// ── Destination card (RTMP) ───────────────────────────────────────────────────

function DestinationCard({ dest, onUpdate, onRemove }) {
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(!dest.streamKey);
  const preset = PLATFORM_PRESETS[dest.platform] || PLATFORM_PRESETS.custom;
  const hasKey = !!dest.streamKey?.trim();

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
        <input type="checkbox" checked={dest.enabled} onChange={e => onUpdate({ enabled: e.target.checked })}
          style={{ accentColor: preset.color, flexShrink: 0 }} title="Enable this destination" />
        <span style={{ fontSize: 15, flexShrink: 0 }}>{preset.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dest.name}</div>
          <div style={{ fontSize: 10, color: hasKey ? 'var(--green)' : 'var(--text-dim)' }}>{hasKey ? '● Stream key saved' : '⚠ No stream key'}</div>
        </div>
        <button onClick={() => setExpanded(v => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>{expanded ? '▲' : '▼'}</button>
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }} title="Remove">✕</button>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {dest.platform === 'custom' && (
            <>
              <input value={dest.name} onChange={e => onUpdate({ name: e.target.value })} placeholder="Destination name" style={{ ...inputStyle, marginTop: 10 }} />
              <input value={dest.rtmpUrl} onChange={e => onUpdate({ rtmpUrl: e.target.value })} placeholder="rtmp://your-server/live/" style={inputStyle} />
            </>
          )}
          {dest.platform !== 'custom' && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
              RTMP endpoint: <span style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>{preset.rtmpUrl}</span>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
              Stream key <span style={{ color: 'var(--text-dim)' }}>(from {dest.name} live dashboard)</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={showKey ? 'text' : 'password'} value={dest.streamKey}
                onChange={e => onUpdate({ streamKey: e.target.value })}
                placeholder="Paste your stream key here" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => setShowKey(v => !v)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 11 }}>{showKey ? 'Hide' : 'Show'}</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Stored locally only — never sent to any server other than your streaming platform.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Level meter ───────────────────────────────────────────────────────────────

function LevelMeter({ level, active }) {
  return (
    <div style={{ display: 'flex', gap: 2, height: 20, alignItems: 'flex-end', flex: 1 }}>
      {Array.from({ length: 20 }).map((_, i) => {
        const threshold = (i / 20) * 100;
        const lit = active && level > threshold;
        const isHigh = i > 15; const isMid = i > 10;
        return (
          <div key={i} style={{
            flex: 1, height: lit ? `${50 + (i / 20) * 50}%` : '15%',
            background: isHigh ? '#ef4444' : isMid ? '#eab308' : '#22c55e',
            opacity: lit ? 1 : 0.15, borderRadius: 2,
            transition: 'height 50ms linear, opacity 50ms',
          }} />
        );
      })}
    </div>
  );
}

// ── Devices tab (own state for device enumeration) ────────────────────────────

function DevicesTab({ settings, saveSettings }) {
  const [micDevices, setMicDevices] = useState([]);
  const [camDevices, setCamDevices] = useState([]);
  const [micPermission, setMicPermission] = useState('unknown'); // 'granted' | 'denied' | 'unknown'
  const [camPermission, setCamPermission] = useState('unknown');
  const [preferredMicId, setPreferredMicId] = useState(settings?.preferredMicId || '');
  const [preferredCamId, setPreferredCamId] = useState(settings?.preferredCameraId || '');
  const [fontDraft, setFontDraft] = useState(settings?.defaultFont || 'Georgia');
  const [sizeDraft, setSizeDraft] = useState(settings?.defaultFontSize || 44);

  // Mic level test
  const [testActive, setTestActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);

  // Enumerate on mount — labels present means permission already granted
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const mics = devices.filter(d => d.kind === 'audioinput');
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (mics.length > 0 && mics[0].label) setMicPermission('granted');
      if (cams.length > 0 && cams[0].label) setCamPermission('granted');
      setMicDevices(mics);
      setCamDevices(cams);
    }).catch(() => {});
  }, []);

  const grantMicAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(t => t.stop());
      setMicPermission('granted');
      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      if (!preferredMicId && mics.length > 0) {
        setPreferredMicId(mics[0].deviceId);
        saveSettings({ preferredMicId: mics[0].deviceId });
      }
    } catch {
      setMicPermission('denied');
    }
  };

  const grantCamAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(t => t.stop());
      setCamPermission('granted');
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === 'videoinput');
      setCamDevices(cams);
      if (!preferredCamId && cams.length > 0) {
        setPreferredCamId(cams[0].deviceId);
        saveSettings({ preferredCameraId: cams[0].deviceId });
      }
    } catch {
      setCamPermission('denied');
    }
  };

  // Stop mic test on unmount
  useEffect(() => () => stopMicTest(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const startMicTest = async () => {
    stopMicTest();
    try {
      const constraints = { audio: preferredMicId ? { deviceId: { exact: preferredMicId } } : true, video: false };
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
      setTestActive(true);
    } catch { /* level test fails gracefully */ }
  };

  const stopMicTest = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setMicLevel(0);
    setTestActive(false);
  };

  const handleMicChange = (deviceId) => {
    if (testActive) stopMicTest();
    setPreferredMicId(deviceId);
    saveSettings({ preferredMicId: deviceId });
  };

  const handleCamChange = (deviceId) => {
    setPreferredCamId(deviceId);
    saveSettings({ preferredCameraId: deviceId });
  };

  const handleFontChange = (font) => {
    setFontDraft(font);
    saveSettings({ defaultFont: font });
  };

  const handleSizeChange = (size) => {
    setSizeDraft(Number(size));
    saveSettings({ defaultFontSize: Number(size) });
  };

  return (
    <>
      {/* ── Microphone ──────────────────────────────────────────────────── */}
      <Section title="Microphone — Sermon Assistant">
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>🎙</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Preferred Microphone</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Used for the level meter in the Sermon Assistant</div>
            </div>
            {settings?.preferredMicId && (
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>SET</span>
            )}
          </div>

          {micPermission === 'denied' ? (
            <div>
              <div style={{ fontSize: 11, color: 'var(--red)', padding: '6px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 6 }}>
                Microphone access denied. Grant it in <strong>System Settings → Privacy → Microphone</strong>, then click Try Again.
              </div>
              <button onClick={grantMicAccess} style={{ width: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', borderRadius: 6, padding: '6px', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600 }}>
                🔄 Try Again
              </button>
            </div>
          ) : micPermission !== 'granted' ? (
            <button onClick={grantMicAccess} style={{ width: '100%', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.3)', color: 'var(--accent)', borderRadius: 6, padding: '7px', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600 }}>
              Allow Mic Access to Configure
            </button>
          ) : micDevices.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No microphones detected.</div>
          ) : (
            <select value={preferredMicId} onChange={e => handleMicChange(e.target.value)} style={inputStyle}>
              {micDevices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
              ))}
            </select>
          )}

          {/* Mic level test */}
          {micPermission === 'granted' && micDevices.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <button
                  onClick={testActive ? stopMicTest : startMicTest}
                  style={{
                    background: testActive ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${testActive ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.3)'}`,
                    color: testActive ? '#ef4444' : '#22c55e',
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                    fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600, flexShrink: 0,
                  }}
                >{testActive ? '⏹ Stop' : '▶ Test Mic'}</button>
                <LevelMeter level={micLevel} active={testActive} />
              </div>
              {testActive && micLevel < 3 && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>No signal — check mic is not muted</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              The selected mic drives the <strong style={{ color: 'var(--text-muted)' }}>level meter</strong> in the Stream panel.
              Speech recognition always uses your system's default audio input — change that in OS Sound settings.
            </div>
          </div>
        </div>
      </Section>

      {/* ── Camera ──────────────────────────────────────────────────────── */}
      <Section title="Camera — Stream">
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📷</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Preferred Camera</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Pre-selected in the Stream panel on startup</div>
            </div>
            {settings?.preferredCameraId && (
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>SET</span>
            )}
          </div>

          {camPermission === 'denied' ? (
            <div>
              <div style={{ fontSize: 11, color: 'var(--red)', padding: '6px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 6 }}>
                Camera access denied. Grant it in <strong>System Settings → Privacy → Camera</strong>, then click Try Again — no reload needed.
              </div>
              <button onClick={grantCamAccess} style={{ width: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', borderRadius: 6, padding: '6px', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600 }}>
                🔄 Try Again
              </button>
            </div>
          ) : camPermission !== 'granted' ? (
            <button onClick={grantCamAccess} style={{ width: '100%', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.3)', color: 'var(--accent)', borderRadius: 6, padding: '7px', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600 }}>
              Allow Camera Access to Configure
            </button>
          ) : camDevices.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No cameras detected. Start OBS with Virtual Camera enabled and reload.</div>
          ) : (
            <select value={preferredCamId} onChange={e => handleCamChange(e.target.value)} style={inputStyle}>
              {camDevices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
              ))}
            </select>
          )}

          <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              OBS Virtual Camera appears here once OBS is running with Virtual Camera enabled.
              The Stream panel also lets you switch sources live during a service.
            </div>
          </div>
        </div>
      </Section>

      {/* ── Presentation Defaults ────────────────────────────────────────── */}
      <Section title="Presentation Defaults">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Default font</div>
          <select value={fontDraft} onChange={e => handleFontChange(e.target.value)} style={inputStyle}>
            {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default font size</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font)' }}>{sizeDraft}px</span>
          </div>
          <input
            type="range" min={18} max={96} value={sizeDraft}
            onChange={e => setSizeDraft(Number(e.target.value))}
            onMouseUp={e => handleSizeChange(e.target.value)}
            onTouchEnd={e => handleSizeChange(e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            Preview: <span style={{ fontSize: `${Math.round(sizeDraft * 0.28)}px`, fontFamily: fontDraft, color: 'var(--text)' }}>Amazing Grace</span>
          </div>
        </div>
      </Section>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsPanel({ onClose, hideTitle = false, initialTab }) {
  const { settings, saveSettings, ffmpegAvailable, isElectron } = useApp();

  const [activeTab, setActiveTab] = useState(initialTab || 'keys');

  // Sync to initialTab when it changes (e.g. opened via Help button)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // ── API key state ───────────────────────────────────────────────────────
  const [pcoAppId, setPcoAppId] = useState(settings?.pcoAppId || '');
  const [pcoSecret, setPcoSecret] = useState(settings?.pcoSecret || '');
  const [pcoSaved, setPcoSaved] = useState(false);
  const [showPcoSecret, setShowPcoSecret] = useState(false);

  const [anthropicKey, setAnthropicKey] = useState(settings?.anthropicApiKey || '');
  const [anthropicSaved, setAnthropicSaved] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  const [geniusKey, setGeniusKey] = useState(settings?.geniusApiKey || '');
  const [geniusSaved, setGeniusSaved] = useState(false);
  const [showGeniusKey, setShowGeniusKey] = useState(false);

  // ── Social media state ──────────────────────────────────────────────────
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const destinations = useMemo(() => settings?.rtmpDestinations || [], [settings?.rtmpDestinations]);

  // ── API key save handlers ───────────────────────────────────────────────
  const savePco = useCallback(() => {
    saveSettings({ pcoAppId: pcoAppId.trim(), pcoSecret: pcoSecret.trim() });
    setPcoSaved(true); setTimeout(() => setPcoSaved(false), 2000);
  }, [pcoAppId, pcoSecret, saveSettings]);

  const saveAnthropicKey = useCallback(() => {
    saveSettings({ anthropicApiKey: anthropicKey.trim() });
    setAnthropicSaved(true); setTimeout(() => setAnthropicSaved(false), 2000);
  }, [anthropicKey, saveSettings]);

  const saveGeniusKey = useCallback(() => {
    saveSettings({ geniusApiKey: geniusKey.trim() });
    setGeniusSaved(true); setTimeout(() => setGeniusSaved(false), 2000);
  }, [geniusKey, saveSettings]);

  // ── RTMP destination handlers ───────────────────────────────────────────
  const addDestination = useCallback((platform) => {
    const preset = PLATFORM_PRESETS[platform];
    saveSettings({ rtmpDestinations: [...destinations, { id: uuidv4(), platform, name: preset.name, rtmpUrl: preset.rtmpUrl, streamKey: '', enabled: true }] });
    setShowAddPlatform(false);
  }, [destinations, saveSettings]);

  const updateDestination = useCallback((id, changes) => {
    saveSettings({ rtmpDestinations: destinations.map(d => d.id === id ? { ...d, ...changes } : d) });
  }, [destinations, saveSettings]);

  const removeDestination = useCallback((id) => {
    saveSettings({ rtmpDestinations: destinations.filter(d => d.id !== id) });
  }, [destinations, saveSettings]);

  return (
    <div style={{
      width: hideTitle ? '100%' : 320,
      background: 'var(--bg-sidebar)',
      borderLeft: hideTitle ? 'none' : '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      flex: hideTitle ? 1 : undefined,
    }}>

      {/* Header — hidden when rendered inside FloatingWindow (which has its own title bar) */}
      <div style={{ padding: hideTitle ? '8px 14px 0' : '12px 14px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {!hideTitle && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Settings</div>
              {onClose && (
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }} title="Close Settings">✕</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, marginBottom: 10 }}>App preferences and API keys</div>
          </>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, marginBottom: -1 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? 'var(--bg-main)' : 'transparent',
                border: `1px solid ${activeTab === tab.id ? 'var(--border)' : 'transparent'}`,
                borderBottom: activeTab === tab.id ? '1px solid var(--bg-main)' : '1px solid transparent',
                borderRadius: '5px 5px 0 0',
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-dim)',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: activeTab === 'help' ? 'hidden' : 'auto', padding: activeTab === 'help' ? 0 : 14, display: 'flex', flexDirection: 'column' }}>

        {/* ── API Keys tab ──────────────────────────────────────────────── */}
        {activeTab === 'keys' && (
          <>
            <Section title="Bible Search">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>📖</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Bible.helloao.org</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Free online Bible API — no key required</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>READY</span>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    Online reference lookup works with no setup. For <strong style={{ color: 'var(--text)' }}>text (keyword) search</strong> across multiple versions,
                    download a Beblia XML Bible from{' '}
                    <ExternalLink href="https://github.com/Beblia/Holy-Bible-XML-Format">github.com/Beblia/Holy-Bible-XML-Format</ExternalLink>
                    {' '}and import it via the Bible panel (📖 → Translations → Offline → Import XML).
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Lyrics — Genius">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🎵</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Genius Client Access Token</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Enables Genius lyrics search in Song Import</div>
                  </div>
                  {settings?.geniusApiKey && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>SAVED</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type={showGeniusKey ? 'text' : 'password'} value={geniusKey}
                    onChange={e => { setGeniusKey(e.target.value); setGeniusSaved(false); }}
                    onKeyDown={e => e.key === 'Enter' && saveGeniusKey()}
                    placeholder="Paste your Genius Client Access Token" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => setShowGeniusKey(v => !v)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 11 }}>{showGeniusKey ? 'Hide' : 'Show'}</button>
                </div>
                <SaveRow onSave={saveGeniusKey} saved={geniusSaved} disabled={!geniusKey.trim()} label="Save Key" />
                <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.2)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    Get a free token at <ExternalLink href="https://genius.com/api-clients">genius.com/api-clients</ExternalLink> → New API Client → copy the Client Access Token.{' '}
                    <strong style={{ color: 'rgba(255,165,0,0.9)' }}>CCLI:</strong> For internal, non-commercial church use only.
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Songs — Planning Center">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Planning Center Online</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Search & import songs from your PCO library</div>
                  </div>
                  {settings?.pcoAppId && settings?.pcoSecret && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>SAVED</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input value={pcoAppId} onChange={e => { setPcoAppId(e.target.value); setPcoSaved(false); }} placeholder="App ID" style={inputStyle} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type={showPcoSecret ? 'text' : 'password'} value={pcoSecret}
                      onChange={e => { setPcoSecret(e.target.value); setPcoSaved(false); }}
                      onKeyDown={e => e.key === 'Enter' && savePco()}
                      placeholder="Secret" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => setShowPcoSecret(v => !v)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 11 }}>{showPcoSecret ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
                <SaveRow onSave={savePco} saved={pcoSaved} disabled={!pcoAppId.trim() || !pcoSecret.trim()} label="Save Credentials" />
                <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    Get credentials at <ExternalLink href="https://api.planningcenteronline.com/oauth/applications">api.planningcenteronline.com</ExternalLink> → Create App → Personal Access Token.
                  </div>
                </div>
              </div>
            </Section>

            <Section title="AI — Anthropic">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>✦</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Anthropic API Key</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Powers AI verse suggestions in Sermon Assistant</div>
                  </div>
                  {settings?.anthropicApiKey && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>SAVED</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type={showAnthropicKey ? 'text' : 'password'} value={anthropicKey}
                    onChange={e => { setAnthropicKey(e.target.value); setAnthropicSaved(false); }}
                    onKeyDown={e => e.key === 'Enter' && saveAnthropicKey()}
                    placeholder="sk-ant-…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => setShowAnthropicKey(v => !v)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 11 }}>{showAnthropicKey ? 'Hide' : 'Show'}</button>
                </div>
                <SaveRow onSave={saveAnthropicKey} saved={anthropicSaved} disabled={!anthropicKey.trim()} label="Save Key" />
                <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    Get a key at <ExternalLink href="https://console.anthropic.com">console.anthropic.com</ExternalLink> → API Keys. Sent to Anthropic only when verse suggestions are generated in the Sermon tab.
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Social Media tab ──────────────────────────────────────────── */}
        {activeTab === 'social' && (
          <Section title="RTMP Destinations">

            {isElectron && (
              <div style={{
                padding: '8px 10px', borderRadius: 6,
                background: ffmpegAvailable ? 'rgba(34,197,94,0.07)' : 'rgba(249,115,22,0.07)',
                border: `1px solid ${ffmpegAvailable ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)'}`,
              }}>
                {ffmpegAvailable === null && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Checking FFmpeg…</span>}
                {ffmpegAvailable === true && (
                  <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ FFmpeg detected — direct RTMP streaming available</span>
                )}
                {ffmpegAvailable === false && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--orange)', marginBottom: 4 }}>⚠ FFmpeg not found</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      Install FFmpeg to enable direct streaming:<br />
                      <strong style={{ color: 'var(--text-muted)' }}>macOS:</strong> brew install ffmpeg<br />
                      <strong style={{ color: 'var(--text-muted)' }}>Windows:</strong> winget install ffmpeg<br />
                      Restart the app after installing.
                    </div>
                  </>
                )}
              </div>
            )}

            {destinations.map(dest => (
              <DestinationCard key={dest.id} dest={dest}
                onUpdate={(changes) => updateDestination(dest.id, changes)}
                onRemove={() => removeDestination(dest.id)}
              />
            ))}

            {showAddPlatform ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>Select platform:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {Object.entries(PLATFORM_PRESETS).map(([key, p]) => (
                    <button key={key} onClick={() => addDestination(key)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '8px 10px', cursor: 'pointer',
                      color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 11, textAlign: 'left',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    >
                      <span style={{ fontSize: 16 }}>{p.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.rtmpUrl && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{p.rtmpUrl.slice(0, 40)}…</div>}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddPlatform(false)} style={{ width: '100%', marginTop: 8, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '6px', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowAddPlatform(true)} style={{
                width: '100%', background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 7, color: 'var(--text-muted)', padding: '8px', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >＋ Add Streaming Platform</button>
            )}

            <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, padding: '4px 0' }}>
              Start streaming from the <strong style={{ color: 'var(--text-muted)' }}>📡 Stream</strong> panel once configured. Stream keys are stored locally and never uploaded.
            </div>
          </Section>
        )}

        {/* ── Devices tab ───────────────────────────────────────────────── */}
        {activeTab === 'devices' && (
          <DevicesTab settings={settings} saveSettings={saveSettings} />
        )}

        {/* ── Outputs tab ───────────────────────────────────────────────── */}
        {activeTab === 'outputs' && (
          <>
            <Section title="Confidence Monitor">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🗂</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Four-Quadrant Stage Display</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Current slide · Next slide · Timers · Announcements</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { pos: 'Upper-left',  label: 'Current', desc: 'The slide currently live on program — full brightness.' },
                    { pos: 'Upper-right', label: 'Next',    desc: 'The slide coming up next — dimmed so it\'s readable but distinct.' },
                    { pos: 'Lower-left',  label: 'Timers',  desc: 'Wall clock always shown. Active countdown/stopwatch timers appear here with progress bars.' },
                    { pos: 'Lower-right', label: 'Stage',   desc: 'Operator announcements sent from the ⏱ Timers panel. Visible here only.' },
                  ].map(({ pos, label, desc }) => (
                    <div key={pos} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 78, fontSize: 10, color: 'var(--text-dim)', paddingTop: 1 }}>{pos}</div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label} — </span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '7px 9px', borderRadius: 5, background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.18)', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  To open: click <strong style={{ color: 'var(--text)' }}>📺 Outputs</strong> in the toolbar → <strong style={{ color: 'var(--text)' }}>Add Output</strong> → set role to <strong style={{ color: 'var(--text)' }}>Confidence Monitor</strong> → assign it to your stage TV display.
                </div>
              </div>
            </Section>

            <Section title="Timers">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⏱</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Timer Types</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>No setup required — open ⏱ Timers in the nav bar</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { type: 'Countdown', desc: 'Counts down from a set duration. Progress bar turns amber at 20% remaining and red at zero.' },
                    { type: 'Stopwatch', desc: 'Counts up from zero. Start, pause, and reset as needed.' },
                    { type: 'Clock',     desc: 'Shows the current wall clock time. Always live — no start/stop needed.' },
                  ].map(({ type, desc }) => (
                    <div key={type} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 78, fontSize: 10, fontWeight: 600, color: 'var(--text)', paddingTop: 1 }}>{type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Stage Announcements">
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px' }}>Type a short message in the <strong style={{ color: 'var(--text)' }}>Stage Announcement</strong> box in the ⏱ Timers panel and click <strong style={{ color: 'var(--text)' }}>Send to Stage</strong>.</p>
                <p style={{ margin: '0 0 6px' }}>The message appears immediately in the lower-right quadrant of every open Confidence Monitor.</p>
                <p style={{ margin: 0 }}>Announcements are <strong style={{ color: 'var(--text)' }}>private</strong> — they never appear on audience-facing Program, Announcement, or Background outputs. Press <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>⌘ Enter</kbd> / <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Ctrl Enter</kbd> to send without the mouse.</p>
              </div>
            </Section>
          </>
        )}

        {/* ── Help tab ──────────────────────────────────────────────────── */}
        {activeTab === 'help' && (
          <HelpPanel inline />
        )}

      </div>
    </div>
  );
}

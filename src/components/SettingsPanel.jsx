import React, { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../store/AppContext';
import ExternalLink from './ExternalLink';

const PLATFORM_PRESETS = {
  facebook:  { name: 'Facebook Live',   color: '#1877F2', icon: '📘', rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  youtube:   { name: 'YouTube Live',    color: '#FF0000', icon: '▶️',  rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/' },
  instagram: { name: 'Instagram Live',  color: '#E1306C', icon: '📷', rtmpUrl: 'rtmp://live-upload.instagram.com:80/rtmp/' },
  custom:    { name: 'Custom RTMP',     color: '#888',    icon: '📡', rtmpUrl: '' },
};

const FONT_OPTIONS = ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Impact'];

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

function DestinationCard({ dest, onUpdate, onRemove }) {
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(!dest.streamKey);
  const preset = PLATFORM_PRESETS[dest.platform] || PLATFORM_PRESETS.custom;
  const hasKey = !!dest.streamKey?.trim();

  return (
    <div style={{
      borderRadius: 8, border: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.03)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
        <input
          type="checkbox"
          checked={dest.enabled}
          onChange={e => onUpdate({ enabled: e.target.checked })}
          style={{ accentColor: preset.color, flexShrink: 0 }}
          title="Enable this destination"
        />
        <span style={{ fontSize: 15, flexShrink: 0 }}>{preset.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dest.name}
          </div>
          <div style={{ fontSize: 10, color: hasKey ? 'var(--green)' : 'var(--text-dim)' }}>
            {hasKey ? '● Stream key saved' : '⚠ No stream key'}
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }} title="Remove">✕</button>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {dest.platform === 'custom' && (
            <>
              <input
                value={dest.name}
                onChange={e => onUpdate({ name: e.target.value })}
                placeholder="Destination name"
                style={{ ...inputStyle, marginTop: 10 }}
              />
              <input
                value={dest.rtmpUrl}
                onChange={e => onUpdate({ rtmpUrl: e.target.value })}
                placeholder="rtmp://your-server/live/"
                style={inputStyle}
              />
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
              <input
                type={showKey ? 'text' : 'password'}
                value={dest.streamKey}
                onChange={e => onUpdate({ streamKey: e.target.value })}
                placeholder="Paste your stream key here"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => setShowKey(v => !v)} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 11,
              }}>{showKey ? 'Hide' : 'Show'}</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              Stored locally only — never sent to any server other than your streaming platform.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const { settings, saveSettings, ffmpegAvailable, isElectron } = useApp();

  // ── Local draft state for presentation defaults (debounced save) ──────
  const [fontDraft, setFontDraft] = useState(settings?.defaultFont || 'Georgia');
  const [sizeDraft, setSizeDraft] = useState(settings?.defaultFontSize || 44);
  const [yvKey, setYvKey] = useState(settings?.youversionApiKey || '');
  const [yvSaved, setYvSaved] = useState(false);
  const [showYvKey, setShowYvKey] = useState(false);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
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

  const destinations = useMemo(() => settings?.rtmpDestinations || [], [settings?.rtmpDestinations]);

  // ── YouVersion key ──────────────────────────────────────────────────────
  const saveYvKey = useCallback(() => {
    saveSettings({ youversionApiKey: yvKey.trim() });
    setYvSaved(true);
    setTimeout(() => setYvSaved(false), 2000);
  }, [yvKey, saveSettings]);

  // ── Planning Center credentials ─────────────────────────────────────────
  const savePco = useCallback(() => {
    saveSettings({ pcoAppId: pcoAppId.trim(), pcoSecret: pcoSecret.trim() });
    setPcoSaved(true);
    setTimeout(() => setPcoSaved(false), 2000);
  }, [pcoAppId, pcoSecret, saveSettings]);

  // ── Anthropic API key ───────────────────────────────────────────────────
  const saveAnthropicKey = useCallback(() => {
    saveSettings({ anthropicApiKey: anthropicKey.trim() });
    setAnthropicSaved(true);
    setTimeout(() => setAnthropicSaved(false), 2000);
  }, [anthropicKey, saveSettings]);

  // ── Genius API key ──────────────────────────────────────────────────────
  const saveGeniusKey = useCallback(() => {
    saveSettings({ geniusApiKey: geniusKey.trim() });
    setGeniusSaved(true);
    setTimeout(() => setGeniusSaved(false), 2000);
  }, [geniusKey, saveSettings]);

  // ── Presentation defaults ───────────────────────────────────────────────
  const saveFont = useCallback((font) => {
    setFontDraft(font);
    saveSettings({ defaultFont: font });
  }, [saveSettings]);

  const saveSize = useCallback((size) => {
    setSizeDraft(size);
    saveSettings({ defaultFontSize: Number(size) });
  }, [saveSettings]);

  // ── RTMP destination management ─────────────────────────────────────────
  const addDestination = useCallback((platform) => {
    const preset = PLATFORM_PRESETS[platform];
    const newDest = {
      id: uuidv4(),
      platform,
      name: preset.name,
      rtmpUrl: preset.rtmpUrl,
      streamKey: '',
      enabled: true,
    };
    saveSettings({ rtmpDestinations: [...destinations, newDest] });
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
      width: 320, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Settings</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>App preferences and API keys</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>

        {/* ── API Keys ───────────────────────────────────────────────────── */}
        <Section title="API Keys">

          {/* YouVersion */}
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>📖</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>YouVersion Bible API</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Required for online Bible search</div>
              </div>
              {settings?.youversionApiKey && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>SAVED</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={showYvKey ? 'text' : 'password'} value={yvKey}
                onChange={e => { setYvKey(e.target.value); setYvSaved(false); }}
                onKeyDown={e => e.key === 'Enter' && saveYvKey()}
                placeholder="Paste your YouVersion App Key" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => setShowYvKey(v => !v)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 11 }}>{showYvKey ? 'Hide' : 'Show'}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={saveYvKey} disabled={!yvKey.trim()} style={{ background: yvSaved ? 'var(--green)' : 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600, opacity: !yvKey.trim() ? 0.45 : 1 }}>{yvSaved ? '✓ Saved' : 'Save Key'}</button>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Stored locally only.</div>
            </div>
            <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Get a free key at{' '}
                <ExternalLink href="https://developer.youversion.com">developer.youversion.com</ExternalLink>
                {' '}→ Create App → copy the App Key. Offline search (KJV, NIV) works without it.
              </div>
            </div>
          </div>

          {/* Genius */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={saveGeniusKey} disabled={!geniusKey.trim()} style={{ background: geniusSaved ? 'var(--green)' : 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600, opacity: !geniusKey.trim() ? 0.45 : 1 }}>{geniusSaved ? '✓ Saved' : 'Save Key'}</button>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Stored locally only.</div>
            </div>
            <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Get a free token at{' '}
                <ExternalLink href="https://genius.com/api-clients">genius.com/api-clients</ExternalLink>
                {' '}→ New API Client → copy the Client Access Token.{' '}
                <strong style={{ color: 'rgba(255,165,0,0.9)' }}>CCLI:</strong>{' '}
                For internal, non-commercial church use only.
              </div>
            </div>
          </div>

          {/* Planning Center */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={savePco} disabled={!pcoAppId.trim() || !pcoSecret.trim()} style={{ background: pcoSaved ? 'var(--green)' : 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600, opacity: (!pcoAppId.trim() || !pcoSecret.trim()) ? 0.45 : 1 }}>{pcoSaved ? '✓ Saved' : 'Save Credentials'}</button>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Stored locally only.</div>
            </div>
            <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Get credentials at{' '}
                <ExternalLink href="https://api.planningcenteronline.com/oauth/applications">api.planningcenteronline.com/oauth/applications</ExternalLink>
                {' '}→ Create App → select "Personal Access Token".
              </div>
            </div>
          </div>

          {/* Anthropic */}
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>✦</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Anthropic API Key</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Powers AI verse suggestions during live preaching</div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={saveAnthropicKey} disabled={!anthropicKey.trim()} style={{ background: anthropicSaved ? 'var(--green)' : 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600, opacity: !anthropicKey.trim() ? 0.45 : 1 }}>{anthropicSaved ? '✓ Saved' : 'Save Key'}</button>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Stored locally only.</div>
            </div>
            <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Get a key at{' '}
                <ExternalLink href="https://console.anthropic.com">console.anthropic.com</ExternalLink>
                {' '}→ API Keys. Sent to Anthropic only when you click "Suggest Verses" in the Sermon tab.
              </div>
            </div>
          </div>

        </Section>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />

        {/* ── Social Media Streaming ────────────────────────────────────── */}
        <Section title="Social Media Streaming">

          {/* FFmpeg status */}
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

          {/* Destination cards */}
          {destinations.map(dest => (
            <DestinationCard key={dest.id} dest={dest}
              onUpdate={(changes) => updateDestination(dest.id, changes)}
              onRemove={() => removeDestination(dest.id)}
            />
          ))}

          {/* Add platform */}
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

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />

        {/* ── Presentation Defaults ─────────────────────────────────────── */}
        <Section title="Presentation Defaults">
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Default font</div>
            <select
              value={fontDraft}
              onChange={e => saveFont(e.target.value)}
              style={{ ...inputStyle }}
            >
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
              onMouseUp={e => saveSize(e.target.value)}
              onTouchEnd={e => saveSize(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              Preview: <span style={{ fontSize: `${Math.round(sizeDraft * 0.28)}px`, fontFamily: fontDraft, color: 'var(--text)' }}>Amazing Grace</span>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}

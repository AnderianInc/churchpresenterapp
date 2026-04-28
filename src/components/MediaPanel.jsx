import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp, BROADCAST_CHANNEL } from '../store/AppContext';
import { v4 as uuidv4 } from 'uuid';
import { parsePptx } from '../utils/pptxParser';
import { shouldAcceptYtState, muteCommandFor } from '../utils/youtubeControl';

const PRESET_BACKGROUNDS = [
  { id: 'b1', name: 'Deep Navy', type: 'color', value: '#0a0f1e', category: 'solid' },
  { id: 'b2', name: 'Midnight', type: 'color', value: '#0d1117', category: 'solid' },
  { id: 'b3', name: 'Deep Purple', type: 'color', value: '#0d0a1e', category: 'solid' },
  { id: 'b4', name: 'Forest', type: 'color', value: '#0a1a0f', category: 'solid' },
  { id: 'b5', name: 'Dark Slate', type: 'color', value: '#0f1219', category: 'solid' },
  { id: 'b6', name: 'Black', type: 'color', value: '#000000', category: 'solid' },
  { id: 'b7', name: 'Ocean Blue', type: 'color', value: '#061525', category: 'solid' },
  { id: 'b8', name: 'Deep Maroon', type: 'color', value: '#1a0a0a', category: 'solid' },
  { id: 'g1', name: 'Blue Gradient', type: 'gradient', value: 'linear-gradient(135deg, #0a0f1e 0%, #1a3a6a 100%)', category: 'gradient' },
  { id: 'g2', name: 'Purple Night', type: 'gradient', value: 'linear-gradient(135deg, #0d0a1e 0%, #2a1a4a 100%)', category: 'gradient' },
  { id: 'g3', name: 'Forest Dawn', type: 'gradient', value: 'linear-gradient(135deg, #0a1a0f 0%, #1a3a2a 100%)', category: 'gradient' },
  { id: 'g4', name: 'Golden Hour', type: 'gradient', value: 'linear-gradient(135deg, #1a0f00 0%, #3a2a0a 100%)', category: 'gradient' },
];

const NUM_FAVORITE_SLOTS = 4;
const TABS = ['solid', 'gradient', 'image', 'video', 'youtube', 'slides'];

// ── YouTube helpers ───────────────────────────────────────────────────────────

function extractYouTubeId(input) {
  if (!input) return null;
  input = input.trim();
  // Plain 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/');
      const seg = parts.find((_, i) => parts[i - 1] === 'embed' || parts[i - 1] === 'shorts' || parts[i - 1] === 'live');
      if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) return seg;
    }
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('?')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch { /* not a URL */ }
  const m = input.match(/[a-zA-Z0-9_-]{11}/);
  return m ? m[0] : null;
}

function youTubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export default function MediaPanel() {
  const { addToSchedule, settings, saveSettings, liveProgram, sendYouTubeControl } = useApp();
  const [category, setCategory] = useState('solid');
  const [customColor, setCustomColor] = useState('#0a0f1e');
  const fileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  // slotIndex tracks which favorite slot is being assigned (-1 = add to schedule directly)
  const [assigningSlot, setAssigningSlot] = useState(-1);
  const [assigningImageSlot, setAssigningImageSlot] = useState(-1);

  const videoFavorites = settings?.videoFavorites || [];
  const imageFavorites = settings?.imageFavorites || [];

  const importImageFile = async (file) => {
    let imageUrl;
    if (window.electronAPI?.copyMediaFile && file.path) {
      try { imageUrl = await window.electronAPI.copyMediaFile(file.path); }
      catch { imageUrl = URL.createObjectURL(file); }
    } else {
      imageUrl = URL.createObjectURL(file);
    }
    return { url: imageUrl, name: file.name };
  };

  const handleImageImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { url: imageUrl, name } = await importImageFile(file);

    if (assigningImageSlot >= 0) {
      const newFavorites = [...imageFavorites];
      while (newFavorites.length < NUM_FAVORITE_SLOTS) newFavorites.push(null);
      newFavorites[assigningImageSlot] = { url: imageUrl, name };
      saveSettings({ imageFavorites: newFavorites });
    } else {
      addToSchedule({
        type: 'announcement',
        title: name,
        slides: [{ id: uuidv4(), type: 'blank', label: name, lines: '' }],
        background: { type: 'image', value: imageUrl, name, brightness: 0.7 },
        textColor: '#ffffff',
        fontSize: 44,
        fontFamily: 'Georgia',
      });
    }
    setAssigningImageSlot(-1);
    event.target.value = '';
  };

  const applyImageFavorite = (fav) => {
    addToSchedule({
      type: 'announcement',
      title: fav.name,
      slides: [{ id: uuidv4(), type: 'blank', label: fav.name, lines: '' }],
      background: { type: 'image', value: fav.url, name: fav.name, brightness: 0.7 },
      textColor: '#ffffff',
      fontSize: 44,
      fontFamily: 'Georgia',
    });
  };

  const clearImageFavorite = (idx) => {
    const newFavorites = [...imageFavorites];
    while (newFavorites.length < NUM_FAVORITE_SLOTS) newFavorites.push(null);
    newFavorites[idx] = null;
    saveSettings({ imageFavorites: newFavorites });
  };

  const importVideoFile = async (file) => {
    let videoUrl;
    if (window.electronAPI?.copyMediaFile && file.path) {
      try { videoUrl = await window.electronAPI.copyMediaFile(file.path); }
      catch { videoUrl = URL.createObjectURL(file); }
    } else {
      videoUrl = URL.createObjectURL(file);
    }
    return { url: videoUrl, name: file.name };
  };

  const handleVideoImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { url: videoUrl, name } = await importVideoFile(file);

    if (assigningSlot >= 0) {
      // Assign to a favorite slot
      const newFavorites = [...videoFavorites];
      while (newFavorites.length < NUM_FAVORITE_SLOTS) newFavorites.push(null);
      newFavorites[assigningSlot] = { url: videoUrl, name };
      saveSettings({ videoFavorites: newFavorites });
    } else {
      // Add directly to schedule
      addToSchedule({
        type: 'video',
        title: name,
        slides: [{ id: uuidv4(), type: 'video', label: name, lines: '' }],
        background: { type: 'video', value: videoUrl, name },
        textColor: '#ffffff',
        fontSize: 44,
        fontFamily: 'Georgia',
      });
    }
    setAssigningSlot(-1);
    event.target.value = '';
  };

  const playFavorite = (fav) => {
    addToSchedule({
      type: 'video',
      title: fav.name,
      slides: [{ id: uuidv4(), type: 'video', label: fav.name, lines: '' }],
      background: { type: 'video', value: fav.url, name: fav.name },
      textColor: '#ffffff',
      fontSize: 44,
      fontFamily: 'Georgia',
    });
  };

  const clearFavorite = (idx) => {
    const newFavorites = [...videoFavorites];
    while (newFavorites.length < NUM_FAVORITE_SLOTS) newFavorites.push(null);
    newFavorites[idx] = null;
    saveSettings({ videoFavorites: newFavorites });
  };

  const applyBackground = (bg) => {
    // Add as a blank slide item
    addToSchedule({
      type: 'announcement',
      title: bg.name || 'Background',
      slides: [{ id: uuidv4(), type: 'blank', label: bg.name || 'Slide', lines: '' }],
      background: bg, textColor: '#ffffff', fontSize: 44, fontFamily: 'Georgia',
    });
  };

  const bgsByCategory = PRESET_BACKGROUNDS.filter(b => b.category === category);

  return (
    <div style={{
      width: 260, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
      }}>
        Media & Backgrounds
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {TABS.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            title={cat === 'solid' ? 'Solid Colors' : cat === 'gradient' ? 'Gradients' : cat === 'image' ? 'Images' : cat === 'video' ? 'Videos' : cat === 'youtube' ? 'YouTube' : 'Slides'}
            style={{
              flex: 1, padding: '7px 2px', fontSize: 14, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: category === cat ? '2px solid var(--accent)' : '2px solid transparent',
              color: category === cat ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font)', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {cat === 'solid' ? '🎨' : cat === 'gradient' ? '🌈' : cat === 'image' ? '🖼️' : cat === 'video' ? '🎬' : cat === 'youtube' ? '📺' : '📊'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {category === 'solid' && (
          <>
            {/* Custom color */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Custom Color</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
                  style={{ width: 48, height: 36, borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{customColor}</span>
                <button onClick={() => applyBackground({ type: 'color', value: customColor, name: 'Custom' })} style={{
                  marginLeft: 'auto', background: 'var(--accent)', border: 'none', color: '#fff',
                  padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                }}>Add</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Presets</div>
          </>
        )}

        {(category === 'solid' || category === 'gradient') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {bgsByCategory.map(bg => (
              <div
                key={bg.id}
                onClick={() => applyBackground(bg)}
                style={{
                  height: 60, borderRadius: 'var(--radius)', cursor: 'pointer',
                  background: bg.value, border: '2px solid var(--border)',
                  display: 'flex', alignItems: 'flex-end', padding: 4,
                  transition: 'border-color 0.15s, transform 0.1s',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: 2 }}>
                  {bg.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {category === 'youtube' && (
          <YouTubePanel
            addToSchedule={addToSchedule}
            settings={settings}
            saveSettings={saveSettings}
            liveProgram={liveProgram}
            sendYouTubeControl={sendYouTubeControl}
          />
        )}

        {category === 'slides' && (
          <PptxImporter addToSchedule={addToSchedule} />
        )}

        {category === 'image' && (
          <>
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageImport}
            />

            {/* Image favorite slots */}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Image Favorites
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {Array.from({ length: NUM_FAVORITE_SLOTS }).map((_, idx) => {
                const fav = imageFavorites[idx] || null;
                return fav ? (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 'var(--radius)',
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 4, flexShrink: 0,
                      backgroundImage: `url(${fav.url})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      border: '1px solid var(--border)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Slot {idx + 1}</div>
                    </div>
                    <button
                      onClick={() => applyImageFavorite(fav)}
                      title="Add to schedule"
                      style={{
                        background: 'var(--accent)', border: 'none', color: '#fff',
                        borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                        fontSize: 10, fontFamily: 'var(--font)',
                      }}
                    >▶</button>
                    <button
                      onClick={() => { setAssigningImageSlot(idx); imageFileInputRef.current?.click(); }}
                      title="Reassign slot"
                      style={{
                        background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)',
                        color: 'var(--text-dim)', borderRadius: 4, padding: '3px 6px',
                        cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
                      }}
                    >🔄</button>
                    <button
                      onClick={() => clearImageFavorite(idx)}
                      title="Remove favorite"
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--text-dim)',
                        cursor: 'pointer', fontSize: 13, padding: '0 2px',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <button key={idx} type="button" onClick={() => { setAssigningImageSlot(idx); imageFileInputRef.current?.click(); }} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 'var(--radius)',
                    background: 'transparent', border: '1px dashed var(--border)',
                    color: 'var(--text-dim)', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: 11, textAlign: 'left', width: '100%',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,142,247,0.4)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                  >
                    <span style={{ fontSize: 16 }}>＋</span>
                    <div>
                      <div>Set Favorite {idx + 1}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>Click to assign image file</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* One-off import */}
            <button type="button" style={{
              width: '100%', background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '8px', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
            }}
              onClick={() => { setAssigningImageSlot(-1); imageFileInputRef.current?.click(); }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              📁 Import Image to Schedule
            </button>
          </>
        )}

        {category === 'video' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleVideoImport}
            />

            {/* Favorite slots */}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Video Favorites
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {Array.from({ length: NUM_FAVORITE_SLOTS }).map((_, idx) => {
                const fav = videoFavorites[idx] || null;
                return fav ? (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 'var(--radius)',
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🎬</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Slot {idx + 1}</div>
                    </div>
                    <button
                      onClick={() => playFavorite(fav)}
                      title="Add to schedule"
                      style={{
                        background: 'var(--accent)', border: 'none', color: '#fff',
                        borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                        fontSize: 10, fontFamily: 'var(--font)',
                      }}
                    >▶</button>
                    <button
                      onClick={() => { setAssigningSlot(idx); fileInputRef.current?.click(); }}
                      title="Reassign slot"
                      style={{
                        background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)',
                        color: 'var(--text-dim)', borderRadius: 4, padding: '3px 6px',
                        cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
                      }}
                    >🔄</button>
                    <button
                      onClick={() => clearFavorite(idx)}
                      title="Remove favorite"
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--text-dim)',
                        cursor: 'pointer', fontSize: 13, padding: '0 2px',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <button key={idx} type="button" onClick={() => { setAssigningSlot(idx); fileInputRef.current?.click(); }} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 'var(--radius)',
                    background: 'transparent', border: '1px dashed var(--border)',
                    color: 'var(--text-dim)', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: 11, textAlign: 'left', width: '100%',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,142,247,0.4)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                  >
                    <span style={{ fontSize: 16 }}>＋</span>
                    <div>
                      <div>Set Favorite {idx + 1}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>Click to assign video file</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* One-off import */}
            <button type="button" style={{
              width: '100%', background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '8px', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
            }}
              onClick={() => { setAssigningSlot(-1); fileInputRef.current?.click(); }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              📁 Import Video to Schedule
            </button>
          </>
        )}
      </div>

      {/* Blank slide — hidden on Slides tab where it would be confusing */}
      {category !== 'slides' && (
        <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
          <button onClick={() => addToSchedule({
            type: 'blank', title: 'Blank Slide',
            slides: [{ id: uuidv4(), type: 'blank', label: 'Blank', lines: '' }],
            background: { type: 'color', value: '#000' }, textColor: '#fff', fontSize: 44, fontFamily: 'Georgia',
          })} style={{
            width: '100%', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '7px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >＋ Add Blank Slide</button>
        </div>
      )}
    </div>
  );
}

// ── YouTube Panel component ───────────────────────────────────────────────────

function YouTubePanel({ addToSchedule, settings, saveSettings, liveProgram, sendYouTubeControl }) {
  const [urlInput, setUrlInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [error, setError] = useState('');
  // Audio/playback state — starts muted (YouTube autoplay requires mute=1)
  // Updated to confirmed state via state relay from the output window
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true); // autoplay=1 so starts playing
  const [volume, setVolume] = useState(80);
  // Guard against stale infoDelivery events overriding fresh optimistic updates
  const lastActionRef = useRef(0);

  // Listen for youtube-state messages relayed back from the output window
  useEffect(() => {
    const handleState = (payload) => {
      // Only accept confirmed state once the debounce window has passed
      if (!shouldAcceptYtState(lastActionRef.current, Date.now())) return;
      if (payload.isMuted !== undefined) setIsMuted(payload.isMuted);
      if (payload.isPlaying !== undefined) setIsPlaying(payload.isPlaying);
      // Only update volume when value is meaningful
      if (payload.volume !== undefined && payload.volume >= 0) setVolume(payload.volume);
    };

    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'youtube-state') handleState(payload);
      };
    }
    if (window.electronAPI?.onReceiveYouTubeState) {
      window.electronAPI.onReceiveYouTubeState(handleState);
    }
    return () => {
      ch?.close();
      window.electronAPI?.removeAllListeners?.('receive-youtube-state');
    };
  }, []);

  // Reset audio state when a new YouTube video goes live
  const liveYt = liveProgram?.item?.background?.type === 'youtube' ? liveProgram.item.background : null;
  const prevLiveId = useRef(null);
  useEffect(() => {
    if (liveYt?.value !== prevLiveId.current) {
      prevLiveId.current = liveYt?.value ?? null;
      if (liveYt) {
        setIsMuted(true);     // new video always starts muted (playerVars: mute:1)
        setIsPlaying(false);  // will update to true via onStateChange once player starts
        setVolume(80);
        lastActionRef.current = 0;
      }
    }
  }, [liveYt]);

  const youtubeFavorites = settings?.youtubeFavorites || [];

  const addYouTubeToSchedule = (videoId, label) => {
    addToSchedule({
      type: 'video',
      title: label || `YouTube: ${videoId}`,
      slides: [{ id: uuidv4(), type: 'video', label: label || videoId, lines: '' }],
      background: { type: 'youtube', value: videoId, name: label || videoId },
      textColor: '#ffffff',
      fontSize: 44,
      fontFamily: 'Georgia',
    });
  };

  const handleAdd = () => {
    const id = extractYouTubeId(urlInput);
    if (!id) { setError('Could not find a YouTube video ID in that URL.'); return; }
    setError('');
    addYouTubeToSchedule(id, labelInput.trim() || `YouTube: ${id}`);
    setUrlInput('');
    setLabelInput('');
  };

  const saveFavorite = (videoId, label) => {
    const already = youtubeFavorites.some(f => f.id === videoId);
    if (already) return;
    saveSettings({ youtubeFavorites: [...youtubeFavorites, { id: videoId, name: label || videoId }] });
  };

  const removeFavorite = (videoId) => {
    saveSettings({ youtubeFavorites: youtubeFavorites.filter(f => f.id !== videoId) });
  };

  const videoId = extractYouTubeId(urlInput);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Live playback controls ─────────────────────────────────── */}
      {liveYt && (
        <div style={{
          borderRadius: 8, border: '1px solid rgba(255,0,0,0.25)',
          background: 'rgba(255,0,0,0.06)', overflow: 'hidden',
        }}>
          {/* Header row — title + confirmed audio status badge */}
          <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '1px', textTransform: 'uppercase' }}>● Live</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {liveYt.name || liveYt.value}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
              background: isMuted ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
              border: isMuted ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(34,197,94,0.35)',
              color: isMuted ? '#f59e0b' : '#22c55e',
              letterSpacing: '0.5px',
            }}>
              {isMuted ? '🔇 MUTED' : '🔊 LIVE AUDIO'}
            </span>
          </div>

          {/* Playback buttons */}
          <div style={{ padding: '0 8px', display: 'flex', gap: 5 }}>
            {/* Play / Pause toggle — single button that changes based on confirmed state */}
            <button
              onClick={() => {
                const nextPlaying = !isPlaying;
                lastActionRef.current = Date.now();
                setIsPlaying(nextPlaying);
                sendYouTubeControl(nextPlaying ? 'playVideo' : 'pauseVideo', []);
              }}
              title={isPlaying ? 'Pause' : 'Play'}
              style={{
                flex: 2, background: isPlaying ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.07)',
                border: isPlaying ? '1px solid rgba(79,142,247,0.4)' : '1px solid rgba(255,255,255,0.12)',
                color: isPlaying ? '#4f8ef7' : 'var(--text)',
                borderRadius: 5, padding: '5px 0',
                cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >{isPlaying ? '⏸ Pause' : '▶ Play'}</button>

            {/* Mute / Unmute toggle — single button highlighted based on confirmed state */}
            <button
              onClick={() => {
                const nextMuted = !isMuted;
                lastActionRef.current = Date.now();
                setIsMuted(nextMuted);
                sendYouTubeControl(muteCommandFor(nextMuted), []);
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
              style={{
                flex: 1, borderRadius: 5, padding: '5px 0', cursor: 'pointer',
                fontSize: 13, fontFamily: 'var(--font)',
                background: isMuted ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)',
                border: isMuted ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(34,197,94,0.4)',
                color: isMuted ? '#f59e0b' : '#22c55e',
              }}
            >{isMuted ? '🔇' : '🔊'}</button>
          </div>

          {/* Volume slider */}
          <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0, width: 48 }}>
              Vol {volume}%
            </span>
            <input
              type="range" min="0" max="100" value={volume}
              onChange={e => {
                const v = Number(e.target.value);
                lastActionRef.current = Date.now();
                setVolume(v);
                sendYouTubeControl('setVolume', [v]);
                // Auto-unmute when raising volume from 0
                if (v > 0 && isMuted) {
                  setIsMuted(false);
                  sendYouTubeControl('unMute', []);
                }
              }}
              style={{ flex: 1, accentColor: isMuted ? '#f59e0b' : '#22c55e', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {/* URL input */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Add YouTube Video
      </div>

      <input
        type="text"
        value={urlInput}
        onChange={e => { setUrlInput(e.target.value); setError(''); }}
        placeholder="YouTube URL or video ID"
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-input, #1a1f2e)', border: '1px solid var(--border)',
          color: 'var(--text)', borderRadius: 4, padding: '7px 8px', fontSize: 11,
          fontFamily: 'var(--font)', outline: 'none',
        }}
      />

      <input
        type="text"
        value={labelInput}
        onChange={e => setLabelInput(e.target.value)}
        placeholder="Label (optional)"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-input, #1a1f2e)', border: '1px solid var(--border)',
          color: 'var(--text)', borderRadius: 4, padding: '7px 8px', fontSize: 11,
          fontFamily: 'var(--font)', outline: 'none',
        }}
      />

      {error && (
        <div style={{ fontSize: 10, color: 'var(--red, #ef4444)', lineHeight: 1.4 }}>{error}</div>
      )}

      {/* Thumbnail preview */}
      {videoId && (
        <div style={{
          position: 'relative', borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--border)', aspectRatio: '16/9',
        }}>
          <img
            src={youTubeThumbnailUrl(videoId)}
            alt="YouTube thumbnail"
            style={{ width: '100%', display: 'block', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 14, marginLeft: 2 }}>▶</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleAdd}
          disabled={!urlInput.trim()}
          style={{
            flex: 1, background: urlInput.trim() ? 'var(--accent)' : 'var(--bg-hover)',
            border: 'none', color: urlInput.trim() ? '#fff' : 'var(--text-dim)',
            borderRadius: 4, padding: '7px 8px', cursor: urlInput.trim() ? 'pointer' : 'default',
            fontSize: 11, fontFamily: 'var(--font)',
          }}
        >
          ＋ Add to Schedule
        </button>
        {videoId && (
          <button
            onClick={() => saveFavorite(videoId, labelInput.trim() || `YouTube: ${videoId}`)}
            title="Save to favorites"
            style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: 4, padding: '7px 8px',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
            }}
          >★</button>
        )}
      </div>

      {/* Favorites list */}
      {youtubeFavorites.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>
            Saved Favorites
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {youtubeFavorites.map(fav => (
              <YouTubeFavoriteRow
                key={fav.id}
                fav={fav}
                onPlay={() => addYouTubeToSchedule(fav.id, fav.name)}
                onRemove={() => removeFavorite(fav.id)}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5, paddingTop: 4 }}>
        Supports youtube.com/watch, youtu.be, and plain video IDs.
        Video plays muted and looped on output screens.
      </div>
    </div>
  );
}

function YouTubeFavoriteRow({ fav, onPlay, onRemove }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 'var(--radius)',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        border: `1px solid ${hover ? 'var(--border)' : 'transparent'}`,
        transition: 'all 0.1s',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 42, height: 28, borderRadius: 3, overflow: 'hidden',
        flexShrink: 0, background: '#111', position: 'relative',
      }}>
        <img
          src={youTubeThumbnailUrl(fav.id)}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'rgba(255,0,0,0.9)', fontSize: 10 }}>▶</span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fav.name}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{fav.id}</div>
      </div>

      <button
        onClick={onPlay}
        title="Add to schedule"
        style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
          fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0,
        }}
      >▶</button>

      <button
        onClick={onRemove}
        title="Remove favorite"
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-dim)',
          cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0,
        }}
      >✕</button>
    </div>
  );
}

// ── PPTX Importer component ───────────────────────────────────────────────────

function PptxImporter({ addToSchedule }) {
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Parse result
  const [parsed, setParsed] = useState(null);   // { fileName, slideCount, slides }
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState(new Set()); // selected slide nums
  const [dragOver, setDragOver] = useState(false);

  const doImport = useCallback(async (file) => {
    setStatus('loading');
    setErrorMsg('');
    setParsed(null);
    setSelected(new Set());
    try {
      const result = await parsePptx(file);
      setParsed(result);
      // Pre-select all slides
      setSelected(new Set(result.slides.map(s => s.num)));
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to parse the file.');
      setStatus('error');
    }
  }, []);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) doImport(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.name.toLowerCase().endsWith('.pptx'));
    if (file) doImport(file);
  };

  const toggleSlide = (num) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  };

  const toggleAll = () => {
    if (!parsed) return;
    setSelected(prev =>
      prev.size === parsed.slides.length
        ? new Set()
        : new Set(parsed.slides.map(s => s.num))
    );
  };

  const addSlides = (nums) => {
    if (!parsed) return;
    const toAdd = parsed.slides.filter(s => nums.includes(s.num));
    if (!toAdd.length) return;

    // Group consecutive slides into one schedule item, or create one item per slide
    // Strategy: one schedule item per slide (gives fine-grained control in schedule)
    const baseName = parsed.fileName.replace(/\.pptx?$/i, '');
    toAdd.forEach(slide => {
      const title = slide.title
        ? `${baseName} — ${slide.title}`.slice(0, 80)
        : `${baseName} — Slide ${slide.num}`;
      addToSchedule({
        type: 'presentation',
        title,
        slides: [{
          id: uuidv4(),
          type: 'blank',
          label: slide.title || `Slide ${slide.num}`,
          lines: slide.lines,
        }],
        background: {
          type: 'color',
          value: slide.bgColor || '#0a0f1e',
        },
        textColor: '#ffffff',
        fontSize: 36,
        fontFamily: 'Georgia',
      });
    });
  };

  const addSelected = () => { addSlides([...selected]); };
  const addAll      = () => { if (parsed) addSlides(parsed.slides.map(s => s.num)); };

  // ── Styles ──────────────────────────────────────────────────────────────
  const dropZoneStyle = {
    border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 8, padding: '20px 10px', textAlign: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
    background: dragOver ? 'rgba(79,142,247,0.07)' : 'transparent',
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* Drop zone / import button */}
      {(status === 'idle' || status === 'error') && (
        <div
          ref={dropZoneRef}
          style={dropZoneStyle}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
            Import PowerPoint Slides
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Drop a .pptx file here<br />or click to browse
          </div>
          {status === 'error' && (
            <div style={{
              marginTop: 10, padding: '6px 8px', borderRadius: 5,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: 10, color: 'var(--red)', textAlign: 'left', lineHeight: 1.5,
            }}>
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Parsing slides…
        </div>
      )}

      {/* Slide list */}
      {status === 'ready' && parsed && (
        <>
          {/* File info + reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {parsed.fileName}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {parsed.slideCount} slide{parsed.slideCount !== 1 ? 's' : ''} extracted
              </div>
            </div>
            <button
              onClick={() => { setParsed(null); setStatus('idle'); setSelected(new Set()); }}
              title="Import a different file"
              style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0,
              }}
            >✕ Clear</button>
          </div>

          {/* Select-all toggle + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>
              <input
                type="checkbox"
                checked={selected.size === parsed.slides.length}
                onChange={toggleAll}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              {selected.size === parsed.slides.length ? 'Deselect all' : 'Select all'}
            </label>
            {selected.size > 0 && (
              <button onClick={addSelected} style={{
                background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
                color: '#a7f3d0', padding: '4px 9px', borderRadius: 4,
                cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0,
              }}>
                ＋ Add {selected.size} slide{selected.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Slide list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
            {parsed.slides.map(slide => (
              <SlidePreviewRow
                key={slide.num}
                slide={slide}
                selected={selected.has(slide.num)}
                onToggle={() => toggleSlide(slide.num)}
                onAdd={() => addSlides([slide.num])}
              />
            ))}
          </div>

          {/* Add all shortcut */}
          <button onClick={addAll} style={{
            width: '100%', background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '7px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ＋ Add All {parsed.slideCount} Slides to Schedule
          </button>

          {/* Import another */}
          <button onClick={() => fileInputRef.current?.click()} style={{
            width: '100%', background: 'none', border: '1px dashed var(--border)',
            color: 'var(--text-dim)', padding: '6px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
          }}>
            📁 Import another file
          </button>
        </>
      )}
    </div>
  );
}

// ── Slide preview row ─────────────────────────────────────────────────────────

function SlidePreviewRow({ slide, selected, onToggle, onAdd }) {
  const [hover, setHover] = useState(false);
  const previewText = slide.text ? slide.text.slice(0, 120) + (slide.text.length > 120 ? '…' : '') : '(no text)';

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
        background: selected ? 'rgba(79,142,247,0.1)' : hover ? 'var(--bg-hover)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(79,142,247,0.3)' : hover ? 'var(--border)' : 'transparent'}`,
        transition: 'all 0.1s',
      }}
    >
      {/* Color swatch + checkbox stack */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={e => { e.stopPropagation(); onToggle(); }}
          style={{ accentColor: 'var(--accent)', cursor: 'pointer', marginTop: 1 }}
        />
        {/* Slide color swatch */}
        <div style={{
          width: 18, height: 12, borderRadius: 2,
          background: slide.bgColor || '#0a0f1e',
          border: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }} title={slide.bgColor ? `Background: ${slide.bgColor}` : 'Default background'} />
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>#{slide.num}</span>
          <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {slide.title || `Slide ${slide.num}`}
          </span>
          {slide.hasImage && (
            <span title="Contains images" style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>🖼</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.45, wordBreak: 'break-word' }}>
          {previewText}
        </div>
      </div>

      {/* Quick-add button */}
      <button
        onClick={e => { e.stopPropagation(); onAdd(); }}
        title="Add this slide"
        style={{
          background: hover || selected ? '#166534' : 'transparent',
          border: `1px solid ${hover || selected ? 'rgba(34,197,94,0.3)' : 'transparent'}`,
          color: hover || selected ? '#a7f3d0' : 'transparent',
          borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
          fontSize: 12, flexShrink: 0, transition: 'all 0.1s',
        }}
      >＋</button>
    </div>
  );
}

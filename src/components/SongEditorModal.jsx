import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { v4 as uuidv4 } from 'uuid';
import ExternalLink from './ExternalLink';

const SLIDE_TYPES = ['verse', 'chorus', 'bridge', 'intro', 'ending', 'tag', 'blank'];
const FONTS = ['Georgia', 'Playfair Display', 'Times New Roman', 'Arial', 'Helvetica', 'Inter'];
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TEMPOS = ['Slow', 'Medium-Slow', 'Medium', 'Medium-Fast', 'Fast'];
const PRESET_TAGS = ['hymn', 'contemporary', 'worship', 'classic', 'christmas', 'easter', 'communion'];
const STYLE_PRESETS = [
  { label: 'Large Title', fontSize: 72, fontFamily: 'Georgia' },
  { label: 'Subtitle', fontSize: 52, fontFamily: 'Georgia' },
  { label: 'Body', fontSize: 36, fontFamily: 'Georgia' },
  { label: 'Compact', fontSize: 28, fontFamily: 'Inter' },
];

const emptySlide = () => ({ id: uuidv4(), type: 'verse', label: 'Verse 1', lines: '', textAlign: 'center', chords: '' });

const typeColors = {
  verse: '#4f8ef7', chorus: '#22c55e', bridge: '#a855f7',
  ending: '#f97316', intro: '#eab308', tag: '#ec4899', blank: '#555b6e',
};

const inputStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 10px',
  fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: '100%',
};
const labelStyle = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

const AlignBtn = ({ align, current, onClick }) => {
  const labels = { left: 'L', center: 'C', right: 'R' };
  return (
    <button onClick={() => onClick(align)} title={`Align ${align}`} style={{
      width: 28, height: 28, background: current === align ? 'var(--accent)' : 'var(--bg-hover)',
      border: `1px solid ${current === align ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 4, color: current === align ? '#fff' : 'var(--text-dim)',
      cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
    }}>{labels[align]}</button>
  );
};

export default function SongEditorModal({ song, onClose }) {
  const { addSong, updateSong } = useApp();
  const isNew = !song;

  const [title, setTitle] = useState(song?.title || '');
  const [author, setAuthor] = useState(song?.author || '');
  const [songKey, setSongKey] = useState(song?.key || 'G');
  const [tempo, setTempo] = useState(song?.tempo || 'Medium');
  const [bpm, setBpm] = useState(song?.bpm != null ? String(song.bpm) : '');
  const [ccliNumber, setCcliNumber] = useState(song?.ccliNumber || '');
  const [copyrightYear, setCopyrightYear] = useState(song?.copyrightYear || '');
  const [tags, setTags] = useState(song?.tags || []);
  const [customTag, setCustomTag] = useState('');
  const [slides, setSlides] = useState(song?.slides?.length ? song.slides : [emptySlide()]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideSubTab, setSlideSubTab] = useState('lyrics');
  const [bgColor, setBgColor] = useState(song?.background?.value || '#0a0f1e');
  const [textColor, setTextColor] = useState(song?.textColor || '#ffffff');
  const [fontSize, setFontSize] = useState(song?.fontSize || 44);
  const [fontFamily, setFontFamily] = useState(song?.fontFamily || 'Georgia');
  const [activeTab, setActiveTab] = useState('lyrics');

  const currentSlide = slides[activeSlide];

  const updateCurrentSlide = (field, value) => {
    setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, [field]: value } : s));
  };

  const addSlide = () => {
    const newSlide = emptySlide();
    const idx = activeSlide + 1;
    setSlides(prev => { const next = [...prev]; next.splice(idx, 0, newSlide); return next; });
    setActiveSlide(idx);
  };

  const duplicateSlide = () => {
    const dup = { ...currentSlide, id: uuidv4() };
    const idx = activeSlide + 1;
    setSlides(prev => { const next = [...prev]; next.splice(idx, 0, dup); return next; });
    setActiveSlide(idx);
  };

  const deleteSlide = (i) => {
    if (slides.length === 1) return;
    setSlides(prev => prev.filter((_, idx) => idx !== i));
    setActiveSlide(Math.max(0, i - 1));
  };

  const moveSlide = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    setSlides(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setActiveSlide(j);
  };

  const toggleTag = (tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setCustomTag('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const songData = {
      title: title.trim(), author: author.trim(), key: songKey,
      tempo, tags, slides,
      background: { type: 'color', value: bgColor },
      textColor, fontSize, fontFamily,
      bpm: bpm ? Number(bpm) : undefined,
      ccliNumber: ccliNumber.trim() || '',
      copyrightYear: copyrightYear.trim() || '',
    };
    if (isNew) addSong(songData);
    else updateSong(song.id, songData);
    onClose();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const slideAlign = currentSlide?.textAlign || 'center';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 920, maxWidth: '95vw', height: 640, maxHeight: '90vh',
        background: 'var(--bg-panel)', borderRadius: 10,
        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>🎵</span>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Song Title"
            style={{ ...inputStyle, fontSize: 16, fontWeight: 600, padding: '4px 8px', flex: 1, maxWidth: 340 }}
            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ flex: 1 }} />
          <button onClick={handleSave} disabled={!title.trim()} style={{
            background: title.trim() ? 'var(--accent)' : '#333', border: 'none', color: '#fff',
            padding: '7px 20px', borderRadius: 'var(--radius)', cursor: title.trim() ? 'pointer' : 'not-allowed',
            fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600,
          }}>
            {isNew ? '＋ Add Song' : '✓ Save Changes'}
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
            fontSize: 13, fontFamily: 'var(--font)',
          }}>Cancel</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[['lyrics', '📝 Lyrics & Slides'], ['appearance', '🎨 Appearance'], ['metadata', '📋 Metadata']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 16px', fontSize: 12, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font)', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Lyrics Tab */}
        {activeTab === 'lyrics' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Song info */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Author</label>
                  <input value={author} onChange={e => setAuthor(e.target.value)}
                    placeholder="Author name" style={{ ...inputStyle, fontSize: 12 }}
                    onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Key</label>
                    <select value={songKey} onChange={e => setSongKey(e.target.value)}
                      style={{ ...inputStyle, fontSize: 12, cursor: 'pointer' }}>
                      {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Tempo</label>
                    <select value={tempo} onChange={e => setTempo(e.target.value)}
                      style={{ ...inputStyle, fontSize: 12, cursor: 'pointer' }}>
                      {TEMPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <label style={labelStyle}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                  {PRESET_TAGS.map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)} style={{
                      padding: '2px 7px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
                      background: tags.includes(tag) ? 'var(--accent)' : 'transparent',
                      border: tags.includes(tag) ? 'none' : '1px solid var(--border)',
                      color: tags.includes(tag) ? '#fff' : 'var(--text-muted)',
                      fontFamily: 'var(--font)', transition: 'all 0.15s',
                    }}>{tag}</button>
                  ))}
                  {tags.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)} style={{
                      padding: '2px 7px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
                      background: 'rgba(79,142,247,0.2)', border: '1px solid rgba(79,142,247,0.4)',
                      color: 'var(--accent)', fontFamily: 'var(--font)',
                    }}>{tag} ✕</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                    placeholder="Add tag…"
                    style={{ ...inputStyle, fontSize: 11, padding: '4px 7px' }}
                  />
                  <button onClick={addCustomTag} style={{
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', borderRadius: 'var(--radius)',
                    padding: '0 8px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)',
                  }}>+</button>
                </div>
              </div>
              {/* Slide list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '2px 4px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Slides ({slides.length})
                </div>
                {slides.map((slide, i) => (
                  <div key={slide.id} onClick={() => setActiveSlide(i)} style={{
                    padding: '6px 8px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6,
                    background: i === activeSlide ? 'var(--bg-selected)' : 'transparent',
                    border: i === activeSlide ? '1px solid rgba(79,142,247,0.3)' : '1px solid transparent',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: typeColors[slide.type] || '#555' }} />
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slide.label || slide.type}
                    </span>
                    {slide.chords && <span title="Has chord chart" style={{ fontSize: 9, color: 'var(--text-dim)' }}>♩</span>}
                    <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); moveSlide(i, -1); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, padding: '1px 3px' }}>↑</button>
                      <button onClick={e => { e.stopPropagation(); moveSlide(i, 1); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, padding: '1px 3px' }}>↓</button>
                      <button onClick={e => { e.stopPropagation(); deleteSlide(i); }} disabled={slides.length === 1}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: slides.length > 1 ? 'pointer' : 'default', fontSize: 11, padding: '1px 3px' }}
                        onMouseEnter={e => { if (slides.length > 1) e.currentTarget.style.color = 'var(--red)'; }}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 4 }}>
                <button onClick={addSlide} style={{
                  flex: 1, background: 'var(--accent)', border: 'none', color: '#fff',
                  padding: '6px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                }}>＋ Slide</button>
                <button onClick={duplicateSlide} title="Duplicate" style={{
                  background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                  padding: '6px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                }}>⧉</button>
              </div>
            </div>

            {/* Slide editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {currentSlide && (
                <>
                  {/* Slide header: type, label, alignment, counter */}
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0, flexWrap: 'wrap' }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={currentSlide.type} onChange={e => updateCurrentSlide('type', e.target.value)}
                        style={{ ...inputStyle, width: 'auto', fontSize: 12, cursor: 'pointer' }}>
                        {SLIDE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Label</label>
                      <input value={currentSlide.label} onChange={e => updateCurrentSlide('label', e.target.value)}
                        placeholder="e.g. Verse 1, Chorus..."
                        style={{ ...inputStyle, fontSize: 12 }}
                        onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <label style={labelStyle}>Align</label>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <AlignBtn align="left" current={slideAlign} onClick={v => updateCurrentSlide('textAlign', v)} />
                        <AlignBtn align="center" current={slideAlign} onClick={v => updateCurrentSlide('textAlign', v)} />
                        <AlignBtn align="right" current={slideAlign} onClick={v => updateCurrentSlide('textAlign', v)} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', paddingBottom: 8, flexShrink: 0 }}>
                      {activeSlide + 1} / {slides.length}
                    </span>
                  </div>

                  {/* Lyrics / Chords sub-tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    {[['lyrics', '📝 Lyrics'], ['chords', '🎸 Chords']].map(([t, lbl]) => (
                      <button key={t} onClick={() => setSlideSubTab(t)} style={{
                        padding: '5px 14px', fontSize: 11, cursor: 'pointer',
                        background: 'transparent', border: 'none',
                        borderBottom: slideSubTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                        color: slideSubTab === t ? 'var(--accent)' : 'var(--text-muted)',
                        fontFamily: 'var(--font)',
                      }}>{lbl}</button>
                    ))}
                  </div>

                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Lyrics or Chords editor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12 }}>
                      {slideSubTab === 'lyrics' ? (
                        <>
                          <label style={labelStyle}>Lyrics (one line per line)</label>
                          <textarea
                            value={currentSlide.lines}
                            onChange={e => updateCurrentSlide('lines', e.target.value)}
                            placeholder={'Enter lyrics here...\n\nTip: Keep slides to 4–6 lines for readability.'}
                            style={{
                              ...inputStyle, flex: 1, resize: 'none',
                              fontFamily: fontFamily, fontSize: 14, lineHeight: 1.9, padding: 12,
                              textAlign: slideAlign,
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                          />
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                            {(currentSlide.lines || '').split('\n').length} lines · {(currentSlide.lines || '').length} chars
                          </div>
                        </>
                      ) : (
                        <>
                          <label style={labelStyle}>Chord Chart — visible on Stage Display for worship team</label>
                          <textarea
                            value={currentSlide.chords || ''}
                            onChange={e => updateCurrentSlide('chords', e.target.value)}
                            placeholder={'G         Em        C         D\nAmazing grace! How sweet the sound\n\nG         Em        Am        D\nThat saved a wretch like me'}
                            style={{
                              ...inputStyle, flex: 1, resize: 'none',
                              fontFamily: 'monospace', fontSize: 12, lineHeight: 2, padding: 12,
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                          />
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                            Chord chart is shown on Stage Display — not visible to audience
                          </div>
                        </>
                      )}
                    </div>

                    {/* Mini preview */}
                    <div style={{ width: 210, padding: 12, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <label style={labelStyle}>Preview</label>
                      <div style={{
                        flex: 1, background: bgColor, borderRadius: 6,
                        display: 'flex', alignItems: 'center',
                        justifyContent: slideAlign === 'left' ? 'flex-start' : slideAlign === 'right' ? 'flex-end' : 'center',
                        padding: '10%', textAlign: slideAlign, border: '1px solid var(--border)',
                      }}>
                        <div style={{
                          fontSize: Math.max(9, fontSize * 0.23), color: textColor,
                          fontFamily, lineHeight: 1.5, whiteSpace: 'pre-line',
                          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                          textAlign: slideAlign,
                        }}>
                          {currentSlide.lines || '(empty slide)'}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
                        {fontFamily} · {fontSize}px
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', gap: 32 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Style Presets</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {STYLE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => { setFontSize(p.fontSize); setFontFamily(p.fontFamily); }} style={{
                      padding: '6px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: fontSize === p.fontSize && fontFamily === p.fontFamily ? 'var(--accent)' : 'var(--bg-hover)',
                      border: fontSize === p.fontSize && fontFamily === p.fontFamily ? 'none' : '1px solid var(--border)',
                      color: fontSize === p.fontSize && fontFamily === p.fontFamily ? '#fff' : 'var(--text-muted)',
                      fontFamily: p.fontFamily, fontSize: 13, transition: 'all 0.15s',
                    }}>{p.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Quick-set font size and family for common slide styles</div>
              </div>

              <div>
                <label style={labelStyle}>Background Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                    style={{ width: 60, height: 40, borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{bgColor}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['#0a0f1e','#0d1117','#0f0d1a','#061525','#0a1a0f','#000000','#1a0a0a','#0d0a1e'].map(c => (
                    <div key={c} onClick={() => setBgColor(c)} style={{
                      width: 32, height: 32, borderRadius: 5, background: c, cursor: 'pointer',
                      border: bgColor === c ? '2px solid var(--accent)' : '2px solid var(--border)',
                      transition: 'border-color 0.15s',
                    }} />
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Text Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                    style={{ width: 60, height: 40, borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{textColor}</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    {['#ffffff','#f5f5f0','#ffe89a','#b3d4ff','#ffcaca'].map(c => (
                      <div key={c} onClick={() => setTextColor(c)} style={{
                        width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer',
                        border: textColor === c ? '2px solid var(--accent)' : '2px solid var(--border)',
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Font Family</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FONTS.map(f => (
                    <button key={f} onClick={() => setFontFamily(f)} style={{
                      padding: '6px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: fontFamily === f ? 'var(--accent)' : 'var(--bg-hover)',
                      border: fontFamily === f ? 'none' : '1px solid var(--border)',
                      color: fontFamily === f ? '#fff' : 'var(--text-muted)',
                      fontFamily: f, fontSize: 14, transition: 'all 0.15s',
                    }}>{f}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Font Size: <strong style={{ color: 'var(--text)' }}>{fontSize}px</strong></label>
                <input type="range" min={24} max={80} step={2} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: 4 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
                  <span>Small (24px)</span><span>Large (80px)</span>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div style={{ width: 340, flexShrink: 0 }}>
              <label style={labelStyle}>Full Slide Preview</label>
              <div style={{
                width: '100%', aspectRatio: '16/9', background: bgColor, borderRadius: 8,
                border: '2px solid var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '8%', textAlign: 'center',
              }}>
                <div style={{
                  fontSize: fontSize * 0.33, color: textColor, fontFamily,
                  lineHeight: 1.4, whiteSpace: 'pre-line', textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                }}>
                  {slides[activeSlide]?.lines || 'Preview text\nwill appear here'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, textAlign: 'center' }}>
                {fontFamily} · {fontSize}px · {bgColor}
              </div>
            </div>
          </div>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border)' }}>
                Metadata is stored with the song for reference. CCLI number and copyright year may be required for license reporting.
              </div>

              <div>
                <label style={labelStyle}>BPM (Beats Per Minute)</label>
                <input
                  type="number" min={40} max={300} value={bpm}
                  onChange={e => setBpm(e.target.value)}
                  placeholder="e.g. 120"
                  style={{ ...inputStyle, width: 140 }}
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div>
                <label style={labelStyle}>CCLI Song Number</label>
                <input
                  value={ccliNumber}
                  onChange={e => setCcliNumber(e.target.value)}
                  placeholder="e.g. 4348399"
                  style={{ ...inputStyle, width: 200 }}
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                  Find song numbers at <ExternalLink href="https://songselect.ccli.com">songselect.ccli.com</ExternalLink>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Copyright Year</label>
                <input
                  value={copyrightYear}
                  onChange={e => setCopyrightYear(e.target.value)}
                  placeholder="e.g. 2019"
                  style={{ ...inputStyle, width: 140 }}
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {(ccliNumber || copyrightYear || bpm) && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Summary</div>
                  {bpm && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>BPM: <strong style={{ color: 'var(--text)' }}>{bpm}</strong></div>}
                  {ccliNumber && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>CCLI #: <strong style={{ color: 'var(--text)' }}>{ccliNumber}</strong></div>}
                  {copyrightYear && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>© <strong style={{ color: 'var(--text)' }}>{copyrightYear}</strong></div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../store/AppContext';

// ── Lyrics parsers ────────────────────────────────────────────────────────────

/** Detect slide type from a section marker string. */
function slideTypeFromLabel(raw = '') {
  const l = raw.toLowerCase();
  if (l.includes('chorus')) return 'chorus';
  if (l.includes('bridge')) return 'bridge';
  if (l.includes('pre-chorus') || l.includes('prechorus')) return 'prechorus';
  if (l.includes('intro')) return 'intro';
  if (l.includes('outro') || l.includes('tag')) return 'tag';
  if (l.includes('ending')) return 'ending';
  return 'verse';
}

/**
 * Parse a chord-chart/plain-lyrics string into slide objects.
 * Section markers: [Verse 1], [Chorus], [Bridge], etc.
 * Lines without a leading marker become "Verse 1".
 */
function parseSectionedText(text = '') {
  const lines = text.split('\n');
  const slides = [];
  let label = null;
  let type = 'verse';
  let buf = [];

  const flush = () => {
    const content = buf.filter(l => l.trim()).join('\n').trim();
    if (label !== null && content) {
      slides.push({ id: uuidv4(), type, label, lines: content });
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      flush();
      label = m[1];
      type = slideTypeFromLabel(label);
    } else {
      if (label === null && line.trim()) {
        label = 'Verse 1';
        type = 'verse';
      }
      buf.push(line);
    }
  }
  flush();
  return slides;
}

/**
 * Parse an OpenLyrics XML string.
 * Returns { title, author, slides }.
 */
function parseOpenLyricsXml(xmlText = '') {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Invalid XML — could not parse file.');

  const title = doc.querySelector('title')?.textContent?.trim() || 'Imported Song';
  const author = doc.querySelector('author')?.textContent?.trim() || '';

  const slides = [];
  doc.querySelectorAll('verse').forEach(verse => {
    const name = verse.getAttribute('name') || 'v1';
    // Collect all <lines> text, preserving <br/> as newlines
    const parts = [];
    verse.querySelectorAll('lines').forEach(linesEl => {
      // Serialize innerHTML to handle <br/> tags
      const html = linesEl.innerHTML.replace(/<br\s*\/?>/gi, '\n');
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const t = tmp.textContent.trim();
      if (t) parts.push(t);
    });
    const lines = parts.join('\n').trim();
    if (!lines) return;

    let type = 'verse';
    let label = name;
    if (name.startsWith('c')) { type = 'chorus'; label = 'Chorus'; }
    else if (name.startsWith('b')) { type = 'bridge'; label = 'Bridge'; }
    else if (name.startsWith('e')) { type = 'ending'; label = 'Ending'; }
    else if (name.startsWith('v')) {
      const num = name.replace(/\D/g, '');
      label = `Verse ${num || 1}`;
    }

    slides.push({ id: uuidv4(), type, label, lines });
  });

  return { title, author, slides };
}

// ── Shared sub-components ─────────────────────────────────────────────────────

const inputStyle = {
  background: '#13171f', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: 12,
  fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const typeColors = {
  verse: '#4f8ef7', chorus: '#22c55e', bridge: '#a855f7',
  ending: '#f97316', intro: '#eab308', tag: '#ec4899', blank: '#555b6e', prechorus: '#06b6d4',
};

function SlidePreviewList({ slides }) {
  if (!slides.length) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
      No slides parsed yet
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {slides.map((s, i) => (
        <div key={s.id || i} style={{
          borderRadius: 6, border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: typeColors[s.type] || '#888',
              background: `${typeColors[s.type] || '#888'}22`,
              border: `1px solid ${typeColors[s.type] || '#888'}44`,
              borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.4px',
            }}>{s.type}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
          </div>
          <div style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {s.lines}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Genius Lyrics tab ─────────────────────────────────────────────────────────

const CCLI_NOTICE = 'Lyrics sourced from Genius are for internal, non-commercial church use only. Ensure you hold a valid CCLI license for any songs displayed publicly.';

function GeniusTab({ onImport }) {
  const { settings } = useApp();
  const apiKey = settings?.geniusApiKey || '';
  const hasKey = !!apiKey;

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [selectedHit, setSelectedHit] = useState(null);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [parsedSlides, setParsedSlides] = useState([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    if (!window.electronAPI) {
      setError('Genius search requires the desktop app — not available in browser mode.');
      return;
    }
    setSearching(true); setError(''); setResults(null);
    setSelectedHit(null); setParsedSlides([]); setDraftTitle(''); setDraftAuthor('');
    try {
      const hits = await window.electronAPI.searchGeniusSongs({ query: query.trim(), apiKey });
      setResults(hits);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, apiKey]);

  const selectHit = useCallback(async (hit) => {
    if (!window.electronAPI) return;
    setSelectedHit(hit);
    setParsedSlides([]);
    setDraftTitle(hit.title);
    setDraftAuthor(hit.artist);
    setFetchingLyrics(true);
    setError('');
    try {
      const raw = await window.electronAPI.fetchGeniusLyrics({ pageUrl: hit.url });
      setParsedSlides(parseSectionedText(raw));
    } catch (e) {
      setError('Could not fetch lyrics: ' + e.message);
    } finally {
      setFetchingLyrics(false);
    }
  }, []);

  if (!hasKey) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Genius API key not configured</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Go to <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Lyrics Search</strong> and enter your Genius Client Access Token to enable lyrics search.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
      {/* CCLI notice banner */}
      {!noticeDismissed && (
        <div style={{
          padding: '8px 14px', background: 'rgba(255,165,0,0.08)', borderBottom: '1px solid rgba(255,165,0,0.25)',
          display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <div style={{ flex: 1, fontSize: 11, color: 'rgba(255,165,0,0.9)', lineHeight: 1.5 }}>{CCLI_NOTICE}</div>
          <button onClick={() => setNoticeDismissed(true)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0,
          }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: search + results */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Song title or artist…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={search} disabled={!query.trim() || searching} style={{
              background: 'var(--accent)', border: 'none', color: '#fff',
              borderRadius: 6, padding: '0 12px', cursor: 'pointer', fontSize: 12,
              fontFamily: 'var(--font)', fontWeight: 600,
              opacity: (!query.trim() || searching) ? 0.5 : 1,
            }}>{searching ? '…' : 'Search'}</button>
          </div>

          {error && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--red)' }}>{error}</div>}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {results === null && !searching && (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
                Search Genius for worship song lyrics
              </div>
            )}
            {results?.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>No results found</div>
            )}
            {results?.map(hit => (
              <button key={hit.id} onClick={() => selectHit(hit)} style={{
                width: '100%', background: selectedHit?.id === hit.id ? 'rgba(79,142,247,0.12)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border)',
                borderLeft: selectedHit?.id === hit.id ? '3px solid var(--accent)' : '3px solid transparent',
                padding: '9px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                display: 'flex', gap: 10, alignItems: 'center',
              }}
                onMouseEnter={e => { if (selectedHit?.id !== hit.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (selectedHit?.id !== hit.id) e.currentTarget.style.background = 'transparent'; }}
              >
                {hit.thumbnail && (
                  <img src={hit.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hit.artist}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: preview + import */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedHit && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="Song title" style={{ ...inputStyle, flex: 1 }} />
              <input value={draftAuthor} onChange={e => setDraftAuthor(e.target.value)} placeholder="Artist" style={{ ...inputStyle, flex: 1 }} />
              <button
                disabled={!parsedSlides.length || !draftTitle.trim()}
                onClick={() => onImport({ title: draftTitle.trim(), author: draftAuthor.trim(), tags: ['contemporary'], slides: parsedSlides })}
                style={{
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  borderRadius: 6, padding: '0 16px', cursor: 'pointer', fontFamily: 'var(--font)',
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                  opacity: (!parsedSlides.length || !draftTitle.trim()) ? 0.45 : 1,
                }}
              >Import</button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {fetchingLyrics && (
              <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-dim)' }}>
                Fetching lyrics…
              </div>
            )}
            {!fetchingLyrics && <SlidePreviewList slides={parsedSlides} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PCO Search tab ────────────────────────────────────────────────────────────

function PcoTab({ onImport }) {
  const { settings } = useApp();
  const appId = settings?.pcoAppId || '';
  const secret = settings?.pcoSecret || '';
  const hasCredentials = appId && secret;

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [arrangements, setArrangements] = useState(null);
  const [loadingArr, setLoadingArr] = useState(false);
  const [selectedArr, setSelectedArr] = useState(null);
  const [parsedSlides, setParsedSlides] = useState([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');

  const search = useCallback(async () => {
    if (!query.trim() || !window.electronAPI) return;
    setSearching(true); setError(''); setResults(null); setSelectedSong(null);
    setArrangements(null); setSelectedArr(null); setParsedSlides([]); setDraftTitle(''); setDraftAuthor('');
    try {
      const data = await window.electronAPI.searchPcoSongs({ query: query.trim(), appId, secret });
      setResults(data.data || []);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, appId, secret]);

  const selectSong = useCallback(async (song) => {
    setSelectedSong(song);
    setArrangements(null); setSelectedArr(null); setParsedSlides([]);
    setDraftTitle(song.attributes?.title || '');
    setDraftAuthor(song.attributes?.author || '');
    setLoadingArr(true);
    try {
      const data = await window.electronAPI.fetchPcoArrangements({ songId: song.id, appId, secret });
      const arr = data.data || [];
      setArrangements(arr);
      if (arr.length === 1) pickArrangement(arr[0]);
    } catch (e) {
      setError('Could not load arrangements: ' + e.message);
    } finally {
      setLoadingArr(false);
    }
  }, [appId, secret]);

  const pickArrangement = (arr) => {
    setSelectedArr(arr);
    const chart = arr.attributes?.chord_chart || arr.attributes?.lyrics || '';
    setParsedSlides(parseSectionedText(chart));
  };

  if (!hasCredentials) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Planning Center credentials not configured</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Go to <strong style={{ color: 'var(--text-muted)' }}>⚙ Settings → Planning Center</strong> and enter your App ID and Secret to enable PCO song search.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
      {/* Left: search + results */}
      <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Song title or artist…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={search} disabled={!query.trim() || searching} style={{
            background: 'var(--accent)', border: 'none', color: '#fff',
            borderRadius: 6, padding: '0 12px', cursor: 'pointer', fontSize: 12,
            fontFamily: 'var(--font)', fontWeight: 600,
            opacity: (!query.trim() || searching) ? 0.5 : 1,
          }}>{searching ? '…' : 'Search'}</button>
        </div>

        {error && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--red)' }}>{error}</div>}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results === null && !searching && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              Search Planning Center for songs
            </div>
          )}
          {results?.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>No results found</div>
          )}
          {results?.map(song => (
            <button key={song.id} onClick={() => selectSong(song)} style={{
              width: '100%', background: selectedSong?.id === song.id ? 'rgba(79,142,247,0.12)' : 'transparent',
              border: 'none', borderBottom: '1px solid var(--border)',
              borderLeft: selectedSong?.id === song.id ? '3px solid var(--accent)' : '3px solid transparent',
              padding: '9px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
            }}
              onMouseEnter={e => { if (selectedSong?.id !== song.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (selectedSong?.id !== song.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{song.attributes?.title}</div>
              {song.attributes?.author && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{song.attributes.author}</div>
              )}
            </button>
          ))}
        </div>

        {/* Arrangements */}
        {selectedSong && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Arrangements</div>
            {loadingArr && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading…</div>}
            {arrangements?.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No arrangements found</div>}
            {arrangements?.map(arr => (
              <button key={arr.id} onClick={() => pickArrangement(arr)} style={{
                width: '100%', background: selectedArr?.id === arr.id ? 'rgba(79,142,247,0.1)' : 'transparent',
                border: `1px solid ${selectedArr?.id === arr.id ? 'rgba(79,142,247,0.4)' : 'var(--border)'}`,
                borderRadius: 5, padding: '5px 10px', cursor: 'pointer',
                color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 11, textAlign: 'left',
                marginBottom: 4,
              }}>{arr.attributes?.name || 'Arrangement'}</button>
            ))}
          </div>
        )}
      </div>

      {/* Right: preview + import controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedArr && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="Song title" style={{ ...inputStyle, flex: 1 }} />
            <input value={draftAuthor} onChange={e => setDraftAuthor(e.target.value)} placeholder="Author" style={{ ...inputStyle, flex: 1 }} />
            <button
              disabled={!parsedSlides.length || !draftTitle.trim()}
              onClick={() => onImport({ title: draftTitle.trim(), author: draftAuthor.trim(), slides: parsedSlides })}
              style={{
                background: 'var(--accent)', border: 'none', color: '#fff',
                borderRadius: 6, padding: '0 16px', cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                opacity: (!parsedSlides.length || !draftTitle.trim()) ? 0.45 : 1,
              }}
            >Import</button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <SlidePreviewList slides={parsedSlides} />
        </div>
      </div>
    </div>
  );
}

// ── OpenLyrics XML tab ────────────────────────────────────────────────────────

function OpenLyricsTab({ onImport }) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseOpenLyricsXml(e.target.result);
        if (!result.slides.length) throw new Error('No verses found in this OpenLyrics file.');
        setParsed(result);
      } catch (err) {
        setError(err.message);
        setParsed(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: file picker */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: 16, gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>OpenLyrics XML Import</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          OpenLyrics is a free, open-standard format for worship lyrics. Export songs from SongSelect, OpenLP, or download from{' '}
          <span style={{ color: 'var(--accent)' }}>openlyrics.info</span>.
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xml"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)',
            borderRadius: 8, color: 'var(--text-muted)', padding: '18px 12px',
            cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12,
            textAlign: 'center', lineHeight: 1.6,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          📂 Choose XML file
          {fileName && <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-dim)', wordBreak: 'break-all' }}>{fileName}</div>}
        </button>

        {error && <div style={{ fontSize: 11, color: 'var(--red)', lineHeight: 1.5 }}>{error}</div>}

        {parsed && (
          <button
            onClick={() => onImport({ title: parsed.title, author: parsed.author, slides: parsed.slides })}
            style={{
              background: 'var(--accent)', border: 'none', color: '#fff',
              borderRadius: 6, padding: '8px', cursor: 'pointer', fontFamily: 'var(--font)',
              fontSize: 12, fontWeight: 600,
            }}
          >Import "{parsed.title}"</button>
        )}
      </div>

      {/* Right: preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {parsed && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{parsed.title}</div>
            {parsed.author && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{parsed.author}</div>}
          </div>
        )}
        <SlidePreviewList slides={parsed?.slides || []} />
      </div>
    </div>
  );
}

// ── Paste Lyrics tab ──────────────────────────────────────────────────────────

const KEYS = ['', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TEMPOS = ['', 'Slow', 'Medium-Slow', 'Medium', 'Medium-Fast', 'Fast'];

function PasteTab({ onImport }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [songKey, setSongKey] = useState('');
  const [tempo, setTempo] = useState('');
  const [text, setText] = useState('');

  const slides = parseSectionedText(text);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: inputs */}
      <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, padding: 14, flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Song Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Amazing Grace" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Author</label>
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="John Newton" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Key</label>
            <select value={songKey} onChange={e => setSongKey(e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }}>
              {KEYS.map(k => <option key={k} value={k}>{k || '—'}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Tempo</label>
            <select value={tempo} onChange={e => setTempo(e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }}>
              {TEMPOS.map(t => <option key={t} value={t}>{t || '—'}</option>)}
            </select>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Lyrics</label>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{slides.length} slides</span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`[Verse 1]\nAmazing grace! How sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nMy chains are gone, I've been set free\nMy God, my Savior has ransomed me\n\n[Verse 2]\n'Twas grace that taught my heart to fear\nAnd grace my fears relieved`}
            style={{
              ...inputStyle,
              height: 240,
              resize: 'vertical',
              lineHeight: 1.6,
              fontSize: 11,
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Use <strong style={{ color: 'var(--text-muted)' }}>[Section Name]</strong> markers to create slides. e.g. [Verse 1], [Chorus], [Bridge].
          </div>
        </div>

        <button
          onClick={() => onImport({ title: title.trim(), author: author.trim(), key: songKey, tempo, slides })}
          disabled={!title.trim() || !slides.length}
          style={{
            background: 'var(--accent)', border: 'none', color: '#fff',
            borderRadius: 6, padding: '9px', cursor: 'pointer', fontFamily: 'var(--font)',
            fontSize: 12, fontWeight: 600, marginTop: 4,
            opacity: (!title.trim() || !slides.length) ? 0.45 : 1,
          }}
        >Import Song</button>
      </div>

      {/* Right: preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
          {slides.length ? 'Slide preview — updates as you type' : 'Enter lyrics with [Section] markers to see a preview'}
        </div>
        <SlidePreviewList slides={slides} />
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'genius', label: '🎵 Genius Lyrics' },
  { id: 'pco', label: '📋 Planning Center' },
  { id: 'openlyrics', label: '📄 OpenLyrics XML' },
  { id: 'paste', label: '📝 Paste Lyrics' },
];

export default function SongImportModal({ onClose }) {
  const { addSong } = useApp();
  const [activeTab, setActiveTab] = useState('paste');
  const [imported, setImported] = useState(null);

  const handleImport = useCallback(({ title, author, key, tempo, tags, slides }) => {
    if (!title || !slides?.length) return;
    const song = addSong({
      title,
      author: author || '',
      key: key || '',
      tempo: tempo || '',
      tags: Array.isArray(tags) ? tags : [],
      slides,
      background: { type: 'color', value: '#0a0f1e' },
      textColor: '#ffffff',
      fontSize: 44,
      fontFamily: 'Georgia',
    });
    setImported(song.title || title);
  }, [addSong]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 820, maxWidth: '95vw', height: 600, maxHeight: '90vh',
        background: 'var(--bg-panel)', borderRadius: 10,
        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>📥</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Import Song</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Search Genius Lyrics, Planning Center, import OpenLyrics XML, or paste lyrics</div>
          </div>
          {imported && (
            <div style={{
              fontSize: 11, color: 'var(--green)', background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '4px 12px',
            }}>
              ✓ "{imported}" added to library
            </div>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '6px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font)',
          }}>Close</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: '8px 16px', fontSize: 12, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font)', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeTab === 'genius' && <GeniusTab onImport={handleImport} />}
          {activeTab === 'pco' && <PcoTab onImport={handleImport} />}
          {activeTab === 'openlyrics' && <OpenLyricsTab onImport={handleImport} />}
          {activeTab === 'paste' && <PasteTab onImport={handleImport} />}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { v4 as uuidv4 } from 'uuid';
import {
  QUICK_REFERENCES,
  BIBLE_TEXTS,
  searchByReference,
  searchByKeyword,
  loadBibleTranslation,
  fetchOnlineTranslations,
  fetchOfflineTranslations,
  loadOfflineTranslation,
  searchHelloaoByReference,
  parseBebliaXml,
} from '../data/bible';

// ── Helpers ──────────────────────────────────────────────────────────────────

const verseKey = (v) => `${v.version || ''}:${v.reference}`;

const isReference = (q) => /\d/.test(q);

// Build an offline favorite object from an offline index entry
function buildOfflineFavorite(entry) {
  return {
    id: `offline:${entry.id}`,
    name: entry.name,
    shortName: entry.id,
    filename: entry.filename,
    isOffline: true,
  };
}

// Ensure a BIBLE_TEXTS key is loaded for the given favorite
async function ensureLoaded(fav, localDir) {
  if (fav.isImported) return; // already in memory from init
  const bareId = fav.id.startsWith('offline:') ? fav.id.slice('offline:'.length) : fav.id;
  const textKey = `offline:${bareId}`;
  if (!Object.keys(BIBLE_TEXTS[textKey] || {}).length) {
    await loadOfflineTranslation(bareId, fav.filename, localDir || null);
  }
}

function favTextKey(fav) {
  if (fav.isImported) return fav.id;
  const bareId = fav.id.startsWith('offline:') ? fav.id.slice('offline:'.length) : fav.id;
  return `offline:${bareId}`;
}

function favDisplayLabel(fav) {
  if (fav.isImported) return fav.id;
  return fav.shortName || (fav.id.startsWith('offline:') ? fav.id.slice('offline:'.length) : fav.id);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 10px',
  fontSize: 12, outline: 'none', fontFamily: 'var(--font)', width: '100%',
  boxSizing: 'border-box',
};

const chipStyle = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 3,
  background: active ? 'rgba(79,142,247,0.2)' : 'var(--bg-hover)',
  border: `1px solid ${active ? 'rgba(79,142,247,0.5)' : 'var(--border)'}`,
  borderRadius: 12, padding: '2px 8px', fontSize: 10,
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  cursor: 'pointer', userSelect: 'none',
});

// ── Translation Browser overlay ───────────────────────────────────────────────

function TranslationBrowser({ onlineVersions, offlineVersions, favoriteIds, onToggleFavorite, onClose, defaultTab, bibleXmlDir, onSetBibleXmlDir }) {
  const [tab, setTab] = useState(defaultTab || 'online');
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tab === 'online' ? onlineVersions : offlineVersions;
    if (!q) return list.slice(0, 100);
    return list.filter(v =>
      (v.id || '').toLowerCase().includes(q) ||
      (v.shortName || '').toLowerCase().includes(q) ||
      (v.name || '').toLowerCase().includes(q) ||
      (v.languageName || '').toLowerCase().includes(q) ||
      (v.language || '').toLowerCase().includes(q)
    ).slice(0, 100);
  }, [query, tab, onlineVersions, offlineVersions]);

  const tabBtn = (t, label) => (
    <button onClick={() => setTab(t)} style={{
      padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
      background: tab === t ? 'var(--accent)' : 'transparent',
      border: tab === t ? 'none' : '1px solid var(--border)',
      color: tab === t ? '#fff' : 'var(--text-muted)',
      fontFamily: 'var(--font)',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      background: 'var(--bg-sidebar)',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
        }}>←</button>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', flex: 1 }}>
          Browse Translations
        </span>
      </div>

      {/* Mode tabs */}
      <div style={{ padding: '8px 10px 0', display: 'flex', gap: 4 }}>
        {tabBtn('online', `Online (${onlineVersions.length})`)}
        {tabBtn('offline', `Offline (${offlineVersions.length})`)}
      </div>

      {/* Filter input */}
      <div style={{ padding: '8px 10px 0' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name or language…"
          style={inputStyle}
        />
      </div>

      {/* Offline info */}
      {tab === 'offline' && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {offlineVersions.length} translations bundled — star to favorite. Favorited translations load on first search.
        </div>
      )}

      {/* XML import (offline tab only) */}
      {tab === 'offline' && <ImportXmlButton offlineVersions={offlineVersions} />}
      {tab === 'offline' && <BibleFolderPicker bibleXmlDir={bibleXmlDir} onSetBibleXmlDir={onSetBibleXmlDir} />}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {tab === 'online' && onlineVersions.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '16px 8px', textAlign: 'center' }}>
            Loading translations…
          </div>
        )}
        {tab === 'offline' && offlineVersions.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '16px 8px', textAlign: 'center' }}>
            Loading offline index…
          </div>
        )}
        {filtered.map(v => {
          const favId = tab === 'offline' ? `offline:${v.id}` : v.id;
          const fav = favoriteIds.includes(favId);
          const handleToggle = () => {
            if (tab === 'offline') {
              onToggleFavorite({ id: `offline:${v.id}`, name: v.name, shortName: v.id, filename: v.filename, isOffline: true });
            } else {
              onToggleFavorite({ ...v, isOffline: false });
            }
          };
          return (
            <div key={favId} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
              borderRadius: 5, marginBottom: 2,
              background: fav ? 'rgba(79,142,247,0.07)' : 'transparent',
              border: `1px solid ${fav ? 'rgba(79,142,247,0.2)' : 'transparent'}`,
            }}>
              <button
                onClick={handleToggle}
                title={fav ? 'Remove from favorites' : 'Add to favorites'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0,
                  color: fav ? '#fbbf24' : 'var(--text-dim)',
                }}
              >{fav ? '★' : '☆'}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--text)' }}>
                  {tab === 'offline' ? v.id : (v.shortName || v.id)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>
                  {v.name}
                </span>
                {v.languageName && v.languageName !== v.language && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
                    · {v.languageName}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Beblia XML import button ───────────────────────────────────────────────────

function ImportXmlButton({ offlineVersions }) {
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStatus('Parsing…');
    try {
      const text = await file.text();
      const passages = parseBebliaXml(text);
      const count = Object.keys(passages).length;
      if (count === 0) {
        setStatus('No verses found. Check the XML format.');
        return;
      }
      const label = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toUpperCase().slice(0, 12);
      loadBibleTranslation(label, passages);
      try {
        localStorage.setItem(`cp_bible_xml_${label}`, JSON.stringify(passages));
      } catch { /* quota exceeded — in-memory only */ }
      setStatus(`✓ ${count.toLocaleString()} verses loaded as "${label}"`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, lineHeight: 1.5 }}>
        Import a Beblia Holy-Bible-XML-Format file for offline text search.{' '}
        <a
          href="https://github.com/Beblia/Holy-Bible-XML-Format"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onClick={e => e.stopPropagation()}
        >Download translations ↗</a>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xml"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 4,
          cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
        }}
      >+ Import XML Bible</button>
      {status && (
        <div style={{ fontSize: 10, marginTop: 4, color: status.startsWith('✓') ? 'var(--green)' : 'var(--yellow)' }}>
          {status}
        </div>
      )}
    </div>
  );
}

function BibleFolderPicker({ bibleXmlDir, onSetBibleXmlDir }) {
  const [status, setStatus] = useState('');
  const isElectron = !!window.electronAPI?.selectDirectory;
  if (!isElectron) return null;

  const handleBrowse = async () => {
    const dir = await window.electronAPI.selectDirectory();
    if (!dir) return;
    onSetBibleXmlDir(dir);
    setStatus('✓ Folder saved');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleClear = () => { onSetBibleXmlDir(''); setStatus(''); };

  return (
    <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, lineHeight: 1.5 }}>
        Bible XML folder — point to your local{' '}
        <a href="https://github.com/Beblia/Holy-Bible-XML-Format" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onClick={e => e.stopPropagation()}>Beblia collection ↗</a>
        {' '}to enable all 1,000+ offline translations.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={handleBrowse} style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 4,
          cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', flexShrink: 0,
        }}>Browse…</button>
        {bibleXmlDir && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={bibleXmlDir}>{bibleXmlDir}</span>
        )}
        {bibleXmlDir && (
          <button onClick={handleClear} style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1, flexShrink: 0,
          }} title="Clear">×</button>
        )}
      </div>
      {status && (
        <div style={{ fontSize: 10, marginTop: 4, color: 'var(--green)' }}>{status}</div>
      )}
      {!bibleXmlDir && (
        <div style={{ fontSize: 10, marginTop: 4, color: 'var(--yellow)' }}>
          No folder set — only individually imported XML files will work offline.
        </div>
      )}
    </div>
  );
}

// ── Main BiblePanel ───────────────────────────────────────────────────────────

export default function BiblePanel() {
  const { addToSchedule, goLiveProgram, settings, saveSettings } = useApp();

  // ── Translation data ──────────────────────────────────────────────────────
  const [onlineVersions, setOnlineVersions] = useState([]);
  const [offlineVersions, setOfflineVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState('');

  // ── Mode: 'offline' | 'online' ───────────────────────────────────────────
  const [bibleMode, setBibleMode] = useState(() => settings?.bibleMode || 'offline');

  // ── Favorites: separate lists per mode ───────────────────────────────────
  // offlineFavorites: [{id:'offline:XYZ', name, shortName, filename, isOffline:true}]
  // onlineFavorites:  [{id:'en_kjv', name, shortName, isOffline:false}]
  const [offlineFavorites, setOfflineFavorites] = useState([]);
  const [onlineFavorites, setOnlineFavorites] = useState([]);

  // Active mode favorites (for rendering and searching)
  const activeFavorites = bibleMode === 'offline' ? offlineFavorites : onlineFavorites;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showTranslationBrowser, setShowTranslationBrowser] = useState(false);
  const [parallelMode, setParallelMode] = useState(false);
  const [parallelVerAId, setParallelVerAId] = useState(null);
  const [parallelVerBId, setParallelVerBId] = useState(null);

  // ── Search state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRefs, setSelectedRefs] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Load offline versions from bundled index ──────────────────────────────
  useEffect(() => {
    fetchOfflineTranslations().then(list => setOfflineVersions(list)).catch(() => {});
    // Restore any manually-imported XML Bibles from localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cp_bible_xml_')) {
          const label = key.slice('cp_bible_xml_'.length);
          if (!BIBLE_TEXTS[label]) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try { loadBibleTranslation(label, JSON.parse(raw)); } catch { /* corrupt */ }
            }
          }
        }
      }
    } catch { /* quota/security */ }
  }, []);

  // ── Load online translations ──────────────────────────────────────────────
  useEffect(() => {
    setVersionsLoading(true);
    fetchOnlineTranslations((freshVersions) => setOnlineVersions(freshVersions))
      .then(v => { setOnlineVersions(v); setVersionsError(''); })
      .catch(err => setVersionsError(err.message || 'Failed to load translations'))
      .finally(() => setVersionsLoading(false));
  }, []);

  // ── Sync bibleMode from settings ─────────────────────────────────────────
  useEffect(() => {
    if (settings?.bibleMode && settings.bibleMode !== bibleMode) {
      setBibleMode(settings.bibleMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.bibleMode]);

  // ── Hydrate offline favorites from settings ───────────────────────────────
  useEffect(() => {
    const ids = (settings?.bibleOfflineFavoriteIds || [])
      .map(id => typeof id === 'string' ? id : (typeof id?.id === 'string' ? id.id : null))
      .filter(id => id && id.startsWith('offline:'));
    if (!ids.length) { setOfflineFavorites([]); return; }
    if (!offlineVersions.length) return; // wait until index is loaded
    const hydrated = ids.map(id => {
      const bareId = id.slice('offline:'.length);
      const entry = offlineVersions.find(v => v.id === bareId);
      return entry ? buildOfflineFavorite(entry) : null;
    }).filter(Boolean);
    setOfflineFavorites(hydrated);
  }, [settings?.bibleOfflineFavoriteIds, offlineVersions]);

  // ── Hydrate online favorites from settings ────────────────────────────────
  useEffect(() => {
    const ids = (settings?.bibleOnlineFavoriteIds || [])
      .map(id => typeof id === 'string' ? id : (typeof id?.id === 'string' ? id.id : null))
      .filter(id => id && !id.startsWith('offline:'));
    if (!ids.length) { setOnlineFavorites([]); return; }
    if (!onlineVersions.length) return;
    const hydrated = ids.map(id => {
      const online = onlineVersions.find(v => v.id === id);
      return online ? { ...online, isOffline: false } : null;
    }).filter(Boolean);
    setOnlineFavorites(hydrated);
  }, [settings?.bibleOnlineFavoriteIds, onlineVersions]);

  // ── Parallel version defaults ─────────────────────────────────────────────
  useEffect(() => {
    if (parallelMode) {
      if (!parallelVerAId && activeFavorites.length >= 1) setParallelVerAId(activeFavorites[0].id);
      if (!parallelVerBId && activeFavorites.length >= 2) setParallelVerBId(activeFavorites[1].id);
    }
  }, [parallelMode, activeFavorites, parallelVerAId, parallelVerBId]);

  // ── Mode switcher ─────────────────────────────────────────────────────────
  const switchMode = useCallback((mode) => {
    setBibleMode(mode);
    saveSettings({ bibleMode: mode });
    // Reset parallel selections when mode changes
    setParallelVerAId(null);
    setParallelVerBId(null);
    setResults([]);
    setSearched(false);
    setMessage('');
  }, [saveSettings]);

  // ── Toggle a version in/out of favorites (mode-specific) ─────────────────
  const toggleFavorite = useCallback((v) => {
    if (v.isOffline) {
      setOfflineFavorites(prev => {
        const next = prev.some(f => f.id === v.id)
          ? prev.filter(f => f.id !== v.id)
          : [...prev, v];
        saveSettings({ bibleOfflineFavoriteIds: next.map(f => f.id) });
        return next;
      });
    } else {
      setOnlineFavorites(prev => {
        const next = prev.some(f => f.id === v.id)
          ? prev.filter(f => f.id !== v.id)
          : [...prev, v];
        saveSettings({ bibleOnlineFavoriteIds: next.map(f => f.id) });
        return next;
      });
    }
  }, [saveSettings]);

  const removeFavorite = useCallback((id) => {
    if (id.startsWith('offline:')) {
      setOfflineFavorites(prev => {
        const next = prev.filter(f => f.id !== id);
        saveSettings({ bibleOfflineFavoriteIds: next.map(f => f.id) });
        return next;
      });
    } else {
      setOnlineFavorites(prev => {
        const next = prev.filter(f => f.id !== id);
        saveSettings({ bibleOnlineFavoriteIds: next.map(f => f.id) });
        return next;
      });
    }
  }, [saveSettings]);

  // ── All offline versions available (index + imported) ────────────────────
  const allOfflineVersions = useMemo(() => {
    const importedKeys = Object.keys(BIBLE_TEXTS).filter(k => !k.startsWith('offline:'));
    const importedEntries = importedKeys.map(k => ({ id: k, name: k, filename: null, isImported: true }));
    return [...offlineVersions, ...importedEntries];
  }, [offlineVersions]);

  // ── Clear ────────────────────────────────────────────────────────────────
  const clearResults = () => {
    setResults([]); setSearch(''); setSearched(false);
    setSelectedRefs(new Set()); setMessage('');
    setSuggestions([]); setShowSuggestions(false);
  };

  // ── Online reference search (helloao) ────────────────────────────────────
  const searchOnline = async (query, versionsToUse) => {
    const allResults = [];
    for (const ver of versionsToUse) {
      try {
        const hits = await searchHelloaoByReference(query, ver.id);
        hits.forEach(h => allResults.push({ ...h, version: ver.shortName || ver.id, versionId: ver.id }));
      } catch (err) {
        console.warn(`[Bible] Online fetch failed for ${ver.id}:`, err.message);
      }
    }
    return allResults;
  };

  // ── Offline search (reference) ────────────────────────────────────────────
  const searchOfflineByRef = useCallback(async (query, versionsToUse) => {
    const allResults = [];
    for (const fav of versionsToUse) {
      const textKey = favTextKey(fav);
      const displayLabel = favDisplayLabel(fav);
      try {
        await ensureLoaded(fav, settings?.bibleXmlDir || '');
        const hits = searchByReference(query, textKey);
        for (const r of hits) {
          allResults.push({ ...r, version: displayLabel });
        }
      } catch (err) {
        console.warn(`[Bible] Offline ref search in ${textKey} failed:`, err.message);
      }
    }
    return allResults;
  }, [settings?.bibleXmlDir]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Offline keyword search — cross-version ────────────────────────────────
  // Finds matching references in all favorited versions, then fetches that verse
  // from EVERY favorited version so each reference appears in all translations.
  const searchOfflineByKeyword = useCallback(async (query, versionsToUse) => {
    if (!versionsToUse.length) return [];

    // Step 1: collect matching references from all versions
    const matchingRefs = new Set();
    for (const fav of versionsToUse) {
      const textKey = favTextKey(fav);
      try {
        await ensureLoaded(fav, settings?.bibleXmlDir || '');
        const hits = searchByKeyword(query, textKey);
        hits.forEach(h => matchingRefs.add(h.reference));
      } catch (err) {
        console.warn(`[Bible] Keyword search in ${favTextKey(fav)} failed:`, err.message);
      }
    }

    if (matchingRefs.size === 0) return [];

    // Step 2: for each matched reference, get the verse from ALL versions
    const allResults = [];
    for (const ref of matchingRefs) {
      for (const fav of versionsToUse) {
        const textKey = favTextKey(fav);
        const displayLabel = favDisplayLabel(fav);
        try {
          const hits = searchByReference(ref, textKey);
          if (hits.length > 0) {
            allResults.push({ ...hits[0], version: displayLabel });
          }
        } catch { /* skip */ }
      }
    }
    return allResults;
  }, [settings?.bibleXmlDir]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main search ───────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q = search) => {
    const query = q.trim();
    if (!query) return;

    setSearched(true);
    setLoading(true);
    setMessage('');
    setSelectedRefs(new Set());
    setShowSuggestions(false);
    setResults([]);

    const isRef = isReference(query);

    // Determine which versions to search based on active mode
    const onlineFavs = bibleMode === 'online' ? onlineFavorites : [];
    const offlineFavs = bibleMode === 'offline' ? offlineFavorites : [];
    const hasOnlineFavs = onlineFavs.length > 0;
    const hasOfflineFavs = offlineFavs.length > 0;

    // Defaults when no favorites set
    const defaultOnline = onlineVersions.length > 0 ? [{ ...onlineVersions[0], isOffline: false }] : [];
    const defaultOffline = allOfflineVersions.length > 0
      ? [allOfflineVersions[0].isImported
          ? { ...allOfflineVersions[0], isImported: true }
          : buildOfflineFavorite(allOfflineVersions[0])]
      : [];

    try {
      if (!isRef) {
        // Keyword search — only available offline
        if (bibleMode === 'online') {
          setMessage('Text search is only available in Offline mode. Switch to Offline above.');
          setLoading(false);
          return;
        }
        if (!hasOfflineFavs && allOfflineVersions.length === 0) {
          setMessage('keyword-offline-needed');
          setLoading(false);
          return;
        }
        const versionsToSearch = hasOfflineFavs ? offlineFavs : defaultOffline;

        if (parallelMode) {
          // Keyword + parallel: find matching refs across all favorites, then build {a, b} pairs
          const verAObj = activeFavorites.find(f => f.id === parallelVerAId) || activeFavorites[0];
          const verBObj = activeFavorites.find(f => f.id === parallelVerBId) || activeFavorites[1];

          // Step 1: collect matching references from all active versions
          const matchingRefs = new Set();
          for (const fav of versionsToSearch) {
            try {
              await ensureLoaded(fav, settings?.bibleXmlDir || '');
              searchByKeyword(query, favTextKey(fav)).forEach(h => matchingRefs.add(h.reference));
            } catch { /* skip */ }
          }

          if (matchingRefs.size === 0) {
            setResults([]);
            setMessage('No verses found.');
            setLoading(false);
            return;
          }

          // Step 2: for each reference, fetch verA and verB text
          const getVerse = async (fav, ref) => {
            if (!fav) return null;
            try {
              await ensureLoaded(fav, settings?.bibleXmlDir || '');
              const hits = searchByReference(ref, favTextKey(fav));
              return hits[0] ? { ...hits[0], version: favDisplayLabel(fav) } : null;
            } catch { return null; }
          };

          const pairs = [];
          for (const ref of matchingRefs) {
            const [a, b] = await Promise.all([getVerse(verAObj, ref), getVerse(verBObj, ref)]);
            if (a || b) pairs.push({ a, b });
          }
          setResults(pairs);
          if (pairs.length === 0) setMessage('No verses found.');
          setLoading(false);
          return;
        }

        // Non-parallel keyword search — flat cross-version results
        const hits = await searchOfflineByKeyword(query, versionsToSearch);
        setResults(hits);
        if (hits.length === 0) setMessage('No verses found.');
        setLoading(false);
        return;
      }

      // Reference search
      if (parallelMode) {
        const verAObj = activeFavorites.find(f => f.id === parallelVerAId) || activeFavorites[0];
        const verBObj = activeFavorites.find(f => f.id === parallelVerBId) || activeFavorites[1];

        const searchOne = (ver) => {
          if (!ver) return Promise.resolve([]);
          if (bibleMode === 'offline') return searchOfflineByRef(query, [ver]);
          return searchOnline(query, [ver]);
        };

        const [hitsA, hitsB] = await Promise.all([searchOne(verAObj), searchOne(verBObj)]);

        // Zip by verse reference
        const byRef = {};
        hitsA.forEach(v => { byRef[v.reference] = { a: v, b: null }; });
        hitsB.forEach(v => {
          if (byRef[v.reference]) byRef[v.reference].b = v;
          else byRef[v.reference] = { a: null, b: v };
        });
        const pairs = Object.values(byRef);
        setResults(pairs);
        if (pairs.length === 0) setMessage('No verses found for that reference.');
      } else {
        // Standard reference search across all active mode favorites
        let hits = [];
        if (bibleMode === 'offline') {
          const versions = hasOfflineFavs ? offlineFavs : defaultOffline;
          hits = await searchOfflineByRef(query, versions);
        } else {
          const versions = hasOnlineFavs ? onlineFavs : defaultOnline;
          hits = await searchOnline(query, versions);
        }
        setResults(hits);
        if (hits.length === 0) setMessage('No verses found. Try "John 3:16" or a book chapter.');
      }
    } catch (err) {
      setMessage(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [search, bibleMode, offlineFavorites, onlineFavorites, onlineVersions, allOfflineVersions,
      parallelMode, parallelVerAId, parallelVerBId, activeFavorites,
      searchOfflineByRef, searchOfflineByKeyword, settings?.bibleXmlDir]);

  // ── Keyboard submit ───────────────────────────────────────────────────────
  const handleKey = (e) => { if (e.key === 'Enter') runSearch(); };

  // ── Offline autocomplete ──────────────────────────────────────────────────
  const updateSuggestions = (value) => {
    if (!value.trim()) { setSuggestions([]); return; }
    let textKey = null, displayLabel = null;
    for (const entry of allOfflineVersions) {
      const k = entry.isImported ? entry.id : `offline:${entry.id}`;
      if (Object.keys(BIBLE_TEXTS[k] || {}).length > 0) {
        textKey = k;
        displayLabel = entry.shortName || entry.id || k;
        break;
      }
    }
    if (!textKey) { setSuggestions([]); return; }
    const seen = new Set();
    const merged = [];
    for (const item of [...searchByReference(value, textKey), ...searchByKeyword(value, textKey)]) {
      if (!seen.has(item.reference)) {
        seen.add(item.reference);
        merged.push({ ...item, version: displayLabel });
        if (merged.length >= 8) break;
      }
    }
    setSuggestions(merged);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setShowSuggestions(true);
    updateSuggestions(value);
  };

  const applySuggestion = (reference) => {
    setSearch(reference);
    setShowSuggestions(false);
    runSearch(reference);
  };

  // ── Verse selection ───────────────────────────────────────────────────────
  const toggleVerseSelection = (verse) => {
    const key = verseKey(verse);
    setSelectedRefs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const addVerses = (verses) => {
    if (!verses.length) return;
    const firstRef = verses[0].reference;
    const lastRef = verses[verses.length - 1].reference;
    const title = verses.length === 1 ? firstRef : `${firstRef}–${lastRef.split(':')[1]}`;
    const versionLabel = verses[0].version || 'Bible';
    addToSchedule({
      type: 'scripture', title, reference: title, version: versionLabel,
      slides: verses.map(v => ({
        id: uuidv4(), type: 'scripture', label: v.reference,
        lines: `${v.text}\n\n— ${v.reference} (${v.version || 'Bible'})`,
      })),
      background: { type: 'color', value: '#0a1a0f' },
      textColor: '#ffffff', fontSize: 38, fontFamily: 'Georgia',
    });
  };

  const addParallelPair = (pair) => {
    const ref = pair.a?.reference || pair.b?.reference || '';
    const verA = pair.a?.version || '';
    const verB = pair.b?.version || '';
    addToSchedule({
      type: 'scripture',
      title: `${ref} (${verA}/${verB})`,
      reference: ref,
      version: `${verA}/${verB}`,
      slides: [{
        id: uuidv4(), type: 'scripture', label: ref,
        lines: [
          pair.a ? `${pair.a.text}\n— ${ref} (${verA})` : '',
          pair.b ? `${pair.b.text}\n— ${ref} (${verB})` : '',
        ].filter(Boolean).join('\n\n'),
      }],
      background: { type: 'color', value: '#0a1a0f' },
      textColor: '#ffffff', fontSize: 32, fontFamily: 'Georgia',
    });
  };

  // Build the styling item every scripture slide shares so live output
  // renders with the same look-and-feel as a scheduled scripture.
  const scriptureItem = (title, ref, ver, fontSize = 38) => ({
    type: 'scripture', title, reference: ref, version: ver,
    background: { type: 'color', value: '#0a1a0f' },
    textColor: '#ffffff', fontSize, fontFamily: 'Georgia',
  });

  // Send a single verse (or the first of a range) straight to the program
  // output without touching the schedule. Convenience for live preaching.
  const goLiveVerse = (verse) => {
    const slide = {
      id: uuidv4(), type: 'scripture', label: verse.reference,
      lines: `${verse.text}\n\n— ${verse.reference} (${verse.version || 'Bible'})`,
    };
    const item = scriptureItem(verse.reference, verse.reference, verse.version || 'Bible');
    goLiveProgram({ ...slide, item });
  };

  const goLiveParallelPair = (pair) => {
    const ref = pair.a?.reference || pair.b?.reference || '';
    const verA = pair.a?.version || '';
    const verB = pair.b?.version || '';
    const slide = {
      id: uuidv4(), type: 'scripture', label: ref,
      lines: [
        pair.a ? `${pair.a.text}\n— ${ref} (${verA})` : '',
        pair.b ? `${pair.b.text}\n— ${ref} (${verB})` : '',
      ].filter(Boolean).join('\n\n'),
    };
    const item = scriptureItem(`${ref} (${verA}/${verB})`, ref, `${verA}/${verB}`, 32);
    goLiveProgram({ ...slide, item });
  };

  const addSelectedVerses = () => {
    if (parallelMode) {
      results.filter((_, i) => selectedRefs.has(String(i))).forEach(addParallelPair);
    } else {
      const selected = results.filter(v => selectedRefs.has(verseKey(v)));
      if (selected.length) addVerses(selected);
    }
    setSelectedRefs(new Set());
  };

  // ── Version summary label ─────────────────────────────────────────────────
  const searchVersionLabel = useMemo(() => {
    if (activeFavorites.length === 0) return 'no favorites set';
    return activeFavorites.map(f => f.shortName || f.id).join(', ');
  }, [activeFavorites]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'relative',
    }}>
      {/* Translation browser overlay */}
      {showTranslationBrowser && (
        <TranslationBrowser
          onlineVersions={onlineVersions}
          offlineVersions={offlineVersions}
          favoriteIds={[...offlineFavorites.map(f => f.id), ...onlineFavorites.map(f => f.id)]}
          onToggleFavorite={toggleFavorite}
          onClose={() => setShowTranslationBrowser(false)}
          defaultTab={bibleMode}
          bibleXmlDir={settings?.bibleXmlDir || ''}
          onSetBibleXmlDir={dir => saveSettings({ bibleXmlDir: dir })}
        />
      )}

      {/* Header */}
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ flex: 1 }}>📖 Bible Search</span>
        {versionsLoading && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Loading…</span>}
        {versionsError && (
          <span title={versionsError} style={{ fontSize: 9, color: 'var(--yellow)', cursor: 'help' }}>⚠ offline</span>
        )}
      </div>

      {/* ── Online / Offline mode toggle (prominent top-level) ── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          display: 'flex', borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--border)', flexShrink: 0,
        }}>
          {['offline', 'online'].map(mode => (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              style={{
                padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)',
                background: bibleMode === mode ? 'var(--accent)' : 'transparent',
                color: bibleMode === mode ? '#fff' : 'var(--text-muted)',
                border: 'none', fontWeight: bibleMode === mode ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >{mode === 'offline' ? '📂 Offline' : '🌐 Online'}</button>
          ))}
        </div>
        <button
          onClick={() => setShowTranslationBrowser(true)}
          style={{
            background: 'none', border: '1px dashed var(--border)',
            color: 'var(--text-dim)', borderRadius: 6, padding: '4px 8px',
            cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
          }}
        >+ Manage</button>
      </div>

      {/* Favorites row */}
      <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        {activeFavorites.length === 0 ? (
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            No {bibleMode} favorites.{' '}
            <button
              onClick={() => setShowTranslationBrowser(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}
            >Add translations</button>
          </span>
        ) : (
          activeFavorites.map(f => (
            <span key={f.id} style={chipStyle(true)}>
              {f.isOffline ? '📂 ' : '🌐 '}{f.shortName || f.id}
              <button
                onClick={() => removeFavorite(f.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, fontSize: 11, lineHeight: 1 }}
              >×</button>
            </span>
          ))
        )}
      </div>

      {/* Parallel toggle */}
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5, borderBottom: '1px solid var(--border)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: parallelMode ? 'var(--accent)' : 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={parallelMode}
            onChange={e => setParallelMode(e.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          ◫ Parallel comparison
        </label>
        {parallelMode && (
          activeFavorites.length < 2 ? (
            <span style={{ fontSize: 10, color: 'var(--yellow)' }}>Add 2+ {bibleMode} favorites to use parallel mode</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 18 }}>
              <select
                value={parallelVerAId || activeFavorites[0]?.id || ''}
                onChange={e => setParallelVerAId(e.target.value)}
                style={{
                  flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--accent)', borderRadius: 4, fontSize: 10, padding: '2px 4px',
                  fontFamily: 'var(--font)', cursor: 'pointer',
                }}
              >
                {activeFavorites.map(f => (
                  <option key={f.id} value={f.id}>{f.shortName || f.id}</option>
                ))}
              </select>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>⇄</span>
              <select
                value={parallelVerBId || activeFavorites[1]?.id || ''}
                onChange={e => setParallelVerBId(e.target.value)}
                style={{
                  flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text)', borderRadius: 4, fontSize: 10, padding: '2px 4px',
                  fontFamily: 'var(--font)', cursor: 'pointer',
                }}
              >
                {activeFavorites.map(f => (
                  <option key={f.id} value={f.id}>{f.shortName || f.id}</option>
                ))}
              </select>
            </div>
          )
        )}
      </div>

      {/* Search bar */}
      <div style={{ padding: '6px 8px', display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={bibleMode === 'offline' ? 'John 3:16 or "grace"' : 'John 3:16'}
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; setTimeout(() => setShowSuggestions(false), 150); }}
          />
          {/* Offline suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
              borderRadius: 4, marginTop: 2, maxHeight: 200, overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              {suggestions.map(sug => (
                <button key={sug.reference} onMouseDown={() => applySuggestion(sug.reference)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                  background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer',
                  fontSize: 11, fontFamily: 'var(--font)', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 10 }}>{sug.reference}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sug.text}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => runSearch()} style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font)', fontWeight: 500, flexShrink: 0,
        }}>Search</button>
        {searched && (
          <button onClick={clearResults} title="Clear" style={{
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '7px 9px', borderRadius: 'var(--radius)', cursor: 'pointer',
            fontSize: 12, lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        )}
      </div>

      {/* Mode-specific banners */}
      {message === 'keyword-offline-needed' && (
        <div style={{
          margin: '0 8px 6px', padding: '8px 10px', borderRadius: 6,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
          fontSize: 11, color: 'var(--yellow)', lineHeight: 1.6,
        }}>
          <strong>Text search requires offline translations.</strong><br />
          Open{' '}
          <button
            onClick={() => setShowTranslationBrowser(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}
          >Manage → Offline</button>{' '}and star a translation to favorite it.
        </div>
      )}
      {message && message !== 'keyword-offline-needed' && searched && !loading && results.length === 0 && (
        <div style={{ padding: '8px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
          {message}
        </div>
      )}

      {/* Quick references */}
      {!searched && (
        <div style={{ padding: '0 8px 8px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Quick access:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {QUICK_REFERENCES.map(ref => (
              <button key={ref} onClick={() => { setSearch(ref); runSearch(ref); }} style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontFamily: 'var(--font)',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(79,142,247,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >{ref}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
            {activeFavorites.length > 0
              ? <>Searches across: <span style={{ color: 'var(--accent)' }}>{searchVersionLabel}</span></>
              : <>{bibleMode === 'offline' ? '📂' : '🌐'} No favorites — <button onClick={() => setShowTranslationBrowser(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}>pick translations</button></>
            }
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {searched && loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Searching…</div>
        )}

        {results.length > 0 && !loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {parallelMode ? `${results.length} pair${results.length !== 1 ? 's' : ''}` : `${results.length} verse${results.length !== 1 ? 's' : ''}`}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedRefs.size > 0 && (
                  <>
                    <button onClick={addSelectedVerses} style={{
                      background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
                      color: '#a7f3d0', padding: '4px 9px', borderRadius: 4,
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                    }}>＋ Add ({selectedRefs.size})</button>
                    <button onClick={() => setSelectedRefs(new Set())} style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', padding: '4px 9px', borderRadius: 4,
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                    }}>Clear</button>
                  </>
                )}
                {!parallelMode && (
                  <button onClick={() => addVerses(results)} style={{
                    background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
                    color: '#86efac', padding: '4px 9px', borderRadius: 4,
                    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                  }}>＋ All ({results.length})</button>
                )}
              </div>
            </div>

            {parallelMode
              ? results.map((pair, i) => (
                  <ParallelVerseCard
                    key={i}
                    pair={pair}
                    selected={selectedRefs.has(String(i))}
                    onToggle={() => {
                      setSelectedRefs(prev => {
                        const next = new Set(prev);
                        next.has(String(i)) ? next.delete(String(i)) : next.add(String(i));
                        return next;
                      });
                    }}
                    onAdd={() => addParallelPair(pair)}
                    onGoLive={() => goLiveParallelPair(pair)}
                  />
                ))
              : results.map((verse, i) => (
                  <VerseCard
                    key={verseKey(verse) + i}
                    verse={verse}
                    selected={selectedRefs.has(verseKey(verse))}
                    onToggle={toggleVerseSelection}
                    onAdd={() => addVerses([verse])}
                    onGoLive={() => goLiveVerse(verse)}
                  />
                ))
            }
          </>
        )}
      </div>
    </div>
  );
}

// ── Verse card (single translation) ──────────────────────────────────────────

function VerseCard({ verse, selected, onToggle, onAdd, onGoLive }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => onToggle(verse)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: selected ? '#27472f' : (hover ? '#1e2a1e' : 'var(--bg-hover)'),
        borderRadius: 'var(--radius)', padding: 10, marginBottom: 6,
        border: `1px solid ${selected ? '#4ade80' : (hover ? 'rgba(34,197,94,0.2)' : 'var(--border)')}`,
        transition: 'all 0.12s', cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
          <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onToggle(verse); }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{verse.reference}</span>
          {verse.version && (
            <span style={{
              color: '#fff', fontWeight: 600, fontSize: 9,
              background: 'rgba(79,142,247,0.25)', border: '1px solid rgba(79,142,247,0.4)',
              borderRadius: 3, padding: '1px 5px',
            }}>{verse.version}</span>
          )}
        </label>
        {onGoLive && (
          <button onClick={e => { e.stopPropagation(); onGoLive(); }} title="Send this verse straight to the program output (no schedule)" style={{
            background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.45)',
            color: '#fecaca', padding: '4px 9px', borderRadius: 4,
            cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0, fontWeight: 600,
          }}>● Live</button>
        )}
        <button onClick={e => { e.stopPropagation(); onAdd(); }} title="Add to schedule" style={{
          background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
          color: '#d9f99d', padding: '4px 9px', borderRadius: 4,
          cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', flexShrink: 0,
        }}>＋</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Georgia' }}>
        {verse.text}
      </div>
    </div>
  );
}

// ── Parallel verse card (two translations side by side) ───────────────────────

function ParallelVerseCard({ pair, selected, onToggle, onAdd, onGoLive }) {
  const [hover, setHover] = useState(false);
  const ref = pair.a?.reference || pair.b?.reference || '';
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: selected ? '#27472f' : (hover ? '#1e2a1e' : 'var(--bg-hover)'),
        borderRadius: 'var(--radius)', padding: 10, marginBottom: 6,
        border: `1px solid ${selected ? '#4ade80' : (hover ? 'rgba(34,197,94,0.2)' : 'var(--border)')}`,
        transition: 'all 0.12s', cursor: 'pointer',
      }}
    >
      {/* Reference row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
          <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onToggle(); }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{ref}</span>
        </label>
        {onGoLive && (
          <button onClick={e => { e.stopPropagation(); onGoLive(); }} title="Send this pair straight to the program output (no schedule)" style={{
            background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.45)',
            color: '#fecaca', padding: '4px 9px', borderRadius: 4,
            cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)', flexShrink: 0, fontWeight: 600,
          }}>● Live</button>
        )}
        <button onClick={e => { e.stopPropagation(); onAdd(); }} title="Add to schedule" style={{
          background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
          color: '#d9f99d', padding: '4px 9px', borderRadius: 4,
          cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', flexShrink: 0,
        }}>＋</button>
      </div>
      {/* Side-by-side text */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[pair.a, pair.b].map((v, i) => (
          <div key={i} style={{
            fontSize: 11, color: v ? 'var(--text)' : 'var(--text-dim)',
            lineHeight: 1.6, fontFamily: 'Georgia',
            borderLeft: `2px solid ${i === 0 ? 'rgba(79,142,247,0.4)' : 'rgba(255,255,255,0.15)'}`,
            paddingLeft: 6,
          }}>
            {v ? (
              <>
                <div style={{ fontSize: 9, color: i === 0 ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'var(--font)', marginBottom: 2, fontWeight: 600 }}>
                  {v.version}
                </div>
                {v.text}
              </>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font)' }}>—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

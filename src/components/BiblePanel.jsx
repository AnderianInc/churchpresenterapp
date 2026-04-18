import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { v4 as uuidv4 } from 'uuid';
import {
  QUICK_REFERENCES,
  BIBLE_TEXTS,
  canonicalBook,
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

function TranslationBrowser({ onlineVersions, offlineVersions, favoriteIds, onToggleFavorite, onClose }) {
  const [tab, setTab] = useState('online');
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
          // For offline entries, the favoriteId uses the 'offline:id' prefix
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
      // Derive a version label from the filename: "en_kjv.xml" → "en_kjv"
      const label = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toUpperCase().slice(0, 12);
      loadBibleTranslation(label, passages);
      // Persist offline XML in localStorage so it survives reload
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

// ── Main BiblePanel ───────────────────────────────────────────────────────────

export default function BiblePanel() {
  const { addToSchedule, settings, saveSettings } = useApp();

  // ── Translation data ──────────────────────────────────────────────────────
  const [onlineVersions, setOnlineVersions] = useState([]);
  // offlineVersions: [{id, name, filename}] from offline-index.json
  const [offlineVersions, setOfflineVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState('');

  // ── Favorites: array of version objects persisted as IDs ─────────────────
  const [favorites, setFavorites] = useState([]); // [{id,shortName,name,...}]

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showTranslationBrowser, setShowTranslationBrowser] = useState(false);
  const [parallelMode, setParallelMode] = useState(false);
  const [parallelSecond, setParallelSecond] = useState(null); // second version id for parallel

  // ── Search state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]); // [{reference,text,version}] or [{a,b}] in parallel
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRefs, setSelectedRefs] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isElectron = !!window.electronAPI;

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

  // ── Hydrate favorites from settings once versions are available ───────────
  useEffect(() => {
    const ids = settings?.bibleFavoriteVersionIds || [];
    if (!ids.length) return;
    const hydrated = ids.map(id => {
      if (id.startsWith('offline:')) {
        const bareId = id.slice('offline:'.length);
        const entry = offlineVersions.find(v => v.id === bareId);
        return entry ? buildOfflineFavorite(entry) : null;
      }
      const online = onlineVersions.find(v => v.id === id);
      return online ? { ...online, isOffline: false } : null;
    }).filter(Boolean);
    setFavorites(hydrated);
  }, [settings?.bibleFavoriteVersionIds, onlineVersions, offlineVersions]);

  // ── Parallel second version defaults to second favorite ──────────────────
  useEffect(() => {
    if (parallelMode && !parallelSecond && favorites.length >= 2) {
      setParallelSecond(favorites[1].id);
    }
  }, [parallelMode, favorites, parallelSecond]);

  // ── Toggle a version in/out of favorites ─────────────────────────────────
  const toggleFavorite = useCallback((v) => {
    setFavorites(prev => {
      const next = prev.some(f => f.id === v.id)
        ? prev.filter(f => f.id !== v.id)
        : [...prev, v];
      saveSettings({ bibleFavoriteVersionIds: next.map(f => f.id) });
      return next;
    });
  }, [saveSettings]);

  const removeFavorite = useCallback((id) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.id !== id);
      saveSettings({ bibleFavoriteVersionIds: next.map(f => f.id) });
      return next;
    });
  }, [saveSettings]);

  // ── All offline versions available for search ─────────────────────────────
  // Includes the full bundled index (1,046 entries) plus any manually imported XML Bibles.
  const allOfflineVersions = useMemo(() => {
    // Manually imported Bibles are stored in BIBLE_TEXTS under bare string keys
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

  // ── Offline search ────────────────────────────────────────────────────────
  // versionsToUse: array of favorite objects with {id, filename?, isOffline?, isImported?}
  const searchOffline = async (query, versionsToUse) => {
    const isRef = isReference(query);
    const allResults = [];
    for (const fav of versionsToUse) {
      // Determine the BIBLE_TEXTS key and display label
      let textKey, displayLabel;
      if (fav.isImported) {
        // Manually imported XML Bible — stored under bare key
        textKey = fav.id;
        displayLabel = fav.id;
      } else {
        // Bundled offline translation — stored under 'offline:id' key
        const bareId = fav.id.startsWith('offline:') ? fav.id.slice('offline:'.length) : fav.id;
        textKey = `offline:${bareId}`;
        displayLabel = fav.shortName || bareId;
      }

      try {
        // Ensure translation is loaded into BIBLE_TEXTS
        if (!Object.keys(BIBLE_TEXTS[textKey] || {}).length) {
          if (fav.isImported) {
            // Already loaded from localStorage in the init useEffect; skip if missing
            console.warn(`[Bible] Manually imported Bible "${textKey}" not in memory`);
            continue;
          }
          await loadOfflineTranslation(
            textKey.startsWith('offline:') ? textKey.slice('offline:'.length) : textKey,
            fav.filename
          );
        }

        const hits = isRef
          ? searchByReference(query, textKey)
          : searchByKeyword(query, textKey);

        for (const r of hits) {
          allResults.push({ ...r, version: displayLabel });
        }
      } catch (err) {
        console.warn(`[Bible] Offline search in ${textKey} failed:`, err.message);
      }
    }
    return allResults;
  };

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

    // Determine which versions to search
    const onlineFavs = favorites.filter(f => !f.isOffline);
    const offlineFavs = favorites.filter(f => f.isOffline);
    const hasOnlineFavs = onlineFavs.length > 0;
    const hasOfflineFavs = offlineFavs.length > 0;

    // If no favorites at all, default to first online for refs, first offline for keyword
    const defaultOnline = onlineVersions.length > 0 ? [onlineVersions[0]] : [];
    const defaultOffline = allOfflineVersions.length > 0
      ? [allOfflineVersions[0].isImported
          ? { ...allOfflineVersions[0], isImported: true }
          : buildOfflineFavorite(allOfflineVersions[0])]
      : [];

    try {
      if (!isRef) {
        // Keyword search — online API does not support this
        if (!hasOfflineFavs && allOfflineVersions.length === 0) {
          setMessage('keyword-offline-needed');
          setLoading(false);
          return;
        }
        const versionsToSearch = hasOfflineFavs ? offlineFavs : defaultOffline;
        const hits = await searchOffline(query, versionsToSearch);
        setResults(hits);
        if (hits.length === 0) setMessage('No verses found.');
        setLoading(false);
        return;
      }

      // Reference search
      if (parallelMode) {
        // Parallel: search two versions simultaneously
        const verA = favorites[0] || (hasOnlineFavs ? onlineFavs[0] : null) || (defaultOnline[0] ? { ...defaultOnline[0], isOffline: false } : null);
        const verB = parallelSecond
          ? favorites.find(f => f.id === parallelSecond) || (() => {
              const online = onlineVersions.find(v => v.id === parallelSecond);
              if (online) return { ...online, isOffline: false };
              if (parallelSecond.startsWith('offline:')) {
                const bareId = parallelSecond.slice('offline:'.length);
                const entry = offlineVersions.find(v => v.id === bareId);
                return entry ? buildOfflineFavorite(entry) : null;
              }
              return null;
            })()
          : favorites[1];

        const [hitsA, hitsB] = await Promise.all([
          verA ? (verA.isOffline ? searchOffline(query, [verA]) : searchOnline(query, [verA])) : Promise.resolve([]),
          verB ? (verB.isOffline ? searchOffline(query, [verB]) : searchOnline(query, [verB])) : Promise.resolve([]),
        ]);

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
        // Standard: search all favorite versions (mix of online + offline)
        const [onlineHits, offlineHits] = await Promise.all([
          hasOnlineFavs ? searchOnline(query, onlineFavs) : (!hasOfflineFavs && defaultOnline.length ? searchOnline(query, defaultOnline) : Promise.resolve([])),
          hasOfflineFavs ? searchOffline(query, offlineFavs) : Promise.resolve([]),
        ]);
        const allHits = [...onlineHits, ...offlineHits];
        setResults(allHits);
        if (allHits.length === 0) setMessage('No verses found. Try "John 3:16" or a book chapter.');
      }
    } catch (err) {
      setMessage(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [search, favorites, onlineVersions, allOfflineVersions, parallelMode, parallelSecond]);

  // ── Keyboard submit ───────────────────────────────────────────────────────
  const handleKey = (e) => { if (e.key === 'Enter') runSearch(); };

  // ── Offline autocomplete ──────────────────────────────────────────────────
  const updateSuggestions = (value) => {
    if (!value.trim()) { setSuggestions([]); return; }
    // Find a loaded offline translation to power autocomplete
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
    if (favorites.length === 0) return 'no favorites set';
    return favorites.map(f => f.shortName || f.id).join(', ');
  }, [favorites]);

  const parallelVerA = favorites[0];
  const parallelVerBObj = parallelSecond
    ? (favorites.find(f => f.id === parallelSecond) || onlineVersions.find(v => v.id === parallelSecond))
    : favorites[1];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'relative', // for overlay positioning
    }}>
      {/* Translation browser overlay */}
      {showTranslationBrowser && (
        <TranslationBrowser
          onlineVersions={onlineVersions}
          offlineVersions={offlineVersions}
          favoriteIds={favorites.map(f => f.id)}
          onToggleFavorite={toggleFavorite}
          onClose={() => setShowTranslationBrowser(false)}
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

      {/* Favorites row */}
      <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {favorites.length === 0 ? (
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>No translations selected.</span>
        ) : (
          favorites.map(f => (
            <span key={f.id} style={chipStyle(true)}>
              {f.isOffline ? '📂 ' : ''}{f.shortName || f.id}
              <button
                onClick={() => removeFavorite(f.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, fontSize: 11, lineHeight: 1 }}
              >×</button>
            </span>
          ))
        )}
        <button
          onClick={() => setShowTranslationBrowser(true)}
          style={{
            background: 'none', border: '1px dashed var(--border)',
            color: 'var(--text-dim)', borderRadius: 12, padding: '2px 8px',
            cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font)',
          }}
        >+ Translations</button>
      </div>

      {/* Parallel toggle */}
      <div style={{ padding: '0 8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: parallelMode ? 'var(--accent)' : 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={parallelMode}
            onChange={e => setParallelMode(e.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          ◫ Parallel mode
        </label>
        {parallelMode && favorites.length >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-dim)' }}>
            <span style={{ color: 'var(--accent)' }}>{parallelVerA?.shortName || '?'}</span>
            <span>⇄</span>
            <select
              value={parallelSecond || ''}
              onChange={e => setParallelSecond(e.target.value)}
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text)', borderRadius: 4, fontSize: 10, padding: '1px 4px',
                fontFamily: 'var(--font)', cursor: 'pointer',
              }}
            >
              {favorites.slice(1).map(f => (
                <option key={f.id} value={f.id}>{f.shortName || f.id}</option>
              ))}
              {/* Also allow picking online versions not in favorites */}
            </select>
          </div>
        )}
        {parallelMode && favorites.length < 2 && (
          <span style={{ fontSize: 10, color: 'var(--yellow)' }}>Add 2+ favorites to use parallel mode</span>
        )}
      </div>

      {/* Search bar */}
      <div style={{ padding: '0 8px 6px', display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder='John 3:16 or "grace"'
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

      {/* Keyword-search-requires-offline banner */}
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
          >+ Translations → Offline</button>{' '}and star a translation to favorite it.
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

          {/* Info: which versions will be searched */}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
            {favorites.length > 0
              ? <>Searches across: <span style={{ color: 'var(--accent)' }}>{searchVersionLabel}</span></>
              : <>No favorites — <button onClick={() => setShowTranslationBrowser(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: 0, textDecoration: 'underline' }}>pick translations</button></>
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

        {searched && !loading && results.length === 0 && message && message !== 'keyword-offline-needed' && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            {message}
          </div>
        )}

        {results.length > 0 && !loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {parallelMode ? `${results.length} verse pair${results.length !== 1 ? 's' : ''}` : `${results.length} verse${results.length !== 1 ? 's' : ''}`}
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
                  />
                ))
              : results.map((verse, i) => (
                  <VerseCard
                    key={verseKey(verse) + i}
                    verse={verse}
                    selected={selectedRefs.has(verseKey(verse))}
                    onToggle={toggleVerseSelection}
                    onAdd={() => addVerses([verse])}
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

function VerseCard({ verse, selected, onToggle, onAdd }) {
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
        <button onClick={e => { e.stopPropagation(); onAdd(); }} style={{
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

function ParallelVerseCard({ pair, selected, onToggle, onAdd }) {
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
        <button onClick={e => { e.stopPropagation(); onAdd(); }} style={{
          background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
          color: '#d9f99d', padding: '4px 9px', borderRadius: 4,
          cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)', flexShrink: 0,
        }}>＋</button>
      </div>
      {/* Two-column content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[pair.a, pair.b].map((v, idx) => v ? (
          <div key={idx} style={{ borderRight: idx === 0 ? '1px solid var(--border)' : 'none', paddingRight: idx === 0 ? 8 : 0 }}>
            <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {v.version}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.6, fontFamily: 'Georgia' }}>
              {v.text}
            </div>
          </div>
        ) : (
          <div key={idx} style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>—</div>
        ))}
      </div>
    </div>
  );
}

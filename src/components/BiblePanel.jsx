import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { v4 as uuidv4 } from 'uuid';
import {
  QUICK_REFERENCES,
  OFFLINE_BIBLE_FOLDERS,
  BIBLE_TEXTS,
  fetchBibleTranslationFromAsset,
  fetchBibleBookIfNeeded,
  canonicalBook,
  getOfflineBibleFolderMapping,
  searchByReference, searchByKeyword,
  fetchYouVersionPassage,
} from '../data/bible';

const verseKey = (v) => v.version ? `${v.version}:${v.reference}` : v.reference;

export default function BiblePanel() {
  const { addToSchedule, settings, saveSettings } = useApp();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('offline');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchMode, setSearchMode] = useState('reference');
  const [loading, setLoading] = useState(false);
  const [translationMessage, setTranslationMessage] = useState('');
  const [offlineBibleFolders, setOfflineBibleFolders] = useState(OFFLINE_BIBLE_FOLDERS);
  const [selectedRefs, setSelectedRefs] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [youversionApiKey, setYouversionApiKey] = useState(settings?.youversionApiKey || '');
  const [youversionLoading, setYouversionLoading] = useState(false);
  const [youversionMessage, setYouversionMessage] = useState('');
  const [onlineVersions, setOnlineVersions] = useState([]);
  const [youversionKeyConfigured, setYouversionKeyConfigured] = useState(false);

  // Version search + favorites
  const [versionQuery, setVersionQuery] = useState('');
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [favoriteVersions, setFavoriteVersions] = useState([]);

  const isElectron = !!window.electronAPI;

  // ── Offline setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    getOfflineBibleFolderMapping()
      .then(m => setOfflineBibleFolders(m))
      .catch(() => {});
  }, []);

  // ── YouVersion key sync ─────────────────────────────────────────────────────
  useEffect(() => {
    if (settings?.youversionApiKey && !youversionApiKey) {
      setYouversionApiKey(settings.youversionApiKey);
    }
  }, [settings?.youversionApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.getYouVersionHasKey()
      .then(({ configured }) => setYouversionKeyConfigured(configured))
      .catch(() => {});
  }, [isElectron]);

  // ── Load YouVersion versions ────────────────────────────────────────────────
  // Loads from local JSON immediately (no API key needed); supplements with
  // live SDK results when an API key is present.
  useEffect(() => {
    if (mode !== 'online' || !isElectron) {
      if (mode === 'online' && !isElectron) {
        setYouversionMessage('Online search requires the desktop app. Use offline mode in the browser.');
      }
      return;
    }
    const effectiveKey = youversionKeyConfigured ? '' : youversionApiKey.trim();
    let cancelled = false;
    async function load() {
      setYouversionLoading(true);
      setYouversionMessage('');
      try {
        const response = await window.electronAPI.fetchYouVersionVersions(effectiveKey);
        if (cancelled) return;
        const seen = new Set();
        const versions = (response?.data || [])
          .filter(v => v.id && v.abbreviation)
          .map(v => ({
            id: v.id,
            abbreviation: (v.abbreviation || '').toUpperCase(),
            title: v.local_title || v.title || v.abbreviation || '',
            language: v.language_tag || '',
            copyright: v.copyright || '',
          }))
          .filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
        setOnlineVersions(versions);
        if (versions.length === 0) setYouversionMessage('No translations found.');
      } catch (err) {
        if (!cancelled) setYouversionMessage(err.message || 'Failed to load YouVersion translations.');
      } finally {
        if (!cancelled) setYouversionLoading(false);
      }
    }
    // Debounce only when the user is actively typing a new API key
    const delay = !youversionKeyConfigured && youversionApiKey.trim() ? 600 : 0;
    const timer = setTimeout(load, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, isElectron, youversionApiKey, youversionKeyConfigured]);

  // ── Restore favorites from settings once versions are loaded ────────────────
  useEffect(() => {
    const savedIds = settings?.bibleFavoriteVersionIds;
    if (!savedIds?.length || !onlineVersions.length) return;
    setFavoriteVersions(
      savedIds.map(id => onlineVersions.find(v => v.id === id)).filter(Boolean)
    );
  }, [settings?.bibleFavoriteVersionIds, onlineVersions]);

  // ── Favorite helpers ────────────────────────────────────────────────────────
  const isFavorite = useCallback(
    (v) => favoriteVersions.some(f => f.id === v.id),
    [favoriteVersions]
  );
  const toggleFavorite = useCallback((v) => {
    setFavoriteVersions(prev => {
      const next = prev.some(f => f.id === v.id)
        ? prev.filter(f => f.id !== v.id)
        : [...prev, v];
      saveSettings({ bibleFavoriteVersionIds: next.map(f => f.id) });
      return next;
    });
  }, [saveSettings]);
  const removeFavorite = useCallback((v) => {
    setFavoriteVersions(prev => {
      const next = prev.filter(f => f.id !== v.id);
      saveSettings({ bibleFavoriteVersionIds: next.map(f => f.id) });
      return next;
    });
  }, [saveSettings]);

  // ── Version search dropdown ─────────────────────────────────────────────────
  const versionDropdownResults = useMemo(() => {
    const q = versionQuery.trim().toLowerCase();
    if (!q) return onlineVersions.slice(0, 30);
    return onlineVersions
      .filter(v =>
        v.abbreviation.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [versionQuery, onlineVersions]);

  const availableOfflineVersions = Object.keys(offlineBibleFolders);

  // ── Clear ───────────────────────────────────────────────────────────────────
  const clearResults = () => {
    setResults([]);
    setSearch('');
    setSearched(false);
    setSelectedRefs(new Set());
    setTranslationMessage('');
    setYouversionMessage('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const runSearch = async (q = search) => {
    const query = q.trim();
    if (!query) return;
    setSearched(true);
    setLoading(true);
    setTranslationMessage('');
    setYouversionMessage('');
    setSelectedRefs(new Set());
    setShowSuggestions(false);

    const isRef = /\d/.test(query);

    if (mode === 'online') {
      if (!isElectron) {
        setResults([]);
        setYouversionMessage('Online search requires the desktop app.');
        setLoading(false);
        return;
      }
      const effectiveKey = youversionKeyConfigured ? '' : youversionApiKey.trim();

      const versionsToSearch = favoriteVersions.length > 0
        ? favoriteVersions
        : onlineVersions.slice(0, 1);

      if (versionsToSearch.length === 0) {
        setResults([]);
        setYouversionMessage('No translations loaded yet. Wait for versions to load.');
        setLoading(false);
        return;
      }

      if (!isRef && favoriteVersions.length === 0) {
        setResults([]);
        setYouversionMessage('Star at least one translation above to enable text search.');
        setLoading(false);
        return;
      }

      const allResults = [];
      for (const ver of versionsToSearch) {
        const versionParam = ver.id.toString();
        try {
          if (isRef) {
            const passage = await fetchYouVersionPassage(effectiveKey, versionParam, query, 'text');
            const content = passage?.content || passage?.data?.content || '';
            if (content) allResults.push({
              reference: query,
              text: content,
              version: ver.abbreviation,
              copyright: passage?._copyright || ver.copyright || '',
            });
          } else {
            const hits = await window.electronAPI.searchBibleCom({ versionId: ver.id, query });
            const mapped = hits
              .map(h => ({
                reference: h.human_reference || '',
                text: h.text || '',
                version: ver.abbreviation,
                copyright: ver.copyright || '',
              }))
              .filter(h => h.reference && h.text);
            allResults.push(...mapped);
          }
        } catch (err) {
          console.warn(`[Bible] Online search in ${ver.abbreviation} failed:`, err.message);
        }
      }

      setResults(allResults);
      setSearchMode(isRef ? 'reference' : 'keyword');
      if (allResults.length === 0) {
        setYouversionMessage(isRef ? 'No content returned for that reference.' : 'No verses found.');
      }
      setLoading(false);
      return;
    }

    // ── Offline search across all available translations ────────────────────
    try {
      const allResults = [];
      for (const ver of availableOfflineVersions) {
        try {
          if (isRef) {
            const bookMatch = query.match(/^(.+?)\s+\d/i);
            if (bookMatch) await fetchBibleBookIfNeeded(ver, canonicalBook(bookMatch[1]));
            for (const r of searchByReference(query, ver)) allResults.push({ ...r, version: ver });
          } else {
            if (!Object.keys(BIBLE_TEXTS[ver] || {}).length) {
              await fetchBibleTranslationFromAsset(ver);
            }
            for (const r of searchByKeyword(query, ver)) allResults.push({ ...r, version: ver });
          }
        } catch (err) {
          console.warn(`[Bible] Search in ${ver} failed:`, err.message);
        }
      }
      setResults(allResults);
      setSearchMode(isRef ? 'reference' : 'keyword');
    } catch (err) {
      setResults([]);
      setTranslationMessage(err.message || 'Offline Bible search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') runSearch(); };

  // ── Offline autocomplete suggestions ───────────────────────────────────────
  const updateSearchSuggestions = (value) => {
    if (!value.trim() || mode !== 'offline') { setSuggestions([]); return; }
    const cachedVer = availableOfflineVersions.find(v => Object.keys(BIBLE_TEXTS[v] || {}).length > 0);
    if (!cachedVer) { setSuggestions([]); return; }
    const merged = [];
    const seen = new Set();
    for (const item of [...searchByReference(value, cachedVer), ...searchByKeyword(value, cachedVer)]) {
      if (!seen.has(item.reference)) {
        seen.add(item.reference);
        merged.push({ ...item, version: cachedVer });
        if (merged.length >= 8) break;
      }
    }
    setSuggestions(merged);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setShowSuggestions(true);
    updateSearchSuggestions(value);
  };

  const applySuggestion = (reference) => {
    setSearch(reference);
    setShowSuggestions(false);
    runSearch(reference);
  };

  // ── Verse selection ─────────────────────────────────────────────────────────
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

  const addSelectedVerses = () => {
    const selected = results.filter(v => selectedRefs.has(verseKey(v)));
    if (selected.length) { addVerses(selected); setSelectedRefs(new Set()); }
  };

  const inputStyle = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 10px',
    fontSize: 12, outline: 'none', fontFamily: 'var(--font)',
  };

  const versionCounts = results.reduce((acc, v) => {
    if (v.version) acc[v.version] = (acc[v.version] || 0) + 1;
    return acc;
  }, {});

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
      }}>
        Bible Search
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '8px 8px 0', display: 'flex', gap: 4, alignItems: 'center' }}>
        {['offline', 'online'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            background: mode === m ? 'var(--accent)' : 'transparent',
            border: mode === m ? 'none' : '1px solid var(--border)',
            color: mode === m ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font)', textTransform: 'capitalize',
          }}>{m}</button>
        ))}
        <div style={{ fontSize: 10, color: 'var(--text-dim)', flex: 1 }}>
          {mode === 'offline'
            ? availableOfflineVersions.length > 0
              ? `${availableOfflineVersions.length} local: ${availableOfflineVersions.join(', ')}`
              : 'No offline translations available.'
            : 'YouVersion API'}
        </div>
      </div>

      {/* ── Online mode controls ─────────────────────────────────────────────── */}
      {mode === 'online' && (
        <div style={{ padding: '6px 8px 0' }}>
          {!isElectron ? (
            <div style={{ fontSize: 11, color: 'var(--yellow)', padding: '4px 0' }}>
              Online search requires the desktop app.
            </div>
          ) : (
            <>
              {/* API key input */}
              {!youversionKeyConfigured && (
                <input
                  value={youversionApiKey}
                  onChange={e => setYouversionApiKey(e.target.value)}
                  placeholder="YouVersion App Key (optional)"
                  style={{ ...inputStyle, width: '100%', marginBottom: 4, boxSizing: 'border-box' }}
                />
              )}
              {youversionKeyConfigured && (
                <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4 }}>
                  ✓ API key configured.
                </div>
              )}

              {/* Version search + favorites */}
              {youversionLoading ? (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '4px 0' }}>
                  Loading translations…
                </div>
              ) : onlineVersions.length > 0 ? (
                <>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={versionQuery}
                      onChange={e => { setVersionQuery(e.target.value); setShowVersionDropdown(true); }}
                      onFocus={() => setShowVersionDropdown(true)}
                      onBlur={() => setTimeout(() => setShowVersionDropdown(false), 160)}
                      placeholder={`🔍 Search ${onlineVersions.length} translations…`}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', padding: '5px 8px' }}
                    />
                    {showVersionDropdown && versionDropdownResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                        background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                        borderRadius: 4, marginTop: 2, maxHeight: 180, overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}>
                        {versionDropdownResults.map(v => (
                          <div
                            key={v.id}
                            onMouseDown={e => e.preventDefault()}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                              cursor: 'default', borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <button
                              onClick={() => toggleFavorite(v)}
                              title={isFavorite(v) ? 'Remove from favorites' : 'Add to favorites'}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 15, padding: 0, lineHeight: 1, flexShrink: 0,
                                color: isFavorite(v) ? '#fbbf24' : 'var(--text-dim)',
                              }}
                            >
                              {isFavorite(v) ? '★' : '☆'}
                            </button>
                            <span style={{ fontWeight: 700, fontSize: 11, minWidth: 38, flexShrink: 0 }}>
                              {v.abbreviation}
                            </span>
                            <span style={{
                              fontSize: 10, color: 'var(--text-dim)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {v.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Favorites chips */}
                  <div style={{ marginTop: 5 }}>
                    {favoriteVersions.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Favorites:</span>
                        {favoriteVersions.map(v => (
                          <span key={v.id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.35)',
                            borderRadius: 12, padding: '2px 7px', fontSize: 10, color: 'var(--accent)',
                          }}>
                            {v.abbreviation}
                            <button
                              onClick={() => removeFavorite(v)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-dim)', padding: 0, fontSize: 11, lineHeight: 1,
                              }}
                            >×</button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        ☆ Star translations above — searches run across all favorites simultaneously.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '2px 0' }}>
                  {youversionMessage || 'Loading translations…'}
                </div>
              )}

              {youversionMessage && onlineVersions.length > 0 && (
                <div style={{
                  fontSize: 10, marginTop: 3,
                  color: youversionMessage.startsWith('No') || youversionMessage.startsWith('Failed')
                    ? 'var(--red)' : 'var(--text-dim)',
                }}>
                  {youversionMessage}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Search bar */}
      <div style={{ padding: '8px', display: 'flex', gap: 6 }}>
        <input
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder='John 3:16 or "grace"'
          style={{ ...inputStyle, flex: 1 }}
          onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; setTimeout(() => setShowSuggestions(false), 150); }}
        />
        <button onClick={() => runSearch()} style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          padding: '7px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font)', fontWeight: 500,
        }}>Search</button>
        {searched && (
          <button onClick={clearResults} title='Clear results' style={{
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '7px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
            fontSize: 12, lineHeight: 1,
          }}>✕</button>
        )}
      </div>

      {/* Offline autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ padding: '0 8px 8px', maxHeight: 220, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Suggestions:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestions.map(sug => (
              <button key={sug.reference} onMouseDown={() => applySuggestion(sug.reference)} style={{
                textAlign: 'left', padding: '6px 8px', borderRadius: 5, border: '1px solid var(--border)',
                background: 'var(--bg-hover)', color: 'var(--text)', cursor: 'pointer', fontSize: 11,
                fontFamily: 'var(--font)',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--green)' }}>{sug.reference}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sug.text}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick references */}
      <div style={{ padding: '0 8px 8px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Quick access:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {QUICK_REFERENCES.map(ref => (
            <button key={ref} onClick={() => { setSearch(ref); runSearch(ref); }} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontFamily: 'var(--font)', transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(79,142,247,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >{ref}</button>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {!searched && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
            Search by reference (John 3:16)<br />or keyword (grace, hope, love)
            {mode === 'online' && favoriteVersions.length > 0 && (
              <div style={{ fontSize: 10, marginTop: 6, color: 'var(--accent)' }}>
                Searching across: {favoriteVersions.map(v => v.abbreviation).join(', ')}
              </div>
            )}
          </div>
        )}

        {searched && loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Searching…</div>
        )}

        {searched && !loading && results.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            No verses found.<br />
            <span style={{ fontSize: 11 }}>Try "Psalm 23" or a keyword like "shepherd"</span>
            {(translationMessage || youversionMessage) && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)' }}>
                {translationMessage || youversionMessage}
              </div>
            )}
          </div>
        )}

        {results.length > 0 && !loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {results.length} verse{results.length !== 1 ? 's' : ''}
                  {searchMode === 'keyword' ? ' — keyword match' : ''}
                </span>
                {Object.keys(versionCounts).length > 1 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    {Object.entries(versionCounts).map(([v, n]) => `${v}: ${n}`).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedRefs.size > 0 && (
                  <>
                    <button onClick={addSelectedVerses} style={{
                      background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
                      color: '#a7f3d0', padding: '4px 10px', borderRadius: 4,
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                    }}>＋ Add Selected ({selectedRefs.size})</button>
                    <button onClick={() => setSelectedRefs(new Set())} style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 4,
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                    }}>Deselect</button>
                  </>
                )}
                <button onClick={() => addVerses(results)} style={{
                  background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
                  color: '#86efac', padding: '4px 10px', borderRadius: 4,
                  cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
                }}>＋ Add All ({results.length})</button>
              </div>
            </div>

            {results.map((verse, i) => (
              <VerseCard
                key={verseKey(verse) + i}
                verse={verse}
                selected={selectedRefs.has(verseKey(verse))}
                onToggle={toggleVerseSelection}
                onAdd={() => addVerses([verse])}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
          <input
            type='checkbox'
            checked={selected}
            onChange={(e) => { e.stopPropagation(); onToggle(verse); }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>
            {verse.reference}
          </span>
          {verse.version && (
            <span style={{
              color: '#fff', fontWeight: 600, fontSize: 9,
              background: 'rgba(79,142,247,0.25)', border: '1px solid rgba(79,142,247,0.4)',
              borderRadius: 3, padding: '1px 5px', letterSpacing: '0.4px',
            }}>{verse.version}</span>
          )}
        </label>
        <button onClick={(e) => { e.stopPropagation(); onAdd(); }} style={{
          background: '#166534', border: '1px solid rgba(34,197,94,0.3)',
          color: '#d9f99d', padding: '4px 10px', borderRadius: 4,
          cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
        }}>＋ Add</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, fontFamily: 'Georgia' }}>
        {verse.text}
      </div>
      {verse.copyright && (
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 5, lineHeight: 1.4, fontStyle: 'italic' }}>
          {verse.copyright}
        </div>
      )}
    </div>
  );
}

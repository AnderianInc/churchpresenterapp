import React, { useState, useEffect } from 'react';
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

// Unique key per verse result (version + reference), needed when searching all translations
const verseKey = (v) => v.version ? `${v.version}:${v.reference}` : v.reference;

export default function BiblePanel() {
  const { addToSchedule, settings } = useApp();
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState('KJV'); // fallback abbreviation (online mode)
  const [selectedVersionObj, setSelectedVersionObj] = useState(null); // { id, abbreviation, title }
  const [versionFilter, setVersionFilter] = useState('');
  const [mode, setMode] = useState('offline');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchMode, setSearchMode] = useState('reference'); // reference | keyword
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
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    async function loadOfflineVersions() {
      try {
        const mapping = await getOfflineBibleFolderMapping();
        setOfflineBibleFolders(mapping);
      } catch (err) {
        console.warn('Unable to load offline Bible manifest:', err);
      }
    }
    loadOfflineVersions();
  }, []);

  // Sync YouVersion key from settings when settings load
  useEffect(() => {
    if (settings?.youversionApiKey && !youversionApiKey) {
      setYouversionApiKey(settings.youversionApiKey);
    }
  }, [settings?.youversionApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check on mount whether a YouVersion key is already configured in the main process
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.getYouVersionHasKey()
      .then(({ configured }) => setYouversionKeyConfigured(configured))
      .catch(() => {});
  }, [isElectron]);

  // Load available YouVersion translations — triggered by entering a key OR a pre-configured key
  useEffect(() => {
    if (mode !== 'online' || !isElectron) {
      if (mode === 'online' && !isElectron) {
        setYouversionMessage('Online search requires the desktop app (Electron). Use offline mode in the browser.');
      }
      return;
    }
    const hasKey = youversionKeyConfigured || youversionApiKey.trim().length > 0;
    if (!hasKey) return;

    const effectiveKey = youversionKeyConfigured ? '' : youversionApiKey.trim();

    let cancelled = false;
    async function loadVersions() {
      setYouversionLoading(true);
      setYouversionMessage('');
      try {
        const response = await window.electronAPI.fetchYouVersionVersions(effectiveKey);
        if (cancelled) return;
        // Store full objects so we can pass numeric IDs directly (no re-lookup)
        const seen = new Set();
        const versions = (response?.data || [])
          .filter(v => v.id && v.abbreviation)
          .map(v => ({
            id: v.id,
            abbreviation: (v.abbreviation || '').toUpperCase(),
            title: v.local_title || v.title || v.abbreviation || '',
            language: v.language_tag || '',
          }))
          .filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
        setOnlineVersions(versions);
        if (versions.length > 0) {
          // Keep current selection if still valid, else pick the first English or first overall
          setSelectedVersionObj(prev => {
            if (prev && versions.find(v => v.id === prev.id)) return prev;
            const eng = versions.find(v => v.language.startsWith('en'));
            return eng || versions[0];
          });
          setYouversionMessage(`${versions.length} translation${versions.length !== 1 ? 's' : ''} available.`);
        } else {
          setYouversionMessage('No translations found for this API key.');
        }
      } catch (err) {
        if (!cancelled) setYouversionMessage(err.message || 'Failed to load YouVersion translations.');
      } finally {
        if (!cancelled) setYouversionLoading(false);
      }
    }
    const delay = youversionKeyConfigured ? 0 : 600;
    const timer = setTimeout(loadVersions, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, isElectron, youversionApiKey, youversionKeyConfigured]);

  const availableOfflineVersions = Object.keys(offlineBibleFolders);

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
      if (!youversionKeyConfigured && !effectiveKey) {
        setResults([]);
        setYouversionMessage('Enter your YouVersion API key before searching online.');
        setLoading(false);
        return;
      }
      // Pass the numeric version ID directly to avoid a redundant API round-trip in main.js
      const versionParam = selectedVersionObj?.id?.toString() || version;
      const displayVersion = selectedVersionObj?.abbreviation || version;

      if (!isRef) {
        // Keyword search via YouVersion Platform API
        try {
          const result = await window.electronAPI.searchYouVersionVerses({
            appKey: effectiveKey,
            versionId: versionParam,
            query,
          });
          // Normalise across possible response shapes
          const hits = result?.data || result?.verses || result?.hits || [];
          const mapped = hits
            .map(h => ({
              reference: h.human_reference || h.reference || h.usfm?.[0] || '',
              text: h.text || h.content || '',
              version: displayVersion,
            }))
            .filter(h => h.reference && h.text);
          setResults(mapped);
          setSearchMode('keyword');
          if (mapped.length === 0) setYouversionMessage('No verses found. Try a different keyword or phrase.');
        } catch (err) {
          setResults([]);
          setYouversionMessage(err.message?.includes('404') || err.message?.includes('not supported')
            ? 'Keyword search is not available for this API key. Try a reference (e.g. John 3:16) or switch to offline mode.'
            : (err.message || 'YouVersion keyword search failed.'));
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const passage = await fetchYouVersionPassage(effectiveKey, versionParam, query, 'text');
        const content = passage?.content || passage?.data?.content || '';
        setResults(content ? [{ reference: query, text: content, version: displayVersion }] : []);
        setSearchMode('reference');
        if (!content) setYouversionMessage('No content returned for that reference.');
      } catch (err) {
        setResults([]);
        setYouversionMessage(err.message || 'Failed to load passage from YouVersion.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Offline mode: search ALL available translations simultaneously
    try {
      const allResults = [];
      const versionsToSearch = availableOfflineVersions.length > 0 ? availableOfflineVersions : [version];

      for (const ver of versionsToSearch) {
        try {
          if (isRef) {
            const bookMatch = query.match(/^(.+?)\s+\d/i);
            if (bookMatch) {
              const bookName = canonicalBook(bookMatch[1]);
              await fetchBibleBookIfNeeded(ver, bookName);
            }
            const found = searchByReference(query, ver);
            for (const r of found) allResults.push({ ...r, version: ver });
          } else {
            // Keyword search: need the full translation loaded
            if (!Object.keys(BIBLE_TEXTS[ver] || {}).length) {
              await fetchBibleTranslationFromAsset(ver);
            }
            const found = searchByKeyword(query, ver);
            for (const r of found) allResults.push({ ...r, version: ver });
          }
        } catch (err) {
          console.warn(`[Bible] Search in ${ver} failed:`, err.message);
        }
      }

      setResults(allResults);
      setSearchMode(isRef ? 'reference' : 'keyword');
      if (allResults.length === 0) {
        setTranslationMessage('');
      }
    } catch (err) {
      setResults([]);
      setTranslationMessage(err.message || 'Offline Bible search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') runSearch(); };

  const updateSearchSuggestions = (value) => {
    const query = value.trim();
    // Suggestions only search already-cached data — never trigger a load on keystroke.
    if (!query || mode !== 'offline') {
      setSuggestions([]);
      return;
    }
    // Use first available offline version that has cached data
    const cachedVersion = availableOfflineVersions.find(v => Object.keys(BIBLE_TEXTS[v] || {}).length > 0);
    if (!cachedVersion) {
      setSuggestions([]);
      return;
    }

    const refSuggestions = searchByReference(query, cachedVersion);
    const keywordSuggestions = searchByKeyword(query, cachedVersion);
    const merged = [];
    const seen = new Set();

    for (const item of [...refSuggestions, ...keywordSuggestions]) {
      if (!seen.has(item.reference)) {
        seen.add(item.reference);
        merged.push({ ...item, version: cachedVersion });
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

  const toggleVerseSelection = (verse) => {
    const key = verseKey(verse);
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelections = () => setSelectedRefs(new Set());

  const addSelectedVerses = () => {
    const selected = results.filter(v => selectedRefs.has(verseKey(v)));
    if (!selected.length) return;
    addVerses(selected);
    clearSelections();
  };

  const addVerses = (verses) => {
    if (!verses.length) return;
    const firstRef = verses[0].reference;
    const lastRef = verses[verses.length - 1].reference;
    const title = verses.length === 1 ? firstRef : `${firstRef}–${lastRef.split(':')[1]}`;
    const versionLabel = verses[0].version || version;
    const slides = verses.map(v => ({
      id: uuidv4(), type: 'scripture', label: v.reference,
      lines: `${v.text}\n\n— ${v.reference} (${v.version || version})`,
    }));
    addToSchedule({
      type: 'scripture', title, reference: title, version: versionLabel,
      slides,
      background: { type: 'color', value: '#0a1a0f' },
      textColor: '#ffffff', fontSize: 38, fontFamily: 'Georgia',
    });
  };

  const inputStyle = {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 10px',
    fontSize: 12, outline: 'none', fontFamily: 'var(--font)',
  };

  // Group results by version for display summary
  const versionCounts = results.reduce((acc, v) => {
    if (v.version) acc[v.version] = (acc[v.version] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      width: 300, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
      }}>
        Bible Search
      </div>

      {/* Online mode version selector — searchable dropdown */}
      {mode === 'online' && onlineVersions.length > 0 && (
        <div style={{ padding: '4px 8px 0' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={versionFilter}
              onChange={e => setVersionFilter(e.target.value)}
              placeholder={`Filter ${onlineVersions.length} versions…`}
              style={{
                flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', padding: '5px 8px',
                fontSize: 11, outline: 'none', fontFamily: 'var(--font)',
              }}
            />
            {versionFilter && (
              <button onClick={() => setVersionFilter('')} style={{
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
                borderRadius: 'var(--radius)', padding: '4px 7px', cursor: 'pointer', fontSize: 11,
              }}>✕</button>
            )}
          </div>
          <div style={{
            maxHeight: 110, overflowY: 'auto', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', marginTop: 4, background: 'var(--bg-input)',
          }}>
            {onlineVersions
              .filter(v => {
                const q = versionFilter.toLowerCase();
                return !q || v.abbreviation.toLowerCase().includes(q) || v.title.toLowerCase().includes(q) || v.language.toLowerCase().includes(q);
              })
              .map(v => (
                <div
                  key={v.id}
                  onClick={() => { setSelectedVersionObj(v); setVersionFilter(''); }}
                  style={{
                    padding: '4px 8px', cursor: 'pointer', fontSize: 11, display: 'flex', gap: 6,
                    background: selectedVersionObj?.id === v.id ? 'var(--accent)' : 'transparent',
                    color: selectedVersionObj?.id === v.id ? '#fff' : 'var(--text)',
                  }}
                >
                  <span style={{ fontWeight: 700, minWidth: 40, flexShrink: 0 }}>{v.abbreviation}</span>
                  <span style={{ color: selectedVersionObj?.id === v.id ? 'rgba(255,255,255,0.8)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                </div>
              ))
            }
          </div>
          {selectedVersionObj && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '2px 2px 0' }}>
              Selected: <strong style={{ color: 'var(--text)' }}>{selectedVersionObj.abbreviation}</strong> — {selectedVersionObj.title}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '8px 8px 0', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setMode('offline')} style={{
          padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          background: mode === 'offline' ? 'var(--accent)' : 'transparent',
          border: mode === 'offline' ? 'none' : '1px solid var(--border)',
          color: mode === 'offline' ? '#fff' : 'var(--text-muted)',
          fontFamily: 'var(--font)', transition: 'all 0.15s',
        }}>Offline</button>
        <button onClick={() => setMode('online')} style={{
          padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          background: mode === 'online' ? 'var(--accent)' : 'transparent',
          border: mode === 'online' ? 'none' : '1px solid var(--border)',
          color: mode === 'online' ? '#fff' : 'var(--text-muted)',
          fontFamily: 'var(--font)', transition: 'all 0.15s',
        }}>Online</button>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center', minWidth: 220 }}>
          {mode === 'offline'
            ? availableOfflineVersions.length > 0
              ? `Searching all ${availableOfflineVersions.length} offline translation${availableOfflineVersions.length === 1 ? '' : 's'}: ${availableOfflineVersions.join(', ')}`
              : 'No offline translations available.'
            : 'Online mode uses YouVersion API.'}
        </div>
      </div>

      {mode === 'online' && (
        <>
          {!isElectron ? (
            <div style={{ padding: '6px 8px 4px', fontSize: 11, color: 'var(--yellow)', lineHeight: 1.5 }}>
              Online search requires the desktop app. Use offline mode in the browser.
            </div>
          ) : youversionKeyConfigured ? (
            <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--green)' }}>
              ✓ API key configured via environment / config file.
            </div>
          ) : (
            <div style={{ padding: '0 8px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                value={youversionApiKey}
                onChange={e => setYouversionApiKey(e.target.value)}
                placeholder='YouVersion App Key'
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          )}
          {isElectron && (
            <div style={{ padding: '0 8px 4px', fontSize: 10, color: youversionMessage.startsWith('Failed') || youversionMessage.startsWith('No') ? 'var(--red)' : 'var(--text-dim)' }}>
              {youversionLoading ? 'Connecting to YouVersion…' : (youversionMessage || (youversionKeyConfigured ? '' : 'Enter your App Key — translations will load automatically.'))}
            </div>
          )}
        </>
      )}

      {/* Search bar */}
      <div style={{ padding: '8px', display: 'flex', gap: 6 }}>
        <input
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder='e.g. John 3:16 or "grace"'
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
            fontSize: 12, fontFamily: 'var(--font)', lineHeight: 1,
          }}>✕</button>
        )}
      </div>

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

      {/* Quick reference buttons */}
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
            Search by reference (John 3:16)<br />or keyword (grace, hope, love)<br />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, display: 'block' }}>
            {mode === 'online' ? 'Online: reference + keyword search via YouVersion' : 'Offline: all local translations searched simultaneously'}
          </span>
          </div>
        )}

        {searched && loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Searching…</div>
        )}

        {searched && !loading && results.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            No verses found.<br />
            <span style={{ fontSize: 11 }}>Try "Psalm 23" or a keyword like "shepherd"</span>
            {translationMessage && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)' }}>{translationMessage}</div>}
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
                    <button onClick={clearSelections} style={{
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
    </div>
  );
}

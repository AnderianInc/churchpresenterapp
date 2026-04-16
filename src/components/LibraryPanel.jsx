import React, { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import SongImportModal from './SongImportModal';

const tagColors = { hymn: '#4f8ef7', contemporary: '#22c55e', worship: '#a855f7', classic: '#f97316' };

export default function LibraryPanel({ onEditSong, onNewSong }) {
  const { songs, addToSchedule, deleteSong } = useApp();
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [importOpen, setImportOpen] = useState(false);

  const allTags = useMemo(() => {
    const tags = new Set();
    songs.forEach(s => s.tags?.forEach(t => tags.add(t)));
    return ['all', ...Array.from(tags)];
  }, [songs]);

  const filtered = useMemo(() => {
    let list = songs;
    if (search) list = list.filter(s =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.author || '').toLowerCase().includes(search.toLowerCase())
    );
    if (filterTag !== 'all') list = list.filter(s => s.tags?.includes(filterTag));
    list = [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return (a.author || '').localeCompare(b.author || '');
      return 0;
    });
    return list;
  }, [songs, search, filterTag, sortBy]);

  const handleAdd = (song) => {
    addToSchedule({
      type: 'song', title: song.title, author: song.author,
      slides: song.slides, background: song.background,
      textColor: song.textColor, fontSize: song.fontSize, fontFamily: song.fontFamily,
      songId: song.id,
    });
  };

  return (
    <div style={{
      width: 260, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        Song Library
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setImportOpen(true)} style={{
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >↓ Import</button>
          <button onClick={onNewSong} style={{
            background: 'var(--accent)', border: 'none', color: '#fff',
            padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)',
          }}>＋ New</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 8px 4px' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search songs..."
          style={{
            width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text)', padding: '6px 10px',
            fontSize: 12, outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Tags filter */}
      <div style={{ display: 'flex', gap: 4, padding: '0 8px 6px', flexWrap: 'wrap' }}>
        {allTags.map(tag => (
          <button key={tag} onClick={() => setFilterTag(tag)} style={{
            padding: '2px 8px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
            border: filterTag === tag ? 'none' : '1px solid var(--border)',
            background: filterTag === tag ? (tagColors[tag] || 'var(--accent)') : 'transparent',
            color: filterTag === tag ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font)', transition: 'all 0.15s',
          }}>{tag}</button>
        ))}
      </div>

      {/* Sort */}
      <div style={{ padding: '0 8px 6px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Sort:</span>
        {['title', 'author'].map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
            background: sortBy === s ? 'var(--bg-hover)' : 'transparent',
            border: 'none', color: sortBy === s ? 'var(--text)' : 'var(--text-dim)',
            fontFamily: 'var(--font)',
          }}>{s}</button>
        ))}
      </div>

      <div style={{ borderBottom: '1px solid var(--border)' }} />

      {/* Song list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            No songs found
          </div>
        )}
        {filtered.map(song => (
          <SongItem key={song.id} song={song} onAdd={handleAdd} onEdit={onEditSong} onDelete={deleteSong} />
        ))}
      </div>

      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
        {filtered.length} of {songs.length} songs
      </div>

      {importOpen && <SongImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function SongItem({ song, onAdd, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
        borderRadius: 'var(--radius)', marginBottom: 1,
        background: hover ? 'var(--bg-hover)' : 'transparent', cursor: 'default',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 6, background: 'rgba(79,142,247,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        flexShrink: 0, border: '1px solid rgba(79,142,247,0.2)',
      }}>🎵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {song.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {song.author} {song.key ? `· ${song.key}` : ''}
        </div>
      </div>
      {hover && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <button onClick={() => onEdit(song)} title="Edit" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            padding: '3px 5px', borderRadius: 3, fontSize: 13,
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >✏️</button>
          <button onClick={() => onDelete(song.id)} title="Delete" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            padding: '3px 5px', borderRadius: 3, fontSize: 13,
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >🗑</button>
          <button onClick={() => onAdd(song)} title="Add to schedule" style={{
            background: 'var(--accent)', border: 'none', color: '#fff',
            padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
            fontFamily: 'var(--font)', fontWeight: 600,
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >＋</button>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';

const slideTypeColors = {
  verse: '#4f8ef7', chorus: '#22c55e', bridge: '#a855f7',
  ending: '#f97316', intro: '#eab308', tag: '#ec4899',
  scripture: '#22c55e', blank: '#555b6e',
};

function RenameableLabel({ slide, color, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slide.label || slide.type || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const begin = (e) => {
    e.stopPropagation();
    setValue(slide.label || slide.type || '');
    setEditing(true);
  };

  const commit = () => {
    const next = value.trim();
    setEditing(false);
    // Only persist if it actually changed and isn't empty
    if (next && next !== (slide.label || '')) onRename(next);
  };

  const cancel = () => {
    setEditing(false);
    setValue(slide.label || slide.type || '');
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        style={{
          fontSize: 8, padding: '1px 4px', borderRadius: 3,
          background: 'var(--bg-input)', color: '#fff',
          border: `1px solid ${slideTypeColors[slide.type] || '#555'}`,
          width: 70, fontFamily: 'var(--font)', outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onDoubleClick={begin}
      title="Double-click to rename this slide"
      style={{
        fontSize: 8, padding: '1px 4px', borderRadius: 3,
        background: `${color}88`, color: '#fff', cursor: 'text',
        userSelect: 'none',
      }}
    >{slide.label || slide.type}</span>
  );
}

function SlideThumb({ slide, index, isActive, onClick, item, onRenameSlide }) {
  const bg = item?.background?.type === 'color' ? item.background.value : '#0d1117';
  const color = item?.textColor || '#ffffff';
  const preview = slide.lines?.split('\n').slice(0, 2).join('\n') || slide.label;
  const chipColor = slideTypeColors[slide.type] || '#555';

  return (
    <div
      onClick={onClick}
      style={{
        width: 120, height: 68, borderRadius: 6, flexShrink: 0,
        border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: bg, transition: 'border-color 0.15s',
        outline: isActive ? 'none' : undefined,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(79,142,247,0.4)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'transparent'; }}
    >
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '4px 6px', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 8.5, color, lineHeight: 1.3, fontFamily: item?.fontFamily || 'Georgia',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)', wordBreak: 'break-word',
        }}>
          {preview}
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 2, left: 4, right: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <RenameableLabel
          slide={slide}
          color={chipColor}
          onRename={(nextLabel) => onRenameSlide(index, nextLabel)}
        />
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{index + 1}</span>
      </div>
    </div>
  );
}

export default function SlideEditor() {
  const { currentItem, currentSlides, activeSlideIdx, setActiveSlideIdx, updateScheduleItem } = useApp();

  if (!currentItem) {
    return (
      <div style={{
        height: 92, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: 12,
      }}>
        Select an item from the schedule to see slides
      </div>
    );
  }

  const renameSlide = (slideIdx, nextLabel) => {
    if (!currentItem?.scheduleId) return;
    const nextSlides = currentSlides.map((s, i) =>
      i === slideIdx ? { ...s, label: nextLabel } : s
    );
    updateScheduleItem(currentItem.scheduleId, { slides: nextSlides });
  };

  return (
    <div style={{
      height: 92, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
      overflowX: 'auto', flexShrink: 0,
    }}>
      {currentSlides.map((slide, i) => (
        <SlideThumb
          key={slide.id || i}
          slide={slide}
          index={i}
          isActive={i === activeSlideIdx}
          onClick={() => setActiveSlideIdx(i)}
          item={currentItem}
          onRenameSlide={renameSlide}
        />
      ))}
    </div>
  );
}

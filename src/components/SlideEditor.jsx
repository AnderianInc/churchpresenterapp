import React from 'react';
import { useApp } from '../store/AppContext';

const slideTypeColors = {
  verse: '#4f8ef7', chorus: '#22c55e', bridge: '#a855f7',
  ending: '#f97316', intro: '#eab308', tag: '#ec4899',
  scripture: '#22c55e', blank: '#555b6e',
};

function SlideThumb({ slide, index, isActive, onClick, item }) {
  const bg = item?.background?.type === 'color' ? item.background.value : '#0d1117';
  const color = item?.textColor || '#ffffff';
  const preview = slide.lines?.split('\n').slice(0, 2).join('\n') || slide.label;

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
        <span style={{
          fontSize: 8, padding: '1px 4px', borderRadius: 3,
          background: `${slideTypeColors[slide.type] || '#555'}88`,
          color: '#fff',
        }}>{slide.label || slide.type}</span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{index + 1}</span>
      </div>
    </div>
  );
}

export default function SlideEditor() {
  const { currentItem, currentSlides, activeSlideIdx, setActiveSlideIdx } = useApp();

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
        />
      ))}
    </div>
  );
}

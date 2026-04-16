import React from 'react';

export default function SlideRenderer({ slide, item, scale = 1, fullscreen = false }) {
  const bgType = item?.background?.type;
  const bg = (bgType === 'color' || bgType === 'gradient') ? item.background.value : '#0d1117';
  const textColor = item?.textColor || '#ffffff';
  const fontSize = (item?.fontSize || 44) * scale;
  const fontFamily = item?.fontFamily || 'Georgia';
  const lines = slide?.lines || '';
  const textAlign = slide?.textAlign || 'center';
  const hAlign = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  const containerStyle = fullscreen ? {
    width: '100vw', height: '100vh',
    display: 'flex', flexDirection: 'column',
    alignItems: hAlign, justifyContent: 'center',
    background: bg, padding: '5%', textAlign,
    position: 'relative',
  } : {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: hAlign, justifyContent: 'center',
    background: bg, padding: '8%', textAlign,
    position: 'relative',
  };

  return (
    <div style={containerStyle}>
      {/* Background image overlay if applicable */}
      {item?.background?.type === 'image' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${item.background.value})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: `brightness(${item.background.brightness || 0.6})`,
        }} />
      )}
      {item?.background?.type === 'video' && (
        <video
          autoPlay
          muted
          loop
          playsInline
          src={item.background.value}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            filter: 'brightness(0.45)',
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign }}>
        <div style={{
          fontSize, fontFamily, color: textColor,
          lineHeight: 1.4, fontWeight: 400,
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
          whiteSpace: 'pre-line',
          letterSpacing: fullscreen ? '0.02em' : '0.01em',
        }}>
          {lines}
        </div>
        {slide?.label && !fullscreen && (
          <div style={{
            position: 'absolute', bottom: -20, right: 0,
            fontSize: fontSize * 0.5, color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {slide.label}
          </div>
        )}
      </div>
    </div>
  );
}

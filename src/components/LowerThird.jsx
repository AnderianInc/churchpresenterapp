import React, { useState, useEffect } from 'react';
import { BROADCAST_CHANNEL } from '../store/AppContext';

/**
 * Lower-third overlay (Bible verse / announcement / custom text) drawn over the
 * live output. Self-subscribing: listens to the `lower-third` broadcast so it can
 * be dropped into any output window with no extra wiring.
 *
 * Overlay shape: { active, text, label, source, position, align, fontFamily, fontScale }
 *   position : 'bottom' (default) | 'top' | 'center'
 *   align    : 'left' (default) | 'center' | 'right'
 */
export default function LowerThird() {
  const [data, setData] = useState({ active: false, text: '', label: '', source: '' });

  useEffect(() => {
    let ch;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BROADCAST_CHANNEL);
      ch.onmessage = (e) => { if (e.data?.type === 'lower-third') setData(e.data.payload || { active: false }); };
    }
    const off = window.electronAPI?.onReceiveLowerThird?.((d) => setData(d || { active: false }));
    return () => { ch?.close(); off?.(); };
  }, []);

  const show = data?.active && data?.text;
  const position = data?.position || 'bottom';
  const align = data?.align || 'left';
  const fontFamily = data?.fontFamily || 'Georgia, serif';
  const fontScale = typeof data?.fontScale === 'number' ? data.fontScale : 1;

  // Vertical placement + scrim direction
  const vertical =
    position === 'top' ? { top: 0, bottom: 'auto', backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)' }
    : position === 'center' ? { top: '50%', bottom: 'auto', transform: 'translateY(-50%)', backgroundImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 50%, transparent 100%)' }
    : { bottom: 0, top: 'auto', backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)' };

  const textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      padding: `${position === 'center' ? '40px' : '64px'} 56px 40px`,
      transition: 'opacity 0.45s ease, transform 0.45s ease',
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' + (position === 'center' ? ' translateY(-50%)' : '') : `translateY(${position === 'top' ? '-16px' : '16px'})` + (position === 'center' ? ' translateY(-50%)' : ''),
      pointerEvents: 'none', zIndex: 40, textAlign,
      ...vertical,
    }}>
      {/* Accent bar (left-aligned only) */}
      {align === 'left' && (
        <div style={{
          width: 4, position: 'absolute', left: 40, top: 24, bottom: 24,
          background: 'linear-gradient(to bottom, transparent, #4f8ef7 40%, #4f8ef7 80%, transparent)',
          opacity: show ? 0.85 : 0, transition: 'opacity 0.45s ease',
        }} />
      )}

      {data?.label && (
        <div style={{
          fontSize: `${1.4 * fontScale}vw`, fontWeight: 700, color: '#7cb9fa',
          fontFamily: 'Inter, sans-serif', marginBottom: 6,
          textShadow: '0 1px 6px rgba(0,0,0,0.9)', letterSpacing: '0.5px', textTransform: 'uppercase',
        }}>
          {data.label}
        </div>
      )}

      <div style={{
        fontSize: `${2.6 * fontScale}vw`, color: '#ffffff', fontFamily,
        lineHeight: 1.4, textShadow: '0 2px 8px rgba(0,0,0,0.95)',
        maxWidth: align === 'center' ? '86%' : '80%',
        marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' || align === 'right' ? 'auto' : 0,
        whiteSpace: 'pre-line',
      }}>
        {data?.text}
      </div>

      {data?.source && (
        <div style={{
          fontSize: `${1.4 * fontScale}vw`, color: 'rgba(255,255,255,0.65)',
          fontFamily, marginTop: 6, fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
        }}>
          {data.source}
        </div>
      )}
    </div>
  );
}

import React from 'react';

function openLink(url) {
  if (window.electronAPI?.openExternalLink) {
    window.electronAPI.openExternalLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function ExternalLink({ href, children, style }) {
  return (
    <span
      onClick={() => openLink(href)}
      title={href}
      role="link"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openLink(href)}
      style={{
        color: 'var(--accent)',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
        ...style,
      }}
    >
      {children ?? href}
    </span>
  );
}

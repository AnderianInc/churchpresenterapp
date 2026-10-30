export function pickPreferredStreamSource(sources = [], options = {}) {
  const { preferredWindowName = 'Stream View', includeScreenFallback = true } = options;

  const normalized = Array.isArray(sources) ? sources : [];
  if (normalized.length === 0) return null;

  const preferredName = preferredWindowName.toLowerCase();
  const preferred = normalized.find((source) => {
    const name = String(source?.name || '').toLowerCase();
    return name.includes(preferredName) || name.includes('church presenter');
  });
  if (preferred) return preferred;

  if (includeScreenFallback) {
    const screenCapture = normalized.find((source) => {
      const id = String(source?.id || '');
      const type = String(source?.type || '').toLowerCase();
      return type === 'screen' || id.startsWith('screen:');
    });
    if (screenCapture) return screenCapture;
  }

  return normalized[0] || null;
}

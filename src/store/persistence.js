// Canonical schema validators — all return { valid, data, errors }

export function validateSong(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['not an object'] };
  const errors = [];
  if (typeof raw.id !== 'string' || !raw.id) errors.push('missing id');
  if (typeof raw.title !== 'string' || !raw.title.trim()) errors.push('missing title');
  if (!Array.isArray(raw.slides)) errors.push('slides must be array');
  return {
    valid: errors.length === 0,
    errors,
    data: {
      id: raw.id || crypto.randomUUID(),
      title: raw.title || 'Untitled',
      author: raw.author || '',
      key: raw.key || '',
      tempo: raw.tempo || '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      slides: Array.isArray(raw.slides) ? raw.slides.map(validateSlide) : [],
      background: raw.background || { type: 'color', value: '#0a0f1e' },
      textColor: raw.textColor || '#ffffff',
      fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 44,
      fontFamily: raw.fontFamily || 'Georgia',
    },
  };
}

function validateSlide(raw) {
  if (!raw || typeof raw !== 'object') return { id: crypto.randomUUID(), type: 'verse', label: 'Slide', lines: '' };
  return {
    id: raw.id || crypto.randomUUID(),
    type: raw.type || 'verse',
    label: raw.label || '',
    lines: raw.lines || '',
  };
}

export function validateSongsArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(s => validateSong(s).data);
}

export function validateScheduleArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && typeof item === 'object' && item.scheduleId && item.title);
}

export function validateSettings(raw) {
  const defaults = { theme: 'dark', defaultFontSize: 44, defaultFont: 'Georgia' };
  if (!raw || typeof raw !== 'object') return defaults;
  return { ...defaults, ...raw };
}

// Safe JSON parse — returns null on any error
export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// One-time migration: copy data from legacy ew_* keys to new cp_* keys.
// Safe to call multiple times — skips any key that already has cp_* data.
export function migrateLegacyStorage() {
  const pairs = [
    ['ew_songs',    'cp_songs'],
    ['ew_schedule', 'cp_schedule'],
    ['ew_settings', 'cp_settings'],
    ['ew_live_state', 'cp_live_state'],
  ];
  try {
    for (const [oldKey, newKey] of pairs) {
      if (localStorage.getItem(newKey) !== null) continue; // already migrated
      const legacy = localStorage.getItem(oldKey);
      if (legacy !== null) {
        localStorage.setItem(newKey, legacy);
        console.info(`[migration] Copied "${oldKey}" → "${newKey}"`);
      }
    }
  } catch (err) {
    console.warn('[migration] localStorage migration failed:', err.message);
  }
}

// localStorage helpers with schema validation and backup on corruption
export const storage = {
  load(key, validator, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = safeJsonParse(raw);
      if (parsed === null) {
        // Back up corrupted data before wiping
        localStorage.setItem(`${key}_backup_${Date.now()}`, raw);
        console.warn(`[storage] Corrupted data at key "${key}" — backed up and using fallback`);
        return fallback;
      }
      return validator(parsed);
    } catch (err) {
      console.error(`[storage] Error loading "${key}":`, err);
      return fallback;
    }
  },

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error(`[storage] Error saving "${key}":`, err);
    }
  },
};

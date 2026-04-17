import { v4 as uuidv4 } from 'uuid';

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
      id: raw.id || uuidv4(),
      title: raw.title || 'Untitled',
      author: raw.author || '',
      key: raw.key || '',
      tempo: raw.tempo || '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      slides: Array.isArray(raw.slides) ? raw.slides.map(validateSlide) : [],
      background: validateBackground(raw.background) || { type: 'color', value: '#0a0f1e' },
      textColor: raw.textColor || '#ffffff',
      fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 44,
      fontFamily: raw.fontFamily || 'Georgia',
    },
  };
}

function validateBackground(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type;
  if (type === 'color') return { type: 'color', value: typeof raw.value === 'string' ? raw.value : '#0a0f1e' };
  if (type === 'gradient') {
    const out = { type: 'gradient' };
    if (typeof raw.value === 'string') out.value = raw.value;
    if (Array.isArray(raw.stops)) out.stops = raw.stops;
    if (typeof raw.angle === 'number') out.angle = raw.angle;
    return out;
  }
  if (type === 'image') {
    const out = { type: 'image', value: typeof raw.value === 'string' ? raw.value : '' };
    if (typeof raw.brightness === 'number') out.brightness = raw.brightness;
    return out;
  }
  if (type === 'video') {
    return { type: 'video', value: typeof raw.value === 'string' ? raw.value : '', name: typeof raw.name === 'string' ? raw.name : '' };
  }
  return null;
}

function validateSlide(raw) {
  if (!raw || typeof raw !== 'object') return { id: uuidv4(), type: 'verse', label: 'Slide', lines: '' };
  const slide = {
    id: raw.id || uuidv4(),
    type: raw.type || 'verse',
    label: raw.label || '',
    lines: raw.lines || '',
  };
  // Preserve optional per-slide fields added in P6/P8
  if (typeof raw.textAlign === 'string') slide.textAlign = raw.textAlign;
  if (typeof raw.chords === 'string') slide.chords = raw.chords;
  const bg = validateBackground(raw.background);
  if (bg) slide.background = bg;
  return slide;
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

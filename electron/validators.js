/**
 * electron/validators.js
 *
 * CommonJS mirror of src/store/persistence.js.
 * Kept in sync manually — if you change the schema in persistence.js,
 * update this file too. The two files exist because the renderer uses
 * ES modules (import/export) while the main process uses CommonJS (require).
 *
 * All validators return a normalised value — they never throw.
 */

const { randomUUID } = require('crypto');

function validateSlide(raw) {
  if (!raw || typeof raw !== 'object') {
    return { id: randomUUID(), type: 'verse', label: 'Slide', lines: '' };
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    type: typeof raw.type === 'string' ? raw.type : 'verse',
    label: typeof raw.label === 'string' ? raw.label : '',
    lines: typeof raw.lines === 'string' ? raw.lines : '',
  };
}

function validateSong(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: randomUUID(), title: 'Untitled', author: '', key: '', tempo: '', tags: [],
      slides: [], background: { type: 'color', value: '#0a0f1e' },
      textColor: '#ffffff', fontSize: 44, fontFamily: 'Georgia',
    };
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled',
    author: typeof raw.author === 'string' ? raw.author : '',
    key: typeof raw.key === 'string' ? raw.key : '',
    tempo: typeof raw.tempo === 'string' ? raw.tempo : '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    slides: Array.isArray(raw.slides) ? raw.slides.map(validateSlide) : [],
    background: raw.background && typeof raw.background === 'object'
      ? raw.background
      : { type: 'color', value: '#0a0f1e' },
    textColor: typeof raw.textColor === 'string' ? raw.textColor : '#ffffff',
    fontSize: typeof raw.fontSize === 'number' && raw.fontSize > 0 ? raw.fontSize : 44,
    fontFamily: typeof raw.fontFamily === 'string' ? raw.fontFamily : 'Georgia',
  };
}

function validateSongsArray(raw) {
  if (!Array.isArray(raw)) return null; // null signals "use defaults"
  return raw.map(validateSong);
}

function validateScheduleArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    item => item && typeof item === 'object' && item.scheduleId && item.title
  );
}

function validateSettings(raw) {
  const defaults = { theme: 'dark', defaultFontSize: 44, defaultFont: 'Georgia' };
  if (!raw || typeof raw !== 'object') return defaults;
  return { ...defaults, ...raw };
}

const VALIDATORS = {
  songs: validateSongsArray,
  schedules: validateScheduleArray,
  settings: validateSettings,
};

module.exports = { VALIDATORS, validateSongsArray, validateScheduleArray, validateSettings };

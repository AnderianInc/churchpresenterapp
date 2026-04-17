/**
 * electron/defaultData.js
 *
 * Single source of truth is src/data/defaultSongs.js.
 * This file re-exports it for the Electron main process (CommonJS).
 *
 * Because src/data/defaultSongs.js uses module.exports (no ES-only syntax),
 * Node.js can require() it directly — no duplication, no drift risk.
 */

const defaultSongs = require('../src/data/defaultSongs');

module.exports = { defaultSongs };

const { app, BrowserWindow, Menu, ipcMain, screen, dialog, desktopCapturer, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { execSync, spawn } = require('child_process');
const { VALIDATORS } = require('./validators.js');
const { defaultSongs } = require('./defaultData.js');
const perf = require('./perf.js');
const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';

app.name = 'Church Presenter';

// Register media:// as a privileged scheme so <video>/<audio> elements can
// stream local files with proper byte-range support via net.fetch.
// Must be called before app.whenReady().
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true } },
]);

// Suppress VTCompressionSessionCreate (-12908) errors on macOS by falling back
// to software video encoding. This avoids log noise when hardware encoder is busy.
// Platform video codec flags
if (process.platform === 'darwin') {
  // Suppress hardware encode errors; keep hardware DECODING enabled for H.264/HEVC
  app.commandLine.appendSwitch('disable-accelerated-video-encode');
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,PlatformHEVCSwDecoderSupport');
}
if (process.platform === 'win32') {
  // Use Windows Media Foundation for H.264 and HEVC hardware decoding
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,MediaFoundationH264Encoding');
}

// Data directory
const dataDir = path.join(app.getPath('userData'), 'data');

const files = {
  songs: path.join(dataDir, 'songs.json'),
  schedules: path.join(dataDir, 'schedules.json'),
  settings: path.join(dataDir, 'settings.json'),
};

const FILE_DEFAULTS = {
  songs: () => defaultSongs,
  schedules: () => [],
  settings: () => ({ theme: 'dark', defaultFontSize: 44, defaultFont: 'Georgia', displayLabels: {}, routingPresets: [], rtmpDestinations: [], pcoAppId: '', pcoSecret: '', anthropicApiKey: '', geniusApiKey: '', bibleFavoriteVersionIds: [], bibleXmlDir: '', preferredMicId: '', preferredCameraId: '', preferredDisplayIndex: null, videoFavorites: [], imageFavorites: [], savedServices: [] }),
};

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * One-time migration: copy JSON files from the legacy "easyworship-clone" userData
 * directory to the new "church-presenter" directory.
 * Safe to call on every startup — skips files that already exist at the new path.
 */
function migrateLegacyDataDir() {
  const oldDataDir = path.join(
    path.dirname(app.getPath('userData')),
    'easyworship-clone',
    'data'
  );
  if (!fs.existsSync(oldDataDir)) return;

  const filesToMigrate = ['songs.json', 'schedules.json', 'settings.json'];
  let migrated = 0;
  for (const fileName of filesToMigrate) {
    const src = path.join(oldDataDir, fileName);
    const dest = path.join(dataDir, fileName);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      try {
        fs.copyFileSync(src, dest);
        console.info(`[migration] Copied ${fileName} from legacy data directory`);
        migrated++;
      } catch (err) {
        console.warn(`[migration] Could not copy ${fileName}:`, err.message);
      }
    }
  }
  if (migrated > 0) {
    console.info(`[migration] Migrated ${migrated} file(s) from easyworship-clone → church-presenter`);
  }
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  migrateLegacyDataDir();
  Object.entries(files).forEach(([key, filePath]) => {
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filePath, FILE_DEFAULTS[key]());
    }
  });
}

let mainWindow = null;
let presentationWindow = null;
let stageWindow = null;
let streamWindow = null;
const outputWindows = new Map();
const rtmpProcesses = new Map();
let pendingRtmpSourceId = null;
let pendingRecordingSourceId = null;

// ── RTMP helpers ──────────────────────────────────────────────────────────────

function findFFmpegPath() {
  // First try PATH
  try {
    execSync('ffmpeg -version', { stdio: 'pipe', timeout: 3000 });
    return 'ffmpeg';
  } catch (_) {
    // not on PATH, try common locations
  }

  const candidates = process.platform === 'win32'
    ? ['C:\\ffmpeg\\bin\\ffmpeg.exe']
    : ['/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'];

  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" -version`, { stdio: 'pipe', timeout: 3000 });
      return candidate;
    } catch (_) {
      // try next
    }
  }

  return null;
}

function stopRtmpProcess(destId) {
  const proc = rtmpProcesses.get(destId);
  if (!proc) return;

  try { proc.stdin.end(); } catch (_) {}
  try { proc.kill('SIGTERM'); } catch (_) {}
  rtmpProcesses.delete(destId);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('rtmp-status', { destId, type: 'stopped' });
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1d23',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : pathToFileURL(path.join(__dirname, '../build/index.html')).href;

  mainWindow.loadURL(startUrl);
  mainWindow.webContents.once('did-finish-load', () => perf.recordStartup());
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    // Consume whichever pending source was set (RTMP takes priority)
    const sourceId = pendingRtmpSourceId || pendingRecordingSourceId;
    pendingRtmpSourceId = null;
    pendingRecordingSourceId = null;

    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });

    if (sourceId) {
      const source = sources.find(s => s.id === sourceId);
      if (source) { callback({ video: source }); return; }
    }

    // No pre-selected source: auto-pick the best presentation surface.
    // Priority: Stream View → any Church Presenter window → primary screen.
    const auto =
      sources.find(s => s.name?.includes('Stream View')) ||
      sources.find(s => s.name?.includes('Church Presenter') && s.id.startsWith('window:')) ||
      sources.find(s => s.id.startsWith('screen:'));

    if (auto) { callback({ video: auto }); return; }
    if (sources.length > 0) { callback({ video: sources[0] }); return; }
    callback({});
  });

  mainWindow.on('closed', () => {
    // Kill all active RTMP processes on main window close
    for (const destId of rtmpProcesses.keys()) {
      stopRtmpProcess(destId);
    }
    rtmpProcesses.clear();

    mainWindow = null;
    if (presentationWindow) presentationWindow.close();
    if (stageWindow) stageWindow.close();
    if (streamWindow) streamWindow.close();
    for (const entry of outputWindows.values()) {
      entry.window.close();
    }
    outputWindows.clear();
  });
}

function createPresentationWindow(displayIndex = 1) {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays[displayIndex] || displays[0];
  const { x, y, width, height } = targetDisplay.bounds;

  presentationWindow = new BrowserWindow({
    x, y, width, height,
    frame: true,
    title: '',
    ...(isMac ? { titleBarStyle: 'hidden' } : {}),
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  presentationWindow.setMenuBarVisibility(false);

  const startUrl = isDev
    ? 'http://localhost:3000/presentation'
    : pathToFileURL(path.join(__dirname, '../build/index.html')).href;

  presentationWindow.loadURL(startUrl + (isDev ? '' : '#/presentation'));

  presentationWindow.on('closed', () => {
    presentationWindow = null;
    if (mainWindow) mainWindow.webContents.send('presentation-closed');
  });
}

function createStageWindow() {
  stageWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    backgroundColor: '#000000',
    frame: true,
    title: '',
    ...(isMac ? { titleBarStyle: 'hidden' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  stageWindow.setMenuBarVisibility(false);

  const startUrl = isDev
    ? 'http://localhost:3000/stage'
    : pathToFileURL(path.join(__dirname, '../build/index.html')).href;

  stageWindow.loadURL(startUrl + (isDev ? '' : '#/stage'));

  stageWindow.on('closed', () => {
    stageWindow = null;
    if (mainWindow) mainWindow.webContents.send('stage-closed');
  });
}

function createOutputWindow({ id, role, displayIndex = 1, title }) {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays[displayIndex] || displays[0];
  const { x, y, width, height } = targetDisplay.bounds;

  const outputWindow = new BrowserWindow({
    x, y, width, height,
    resizable: true,
    movable: true,
    frame: true,
    title: '',
    ...(isMac ? { titleBarStyle: 'hidden' } : {}),
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  outputWindow.setMenuBarVisibility(false);

  const startUrl = isDev
    ? 'http://localhost:3000'
    : pathToFileURL(path.join(__dirname, '../build/index.html')).href;

  const route = isDev
    ? `/output?role=${encodeURIComponent(role)}&id=${encodeURIComponent(id)}`
    : `#/output?role=${encodeURIComponent(role)}&id=${encodeURIComponent(id)}`;

  outputWindow.loadURL(startUrl + route);
  outputWindows.set(id, { window: outputWindow, role, displayIndex, title: title || role });

  outputWindow.on('closed', () => {
    outputWindows.delete(id);
    if (mainWindow) mainWindow.webContents.send('output-closed', id);
  });
}

function createStreamWindow(displayIndex = 0) {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays[displayIndex] || displays[0];
  const { x, y } = targetDisplay.bounds;

  streamWindow = new BrowserWindow({
    x, y,
    width: 1280,
    height: 720,
    frame: true,
    title: '',
    ...(isMac ? { titleBarStyle: 'hidden' } : {}),
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  streamWindow.setMenuBarVisibility(false);

  const startUrl = isDev
    ? 'http://localhost:3000/stream'
    : pathToFileURL(path.join(__dirname, '../build/index.html')).href;

  streamWindow.loadURL(startUrl + (isDev ? '' : '#/stream'));

  streamWindow.on('closed', () => {
    streamWindow = null;
    if (mainWindow) mainWindow.webContents.send('stream-closed');
  });
}

// ── Hardened persistence helpers ──────────────────────────────────────────────

/**
 * Back up a bad file to a timestamped path, log it, then overwrite with defaults.
 */
function recoverCorruptFile(key, filePath, reason) {
  const backupPath = filePath.replace('.json', `_corrupt_${Date.now()}.json`);
  try {
    if (fs.existsSync(filePath)) fs.renameSync(filePath, backupPath);
    console.warn(`[persistence] "${key}" was corrupt (${reason}). Backed up to ${backupPath}, restoring defaults.`);
  } catch (backupErr) {
    console.error(`[persistence] Could not back up corrupt "${key}":`, backupErr.message);
  }
  const safeDefault = FILE_DEFAULTS[key]?.() ?? null;
  try {
    fs.writeFileSync(filePath, JSON.stringify(safeDefault, null, 2));
  } catch (writeErr) {
    console.error(`[persistence] Could not write default for "${key}":`, writeErr.message);
  }
  return safeDefault;
}

// IPC Handlers - File system
ipcMain.handle('read-file', async (_, key) => {
  const filePath = files[key];
  if (!filePath) return null;

  // File absent — ensureDataDir should have created it, but handle gracefully
  if (!fs.existsSync(filePath)) return FILE_DEFAULTS[key]?.() ?? null;

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (readErr) {
    console.error(`[persistence] Cannot read "${key}":`, readErr.message);
    return FILE_DEFAULTS[key]?.() ?? null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return recoverCorruptFile(key, filePath, 'JSON parse error');
  }

  // Validate / normalise
  const validator = VALIDATORS[key];
  if (!validator) return parsed;

  const normalised = validator(parsed);

  // songs: null means "use defaults" (non-array input)
  if (key === 'songs' && normalised === null) {
    console.warn('[persistence] songs.json was not an array — restoring defaults.');
    return recoverCorruptFile(key, filePath, 'not an array');
  }

  return normalised;
});

ipcMain.handle('write-file', async (_, key, data) => {
  const filePath = files[key];
  if (!filePath) return false;
  try {
    // Atomic write: write to .tmp then rename to avoid partial-write corruption
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error(`[persistence] Write failed for "${key}":`, err.message);
    return false;
  }
});

// IPC Handlers - Windows
ipcMain.handle('open-presentation', async (_, displayIndex) => {
  if (!presentationWindow) createPresentationWindow(displayIndex);
  return true;
});

ipcMain.handle('close-presentation', async () => {
  if (presentationWindow) { presentationWindow.close(); presentationWindow = null; }
  return true;
});

ipcMain.handle('open-stage', async () => {
  if (!stageWindow) createStageWindow();
  return true;
});

ipcMain.handle('close-stage', async () => {
  if (stageWindow) { stageWindow.close(); stageWindow = null; }
  return true;
});

ipcMain.handle('open-stream', async (_, displayIndex) => {
  if (!streamWindow) createStreamWindow(displayIndex ?? 0);
  else streamWindow.focus();
  return true;
});

ipcMain.handle('close-stream', async () => {
  if (streamWindow) { streamWindow.close(); streamWindow = null; }
  return true;
});

ipcMain.handle('open-output-window', async (_, payload) => {
  if (!outputWindows.has(payload.id)) createOutputWindow(payload);
  return true;
});

ipcMain.handle('close-output-window', async (_, id) => {
  const entry = outputWindows.get(id);
  if (entry && entry.window) {
    entry.window.close();
  }
  outputWindows.delete(id);
  return true;
});

ipcMain.handle('minimize-output-window', async (_, id) => {
  const entry = outputWindows.get(id);
  if (entry?.window && !entry.window.isDestroyed()) entry.window.minimize();
  return true;
});

ipcMain.handle('toggle-fullscreen', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  win.setFullScreen(!win.isFullScreen());
});

ipcMain.handle('move-output-window', async (_, { id, displayIndex }) => {
  const entry = outputWindows.get(id);
  if (!entry || !entry.window || entry.window.isDestroyed()) return false;

  const displays = screen.getAllDisplays();
  const targetDisplay = displays[displayIndex] || displays[0];
  const { x, y, width, height } = targetDisplay.bounds;

  try {
    entry.window.setFullScreen(false);
    entry.window.setBounds({ x, y, width, height });
    entry.window.setFullScreen(true);
    entry.displayIndex = displayIndex;
    outputWindows.set(id, entry);
  } catch (err) {
    console.error(`[output] Failed to move output window ${id}:`, err.message);
    return false;
  }

  return true;
});

ipcMain.handle('update-output-window-role', async (_, { id, role, title }) => {
  const entry = outputWindows.get(id);
  if (!entry || !entry.window || entry.window.isDestroyed()) return false;
  entry.role = role;
  entry.title = title || role;
  try {
    entry.window.setTitle(entry.title);
  } catch (err) {
    console.error(`[output] Failed to update output window role ${id}:`, err.message);
  }
  outputWindows.set(id, entry);
  return true;
});

ipcMain.handle('get-output-windows', async () => {
  return Array.from(outputWindows.entries()).map(([id, entry]) => ({
    id,
    role: entry.role,
    displayIndex: entry.displayIndex,
    title: entry.title,
  }));
});

ipcMain.handle('get-displays', async () => {
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id, index: i, label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})`,
    bounds: d.bounds, isPrimary: d === screen.getPrimaryDisplay()
  }));
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Bible package folder',
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('read-directory', async (_, folderPath) => {
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
    }));
  } catch (err) {
    console.error('[fs] read-directory failed', err.message);
    return [];
  }
});

ipcMain.handle('read-file-text', async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error('[fs] read-file-text failed', err.message);
    return null;
  }
});

// IPC - Slide broadcast (program vs stage are independent streams)
ipcMain.on('send-slide-program', (_, slideData) => {
  perf.recordSlideChange();
  // Stamp wall-clock send time so receiving windows can measure IPC latency
  const stamped = slideData ? { ...slideData, _sentAt: Date.now() } : slideData;
  if (presentationWindow) presentationWindow.webContents.send('receive-slide', stamped);
});
ipcMain.on('send-slide-stage', (_, slideData) => {
  const stamped = slideData ? { ...slideData, _sentAt: Date.now() } : slideData;
  if (stageWindow) stageWindow.webContents.send('receive-slide', stamped);
});

ipcMain.on('send-blackout', (_, isBlackout) => {
  if (presentationWindow) presentationWindow.webContents.send('receive-blackout', isBlackout);
  if (stageWindow) stageWindow.webContents.send('receive-blackout', isBlackout);
  if (streamWindow) streamWindow.webContents.send('receive-blackout', isBlackout);
});

ipcMain.on('send-clear', (_, isClear) => {
  if (presentationWindow) presentationWindow.webContents.send('receive-clear', isClear);
  if (stageWindow) stageWindow.webContents.send('receive-clear', isClear);
});

ipcMain.on('send-output-state', (_, state) => {
  for (const entry of outputWindows.values()) {
    entry.window.webContents.send('receive-output', state);
  }
});

ipcMain.on('send-youtube-control', (_, payload) => {
  for (const entry of outputWindows.values()) {
    entry.window.webContents.send('receive-youtube-control', payload);
  }
});

// State relay: output window → main operator window
ipcMain.on('send-youtube-state', (_, payload) => {
  if (mainWindow) mainWindow.webContents.send('receive-youtube-state', payload);
});

ipcMain.on('send-video-control', (_, payload) => {
  for (const entry of outputWindows.values()) {
    entry.window.webContents.send('receive-video-control', payload);
  }
});

// State relay: output window → main operator window
ipcMain.on('send-video-state', (_, payload) => {
  if (mainWindow) mainWindow.webContents.send('receive-video-state', payload);
});

// Stream window — lower-third overlay and camera config
ipcMain.on('send-lower-third', (_, data) => {
  if (streamWindow) streamWindow.webContents.send('receive-lower-third', data);
});

ipcMain.on('send-stream-config', (_, config) => {
  if (streamWindow) streamWindow.webContents.send('receive-stream-config', config);
});

// IPC Handlers - RTMP / Social streaming
ipcMain.handle('check-ffmpeg', async () => {
  const ffmpegPath = findFFmpegPath();
  return { available: ffmpegPath !== null, path: ffmpegPath };
});

ipcMain.handle('get-stream-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  return sources.map(s => ({ id: s.id, name: s.name }));
});

ipcMain.handle('set-rtmp-source', async (_, sourceId) => {
  pendingRtmpSourceId = sourceId;
  return true;
});

// Returns all capturable windows and screens (for recording source auto-detection)
ipcMain.handle('get-capturable-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  return sources.map(s => ({ id: s.id, name: s.name, type: s.id.startsWith('screen:') ? 'screen' : 'window' }));
});

ipcMain.handle('set-recording-source', async (_, sourceId) => {
  pendingRecordingSourceId = sourceId;
  return true;
});

ipcMain.handle('start-rtmp', async (event, { destId, rtmpUrl }) => {
  try {
    const ffmpegPath = findFFmpegPath();
    if (!ffmpegPath) {
      return { error: 'FFmpeg not found. Please install FFmpeg and ensure it is on your PATH.' };
    }

    if (rtmpProcesses.has(destId)) {
      stopRtmpProcess(destId);
    }

    const args = [
      '-re',
      '-f', 'webm',
      '-i', 'pipe:0',
      '-vcodec', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-b:v', '2500k',
      '-maxrate', '2500k',
      '-bufsize', '5000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'flv',
      rtmpUrl,
    ];

    const proc = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    rtmpProcesses.set(destId, proc);
    const startTime = Date.now();

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits/);
      const bitrate = bitrateMatch ? parseFloat(bitrateMatch[1]) : null;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('rtmp-status', { destId, type: 'progress', bitrate, elapsed });
      }
    });

    proc.on('close', (code) => {
      rtmpProcesses.delete(destId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('rtmp-status', { destId, type: 'closed', code });
      }
    });

    proc.on('error', (err) => {
      rtmpProcesses.delete(destId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('rtmp-status', { destId, type: 'error', error: err.message });
      }
    });

    return { started: true };
  } catch (err) {
    console.error('[rtmp] start-rtmp failed', err.message);
    return { error: err.message };
  }
});

ipcMain.on('rtmp-chunk', (_, { destId, chunk }) => {
  const proc = rtmpProcesses.get(destId);
  if (proc && proc.stdin && proc.stdin.writable) {
    try {
      proc.stdin.write(Buffer.from(chunk));
    } catch (err) {
      console.error(`[rtmp] Failed to write chunk for ${destId}:`, err.message);
    }
  }
});

ipcMain.handle('stop-rtmp', async (_, destId) => {
  if (destId) {
    stopRtmpProcess(destId);
  } else {
    for (const id of Array.from(rtmpProcesses.keys())) {
      stopRtmpProcess(id);
    }
  }
  return true;
});

// IPC - Planning Center Online song search
ipcMain.handle('search-pco-songs', async (_, { query, appId, secret }) => {
  const auth = Buffer.from(`${appId}:${secret}`).toString('base64');
  const url = `https://api.planningcenteronline.com/services/v2/songs?per_page=25&where[search_name]=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Authorization': `Basic ${auth}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PCO API ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
});

ipcMain.handle('fetch-pco-arrangements', async (_, { songId, appId, secret }) => {
  const auth = Buffer.from(`${appId}:${secret}`).toString('base64');
  const res = await fetch(
    `https://api.planningcenteronline.com/services/v2/songs/${songId}/arrangements`,
    { headers: { 'Authorization': `Basic ${auth}` } }
  );
  if (!res.ok) throw new Error(`PCO API ${res.status}`);
  return res.json();
});

// IPC - Genius.com lyrics search and scrape
ipcMain.handle('search-genius-songs', async (_, { query, apiKey }) => {
  if (!apiKey) throw new Error('No Genius API key configured');
  const { net } = require('electron');
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
  const res = await net.fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Genius API ${res.status}: ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  return (data.response?.hits || []).map(h => ({
    id: h.result.id,
    title: h.result.title,
    artist: h.result.primary_artist?.name || '',
    thumbnail: h.result.song_art_image_thumbnail_url || '',
    url: h.result.url,
  }));
});

ipcMain.handle('fetch-genius-lyrics', async (_, { pageUrl }) => {
  if (!pageUrl) throw new Error('No page URL provided');
  const { net } = require('electron');
  const res = await net.fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch lyrics page: ${res.status}`);
  const html = await res.text();

  // Extract all data-lyrics-container div contents using a depth-tracking
  // parser. The naive regex [\s\S]*?<\/div> stops at the first nested </div>
  // and misses the rest of the lyrics.
  function extractLyricContainers(src) {
    const found = [];
    let pos = 0;
    while (pos < src.length) {
      const markerIdx = src.indexOf('data-lyrics-container="true"', pos);
      if (markerIdx === -1) break;
      // Walk back to the opening < of this tag
      const tagOpen = src.lastIndexOf('<', markerIdx);
      // Find the end of the opening tag
      const tagClose = src.indexOf('>', markerIdx);
      if (tagClose === -1) break;
      // Self-closing div edge case
      if (src[tagClose - 1] === '/') { pos = tagClose + 1; continue; }
      // Now walk forward tracking div depth to find the matching </div>
      let depth = 1;
      let cur = tagClose + 1;
      const innerStart = cur;
      while (cur < src.length && depth > 0) {
        const nextOpen = src.indexOf('<div', cur);
        const nextClose = src.indexOf('</div>', cur);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          cur = nextOpen + 4;
        } else {
          depth--;
          if (depth === 0) found.push(src.slice(innerStart, nextClose));
          cur = nextClose + 6;
        }
      }
      pos = cur;
    }
    return found;
  }

  const containers = extractLyricContainers(html);

  if (containers.length === 0) {
    throw new Error('Could not find lyrics on this page. The song page format may have changed.');
  }

  let rawLyrics = containers
    .join('\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // Decode numeric HTML entities before named ones
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Strip Genius metadata preamble concatenated before the first section marker.
  // e.g. "28 ContributorsTranslationsEspañolPraise Lyrics[Intro: Chandler Moore]"
  const firstBracket = rawLyrics.indexOf('[');
  if (firstBracket > 0 && !rawLyrics.slice(0, firstBracket).includes('\n')) {
    rawLyrics = rawLyrics.slice(firstBracket);
  }

  return rawLyrics;
});

// IPC - Open external URL in the system browser
ipcMain.handle('open-external-link', async (_, url) => {
  const { shell } = require('electron');
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

// IPC - Claude AI verse suggestions for sermon assistant
ipcMain.handle('suggest-verses', async (_, { transcript, apiKey }) => {
  if (!apiKey) throw new Error('No Anthropic API key configured');
  const prompt = `You are a Bible verse assistant for a live church service presenter. Given the sermon transcript excerpt below, suggest 3-5 relevant Bible verses the presenter might want to display on screen for the congregation.

Return ONLY a JSON array with no other text, markdown, or explanation:
[{"reference": "John 3:16", "reason": "brief reason why this verse fits the current sermon topic"}]

Sermon transcript:
${transcript}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '[]';
  // Strip any markdown code fences the model might add
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
});

// IPC - Copy an imported media file (video/image) to the app's persistent media directory
// Returns the stored file:// path so it survives app restarts.
// In the renderer, Electron's File objects expose a .path property.
ipcMain.handle('copy-media-file', async (_, srcPath) => {
  if (!srcPath || typeof srcPath !== 'string') throw new Error('Invalid source path');
  const mediaDir = path.join(app.getPath('userData'), 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  const ext = path.extname(srcPath) || '.mp4';
  const destName = `${require('crypto').randomUUID()}${ext}`;
  const destPath = path.join(mediaDir, destName);
  fs.copyFileSync(srcPath, destPath);
  // Use media:// scheme (registered above) so <video> gets proper byte-range
  // streaming support. pathToFileURL handles Windows backslash paths correctly.
  return pathToFileURL(destPath).href.replace(/^file:/, 'media:');
});

// IPC - Save a local recording to disk via a native save dialog
ipcMain.handle('save-recording', async (_, { buffer, filename, convertToMp4 }) => {
  const defaultDir = app.getPath('videos');
  const mp4Name = filename.replace(/\.webm$/i, '.mp4');

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(defaultDir, convertToMp4 ? mp4Name : filename),
    filters: convertToMp4
      ? [{ name: 'MP4 Video', extensions: ['mp4'] }, { name: 'All Files', extensions: ['*'] }]
      : [{ name: 'WebM Video', extensions: ['webm'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['createDirectory'],
  });
  if (canceled || !filePath) return { canceled: true };

  if (convertToMp4) {
    const ffmpegPath = findFFmpegPath();
    if (!ffmpegPath) {
      // FFmpeg not available — fall back to saving webm
      await fs.promises.writeFile(filePath, Buffer.from(buffer));
      return { filePath, warning: 'FFmpeg not found — saved as WebM instead.' };
    }
    // Write webm to a temp file, convert, then delete temp
    const tmpPath = filePath + '.tmp.webm';
    try {
      await fs.promises.writeFile(tmpPath, Buffer.from(buffer));
      execSync(
        `"${ffmpegPath}" -y -i "${tmpPath}" -c:v libx264 -preset fast -crf 22 -c:a aac -movflags +faststart "${filePath}"`,
        { timeout: 300_000 } // 5 min max
      );
    } finally {
      fs.unlink(tmpPath, () => {}); // cleanup temp regardless
    }
  } else {
    await fs.promises.writeFile(filePath, Buffer.from(buffer));
  }

  return { filePath };
});

// IPC - Open the folder containing a saved recording
ipcMain.on('open-recording-folder', (_, folderPath) => {
  shell.openPath(folderPath || app.getPath('videos'));
});

app.whenReady().then(() => {
  perf.start(app);

  // Replace default "Electron" menu with a minimal Church Presenter menu
  const menuTemplate = [
    ...(isMac ? [{
      label: 'Church Presenter',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(isMac ? [{ role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // media:// → file:// proxy so <video> gets byte-range streaming support.
  // net.fetch with a file:// URL handles Accept-Ranges correctly in Electron 25+.
  protocol.handle('media', (request) => {
    const fileUrl = request.url.replace(/^media:/, 'file:');
    return net.fetch(fileUrl);
  });

  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    const status = systemPreferences.getMediaAccessStatus('screen');
    // Only prompt when permission has never been set — 'denied' means the user consciously declined
    if (status === 'not-determined') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }
  }
  ensureDataDir();
  createMainWindow();
});

app.on('before-quit', () => perf.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createMainWindow();
});

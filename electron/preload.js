const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File system
  readFile: (key) => ipcRenderer.invoke('read-file', key),
  writeFile: (key, data) => ipcRenderer.invoke('write-file', key, data),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readDirectory: (folderPath) => ipcRenderer.invoke('read-directory', folderPath),
  readFileText: (filePath) => ipcRenderer.invoke('read-file-text', filePath),

  // Windows
  openPresentation: (displayIndex) => ipcRenderer.invoke('open-presentation', displayIndex),
  closePresentation: () => ipcRenderer.invoke('close-presentation'),
  openStage: () => ipcRenderer.invoke('open-stage'),
  closeStage: () => ipcRenderer.invoke('close-stage'),
  openOutputWindow: (options) => ipcRenderer.invoke('open-output-window', options),
  closeOutputWindow: (id) => ipcRenderer.invoke('close-output-window', id),
  minimizeOutputWindow: (id) => ipcRenderer.invoke('minimize-output-window', id),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  moveOutputWindow: (payload) => ipcRenderer.invoke('move-output-window', payload),
  updateOutputWindowRole: (payload) => ipcRenderer.invoke('update-output-window-role', payload),
  getOutputWindows: () => ipcRenderer.invoke('get-output-windows'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),

  // Slide control — program (audience) vs stage (worship team) can differ
  sendSlideProgram: (slideData) => ipcRenderer.send('send-slide-program', slideData),
  sendSlideStage: (slideData) => ipcRenderer.send('send-slide-stage', slideData),
  sendBlackout: (isBlackout) => ipcRenderer.send('send-blackout', isBlackout),
  sendClear: (isClear) => ipcRenderer.send('send-clear', isClear),
  sendOutputState: (payload) => ipcRenderer.send('send-output-state', payload),
  sendYouTubeControl: (payload) => ipcRenderer.send('send-youtube-control', payload),
  sendYouTubeState: (payload) => ipcRenderer.send('send-youtube-state', payload),
  sendVideoControl: (payload) => ipcRenderer.send('send-video-control', payload),
  sendVideoState: (payload) => ipcRenderer.send('send-video-state', payload),

  // Listeners
  onReceiveSlide: (cb) => ipcRenderer.on('receive-slide', (_, data) => cb(data)),
  onReceiveBlackout: (cb) => ipcRenderer.on('receive-blackout', (_, v) => cb(v)),
  onReceiveClear: (cb) => ipcRenderer.on('receive-clear', (_, v) => cb(v)),
  onReceiveOutput: (cb) => ipcRenderer.on('receive-output', (_, data) => cb(data)),
  onReceiveYouTubeControl: (cb) => ipcRenderer.on('receive-youtube-control', (_, data) => cb(data)),
  onReceiveYouTubeState: (cb) => ipcRenderer.on('receive-youtube-state', (_, data) => cb(data)),
  onReceiveVideoControl: (cb) => ipcRenderer.on('receive-video-control', (_, data) => cb(data)),
  onReceiveVideoState: (cb) => ipcRenderer.on('receive-video-state', (_, data) => cb(data)),
  onPresentationClosed: (cb) => ipcRenderer.on('presentation-closed', cb),
  onStageClosed: (cb) => ipcRenderer.on('stage-closed', cb),
  onOutputWindowClosed: (cb) => ipcRenderer.on('output-closed', (_, id) => cb(id)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Stream window
  openStream: (displayIndex) => ipcRenderer.invoke('open-stream', displayIndex),
  closeStream: () => ipcRenderer.invoke('close-stream'),
  sendLowerThird: (data) => ipcRenderer.send('send-lower-third', data),
  sendStreamConfig: (config) => ipcRenderer.send('send-stream-config', config),
  onReceiveLowerThird: (cb) => ipcRenderer.on('receive-lower-third', (_, data) => cb(data)),
  onReceiveStreamConfig: (cb) => ipcRenderer.on('receive-stream-config', (_, data) => cb(data)),
  onStreamClosed: (cb) => ipcRenderer.on('stream-closed', cb),

  // RTMP / Social streaming
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  getStreamSources: () => ipcRenderer.invoke('get-stream-sources'),
  setRtmpSource: (sourceId) => ipcRenderer.invoke('set-rtmp-source', sourceId),
  startRtmp: (opts) => ipcRenderer.invoke('start-rtmp', opts),
  stopRtmp: (destId) => ipcRenderer.invoke('stop-rtmp', destId),
  sendRtmpChunk: (destId, chunk) => ipcRenderer.send('rtmp-chunk', { destId, chunk }),
  onRtmpStatus: (cb) => ipcRenderer.on('rtmp-status', (_, data) => cb(data)),

  // Planning Center
  searchPcoSongs: (opts) => ipcRenderer.invoke('search-pco-songs', opts),
  fetchPcoArrangements: (opts) => ipcRenderer.invoke('fetch-pco-arrangements', opts),

  // Genius lyrics search
  searchGeniusSongs: (opts) => ipcRenderer.invoke('search-genius-songs', opts),
  fetchGeniusLyrics: (opts) => ipcRenderer.invoke('fetch-genius-lyrics', opts),

  // Sermon Assistant — AI verse suggestions
  suggestVerses: (opts) => ipcRenderer.invoke('suggest-verses', opts),

  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),

  // Media file persistence — copies imported video/image to app data dir; returns file:// path
  copyMediaFile: (srcPath) => ipcRenderer.invoke('copy-media-file', srcPath),

  // Local recording — save WebM blob to disk via native save dialog
  saveRecording: ({ buffer, filename }) => ipcRenderer.invoke('save-recording', { buffer, filename }),
  openRecordingFolder: (folderPath) => ipcRenderer.send('open-recording-folder', folderPath),
  getCapturableSources: () => ipcRenderer.invoke('get-capturable-sources'),
  setRecordingSource: (sourceId) => ipcRenderer.invoke('set-recording-source', sourceId),

  isElectron: true,
});

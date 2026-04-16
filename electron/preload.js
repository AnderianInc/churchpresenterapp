const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File system
  readFile: (key) => ipcRenderer.invoke('read-file', key),
  writeFile: (key, data) => ipcRenderer.invoke('write-file', key, data),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readDirectory: (folderPath) => ipcRenderer.invoke('read-directory', folderPath),
  readFileText: (filePath) => ipcRenderer.invoke('read-file-text', filePath),
  getYouVersionHasKey: () => ipcRenderer.invoke('get-youversion-has-key'),
  fetchYouVersionVersions: (appKey, language) => ipcRenderer.invoke('fetch-youversion-versions', appKey, language),
  fetchYouVersionVersion: (appKey, versionId) => ipcRenderer.invoke('fetch-youversion-version', appKey, versionId),
  fetchYouVersionPassage: (appKey, versionId, reference, format) => ipcRenderer.invoke('fetch-youversion-passage', appKey, versionId, reference, format),

  // Windows
  openPresentation: (displayIndex) => ipcRenderer.invoke('open-presentation', displayIndex),
  closePresentation: () => ipcRenderer.invoke('close-presentation'),
  openStage: () => ipcRenderer.invoke('open-stage'),
  closeStage: () => ipcRenderer.invoke('close-stage'),
  openOutputWindow: (options) => ipcRenderer.invoke('open-output-window', options),
  closeOutputWindow: (id) => ipcRenderer.invoke('close-output-window', id),
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

  // Listeners
  onReceiveSlide: (cb) => ipcRenderer.on('receive-slide', (_, data) => cb(data)),
  onReceiveBlackout: (cb) => ipcRenderer.on('receive-blackout', (_, v) => cb(v)),
  onReceiveClear: (cb) => ipcRenderer.on('receive-clear', (_, v) => cb(v)),
  onReceiveOutput: (cb) => ipcRenderer.on('receive-output', (_, data) => cb(data)),
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

  // Sermon Assistant — AI verse suggestions
  suggestVerses: (opts) => ipcRenderer.invoke('suggest-verses', opts),

  isElectron: true,
});

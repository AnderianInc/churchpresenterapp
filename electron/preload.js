const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper: register a one-shot or persistent IPC listener and return a
 * cleanup function that removes ONLY this specific listener, not all
 * listeners on the channel.  This avoids the removeAllListeners() footgun
 * where one component's cleanup silences another component's handler.
 */
function on(channel, transform) {
  return (cb) => {
    const handler = (_, ...args) => cb(transform ? transform(...args) : args[0]);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── File system ────────────────────────────────────────────────────────────
  readFile:      (key)        => ipcRenderer.invoke('read-file', key),
  writeFile:     (key, data)  => ipcRenderer.invoke('write-file', key, data),
  selectDirectory: ()         => ipcRenderer.invoke('select-directory'),
  readDirectory: (folderPath) => ipcRenderer.invoke('read-directory', folderPath),
  readFileText:  (filePath)   => ipcRenderer.invoke('read-file-text', filePath),

  // ── Windows ────────────────────────────────────────────────────────────────
  openPresentation:    (displayIndex) => ipcRenderer.invoke('open-presentation', displayIndex),
  closePresentation:   ()             => ipcRenderer.invoke('close-presentation'),
  openStage:           ()             => ipcRenderer.invoke('open-stage'),
  closeStage:          ()             => ipcRenderer.invoke('close-stage'),
  openOutputWindow:    (options)      => ipcRenderer.invoke('open-output-window', options),
  closeOutputWindow:   (id)           => ipcRenderer.invoke('close-output-window', id),
  minimizeOutputWindow:(id)           => ipcRenderer.invoke('minimize-output-window', id),
  toggleFullscreen:    ()             => ipcRenderer.invoke('toggle-fullscreen'),
  moveOutputWindow:    (payload)      => ipcRenderer.invoke('move-output-window', payload),
  updateOutputWindowRole: (payload)   => ipcRenderer.invoke('update-output-window-role', payload),
  getOutputWindows:    ()             => ipcRenderer.invoke('get-output-windows'),
  getDisplays:         ()             => ipcRenderer.invoke('get-displays'),

  // ── Slide control ──────────────────────────────────────────────────────────
  sendSlideProgram:  (slideData)  => ipcRenderer.send('send-slide-program', slideData),
  sendSlideStage:    (slideData)  => ipcRenderer.send('send-slide-stage', slideData),
  sendBlackout:      (isBlackout) => ipcRenderer.send('send-blackout', isBlackout),
  sendClear:         (isClear)    => ipcRenderer.send('send-clear', isClear),
  sendOutputState:   (payload)    => ipcRenderer.send('send-output-state', payload),
  sendYouTubeControl:(payload)    => ipcRenderer.send('send-youtube-control', payload),
  sendYouTubeState:  (payload)    => ipcRenderer.send('send-youtube-state', payload),
  sendVideoControl:  (payload)    => ipcRenderer.send('send-video-control', payload),
  sendVideoState:    (payload)    => ipcRenderer.send('send-video-state', payload),

  // ── Listeners — each returns an unsubscribe() function ────────────────────
  // Usage:  const off = window.electronAPI.onReceiveSlide(handler);
  //         // in cleanup:  off();
  onReceiveSlide:        on('receive-slide'),
  onReceiveBlackout:     on('receive-blackout'),
  onReceiveClear:        on('receive-clear'),
  onReceiveOutput:       on('receive-output'),
  onReceiveYouTubeControl: on('receive-youtube-control'),
  onReceiveYouTubeState: on('receive-youtube-state'),
  onReceiveVideoControl: on('receive-video-control'),
  onReceiveVideoState:   on('receive-video-state'),
  onPresentationClosed:  on('presentation-closed', () => undefined),
  onStageClosed:         on('stage-closed',         () => undefined),
  onOutputWindowClosed:  on('output-closed'),
  onRtmpStatus:          on('rtmp-status'),

  // ── Stream window ──────────────────────────────────────────────────────────
  openStream:            (displayIndex) => ipcRenderer.invoke('open-stream', displayIndex),
  closeStream:           ()             => ipcRenderer.invoke('close-stream'),
  sendLowerThird:        (data)         => ipcRenderer.send('send-lower-third', data),
  sendStreamConfig:      (config)       => ipcRenderer.send('send-stream-config', config),
  onReceiveLowerThird:   on('receive-lower-third'),
  onReceiveStreamConfig: on('receive-stream-config'),
  onStreamClosed:        on('stream-closed', () => undefined),

  // ── RTMP / Social streaming ────────────────────────────────────────────────
  checkFfmpeg:       ()           => ipcRenderer.invoke('check-ffmpeg'),
  getStreamSources:  ()           => ipcRenderer.invoke('get-stream-sources'),
  setRtmpSource:     (sourceId)   => ipcRenderer.invoke('set-rtmp-source', sourceId),
  startRtmp:         (opts)       => ipcRenderer.invoke('start-rtmp', opts),
  stopRtmp:          (destId)     => ipcRenderer.invoke('stop-rtmp', destId),
  sendRtmpChunk:     (destId, chunk) => ipcRenderer.send('rtmp-chunk', { destId, chunk }),

  // ── Planning Center ────────────────────────────────────────────────────────
  searchPcoSongs:      (opts) => ipcRenderer.invoke('search-pco-songs', opts),
  fetchPcoArrangements:(opts) => ipcRenderer.invoke('fetch-pco-arrangements', opts),

  // ── Genius lyrics ──────────────────────────────────────────────────────────
  searchGeniusSongs: (opts) => ipcRenderer.invoke('search-genius-songs', opts),
  fetchGeniusLyrics: (opts) => ipcRenderer.invoke('fetch-genius-lyrics', opts),

  // ── Sermon assistant ───────────────────────────────────────────────────────
  suggestVerses: (opts) => ipcRenderer.invoke('suggest-verses', opts),

  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),

  // ── Media file persistence ─────────────────────────────────────────────────
  copyMediaFile:     (srcPath) => ipcRenderer.invoke('copy-media-file', srcPath),

  // ── Local recording ────────────────────────────────────────────────────────
  saveRecording:        ({ buffer, filename, convertToMp4 }) =>
    ipcRenderer.invoke('save-recording', { buffer, filename, convertToMp4 }),
  openRecordingFolder:  (folderPath) => ipcRenderer.send('open-recording-folder', folderPath),
  getCapturableSources: ()           => ipcRenderer.invoke('get-capturable-sources'),
  setRecordingSource:   (sourceId)   => ipcRenderer.invoke('set-recording-source', sourceId),

  // ── Performance monitoring ─────────────────────────────────────────────────
  getPerfSnapshot: () => ipcRenderer.invoke('perf:get-snapshot'),
  getPerfLogPath:  () => ipcRenderer.invoke('perf:get-log-path'),
  getPerfLogDir:   () => ipcRenderer.invoke('perf:get-log-dir'),

  // ── Error / application logging ────────────────────────────────────────────
  logWrite:       (entry) => ipcRenderer.send('log:write', entry),
  getLogEntries:  ()      => ipcRenderer.invoke('log:get-entries'),
  getLogPath:     ()      => ipcRenderer.invoke('log:get-path'),
  openLogFolder:  ()      => ipcRenderer.invoke('log:open-folder'),
  clearLog:       ()      => ipcRenderer.invoke('log:clear'),

  isElectron: true,
  platform: process.platform,
});

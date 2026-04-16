import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { storage, migrateLegacyStorage, validateSongsArray, validateScheduleArray, validateSettings } from './persistence';
import defaultSongs from '../data/defaultSongs';
import { writeLiveState } from './liveStateSync';

// Single canonical channel name and payload wrapper used by sender AND all receivers
export const BROADCAST_CHANNEL = 'cp_presentation';
export const makeBroadcastMsg = (type, payload) => ({ type, payload });

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [settings, setSettings] = useState({ theme: 'dark', defaultFontSize: 44, defaultFont: 'Georgia' });
  const [activeScheduleIdx, setActiveScheduleIdx] = useState(0);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  /** Audience / main projector output */
  const [liveProgram, setLiveProgram] = useState(null);
  /** Stage monitor output (may mirror program or show a different slide) */
  const [liveStage, setLiveStage] = useState(null);
  /** When true, sending to program also pushes the same slide to stage */
  const [stageMirrorProgram, setStageMirrorProgram] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [lowerThird, setLowerThirdState] = useState({ active: false, text: '', label: '', source: '' });
  const [outputWindows, setOutputWindows] = useState([]);
  const [liveOutputs, setLiveOutputs] = useState({});
  const [liveRoleSlides, setLiveRoleSlides] = useState({});
  const [displays, setDisplays] = useState([]);
  const outputWindowRefs = useRef({});
  const [activeView, setActiveView] = useState('schedule');
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [ffmpegAvailable, setFfmpegAvailable] = useState(null); // null=unchecked, true/false

  const isElectron = !!window.electronAPI;
  const path = window.location.pathname + window.location.hash;
  const isOutputView = path.includes('/presentation') || path.includes('/stage') || path.includes('/output') || path.includes('/stream') || path.includes('#/presentation') || path.includes('#/stage') || path.includes('#/output') || path.includes('#/stream');

  // Load data
  useEffect(() => {
    const load = async () => {
      if (isElectron) {
        const [s, sch, st] = await Promise.all([
          window.electronAPI.readFile('songs'),
          window.electronAPI.readFile('schedules'),
          window.electronAPI.readFile('settings'),
        ]);
        // Electron main.js now validates & normalises; renderer applies a final
        // safety net so a mid-session race can't crash the UI.
        setSongs(validateSongsArray(s) ?? defaultSongs);
        setSchedule(validateScheduleArray(sch));
        setSettings(validateSettings(st));
      } else {
        migrateLegacyStorage();
        setSongs(storage.load('cp_songs', validateSongsArray, defaultSongs));
        setSchedule(storage.load('cp_schedule', validateScheduleArray, []));
        setSettings(storage.load('cp_settings', validateSettings, { theme: 'dark', defaultFontSize: 44, defaultFont: 'Georgia' }));
      }
      setLoaded(true);
    };
    load();
  }, [isElectron]);

  // Persist songs
  const saveSongs = useCallback(async (newSongs) => {
    setSongs(newSongs);
    setSaveStatus('saving');
    try {
      if (isElectron) {
        const ok = await window.electronAPI.writeFile('songs', newSongs);
        setSaveStatus(ok ? 'saved' : 'error');
      } else {
        storage.save('cp_songs', newSongs);
        setSaveStatus('saved');
      }
    } catch { setSaveStatus('error'); }
  }, [isElectron]);

  const saveSchedule = useCallback(async (newSchedule) => {
    setSchedule(newSchedule);
    setSaveStatus('saving');
    try {
      if (isElectron) {
        const ok = await window.electronAPI.writeFile('schedules', newSchedule);
        setSaveStatus(ok ? 'saved' : 'error');
      } else {
        storage.save('cp_schedule', newSchedule);
        setSaveStatus('saved');
      }
    } catch { setSaveStatus('error'); }
  }, [isElectron]);

  const saveSettings = useCallback(async (partial) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    setSaveStatus('saving');
    try {
      if (isElectron) {
        const ok = await window.electronAPI.writeFile('settings', next);
        setSaveStatus(ok ? 'saved' : 'error');
      } else {
        storage.save('cp_settings', next);
        setSaveStatus('saved');
      }
    } catch { setSaveStatus('error'); }
  }, [settings, isElectron]);

  // Electron listeners
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.onPresentationClosed(() => setPresentationOpen(false));
    window.electronAPI.onStageClosed(() => setStageOpen(false));
    window.electronAPI.onStreamClosed(() => setStreamOpen(false));
    window.electronAPI.onOutputWindowClosed((id) => {
      setOutputWindows(prev => prev.filter(w => w.id !== id));
    });
    window.electronAPI.getOutputWindows().then(setOutputWindows).catch(() => {});
    window.electronAPI.getDisplays().then(setDisplays).catch(() => {});
    // Check FFmpeg availability for social streaming
    window.electronAPI.checkFfmpeg().then(r => setFfmpegAvailable(r?.available ?? false)).catch(() => setFfmpegAvailable(false));
    return () => {
      window.electronAPI.removeAllListeners('presentation-closed');
      window.electronAPI.removeAllListeners('stage-closed');
      window.electronAPI.removeAllListeners('stream-closed');
      window.electronAPI.removeAllListeners('output-closed');
      window.electronAPI.removeAllListeners('rtmp-status');
    };
  }, [isElectron]);

  useEffect(() => {
    if (isElectron) return;
    return () => {
      Object.values(outputWindowRefs.current).forEach(win => win?.close?.());
      outputWindowRefs.current = {};
    };
  }, [isElectron]);

  // Song CRUD
  const addSong = useCallback((song) => {
    const newSong = { ...song, id: uuidv4() };
    saveSongs([...songs, newSong]);
    return newSong;
  }, [songs, saveSongs]);

  const updateSong = useCallback((id, updates) => {
    const updated = songs.map(s => s.id === id ? { ...s, ...updates } : s);
    saveSongs(updated);
  }, [songs, saveSongs]);

  const deleteSong = useCallback((id) => {
    saveSongs(songs.filter(s => s.id !== id));
  }, [songs, saveSongs]);

  // Schedule ops
  const addToSchedule = useCallback((item) => {
    const entry = { ...item, scheduleId: uuidv4() };
    const newSch = [...schedule, entry];
    saveSchedule(newSch);
    setActiveScheduleIdx(newSch.length - 1);
    setActiveSlideIdx(0);
  }, [schedule, saveSchedule]);

  const removeFromSchedule = useCallback((scheduleId) => {
    const idx = schedule.findIndex(s => s.scheduleId === scheduleId);
    if (idx === -1) return;
    const newSch = schedule.filter(s => s.scheduleId !== scheduleId);
    saveSchedule(newSch);
    if (idx < activeScheduleIdx) {
      setActiveScheduleIdx(Math.max(0, activeScheduleIdx - 1));
    } else if (idx === activeScheduleIdx) {
      setActiveScheduleIdx(Math.min(activeScheduleIdx, Math.max(0, newSch.length - 1)));
    }
    setActiveSlideIdx(0);
  }, [schedule, saveSchedule, activeScheduleIdx]);

  const reorderSchedule = useCallback((newOrder) => {
    saveSchedule(newOrder);
  }, [saveSchedule]);

  const clearSchedule = useCallback(() => {
    saveSchedule([]);
    setActiveScheduleIdx(0);
    setActiveSlideIdx(0);
  }, [saveSchedule]);

  // Stable BroadcastChannel ref for browser mode
  const broadcastRef = useRef(null);
  useEffect(() => {
    if (!isElectron && typeof BroadcastChannel !== 'undefined') {
      broadcastRef.current = new BroadcastChannel(BROADCAST_CHANNEL);
      broadcastRef.current.onmessage = (e) => {
        const { type } = e.data || {};
        if (type !== 'state-request' || isOutputView) return;
        const payload = {
          programSlide: liveProgram,
          stageSlide: liveStage,
          stageMirror: stageMirrorProgram,
          isBlackout,
          isClear,
          outputs: liveOutputs,
          roleSlides: liveRoleSlides,
        };
        broadcastRef.current?.postMessage(makeBroadcastMsg('state-sync', payload));
      };
    }
    return () => { broadcastRef.current?.close(); broadcastRef.current = null; };
  // liveOutputs/liveRoleSlides intentionally omitted — adding them would
  // tear down and recreate the BroadcastChannel on every live state change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElectron, isOutputView, liveProgram, liveStage, stageMirrorProgram, isBlackout, isClear]);

  const broadcast = useCallback((type, payload) => {
    broadcastRef.current?.postMessage(makeBroadcastMsg(type, payload));
  }, []);

  const persistBrowserLive = useCallback((overrides = {}) => {
    writeLiveState({
      programSlide: liveProgram,
      stageSlide: liveStage,
      stageMirror: stageMirrorProgram,
      isBlackout,
      isClear,
      outputs: { ...liveOutputs, ...(overrides.outputs || {}) },
      roleSlides: { ...liveRoleSlides, ...(overrides.roleSlides || {}) },
      ...overrides,
    });
  }, [liveProgram, liveStage, stageMirrorProgram, isBlackout, isClear, liveOutputs, liveRoleSlides]);

  const sendOutputState = useCallback((overrideProgram, overrideStage) => {
    if (!isElectron) return;
    const effectiveProgram = overrideProgram !== undefined ? overrideProgram : liveProgram;
    const effectiveStage = overrideStage !== undefined ? overrideStage : liveStage;
    const outputs = outputWindows.reduce((acc, output) => {
      const slide = liveOutputs[output.id]
        ?? liveRoleSlides[output.role]
        ?? (output.role === 'stage'
          ? (stageMirrorProgram ? effectiveProgram : effectiveStage)
          : effectiveProgram);
      acc[output.id] = { role: output.role, slide };
      return acc;
    }, {});
    window.electronAPI.sendOutputState({
      programSlide: effectiveProgram,
      stageSlide: effectiveStage,
      stageMirror: stageMirrorProgram,
      isBlackout,
      isClear,
      outputs,
      roleSlides: liveRoleSlides,
    });
  }, [isElectron, liveProgram, liveStage, stageMirrorProgram, isBlackout, isClear, outputWindows, liveOutputs, liveRoleSlides]);

  const goLiveProgram = useCallback((slide) => {
    setLiveProgram(slide);
    setIsLive(true);
    setIsBlackout(false);
    setIsClear(false);
    const newStage = stageMirrorProgram ? slide : liveStage;
    if (stageMirrorProgram) setLiveStage(slide);
    if (isElectron) {
      window.electronAPI.sendSlideProgram(slide);
      window.electronAPI.sendSlideStage(newStage);
      sendOutputState(slide, newStage);
    } else {
      persistBrowserLive({
        programSlide: slide,
        stageSlide: stageMirrorProgram ? slide : liveStage,
        isBlackout: false,
        isClear: false,
      });
      broadcast('slide-program', slide);
      broadcast('slide-stage', stageMirrorProgram ? slide : liveStage);
    }
  }, [isElectron, broadcast, stageMirrorProgram, liveStage, persistBrowserLive, sendOutputState]);

  /** Send a different slide to the stage output (ignored while stage mirrors program) */
  const goLiveStage = useCallback((slide) => {
    if (stageMirrorProgram) return;
    setLiveStage(slide);
    setIsLive(true);
    if (isElectron) {
      window.electronAPI.sendSlideStage(slide);
      sendOutputState(undefined, slide);
    } else {
      persistBrowserLive({ stageSlide: slide });
      broadcast('slide-stage', slide);
    }
  }, [isElectron, broadcast, stageMirrorProgram, persistBrowserLive, sendOutputState]);

  const goLiveOutput = useCallback((idOrRole, slide) => {
    const isOpenOutput = outputWindows.some((output) => output.id === idOrRole);
    if (isOpenOutput) {
      setLiveOutputs((prev) => ({ ...prev, [idOrRole]: slide }));
    } else {
      setLiveRoleSlides((prev) => ({ ...prev, [idOrRole]: slide }));
    }
    setIsLive(true);
    setIsBlackout(false);
    setIsClear(false);
    if (isElectron) {
      sendOutputState();
    } else {
      if (isOpenOutput) {
        persistBrowserLive({ outputs: { [idOrRole]: slide } });
        broadcast('output-target', { id: idOrRole, slide });
      } else {
        persistBrowserLive({ roleSlides: { [idOrRole]: slide } });
        broadcast('output-role-target', { role: idOrRole, slide });
      }
    }
  }, [isElectron, outputWindows, persistBrowserLive, sendOutputState, broadcast]);

  const goLiveAll = useCallback((slide) => {
    const outputs = outputWindows.reduce((acc, output) => ({
      ...acc,
      [output.id]: slide,
    }), {});

    setLiveProgram(slide);
    setLiveStage(slide);
    setLiveOutputs(outputs);
    setLiveRoleSlides((prev) => ({
      ...prev,
      announcement: slide,
      background: slide,
      confidence: slide,
    }));
    setIsLive(true);
    setIsBlackout(false);
    setIsClear(false);

    if (isElectron) {
      window.electronAPI.sendSlideProgram(slide);
      window.electronAPI.sendSlideStage(slide);
      sendOutputState(slide, slide);
    } else {
      persistBrowserLive({
        programSlide: slide,
        stageSlide: slide,
        outputs,
        roleSlides: { announcement: slide, background: slide, confidence: slide },
        isBlackout: false,
        isClear: false,
      });
      broadcast('slide-program', slide);
      broadcast('slide-stage', slide);
      Object.keys(outputs).forEach((id) => broadcast('output-target', { id, slide }));
      ['announcement', 'background', 'confidence'].forEach((role) => broadcast('output-role-target', { role, slide }));
    }
  }, [isElectron, outputWindows, persistBrowserLive, sendOutputState, broadcast]);

  const goLive = goLiveProgram;

  const updateStageMirror = useCallback((mirror) => {
    setStageMirrorProgram(mirror);
    if (mirror && liveProgram) {
      setLiveStage(liveProgram);
      if (isElectron) {
        window.electronAPI.sendSlideStage(liveProgram);
        sendOutputState();
      } else {
        persistBrowserLive({ stageMirror: true, stageSlide: liveProgram });
        broadcast('slide-stage', liveProgram);
      }
    } else if (!mirror) {
      setLiveStage((prev) => liveProgram ?? prev);
      const stagePayload = liveProgram ?? liveStage;
      if (isElectron && stagePayload) {
        window.electronAPI.sendSlideStage(stagePayload);
        sendOutputState();
      } else if (!isElectron) {
        persistBrowserLive({ stageMirror: false, stageSlide: liveProgram ?? liveStage });
        if (stagePayload) broadcast('slide-stage', stagePayload);
      }
    }
  }, [liveProgram, liveStage, isElectron, broadcast, persistBrowserLive, sendOutputState]);

  const toggleBlackout = useCallback(() => {
    const next = !isBlackout;
    setIsBlackout(next);
    if (isElectron) {
      window.electronAPI.sendBlackout(next);
      sendOutputState();
    } else {
      persistBrowserLive({ isBlackout: next });
      broadcast('blackout', next);
    }
  }, [isBlackout, isElectron, broadcast, persistBrowserLive, sendOutputState]);

  const toggleClear = useCallback(() => {
    const next = !isClear;
    setIsClear(next);
    if (isElectron) {
      window.electronAPI.sendClear(next);
      sendOutputState();
    } else {
      persistBrowserLive({ isClear: next });
      broadcast('clear', next);
    }
  }, [isClear, isElectron, broadcast, persistBrowserLive, sendOutputState]);

  const openPresentation = useCallback(async (displayIdx = 1) => {
    if (isElectron) {
      await window.electronAPI.openPresentation(displayIdx);
      setPresentationOpen(true);
    } else {
      const win = window.open('/presentation', 'presentation', 'width=1280,height=720');
      if (win) setPresentationOpen(true);
    }
  }, [isElectron]);

  const closePresentation = useCallback(async () => {
    if (isElectron) await window.electronAPI.closePresentation();
    setPresentationOpen(false);
  }, [isElectron]);

  const openStage = useCallback(async () => {
    if (isElectron) {
      await window.electronAPI.openStage();
      setStageOpen(true);
    } else {
      const win = window.open('/stage', 'stage', 'width=1024,height=768');
      if (win) setStageOpen(true);
    }
  }, [isElectron]);

  const closeStage = useCallback(async () => {
    if (isElectron) await window.electronAPI.closeStage();
    setStageOpen(false);
  }, [isElectron]);

  const openStream = useCallback(async (displayIdx = 0) => {
    if (isElectron) {
      await window.electronAPI.openStream(displayIdx);
      setStreamOpen(true);
    } else {
      const win = window.open('/stream', 'stream', 'width=1280,height=720');
      if (win) setStreamOpen(true);
    }
  }, [isElectron]);

  const closeStream = useCallback(async () => {
    if (isElectron) await window.electronAPI.closeStream();
    setStreamOpen(false);
  }, [isElectron]);

  const pushLowerThird = useCallback((data) => {
    setLowerThirdState(data);
    if (isElectron) {
      window.electronAPI.sendLowerThird(data);
    } else {
      broadcast('lower-third', data);
    }
  }, [isElectron, broadcast]);

  const sendStreamConfig = useCallback((config) => {
    if (isElectron) {
      window.electronAPI.sendStreamConfig(config);
    } else {
      broadcast('stream-config', config);
    }
  }, [isElectron, broadcast]);

  const updateDisplayLabel = useCallback((displayIdx, label) => {
    const newLabels = { ...(settings.displayLabels || {}) };
    if (label) newLabels[displayIdx] = label;
    else delete newLabels[displayIdx];
    saveSettings({ displayLabels: newLabels });
  }, [settings, saveSettings]);

  const saveRoutingPreset = useCallback((name) => {
    const preset = {
      id: uuidv4(),
      name,
      outputs: outputWindows.map(w => ({ role: w.role, displayIdx: w.displayIdx, title: w.title })),
    };
    const newPresets = [...(settings.routingPresets || []), preset];
    saveSettings({ routingPresets: newPresets });
  }, [settings, outputWindows, saveSettings]);

  const deleteRoutingPreset = useCallback((presetId) => {
    const newPresets = (settings.routingPresets || []).filter(p => p.id !== presetId);
    saveSettings({ routingPresets: newPresets });
  }, [settings, saveSettings]);

  const createOutputWindow = useCallback(async ({ role, displayIdx = 1, title }) => {
    const id = uuidv4();
    const windowData = { id, role, displayIdx, title: title || role };
    setOutputWindows(prev => [...prev, windowData]);

    if (isElectron) {
      await window.electronAPI.openOutputWindow({ id, role, displayIndex: displayIdx, title: windowData.title });
      sendOutputState();
    } else {
      const win = window.open(`/output?role=${encodeURIComponent(role)}&id=${encodeURIComponent(id)}`, id, 'width=1280,height=720');
      if (win) outputWindowRefs.current[id] = win;
    }

    return windowData;
  }, [isElectron, sendOutputState]);

  const moveOutputWindow = useCallback(async (id, displayIdx) => {
    setOutputWindows(prev => prev.map((w) => w.id === id ? { ...w, displayIdx } : w));
    if (!isElectron) return;
    const success = await window.electronAPI.moveOutputWindow({ id, displayIndex: displayIdx });
    if (!success) {
      const windows = await window.electronAPI.getOutputWindows().catch(() => []);
      setOutputWindows(windows);
    }
  }, [isElectron]);

  const updateOutputWindowRole = useCallback(async (id, role) => {
    setOutputWindows(prev => prev.map((w) => w.id === id ? { ...w, role, title: role } : w));
    if (!isElectron) return;
    await window.electronAPI.updateOutputWindowRole({ id, role, title: role });
  }, [isElectron]);

  const closeOutputWindow = useCallback(async (id) => {
    setOutputWindows(prev => prev.filter(w => w.id !== id));
    setLiveOutputs(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (isElectron) {
      await window.electronAPI.closeOutputWindow(id);
    } else {
      const win = outputWindowRefs.current[id];
      if (win) {
        win.close();
        delete outputWindowRefs.current[id];
      }
    }
  }, [isElectron]);

  // loadRoutingPreset uses refs to avoid stale closure on outputWindows / callbacks
  const outputWindowsRef = useRef(outputWindows);
  useEffect(() => { outputWindowsRef.current = outputWindows; }, [outputWindows]);
  const closeOutputWindowRef = useRef(closeOutputWindow);
  useEffect(() => { closeOutputWindowRef.current = closeOutputWindow; }, [closeOutputWindow]);
  const createOutputWindowRef = useRef(createOutputWindow);
  useEffect(() => { createOutputWindowRef.current = createOutputWindow; }, [createOutputWindow]);

  const loadRoutingPreset = useCallback(async (preset) => {
    const current = outputWindowsRef.current;
    await Promise.all(current.map(w => closeOutputWindowRef.current(w.id)));
    for (const w of preset.outputs) {
      await createOutputWindowRef.current({ role: w.role, displayIdx: w.displayIdx, title: w.title });
    }
  }, []);

  const currentItem = schedule[activeScheduleIdx] || null;
  const currentSlides = currentItem?.slides || [];
  const currentSlide = currentSlides[activeSlideIdx] || null;

  const nextSlide = useCallback(() => {
    if (activeSlideIdx < currentSlides.length - 1) {
      setActiveSlideIdx(activeSlideIdx + 1);
    } else if (activeScheduleIdx < schedule.length - 1) {
      setActiveScheduleIdx(activeScheduleIdx + 1);
      setActiveSlideIdx(0);
    }
  }, [activeSlideIdx, currentSlides.length, activeScheduleIdx, schedule.length]);

  const prevSlide = useCallback(() => {
    if (activeSlideIdx > 0) {
      setActiveSlideIdx(activeSlideIdx - 1);
    } else if (activeScheduleIdx > 0) {
      const prevItem = schedule[activeScheduleIdx - 1];
      setActiveScheduleIdx(activeScheduleIdx - 1);
      setActiveSlideIdx((prevItem?.slides?.length || 1) - 1);
    }
  }, [activeSlideIdx, activeScheduleIdx, schedule]);

  useEffect(() => {
    if (!isElectron) return;
    sendOutputState();
  }, [isElectron, sendOutputState]);

  return (
    <AppContext.Provider value={{
      songs, schedule, settings, loaded, saveStatus,
      activeScheduleIdx, setActiveScheduleIdx,
      activeSlideIdx, setActiveSlideIdx,
      liveSlide: liveProgram,
      liveProgram,
      liveStage,
      liveOutputs,
      liveRoleSlides,
      stageMirrorProgram,
      setStageMirrorProgram: updateStageMirror,
      isLive, isBlackout, isClear,
      presentationOpen, stageOpen,
      streamOpen, lowerThird,
      displays, outputWindows, createOutputWindow, moveOutputWindow, updateOutputWindowRole, closeOutputWindow,
      saveSettings, updateDisplayLabel, saveRoutingPreset, loadRoutingPreset, deleteRoutingPreset,
      ffmpegAvailable,
      activeView, setActiveView,
      currentItem, currentSlides, currentSlide,
      isElectron,
      addSong, updateSong, deleteSong,
      addToSchedule, removeFromSchedule, reorderSchedule, clearSchedule,
      goLive, goLiveProgram, goLiveStage, goLiveOutput, goLiveAll, toggleBlackout, toggleClear,
      openPresentation, closePresentation, openStage, closeStage,
      openStream, closeStream, pushLowerThird, sendStreamConfig,
      nextSlide, prevSlide,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

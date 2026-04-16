import React, { useState, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import Toolbar from './Toolbar';
import SchedulePanel from './SchedulePanel';
import SlideEditor from './SlideEditor';
import PreviewArea from './PreviewArea';
import LibraryPanel from './LibraryPanel';
import BiblePanel from './BiblePanel';
import MediaPanel from './MediaPanel';
import AnnouncementPanel from './AnnouncementPanel';
import StreamPanel from './StreamPanel';
import OutputManager from './OutputManager';
import SettingsPanel from './SettingsPanel';
import HelpPanel from './HelpPanel';
import SermonAssistPanel from './SermonAssistPanel';
import SongEditorModal from './SongEditorModal';

const styles = {
  app: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: 'var(--bg)', overflow: 'hidden',
  },
  main: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  center: {
    display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
  },
};

export default function MainLayout() {
  const { activeView, loaded, nextSlide, prevSlide, goLive, currentSlide, currentItem, toggleBlackout, toggleClear } = useApp();
  const [songEditorOpen, setSongEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);

  const openNewSong = () => { setEditingSong(null); setSongEditorOpen(true); };
  const openEditSong = (song) => { setEditingSong(song); setSongEditorOpen(true); };

  const handleGoLive = useCallback(() => {
    if (currentSlide && currentItem) goLive({ ...currentSlide, item: currentItem });
  }, [currentSlide, currentItem, goLive]);

  useKeyboardShortcuts({
    onNext: nextSlide,
    onPrev: prevSlide,
    onGoLive: handleGoLive,
    onBlackout: toggleBlackout,
    onClear: toggleClear,
  });

  if (!loaded) {
    return (
      <div style={{ ...styles.app, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <Toolbar onNewSong={openNewSong} />
      <div style={styles.main}>
        <SchedulePanel />
        <div style={styles.center}>
          <SlideEditor />
          <PreviewArea />
        </div>
        {activeView === 'library' && <LibraryPanel onEditSong={openEditSong} onNewSong={openNewSong} />}
        {activeView === 'bible' && <BiblePanel />}
        {activeView === 'media' && <MediaPanel />}
        {activeView === 'announcements' && <AnnouncementPanel />}
        {activeView === 'stream' && <StreamPanel />}
        {activeView === 'outputs' && <OutputManager />}
        {activeView === 'settings' && <SettingsPanel />}
        {activeView === 'help' && <HelpPanel />}
        {activeView === 'sermon' && <SermonAssistPanel />}
        {activeView === 'schedule' && (
          <div style={{
            width: 260, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 12, padding: 16,
          }}>
            Use the schedule panel on the left to manage service order and preview selections.
          </div>
        )}
      </div>
      {songEditorOpen && (
        <SongEditorModal
          song={editingSong}
          onClose={() => setSongEditorOpen(false)}
        />
      )}
    </div>
  );
}

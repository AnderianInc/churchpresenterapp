import React from 'react';
import { AppProvider } from './store/AppContext';
import MainLayout from './components/MainLayout';
import PresentationView from './components/PresentationView';
import StageView from './components/StageView';
import OutputView from './components/OutputView';
import StreamView from './components/StreamView';
import PerfOverlay from './components/PerfOverlay';
import './styles/global.css';

function AppRouter() {
  const path = window.location.pathname + window.location.hash;
  if (path.includes('/presentation') || path.includes('#/presentation')) {
    return <PresentationView />;
  }
  if (path.includes('/stage') || path.includes('#/stage')) {
    return <StageView />;
  }
  if (path.includes('/output') || path.includes('#/output')) {
    return <OutputView />;
  }
  if (path.includes('/stream') || path.includes('#/stream')) {
    return <StreamView />;
  }
  return <MainLayout />;
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
      <PerfOverlay />
    </AppProvider>
  );
}

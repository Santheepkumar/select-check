import React, { useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauriEnvironment } from './services/tauriBridge.js';
import { InteractiveWorkspace } from './views/InteractiveWorkspace.js';
import { OverlayView } from './views/OverlayView.js';
import { SettingsView } from './views/SettingsView.js';

export const App: React.FC = () => {
  const [windowType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('window');
    if (fromParam) return fromParam;

    const hash = window.location.hash.replace('#', '');
    if (hash === 'overlay' || hash === 'settings') return hash;

    if (isTauriEnvironment()) {
      try {
        return getCurrentWebviewWindow().label;
      } catch {
        return 'workspace';
      }
    }
    return 'workspace';
  });

  if (windowType === 'overlay') {
    return (
      <div className="flex h-screen w-screen items-start justify-start bg-transparent p-0 m-0 overflow-visible">
        <OverlayView />
      </div>
    );
  }

  if (windowType === 'settings') {
    return (
      <div className="min-h-screen bg-slate-950 p-4">
        <SettingsView />
      </div>
    );
  }

  return <InteractiveWorkspace />;
};

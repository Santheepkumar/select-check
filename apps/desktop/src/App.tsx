import React from 'react';
import { InteractiveWorkspace } from './views/InteractiveWorkspace.js';
import { OverlayView } from './views/OverlayView.js';
import { SettingsView } from './views/SettingsView.js';

export const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const windowType = params.get('window');

  if (windowType === 'overlay') {
    return (
      <div className="flex min-h-screen items-start justify-start bg-transparent p-1">
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

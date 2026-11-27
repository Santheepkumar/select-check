import React, { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauriEnvironment } from './services/tauriBridge.js';
import { InteractiveWorkspace } from './views/InteractiveWorkspace.js';
import { OnboardingView } from './views/OnboardingView.js';
import { OverlayView } from './views/OverlayView.js';
import { SettingsView } from './views/SettingsView.js';

export const App: React.FC = () => {
  const [windowType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('window');
    if (fromParam) return fromParam;

    const hash = window.location.hash.replace('#', '');
    if (hash === 'overlay' || hash === 'settings' || hash === 'onboarding') return hash;

    if (isTauriEnvironment()) {
      try {
        return getCurrentWebviewWindow().label;
      } catch {
        return 'workspace';
      }
    }
    return 'workspace';
  });

  useEffect(() => {
    const className = `window-${windowType}`;
    document.body.classList.remove(
      'window-overlay',
      'window-settings',
      'window-onboarding',
      'window-workspace'
    );
    document.body.classList.add(className);
    return () => {
      document.body.classList.remove(className);
    };
  }, [windowType]);

  if (windowType === 'overlay') {
    return (
      <div className="flex h-screen w-screen items-start justify-start bg-transparent p-0 m-0 overflow-visible">
        <OverlayView />
      </div>
    );
  }

  if (windowType === 'settings') {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-slate-950 p-4 md:p-6 custom-scrollbar">
        <SettingsView />
      </div>
    );
  }

  if (windowType === 'onboarding') {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-slate-950 custom-scrollbar">
        <OnboardingView />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-y-auto bg-slate-950 custom-scrollbar">
      <InteractiveWorkspace />
    </div>
  );
};

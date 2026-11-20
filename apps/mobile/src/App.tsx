import React, { useState, useEffect } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type QuotaInfo
} from '@select-check/shared';
import { Header } from './components/Header.js';
import { BottomNav, type MobileTab } from './components/BottomNav.js';
import { MainChatView } from './views/MainChatView.js';
import { HistoryView } from './views/HistoryView.js';
import { PermissionsGuideView } from './views/PermissionsGuideView.js';
import { MobileSettingsView } from './views/MobileSettingsView.js';
import { getStoredPermissions, type PermissionStatus } from './services/mobileBridge.js';

const SETTINGS_KEY = 'selectcheck_mobile_settings_v1';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<MobileTab>('refine');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // fallback
    }
    return DEFAULT_APP_SETTINGS;
  });

  const [permissions, setPermissions] = useState<PermissionStatus>(getStoredPermissions());

  const [quota, setQuota] = useState<QuotaInfo>({
    used: 2,
    limit: 10,
    tier: 'free_device',
    resetsAt: new Date(Date.now() + 86400000).toISOString()
  });

  const refreshPerms = () => {
    setPermissions(getStoredPermissions());
  };

  useEffect(() => {
    refreshPerms();

    // Attach global listener for app resume from Android native settings
    window.__SELECTCHECK_REFRESH_PERMS__ = refreshPerms;

    // Switch to refine tab if incoming text arrives
    const handleIncoming = () => {
      setCurrentTab('refine');
    };
    window.addEventListener('selectcheck:incoming-text', handleIncoming);

    return () => {
      window.removeEventListener('selectcheck:incoming-text', handleIncoming);
      window.__SELECTCHECK_REFRESH_PERMS__ = undefined;
    };
  }, []);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save settings to localStorage', err);
    }
  };

  const handleQuotaUpdated = () => {
    setQuota((prev) => ({
      ...prev,
      used: Math.min(prev.used + 1, prev.limit)
    }));
  };

  const isBackgroundActive = permissions.accessibilityGranted;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090e11] text-[#e9edef] overflow-hidden select-none font-sans">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        quota={quota}
        isBackgroundActive={isBackgroundActive}
        onOpenPermissions={() => setCurrentTab('permissions')}
      />

      {/* Main Screen Body */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentTab === 'refine' && (
          <MainChatView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onQuotaUpdated={handleQuotaUpdated}
            isBackgroundActive={isBackgroundActive}
            onOpenPermissions={() => setCurrentTab('permissions')}
          />
        )}

        {currentTab === 'history' && <HistoryView />}

        {currentTab === 'permissions' && (
          <PermissionsGuideView onPermissionsChanged={setPermissions} />
        )}

        {currentTab === 'settings' && (
          <MobileSettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onQuotaUpdated={handleQuotaUpdated}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />
    </div>
  );
};

export default App;

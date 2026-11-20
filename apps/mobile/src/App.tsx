import React, { useState, useEffect } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type QuotaInfo
} from '@select-check/shared';
import { WhatsAppHeader, type MobileTab } from './components/WhatsAppHeader.js';
import { MainChatView } from './views/MainChatView.js';
import { HistoryView } from './views/HistoryView.js';
import { PermissionsGuideView } from './views/PermissionsGuideView.js';
import { MobileSettingsView } from './views/MobileSettingsView.js';
import { getStoredPermissions, type PermissionStatus } from './services/mobileBridge.js';

const SETTINGS_KEY = 'selectcheck_mobile_settings_v1';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<MobileTab>('chat');
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

  useEffect(() => {
    setPermissions(getStoredPermissions());
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

  const isBackgroundActive =
    permissions.overlayGranted && permissions.accessibilityGranted;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b141a] text-[#e9edef] overflow-hidden select-none font-sans">
      {/* WhatsApp Emerald Brand Header */}
      <WhatsAppHeader
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        quota={quota}
        activePreset={settings.slot3Preset}
        isBackgroundActive={isBackgroundActive}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentTab === 'chat' && (
          <MainChatView
            settings={settings}
            onQuotaUpdated={handleQuotaUpdated}
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
    </div>
  );
};

export default App;

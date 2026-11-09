import type { AppSettings, QuotaInfo } from '@select-check/shared';
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  Plus,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  fetchQuotaStatus,
  requestEmailOtp,
  verifyEmailOtp
} from '../services/api.js';
import { getAppSettings, saveAppSettings } from '../services/tauriBridge.js';

interface SettingsViewProps {
  onClose?: () => void;
  onSettingsUpdated?: (settings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onClose,
  onSettingsUpdated
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'triggers' | 'permissions'>('account');

  // Auth OTP state
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Blocklist input
  const [newBlockedApp, setNewBlockedApp] = useState('');

  useEffect(() => {
    getAppSettings().then((s) => {
      setSettings(s);
      fetchQuotaStatus(s)
        .then(setQuota)
        .catch(() => null);
    });
  }, []);

  const updateSettings = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = await saveAppSettings({ ...settings, ...patch });
    setSettings(updated);
    onSettingsUpdated?.(updated);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setAuthError(null);
    setAuthMessage(null);
    try {
      const res = await requestEmailOtp(emailInput, settings);
      setOtpSent(true);
      setAuthMessage(res.message);
      if (res.demoCode) {
        setOtpInput(res.demoCode);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to send code');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setAuthError(null);
    try {
      const session = await verifyEmailOtp(emailInput, otpInput, settings);
      const updated = await saveAppSettings({
        ...settings,
        authToken: session.accessToken,
        userEmail: session.user.email
      });
      setSettings(updated);
      setQuota(session.quota);
      setOtpSent(false);
      setAuthMessage('Signed in! Unlocked 100 daily checks.');
      onSettingsUpdated?.(updated);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleSignOut = async () => {
    if (!settings) return;
    const updated = await saveAppSettings({
      ...settings,
      authToken: undefined,
      userEmail: undefined
    });
    setSettings(updated);
    fetchQuotaStatus(updated)
      .then(setQuota)
      .catch(() => null);
    onSettingsUpdated?.(updated);
  };

  const handleAddBlockedApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !newBlockedApp.trim()) return;
    const trimmed = newBlockedApp.trim();
    if (!settings.blockedApps.includes(trimmed)) {
      await updateSettings({
        blockedApps: [...settings.blockedApps, trimmed]
      });
    }
    setNewBlockedApp('');
  };

  const handleRemoveBlockedApp = async (appToRemove: string) => {
    if (!settings) return;
    await updateSettings({
      blockedApps: settings.blockedApps.filter((a) => a !== appToRemove)
    });
  };

  if (!settings) return null;

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">SelectCheck Settings</h1>
            <p className="text-xs text-slate-400">
              Cross-Platform Floating Grammar & Rewrite Assistant
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Done
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 rounded-xl bg-slate-950/70 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
            activeTab === 'account'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Account & Quota
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('triggers')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
            activeTab === 'triggers'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Triggers & Blocklist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
            activeTab === 'permissions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          OS Permissions
        </button>
      </div>

      {/* Tab 1: Account & Quota */}
      {activeTab === 'account' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Daily Usage Quota
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  settings.authToken
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {settings.authToken ? 'Signed-In Tier (100/day)' : 'Free Device Trial (10/day)'}
              </span>
            </div>

            {quota ? (
              <>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {quota.used}{' '}
                    <span className="text-sm font-normal text-slate-400">
                      / {quota.limit} checks used today
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
                    style={{
                      width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Device ID: <code className="text-slate-300">{settings.deviceId}</code>
              </p>
            )}
          </div>

          {settings.authToken ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div>
                <p className="text-xs font-medium text-emerald-300">Signed in as</p>
                <p className="text-sm font-semibold text-white">{settings.userEmail}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Sign in to unlock 100 checks/day
                </h3>
              </div>
              <p className="mb-3 text-xs text-slate-400">
                No OpenAI API key required. Sign in with passwordless Email OTP via our Cloudflare Edge proxy.
              </p>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Send Code
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="6-digit OTP code"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Verify & Upgrade
                    </button>
                  </div>
                </form>
              )}

              {authMessage && (
                <p className="mt-2.5 text-xs text-emerald-400">{authMessage}</p>
              )}
              {authError && <p className="mt-2.5 text-xs text-rose-400">{authError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Triggers & App Blocklist */}
      {activeTab === 'triggers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div>
              <p className="text-xs font-semibold text-white">
                Show floating ball automatically on text selection
              </p>
              <p className="text-[11px] text-slate-400">
                Appears near your cursor when you highlight text across any unblocked app
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoShowOnSelect}
              onChange={(e) => updateSettings({ autoShowOnSelect: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div>
              <p className="text-xs font-semibold text-white">Auto-hide floating ball after</p>
              <p className="text-[11px] text-slate-400">
                Dismisses the ball automatically if you keep typing or ignore it
              </p>
            </div>
            <select
              value={settings.autoHideSeconds}
              onChange={(e) =>
                updateSettings({ autoHideSeconds: Number(e.target.value) })
              }
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
            >
              <option value={3}>3 seconds</option>
              <option value={4}>4 seconds</option>
              <option value={6}>6 seconds</option>
              <option value={8}>8 seconds</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="mb-1 text-xs font-semibold text-white">
              Blocked Applications (Ignore List)
            </h3>
            <p className="mb-3 text-[11px] text-slate-400">
              The floating ball will stay hidden when selecting text inside these apps (e.g. terminals or IDEs):
            </p>

            <form onSubmit={handleAddBlockedApp} className="mb-3 flex gap-2">
              <input
                type="text"
                value={newBlockedApp}
                onChange={(e) => setNewBlockedApp(e.target.value)}
                placeholder="Add app name (e.g. VS Code, Terminal, Cursor)"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5">
              {settings.blockedApps.map((app) => (
                <span
                  key={app}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                >
                  {app}
                  <button
                    type="button"
                    onClick={() => handleRemoveBlockedApp(app)}
                    className="text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: OS Permissions */}
      {activeTab === 'permissions' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-emerald-300 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-semibold">
                Cross-Platform Selection & Focus-Safe Paste Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              SelectCheck preserves your existing clipboard contents whenever it reads or replaces selected text across Windows, macOS, and Linux.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs space-y-2 text-slate-300">
            <p className="font-semibold text-white">Platform Notes:</p>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">macOS:</strong> Grant Accessibility permission in{' '}
                <code>System Settings → Privacy & Security → Accessibility</code> so SelectCheck can read selections and paste replacements in-place.
              </li>
              <li>
                <strong className="text-slate-200">Windows:</strong> Uses native Win32 mouse hooks and UIAutomation/Clipboard synthesis out of the box.
              </li>
              <li>
                <strong className="text-slate-200">Linux:</strong> Uses X11 PRIMARY selection & XTest key synthesis, or global hotkey <code>Ctrl+Shift+G</code> on Wayland.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

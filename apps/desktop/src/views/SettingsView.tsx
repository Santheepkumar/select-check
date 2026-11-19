import {
  SLOT3_PRESET_MAP,
  type AppSettings,
  type ProviderType,
  type QuotaInfo,
  type Slot3Preset
} from '@select-check/shared';
import {
  Activity,
  CheckCircle2,
  Cpu,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  fetchQuotaStatus,
  requestEmailOtp,
  testProviderConnection,
  verifyEmailOtp,
  type ProviderConnectionResult
} from '../services/api.js';
import { getAppSettings, isTauriEnvironment, saveAppSettings } from '../services/tauriBridge.js';

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
  const [activeTab, setActiveTab] = useState<
    'provider' | 'slot3' | 'triggers' | 'benchmark' | 'permissions'
  >('provider');

  // Auth OTP state
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Connection testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionResult | null>(null);

  // Blocklist input
  const [newBlockedApp, setNewBlockedApp] = useState('');

  // Permissions state
  const [permissions, setPermissions] = useState<{
    accessibility: boolean;
    inputMonitoring: boolean;
  } | null>(null);

  useEffect(() => {
    if (isTauriEnvironment()) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<{ accessibility: boolean; input_monitoring: boolean }>(
          'check_system_permissions'
        )
          .then((res) => {
            setPermissions({
              accessibility: res.accessibility,
              inputMonitoring: res.input_monitoring
            });
          })
          .catch(() => {});
      });
    }
  }, [activeTab]);

  const handleOpenPermission = async (type: 'accessibility' | 'input_monitoring') => {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_permission_settings', { permissionType: type });
    }
  };

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

  const handleTestConnection = async () => {
    if (!settings) return;
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await testProviderConnection(settings);
      setConnectionResult(res);
    } finally {
      setTestingConnection(false);
    }
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
              Cross-Platform Lightweight Grammar & Rewrite Assistant
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
      <div className="mb-5 grid grid-cols-5 gap-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('provider')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'provider'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Cpu className="h-3.5 w-3.5 shrink-0" />
          <span>AI Engine</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('slot3')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'slot3'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>Persona</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('triggers')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'triggers'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Sliders className="h-3.5 w-3.5 shrink-0" />
          <span>Triggers</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('benchmark')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'benchmark'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span>Benchmark</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'permissions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span>System</span>
        </button>
      </div>

      {/* Tab 1: AI Provider & Privacy */}
      {activeTab === 'provider' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select AI Engine
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                {
                  id: 'hosted',
                  name: 'Cloudflare Hosted Edge',
                  desc: 'Free trial (10-100/day), zero API key needed'
                },
                {
                  id: 'byok_groq',
                  name: '⚡ Groq (Ultra-Fast)',
                  desc: 'Sub-200ms Llama 3.3 70B, bring your key'
                },
                {
                  id: 'byok_openai',
                  name: 'OpenAI (BYOK)',
                  desc: 'gpt-4o-mini / gpt-4o with your private key'
                },
                {
                  id: 'local_ollama',
                  name: '🔒 Local Ollama (100% Offline)',
                  desc: 'Zero data leaves machine, unlimited & free'
                }
              ].map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer flex-col rounded-xl border p-3 transition ${
                    settings.providerType === p.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs">{p.name}</span>
                    <input
                      type="radio"
                      name="providerType"
                      checked={settings.providerType === p.id}
                      onChange={() => updateSettings({ providerType: p.id as ProviderType })}
                      className="accent-indigo-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">{p.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* BYOK / Custom Key Inputs */}
          {settings.providerType !== 'hosted' ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-xs font-semibold text-white">
                    {settings.providerType === 'local_ollama'
                      ? 'Local Ollama Endpoint Configuration'
                      : 'Bring Your Own Key (Client-Direct & Private)'}
                  </h4>
                </div>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Unlimited Checks
                </span>
              </div>

              {settings.providerType !== 'local_ollama' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.customApiKey || ''}
                    onChange={(e) => updateSettings({ customApiKey: e.target.value })}
                    placeholder={
                      settings.providerType === 'byok_groq' ? 'gsk_...' : 'sk-...'
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Base URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.customBaseUrl || ''}
                    onChange={(e) => updateSettings({ customBaseUrl: e.target.value })}
                    placeholder={
                      settings.providerType === 'local_ollama'
                        ? 'http://localhost:11434/v1'
                        : 'https://...'
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={settings.customModel || ''}
                    onChange={(e) => updateSettings({ customModel: e.target.value })}
                    placeholder={
                      settings.providerType === 'byok_groq'
                        ? 'llama-3.3-70b-versatile'
                        : settings.providerType === 'local_ollama'
                          ? 'llama3.2'
                          : 'gpt-4o-mini'
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Test Button & Latency */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${testingConnection ? 'animate-spin' : ''}`}
                  />
                  Test Connection
                </button>

                {connectionResult && (
                  <span
                    className={`text-xs font-medium ${
                      connectionResult.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {connectionResult.message}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Hosted Cloudflare Quota & Account */
            <div className="space-y-4">
              {/* Backend API Endpoint Configuration */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Backend Cloudflare Edge URL
                  </span>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${testingConnection ? 'animate-spin' : ''}`} />
                    Test Endpoint
                  </button>
                </div>
                <input
                  type="url"
                  value={settings.apiUrl}
                  onChange={(e) => updateSettings({ apiUrl: e.target.value.trim() })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                {connectionResult && (
                  <div
                    className={`mt-2 flex items-center gap-1.5 text-xs ${
                      connectionResult.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{connectionResult.message}</span>
                  </div>
                )}
              </div>

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
                    {settings.authToken ? 'Signed-In (100/day)' : 'Free Device (10/day)'}
                  </span>
                </div>

                {quota && (
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
                  <div className="mb-2 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Sign in to unlock 100 free checks/day
                    </h3>
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    Sign in with passwordless Email OTP via our Cloudflare Edge proxy.
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
        </div>
      )}

      {/* Tab 2: Slot 3 Persona Customizer */}
      {activeTab === 'slot3' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-200">
            <p className="font-semibold text-indigo-100 mb-1">
              Muscle Memory Optimization:
            </p>
            <p className="leading-relaxed text-slate-300">
              Key <code className="text-indigo-300 font-bold">1</code> always fixes{' '}
              <strong>Grammar & Spelling</strong>. Key{' '}
              <code className="text-indigo-300 font-bold">2</code> always produces a{' '}
              <strong>Clear & Concise</strong> rewrite. Customize Key{' '}
              <code className="text-indigo-300 font-bold">3</code> to your favorite persona below:
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Choose Slot 3 Preset (Key 3)
            </h3>
            {(
              Object.keys(SLOT3_PRESET_MAP) as Slot3Preset[]
            ).map((presetKey) => {
              const meta = SLOT3_PRESET_MAP[presetKey];
              const isSelected = settings.slot3Preset === presetKey;
              return (
                <label
                  key={presetKey}
                  className={`flex cursor-pointer items-start justify-between rounded-xl border p-3 transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="pr-3">
                    <span className="font-semibold text-xs text-white block">
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                      {meta.description}
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="slot3Preset"
                    checked={isSelected}
                    onChange={() => updateSettings({ slot3Preset: presetKey })}
                    className="accent-indigo-500 mt-1"
                  />
                </label>
              );
            })}
          </div>

          {settings.slot3Preset === 'custom' && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <label className="block text-xs font-semibold text-white mb-1.5">
                Custom Transformation Prompt
              </label>
              <textarea
                rows={3}
                value={settings.slot3CustomPrompt || ''}
                onChange={(e) => updateSettings({ slot3CustomPrompt: e.target.value })}
                placeholder="e.g. Rewrite for an academic journal submission with formal vocabulary"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Smart Triggers & Noise Reduction */}
      {activeTab === 'triggers' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">
                  Smart Noise Filter (Anti-Clippy)
                </p>
                <p className="text-[11px] text-slate-400">
                  Automatically suppress popup on code syntax, dates, currency, and pure numbers
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.skipCodeAndNumbers}
                onChange={(e) => updateSettings({ skipCodeAndNumbers: e.target.checked })}
                className="h-4 w-4 accent-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div>
                <p className="text-xs font-semibold text-white">Trigger Mode</p>
                <p className="text-[11px] text-slate-400">
                  Choose how SelectCheck should activate
                </p>
              </div>
              <select
                value={settings.triggerMode}
                onChange={(e) =>
                  updateSettings({
                    triggerMode: e.target.value as 'auto_mouse' | 'hotkey_only'
                  })
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              >
                <option value="auto_mouse">Auto on Mouse Select</option>
                <option value="hotkey_only">Hotkey Only (Ctrl+Shift+G)</option>
              </select>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div>
                <p className="text-xs font-semibold text-white">Auto-hide floating ball after</p>
                <p className="text-[11px] text-slate-400">
                  Dismisses the ball if you continue typing or ignore it
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
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="mb-1 text-xs font-semibold text-white">
              Blocked Applications (Ignore List)
            </h3>
            <p className="mb-3 text-[11px] text-slate-400">
              The floating ball stays hidden inside these apps:
            </p>

            <form onSubmit={handleAddBlockedApp} className="mb-3 flex gap-2">
              <input
                type="text"
                value={newBlockedApp}
                onChange={(e) => setNewBlockedApp(e.target.value)}
                placeholder="Add app name (e.g. VS Code, Cursor, Xcode)"
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

      {/* Tab 4: Architecture Benchmark */}
      {activeTab === 'benchmark' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-500/30 bg-slate-950/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                SelectCheck vs. Grammarly Architecture
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                  SelectCheck (Rust + Tauri v2)
                </span>
                <p className="text-xl font-bold text-white mb-1">~18 MB RAM</p>
                <p className="text-[11px] text-slate-300">
                  0% idle CPU, no Chromium background instance, native OS thread.
                </p>
              </div>

              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                <span className="text-[11px] font-semibold text-rose-400 block mb-1">
                  Grammarly Desktop (Electron)
                </span>
                <p className="text-xl font-bold text-white mb-1">~650 MB RAM</p>
                <p className="text-[11px] text-slate-300">
                  Full Chromium runtime, continuous background key sniffing, battery drain.
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-3 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Zero telemetry: keystrokes are never recorded or logged.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Non-destructive clipboard swap preserves your copied text.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Sub-200ms latency when paired with Groq or local Ollama.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: OS Permissions */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Accessibility Card */}
            <div
              className={`rounded-xl border p-4 transition-colors ${
                permissions?.accessibility
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">Accessibility</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    permissions?.accessibility
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {permissions?.accessibility ? '✓ Granted' : '⚠️ Action Required'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Allows SelectCheck to safely simulate copy & paste to replace text in-place.
              </p>
              <button
                type="button"
                onClick={() => handleOpenPermission('accessibility')}
                className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-medium text-white transition"
              >
                Open Accessibility Settings
              </button>
            </div>

            {/* Input Monitoring Card */}
            <div
              className={`rounded-xl border p-4 transition-colors ${
                permissions?.inputMonitoring
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">Input Monitoring</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    permissions?.inputMonitoring
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {permissions?.inputMonitoring ? '✓ Granted' : '⚠️ Action Required'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Required by macOS to detect text selection gestures and clicks across other applications.
              </p>
              <button
                type="button"
                onClick={() => handleOpenPermission('input_monitoring')}
                className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-medium text-white transition"
              >
                Open Input Monitoring Settings
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs space-y-2.5 text-slate-300">
            <p className="font-semibold text-white">Important macOS Setup Instructions:</p>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">Both permissions are required:</strong> On macOS, <strong>Accessibility</strong> and <strong>Input Monitoring</strong> must both be enabled for the floating icon to appear over selected text.
              </li>
              <li>
                <strong className="text-slate-200">If already toggled ON but still inactive:</strong> When an app is rebuilt or updated, macOS invalidates the previous security hash. In System Settings, toggle the switch <strong>OFF and then back ON</strong> (or select SelectCheck and click the <code>-</code> button, then add it back) to re-bind the permission.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

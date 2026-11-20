import React, { useState } from 'react';
import {
  Settings,
  Sparkles,
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Save,
  RotateCcw
} from 'lucide-react';
import {
  SLOT3_PRESET_MAP,
  type AppSettings,
  type ProviderType,
  type Slot3Preset,
  DEFAULT_APP_SETTINGS
} from '@select-check/shared';
import { sendOtp, testProviderConnection, verifyOtp } from '../services/api.js';
import { triggerHaptic } from '../services/mobileBridge.js';

interface MobileSettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onQuotaUpdated: () => void;
}

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onQuotaUpdated
}) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Auth OTP state
  const [emailInput, setEmailInput] = useState(settings.userEmail || '');
  const [otpToken, setOtpToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [saveBanner, setSaveBanner] = useState(false);

  const handleSave = () => {
    triggerHaptic('success');
    onSaveSettings(form);
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 2000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      triggerHaptic('medium');
      setForm({ ...DEFAULT_APP_SETTINGS });
      onSaveSettings({ ...DEFAULT_APP_SETTINGS });
    }
  };

  const handleTestConnection = async () => {
    setIsTestingProvider(true);
    setTestResult(null);
    triggerHaptic('light');

    const result = await testProviderConnection(form);
    setTestResult({ ok: result.ok, message: result.message });
    setIsTestingProvider(false);
    triggerHaptic(result.ok ? 'success' : 'medium');
  };

  const handleSendOtp = async () => {
    if (!emailInput.includes('@')) {
      setAuthMsg('Please enter a valid email address.');
      return;
    }
    setAuthLoading(true);
    setAuthMsg(null);
    try {
      await sendOtp(form.apiUrl, emailInput);
      setOtpSent(true);
      setAuthMsg('Verification code sent to your email.');
      triggerHaptic('success');
    } catch (err: unknown) {
      setAuthMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpToken) return;
    setAuthLoading(true);
    setAuthMsg(null);
    try {
      const session = await verifyOtp(form.apiUrl, emailInput, otpToken);
      const updated: AppSettings = {
        ...form,
        authToken: session.accessToken,
        userEmail: session.user.email
      };
      setForm(updated);
      onSaveSettings(updated);
      onQuotaUpdated();
      setAuthMsg(`Signed in as ${session.user.email} (100 daily checks unlocked)`);
      triggerHaptic('success');
    } catch (err: unknown) {
      setAuthMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0b141a] px-3 py-3 space-y-4 pb-8">
      {/* Save Success Banner */}
      {saveBanner && (
        <div className="bg-[#00a884]/20 border border-[#00a884]/50 rounded-xl p-2.5 text-xs text-[#00a884] flex items-center space-x-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* 1. Slot 3 Persona Customization */}
      <div className="bg-[#1f2c34] rounded-2xl p-4 border border-[#222e35] shadow-sm">
        <div className="flex items-center space-x-2 mb-2 text-xs font-semibold text-[#00a884] uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Slot 3 Persona Style</span>
        </div>
        <p className="text-xs text-[#8696a0] mb-3 leading-relaxed">
          Slot 1 is always Grammar Fix, and Slot 2 is Clear & Concise. Choose your custom tone for Slot 3:
        </p>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SLOT3_PRESET_MAP).map(([key, meta]) => {
            const isSelected = form.slot3Preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setForm({ ...form, slot3Preset: key as Slot3Preset });
                }}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-[#00a884]/15 border-[#00a884] text-[#e9edef]'
                    : 'bg-[#111b21] border-[#222e35] text-[#8696a0] hover:text-[#e9edef]'
                }`}
              >
                <div className="text-xs font-semibold truncate">{meta.label}</div>
                <div className="text-[10px] text-[#8696a0] line-clamp-1 mt-0.5">
                  {meta.description}
                </div>
              </button>
            );
          })}
        </div>

        {form.slot3Preset === 'custom' && (
          <div className="mt-3">
            <label className="text-[11px] font-medium text-[#8696a0] block mb-1">
              Custom Persona Prompt:
            </label>
            <textarea
              rows={2}
              value={form.slot3CustomPrompt || ''}
              onChange={(e) => setForm({ ...form, slot3CustomPrompt: e.target.value })}
              placeholder="e.g. Rewrite as a friendly WhatsApp message with suitable emojis."
              className="w-full bg-[#111b21] text-xs text-[#e9edef] rounded-xl p-2.5 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50"
            />
          </div>
        )}
      </div>

      {/* 2. Provider Selection (Hosted vs BYOK) */}
      <div className="bg-[#1f2c34] rounded-2xl p-4 border border-[#222e35] shadow-sm">
        <div className="flex items-center space-x-2 mb-2 text-xs font-semibold text-[#53bdeb] uppercase tracking-wider">
          <Key className="w-4 h-4" />
          <span>AI Engine Provider</span>
        </div>

        <select
          value={form.providerType}
          onChange={(e) => {
            triggerHaptic('light');
            setForm({ ...form, providerType: e.target.value as ProviderType });
          }}
          className="w-full bg-[#111b21] text-xs text-[#e9edef] rounded-xl p-2.5 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50 mb-3"
        >
          <option value="hosted">Official Hosted Edge (Local or Cloudflare)</option>
          <option value="byok_groq">BYOK Groq (Ultra-Fast Llama 3.3)</option>
          <option value="byok_openai">BYOK OpenAI (GPT-4o Mini)</option>
          <option value="local_ollama">Local Ollama / LAN Host</option>
          <option value="custom_openai">Custom OpenAI-Compatible Endpoint</option>
        </select>

        {form.providerType === 'hosted' && (
          <div className="space-y-2 mt-2">
            <div>
              <label className="text-[11px] text-[#8696a0] block mb-1">
                Backend Server URL:
              </label>
              <input
                type="text"
                value={form.apiUrl || ''}
                onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                placeholder="http://localhost:8787"
                className="w-full bg-[#111b21] text-xs text-[#e9edef] rounded-xl p-2.5 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50 font-mono"
              />
            </div>
            <div className="flex items-center space-x-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setForm({ ...form, apiUrl: 'http://localhost:8787' });
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                  (form.apiUrl || '').includes('localhost') || (form.apiUrl || '').includes('127.0.0.1')
                    ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884]'
                    : 'bg-[#111b21] border-[#222e35] text-[#8696a0]'
                }`}
              >
                Local Server (http://localhost:8787)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setForm({
                    ...form,
                    apiUrl: 'https://run-interpreted-framing-rural.trycloudflare.com'
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                  !(form.apiUrl || '').includes('localhost') && !(form.apiUrl || '').includes('127.0.0.1')
                    ? 'bg-[#00a884]/20 border-[#00a884] text-[#00a884]'
                    : 'bg-[#111b21] border-[#222e35] text-[#8696a0]'
                }`}
              >
                Cloudflare Tunnel
              </button>
            </div>
          </div>
        )}

        {form.providerType !== 'hosted' && (
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] text-[#8696a0] block mb-1">API Key:</label>
              <input
                type="password"
                value={form.customApiKey || ''}
                onChange={(e) => setForm({ ...form, customApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-[#111b21] text-xs text-[#e9edef] rounded-xl p-2.5 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8696a0] block mb-1">Base URL (optional):</label>
              <input
                type="text"
                value={form.customBaseUrl || ''}
                onChange={(e) => setForm({ ...form, customBaseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-[#111b21] text-xs text-[#e9edef] rounded-xl p-2.5 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8696a0] block mb-1">Model Name:</label>
              <input
                type="text"
                value={form.customModel || ''}
                onChange={(e) => setForm({ ...form, customModel: e.target.value })}
                placeholder="e.g. gpt-4o-mini, llama-3.3-70b-versatile"
                className="w-full bg-[#111b21] text-xs text-[#e9edef] rounded-xl p-2.5 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50"
              />
            </div>

            <button
              type="button"
              disabled={isTestingProvider}
              onClick={handleTestConnection}
              className="w-full py-2 rounded-xl bg-[#2a3942] hover:bg-[#32424b] text-xs text-[#e9edef] font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-98"
            >
              {isTestingProvider ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00a884]" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>

            {testResult && (
              <div
                className={`p-2 rounded-xl text-[11px] flex items-center space-x-1.5 ${
                  testResult.ok
                    ? 'bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Authentication & Daily Quota */}
      <div className="bg-[#1f2c34] rounded-2xl p-4 border border-[#222e35] shadow-sm">
        <div className="flex items-center space-x-2 mb-2 text-xs font-semibold text-[#fbbf24] uppercase tracking-wider">
          <Shield className="w-4 h-4" />
          <span>Account & Daily Quotas</span>
        </div>

        {form.userEmail ? (
          <div className="p-3 bg-[#111b21] rounded-xl border border-[#222e35] text-xs text-[#e9edef]">
            <p className="text-[11px] text-[#8696a0]">Signed In Account:</p>
            <p className="font-semibold text-[#00a884] mt-0.5">{form.userEmail}</p>
            <p className="text-[11px] text-[#8696a0] mt-1">100 daily requests tier unlocked.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#8696a0]">
              Unlock 100 free checks per day (instead of 10) by verifying your email:
            </p>
            <div className="flex space-x-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-[#111b21] text-xs text-[#e9edef] rounded-xl px-3 py-2 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50"
              />
              <button
                type="button"
                disabled={authLoading}
                onClick={handleSendOtp}
                className="px-3 py-2 bg-[#00a884] hover:bg-[#029676] text-[#111b21] rounded-xl text-xs font-semibold transition-all"
              >
                {otpSent ? 'Resend' : 'Send Code'}
              </button>
            </div>

            {otpSent && (
              <div className="flex space-x-2 pt-1 animate-slide-up">
                <input
                  type="text"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="flex-1 bg-[#111b21] text-xs text-[#e9edef] rounded-xl px-3 py-2 border border-[#222e35] focus:outline-none focus:border-[#00a884]/50 font-mono tracking-widest text-center"
                />
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleVerifyOtp}
                  className="px-3 py-2 bg-[#53bdeb] hover:bg-[#38a9d8] text-[#111b21] rounded-xl text-xs font-semibold transition-all"
                >
                  Verify
                </button>
              </div>
            )}

            {authMsg && (
              <p className="text-[11px] text-[#8696a0] mt-1 italic">{authMsg}</p>
            )}
          </div>
        )}
      </div>

      {/* Save & Reset Buttons */}
      <div className="flex space-x-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#029676] text-[#111b21] font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-lg active:scale-95 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Save Preferences</span>
        </button>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="p-2.5 rounded-xl bg-[#1f2c34] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] border border-[#222e35] transition-all"
          title="Reset to Defaults"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

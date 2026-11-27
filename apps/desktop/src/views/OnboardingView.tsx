import { AppSettings } from '@select-check/shared';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Keyboard,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  ShortcutRecorder,
  formatShortcutForDisplay
} from '../components/ShortcutRecorder.js';
import {
  closeNativeOnboardingWindow,
  getAppSettings,
  isTauriEnvironment,
  saveAppSettings
} from '../services/tauriBridge.js';

interface OnboardingViewProps {
  onFinish?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onFinish }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [shortcut, setShortcut] = useState<string>('CommandOrControl+Shift+G');
  const [testText, setTestText] = useState(
    'Their going to launch the project tomorow.'
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [permissions, setPermissions] = useState<{
    accessibility: boolean;
    inputMonitoring: boolean;
  } | null>(null);

  useEffect(() => {
    getAppSettings().then((s) => {
      setSettings(s);
      if (s.globalShortcut) {
        setShortcut(s.globalShortcut);
      }
    });

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
  }, []);

  const handleOpenPermission = async (type: 'accessibility' | 'input_monitoring') => {
    if (isTauriEnvironment()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_permission_settings', { permissionType: type });
    }
  };

  const handleTestInSandbox = () => {
    setTestResult(
      'They are going to launch the project tomorrow.'
    );
  };

  const handleComplete = async () => {
    const current = settings || (await getAppSettings());
    const updated: AppSettings = {
      ...current,
      globalShortcut: shortcut,
      triggerMode: 'hotkey_only',
      autoShowOnSelect: false,
      onboardingCompleted: true
    };
    await saveAppSettings(updated);
    setSavedSuccess(true);

    setTimeout(async () => {
      await closeNativeOnboardingWindow();
      onFinish?.();
    }, 600);
  };

  const formattedTokens = formatShortcutForDisplay(shortcut);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 select-none custom-scrollbar">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Welcome to SelectCheck
            </h1>
            <p className="text-xs text-slate-400">
              Zero clutter. High-speed AI rewriting at your fingertips.
            </p>
          </div>
        </div>

        {/* Feature Philosophy Callout */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5">
          <div className="flex items-start gap-2.5 opacity-60">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
              <MousePointer2 className="h-3 w-3" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-300">
                Old Floating Icons
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                Annoying popups whenever you highlight words or read text.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
              <Zap className="h-3 w-3" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-300">
                New Hotkey-First Flow
              </div>
              <div className="text-[11px] text-slate-300 leading-snug">
                Totally invisible until you call it. Directly shows 3 suggestions at your cursor.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Form */}
      <div className="my-4 space-y-4">
        {/* Step 1: Hotkey Selection */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold">
                1
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Choose Your Trigger Hotkey
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Press anywhere to invoke
            </span>
          </div>

          <ShortcutRecorder value={shortcut} onChange={setShortcut} />
        </div>

        {/* Step 2: Interactive Sandbox */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold">
                2
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Test Drive
              </h2>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-indigo-400">
              <Keyboard className="h-3.5 w-3.5" />
              <span>Select text & press</span>
              <kbd className="ml-0.5 rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-200">
                {formattedTokens.join(' + ')}
              </kbd>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleTestInSandbox}
              className="absolute right-2 top-2 rounded-lg bg-indigo-600/30 px-2.5 py-1 text-[10px] font-medium text-indigo-300 hover:bg-indigo-600/50"
            >
              Simulate Hotkey
            </button>
          </div>

          {testResult && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{testResult}</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                Grammar Fixed (100%)
              </span>
            </div>
          )}
        </div>

        {/* Step 3: Permissions (macOS) */}
        {permissions && (!permissions.accessibility || !permissions.inputMonitoring) && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-semibold">macOS Accessibility Permission Required</span>
              </div>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              SelectCheck needs Accessibility to capture selected text across apps and replace it seamlessly when you select a suggestion.
            </p>
            <div className="flex gap-2 pt-1">
              {!permissions.accessibility && (
                <button
                  type="button"
                  onClick={() => handleOpenPermission('accessibility')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30"
                >
                  <ExternalLink className="h-3 w-3" />
                  Grant Accessibility
                </button>
              )}
              {!permissions.inputMonitoring && (
                <button
                  type="button"
                  onClick={() => handleOpenPermission('input_monitoring')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30"
                >
                  <ExternalLink className="h-3 w-3" />
                  Grant Input Monitoring
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Complete Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleComplete}
          disabled={savedSuccess}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-white" />
              <span>Activated! Ready in background</span>
            </>
          ) : (
            <>
              <span>Start Using SelectCheck with {formattedTokens.join(' + ')}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

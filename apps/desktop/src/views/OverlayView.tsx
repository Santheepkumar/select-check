import type { AppSettings, CheckResponse } from '@select-check/shared';
import { Diff, Globe, Loader2, Settings, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { FloatingBall } from '../components/FloatingBall.js';
import { SuggestionCard } from '../components/SuggestionCard.js';
import { checkGrammarWithApi } from '../services/api.js';
import {
  dismissNativeOverlay,
  expandNativeOverlay,
  getAppSettings,
  isTauriEnvironment,
  openNativeSettingsWindow,
  replaceSelectedTextInPlace,
  saveAppSettings
} from '../services/tauriBridge.js';

interface OverlayViewProps {
  initialText?: string;
  onReplaceText?: (replacementText: string) => void;
  onDismiss?: () => void;
  onOpenSettings?: () => void;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  initialText = '',
  onReplaceText,
  onDismiss,
  onOpenSettings
}) => {
  const [mode, setMode] = useState<'ball' | 'card'>('ball');
  const [selectedText, setSelectedText] = useState(initialText);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [showDiff, setShowDiff] = useState(true);
  const [hoveringBall, setHoveringBall] = useState(false);

  useEffect(() => {
    setSelectedText(initialText);
    setMode('ball');
    setResult(null);
    setError(null);
  }, [initialText]);

  useEffect(() => {
    getAppSettings().then((s) => {
      setSettings(s);
      setShowDiff(s.showWordDiff);
    });
  }, []);

  // Listen for native Tauri selection-detected event when running in Tauri window
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let unlistenFn: (() => void) | undefined;

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ text: string; app_name: string }>('selection-detected', (event) => {
        setSelectedText(event.payload.text);
        setMode('ball');
        setResult(null);
        setError(null);
      }).then((fn) => {
        unlistenFn = fn;
      });
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handleClose = useCallback(async () => {
    setMode('ball');
    setResult(null);
    setError(null);
    await dismissNativeOverlay();
    onDismiss?.();
  }, [onDismiss]);

  // Auto-hide timer in ball mode
  useEffect(() => {
    if (mode !== 'ball' || hoveringBall || !selectedText) return;
    const timeoutSec = settings?.autoHideSeconds || 4;
    const timer = setTimeout(() => {
      handleClose();
    }, timeoutSec * 1000);
    return () => clearTimeout(timer);
  }, [mode, hoveringBall, selectedText, settings?.autoHideSeconds, handleClose]);

  const handleApplySuggestion = useCallback(
    async (replacementText: string) => {
      await replaceSelectedTextInPlace(replacementText);
      onReplaceText?.(replacementText);
      await handleClose();
    },
    [onReplaceText, handleClose]
  );

  // Hotkeys 1, 2, 3 to instant-apply suggestions and Esc to dismiss
  useEffect(() => {
    if (mode !== 'card') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (result && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        const chosen = result.suggestions[idx];
        if (chosen) {
          handleApplySuggestion(chosen.text);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, result, handleClose, handleApplySuggestion]);

  const handleBallClick = async () => {
    setMode('card');
    setLoading(true);
    setError(null);
    await expandNativeOverlay();

    try {
      const currentSettings = settings || (await getAppSettings());
      setSettings(currentSettings);
      const res = await checkGrammarWithApi(selectedText, currentSettings);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check grammar');
    } finally {
      setLoading(false);
    }
  };

  const toggleWordDiff = async () => {
    const nextVal = !showDiff;
    setShowDiff(nextVal);
    if (settings) {
      const updated = await saveAppSettings({ ...settings, showWordDiff: nextVal });
      setSettings(updated);
    }
  };

  if (mode === 'ball') {
    return (
      <div className="flex h-11 w-11 items-center justify-center">
        <FloatingBall
          onClick={handleBallClick}
          onMouseEnter={() => setHoveringBall(true)}
          onMouseLeave={() => setHoveringBall(false)}
        />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[388px] rounded-2xl border border-slate-700/90 bg-slate-900/95 p-3.5 text-slate-100 shadow-2xl shadow-black/70 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-tight text-white">
            SelectCheck AI
          </span>
          {result && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              <Globe className="h-2.5 w-2.5 text-indigo-400" />
              {result.detectedLanguage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {result && (
            <span className="rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              {result.quota.used}/{result.quota.limit} today
            </span>
          )}
          <button
            type="button"
            onClick={toggleWordDiff}
            title="Toggle Word Diff Highlights"
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
              showDiff
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Diff className="h-3 w-3" />
            <span>Diff</span>
          </button>

          <button
            type="button"
            onClick={() => {
              openNativeSettingsWindow();
              onOpenSettings?.();
            }}
            title="Settings & Account"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Close (Esc)"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="mb-2.5 h-6 w-6 animate-spin text-indigo-400" />
          <p className="text-xs font-medium text-slate-300">
            Checking grammar & crafting top 3 improvements...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
          <p className="font-medium text-rose-300 mb-1">Unable to complete check</p>
          <p className="text-rose-200/90 leading-relaxed">{error}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleBallClick}
              className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-500/30"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                openNativeSettingsWindow();
                onOpenSettings?.();
              }}
              className="rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-600"
            >
              Sign In / Settings
            </button>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-2">
          {result.suggestions.map((item, idx) => (
            <SuggestionCard
              key={item.style}
              item={item}
              index={idx}
              originalText={result.originalText}
              showWordDiff={showDiff}
              onSelectReplace={handleApplySuggestion}
            />
          ))}

          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
            <span>Click a card or press 1, 2, 3 to replace in-place</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
};

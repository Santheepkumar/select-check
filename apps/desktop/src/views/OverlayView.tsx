import {
  isTextEligibleForCheck,
  type AppSettings,
  type CheckResponse
} from '@select-check/shared';
import {
  Cpu,
  Diff,
  Globe,
  GripHorizontal,
  Loader2,
  Lock,
  Settings,
  Sparkles,
  X,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  onDragStart?: (e: React.PointerEvent) => void;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  initialText = '',
  onReplaceText,
  onDismiss,
  onOpenSettings,
  onDragStart
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

  const isTriggeringRef = useRef(false);

  const handleClose = useCallback(async () => {
    isTriggeringRef.current = false;
    setMode('ball');
    setResult(null);
    setError(null);
    await dismissNativeOverlay();
    onDismiss?.();
  }, [onDismiss]);

  const handleBallTrigger = useCallback(async () => {
    if (isTriggeringRef.current || mode === 'card') return;
    isTriggeringRef.current = true;

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
      isTriggeringRef.current = false;
    }
  }, [mode, settings, selectedText]);

  // Listen for native Tauri selection-detected, trigger-ball, and overlay-dismissed events
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let unlistenFn: (() => void) | undefined;
    let unlistenDismiss: (() => void) | undefined;
    let unlistenTrigger: (() => void) | undefined;

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ text: string; app_name: string }>('selection-detected', (event) => {
        const text = event.payload.text;
        if (
          isTextEligibleForCheck(text, {
            skipCodeAndNumbers: settings?.skipCodeAndNumbers ?? true
          })
        ) {
          isTriggeringRef.current = false;
          setSelectedText(text);
          setMode('ball');
          setResult(null);
          setError(null);
        }
      }).then((fn) => {
        unlistenFn = fn;
      });

      listen('trigger-ball', () => {
        handleBallTrigger();
      }).then((fn) => {
        unlistenTrigger = fn;
      });

      listen('overlay-dismissed', () => {
        isTriggeringRef.current = false;
        setMode('ball');
        setResult(null);
        setError(null);
      }).then((fn) => {
        unlistenDismiss = fn;
      });
    });

    return () => {
      if (unlistenFn) unlistenFn();
      if (unlistenDismiss) unlistenDismiss();
      if (unlistenTrigger) unlistenTrigger();
    };
  }, [settings?.skipCodeAndNumbers, handleBallTrigger]);

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

  const handleDrag = async (e: React.PointerEvent | React.MouseEvent) => {
    if (e.button === 0 && isTauriEnvironment()) {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        await getCurrentWebviewWindow().startDragging();
      } catch (err) {
        console.warn('startDragging failed:', err);
      }
    }
  };

  const toggleWordDiff = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !showDiff;
    setShowDiff(nextVal);
    if (settings) {
      const updated = await saveAppSettings({ ...settings, showWordDiff: nextVal });
      setSettings(updated);
    }
  };

  if (mode === 'ball') {
    return (
      <FloatingBall
        onClick={handleBallTrigger}
        onMouseEnter={() => setHoveringBall(true)}
        onMouseLeave={() => setHoveringBall(false)}
      />
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[392px] max-h-[520px] flex flex-col select-none rounded-2xl border border-white/[0.08] bg-[#0c0d12]/98 p-3 text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-2xl ring-1 ring-white/[0.04] overflow-hidden"
    >
      {/* Draggable Header Bar with Grip Handle */}
      <div
        data-tauri-drag-region
        onPointerDown={handleDrag}
        onMouseDown={handleDrag}
        className="mb-2.5 flex cursor-grab active:cursor-grabbing items-center justify-between border-b border-white/[0.06] pb-2 shrink-0 select-none"
        title="Drag to reposition anywhere on screen"
      >
        <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-xs font-semibold tracking-tight text-white">
            SelectCheck
          </span>
          {result && (
            <span className="inline-flex items-center gap-1 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              <Globe className="h-2.5 w-2.5 text-indigo-400" />
              {result.detectedLanguage}
            </span>
          )}
        </div>

        {/* Center Grip Handle */}
        <div
          data-tauri-drag-region
          onPointerDown={handleDrag}
          onMouseDown={handleDrag}
          className="flex items-center px-2 text-white/30 transition-colors hover:text-white/70 cursor-grab active:cursor-grabbing"
        >
          <GripHorizontal className="h-4 w-4" />
        </div>

        {/* Action Controls (Explicitly non-draggable) */}
        <div
          data-tauri-drag-region={false}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5"
        >
          {/* Engine / Quota Badge */}
          {result && (
            <>
              {settings?.providerType === 'byok_groq' ? (
                <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  <Zap className="h-2.5 w-2.5" /> Groq
                </span>
              ) : settings?.providerType === 'local_ollama' ? (
                <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <Lock className="h-2.5 w-2.5" /> Local
                </span>
              ) : settings?.providerType === 'byok_openai' ? (
                <span className="inline-flex items-center gap-0.5 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                  <Cpu className="h-2.5 w-2.5" /> BYOK
                </span>
              ) : (
                <span className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  {result.quota.used}/{result.quota.limit}
                </span>
              )}
            </>
          )}

          <button
            type="button"
            onClick={toggleWordDiff}
            title="Toggle Word Diff Highlights"
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              showDiff
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`}
          >
            <Diff className="h-2.5 w-2.5" />
            <span>Diff</span>
          </button>

          <button
            type="button"
            onClick={() => {
              openNativeSettingsWindow();
              onOpenSettings?.();
            }}
            title="Settings & AI Engine"
            className="rounded p-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Close (Esc)"
            className="rounded p-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="mb-2.5 h-6 w-6 animate-spin text-indigo-400" />
          <p className="text-xs font-medium text-slate-300">
            Checking grammar & crafting top 3 improvements...
          </p>
          {settings?.providerType === 'local_ollama' ? (
            <p className="mt-1 text-[11px] text-emerald-400">Processing locally via Ollama</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">Analyzing tone, grammar, and clarity</p>
          )}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <p className="font-medium text-rose-300 mb-1">Unable to complete check</p>
          <p className="text-rose-200/90 leading-relaxed text-[11px]">{error}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleBallTrigger}
              className="rounded bg-rose-500/20 px-2 py-1 text-[10px] font-medium text-rose-200 hover:bg-rose-500/30"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                openNativeSettingsWindow();
                onOpenSettings?.();
              }}
              className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-500"
            >
              Configure Provider
            </button>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
            {result.suggestions.map((item, idx) => (
              <SuggestionCard
                key={`${item.style}-${idx}`}
                item={item}
                index={idx}
                originalText={result.originalText}
                showWordDiff={showDiff}
                onSelectReplace={handleApplySuggestion}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 select-none shrink-0 border-t border-white/[0.04] mt-2">
            <span>Press 1, 2, or 3 to replace in-place</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
};

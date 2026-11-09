import type { AppSettings } from '@select-check/shared';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Settings,
  Sparkles,
  Terminal
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { getAppSettings } from '../services/tauriBridge.js';
import { OverlayView } from './OverlayView.js';
import { SettingsView } from './SettingsView.js';

interface SimulatedApp {
  id: string;
  name: string;
  icon: React.ReactNode;
  defaultText: string;
}

const SIMULATED_APPS: SimulatedApp[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: <MessageSquare className="h-4 w-4 text-fuchsia-400" />,
    defaultText:
      'hey team, me and him goes to the client meeting yesterday and they was asking if can you send me the files quick before friday. i dont know why teh build failed earlier.'
  },
  {
    id: 'mail',
    name: 'Apple Mail / Outlook',
    icon: <Mail className="h-4 w-4 text-sky-400" />,
    defaultText:
      'Hi Sarah, I was wondering if you could send me the Q4 budget report due to the fact that we need to fix the projections before tomorrow morning.'
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: <Terminal className="h-4 w-4 text-emerald-400" />,
    defaultText:
      'git commit -m "fix grammer check sugeesions imptoving text in desktop app"'
  }
];

export const InteractiveWorkspace: React.FC = () => {
  const [activeAppId, setActiveAppId] = useState<string>('slack');
  const [texts, setTexts] = useState<Record<string, string>>({
    slack: SIMULATED_APPS[0].defaultText,
    mail: SIMULATED_APPS[1].defaultText,
    terminal: SIMULATED_APPS[2].defaultText
  });

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [replacedBanner, setReplacedBanner] = useState<string | null>(null);

  // Selection state inside the active editor
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
    text: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  const activeApp =
    SIMULATED_APPS.find((a) => a.id === activeAppId) || SIMULATED_APPS[0];

  const isCurrentAppBlocked = Boolean(
    settings?.blockedApps.some((b) =>
      activeApp.name.toLowerCase().includes(b.toLowerCase())
    )
  );

  const handleMouseUpOnEditor = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current;
    if (!el || !settings) return;

    if (!settings.autoShowOnSelect || isCurrentAppBlocked) {
      setSelectionRange(null);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end).trim();

    if (selected.length >= 2) {
      setSelectionRange({
        start,
        end,
        text: selected,
        x: Math.min(window.innerWidth - 410, Math.max(24, e.clientX + 10)),
        y: Math.min(window.innerHeight - 380, Math.max(24, e.clientY + 10))
      });
    } else {
      setSelectionRange(null);
    }
  };

  const handleReplaceInPlace = (replacementText: string) => {
    if (!selectionRange) return;
    const currentFullText = texts[activeApp.id] || '';
    const updatedText =
      currentFullText.slice(0, selectionRange.start) +
      replacementText +
      currentFullText.slice(selectionRange.end);

    setTexts((prev) => ({
      ...prev,
      [activeApp.id]: updatedText
    }));
    setSelectionRange(null);
    setReplacedBanner('Replaced selected text in-place!');
    setTimeout(() => setReplacedBanner(null), 2800);
  };

  const selectAllSampleText = () => {
    const el = textareaRef.current;
    if (!el || isCurrentAppBlocked) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
    const rect = el.getBoundingClientRect();
    setSelectionRange({
      start: 0,
      end: el.value.length,
      text: el.value.trim(),
      x: Math.min(window.innerWidth - 410, rect.left + 120),
      y: rect.top + 80
    });
  };

  return (
    <div
      onClick={() => setSelectionRange(null)}
      className="min-h-screen bg-slate-950 text-slate-100 p-6"
    >
      {/* Top Bar */}
      <header className="mx-auto mb-6 flex max-w-4xl items-center justify-between rounded-2xl border border-slate-800/90 bg-slate-900/80 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white">SelectCheck Desktop</h1>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                Windows · macOS · Linux
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Highlight any text below to trigger the floating grammar ball → click to get Top 3 OpenAI suggestions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowSettingsModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700"
        >
          <Settings className="h-4 w-4 text-indigo-400" />
          Settings & Quota
        </button>
      </header>

      {/* Main Simulated OS Workspace */}
      <main
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-4xl space-y-4"
      >
        {/* App Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">
              Active OS Window:
            </span>
            {SIMULATED_APPS.map((app) => {
              const blocked = settings?.blockedApps.some((b) =>
                app.name.toLowerCase().includes(b.toLowerCase())
              );
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    setActiveAppId(app.id);
                    setSelectionRange(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                    activeAppId === app.id
                      ? 'border-indigo-500/60 bg-indigo-500/15 text-white shadow-sm'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {app.icon}
                  <span>{app.name}</span>
                  {blocked && (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
                      Blocked
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={selectAllSampleText}
            disabled={isCurrentAppBlocked}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Select Sample Sentence
          </button>
        </div>

        {/* Simulated App Window */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 flex items-center gap-1.5 text-xs font-medium text-slate-300">
                {activeApp.icon}
                {activeApp.name}
              </span>
            </div>

            {isCurrentAppBlocked ? (
              <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                App is in Blocklist — Floating ball disabled here
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Drag-select or double-click any words below
              </span>
            )}
          </div>

          <div className="p-5">
            <textarea
              ref={textareaRef}
              rows={5}
              value={texts[activeApp.id]}
              onChange={(e) =>
                setTexts((prev) => ({ ...prev, [activeApp.id]: e.target.value }))
              }
              onMouseUp={handleMouseUpOnEditor}
              onDoubleClick={handleMouseUpOnEditor}
              placeholder="Type or select text here..."
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:border-indigo-500/60 focus:outline-none"
            />

            {replacedBanner && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {replacedBanner}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Overlay (Ball -> 3 Suggestions Popover) */}
      {selectionRange && (
        <div
          style={{
            position: 'fixed',
            left: `${selectionRange.x}px`,
            top: `${selectionRange.y}px`,
            zIndex: 50
          }}
        >
          <OverlayView
            initialText={selectionRange.text}
            onReplaceText={handleReplaceInPlace}
            onDismiss={() => setSelectionRange(null)}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
            <SettingsView
              onClose={() => setShowSettingsModal(false)}
              onSettingsUpdated={(updated) => setSettings(updated)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

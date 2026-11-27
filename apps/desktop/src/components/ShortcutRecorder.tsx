import { Check, Command, Keyboard, RotateCcw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ShortcutRecorderProps {
  value: string;
  onChange: (shortcut: string) => void;
  disabled?: boolean;
}

const PRESETS = [
  { label: '⌘⇧G / Ctrl+Shift+G', value: 'CommandOrControl+Shift+G', desc: 'Recommended default' },
  { label: '⌥Space / Alt+Space', value: 'Alt+Space', desc: 'Fast thumb trigger' },
  { label: '⌘⇧K / Ctrl+Shift+K', value: 'CommandOrControl+Shift+K', desc: 'Productivity' },
  { label: '⌥E / Alt+E', value: 'Alt+E', desc: 'Quick rewrite' }
];

export function formatShortcutForDisplay(shortcut: string): string[] {
  if (!shortcut) return ['None'];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);

  return shortcut.split('+').map((part) => {
    const p = part.trim();
    if (p === 'CommandOrControl' || p === 'Command' || p === 'Cmd') {
      return isMac ? '⌘ Cmd' : 'Ctrl';
    }
    if (p === 'Control' || p === 'Ctrl') {
      return isMac ? '⌃ Control' : 'Ctrl';
    }
    if (p === 'Alt' || p === 'Option') {
      return isMac ? '⌥ Option' : 'Alt';
    }
    if (p === 'Shift') {
      return isMac ? '⇧ Shift' : 'Shift';
    }
    return p;
  });
}

export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [recording, setRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't finish if only modifier is pressed
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
        const mods: string[] = [];
        if (e.metaKey || e.ctrlKey) mods.push('CommandOrControl');
        if (e.altKey) mods.push('Alt');
        if (e.shiftKey) mods.push('Shift');
        setRecordedKeys(mods);
        return;
      }

      // Key combination completed
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let mainKey = e.key.toUpperCase();
      if (e.code === 'Space' || e.key === ' ') {
        mainKey = 'Space';
      } else if (mainKey.length === 1) {
        mainKey = mainKey.toUpperCase();
      }

      parts.push(mainKey);
      const combined = parts.join('+');
      onChange(combined);
      setRecording(false);
      setRecordedKeys([]);
    };

    const handleClickOutside = () => {
      setRecording(false);
      setRecordedKeys([]);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [recording, onChange]);

  const displayTokens = recording
    ? recordedKeys.length > 0
      ? formatShortcutForDisplay(recordedKeys.join('+'))
      : ['Press keys...']
    : formatShortcutForDisplay(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setRecording(true)}
          className={`flex-1 flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
            recording
              ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Keyboard
              className={`h-4 w-4 ${recording ? 'animate-pulse text-indigo-400' : 'text-slate-400'}`}
            />
            <span className="text-xs font-medium text-slate-300">
              {recording ? 'Press your key combo on keyboard...' : 'Active Hotkey:'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {displayTokens.map((token, idx) => (
              <kbd
                key={idx}
                className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold tracking-wide transition-colors ${
                  recording
                    ? 'border border-indigo-400/50 bg-indigo-500/30 text-indigo-200'
                    : 'border border-slate-700 bg-slate-800/90 text-slate-100 shadow-sm'
                }`}
              >
                {token}
              </kbd>
            ))}
          </div>
        </button>

        {value !== 'CommandOrControl+Shift+G' && (
          <button
            type="button"
            title="Reset to default shortcut"
            onClick={() => onChange('CommandOrControl+Shift+G')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Preset Badges */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Or Pick a Popular Preset:
        </span>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const isSelected = value === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={`flex items-center justify-between rounded-lg border p-2 text-left transition ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800/80 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-medium font-mono">{p.label}</div>
                  <div className="text-[10px] text-slate-400">{p.desc}</div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

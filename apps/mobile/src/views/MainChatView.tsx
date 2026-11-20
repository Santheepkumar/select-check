import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Clipboard,
  X,
  Copy,
  Check,
  Share2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  CornerDownLeft
} from 'lucide-react';
import type { AppSettings, CheckResponse, Slot3Preset } from '@select-check/shared';
import { SLOT3_PRESET_MAP } from '@select-check/shared';
import { checkGrammar } from '../services/api.js';
import { addHistoryEntry } from '../services/localHistoryDb.js';
import {
  triggerHaptic,
  writeClipboardText,
  readClipboardText,
  shareToWhatsApp,
  replaceActiveAppText,
  isAndroidNativeAvailable
} from '../services/mobileBridge.js';
import { computeWordDiff } from '../utils/diff.js';

interface MainChatViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onQuotaUpdated: () => void;
  isBackgroundActive: boolean;
  onOpenPermissions: () => void;
}

const TONE_PRESETS: { id: Slot3Preset; label: string; icon: string }[] = [
  { id: 'professional_polished', label: 'Professional', icon: '✨' },
  { id: 'casual_friendly', label: 'Casual & Friendly', icon: '💬' },
  { id: 'bullet_points', label: 'Bullet Points', icon: '⚡' },
  { id: 'executive_brief', label: 'Executive Brief', icon: '👔' },
  { id: 'translate_spanish', label: 'Spanish', icon: '🌐' }
];

export const MainChatView: React.FC<MainChatViewProps> = ({
  settings,
  onSaveSettings,
  onQuotaUpdated,
  isBackgroundActive,
  onOpenPermissions
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedDiffIndex, setExpandedDiffIndex] = useState<number | null>(null);
  const [hasReplacedIndex, setHasReplacedIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sampleTexts = [
    'Hey, r u comming to the meating tmrw?',
    'i will do this task as soon as possible and revert back',
    'We should discuss about the budget in our next catchup.'
  ];

  // Listen for incoming text from Android Accessibility Service, Process Text Intent, or Share Intent
  useEffect(() => {
    const handleIncoming = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      const text = customEvent.detail?.text;
      if (text) {
        setInputText(text);
        handleCheck(text);
      }
    };

    window.addEventListener('selectcheck:incoming-text', handleIncoming);

    // Check if initial text was passed on window before event listener was attached
    const initialText = window.__SELECTCHECK_INCOMING_TEXT__;
    if (initialText) {
      setInputText(initialText);
      handleCheck(initialText);
      window.__SELECTCHECK_INCOMING_TEXT__ = undefined;
    }

    return () => {
      window.removeEventListener('selectcheck:incoming-text', handleIncoming);
    };
  }, []);

  const handleCheck = async (textToCheck?: string) => {
    const target = (textToCheck || inputText).trim();
    if (!target) return;

    setIsLoading(true);
    setErrorMsg(null);
    triggerHaptic('medium');

    try {
      const response = await checkGrammar(target, settings);
      setResult(response);
      addHistoryEntry(response);
      onQuotaUpdated();
      triggerHaptic('success');
    } catch (err: unknown) {
      console.error('Check failed:', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      triggerHaptic('medium');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    triggerHaptic('light');
    const text = await readClipboardText();
    if (text) {
      setInputText(text);
      textareaRef.current?.focus();
    }
  };

  const handleClear = () => {
    triggerHaptic('light');
    setInputText('');
    setResult(null);
    setErrorMsg(null);
    textareaRef.current?.focus();
  };

  const handleCopy = async (text: string, index: number) => {
    await writeClipboardText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleReplaceInApp = (text: string, index: number) => {
    triggerHaptic('success');
    const success = replaceActiveAppText(text);
    if (success) {
      setHasReplacedIndex(index);
      setTimeout(() => setHasReplacedIndex(null), 2500);
    } else {
      // Fallback to clipboard copy
      handleCopy(text, index);
    }
  };

  const handleSelectPreset = (presetId: Slot3Preset) => {
    triggerHaptic('light');
    const updated = { ...settings, slot3Preset: presetId };
    onSaveSettings(updated);
    if (inputText.trim() && result) {
      handleCheck(inputText);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3 mobile-scrollbar pb-10">
      <div className="max-w-md mx-auto w-full space-y-4">
        {/* Background Permissions Card (Clean & Non-Intrusive) */}
        {!isBackgroundActive && (
          <div className="bg-[#111b21] border border-[#f59e0b]/30 rounded-2xl p-3.5 shadow-md flex items-center justify-between">
            <div className="flex items-center space-x-3 pr-2">
              <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/15 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-[#f59e0b]" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#e9edef]">
                  Floating Logo Not Yet Active
                </h3>
                <p className="text-[11px] text-[#8696a0]">
                  Turn on in Settings to see ✨ logo when selecting text
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onOpenPermissions();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#008069] text-[#111b21] font-bold text-xs shrink-0 transition-all active:scale-95 flex items-center space-x-1"
            >
              <span>Setup</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tone Selector Chips */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">
              Rewrite Tone
            </span>
            <span className="text-[11px] text-[#00a884] font-medium">
              {SLOT3_PRESET_MAP[settings.slot3Preset]?.label || 'Professional'}
            </span>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-1 mobile-scrollbar">
            {TONE_PRESETS.map((preset) => {
              const isSelected = settings.slot3Preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? 'bg-[#00a884] text-[#111b21] font-bold shadow-md shadow-[#00a884]/20'
                      : 'bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] border border-[#202c33]'
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Input Card */}
        <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-4 shadow-lg space-y-3">
          {/* Card Top Action Row */}
          <div className="flex items-center justify-between text-xs text-[#8696a0]">
            <span className="font-semibold text-[#e9edef]">Input Message</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] font-semibold transition-colors active:scale-95"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
              {inputText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] transition-colors"
                  title="Clear text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste any text or WhatsApp message..."
            className="w-full bg-transparent text-[#e9edef] placeholder-[#8696a0]/50 text-[15px] leading-relaxed resize-none focus:outline-none"
          />

          {/* Bottom Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-[#202c33]">
            <span className="text-[11px] text-[#8696a0]">
              {inputText.length} characters • {inputText.trim() ? inputText.trim().split(/\s+/).length : 0} words
            </span>

            <button
              type="button"
              disabled={isLoading || !inputText.trim()}
              onClick={() => handleCheck()}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all duration-200 ${
                isLoading || !inputText.trim()
                  ? 'bg-[#202c33] text-[#8696a0] cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#00a884] to-[#059669] text-[#111b21] shadow-md shadow-[#00a884]/20 hover:brightness-110 active:scale-95'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Refining...' : 'Refine Message'}</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-[#ef4444]/15 border border-[#ef4444]/30 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-[#ef4444]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Failed to refine</span>
              <span className="opacity-90">{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-3 pt-1 animate-slide-up">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#e9edef] flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Refinement Options</span>
              </span>
              <span className="text-[11px] text-[#8696a0]">Tap to copy or share</span>
            </div>

            {result.suggestions.map((item, index) => {
              const isCopied = copiedIndex === index;
              const isDiffExpanded = expandedDiffIndex === index;
              const isReplaced = hasReplacedIndex === index;
              const wordDiff = computeWordDiff(result.originalText, item.text);

              const badgeConfig =
                index === 0
                  ? { label: 'Grammar & Spelling', color: 'bg-[#00a884]/20 text-[#00a884] border-[#00a884]/30' }
                  : index === 1
                  ? { label: 'Clear & Concise', color: 'bg-[#0284c7]/20 text-[#38bdf8] border-[#0284c7]/30' }
                  : { label: SLOT3_PRESET_MAP[settings.slot3Preset]?.label || 'Tone', color: 'bg-[#8b5cf6]/20 text-[#a78bfa] border-[#8b5cf6]/30' };

              return (
                <div
                  key={index}
                  className="bg-[#111b21] border border-[#202c33] rounded-2xl p-4 shadow-md space-y-3 transition-all hover:border-[#2a3942]"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeConfig.color}`}
                    >
                      {badgeConfig.label}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDiffIndex(isDiffExpanded ? null : index)
                      }
                      className="text-[11px] text-[#8696a0] hover:text-[#e9edef] flex items-center space-x-1"
                    >
                      <span>{isDiffExpanded ? 'Hide Changes' : 'View Changes'}</span>
                      {isDiffExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Refined Text */}
                  <p className="text-[15px] text-[#e9edef] leading-relaxed select-text font-normal">
                    {item.text}
                  </p>

                  {/* Inline Word Diff */}
                  {isDiffExpanded && (
                    <div className="p-3 rounded-xl bg-[#0b141a] border border-[#202c33] text-xs leading-relaxed">
                      {wordDiff.map((part, pIdx) => (
                        <span
                          key={pIdx}
                          className={
                            part.type === 'insert'
                              ? 'bg-[#00a884]/30 text-[#25d366] px-1 rounded mx-0.5 font-medium'
                              : part.type === 'delete'
                              ? 'bg-[#ef4444]/30 text-[#f87171] line-through px-1 rounded mx-0.5'
                              : 'text-[#8696a0]'
                          }
                        >
                          {part.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-[#202c33]">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.text, index)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 ${
                        isCopied
                          ? 'bg-[#00a884] text-[#111b21]'
                          : 'bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef]'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {isAndroidNativeAvailable() && (
                      <button
                        type="button"
                        onClick={() => handleReplaceInApp(item.text, index)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95 ${
                          isReplaced
                            ? 'bg-[#00a884] text-[#111b21]'
                            : 'bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] border border-[#00a884]/30'
                        }`}
                        title="Replace text in active WhatsApp conversation directly"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" />
                        <span>{isReplaced ? 'Replaced!' : 'Replace in App'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => shareToWhatsApp(item.text)}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold bg-[#00a884]/15 hover:bg-[#00a884]/25 text-[#00a884] border border-[#00a884]/30 flex items-center justify-center space-x-1.5 transition-all active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State / Quick Sample Chips */}
        {!result && !isLoading && (
          <div className="space-y-2.5 pt-2">
            <span className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block px-1">
              Try a Quick Sample
            </span>
            <div className="space-y-2">
              {sampleTexts.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(sample);
                    handleCheck(sample);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-[#111b21] hover:bg-[#162229] border border-[#202c33] flex items-center justify-between text-xs text-[#8696a0] hover:text-[#e9edef] transition-all group active:scale-98"
                >
                  <span className="truncate pr-2 italic text-[13px]">"{sample}"</span>
                  <span className="text-[#00a884] font-bold flex items-center space-x-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
                    <span>Try</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

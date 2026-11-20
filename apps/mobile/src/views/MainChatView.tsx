import React, { useState } from 'react';
import { Sparkles, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import type { AppSettings, CheckResponse } from '@select-check/shared';
import { checkGrammar } from '../services/api.js';
import { addHistoryEntry } from '../services/localHistoryDb.js';
import { triggerHaptic } from '../services/mobileBridge.js';
import { MessageBubble } from '../components/MessageBubble.js';
import { SuggestionCardsSheet } from '../components/SuggestionCardsSheet.js';
import { ChatComposer } from '../components/ChatComposer.js';
import { FloatingLogoSimulator } from '../components/FloatingLogoSimulator.js';

interface MainChatViewProps {
  settings: AppSettings;
  onQuotaUpdated: () => void;
}

export const MainChatView: React.FC<MainChatViewProps> = ({
  settings,
  onQuotaUpdated
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<CheckResponse | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);

  const sampleQuickTexts = [
    'Hey, r u comming to the meating tmrw?',
    'i will do this task as soon as possible and revert back',
    'We should discuss about the budget in our next catchup.'
  ];

  const handleCheck = async (textToCheck?: string) => {
    const target = (textToCheck || inputText).trim();
    if (!target) return;

    setIsLoading(true);
    setErrorMsg(null);
    triggerHaptic('medium');

    try {
      const response = await checkGrammar(target, settings);
      setLastCheck(response);
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

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto wa-wallpaper-pattern">
      {/* Scrollable Conversation Stream */}
      <div className="flex-1 px-2 py-3 overflow-y-auto mobile-scrollbar">
        {/* Simulator Toggle Pill */}
        <div className="flex justify-center mb-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowSimulator(!showSimulator);
            }}
            className="flex items-center space-x-1.5 text-xs text-[#00a884] bg-[#1f2c34] hover:bg-[#202c33] border border-[#00a884]/30 px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-[#00a884]" />
            <span>
              {showSimulator
                ? 'Hide Floating Overlay Simulator'
                : 'Try Android Floating Overlay Simulator'}
            </span>
          </button>
        </div>

        {/* Embedded Interactive Simulator */}
        {showSimulator && <FloatingLogoSimulator />}

        {/* Empty State / Welcome Guide */}
        {!lastCheck && !isLoading && !errorMsg && (
          <div className="max-w-md mx-auto text-center py-6 px-4 animate-slide-up">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#008069] to-[#00a884] flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Sparkles className="w-6 h-6 text-white stroke-[2.2]" />
            </div>
            <h2 className="text-base font-semibold text-[#e9edef] mb-1">
              SelectCheck for Mobile
            </h2>
            <p className="text-xs text-[#8696a0] mb-4 leading-relaxed">
              Fast, ultra-lightweight grammar & tone refiner designed for WhatsApp. Type
              or paste any message below.
            </p>

            <div className="space-y-2 text-left">
              <span className="text-[11px] font-medium text-[#8696a0] uppercase tracking-wider block px-1">
                Quick Sample Messages:
              </span>
              {sampleQuickTexts.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(sample);
                    handleCheck(sample);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-[#1f2c34] hover:bg-[#2a3942] border border-[#222e35] text-xs text-[#e9edef] transition-all flex items-center justify-between group active:scale-98 shadow-sm"
                >
                  <span className="truncate pr-2">{sample}</span>
                  <span className="text-[10px] text-[#00a884] opacity-80 group-hover:opacity-100 font-medium">
                    Try ➔
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 my-3 mx-2 text-xs text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">Unable to Refine Message</p>
              <p className="mt-0.5 text-[11px]">{errorMsg}</p>
              <button
                type="button"
                onClick={() => handleCheck()}
                className="mt-2 text-[11px] text-[#00a884] flex items-center gap-1 font-medium hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat History Flow for Active Check */}
        {lastCheck && (
          <div className="space-y-2">
            {/* Outgoing Message Bubble (Original) */}
            <MessageBubble
              text={lastCheck.originalText}
              detectedLanguage={lastCheck.detectedLanguage}
            />

            {/* Assistant Suggestions Sheet */}
            <SuggestionCardsSheet
              suggestions={lastCheck.suggestions}
              originalText={lastCheck.originalText}
            />
          </div>
        )}
      </div>

      {/* WhatsApp Fixed Bottom Composer */}
      <ChatComposer
        value={inputText}
        onChange={setInputText}
        onSubmit={() => handleCheck()}
        isLoading={isLoading}
      />
    </div>
  );
};

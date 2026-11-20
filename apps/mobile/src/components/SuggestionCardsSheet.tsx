import React, { useState } from 'react';
import {
  Check,
  Copy,
  Share2,
  Sparkles,
  GitCompare,
  Star
} from 'lucide-react';
import type { SuggestionItem } from '@select-check/shared';
import { computeWordDiff } from '../utils/diff.js';
import { shareToWhatsApp, triggerHaptic, writeClipboardText } from '../services/mobileBridge.js';

interface SuggestionCardsSheetProps {
  suggestions: [SuggestionItem, SuggestionItem, SuggestionItem];
  originalText: string;
  onFavorite?: (item: SuggestionItem) => void;
  isFavorite?: boolean;
}

const STYLE_BADGE_CLASSES: Record<string, { badge: string; border: string; accent: string }> = {
  grammar_fix: {
    badge: 'bg-[#00a884]/15 text-[#00a884] border-[#00a884]/30',
    border: 'border-[#00a884]/40',
    accent: '#00a884'
  },
  clear_concise: {
    badge: 'bg-[#53bdeb]/15 text-[#53bdeb] border-[#53bdeb]/30',
    border: 'border-[#53bdeb]/40',
    accent: '#53bdeb'
  },
  professional_polished: {
    badge: 'bg-[#a78bfa]/15 text-[#a78bfa] border-[#a78bfa]/30',
    border: 'border-[#a78bfa]/40',
    accent: '#a78bfa'
  },
  casual_friendly: {
    badge: 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/30',
    border: 'border-[#fbbf24]/40',
    accent: '#fbbf24'
  },
  bullet_points: {
    badge: 'bg-[#2dd4bf]/15 text-[#2dd4bf] border-[#2dd4bf]/30',
    border: 'border-[#2dd4bf]/40',
    accent: '#2dd4bf'
  },
  executive_brief: {
    badge: 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/30',
    border: 'border-[#f43f5e]/40',
    accent: '#f43f5e'
  },
  translate_spanish: {
    badge: 'bg-[#fb923c]/15 text-[#fb923c] border-[#fb923c]/30',
    border: 'border-[#fb923c]/40',
    accent: '#fb923c'
  },
  custom_slot: {
    badge: 'bg-[#c084fc]/15 text-[#c084fc] border-[#c084fc]/30',
    border: 'border-[#c084fc]/40',
    accent: '#c084fc'
  }
};

export const SuggestionCardsSheet: React.FC<SuggestionCardsSheetProps> = ({
  suggestions,
  originalText,
  onFavorite
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeDiffIndex, setActiveDiffIndex] = useState<number | null>(null);
  const [bookmarked, setBookmarked] = useState<boolean[]>([false, false, false]);

  const handleCopy = async (text: string, index: number) => {
    await writeClipboardText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const handleShare = async (text: string) => {
    await shareToWhatsApp(text);
  };

  const toggleBookmark = (index: number) => {
    triggerHaptic('light');
    setBookmarked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
    if (onFavorite) {
      onFavorite(suggestions[index]);
    }
  };

  return (
    <div className="flex flex-col space-y-3 px-3 my-2 animate-slide-up">
      <div className="flex items-center justify-between text-xs text-[#8696a0] px-1">
        <span className="flex items-center gap-1 font-medium text-[#00a884]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Top 3 Refinements</span>
        </span>
        <span className="text-[11px]">Tap Send to WhatsApp</span>
      </div>

      {suggestions.map((item, idx) => {
        const theme =
          STYLE_BADGE_CLASSES[item.style] || STYLE_BADGE_CLASSES.professional_polished;
        const isDiffActive = activeDiffIndex === idx;
        const diffSegments = isDiffActive ? computeWordDiff(originalText, item.text) : [];

        return (
          <div
            key={`${item.style}-${idx}`}
            className="bg-[#202c33] rounded-2xl p-3.5 border border-[#222e35] shadow-lg transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-[#111b21] border border-[#2a3942] flex items-center justify-center text-[11px] font-bold text-[#8696a0]">
                  {idx + 1}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${theme.badge}`}
                >
                  {item.label}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => toggleBookmark(idx)}
                  className={`p-1.5 rounded-full transition-colors ${
                    bookmarked[idx]
                      ? 'text-[#fbbf24] bg-[#fbbf24]/10'
                      : 'text-[#8696a0] hover:text-[#e9edef]'
                  }`}
                  title="Favorite"
                >
                  <Star className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Content: Either Word-Diff or Plain Text */}
            <div className="bg-[#111b21] rounded-xl p-3 my-2 border border-[#222e35]/80 text-sm leading-relaxed text-[#e9edef] select-text">
              {isDiffActive ? (
                <div className="break-words">
                  {diffSegments.map((seg, sIdx) => {
                    if (seg.type === 'delete') {
                      return (
                        <del
                          key={sIdx}
                          className="bg-red-950/80 text-red-300 line-through px-0.5 rounded mx-0.5 text-xs select-none"
                        >
                          {seg.value}
                        </del>
                      );
                    }
                    if (seg.type === 'insert') {
                      return (
                        <ins
                          key={sIdx}
                          className="bg-emerald-950/80 text-emerald-300 font-semibold no-underline px-0.5 rounded mx-0.5"
                        >
                          {seg.value}
                        </ins>
                      );
                    }
                    return <span key={sIdx}>{seg.value}</span>;
                  })}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{item.text}</p>
              )}
            </div>

            {/* Summary Tag */}
            <div className="flex items-center justify-between text-[11px] text-[#8696a0] mb-2 px-1">
              <span>{item.summary}</span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveDiffIndex(isDiffActive ? null : idx);
                }}
                className={`flex items-center space-x-1 hover:text-[#00a884] transition-colors ${
                  isDiffActive ? 'text-[#00a884] font-medium' : ''
                }`}
              >
                <GitCompare className="w-3 h-3" />
                <span>{isDiffActive ? 'Hide Diff' : 'View Diff'}</span>
              </button>
            </div>

            {/* Actions: Send to WhatsApp + Copy */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#222e35]/60">
              <button
                type="button"
                onClick={() => handleCopy(item.text, idx)}
                className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#2a3942] hover:bg-[#32424b] text-[#e9edef] text-xs font-medium transition-all active:scale-95"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00a884]" />
                    <span className="text-[#00a884]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8696a0]" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleShare(item.text)}
                className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#00a884] hover:bg-[#029676] text-[#111b21] text-xs font-semibold shadow transition-all active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Send to WhatsApp</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

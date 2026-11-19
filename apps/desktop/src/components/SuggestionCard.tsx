import type { SuggestionItem } from '@select-check/shared';
import { Check, Copy, CornerDownLeft } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { computeWordDiff } from '../utils/diff.js';

interface SuggestionCardProps {
  item: SuggestionItem;
  index: number;
  originalText: string;
  showWordDiff: boolean;
  onSelectReplace: (text: string) => void;
}

const STYLE_BADGES: Record<
  SuggestionItem['style'],
  { badgeClass: string; borderHover: string }
> = {
  grammar_fix: {
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    borderHover: 'hover:border-emerald-500/40'
  },
  clear_concise: {
    badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    borderHover: 'hover:border-sky-500/40'
  },
  professional_polished: {
    badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
    borderHover: 'hover:border-indigo-500/40'
  },
  casual_friendly: {
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    borderHover: 'hover:border-amber-500/40'
  },
  bullet_points: {
    badgeClass: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
    borderHover: 'hover:border-teal-500/40'
  },
  executive_brief: {
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    borderHover: 'hover:border-rose-500/40'
  },
  translate_spanish: {
    badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
    borderHover: 'hover:border-orange-500/40'
  },
  custom_slot: {
    badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
    borderHover: 'hover:border-purple-500/40'
  }
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  item,
  index,
  originalText,
  showWordDiff,
  onSelectReplace
}) => {
  const [copied, setCopied] = useState(false);
  const styleMeta = STYLE_BADGES[item.style] || STYLE_BADGES.professional_polished;
  const segments = useMemo(
    () => computeWordDiff(originalText, item.text),
    [originalText, item.text]
  );

  const handleCopyOnly = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectReplace(item.text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectReplace(item.text);
        }
      }}
      className={`group relative flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-all duration-150 hover:border-white/[0.16] hover:bg-white/[0.04] active:scale-[0.99] focus:outline-none focus:ring-1 focus:ring-indigo-500/60 ${styleMeta.borderHover}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Tactile Keycap (1, 2, 3) */}
          <span className="flex h-5 w-5 select-none items-center justify-center rounded border border-white/[0.12] bg-white/[0.04] font-mono text-[11px] font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors group-hover:border-indigo-500/60 group-hover:bg-indigo-600 group-hover:text-white">
            {index + 1}
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide ${styleMeta.badgeClass}`}
          >
            {item.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 opacity-75 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopyOnly}
            title="Copy suggestion to clipboard"
            className="flex items-center gap-1 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-2.5 w-2.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-2.5 w-2.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          <span
            title="Click or press number key to replace selected text in-place"
            className="flex items-center gap-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 group-hover:border-indigo-500/60 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
          >
            <CornerDownLeft className="h-2.5 w-2.5" />
            <span>Replace</span>
          </span>
        </div>
      </div>

      {/* Suggestion Text & Word Diff */}
      <div className="text-xs leading-relaxed text-[#e2e8f0]">
        {showWordDiff ? (
          <p className="whitespace-pre-wrap">
            {segments.map((seg, i) => {
              if (seg.type === 'insert') {
                return (
                  <mark
                    key={i}
                    className="bg-emerald-500/15 text-emerald-300 rounded px-1 py-0.5 font-medium not-italic"
                  >
                    {seg.value}
                  </mark>
                );
              }
              if (seg.type === 'delete') {
                return (
                  <del
                    key={i}
                    className="bg-rose-500/15 text-rose-300/80 rounded px-1 py-0.5 line-through not-italic opacity-70 mr-1"
                  >
                    {seg.value}
                  </del>
                );
              }
              return <span key={i}>{seg.value}</span>;
            })}
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{item.text}</p>
        )}
      </div>

      {/* Summary caption */}
      {item.summary && (
        <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-[#1e2029] pt-1.5 mt-0.5">
          <span>{item.summary}</span>
        </div>
      )}
    </div>
  );
};

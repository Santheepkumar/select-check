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
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    borderHover: 'hover:border-emerald-500/50'
  },
  clear_concise: {
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    borderHover: 'hover:border-sky-500/50'
  },
  professional_polished: {
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    borderHover: 'hover:border-violet-500/50'
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
  const styleMeta = STYLE_BADGES[item.style];
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
      className={`group relative rounded-xl border border-slate-700/80 bg-slate-800/85 p-3 text-left transition-all duration-150 hover:bg-slate-800 ${styleMeta.borderHover} cursor-pointer shadow-sm`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-700/90 font-mono text-[11px] font-semibold text-slate-200">
            {index + 1}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styleMeta.badgeClass}`}
          >
            {item.label}
          </span>
          <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
            {item.summary}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyOnly}
            title="Copy to clipboard without replacing"
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[11px] text-slate-300 opacity-80 transition hover:border-slate-500 hover:text-white group-hover:opacity-100"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          <span className="hidden items-center gap-0.5 rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 group-hover:inline-flex">
            <CornerDownLeft className="h-2.5 w-2.5" />
            Replace
          </span>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-slate-100">
        {showWordDiff
          ? segments.map((seg, i) => {
              if (seg.type === 'delete') {
                return (
                  <del
                    key={i}
                    className="mr-0.5 rounded bg-rose-500/15 px-0.5 text-rose-300/90 line-through"
                  >
                    {seg.value}
                  </del>
                );
              }
              if (seg.type === 'insert') {
                return (
                  <ins
                    key={i}
                    className="rounded bg-emerald-500/20 px-0.5 font-medium text-emerald-200 no-underline"
                  >
                    {seg.value}
                  </ins>
                );
              }
              return <span key={i}>{seg.value}</span>;
            })
          : item.text}
      </p>
    </div>
  );
};

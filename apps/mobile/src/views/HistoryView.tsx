import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Star,
  Trash2,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox
} from 'lucide-react';
import {
  loadHistory,
  toggleFavoriteEntry,
  deleteHistoryEntry,
  clearAllHistory,
  type HistoryItem
} from '../services/localHistoryDb.js';
import { shareToWhatsApp, triggerHaptic, writeClipboardText } from '../services/mobileBridge.js';

export const HistoryView: React.FC = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  const filtered = items.filter((item) => {
    if (filterStarredOnly && !item.isFavorite) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inOriginal = item.originalText.toLowerCase().includes(q);
    const inSuggestions = item.suggestions.some((s) => s.text.toLowerCase().includes(q));
    return inOriginal || inSuggestions;
  });

  const handleToggleStar = (id: string) => {
    triggerHaptic('light');
    const updated = toggleFavoriteEntry(id);
    setItems(updated);
  };

  const handleDelete = (id: string) => {
    triggerHaptic('medium');
    const updated = deleteHistoryEntry(id);
    setItems(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all saved history? This cannot be undone.')) {
      triggerHaptic('medium');
      clearAllHistory();
      setItems([]);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await writeClipboardText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0b141a] px-3 py-3">
      {/* Search & Filter Header */}
      <div className="space-y-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved drafts..."
            className="w-full bg-[#1f2c34] text-xs text-[#e9edef] placeholder-[#8696a0] pl-9 pr-3 py-2 rounded-xl border border-[#222e35] focus:outline-none focus:border-[#00a884]/50"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex space-x-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setFilterStarredOnly(false);
              }}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                !filterStarredOnly
                  ? 'bg-[#00a884] text-[#111b21]'
                  : 'bg-[#1f2c34] text-[#8696a0]'
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setFilterStarredOnly(true);
              }}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full font-medium transition-all ${
                filterStarredOnly
                  ? 'bg-[#fbbf24] text-[#111b21]'
                  : 'bg-[#1f2c34] text-[#8696a0]'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Starred</span>
            </button>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[#8696a0] hover:text-rose-400 text-[11px] transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* List Stream */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#8696a0]">
          <Inbox className="w-10 h-10 mb-2 opacity-50 stroke-[1.5]" />
          <p className="text-sm font-medium text-[#e9edef]">No Saved Rewrites</p>
          <p className="text-xs mt-1">
            {searchQuery
              ? 'No results matched your search.'
              : 'Messages you refine in the chat tab will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 pb-6">
          {filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const bestSuggestion = item.suggestions[0]?.text || '';
            const dateStr = new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            }).format(new Date(item.timestamp));

            return (
              <div
                key={item.id}
                className="bg-[#1f2c34] rounded-2xl p-3 border border-[#222e35] shadow-sm transition-all"
              >
                {/* Header line */}
                <div className="flex items-center justify-between text-[11px] text-[#8696a0] mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-medium text-[#00a884]">{dateStr}</span>
                    <span className="uppercase text-[9px] px-1 rounded bg-[#0b141a] text-[#8696a0]">
                      {item.detectedLanguage}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleToggleStar(item.id)}
                      className={`p-1 rounded-full transition-colors ${
                        item.isFavorite
                          ? 'text-[#fbbf24] bg-[#fbbf24]/10'
                          : 'text-[#8696a0] hover:text-[#e9edef]'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-[#8696a0] hover:text-rose-400 rounded-full transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Original snippet */}
                <p className="text-xs text-[#8696a0] line-clamp-1 italic mb-1">
                  &ldquo;{item.originalText}&rdquo;
                </p>

                {/* Refined snippet */}
                <p className="text-xs text-[#e9edef] font-medium leading-relaxed">
                  {bestSuggestion}
                </p>

                {/* Quick actions line */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#222e35]/60 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setExpandedId(isExpanded ? null : item.id);
                    }}
                    className="flex items-center space-x-1 text-[11px] text-[#00a884] hover:underline"
                  >
                    <span>{isExpanded ? 'Hide Options' : 'View All 3 Options'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(bestSuggestion, item.id)}
                      className="p-1.5 rounded-lg bg-[#2a3942] text-[#e9edef] hover:bg-[#32424b] text-[11px] flex items-center gap-1 active:scale-95 transition-all"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-[#00a884]" />
                      ) : (
                        <Copy className="w-3 h-3 text-[#8696a0]" />
                      )}
                      <span>Copy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => shareToWhatsApp(bestSuggestion)}
                      className="p-1.5 px-2 rounded-lg bg-[#00a884] text-[#111b21] hover:bg-[#029676] text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Expanded options view */}
                {isExpanded && (
                  <div className="mt-3 pt-2 border-t border-[#2a3942] space-y-2 animate-slide-up">
                    {item.suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="bg-[#111b21] rounded-xl p-2.5 border border-[#222e35]"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-[#00a884]">
                            {s.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => shareToWhatsApp(s.text)}
                            className="text-[10px] text-[#8696a0] hover:text-[#00a884] flex items-center gap-1"
                          >
                            <Share2 className="w-2.5 h-2.5" />
                            <span>Share</span>
                          </button>
                        </div>
                        <p className="text-xs text-[#e9edef] select-text">{s.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

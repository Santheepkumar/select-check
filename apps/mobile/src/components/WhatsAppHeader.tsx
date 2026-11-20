import React from 'react';
import { CheckCircle2, History, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import type { QuotaInfo, Slot3Preset } from '@select-check/shared';
import { SLOT3_PRESET_MAP } from '@select-check/shared';

export type MobileTab = 'chat' | 'history' | 'permissions' | 'settings';

interface WhatsAppHeaderProps {
  currentTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  quota: QuotaInfo;
  activePreset: Slot3Preset;
  isBackgroundActive: boolean;
}

export const WhatsAppHeader: React.FC<WhatsAppHeaderProps> = ({
  currentTab,
  onSelectTab,
  quota,
  activePreset,
  isBackgroundActive
}) => {
  const presetLabel = SLOT3_PRESET_MAP[activePreset]?.label || 'Professional';

  return (
    <header className="sticky top-0 z-40 bg-[#1f2c34] border-b border-[#222e35] safe-top px-3 py-2.5 shadow-md flex items-center justify-between">
      {/* Brand & Status */}
      <div className="flex items-center space-x-2.5">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#008069] to-[#00a884] flex items-center justify-center text-white shadow">
            <CheckCircle2 className="w-5 h-5 text-white stroke-[2.2]" />
          </div>
          {isBackgroundActive && (
            <span
              title="Background Floating Logo Active"
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#25d366] border-2 border-[#1f2c34] rounded-full animate-pulse"
            />
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <h1 className="text-sm font-semibold text-[#e9edef] tracking-wide">
              SelectCheck
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#00a884]/20 text-[#00a884] font-medium border border-[#00a884]/30">
              Mobile
            </span>
          </div>
          <p className="text-[11px] text-[#8696a0] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#00a884]" />
            <span className="truncate max-w-[130px]">{presetLabel}</span>
            <span className="text-[#8696a0]/60">•</span>
            <span className="text-[10px] text-[#8696a0]">
              {quota.tier === 'unlimited_byok'
                ? 'BYOK'
                : `${quota.used}/${quota.limit}`}
            </span>
          </p>
        </div>
      </div>

      {/* Tab Switcher Icons */}
      <nav className="flex items-center space-x-1">
        <button
          onClick={() => onSelectTab('chat')}
          className={`p-2 rounded-full transition-all ${
            currentTab === 'chat'
              ? 'bg-[#00a884] text-[#111b21]'
              : 'text-[#8696a0] hover:text-[#e9edef] active:scale-95'
          }`}
          title="Compose & Refine"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTab('history')}
          className={`p-2 rounded-full transition-all relative ${
            currentTab === 'history'
              ? 'bg-[#00a884] text-[#111b21]'
              : 'text-[#8696a0] hover:text-[#e9edef] active:scale-95'
          }`}
          title="Saved History"
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTab('permissions')}
          className={`p-2 rounded-full transition-all relative ${
            currentTab === 'permissions'
              ? 'bg-[#00a884] text-[#111b21]'
              : 'text-[#8696a0] hover:text-[#e9edef] active:scale-95'
          }`}
          title="Background Floating Permission"
        >
          <ShieldCheck className="w-4 h-4" />
          {isBackgroundActive && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#25d366] rounded-full" />
          )}
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className={`p-2 rounded-full transition-all ${
            currentTab === 'settings'
              ? 'bg-[#00a884] text-[#111b21]'
              : 'text-[#8696a0] hover:text-[#e9edef] active:scale-95'
          }`}
          title="Settings & Persona"
        >
          <Settings className="w-4 h-4" />
        </button>
      </nav>
    </header>
  );
};

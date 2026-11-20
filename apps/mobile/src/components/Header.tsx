import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import type { QuotaInfo } from '@select-check/shared';
import { triggerHaptic } from '../services/mobileBridge.js';
import type { MobileTab } from './BottomNav.js';

interface HeaderProps {
  quota: QuotaInfo;
  isBackgroundActive: boolean;
  onOpenPermissions: () => void;
  currentTab: MobileTab;
}

export const Header: React.FC<HeaderProps> = ({
  quota,
  isBackgroundActive,
  onOpenPermissions
}) => {
  return (
    <header className="shrink-0 bg-[#111b21] border-b border-[#202c33] safe-top px-4 py-2.5 z-40">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#008069] to-[#00a884] flex items-center justify-center text-white shadow-md">
            <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="text-[15px] font-bold tracking-tight text-[#e9edef]">
                SelectCheck
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] font-semibold border border-[#00a884]/30">
                AI
              </span>
            </div>
          </div>
        </div>

        {/* Right Status & Quota */}
        <div className="flex items-center space-x-2">
          {/* Background Assistant Status Indicator */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenPermissions();
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              isBackgroundActive
                ? 'bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30'
                : 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] border border-[#2a3942]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackgroundActive ? 'bg-[#00a884] animate-pulse' : 'bg-[#8696a0]'
              }`}
            />
            <span>{isBackgroundActive ? 'Active in WhatsApp' : 'Setup Overlay'}</span>
          </button>

          {/* Quota Pill */}
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#202c33] text-[#8696a0] text-[11px] font-medium border border-[#2a3942]">
            <Sparkles className="w-3 h-3 text-[#00a884]" />
            <span>
              {quota.tier === 'unlimited_byok'
                ? 'BYOK'
                : `${quota.limit - quota.used} left`}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

import React from 'react';
import { Sparkles, History, Settings } from 'lucide-react';
import { triggerHaptic } from '../services/mobileBridge.js';

export type MobileTab = 'refine' | 'history' | 'settings' | 'permissions';

interface BottomNavProps {
  currentTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    {
      id: 'refine' as MobileTab,
      label: 'Refine',
      icon: Sparkles
    },
    {
      id: 'history' as MobileTab,
      label: 'History',
      icon: History
    },
    {
      id: 'settings' as MobileTab,
      label: 'Settings',
      icon: Settings
    }
  ];

  return (
    <nav className="shrink-0 bg-[#111b21] border-t border-[#202c33] safe-bottom px-4 py-1.5 z-40">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            currentTab === tab.id ||
            (tab.id === 'settings' && currentTab === 'permissions');

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onSelectTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center py-1 px-5 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-[#00a884]'
                  : 'text-[#8696a0] hover:text-[#e9edef]'
              }`}
            >
              <div
                className={`p-1 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-[#00a884]/15' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'font-semibold text-[#00a884]' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

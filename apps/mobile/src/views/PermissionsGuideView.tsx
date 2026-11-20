import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import {
  getStoredPermissions,
  savePermissions,
  triggerHaptic,
  type PermissionStatus
} from '../services/mobileBridge.js';
import { FloatingLogoSimulator } from '../components/FloatingLogoSimulator.js';

interface PermissionsGuideViewProps {
  onPermissionsChanged: (perms: PermissionStatus) => void;
}

export const PermissionsGuideView: React.FC<PermissionsGuideViewProps> = ({
  onPermissionsChanged
}) => {
  const [perms, setPerms] = useState<PermissionStatus>({
    overlayGranted: true,
    accessibilityGranted: true,
    batteryOptimizationsIgnored: true
  });

  useEffect(() => {
    setPerms(getStoredPermissions());
  }, []);

  const handleToggle = (key: keyof PermissionStatus) => {
    triggerHaptic('medium');
    const updated = { ...perms, [key]: !perms[key] };
    setPerms(updated);
    savePermissions(updated);
    onPermissionsChanged(updated);
  };

  const isAllActive = perms.overlayGranted && perms.accessibilityGranted;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0b141a] px-3 py-3 space-y-4">
      {/* Banner */}
      <div className="bg-[#1f2c34] rounded-2xl p-4 border border-[#222e35] shadow-md">
        <div className="flex items-center space-x-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#e9edef]">
              Background & Floating Logo Setup
            </h2>
            <p className="text-[11px] text-[#8696a0]">
              Enable permissions so SelectCheck automatically refines text selected in WhatsApp.
            </p>
          </div>
        </div>

        <div
          className={`flex items-center space-x-2 p-2.5 rounded-xl border mt-3 text-xs ${
            isAllActive
              ? 'bg-[#00a884]/10 border-[#00a884]/30 text-[#00a884]'
              : 'bg-[#fbbf24]/10 border-[#fbbf24]/30 text-[#fbbf24]'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            {isAllActive
              ? 'Background Service is Ready & Running'
              : 'Permissions Needed to Show Floating Ball Over WhatsApp'}
          </span>
        </div>
      </div>

      {/* Permissions Toggles List */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider px-1">
          Required Android Permissions
        </h3>

        {/* 1. Display Over Other Apps */}
        <div className="bg-[#1f2c34] rounded-2xl p-3.5 border border-[#222e35] flex items-center justify-between">
          <div className="flex items-start space-x-3 pr-2">
            <div className="w-7 h-7 rounded-lg bg-[#2a3942] flex items-center justify-center text-[#00a884] shrink-0 mt-0.5">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#e9edef] flex items-center gap-1.5">
                <span>Display Over Other Apps</span>
                {perms.overlayGranted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884]" />
                )}
              </div>
              <p className="text-[11px] text-[#8696a0] mt-0.5 leading-relaxed">
                Allows SelectCheck to draw the floating logo near your cursor when typing or selecting text in WhatsApp.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggle('overlayGranted')}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
              perms.overlayGranted ? 'bg-[#00a884]' : 'bg-[#2a3942]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                perms.overlayGranted ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* 2. Accessibility Service */}
        <div className="bg-[#1f2c34] rounded-2xl p-3.5 border border-[#222e35] flex items-center justify-between">
          <div className="flex items-start space-x-3 pr-2">
            <div className="w-7 h-7 rounded-lg bg-[#2a3942] flex items-center justify-center text-[#53bdeb] shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#e9edef] flex items-center gap-1.5">
                <span>Accessibility Service</span>
                {perms.accessibilityGranted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884]" />
                )}
              </div>
              <p className="text-[11px] text-[#8696a0] mt-0.5 leading-relaxed">
                Detects text selection gestures in any app and enables automatic in-place text replacement.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggle('accessibilityGranted')}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
              perms.accessibilityGranted ? 'bg-[#00a884]' : 'bg-[#2a3942]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                perms.accessibilityGranted ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* 3. Battery Optimization Bypass */}
        <div className="bg-[#1f2c34] rounded-2xl p-3.5 border border-[#222e35] flex items-center justify-between">
          <div className="flex items-start space-x-3 pr-2">
            <div className="w-7 h-7 rounded-lg bg-[#2a3942] flex items-center justify-center text-[#fbbf24] shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#e9edef] flex items-center gap-1.5">
                <span>Ignore Battery Optimizations</span>
                {perms.batteryOptimizationsIgnored && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884]" />
                )}
              </div>
              <p className="text-[11px] text-[#8696a0] mt-0.5 leading-relaxed">
                Prevents Android from putting the background listener to sleep when your screen is locked.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggle('batteryOptimizationsIgnored')}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
              perms.batteryOptimizationsIgnored ? 'bg-[#00a884]' : 'bg-[#2a3942]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                perms.batteryOptimizationsIgnored ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Interactive Floating Ball Simulator */}
      <FloatingLogoSimulator />

      {/* iOS Sandboxing Notice */}
      <div className="bg-[#1f2c34]/70 rounded-xl p-3 border border-[#222e35] text-[11px] text-[#8696a0] flex items-start space-x-2">
        <Info className="w-4 h-4 text-[#53bdeb] shrink-0 mt-0.5" />
        <p>
          <strong className="text-[#e9edef]">On iPhones (iOS):</strong> Apple does not permit third-party overlays across apps. On iOS, you use the{' '}
          <strong className="text-[#00a884]">SelectCheck Keyboard</strong> or tap{' '}
          <strong className="text-[#00a884]">Share &gt; SelectCheck</strong> to refine messages.
        </p>
      </div>
    </div>
  );
};

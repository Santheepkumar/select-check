import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Smartphone
} from 'lucide-react';
import {
  getStoredPermissions,
  savePermissions,
  openNativeAccessibilitySettings,
  openNativeOverlaySettings,
  openNativeAppDetailsSettings,
  toggleNativeFloatingBubble,
  isAndroidNativeAvailable,
  triggerHaptic,
  type PermissionStatus
} from '../services/mobileBridge.js';

interface PermissionsGuideViewProps {
  onPermissionsChanged: (perms: PermissionStatus) => void;
}

export const PermissionsGuideView: React.FC<PermissionsGuideViewProps> = ({
  onPermissionsChanged
}) => {
  const [perms, setPerms] = useState<PermissionStatus>(getStoredPermissions());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isNative = isAndroidNativeAvailable();

  const refreshPermissions = () => {
    setIsRefreshing(true);
    triggerHaptic('light');
    const updated = getStoredPermissions();
    setPerms(updated);
    onPermissionsChanged(updated);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    refreshPermissions();
    window.__SELECTCHECK_REFRESH_PERMS__ = refreshPermissions;
    return () => {
      window.__SELECTCHECK_REFRESH_PERMS__ = undefined;
    };
  }, []);

  const handleToggleBubble = () => {
    triggerHaptic('medium');
    const newState = !perms.isBubbleRunning;
    toggleNativeFloatingBubble(newState);
    const updated = { ...perms, isBubbleRunning: newState };
    setPerms(updated);
    savePermissions(updated);
    onPermissionsChanged(updated);
  };

  const isAllActive = perms.accessibilityGranted;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 space-y-4 mobile-scrollbar pb-10">
      {/* Top Header Card */}
      <div className="bg-[#111b21] rounded-2xl p-4 border border-[#202c33] shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#e9edef]">
                Background Setup & Permissions
              </h2>
              <p className="text-[11px] text-[#8696a0]">
                Configure Android to show the floating logo over WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshPermissions}
            className={`p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] transition-all active:scale-95 ${
              isRefreshing ? 'animate-spin text-[#00a884]' : ''
            }`}
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Status Alert Banner */}
        <div
          className={`flex items-center space-x-2.5 p-3 rounded-xl border text-xs ${
            isAllActive
              ? 'bg-[#00a884]/15 border-[#00a884]/30 text-[#00a884]'
              : 'bg-[#fbbf24]/15 border-[#fbbf24]/30 text-[#fbbf24]'
          }`}
        >
          {isAllActive ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00a884]" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#fbbf24]" />
          )}
          <span className="font-medium text-[12px] leading-snug">
            {isAllActive
              ? 'Ready! Floating "✨ Refine" button is active across apps.'
              : 'Action needed in Android Settings to activate the floating logo.'}
          </span>
        </div>
      </div>

      {/* Android 13/14/15 Notice Box */}
      <div className="bg-[#1f2c34]/70 rounded-2xl p-3.5 border border-[#222e35] space-y-2">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#53bdeb]">
          <HelpCircle className="w-4 h-4" />
          <span>Is the setting grayed out? (Restricted setting)</span>
        </div>
        <p className="text-[11px] text-[#8696a0] leading-relaxed">
          On Android 13, 14, and 15, sideloaded apps require one quick approval:
          Tap below to open <strong className="text-[#e9edef]">App Info</strong>, tap the{' '}
          <strong className="text-[#e9edef]">three dots (⋮)</strong> in the top-right corner, and select{' '}
          <strong className="text-[#00a884]">"Allow restricted settings"</strong>.
        </p>
        <button
          type="button"
          onClick={openNativeAppDetailsSettings}
          className="w-full py-2 px-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[#53bdeb] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors active:scale-98"
        >
          <span>Open App Info (Allow Restricted Settings)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Permissions Steps */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider px-1">
          Required System Permissions
        </h3>

        {/* 1. Accessibility Service */}
        <div className="bg-[#111b21] rounded-2xl p-4 border border-[#202c33] shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 pr-2">
              <div className="w-8 h-8 rounded-xl bg-[#202c33] flex items-center justify-center text-[#00a884] shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#e9edef]">
                    1. Accessibility Service
                  </span>
                  {perms.accessibilityGranted ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] text-[10px] font-bold border border-[#00a884]/30">
                      ENABLED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#ef4444]/20 text-[#ef4444] text-[10px] font-bold border border-[#ef4444]/30">
                      NOT ENABLED
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8696a0] mt-1 leading-relaxed">
                  Listens for text selection gestures and copied text in WhatsApp and displays the instant floating suggestion pill.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openNativeAccessibilitySettings}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-98 ${
              perms.accessibilityGranted
                ? 'bg-[#202c33] text-[#e9edef] hover:bg-[#2a3942]'
                : 'bg-gradient-to-r from-[#00a884] to-[#059669] text-[#111b21] shadow-md shadow-[#00a884]/20 font-bold'
            }`}
          >
            <span>{perms.accessibilityGranted ? 'Manage in Android Settings' : 'Turn On in Android Settings'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Display Over Other Apps */}
        <div className="bg-[#111b21] rounded-2xl p-4 border border-[#202c33] shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 pr-2">
              <div className="w-8 h-8 rounded-xl bg-[#202c33] flex items-center justify-center text-[#53bdeb] shrink-0 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#e9edef]">
                    2. Display Over Other Apps
                  </span>
                  {perms.overlayGranted ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] text-[10px] font-bold border border-[#00a884]/30">
                      ALLOWED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#ef4444]/20 text-[#ef4444] text-[10px] font-bold border border-[#ef4444]/30">
                      OPTIONAL
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8696a0] mt-1 leading-relaxed">
                  Allows SelectCheck to draw the floating pill and assistant bubble freely on top of WhatsApp and other apps.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openNativeOverlaySettings}
            className="w-full py-2.5 px-3 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-98"
          >
            <span>Configure Overlay Permission</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. Persistent Draggable Floating Bubble */}
        <div className="bg-[#111b21] rounded-2xl p-4 border border-[#202c33] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3 pr-2">
              <div className="w-8 h-8 rounded-xl bg-[#202c33] flex items-center justify-center text-[#fbbf24] shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#e9edef] block">
                  Floating Assistant Bubble
                </span>
                <p className="text-[11px] text-[#8696a0] mt-0.5 leading-relaxed">
                  Keep a permanent draggable ✨ bubble at the edge of your screen while using WhatsApp.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleBubble}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                perms.isBubbleRunning ? 'bg-[#00a884]' : 'bg-[#2a3942]'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  perms.isBubbleRunning ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Alternative: Native Text Selection Toolbar Info */}
      <div className="bg-[#111b21] rounded-2xl p-3.5 border border-[#202c33] flex items-start space-x-3">
        <Smartphone className="w-5 h-5 text-[#00a884] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-[#e9edef]">
            Native Android Context Menu is Always Ready
          </h4>
          <p className="text-[11px] text-[#8696a0] leading-relaxed">
            Even without accessibility permissions, you can select any text anywhere on Android and choose{' '}
            <strong className="text-[#00a884]">"Refine with SelectCheck"</strong> directly from the native popup menu (next to Copy/Share)!
          </p>
        </div>
      </div>
    </div>
  );
};

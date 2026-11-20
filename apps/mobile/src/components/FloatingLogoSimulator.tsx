import React, { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Smartphone,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { triggerHaptic } from '../services/mobileBridge.js';

export const FloatingLogoSimulator: React.FC = () => {
  const [selectedText, setSelectedText] = useState('Hey, r u comming to the meating tmrw?');
  const [showFloatingBall, setShowFloatingBall] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [overlayActive, setOverlayActive] = useState(true);

  const sampleSuggestions = [
    { label: 'Fix Grammar', text: 'Hey, are you coming to the meeting tomorrow?' },
    { label: 'Clear & Concise', text: 'Are you attending tomorrow’s meeting?' },
    { label: 'Professional', text: 'Good day, will you be attending the meeting scheduled for tomorrow?' }
  ];

  const handleApply = (newText: string) => {
    triggerHaptic('success');
    setSelectedText(newText);
    setShowPopup(false);
    setShowFloatingBall(false);
  };

  const handleReset = () => {
    triggerHaptic('light');
    setSelectedText('Hey, r u comming to the meating tmrw?');
    setShowFloatingBall(true);
    setShowPopup(false);
  };

  return (
    <div className="bg-[#111b21] rounded-2xl p-4 border border-[#222e35] shadow-xl my-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222e35]">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-4 h-4 text-[#00a884]" />
          <h3 className="text-sm font-semibold text-[#e9edef]">
            Android Floating Logo & Auto-Replace Simulator
          </h3>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="p-1 text-[#8696a0] hover:text-[#e9edef] transition-colors"
          title="Reset Test"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-[#8696a0] my-2 leading-relaxed">
        See how SelectCheck works in the background over WhatsApp when you grant Android
        <span className="text-[#00a884] font-medium"> Accessibility</span> and{' '}
        <span className="text-[#00a884] font-medium">Display Over Other Apps</span>.
      </p>

      {/* Simulated Mobile WhatsApp Chat Frame */}
      <div className="relative mt-3 rounded-xl bg-[#0b141a] border border-[#222e35] overflow-hidden min-h-[220px] p-3 flex flex-col justify-between">
        {/* Fake WhatsApp Header */}
        <div className="bg-[#1f2c34] -mx-3 -mt-3 px-3 py-2 border-b border-[#222e35] flex items-center justify-between text-xs text-[#e9edef]">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-[10px] text-white">
              JD
            </div>
            <div>
              <div className="font-medium text-[11px]">Alex Rivers</div>
              <div className="text-[9px] text-[#00a884]">online</div>
            </div>
          </div>
          <span className="text-[10px] text-[#8696a0]">WhatsApp</span>
        </div>

        {/* Incoming Bubble */}
        <div className="my-3">
          <div className="bg-[#202c33] text-[#e9edef] rounded-lg rounded-tl-none p-2 text-xs max-w-[80%] inline-block">
            Let me know your availability for tomorrow!
          </div>
        </div>

        {/* Outgoing WhatsApp Composer with Text Selection */}
        <div className="relative mt-auto">
          <div className="bg-[#1f2c34] rounded-xl p-2.5 border border-[#2a3942] flex items-center justify-between text-xs text-[#e9edef]">
            <span className="bg-[#00a884]/30 text-white rounded px-1 py-0.5 select-text font-normal">
              {selectedText}
            </span>
          </div>

          {/* Floating SelectCheck Logo (Android Overlay) */}
          {overlayActive && showFloatingBall && !showPopup && (
            <div
              onClick={() => {
                triggerHaptic('medium');
                setShowPopup(true);
              }}
              className="absolute -top-10 right-4 cursor-pointer z-20 flex items-center space-x-1.5 bg-[#00a884] hover:bg-[#029676] text-white p-1.5 rounded-full shadow-2xl animate-pulse-glow transition-all active:scale-95"
              title="Tap to Refine with SelectCheck"
            >
              <div className="w-7 h-7 rounded-full bg-[#005c4b] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[#25d366]" />
              </div>
              <span className="text-[10px] font-bold pr-1.5 hidden sm:inline">Refine</span>
            </div>
          )}

          {/* Floating 3-Suggestion Card Over WhatsApp */}
          {showPopup && (
            <div className="absolute -top-44 right-0 left-0 bg-[#202c33] border border-[#00a884]/50 rounded-xl p-2.5 shadow-2xl z-30 animate-slide-up">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#2a3942]">
                <div className="flex items-center space-x-1 text-[11px] text-[#00a884] font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>SelectCheck Overlay</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPopup(false)}
                  className="text-[10px] text-[#8696a0] hover:text-[#e9edef]"
                >
                  Close
                </button>
              </div>

              <div className="space-y-1.5">
                {sampleSuggestions.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApply(item.text)}
                    className="w-full text-left p-1.5 rounded-lg bg-[#111b21] hover:bg-[#2a3942] border border-[#222e35] transition-all flex flex-col group active:scale-98"
                  >
                    <span className="text-[9px] text-[#00a884] font-medium uppercase tracking-wider">
                      {item.label} (Tap to Replace in WhatsApp)
                    </span>
                    <span className="text-xs text-[#e9edef] group-hover:text-white line-clamp-1">
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Permissions status indicator */}
      <div className="flex items-center justify-between pt-3 mt-2 text-[11px] text-[#8696a0]">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
          <span>Status: Accessibility & Overlay Active</span>
        </span>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setOverlayActive(!overlayActive);
          }}
          className="text-[#00a884] hover:underline"
        >
          {overlayActive ? 'Disable Overlay' : 'Enable Overlay'}
        </button>
      </div>
    </div>
  );
};

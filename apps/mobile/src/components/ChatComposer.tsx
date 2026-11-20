import React, { useRef, useEffect } from 'react';
import { ArrowUp, ClipboardCopy, Loader2, X } from 'lucide-react';
import { readClipboardText, triggerHaptic } from '../services/mobileBridge.js';

interface ChatComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content (up to 120px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handlePaste = async () => {
    triggerHaptic('light');
    const text = await readClipboardText();
    if (text) {
      onChange(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <div className="sticky bottom-0 z-30 bg-[#202c33] border-t border-[#222e35] p-2.5 safe-bottom">
      {/* Quick Paste Pill if input is empty */}
      {!value && (
        <div className="flex items-center justify-between pb-2 px-1">
          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center space-x-1.5 text-xs text-[#00a884] bg-[#00a884]/10 hover:bg-[#00a884]/20 border border-[#00a884]/30 px-3 py-1 rounded-full transition-all active:scale-95 shadow-sm"
          >
            <ClipboardCopy className="w-3.5 h-3.5" />
            <span>Paste from WhatsApp</span>
          </button>
          <span className="text-[11px] text-[#8696a0]">
            Grammar • Concise • Tone
          </span>
        </div>
      )}

      {/* Input container */}
      <div className="flex items-end space-x-2">
        <div className="flex-1 bg-[#2a3942] rounded-2xl flex items-center px-3.5 py-1.5 border border-transparent focus-within:border-[#00a884]/50 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type or paste a message..."
            className="w-full bg-transparent text-[#e9edef] placeholder-[#8696a0] text-sm resize-none focus:outline-none max-h-[120px] leading-relaxed"
          />

          {value && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onChange('');
              }}
              className="p-1 text-[#8696a0] hover:text-[#e9edef] ml-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          disabled={!value.trim() || isLoading}
          onClick={() => {
            triggerHaptic('medium');
            onSubmit();
          }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
            value.trim() && !isLoading
              ? 'bg-[#00a884] text-[#111b21] active:scale-95 hover:bg-[#029676]'
              : 'bg-[#2a3942] text-[#8696a0] cursor-not-allowed opacity-60'
          }`}
          title="Refine Message"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#00a884]" />
          ) : (
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          )}
        </button>
      </div>
    </div>
  );
};

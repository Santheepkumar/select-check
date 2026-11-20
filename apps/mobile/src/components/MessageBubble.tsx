import React from 'react';
import { CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  text: string;
  timestamp?: number;
  detectedLanguage?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  timestamp = Date.now(),
  detectedLanguage
}) => {
  const timeFormatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(new Date(timestamp));

  return (
    <div className="flex justify-end my-3 px-3 animate-slide-up">
      <div className="relative max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-xs px-3.5 pt-2 pb-1.5 shadow-md border border-[#005c4b]/80">
        {/* Original text content */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed select-text font-normal text-white">
          {text}
        </p>

        {/* Footer info: Language tag, timestamp, and WhatsApp blue double ticks */}
        <div className="flex items-center justify-end space-x-1.5 mt-1 text-[11px] text-[#8696a0]">
          {detectedLanguage && (
            <span className="text-[10px] uppercase font-mono px-1 rounded bg-[#0b141a]/40 text-[#8696a0]">
              {detectedLanguage}
            </span>
          )}
          <span>{timeFormatted}</span>
          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] stroke-[2.2]" />
        </div>
      </div>
    </div>
  );
};

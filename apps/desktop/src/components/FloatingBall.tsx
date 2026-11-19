import { Sparkles } from 'lucide-react';
import React from 'react';

interface FloatingBallProps {
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const FloatingBall: React.FC<FloatingBallProps> = ({
  onClick,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <div className="flex h-12 w-12 items-center justify-center p-0">
      <button
        type="button"
        onPointerDown={(e) => {
          // Intercept pointerdown immediately on first touch (bypasses macOS unfocused-window click swallowing)
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        title="Click to polish with SelectCheck (or hotkey)"
        aria-label="Check Grammar and Refine Text"
        className="animate-ball-pop group relative flex h-9 w-9 cursor-pointer select-none items-center justify-center rounded-full bg-[#0c0d12]/95 text-white border border-white/20 shadow-md shadow-black/60 transform-gpu will-change-transform transition-[transform,border-color,box-shadow] duration-150 hover:scale-110 hover:border-indigo-400/90 hover:shadow-indigo-500/30 active:scale-95"
      >
        {/* Subtle glass reflection highlight */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.18] to-transparent pointer-events-none" />

        {/* Ambient glow on hover */}
        <span className="absolute -inset-0.5 rounded-full bg-indigo-500/30 opacity-0 blur-xs transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />

        {/* Crisp Sparkles Icon (Full size, perfectly centered) */}
        <Sparkles className="relative h-4 w-4 text-indigo-300 transition-transform duration-200 group-hover:scale-110 group-hover:text-indigo-200" />
      </button>
    </div>
  );
};

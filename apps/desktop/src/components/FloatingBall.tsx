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
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title="Check Grammar & Improve (SelectCheck)"
      aria-label="Check Grammar & Improve"
      className="animate-ball-pop group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-white/25 transition-all duration-150 hover:scale-110 hover:shadow-indigo-500/60 hover:ring-white/50 active:scale-95"
    >
      <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping opacity-40 group-hover:opacity-0" />
      <Sparkles className="relative h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
    </button>
  );
};

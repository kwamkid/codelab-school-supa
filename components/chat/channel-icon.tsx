'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatChannelType } from '@/types/models';

interface ChannelIconProps {
  type: ChatChannelType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 text-[8px]',
  md: 'w-6 h-6 text-[10px]',
  lg: 'w-8 h-8 text-xs',
};

export function ChannelIcon({ type, size = 'md', className }: ChannelIconProps) {
  const sizeClasses = sizeMap[size];

  if (type === 'line') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-[#06C755] text-white font-bold',
          sizeClasses,
          className
        )}
      >
        <span className="leading-none">L</span>
      </div>
    );
  }

  if (type === 'facebook') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-[#0084FF] text-white font-bold',
          sizeClasses,
          className
        )}
      >
        <span className="leading-none">M</span>
      </div>
    );
  }

  if (type === 'instagram') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white font-bold',
          sizeClasses,
          className
        )}
      >
        <span className="leading-none">IG</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gray-400 text-white',
        sizeClasses,
        className
      )}
    >
      <MessageCircle className="w-3/5 h-3/5" />
    </div>
  );
}

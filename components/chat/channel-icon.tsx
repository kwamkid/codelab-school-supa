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
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const iconSrc: Record<string, string> = {
  line: '/social/line_oa.svg',
  facebook: '/social/facebook.svg',
  instagram: '/social/instagram.svg',
};

export function ChannelIcon({ type, size = 'md', className }: ChannelIconProps) {
  const sizeClasses = sizeMap[size];
  const src = iconSrc[type];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={type}
        className={cn(sizeClasses, 'rounded-full shrink-0', className)}
      />
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

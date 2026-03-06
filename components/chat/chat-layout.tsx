'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Responsive chat split-view layout.
 *
 * Desktop (lg+):  [list 300px] | [messages flex-1] | [panel 320px]
 * Tablet (md-lg): [list 280px] | [messages flex-1]
 * Mobile (<md):   Show ONE view at a time based on `mobileView`
 */

export type MobileView = 'list' | 'messages' | 'panel';

interface ChatSplitViewProps {
  mobileView: MobileView;
  list: ReactNode;
  messages: ReactNode;
  panel: ReactNode;
  className?: string;
}

export function ChatSplitView({
  mobileView,
  list,
  messages,
  panel,
  className,
}: ChatSplitViewProps) {
  return (
    <div className={cn('flex h-full w-full overflow-hidden bg-white', className)}>
      {/* Left: Conversation list */}
      <div
        className={cn(
          'flex-col overflow-hidden border-r',
          // Mobile: show only when mobileView === 'list'
          mobileView === 'list' ? 'flex w-full' : 'hidden',
          // Tablet+: always show
          'md:flex md:w-[280px] lg:w-[300px] md:shrink-0'
        )}
      >
        {list}
      </div>

      {/* Center: Message area */}
      <div
        className={cn(
          'flex-col overflow-hidden min-w-0',
          // Mobile: show when mobileView is 'messages' or 'panel'
          mobileView !== 'list' ? 'flex flex-1' : 'hidden',
          // Tablet+: always show
          'md:flex md:flex-1'
        )}
      >
        {messages}
      </div>

      {/* Right: Action panel */}
      <div
        className={cn(
          'flex-col overflow-hidden border-l',
          // Mobile: show full width when mobileView === 'panel'
          mobileView === 'panel' ? 'flex w-full' : 'hidden',
          // Desktop (lg+): always show as sidebar
          'lg:flex lg:w-[320px] lg:shrink-0'
        )}
      >
        {panel}
      </div>
    </div>
  );
}

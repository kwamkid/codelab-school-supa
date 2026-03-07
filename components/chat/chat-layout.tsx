'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Responsive chat split-view layout.
 *
 * Desktop (xl+):  [list w-80(320px)] | [messages flex-1] | [panel w-[420px]]
 * Desktop (lg-xl):[list w-80(320px)] | [messages flex-1] | [panel w-[340px]]
 * Tablet (md-lg): [list w-80(320px)] | [messages flex-1]
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
    <div className={cn('flex h-full w-full overflow-hidden bg-white dark:bg-slate-900', className)}>
      {/* Left: Conversation list */}
      <div
        className={cn(
          'flex-col overflow-hidden border-r dark:border-slate-700',
          mobileView === 'list' ? 'flex w-full' : 'hidden',
          'md:flex md:w-80 md:shrink-0'
        )}
      >
        {list}
      </div>

      {/* Center: Message area */}
      <div
        className={cn(
          'flex-col overflow-hidden min-w-0',
          mobileView !== 'list' ? 'flex flex-1' : 'hidden',
          'md:flex md:flex-1'
        )}
      >
        {messages}
      </div>

      {/* Right: Action panel */}
      <div
        className={cn(
          'flex-col overflow-hidden border-l dark:border-slate-700',
          mobileView === 'panel' ? 'flex w-full' : 'hidden',
          'lg:flex lg:w-[340px] xl:w-[420px] lg:shrink-0'
        )}
      >
        {panel}
      </div>
    </div>
  );
}

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Responsive chat split-view layout.
 *
 * Wide (2xl+):     [list w-80(320px)] | [messages flex-1] | [panel w-[420px]]  (panel always visible)
 * Tablet→laptop (md-2xl): [list w-80(320px)] | [messages flex-1]  — info panel opens over the
 *                 message area on demand (toggle), so the chat is never squeezed. (The left app
 *                 nav also eats width, so we only pin the panel at 2xl.)
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

      {/* Center: Message area — hidden when the panel is open below 2xl */}
      <div
        className={cn(
          'flex-col overflow-hidden min-w-0',
          mobileView === 'messages' ? 'flex flex-1' : 'hidden',
          mobileView === 'panel' ? 'md:hidden' : 'md:flex md:flex-1',
          '2xl:flex 2xl:flex-1'
        )}
      >
        {messages}
      </div>

      {/* Right: Action panel — persistent at 2xl+, opens over the message area below 2xl */}
      <div
        className={cn(
          'flex-col overflow-hidden border-l dark:border-slate-700',
          mobileView === 'panel' ? 'flex flex-1 w-full md:w-auto' : 'hidden',
          '2xl:flex 2xl:w-[420px] 2xl:flex-none 2xl:shrink-0'
        )}
      >
        {panel}
      </div>
    </div>
  );
}

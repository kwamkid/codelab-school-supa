'use client';

import { MessageSquare, ArrowLeft, User, BookOpen, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChatConversation, ChatMessage, Branch } from '@/types/models';
import { ChannelIcon } from './channel-icon';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';

interface MessageAreaProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (content: string) => void;
  branches?: Branch[];
  /** Mobile: go back to conversation list */
  onBack?: () => void;
  /** Mobile: toggle action panel */
  onTogglePanel?: () => void;
  /** Load older messages */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Open trial booking form in panel */
  onTrialBooking?: () => void;
  /** Open enrollment form in panel */
  onEnrollment?: () => void;
}

const TAG_COLORS: Record<string, string> = {
  'สนใจเรียน': 'bg-green-100 text-green-700',
  'รอติดตาม': 'bg-yellow-100 text-yellow-700',
  'ทดลองเรียน': 'bg-blue-100 text-blue-700',
  'ลงทะเบียน': 'bg-purple-100 text-purple-700',
  'ลูกค้าเก่า': 'bg-gray-100 text-gray-600',
  'VIP': 'bg-amber-100 text-amber-700',
};

export default function MessageArea({
  conversation,
  messages,
  loading,
  onSend,
  branches,
  onBack,
  onTogglePanel,
  hasMore,
  loadingMore,
  onLoadMore,
  onTrialBooking,
  onEnrollment,
}: MessageAreaProps) {
  // Empty state
  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-900">
        <MessageSquare className="w-16 h-16 mb-4 stroke-1" />
        <p className="text-base">เลือกแชทเพื่อเริ่มสนทนา</p>
      </div>
    );
  }

  const contact = conversation.contact;
  const channel = conversation.channel;
  const displayName = contact?.displayName || 'ไม่ทราบชื่อ';
  const tags = contact?.tags || [];
  const contactBranchIds = contact?.branchIds || [];
  const contactBranches = branches?.filter(b => contactBranchIds.includes(b.id)) || [];
  const hasBadges = tags.length > 0 || contactBranches.length > 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="px-3 py-2.5 border-b dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2">
          {/* Mobile back button */}
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="md:hidden shrink-0 -ml-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {displayName}
            </h2>
            {channel && (
              <ChannelIcon type={channel.type} size="sm" />
            )}
          </div>

          {/* Quick action buttons */}
          {onTrialBooking && (
            <button
              onClick={onTrialBooking}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 transition-colors"
              title="จองทดลองเรียน"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ทดลองเรียน</span>
            </button>
          )}
          {onEnrollment && (
            <button
              onClick={onEnrollment}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors"
              title="ลงทะเบียน"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ลงทะเบียน</span>
            </button>
          )}

          {/* Mobile: toggle action panel */}
          {onTogglePanel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePanel}
              className="lg:hidden shrink-0"
            >
              <User className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Tags + Branch badges */}
        {hasBadges && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {contactBranches.map((branch) => (
              <span
                key={branch.id}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                {branch.name}
              </span>
            ))}
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
                  TAG_COLORS[tag] || 'bg-gray-100 text-gray-600'
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        loading={loading}
        channelId={conversation.channelId}
        contactAvatarUrl={contact?.avatarUrl}
        contactName={displayName}
        isGroup={!!contact?.isGroup}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
      />

      {/* Input — never disabled, optimistic sending */}
      <MessageInput onSend={onSend} />
    </div>
  );
}

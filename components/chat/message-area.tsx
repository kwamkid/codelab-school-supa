'use client';

import { MessageSquare, ArrowLeft, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChatConversation, ChatMessage } from '@/types/models';
import { ChannelIcon } from './channel-icon';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { Badge } from '@/components/ui/badge';

interface MessageAreaProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (content: string) => void;
  sending: boolean;
  /** Mobile: go back to conversation list */
  onBack?: () => void;
  /** Mobile: toggle action panel */
  onTogglePanel?: () => void;
}

const statusLabels: Record<string, string> = {
  open: 'เปิด',
  assigned: 'รับแล้ว',
  resolved: 'แก้ไขแล้ว',
  archived: 'เก็บถาวร',
};

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  resolved: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export default function MessageArea({
  conversation,
  messages,
  loading,
  onSend,
  sending,
  onBack,
  onTogglePanel,
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b dark:border-slate-700 bg-white dark:bg-slate-800">
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
          <Badge
            variant="secondary"
            className={cn(
              'text-xs',
              statusColors[conversation.status] || 'bg-gray-100 text-gray-600'
            )}
          >
            {statusLabels[conversation.status] || conversation.status}
          </Badge>
        </div>

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

      {/* Messages */}
      <MessageList messages={messages} loading={loading} channelId={conversation.channelId} />

      {/* Input */}
      <MessageInput onSend={onSend} disabled={sending} />
    </div>
  );
}

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
  open: '\u0e40\u0e1b\u0e34\u0e14',
  assigned: '\u0e23\u0e31\u0e1a\u0e41\u0e25\u0e49\u0e27',
  resolved: '\u0e41\u0e01\u0e49\u0e44\u0e02\u0e41\u0e25\u0e49\u0e27',
  archived: '\u0e40\u0e01\u0e47\u0e1a\u0e16\u0e32\u0e27\u0e23',
};

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  assigned: 'bg-blue-100 text-blue-700',
  resolved: 'bg-gray-100 text-gray-700',
  archived: 'bg-gray-100 text-gray-500',
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
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <MessageSquare className="w-16 h-16 mb-4 stroke-1" />
        <p className="text-base">{'\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e0a\u0e17\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e2a\u0e19\u0e17\u0e19\u0e32'}</p>
      </div>
    );
  }

  const contact = conversation.contact;
  const channel = conversation.channel;
  const displayName = contact?.displayName || '\u0e44\u0e21\u0e48\u0e17\u0e23\u0e32\u0e1a\u0e0a\u0e37\u0e48\u0e2d';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b bg-white">
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
          <h2 className="text-base font-semibold text-gray-900 truncate">
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
      <MessageList messages={messages} loading={loading} />

      {/* Input */}
      <MessageInput onSend={onSend} disabled={sending} />
    </div>
  );
}

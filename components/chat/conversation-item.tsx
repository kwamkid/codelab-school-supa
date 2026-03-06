'use client';

import { cn } from '@/lib/utils';
import { ChatConversation } from '@/types/models';
import { ChannelIcon } from './channel-icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface ConversationItemProps {
  conversation: ChatConversation;
  isActive: boolean;
  onClick: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const d = date instanceof Date ? date : new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49';
  if (mins < 60) return `${mins} \u0e19\u0e32\u0e17\u0e35`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} \u0e0a\u0e21.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e27\u0e32\u0e19';
  return `${days} \u0e27\u0e31\u0e19`;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const contact = conversation.contact;
  const channel = conversation.channel;
  const displayName = contact?.displayName || 'ไม่ทราบชื่อ';
  const lastMessage = conversation.lastMessagePreview || '';
  const lastMessageAt = conversation.lastMessageAt;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
        isActive && 'bg-blue-50 border-l-2 border-blue-500',
        !isActive && 'border-l-2 border-transparent'
      )}
    >
      {/* Avatar with channel icon overlay */}
      <div className="relative shrink-0">
        <Avatar className="w-10 h-10">
          {contact?.avatarUrl ? (
            <AvatarImage src={contact.avatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback className="text-base bg-gray-200 text-gray-600">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        {/* Channel icon badge */}
        {channel && (
          <div className="absolute -bottom-0.5 -right-0.5">
            <ChannelIcon type={channel.type} size="sm" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-base truncate',
            conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
          )}>
            {displayName}
          </span>
          {lastMessageAt && (
            <span className="text-xs text-gray-400 shrink-0">
              {formatRelativeTime(lastMessageAt instanceof Date ? lastMessageAt : new Date(lastMessageAt as any))}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            'text-sm truncate',
            conversation.unreadCount > 0 ? 'text-gray-700' : 'text-gray-400'
          )}>
            {lastMessage || '\u00a0'}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold shrink-0">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

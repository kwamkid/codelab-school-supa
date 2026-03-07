'use client';

import { cn } from '@/lib/utils';
import { ChatConversation } from '@/types/models';
import { ChannelIcon } from './channel-icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LinkIcon, Users } from 'lucide-react';

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
  if (mins < 1) return 'ตอนนี้';
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'เมื่อวาน';
  return `${days} วัน`;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const TAG_COLORS: Record<string, string> = {
  'สนใจเรียน': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'รอติดตาม': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'ทดลองเรียน': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'ลงทะเบียน': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'ลูกค้าเก่า': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  'VIP': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const contact = conversation.contact;
  const channel = conversation.channel;
  const displayName = contact?.displayName || 'ไม่ทราบชื่อ';
  const lastMessage = conversation.lastMessagePreview || '';
  const lastMessageAt = conversation.lastMessageAt;
  const tags = contact?.tags || [];
  const isLinked = !!contact?.parentId;
  const isGroup = !!contact?.isGroup;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2 px-3 py-1.5 md:gap-3 md:px-4 md:py-2 text-left transition-colors',
        'hover:bg-gray-50 dark:hover:bg-slate-700/50',
        isActive && 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500',
        !isActive && 'border-l-2 border-transparent'
      )}
    >
      {/* Avatar with channel icon overlay */}
      <div className="relative shrink-0">
        <Avatar className="w-9 h-9 md:w-10 md:h-10">
          {contact?.avatarUrl ? (
            <AvatarImage src={contact.avatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback className={cn(
            'text-sm md:text-base',
            isGroup
              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'bg-gray-200 text-gray-600 dark:bg-slate-600 dark:text-gray-300'
          )}>
            {isGroup ? <Users className="w-4 h-4 md:w-5 md:h-5" /> : getInitials(displayName)}
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
          <div className="flex items-center gap-1 min-w-0">
            <span className={cn(
              'text-sm md:text-base truncate',
              conversation.unreadCount > 0
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'font-medium text-gray-700 dark:text-gray-300'
            )}>
              {displayName}
            </span>
            {isGroup && (
              <span className="px-1 py-0.5 rounded text-[9px] leading-none font-medium bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 shrink-0">
                กลุ่ม
              </span>
            )}
            {isLinked && (
              <LinkIcon className="w-3 h-3 text-green-500 shrink-0" />
            )}
          </div>
          {lastMessageAt && (
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {formatRelativeTime(lastMessageAt instanceof Date ? lastMessageAt : new Date(lastMessageAt as any))}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            'text-xs md:text-sm truncate font-[family-name:var(--font-chat)]',
            conversation.unreadCount > 0
              ? 'text-gray-700 dark:text-gray-300'
              : 'text-gray-400 dark:text-gray-500'
          )}>
            {lastMessage || '\u00a0'}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold shrink-0">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
        {/* Tag badges — show max 2 */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
                  getTagColor(tag)
                )}
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

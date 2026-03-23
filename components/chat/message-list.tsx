'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/models';
import { MessageBubble } from './message-bubble';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  channelId?: string;
  /** Contact avatar URL for inbound messages (1:1 chats) */
  contactAvatarUrl?: string;
  /** Contact display name for avatar fallback */
  contactName?: string;
  /** Whether this is a group conversation */
  isGroup?: boolean;
  /** Whether there are older messages to load */
  hasMore?: boolean;
  /** Loading more older messages */
  loadingMore?: boolean;
  /** Callback to load older messages */
  onLoadMore?: () => void;
  /** Number of unread messages — used to scroll to first unread */
  unreadCount?: number;
}

function formatDateSeparator(date: Date): string {
  const d = date instanceof Date ? date : new Date(date as any);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  const da = a instanceof Date ? a : new Date(a as any);
  const db = b instanceof Date ? b : new Date(b as any);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function SenderAvatar({ url, name, onClickAvatar }: { url?: string; name?: string; onClickAvatar?: (url: string) => void }) {
  const [error, setError] = useState(false);
  return (
    <Avatar
      className={cn('w-9 h-9 shrink-0', url && !error && 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow')}
      onClick={() => url && !error && onClickAvatar?.(url)}
    >
      {url && !error ? (
        <AvatarImage src={url} alt={name || ''} onError={() => setError(true)} />
      ) : null}
      <AvatarFallback className="text-xs bg-gray-200 text-gray-600 dark:bg-slate-600 dark:text-gray-300">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function MessageList({
  messages,
  loading,
  channelId,
  contactAvatarUrl,
  contactName,
  isGroup,
  hasMore,
  loadingMore,
  onLoadMore,
  unreadCount = 0,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadMarkerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Close lightbox on ESC
  useEffect(() => {
    if (!previewUrl) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewUrl(null); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewUrl]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior?: string) => {
    if (scrollRef.current) {
      if (behavior === 'smooth') {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, []);

  // Scroll to bottom on first render via ref callback on last element
  const lastMessageRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setTimeout(() => {
        if (unreadMarkerRef.current && prevMessageCountRef.current === 0) {
          unreadMarkerRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, []);

  // Track message count changes for new messages
  useEffect(() => {
    if (messages.length === 0) {
      prevMessageCountRef.current = 0;
      return;
    }

    const isNewMessage = prevMessageCountRef.current > 0 && messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNewMessage) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  // Infinite scroll up + detect scroll position for floating button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;

    // Show "scroll to bottom" button when scrolled up more than 300px from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 300);

    // Load more older messages when near top
    if (hasMore && !loadingMore && onLoadMore && el.scrollTop < 100) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <p className="text-base text-gray-400 dark:text-gray-500">ยังไม่มีข้อความ</p>
      </div>
    );
  }

  return (
    <>
      {/* Avatar lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="relative flex-1">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-slate-900"
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-0.5">
        {/* Load more indicator */}
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
        {hasMore && !loadingMore && (
          <button
            onClick={onLoadMore}
            className="text-sm text-blue-500 hover:text-blue-600 py-2 text-center"
          >
            โหลดข้อความเก่า
          </button>
        )}

        {messages.map((msg, index, arr) => {
          // Show unread marker before the first unread message
          const unreadStartIndex = unreadCount > 0 ? arr.length - unreadCount : -1;
          const showUnreadMarker = index === unreadStartIndex;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSeparator =
            !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

          const isInbound = msg.direction === 'inbound';
          const isOutbound = msg.direction === 'outbound';

          // First message of a consecutive inbound group from same sender
          const isFirstInGroup = isInbound && (
            !prevMsg ||
            prevMsg.senderId !== msg.senderId ||
            prevMsg.direction !== 'inbound' ||
            showDateSeparator
          );

          // Show sender name on first message of group (for group chats)
          const showSenderName = isFirstInGroup;

          // Determine avatar URL — in groups use per-sender avatar, in 1:1 use contact avatar
          const avatarUrl = isGroup ? msg.senderAvatarUrl : contactAvatarUrl;
          const avatarName = isGroup ? msg.senderName : contactName;

          return (
            <div key={msg.id} className={cn(showDateSeparator ? 'mt-2' : '')}>
              {showUnreadMarker && (
                <div ref={unreadMarkerRef} className="flex items-center gap-2 py-2 my-2">
                  <div className="h-px flex-1 bg-red-300 dark:bg-red-500" />
                  <span className="text-xs text-red-500 dark:text-red-400 font-medium px-2">ข้อความใหม่</span>
                  <div className="h-px flex-1 bg-red-300 dark:bg-red-500" />
                </div>
              )}
              {showDateSeparator && (
                <div className="flex items-center justify-center py-3">
                  <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
                  <span className="px-3 text-xs text-gray-400 dark:text-gray-500">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
                </div>
              )}

              {isInbound ? (
                <div className={cn('flex gap-3 items-start', isFirstInGroup ? 'mt-3' : 'mt-0.5')}>
                  {/* Avatar — show on first message of group, spacer otherwise */}
                  <div className="w-9 shrink-0">
                    {isFirstInGroup && (
                      <SenderAvatar url={avatarUrl} name={avatarName} onClickAvatar={setPreviewUrl} />
                    )}
                  </div>
                  <MessageBubble
                    message={msg}
                    showSenderName={showSenderName}
                    channelId={channelId}
                  />
                </div>
              ) : (
                <div className={cn(
                  isOutbound && prevMsg?.direction !== 'outbound' ? 'mt-3' : 'mt-0.5'
                )}>
                  <MessageBubble
                    message={msg}
                    showSenderName={false}
                    channelId={channelId}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div ref={lastMessageRef} />
      </div>
      </div>

      {/* Floating scroll-to-bottom button */}
      {showScrollDown && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-white dark:bg-slate-700 shadow-lg border border-gray-200 dark:border-slate-600 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-slate-600 transition-all"
        >
          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <span className="text-xs text-gray-600 dark:text-gray-300">ข้อความล่าสุด</span>
        </button>
      )}
      </div>
    </>
  );
}

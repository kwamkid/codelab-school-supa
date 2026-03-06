'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/models';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
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

export function MessageList({ messages, loading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-base text-gray-400">{'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...'}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-base text-gray-400">{'\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21'}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-2">
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSeparator =
            !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
          const showSenderName =
            msg.direction === 'inbound' &&
            (!prevMsg ||
              prevMsg.senderId !== msg.senderId ||
              showDateSeparator);

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center py-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="px-3 text-xs text-gray-400">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              <MessageBubble
                message={msg}
                showSenderName={showSenderName}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

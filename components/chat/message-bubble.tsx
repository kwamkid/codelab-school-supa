'use client';

import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/models';

interface MessageBubbleProps {
  message: ChatMessage;
  showSenderName?: boolean;
}

function formatMessageTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date as any);
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export function MessageBubble({ message, showSenderName = false }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound';
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.senderType === 'system';

  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-sm">
          {message.content}
        </span>
      </div>
    );
  }

  // Image messages
  if (message.messageType === 'image' && message.mediaUrl) {
    return (
      <div className={cn('flex flex-col max-w-[320px]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 mb-1 ml-1">{message.senderName}</span>
        )}
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            isOutbound ? 'rounded-br-md' : 'rounded-bl-md'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt="รูปภาพ"
            className="max-w-full h-auto rounded-2xl"
            loading="lazy"
          />
        </div>
        <span className="text-xs text-gray-400 mt-1 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // Sticker messages
  if (message.messageType === 'sticker') {
    return (
      <div className={cn('flex flex-col max-w-[200px]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 mb-1 ml-1">{message.senderName}</span>
        )}
        <div className="text-4xl p-2">
          {message.content || '🏷️'}
        </div>
        <span className="text-xs text-gray-400 mt-0.5 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // Text messages (default)
  return (
    <div className={cn('flex flex-col max-w-[70%]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
      {isInbound && showSenderName && message.senderName && (
        <span className="text-xs text-gray-500 mb-1 ml-1">{message.senderName}</span>
      )}
      <div
        className={cn(
          'px-4 py-2.5 rounded-2xl text-base whitespace-pre-wrap break-words',
          isInbound && 'bg-gray-100 text-gray-900 rounded-bl-md',
          isOutbound && 'bg-blue-500 text-white rounded-br-md'
        )}
      >
        {message.content}
      </div>
      <span className="text-xs text-gray-400 mt-1 mx-1">
        {formatMessageTime(message.createdAt)}
      </span>
    </div>
  );
}

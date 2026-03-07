'use client';

import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/models';
import { FileIcon, Download, Play } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  showSenderName?: boolean;
  channelId?: string;
}

function formatMessageTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date as any);
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Resolve media URL — LINE content URLs need proxy, others pass through */
function resolveMediaUrl(url: string | undefined, channelId?: string): string | undefined {
  if (!url) return undefined;
  // LINE content URLs require auth — proxy through our API
  if (url.includes('api-data.line.me') && channelId) {
    return `/api/admin/chat/media?url=${encodeURIComponent(url)}&channelId=${encodeURIComponent(channelId)}`;
  }
  return url;
}

/** Build LINE sticker image URL from packageId + stickerId */
function getStickerUrl(metadata?: Record<string, any>): string | undefined {
  if (!metadata?.packageId || !metadata?.stickerId) return undefined;
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${metadata.stickerId}/iPhone/sticker.png`;
}

export function MessageBubble({ message, showSenderName = false, channelId }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound';
  const isOutbound = message.direction === 'outbound';
  const isSystem = message.senderType === 'system';
  const mediaUrl = resolveMediaUrl(message.mediaUrl, channelId);

  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-sm">
          {message.content}
        </span>
      </div>
    );
  }

  // Image messages
  if (message.messageType === 'image' && mediaUrl) {
    return (
      <div className={cn('flex flex-col max-w-[75vw] md:max-w-[min(70vw,400px)]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{message.senderName}</span>
        )}
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'block rounded-2xl overflow-hidden cursor-pointer',
            isOutbound ? 'rounded-br-md' : 'rounded-bl-md'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt="รูปภาพ"
            className="max-w-full h-auto rounded-2xl"
            loading="lazy"
          />
        </a>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // Video messages — stream via proxy, don't preload to save bandwidth
  if (message.messageType === 'video' && mediaUrl) {
    return (
      <div className={cn('flex flex-col max-w-[75vw] md:max-w-[min(70vw,400px)]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{message.senderName}</span>
        )}
        <div className={cn('rounded-2xl overflow-hidden', isOutbound ? 'rounded-br-md' : 'rounded-bl-md')}>
          <video
            src={mediaUrl}
            controls
            preload="none"
            className="max-w-full h-auto rounded-2xl"
            poster=""
          >
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer">ดูวิดีโอ</a>
          </video>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // Audio messages
  if (message.messageType === 'audio' && mediaUrl) {
    return (
      <div className={cn('flex flex-col max-w-[75vw] md:max-w-[min(70vw,400px)]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{message.senderName}</span>
        )}
        <div className={cn(
          'px-3 py-2 md:px-4 md:py-2.5 rounded-2xl',
          isInbound && 'bg-gray-100 dark:bg-slate-700 rounded-bl-md',
          isOutbound && 'bg-blue-500 rounded-br-md',
        )}>
          <audio src={mediaUrl} controls preload="none" className="max-w-full h-8" />
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // File messages
  if (message.messageType === 'file' && mediaUrl) {
    const fileName = message.mediaMetadata?.fileName || message.metadata?.fileName || 'ไฟล์';
    const fileSize = message.mediaMetadata?.fileSize || message.metadata?.fileSize;
    return (
      <div className={cn('flex flex-col max-w-[75vw] md:max-w-[min(70vw,400px)]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{message.senderName}</span>
        )}
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 px-3 py-2 md:px-4 md:py-2.5 rounded-2xl no-underline',
            isInbound && 'bg-gray-100 dark:bg-slate-700 rounded-bl-md',
            isOutbound && 'bg-blue-500 rounded-br-md',
          )}
        >
          <FileIcon className={cn('w-5 h-5 shrink-0', isOutbound ? 'text-white/80' : 'text-gray-400')} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', isOutbound ? 'text-white' : 'text-gray-900 dark:text-white')}>
              {fileName}
            </p>
            {fileSize && (
              <p className={cn('text-xs', isOutbound ? 'text-white/70' : 'text-gray-400 dark:text-gray-500')}>
                {formatFileSize(fileSize)}
              </p>
            )}
          </div>
          <Download className={cn('w-4 h-4 shrink-0', isOutbound ? 'text-white/80' : 'text-gray-400')} />
        </a>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // Sticker messages
  if (message.messageType === 'sticker') {
    const stickerUrl = getStickerUrl(message.metadata) || resolveMediaUrl(message.mediaUrl, channelId) || message.metadata?.stickerImageUrl;
    return (
      <div className={cn('flex flex-col max-w-[200px]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
        {isInbound && showSenderName && message.senderName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{message.senderName}</span>
        )}
        {stickerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={stickerUrl} alt="สติกเกอร์" className="w-24 h-24 object-contain" loading="lazy" />
        ) : (
          <div className="text-4xl p-2">
            {message.content || '🏷️'}
          </div>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mx-1">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // Text messages (default)
  return (
    <div className={cn('flex flex-col max-w-[75vw] md:max-w-[min(70vw,400px)]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
      {isInbound && showSenderName && message.senderName && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{message.senderName}</span>
      )}
      <div
        className={cn(
          'px-3 py-1.5 md:px-4 md:py-2.5 rounded-2xl text-base whitespace-pre-wrap break-words font-[family-name:var(--font-chat)]',
          isInbound && 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-bl-md',
          isOutbound && 'bg-blue-500 text-white rounded-br-md'
        )}
      >
        {message.content}
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 mx-1">
        {formatMessageTime(message.createdAt)}
      </span>
    </div>
  );
}

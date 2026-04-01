'use client';

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react';
import { Send, ImagePlus, X, Loader2, Film, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QuickReplyDialog } from './quick-reply-dialog';

interface MessageInputProps {
  onSend: (content: string, messageType?: string, mediaUrl?: string) => void;
  /** Batch send: text blocks + images in 1 API request (saves LINE credits) */
  onSendBatch?: (textBlocks: string[], imageUrls: string[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function MessageInput({ onSend, onSendBatch, disabled = false, autoFocus = true }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video'; file: File } | null>(null);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSend = useCallback(async () => {
    if (disabled || uploading) return;

    // Sending file attachment (from file picker)
    if (mediaPreview) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', mediaPreview.file);
        form.append('bucket', 'chat-media');

        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        onSend(value.trim() || '', data.mediaType, data.url);
        setValue('');
        setMediaPreview(null);
      } catch (error: any) {
        toast.error(error.message || 'อัพโหลดไม่สำเร็จ');
        return;
      } finally {
        setUploading(false);
      }
    } else {
      // Send text
      const trimmed = value.trim();
      if (!trimmed) return;
      onSend(trimmed);
      setValue('');
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [value, disabled, uploading, mediaPreview, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 96;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  const handleFileSelect = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast.error('รองรับเฉพาะรูปภาพและวิดีโอ');
      return;
    }

    if (isImage && file.size > 5 * 1024 * 1024) {
      toast.error('รูปภาพต้องไม่เกิน 5MB');
      return;
    }

    if (isVideo && file.size > 25 * 1024 * 1024) {
      toast.error('วิดีโอต้องไม่เกิน 25MB');
      return;
    }

    setMediaPreview({
      url: URL.createObjectURL(file),
      type: isVideo ? 'video' : 'image',
      file,
    });
  };

  const clearMedia = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }
  };

  const handleQuickReplySelect = async (content: string, images?: string[]) => {
    const blocks = content.split('\n\n').map(b => b.trim()).filter(Boolean);
    const imgs = images || [];

    // Use batch send if available (1 API request, saves LINE credits)
    if (onSendBatch) {
      onSendBatch(blocks, imgs);
      return;
    }

    // Fallback: send one by one with delay
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < blocks.length; i++) {
      if (i > 0) await delay(800);
      onSend(blocks[i]);
    }
    for (let i = 0; i < imgs.length; i++) {
      await delay(800);
      onSend('', 'image', imgs[i]);
    }
  };

  return (
    <>
    {/* Quick Reply Dialog */}
    <QuickReplyDialog
      open={quickReplyOpen}
      onClose={() => setQuickReplyOpen(false)}
      onSelect={handleQuickReplySelect}
    />

    <div className="border-t dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 md:px-4 md:py-3">
      {/* Media preview */}
      {mediaPreview && (
        <div className="mb-2 relative inline-block">
          {mediaPreview.type === 'image' ? (
            <img src={mediaPreview.url} alt="Preview" className="max-h-32 rounded-lg border" />
          ) : (
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 border">
              <Film className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-700 truncate max-w-[200px]">{mediaPreview.file.name}</span>
              <span className="text-xs text-gray-500">{(mediaPreview.file.size / 1024 / 1024).toFixed(1)}MB</span>
            </div>
          )}
          <button
            onClick={clearMedia}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />

      <div className="flex items-end gap-1">
        {/* Quick Reply button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setQuickReplyOpen(!quickReplyOpen)}
          disabled={disabled || uploading}
          className="shrink-0 rounded-xl w-10 h-10 text-gray-500 hover:text-amber-600 hover:bg-amber-50"
          title="ข้อความสำเร็จรูป"
        >
          <Zap className="w-5 h-5" />
        </Button>

        {/* Media button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="shrink-0 rounded-xl w-10 h-10 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
          title="ส่งรูป/วิดีโอ"
        >
          <ImagePlus className="w-5 h-5" />
        </Button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ข้อความ..."
          disabled={disabled || uploading}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 px-4 py-2.5 text-base font-[family-name:var(--font-chat)]',
            'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none',
            'focus:border-blue-300 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || uploading || (!value.trim() && !mediaPreview)}
          className={cn(
            'shrink-0 rounded-xl w-10 h-10',
            (value.trim() || mediaPreview)
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
          )}
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </div>
    </>
  );
}

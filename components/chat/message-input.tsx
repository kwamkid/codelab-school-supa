'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Auto-resize: reset then set to scrollHeight, capped at 4 lines (~96px)
    textarea.style.height = 'auto';
    const maxHeight = 96; // ~4 lines
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className="border-t dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 md:px-4 md:py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ข้อความ..."
          disabled={disabled}
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
          disabled={disabled || !value.trim()}
          className={cn(
            'shrink-0 rounded-xl w-10 h-10',
            value.trim()
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
          )}
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

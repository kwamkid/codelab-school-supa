'use client';

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ResponsiveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Responsive dialog for embedding forms.
 * Mobile: full-screen
 * Desktop: centered dialog, max-w-2xl, max-h-[90vh]
 */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: ResponsiveFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Mobile: full screen
          'max-w-full h-dvh rounded-none border-0 p-0',
          // Desktop: constrained dialog
          'sm:max-w-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:border sm:p-0',
          className
        )}
        showCloseButton={false}
      >
        <div className="flex flex-col h-full sm:max-h-[90vh]">
          <DialogHeader className="px-4 py-3 border-b dark:border-slate-700 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <button
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
              >
                &times;
              </button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

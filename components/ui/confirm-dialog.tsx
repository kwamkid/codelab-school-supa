// components/ui/confirm-dialog.tsx
// กล่องยืนยันกลาง — ใช้แทน window.confirm() (ห้ามใช้ native dialog ในแอป)
//
//   const confirm = useConfirm()
//   if (!(await confirm({ title: 'ปิดห้องนี้?', description: '…', confirmText: 'ปิดห้อง', destructive: true }))) return
//
// ConfirmProvider ถูก mount ครั้งเดียวที่ app/layout.tsx · ส่วน alert() ให้ใช้ toast (sonner) แทน

'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** ปุ่มยืนยันสีแดง (ลบ/ปิด/รีเซ็ต) */
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false)
    if (typeof o === 'string') {
      // drop-in for window.confirm(text): first paragraph = title, the rest = description
      const [title, ...rest] = o.split(/\n\s*\n/)
      o = { title: title.trim(), description: rest.join('\n\n').trim() || undefined }
    }
    setOpts(o)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpts(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(open) => { if (!open) close(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription className="text-base whitespace-pre-line">{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{opts?.cancelText ?? 'ยกเลิก'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(opts?.destructive && 'bg-red-600 hover:bg-red-700')}
            >
              {opts?.confirmText ?? 'ยืนยัน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider> (mounted in app/layout.tsx)')
  return ctx
}

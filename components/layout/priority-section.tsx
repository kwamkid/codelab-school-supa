'use client'

// ══════════════════════════════════════════════════════════════════════
//  PRIORITY SECTION — แถบ "เรื่องด่วน/ต้องรู้" บนสุดของทุกหน้าในระบบแอดมิน
// ══════════════════════════════════════════════════════════════════════
//
// มีอะไรด่วนหรือสำคัญที่ทุกคน (หรือบางบทบาท) ต้องเห็นก่อนใคร ให้มาอยู่ที่นี่
// เช่น ประกาศปิดปรับปรุงระบบ, งานค้างที่ต้องทำก่อนสิ้นเดือน, เตือนต่ออายุ ฯลฯ
//
// วิธีเพิ่มประกาศใหม่ — ใส่ <PriorityAlert> เพิ่มในรายการข้างล่าง เช่น
//
//   <PriorityAlert
//     variant="urgent"
//     title="ปิดปรับปรุงระบบคืนนี้ 22:00-23:00"
//     description="ช่วงเวลาดังกล่าวจะบันทึกข้อมูลไม่ได้ กรุณาปิดงานก่อน 21:45"
//     action={{ label: 'อ่านรายละเอียด', href: '/announcements/maintenance' }}
//     dismissKey="maintenance-2026-08-20"   // ใส่ถ้าอยากให้กดปิดแล้วจำไว้
//   />
//
// ถ้าไม่มีประกาศไหนแสดงผล section นี้จะยุบหายไปเอง (empty:hidden) ไม่กินที่
//
// หมายเหตุ: อยากให้เห็นเฉพาะบางบทบาท ให้ห่อด้วยเงื่อนไข role เอง เช่น
//   {adminUser?.role === 'branch_admin' && <PriorityAlert ... />}

import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertTriangle, Info, Megaphone, X } from 'lucide-react'

type PriorityVariant = 'urgent' | 'warning' | 'info'

const VARIANT_STYLE: Record<PriorityVariant, { card: string; title: string; body: string; icon: ReactNode }> = {
  urgent: {
    card: 'border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900',
    title: 'text-red-900 dark:text-red-300',
    body: 'text-red-800 dark:text-red-400',
    icon: <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 hidden sm:block" />,
  },
  warning: {
    card: 'border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900',
    title: 'text-amber-900 dark:text-amber-300',
    body: 'text-amber-800 dark:text-amber-400',
    icon: <Megaphone className="h-6 w-6 text-amber-600 shrink-0 hidden sm:block" />,
  },
  info: {
    card: 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900',
    title: 'text-blue-900 dark:text-blue-300',
    body: 'text-blue-800 dark:text-blue-400',
    icon: <Info className="h-6 w-6 text-blue-600 shrink-0 hidden sm:block" />,
  },
}

export function PriorityAlert({
  variant = 'warning',
  title,
  description,
  action,
  /** ใส่คีย์ถ้าอยากให้ปิดได้แล้วจำไว้ (เก็บใน localStorage ต่อเบราว์เซอร์) */
  dismissKey,
}: {
  variant?: PriorityVariant
  title: string
  description?: string
  action?: { label: string; href: string }
  dismissKey?: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const storageKey = dismissKey ? `priority-dismissed:${dismissKey}` : null

  useEffect(() => {
    if (storageKey && localStorage.getItem(storageKey) === '1') setDismissed(true)
  }, [storageKey])

  if (dismissed) return null
  const style = VARIANT_STYLE[variant]

  return (
    <Card className={style.card}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        {style.icon}
        <div className="flex-1 min-w-0">
          <div className={cn('text-lg font-semibold', style.title)}>{title}</div>
          {description && <p className={cn('text-base mt-0.5', style.body)}>{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <Button asChild variant="outline">
              <a href={action.href}>{action.label}</a>
            </Button>
          )}
          {storageKey && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="ปิดประกาศนี้"
              onClick={() => {
                localStorage.setItem(storageKey, '1')
                setDismissed(true)
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** รายการประกาศทั้งหมด — เรียงจากด่วนสุดลงมา */
export function PrioritySection({ pathname: _pathname }: { pathname: string }) {
  return (
    <div className="space-y-3 mb-4 empty:hidden">
      {/* ── เพิ่มประกาศด่วนใหม่ตรงนี้ (ดูตัวอย่างในหัวไฟล์) ──
          หมายเหตุ: การชวนครูเชื่อม LINE ไม่ได้อยู่ที่นี่ — เป็นหน้าบังคับเต็มจอ
          ตั้งแต่เข้าระบบ (components/teacher/line-gate.tsx) */}
    </div>
  )
}

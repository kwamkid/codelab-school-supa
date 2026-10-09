// components/ui/sticky-bar.tsx
// แถบตัวกรองที่ติดขอบบนจอ (sticky ใน <main> ซึ่งเป็นตัว scroll ของ admin layout)
// เลื่อนลงไปดูกราฟ/ตารางแล้วยังเปลี่ยนสาขา/ช่วงเวลาได้ · ใช้ class `.sticky-bar` (globals.css)
// วางเป็นลูกของ wrapper หน้าที่มี padding `p-4 sm:p-6` (ขอบซ้ายขวาชดเชยด้วย -mx ให้เต็มกว้าง)

import { cn } from '@/lib/utils'

export function StickyBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('sticky-bar', className)}>{children}</div>
}

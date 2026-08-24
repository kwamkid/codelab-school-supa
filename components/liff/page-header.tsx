'use client'

// หัวหน้าจอของแอปผู้ปกครอง (LIFF) — แถบสีแบรนด์ + โลโก้ CodeLab สีขาว + ชื่อหน้า
//
// ทุกหน้าใช้ตัวนี้ตัวเดียว (เดิมแต่ละหน้าปั้น <div className="bg-primary ..."> เอง
// ทำให้ระยะ/ขนาดตัวอักษรเพี้ยนกันทีละนิด). ปุ่มย้อนกลับกับปุ่มขวาเป็นออปชัน
//
// โลโก้: ใช้ไฟล์เดียวกับที่อื่น (logo-just-logo.svg เป็นสีแดงแบรนด์) แล้วบังคับ
// เป็นสีขาวด้วย filter — จะได้ไม่ต้องมีไฟล์โลโก้ขาวอีกเวอร์ชันให้ตกหล่นตอนแก้แบรนด์

import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LiffPageHeader({
  title,
  onBack,
  action,
  className,
}: {
  title: React.ReactNode
  /** ใส่เมื่อหน้านั้นเป็นหน้าย่อย (แท็บหลักไม่ต้องมีปุ่มกลับ) */
  onBack?: () => void
  /** ปุ่มมุมขวา เช่น ออกจากระบบ */
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-primary text-white p-4 pt-6', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:bg-white hover:text-gray-900 active:bg-white active:text-gray-900 -ml-2 shrink-0"
              aria-label="ย้อนกลับ"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-just-logo.svg"
            alt="CodeLab"
            className="h-6 w-auto shrink-0"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <h1 className="text-xl font-bold truncate">{title}</h1>
        </div>
        {action}
      </div>
    </div>
  )
}

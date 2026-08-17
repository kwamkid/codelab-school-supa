'use client'

// แบนเนอร์ชวนครูเชื่อม LINE — โผล่เฉพาะครูที่ยังไม่ได้ผูก (ผูกแล้วเงียบไปเลย
// ตามที่เจ้าของสั่ง: "ใครผูกแล้วก็ไม่ต้องถาม").
//
// กด "เชื่อมต่อ LINE" → /api/teacher/line-link (LINE OAuth, ยืนยันตัวครูจาก
// session ฝั่งเซิร์ฟเวอร์) → กลับมาที่หน้าเดิมพร้อม ?line_linked=1
//
// ⚠️ ผูกแล้วยังไม่พอ — LINE push ไม่ถึงคนที่ยังไม่ได้เพิ่ม OA เป็นเพื่อน
// เลยโชว์ลิงก์เพิ่มเพื่อนต่อทันทีหลังผูกสำเร็จ (เหมือนแบนเนอร์ฝั่งผู้ปกครอง).

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, X } from 'lucide-react'

const LINE_ERROR_TEXT: Record<string, string> = {
  already_linked_to_other_teacher: 'บัญชี LINE นี้ถูกผูกกับครูคนอื่นแล้ว',
  no_teacher_profile: 'บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลครู',
  not_configured: 'ยังไม่ได้ตั้งค่า LINE Login ในระบบ',
  link_failed: 'บันทึกการเชื่อมต่อไม่สำเร็จ',
  bad_state: 'ลิงก์หมดอายุ กรุณาลองใหม่',
}

export function TeacherLineLinkCard({ returnPath = '/teacher' }: { returnPath?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [linked, setLinked] = useState<boolean | null>(null)
  const [applicable, setApplicable] = useState(false)
  const [addFriendUrl, setAddFriendUrl] = useState<string | null>(null)
  const [justLinked, setJustLinked] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/line-status')
      const data = await res.json()
      setApplicable(!!data.applicable)
      setLinked(!!data.linked)
    } catch {
      setLinked(null)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // กลับมาจาก LINE — โชว์ผลแล้วล้าง query ทิ้ง (กันเด้ง toast ซ้ำตอน refresh)
  useEffect(() => {
    const ok = searchParams.get('line_linked')
    const err = searchParams.get('line_error')
    if (!ok && !err) return
    if (ok) {
      toast.success('เชื่อมต่อ LINE เรียบร้อย')
      setJustLinked(true)
      loadStatus()
      fetch('/api/liff/oa-info')
        .then((r) => r.json())
        .then((info) => info?.addFriendUrl && setAddFriendUrl(info.addFriendUrl))
        .catch(() => {})
    } else if (err) {
      toast.error(LINE_ERROR_TEXT[err] || 'เชื่อมต่อ LINE ไม่สำเร็จ')
    }
    router.replace(returnPath)
  }, [searchParams, router, returnPath, loadStatus])

  // เพิ่งผูกเสร็จ → เตือนเรื่องเพิ่มเพื่อน OA (ไม่งั้น noti ไม่เข้า)
  if (justLinked && addFriendUrl) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-green-800 dark:text-green-300">เชื่อมต่อ LINE แล้ว</div>
            <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
              อีกขั้นเดียว — เพิ่ม LINE ทางการของโรงเรียนเป็นเพื่อน ไม่งั้นระบบส่งแจ้งเตือนไม่ถึง
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
              <a href={addFriendUrl} target="_blank" rel="noreferrer">
                เพิ่มเพื่อน
              </a>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setJustLinked(false)} aria-label="ปิด">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!applicable || linked !== false) return null

  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <MessageCircle className="h-5 w-5 text-amber-600 shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-amber-900 dark:text-amber-300">ยังไม่ได้เชื่อม LINE</div>
          <p className="text-sm text-amber-800 dark:text-amber-400 mt-0.5">
            เชื่อมครั้งเดียว แล้วรับแจ้งเตือนตารางซ้อมของทีมที่คุณดูแลทาง LINE
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 bg-green-600 hover:bg-green-700"
          onClick={() => {
            window.location.href = `/api/teacher/line-link?return=${encodeURIComponent(returnPath)}`
          }}
        >
          เชื่อมต่อ LINE
        </Button>
      </CardContent>
    </Card>
  )
}

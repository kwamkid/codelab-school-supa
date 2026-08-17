'use client'

// หน้าบังคับ: ครูต้องเชื่อม LINE ก่อนถึงจะใช้งานระบบได้
// (เจ้าของสั่ง "บังคับเลย" — แบนเนอร์เตือนเฉย ๆ ครูข้ามได้เรื่อย ๆ)
//
// แสดงแทนทั้งหน้าเมื่อ role=teacher + มี teachers row + ยังไม่ผูก LINE
// ผูกเสร็จ → กลับมาหน้าเดิม gate หายไปเอง
// มีปุ่มออกจากระบบเสมอ เพื่อไม่ให้ติดกับถ้ามีปัญหากับ LINE

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { MessageCircle, CalendarDays, Users, LogOut, Loader2 } from 'lucide-react'

const LINE_ERROR_TEXT: Record<string, string> = {
  already_linked_to_other_teacher: 'บัญชี LINE นี้ถูกผูกกับครูคนอื่นแล้ว กรุณาใช้บัญชีอื่นหรือแจ้งแอดมิน',
  no_teacher_profile: 'บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลครู กรุณาแจ้งแอดมิน',
  not_configured: 'ยังไม่ได้ตั้งค่า LINE Login ในระบบ กรุณาแจ้งแอดมิน',
  link_failed: 'บันทึกการเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่',
  bad_state: 'ลิงก์หมดอายุ กรุณาลองใหม่',
}

export function TeacherLineGate({
  teacherName,
  currentPath,
  onSignOut,
}: {
  teacherName?: string | null
  currentPath: string
  onSignOut: () => void
}) {
  const searchParams = useSearchParams()
  const [starting, setStarting] = useState(false)

  // เด้งกลับมาพร้อม error (ผูกไม่สำเร็จ) → บอกสาเหตุ
  useEffect(() => {
    const err = searchParams.get('line_error')
    if (err) toast.error(LINE_ERROR_TEXT[err] || 'เชื่อมต่อ LINE ไม่สำเร็จ')
  }, [searchParams])

  const startLink = async () => {
    if (starting) return
    setStarting(true)
    try {
      const res = await authFetch('/api/teacher/line-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: currentPath }),
      })
      const data = await res.json()
      if (!res.ok || !data.authorizeUrl) {
        toast.error(data.error || 'เริ่มเชื่อมต่อ LINE ไม่สำเร็จ')
        setStarting(false)
        return
      }
      window.location.href = data.authorizeUrl
    } catch {
      toast.error('เกิดข้อผิดพลาด')
      setStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
              เชื่อมบัญชี LINE ก่อนเริ่มใช้งาน
            </h1>
            <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
              สวัสดี{teacherName ? ` ครู${teacherName}` : ''} 👋 ระบบส่งแจ้งเตือนงานสอนทาง LINE
              จึงต้องเชื่อมบัญชีก่อน ทำครั้งเดียวจบ
            </p>
          </div>

          <div className="mt-6 space-y-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                สรุปตารางสอนของพรุ่งนี้ — สอนคลาสไหน กี่โมง ห้องอะไร และมีนักเรียนคนไหนลา
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                แจ้งเตือนตารางซ้อมของทีมที่คุณดูแล ทันทีที่มีนักเรียนได้รับอนุมัติให้เข้าซ้อม
              </p>
            </div>
          </div>

          <Button
            onClick={startLink}
            disabled={starting}
            className="mt-6 w-full h-12 text-base bg-green-600 hover:bg-green-700"
          >
            {starting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> กำลังเปิด LINE...
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5 mr-2" /> เชื่อมต่อ LINE
              </>
            )}
          </Button>

          <p className="mt-3 text-xs text-center text-gray-500">
            ระบบขอแค่ชื่อและรูปโปรไฟล์ LINE เพื่อยืนยันตัวตน ไม่สามารถอ่านแชทของคุณได้
          </p>

          <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">มีปัญหาเชื่อมต่อ? แจ้งแอดมินได้เลย</p>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="text-gray-500 shrink-0">
              <LogOut className="h-4 w-4 mr-1.5" /> ออกจากระบบ
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

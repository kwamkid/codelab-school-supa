'use client'

// หน้าบังคับ: ครูต้องเชื่อม LINE ก่อนถึงจะใช้งานระบบได้
// (เจ้าของสั่ง "บังคับเลย" — แบนเนอร์เตือนเฉย ๆ ครูข้ามได้เรื่อย ๆ)
//
// จบทั้ง 2 ขั้นในหน้าเดียว: เพิ่ม OA เป็นเพื่อน (ไม่งั้น push ไม่ถึง) แล้วเชื่อมบัญชี
// จงใจไม่มีการ์ดตามหลังหลังผูกเสร็จ — ครูทำครบตั้งแต่ตรงนี้ ระบบจะได้ไม่ต้อง
// เตือนซ้ำไปเรื่อย ๆ ทั้งที่เช็คไม่ได้ว่าเพิ่มเพื่อนแล้วจริงไหม
//
// แสดงแทนทั้งหน้าเมื่อ role=teacher + มี teachers row + ยังไม่ผูก LINE
// มีปุ่มออกจากระบบเสมอ เพื่อไม่ให้ติดกับถ้ามีปัญหากับ LINE

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { MessageCircle, CalendarDays, Users, LogOut, Loader2, UserPlus, Link2 } from 'lucide-react'

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
  const [addFriendUrl, setAddFriendUrl] = useState<string | null>(null)
  const [oaName, setOaName] = useState<string | null>(null)

  // เด้งกลับมาพร้อม error (ผูกไม่สำเร็จ) → บอกสาเหตุ
  useEffect(() => {
    const err = searchParams.get('line_error')
    if (err) toast.error(LINE_ERROR_TEXT[err] || 'เชื่อมต่อ LINE ไม่สำเร็จ')
  }, [searchParams])

  // ลิงก์เพิ่มเพื่อน OA (route นี้ไม่ต้อง auth, cache 1 ชม.ฝั่งเซิร์ฟเวอร์)
  useEffect(() => {
    fetch('/api/liff/oa-info')
      .then((r) => r.json())
      .then((info) => {
        if (info?.addFriendUrl) setAddFriendUrl(info.addFriendUrl)
        if (info?.displayName) setOaName(info.displayName)
      })
      .catch(() => {})
  }, [])

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
        <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
              เชื่อม LINE ก่อนเริ่มใช้งาน
            </h1>
            <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
              สวัสดี{teacherName ? ` ครู${teacherName}` : ''} 👋 ระบบส่งแจ้งเตือนงานสอนทาง LINE
              ทำ 2 ขั้นนี้ครั้งเดียวจบ
            </p>
          </div>

          <div className="mt-5 space-y-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-base text-gray-700 dark:text-gray-300">
                สรุปตารางสอนพรุ่งนี้ — สอนคลาสไหน กี่โมง ห้องอะไร และมีนักเรียนคนไหนลา
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-base text-gray-700 dark:text-gray-300">
                แจ้งเตือนตารางซ้อมของทีมที่คุณดูแล ทันทีที่มีนักเรียนได้รับอนุมัติให้เข้าซ้อม
              </p>
            </div>
          </div>

          {/* ขั้น 1 — เพิ่มเพื่อน OA (ข้ามขั้นนี้แล้ว LINE จะ push ไม่ถึงเลย) */}
          <div className="mt-6 rounded-xl border-2 border-green-200 dark:border-green-900 p-4">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 shrink-0 rounded-full bg-green-600 text-white text-base font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                เพิ่ม {oaName || 'LINE ทางการของโรงเรียน'} เป็นเพื่อน
              </h2>
            </div>
            <p className="mt-1.5 text-base text-gray-600 dark:text-gray-400">
              ถ้ายังไม่เป็นเพื่อนกัน ระบบจะส่งข้อความหาคุณไม่ได้เลย
            </p>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
              {addFriendUrl && (
                <div className="shrink-0 rounded-lg bg-white p-2 border">
                  <QRCodeSVG value={addFriendUrl} size={120} />
                </div>
              )}
              <div className="flex-1 w-full">
                <p className="text-base text-gray-600 dark:text-gray-400 mb-2">
                  สแกน QR ด้วยมือถือ หรือกดปุ่มนี้ถ้าเปิดบนเครื่องที่มี LINE อยู่แล้ว
                </p>
                <Button
                  asChild
                  disabled={!addFriendUrl}
                  className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                >
                  <a href={addFriendUrl || '#'} target="_blank" rel="noreferrer">
                    <UserPlus className="h-5 w-5 mr-2" /> เพิ่มเพื่อน
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* ขั้น 2 — ผูกบัญชี */}
          <div className="mt-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 shrink-0 rounded-full bg-gray-800 dark:bg-gray-600 text-white text-base font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                เชื่อมบัญชี LINE ของคุณ
              </h2>
            </div>
            <p className="mt-1.5 text-base text-gray-600 dark:text-gray-400">
              เพื่อให้ระบบรู้ว่าต้องส่งตารางสอนของครูคนไหนไปหาใคร
            </p>
            <Button
              onClick={startLink}
              disabled={starting}
              className="mt-4 w-full h-12 text-base bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {starting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> กำลังเปิด LINE...
                </>
              ) : (
                <>
                  <Link2 className="h-5 w-5 mr-2" /> เชื่อมบัญชี LINE
                </>
              )}
            </Button>
          </div>

          <p className="mt-4 text-sm text-center text-gray-500">
            ระบบขอแค่ชื่อและรูปโปรไฟล์ LINE เพื่อยืนยันตัวตน ไม่สามารถอ่านแชทของคุณได้
          </p>

          <div className="mt-5 pt-4 border-t flex items-center justify-between gap-3">
            <p className="text-base text-gray-500">มีปัญหาเชื่อมต่อ? แจ้งแอดมินได้เลย</p>
            <Button variant="ghost" onClick={onSignOut} className="text-gray-500 shrink-0">
              <LogOut className="h-4 w-4 mr-1.5" /> ออกจากระบบ
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

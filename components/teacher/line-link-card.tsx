'use client'

// แถวสถานะ LINE ของครูในหน้าโปรไฟล์ — ผูกแล้ว/ยังไม่ผูก + ปุ่มจัดการ
//
// การชวนผูกครั้งแรกไม่ได้อยู่ที่นี่ — ครูที่ยังไม่ผูกจะโดนหน้าบังคับ
// (components/teacher/line-gate.tsx) จับไว้ตั้งแต่เข้าระบบ พร้อมขั้นตอน
// เพิ่มเพื่อน OA ในหน้าเดียวกัน ที่นี่จึงมีไว้สำหรับดูสถานะ/ยกเลิกภายหลัง
// และเผื่อกรณีที่ยกเลิกแล้วอยากผูกใหม่จากหน้าโปรไฟล์

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { useTeacherLineStatus } from './use-line-status'

/** ปุ่มเริ่มผูก — ขอ authorize URL ผ่าน authFetch (เซิร์ฟเวอร์ยืนยันตัวครูจาก
    Bearer token) แล้วค่อยพาไป LINE; navigate ตรง ๆ จะไม่มี token ติดไปด้วย */
function useStartLink(returnPath: string) {
  const [starting, setStarting] = useState(false)

  const startLink = useCallback(async () => {
    if (starting) return
    setStarting(true)
    try {
      const res = await authFetch('/api/teacher/line-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath }),
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
  }, [returnPath, starting])

  return { starting, startLink }
}

/**
 * แถวสถานะ LINE สำหรับหน้าโปรไฟล์ครู — ผูกแล้วโชว์สถานะ + ปุ่มยกเลิก,
 * ยังไม่ผูกโชว์ปุ่มเชื่อม (ปกติจะไม่เกิด เพราะโดนหน้าบังคับจับไปก่อน)
 */
export function TeacherLineStatus({ returnPath = '/profile' }: { returnPath?: string }) {
  const { loading, applicable, linked, refresh } = useTeacherLineStatus(true)
  const { starting, startLink } = useStartLink(returnPath)
  const [busy, setBusy] = useState(false)
  const [addFriendUrl, setAddFriendUrl] = useState<string | null>(null)

  // ลิงก์เพิ่มเพื่อน OA — ต้องมีไว้เสมอแม้ผูกแล้ว เพราะเช็คไม่ได้ว่าเพิ่มเพื่อนหรือยัง
  // และถ้าครูเผลอเชื่อมบัญชีก่อนเพิ่มเพื่อน หน้าบังคับจะหายไป เหลือที่นี่ที่เดียว
  useEffect(() => {
    fetch('/api/liff/oa-info')
      .then((r) => r.json())
      .then((info) => info?.addFriendUrl && setAddFriendUrl(info.addFriendUrl))
      .catch(() => {})
  }, [])

  const unlink = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await authFetch('/api/teacher/line-status', { method: 'DELETE' })
      if (!res.ok) {
        toast.error('ยกเลิกการเชื่อมไม่สำเร็จ')
        return
      }
      toast.success('ยกเลิกการเชื่อม LINE แล้ว')
      await refresh()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !applicable) return null

  if (!linked) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 bg-gray-300 rounded flex items-center justify-center text-white text-xs font-bold">
          L
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">การแจ้งเตือนทาง LINE</p>
          <p className="font-medium text-amber-600">ยังไม่ได้เชื่อม</p>
        </div>
        <Button onClick={startLink} disabled={starting} className="bg-green-600 hover:bg-green-700">
          {starting ? 'กำลังเปิด LINE...' : 'เชื่อมต่อ LINE'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">
          L
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">การแจ้งเตือนทาง LINE</p>
          <p className="font-medium text-green-700 dark:text-green-400">เชื่อมต่อแล้ว</p>
        </div>
        <Button variant="ghost" onClick={unlink} disabled={busy} className="text-gray-500">
          ยกเลิกการเชื่อม
        </Button>
      </div>
      {addFriendUrl && (
        <p className="text-base text-gray-500 pl-8">
          ยังไม่ได้เพิ่ม LINE ทางการของโรงเรียนเป็นเพื่อน? ข้อความจะส่งไม่ถึง —{' '}
          <a
            href={addFriendUrl}
            target="_blank"
            rel="noreferrer"
            className="text-green-700 dark:text-green-400 font-medium underline underline-offset-2"
          >
            เพิ่มเพื่อน
          </a>
        </p>
      )}
    </div>
  )
}

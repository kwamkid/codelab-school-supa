'use client'

// ลิงก์ทีมแบบเก่า (/team/p/<token>, /team/e/<token>) — ถ้าคนเปิดเป็นผู้ปกครองที่
// ลงทะเบียนในระบบแล้ว (รวมผู้ปกครองร่วม) ให้พาไปใช้แท็บ "ทีม" ในแอปผู้ปกครอง
// แทน จะได้มีแอปเดียว ไม่ต้องจำว่าลิงก์ไหนดูอะไร
//
// คนที่ยังไม่ได้ลงทะเบียน (ญาติ/คนที่ได้ลิงก์ต่อมา) ยังใช้หน้านี้ได้เหมือนเดิม
// — ตัวเรียกเป็นคนตัดสินว่าจะ mount คอมโพเนนต์นี้ไหม

import { useEffect, useState } from 'react'
import { Loading } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { parentLiffUrl } from '@/lib/line/liff-id'

const PORTAL_TEAM_URL = parentLiffUrl('/team')
// กันเด้งวน: ถ้าเพิ่งพาไปแล้วในเซสชันนี้ อย่าพาซ้ำ (เผื่อผู้ใช้กดย้อนกลับมา)
const ONCE_KEY = 'vex:redirected-to-portal'

export function PortalRedirect({ liff }: { liff: any }) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ONCE_KEY) === '1') {
        setStuck(true)
        return
      }
      window.sessionStorage.setItem(ONCE_KEY, '1')
    } catch {
      /* ไม่มีสตอเรจก็พาไปตามปกติ */
    }

    const t = setTimeout(() => {
      if (liff?.isInClient?.()) liff.openWindow({ url: PORTAL_TEAM_URL, external: false })
      else window.location.href = PORTAL_TEAM_URL
      // เผื่อเปิดไม่สำเร็จ (บล็อก popup ฯลฯ) — โชว์ปุ่มให้กดเอง
      setTimeout(() => setStuck(true), 2500)
    }, 400)
    return () => clearTimeout(t)
  }, [liff])

  if (stuck) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center space-y-4 max-w-sm">
          <h1 className="text-xl font-bold">ย้ายไปแอปผู้ปกครองแล้ว</h1>
          <p className="text-base text-gray-600">
            ตารางซ้อมและรายการแข่งขันของทีม ย้ายไปอยู่ในแท็บ &quot;ทีม&quot; ของแอป CodeLab
            แล้ว — ดูตารางเรียน ผลการเรียน และเรื่องทีมได้ในแอปเดียว
          </p>
          <Button className="w-full" onClick={() => (window.location.href = PORTAL_TEAM_URL)}>
            เปิดแอปผู้ปกครอง
          </Button>
        </div>
      </div>
    )
  }

  return <Loading fullScreen size="lg" text="กำลังพาไปที่แอปผู้ปกครอง..." />
}

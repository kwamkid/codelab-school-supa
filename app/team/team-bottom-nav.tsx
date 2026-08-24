'use client'

// แท็บล่างของหน้า /team — สลับระหว่างมุมมองแข่งขัน (e) กับซ้อม (p) ของทีมเดียวกัน
// slug เดิมติดไปด้วย: token ใช้แทนกันได้ฝั่ง server (ดู lib/vex/public-team)
// หน้าตา/พฤติกรรมใช้ <BottomTabBar> ตัวเดียวกับแอปผู้ปกครอง

import { usePathname } from 'next/navigation'
import { Trophy, CalendarClock } from 'lucide-react'
import { BottomTabBar, type BottomTab } from '@/components/liff/bottom-tab-bar'

export function TeamBottomNav() {
  const pathname = usePathname()

  // โผล่เฉพาะ /team/e/<slug> กับ /team/p/<slug>
  const match = pathname.match(/^\/team\/(e|p)\/([^/]+)$/)
  if (!match) return null
  const slug = match[2]

  const tabs: BottomTab[] = [
    {
      path: `/team/p/${slug}`,
      label: 'ตารางซ้อม',
      icon: CalendarClock,
      match: (p) => p.startsWith('/team/p/'),
    },
    {
      path: `/team/e/${slug}`,
      label: 'ตารางแข่งขัน',
      icon: Trophy,
      match: (p) => p.startsWith('/team/e/'),
    },
  ]

  return (
    <>
      {/* กันเนื้อหาหน้าไม่ให้โดนแถบล่างทับ */}
      <div className="h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      <BottomTabBar tabs={tabs} />
    </>
  )
}

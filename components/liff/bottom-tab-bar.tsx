'use client'

// แถบแท็บล่างของหน้าจอฝั่งผู้ปกครอง — หน้าตา/พฤติกรรมกลางตัวเดียว ใช้ทั้ง
// แอปผู้ปกครอง (components/liff/bottom-nav.tsx) และแอปทีม (/team)
// เดิมสองที่ก๊อปโค้ดกันมา แก้สไตล์ทีต้องไล่แก้ทั้งคู่
//
// กดแล้วติดสถานะ "กำลังไป" (ไอคอนหมุน + ไฮไลต์) ทันทีก่อนหน้าใหม่จะโหลดเสร็จ
// เพื่อให้รู้สึกว่าแตะแล้วตอบสนอง

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BottomTab {
  /** path ที่จะไปเมื่อแตะ (ใช้เป็น key ด้วย) */
  path: string
  label: string
  icon: LucideIcon
  /** แท็บนี้ถือว่า active เมื่อ pathname ปัจจุบันเข้าเงื่อนไขนี้ */
  match: (pathname: string) => boolean
}

export function BottomTabBar({ tabs }: { tabs: BottomTab[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  // เคลียร์สถานะ "กำลังไป" เมื่อถึงหน้าปลายทางแล้ว
  useEffect(() => {
    setPendingPath(null)
  }, [pathname])

  const go = (path: string) => {
    if (path === pathname) return
    setPendingPath(path)
    startTransition(() => router.push(path))
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="mx-auto max-w-md grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const isPending = pendingPath === tab.path
          const active = isPending || (!pendingPath && tab.match(pathname))
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => go(tab.path)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-150',
                'hover:bg-gray-50 active:bg-gray-100 active:scale-95',
                active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {/* ขีดไฮไลต์ด้านบนของแท็บที่เลือกอยู่ */}
              <span
                className={cn(
                  'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
              {isPending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Icon
                  className={cn('h-6 w-6 transition-transform', active && 'fill-primary/10 scale-110')}
                  strokeWidth={active ? 2.4 : 2}
                />
              )}
              <span className={cn('text-[11px]', active && 'font-semibold')}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

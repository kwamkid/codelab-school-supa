'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, MessageSquare, Trophy, Loader2 } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { liffFetch } from '@/lib/line/liff-fetch'
import { getLiffCache, setLiffCache } from '@/lib/line/liff-cache'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'หน้าหลัก', icon: Home, path: '/liff', match: (p: string) => p === '/liff' },
  { label: 'ตารางเรียน', icon: Calendar, path: '/liff/schedule', match: (p: string) => p.startsWith('/liff/schedule') },
  { label: 'Feedback', icon: MessageSquare, path: '/liff/feedback', match: (p: string) => p.startsWith('/liff/feedback') },
]

// แท็บทีมโผล่เฉพาะบ้านที่มีลูกอยู่ทีม VEX — บ้านทั่วไปไม่เห็นอะไรเลย
const TEAM_TAB = {
  label: 'ทีม',
  icon: Trophy,
  path: '/liff/team',
  match: (p: string) => p.startsWith('/liff/team'),
}
const HAS_TEAM_KEY = 'has-team'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useLiff()
  const [, startTransition] = useTransition()
  // เช็คครั้งเดียวต่อ session (cache) — ไม่ยิงทุกครั้งที่สลับแท็บ
  const [hasTeam, setHasTeam] = useState<boolean>(() => !!getLiffCache<boolean>(HAS_TEAM_KEY))
  // The tab the user just tapped — used to show selected + spinner immediately,
  // before the new route/data finishes loading (so a tap always feels responsive).
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  // Clear the pending state once we've actually arrived on that route.
  useEffect(() => { setPendingPath(null) }, [pathname])

  useEffect(() => {
    if (!profile?.userId) return
    let active = true
    ;(async () => {
      try {
        const res = await liffFetch('/api/liff/team', {
          lineUserId: profile.userId,
          action: 'has-team',
        })
        if (!active) return
        const value = !!res?.hasTeam
        setHasTeam(value)
        setLiffCache(HAS_TEAM_KEY, value)
      } catch {
        // เช็คไม่ได้ = ไม่โชว์แท็บ (ไม่ทำให้ nav พัง)
      }
    })()
    return () => { active = false }
  }, [profile?.userId])

  const tabs = hasTeam ? [...TABS, TEAM_TAB] : TABS

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
      <div className={cn('mx-auto max-w-md grid', hasTeam ? 'grid-cols-4' : 'grid-cols-3')}>
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
              {/* active top indicator bar */}
              <span
                className={cn(
                  'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
              {isPending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Icon className={cn('h-6 w-6 transition-transform', active && 'fill-primary/10 scale-110')} strokeWidth={active ? 2.4 : 2} />
              )}
              <span className={cn('text-[11px]', active && 'font-semibold')}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

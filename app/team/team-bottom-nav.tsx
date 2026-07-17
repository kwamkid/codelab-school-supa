'use client'

// Bottom tab bar for the /team parent pages — switch between the competition
// (e) and practice (p) views of the SAME team. The current slug rides along on
// the switch: tokens are interchangeable server-side (see lib/vex/public-team),
// so whichever link the parent arrived with works for both tabs.
// Mirrors components/liff/bottom-nav.tsx so the two parent surfaces feel alike.

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Trophy, CalendarClock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { kind: 'p', label: 'ตารางซ้อม', icon: CalendarClock },
  { kind: 'e', label: 'ตารางแข่งขัน', icon: Trophy },
] as const

export function TeamBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  useEffect(() => { setPendingPath(null) }, [pathname])

  // Only on /team/e/<slug> or /team/p/<slug>
  const match = pathname.match(/^\/team\/(e|p)\/([^/]+)$/)
  if (!match) return null
  const [, activeKind, slug] = match

  const go = (kind: string) => {
    const path = `/team/${kind}/${slug}`
    if (path === pathname) return
    setPendingPath(path)
    startTransition(() => router.push(path))
  }

  return (
    <>
      {/* spacer so page content never hides behind the fixed bar */}
      <div className="h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto max-w-md grid grid-cols-2">
          {TABS.map((tab) => {
            const path = `/team/${tab.kind}/${slug}`
            const isPending = pendingPath === path
            const active = isPending || (!pendingPath && activeKind === tab.kind)
            const Icon = tab.icon
            return (
              <button
                key={tab.kind}
                type="button"
                onClick={() => go(tab.kind)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-150',
                  'hover:bg-gray-50 active:bg-gray-100 active:scale-95',
                  active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Icon className={cn('h-6 w-6 transition-transform', active && 'scale-110')} strokeWidth={active ? 2.4 : 2} />
                )}
                <span className={cn('text-[11px]', active && 'font-semibold')}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'หน้าหลัก', icon: Home, path: '/liff', match: (p: string) => p === '/liff' },
  { label: 'ตารางเรียน', icon: Calendar, path: '/liff/schedule', match: (p: string) => p.startsWith('/liff/schedule') },
  { label: 'Feedback', icon: MessageSquare, path: '/liff/feedback', match: (p: string) => p.startsWith('/liff/feedback') },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => router.push(tab.path)}
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
              <Icon className={cn('h-6 w-6 transition-transform', active && 'fill-primary/10 scale-110')} strokeWidth={active ? 2.4 : 2} />
              <span className={cn('text-[11px]', active && 'font-semibold')}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

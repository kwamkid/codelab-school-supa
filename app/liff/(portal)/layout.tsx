'use client'

// Shared shell for the parent portal tabs. Mounts LiffProvider ONCE so LIFF
// initialises a single time and survives tab switches. Renders one slim top bar
// (page title + logo) and the fixed bottom tab bar for all portal pages.

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { LiffProvider } from '@/components/liff/liff-provider'
import { BottomNav } from '@/components/liff/bottom-nav'

function routeMeta(path: string): { title: string; back: boolean } {
  if (path === '/liff') return { title: 'หน้าหลัก', back: false }
  if (path.startsWith('/liff/schedule')) return { title: 'ตารางเรียน', back: false }
  if (path.startsWith('/liff/feedback')) return { title: 'Feedback', back: false }
  if (path.startsWith('/liff/makeup')) return { title: 'การลาและเรียนชดเชย', back: true }
  if (/\/profile\/[^/]+\/students\/new$/.test(path)) return { title: 'เพิ่มข้อมูลนักเรียน', back: true }
  if (/\/profile\/[^/]+\/students\/[^/]+$/.test(path)) return { title: 'แก้ไขข้อมูลนักเรียน', back: true }
  if (/\/profile\/[^/]+$/.test(path)) return { title: 'แก้ไขข้อมูลผู้ปกครอง', back: true }
  if (path.startsWith('/liff/profile')) return { title: 'โปรไฟล์', back: true }
  return { title: '', back: false }
}

function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { title, back } = routeMeta(pathname)
  return (
    <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-3 bg-white border-b border-gray-100">
      <div className="flex items-center gap-1 min-w-0">
        {back && (
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1 rounded-md text-gray-700 hover:bg-gray-100 active:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="font-bold text-gray-800 truncate">{title}</h1>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-just-logo.svg" alt="CodeLab" className="h-7 w-7 shrink-0" />
    </header>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider requireLogin={true}>
      <div className="min-h-screen bg-gray-50 pb-[72px]">
        <TopBar />
        {children}
      </div>
      <BottomNav />
    </LiffProvider>
  )
}

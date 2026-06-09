'use client'

// Shared shell for the parent portal tabs. Mounts LiffProvider ONCE so LIFF
// initialises a single time and survives tab switches (App Router layouts persist
// across child navigations) — fixes the slow, re-initialising-per-page behaviour.
// Renders the fixed bottom tab bar for all portal pages.

import { LiffProvider } from '@/components/liff/liff-provider'
import { BottomNav } from '@/components/liff/bottom-nav'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider requireLogin={true}>
      <div className="min-h-screen bg-gray-50 pb-[72px]">
        {/* Shared brand top bar on every portal page */}
        <header className="sticky top-0 z-40 h-12 flex items-center justify-center bg-white/95 backdrop-blur border-b border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="CodeLab School" className="h-7 w-auto" />
        </header>
        {children}
      </div>
      <BottomNav />
    </LiffProvider>
  )
}

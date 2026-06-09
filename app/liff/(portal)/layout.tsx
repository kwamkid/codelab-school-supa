'use client'

// Shared shell for the parent portal tabs. Mounts LiffProvider ONCE so LIFF
// initialises a single time and survives tab switches. Renders the fixed bottom
// tab bar. Each page renders its own header/title.

import { LiffProvider } from '@/components/liff/liff-provider'
import { BottomNav } from '@/components/liff/bottom-nav'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider requireLogin={true}>
      <div className="min-h-screen bg-gray-50 pb-[72px]">{children}</div>
      <BottomNav />
    </LiffProvider>
  )
}

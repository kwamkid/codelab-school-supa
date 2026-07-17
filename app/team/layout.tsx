import type { Viewport } from 'next'
import { Toaster } from 'sonner'
import { TeamBottomNav } from './team-bottom-nav'

// The VEX /team pages are part of the parent-facing system, so they share the
// LIFF parent portal's look: the `.liff-theme` scope softens borders and avoids
// the dark-navy flash on outline/ghost buttons, and a top-center Toaster matches
// the portal. Keep this in sync with app/liff/layout.tsx.

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f97316',
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="liff-theme">
      {children}
      {/* Renders only on /team/(e|p)/<slug>; includes its own spacer */}
      <TeamBottomNav />
      <Toaster position="top-center" />
    </div>
  )
}

'use client'

// Upgrade plain /team links to the Team LIFF, BEFORE LiffProvider runs.
//
// Why before: liff.init (withLoginOnExternalBrowser) may auto-login on a plain
// URL inside LINE's in-app browser and return the user to the LIFF ENDPOINT
// ROOT (/team) — losing the team path entirely (the "กรุณาเปิดผ่านลิงก์ทีม"
// dead end). So we decide first: opened inside LINE but not as a LIFF app →
// bounce once to the liff.line.me deep link, which reopens this page in the
// LIFF browser with silent auth.
//
// Loop safety: the deep link carries ?li=1 (survives the liff.state round trip)
// so the reopened page skips the bounce; SPA tab switches skip it because the
// live LIFF instance already reports isInClient.

import { useEffect, useState } from 'react'
import { getLiffInstance } from '@/lib/line/liff-client'
import { Loading } from '@/components/ui/loading'

export function LiffUpgradeGate({
  kind,
  slug,
  children,
}: {
  kind: 'e' | 'p'
  slug: string
  children: React.ReactNode
}) {
  // null = undecided (first client render), true = navigating away
  const [redirecting, setRedirecting] = useState<boolean | null>(null)

  useEffect(() => {
    const vexId = process.env.NEXT_PUBLIC_VEX_LIFF_ID
    const marked = new URLSearchParams(window.location.search).get('li') === '1'
    const inLine = /\bLine\//i.test(navigator.userAgent)
    const alreadyLiff = getLiffInstance()?.isInClient() === true
    if (vexId && inLine && !marked && !alreadyLiff) {
      setRedirecting(true)
      window.location.replace(`https://liff.line.me/${vexId}/${kind}/${slug}?li=1`)
      return
    }
    setRedirecting(false)
  }, [kind, slug])

  if (redirecting !== false) return <Loading fullScreen size="lg" />
  return <>{children}</>
}

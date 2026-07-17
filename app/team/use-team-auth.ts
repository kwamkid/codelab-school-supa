'use client'

// Shared auth+fetch logic for the /team parent portal, supporting BOTH:
//  - LINE in-app browser → LIFF ID token (liff.login() if needed)
//  - external browser (Safari/Chrome) → web-login session cookie
//
// Flow: once LIFF has initialised, load the summary. On 401 (no identity):
//   - inside LINE  → liff.login() (LIFF handles it on the same origin)
//   - outside LINE → redirect to /api/team/line-login (LINE web OAuth), which
//     comes back to this same URL with a session cookie set.
// On 403 → the parent isn't registered; show the LineGate ("ติดต่อแอดมิน").

import { useEffect, useState, useCallback } from 'react'
import { useLiff } from '@/components/liff/liff-provider'
import { vexLiffFetch } from './vex-liff-fetch'

interface UseTeamAuthResult<T> {
  data: T | null
  loading: boolean
  gate: string | null
  /** Identity for API bodies (LIFF fallback userId). Null outside LINE. */
  lineUserId: string | null
  /** Re-run the summary fetch. */
  reload: () => void
  /** Call a /team API with the current identity attached. */
  call: <R = any>(path: string, body: any, method?: 'POST' | 'PATCH' | 'DELETE') => Promise<R>
}

export function useTeamAuth<T = any>(
  slug: string,
  kind: 'event' | 'practice'
): UseTeamAuthResult<T> {
  const { liff, isLoading: liffLoading, isInClient, isLoggedIn } = useLiff()
  const lineUserId = null as string | null // set below once profile resolves

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [gate, setGate] = useState<string | null>(null)

  // Resolve the LIFF profile userId (only meaningful inside LINE).
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    ;(async () => {
      if (isInClient && isLoggedIn && liff) {
        try {
          const p = await liff.getProfile()
          if (active) setProfileUserId(p.userId)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      active = false
    }
  }, [liff, isInClient, isLoggedIn])

  const call = useCallback(
    <R = any,>(path: string, body: any, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') =>
      vexLiffFetch<R>(path, body, profileUserId, method),
    [profileUserId]
  )

  const load = useCallback(async () => {
    try {
      const res = await vexLiffFetch<T>(`/api/liff/vex/${slug}/summary`, { kind }, profileUserId)
      setData(res)
      setGate(null)
    } catch (e: any) {
      if (e?.status === 401) {
        // No identity yet.
        if (isInClient && liff) {
          // Inside LINE: let LIFF log the user in. redirectUri is REQUIRED here:
          // /team/* is outside the LIFF endpoint path (/liff), so a bare
          // liff.login() bounces back to the endpoint root — the parent portal —
          // instead of this team page.
          liff.login({ redirectUri: window.location.href })
          return
        }
        // Outside LINE: kick off the web-login OAuth flow, returning here after.
        const ret = typeof window !== 'undefined' ? window.location.pathname : '/team'
        window.location.href = `/api/team/line-login?return=${encodeURIComponent(ret)}`
        return
      }
      if (e?.status === 403) setGate(e.message)
      else if (e?.status === 404) setGate('ไม่พบทีม (ลิงก์ไม่ถูกต้อง)')
      else setGate(e?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [slug, kind, profileUserId, isInClient, liff])

  useEffect(() => {
    if (liffLoading) return // wait for LIFF init to settle first
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liffLoading, profileUserId])

  return {
    data,
    loading: loading || liffLoading,
    gate,
    lineUserId: profileUserId,
    reload: load,
    call,
  }
}

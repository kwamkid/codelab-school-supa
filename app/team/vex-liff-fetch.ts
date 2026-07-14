// app/team/vex-liff-fetch.ts
// Like lib/line/liff-fetch, but also injects `lineUserId` into the body as the
// unverified fallback identity (resolveLiffUser uses it when the ID token isn't
// available / verifiable). Pass the userId from useLiff().profile.

import { getLiffInstance } from '@/lib/line/liff-client'

export async function vexLiffFetch<T = any>(
  path: string,
  body: any,
  lineUserId?: string | null,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST'
): Promise<T> {
  const liff = getLiffInstance()
  let idToken: string | null = null
  try {
    idToken = liff?.getIDToken?.() ?? null
  } catch {
    idToken = null
  }

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ ...(body || {}), ...(lineUserId ? { lineUserId } : {}) }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(data?.error || data?.message || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data as T
}

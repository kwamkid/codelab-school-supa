// lib/vex/team-session.ts
// Stateless signed cookie carrying a web-login LINE userId for the /team parent
// portal (the fallback path when the visitor is NOT inside the LINE in-app
// browser, so there's no LIFF ID token). HMAC-signed with the server secret — no
// DB session table. Value shape: base64url(payload).hmac  where payload = JSON
// { lineUserId, exp }.

import crypto from 'crypto'

const COOKIE_NAME = 'vex_team_line'
const MAX_AGE_SEC = 30 * 24 * 60 * 60 // 30 days

function key(): string {
  // Server-only secret; never shipped to the client.
  return process.env.SUPABASE_SECRET_KEY || ''
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(payloadB64: string): string {
  return b64url(crypto.createHmac('sha256', key()).update(payloadB64).digest())
}

export const TEAM_SESSION_COOKIE = COOKIE_NAME
export const TEAM_SESSION_MAX_AGE = MAX_AGE_SEC

/** Create the signed cookie value for a LINE userId. */
export function createTeamSession(lineUserId: string): string {
  const payload = { lineUserId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC }
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)))
  return `${payloadB64}.${sign(payloadB64)}`
}

/** Verify a cookie value; returns the lineUserId or null (bad sig / expired). */
export function verifyTeamSession(value: string | undefined | null): string | null {
  if (!value) return null
  const [payloadB64, sig] = value.split('.')
  if (!payloadB64 || !sig) return null

  const expected = sign(payloadB64)
  // constant-time compare
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'))
    if (!payload?.lineUserId) return null
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.lineUserId as string
  } catch {
    return null
  }
}

/** Read the team-session cookie from a request. */
export function readTeamSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') || ''
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

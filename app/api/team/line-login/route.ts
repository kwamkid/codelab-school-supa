// app/api/team/line-login/route.ts
// Start the LINE web-login (OAuth) flow for the /team parent portal — used when
// the visitor is OUTSIDE the LINE in-app browser (Safari/Chrome), where there's
// no LIFF ID token. Redirects to LINE's authorize endpoint; the callback sets a
// signed session cookie and returns the user to their original /team page.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLineSettings } from '@/lib/supabase/services/line-settings'

export const dynamic = 'force-dynamic'

function baseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get('x-forwarded-proto') || 'https') + '://' + request.headers.get('host')
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ret = searchParams.get('return') || '/team'
  // Only allow returning to a /team path (prevents open-redirect).
  const safeReturn = ret.startsWith('/team') ? ret : '/team'

  const settings = await getLineSettings()
  if (!settings.loginChannelId || !settings.loginChannelSecret) {
    return NextResponse.redirect(`${baseUrl(request)}${safeReturn}?line_error=not_configured`)
  }

  // CSRF nonce; state carries the return path + nonce, and we also stash the
  // nonce in a short-lived signed cookie the callback checks.
  const nonce = crypto.randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({ r: safeReturn, n: nonce })).toString('base64url')

  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', settings.loginChannelId)
  // Standard callback path — registered in the LINE console for the prod,
  // vercel, and ngrok domains (the old /api/team/line-callback stays as an
  // alias for in-flight logins).
  authorizeUrl.searchParams.set('redirect_uri', `${baseUrl(request)}/api/auth/callback/line`)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('scope', 'profile openid')

  const res = NextResponse.redirect(authorizeUrl.toString())
  res.cookies.set('vex_line_state', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 min
  })
  return res
}

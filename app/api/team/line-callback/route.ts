// app/api/team/line-callback/route.ts
// LINE web-login OAuth callback for the /team parent portal. Exchanges the code
// for a token, reads the LINE userId, sets a signed session cookie, and redirects
// back to the original /team page. (Identity → parent mapping + the "not
// registered" gate happen in the /team API routes, same as the LIFF path.)

import { NextRequest, NextResponse } from 'next/server'
import { getLineSettings } from '@/lib/supabase/services/line-settings'
import { createTeamSession, TEAM_SESSION_COOKIE, TEAM_SESSION_MAX_AGE } from '@/lib/vex/team-session'

export const dynamic = 'force-dynamic'

function baseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get('x-forwarded-proto') || 'https') + '://' + request.headers.get('host')
  )
}

export async function GET(request: NextRequest) {
  const base = baseUrl(request)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Decode state → { r: returnPath, n: nonce }
  let ret = '/team'
  let nonce = ''
  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
      if (typeof parsed?.r === 'string' && parsed.r.startsWith('/team')) ret = parsed.r
      if (typeof parsed?.n === 'string') nonce = parsed.n
    }
  } catch {
    // fall through with defaults
  }

  if (error || !code) {
    return NextResponse.redirect(`${base}${ret}?line_error=${error || 'no_code'}`)
  }

  // CSRF check: nonce in state must match the cookie set at login start.
  const cookieNonce = request.cookies.get('vex_line_state')?.value
  if (!nonce || !cookieNonce || nonce !== cookieNonce) {
    return NextResponse.redirect(`${base}${ret}?line_error=bad_state`)
  }

  const settings = await getLineSettings()
  if (!settings.loginChannelId || !settings.loginChannelSecret) {
    return NextResponse.redirect(`${base}${ret}?line_error=not_configured`)
  }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${base}/api/team/line-callback`,
        client_id: settings.loginChannelId,
        client_secret: settings.loginChannelSecret,
      }),
      cache: 'no-store',
    })
    if (!tokenRes.ok) {
      console.error('[team line-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${base}${ret}?line_error=token_exchange_failed`)
    }
    const tokenData = await tokenRes.json()

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    })
    if (!profileRes.ok) {
      console.error('[team line-callback] profile fetch failed:', await profileRes.text())
      return NextResponse.redirect(`${base}${ret}?line_error=profile_fetch_failed`)
    }
    const profile = await profileRes.json()
    if (!profile?.userId) {
      return NextResponse.redirect(`${base}${ret}?line_error=no_user`)
    }

    const res = NextResponse.redirect(`${base}${ret}`)
    res.cookies.set(TEAM_SESSION_COOKIE, createTeamSession(profile.userId), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: TEAM_SESSION_MAX_AGE,
    })
    // clear the one-time state nonce
    res.cookies.set('vex_line_state', '', { path: '/', maxAge: 0 })
    return res
  } catch (e) {
    console.error('[team line-callback] error:', e)
    return NextResponse.redirect(`${base}${ret}?line_error=server_error`)
  }
}

// app/api/teacher/line-link/route.ts
// Start the LINE web-login (OAuth) flow for a LOGGED-IN teacher so we can store
// their real LINE userId on teachers.line_user_id and push notifications to them.
//
// Identity comes from the Supabase session cookie (the teacher is already logged
// into the admin app), so the browser never gets to say which teacher it is —
// state only carries the teacher id we resolved server-side.
//
// Reuses the /api/auth/callback/line callback (already registered in the LINE
// console for every domain); the callback branches on state.p === 'teacher_link'.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLineSettings } from '@/lib/supabase/services/line-settings'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
  const ret = searchParams.get('return') || '/teacher'
  // Internal paths only (no protocol-relative "//evil.com") — prevents open-redirect.
  const safeReturn = ret.startsWith('/') && !ret.startsWith('//') ? ret : '/teacher'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${base}/login`)

  // auth user → admin_users → the linked teachers row (teacher_id, not admin id)
  const svc = createServiceClient()
  const { data: adminUser } = await svc
    .from('admin_users')
    .select('id, teacher_id, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!adminUser?.is_active) {
    return NextResponse.redirect(`${base}${safeReturn}?line_error=forbidden`)
  }
  if (!adminUser.teacher_id) {
    // Staff account with no teachers row — nothing to attach the LINE id to.
    return NextResponse.redirect(`${base}${safeReturn}?line_error=no_teacher_profile`)
  }

  const settings = await getLineSettings()
  if (!settings.loginChannelId || !settings.loginChannelSecret) {
    return NextResponse.redirect(`${base}${safeReturn}?line_error=not_configured`)
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = Buffer.from(
    JSON.stringify({ r: safeReturn, n: nonce, p: 'teacher_link', t: adminUser.teacher_id })
  ).toString('base64url')

  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', settings.loginChannelId)
  authorizeUrl.searchParams.set('redirect_uri', `${base}/api/auth/callback/line`)
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

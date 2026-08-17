// app/api/teacher/line-link/route.ts
// POST { returnPath } → { authorizeUrl } : start linking the logged-in teacher's
// LINE account. The client then does window.location.href = authorizeUrl.
//
// Why POST-then-redirect instead of a plain <a href>: this app keeps its Supabase
// session in localStorage (not cookies), so a browser-navigated GET carries no
// identity. Going through authFetch lets us verify the teacher server-side with
// the same Bearer token every other protected route uses, and only THEN mint the
// LINE authorize URL — the browser never gets to claim which teacher it is.
//
// The CSRF nonce rides back as a Set-Cookie on this response; the shared callback
// /api/auth/callback/line checks it and branches on state.p === 'teacher_link'.

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLineSettings } from '@/lib/supabase/services/line-settings'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function baseUrl(request: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get('x-forwarded-proto') || 'https') + '://' + request.headers.get('host')
  )
}

export async function POST(request: Request) {
  const staff = await requireStaff(bearer(request.headers.get('authorization')))
  if (!staff.ok) {
    return NextResponse.json({ error: staff.error }, { status: staff.status ?? 401 })
  }

  const svc = createServiceClient()
  const { data: adminUser } = await svc
    .from('admin_users')
    .select('teacher_id')
    .eq('id', staff.adminId!)
    .maybeSingle()
  if (!adminUser?.teacher_id) {
    return NextResponse.json({ error: 'บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลครู' }, { status: 404 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // no body → default return path
  }
  const ret = typeof body?.returnPath === 'string' ? body.returnPath : '/teacher'
  // Internal paths only (no protocol-relative "//evil.com") — prevents open-redirect.
  const safeReturn = ret.startsWith('/') && !ret.startsWith('//') ? ret : '/teacher'

  const settings = await getLineSettings()
  if (!settings.loginChannelId || !settings.loginChannelSecret) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า LINE Login ในระบบ' }, { status: 500 })
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = Buffer.from(
    JSON.stringify({ r: safeReturn, n: nonce, p: 'teacher_link', t: adminUser.teacher_id })
  ).toString('base64url')

  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', settings.loginChannelId)
  authorizeUrl.searchParams.set('redirect_uri', `${baseUrl(request)}/api/auth/callback/line`)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('scope', 'profile openid')

  const res = NextResponse.json({ authorizeUrl: authorizeUrl.toString() })
  res.cookies.set('vex_line_state', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 min
  })
  return res
}

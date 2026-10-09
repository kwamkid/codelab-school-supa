// app/api/admin/track-view/route.ts
// POST { path, menu, menuHref } → log one admin page view into admin_page_views
// (migration 20261009_trial_followups_and_usage). Fired by the admin layout on
// every navigation; best-effort — failures never surface to the user.
// Auth uses the 60 s scope cache so a navigation costs one insert, not 3 round-trips.

import { NextRequest, NextResponse } from 'next/server'
import { requireStaffScope, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireStaffScope(bearer(request.headers.get('authorization')), { cache: true })
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const path = typeof body.path === 'string' ? body.path.slice(0, 200) : ''
    if (!path.startsWith('/')) return NextResponse.json({ error: 'path ไม่ถูกต้อง' }, { status: 400 })
    const menu = typeof body.menu === 'string' && body.menu ? body.menu.slice(0, 100) : null
    const menuHref = typeof body.menuHref === 'string' && body.menuHref.startsWith('/') ? body.menuHref.slice(0, 200) : null

    const supabase = createServiceClient() as any
    const { error } = await supabase.from('admin_page_views').insert({
      admin_user_id: auth.adminId ?? null,
      role: auth.role ?? null,
      path,
      menu,
      menu_href: menuHref,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[track-view] error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

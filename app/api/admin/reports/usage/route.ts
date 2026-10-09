// app/api/admin/reports/usage/route.ts
// GET → which admin menus get used, by whom (super_admin only).
// ONE round-trip via get_menu_usage (migration 20261009_trial_followups_and_usage).
// Query: ?days=<n> (default 30)

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 30, 1), 365)
    const supabase = createServiceClient() as any
    const { data, error } = await supabase.rpc('get_menu_usage', { p_days: days })
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('[reports/usage] error:', e)
    return NextResponse.json({ error: 'โหลดสถิติไม่สำเร็จ' }, { status: 500 })
  }
}

// app/api/admin/trial/followups/route.ts
// GET → attended trials whose family hasn't enrolled since (tab "ควรโทรตาม" on /trial).
// ONE round-trip via get_trial_followups (migration 20261009_trial_followups_and_usage).
// Query: ?branchId=<uuid>&days=<n> (default 120)
//
// Access: same as the /trial menu — super_admin + branch_admin only (teachers 403).
// Branch admins are clamped to their own admin_users.branch_ids: a branchId
// outside it → 403, no branchId → only their branches (contains parent phones).

import { NextRequest, NextResponse } from 'next/server'
import { requireStaffScope, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireStaffScope(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || null
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 120, 1), 3650)

    let branchIds: string[] | null
    if (auth.branchIds === null) {
      branchIds = branchId ? [branchId] : null
    } else {
      if (branchId && !auth.branchIds.includes(branchId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      branchIds = branchId ? [branchId] : auth.branchIds
      if (branchIds.length === 0) return NextResponse.json({ rows: [] })
    }

    const supabase = createServiceClient() as any
    const { data, error } = await supabase.rpc('get_trial_followups', { p_branch_ids: branchIds, p_days: days })
    if (error) throw error
    return NextResponse.json({ rows: data ?? [] })
  } catch (e) {
    console.error('[trial/followups] error:', e)
    return NextResponse.json({ error: 'โหลดรายชื่อไม่สำเร็จ' }, { status: 500 })
  }
}

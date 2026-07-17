// app/api/admin/vex/report/route.ts
// GET → aggregate report over kids registered in VEX teams: schools, ages, and
// CodeLab courses taken (+ per-level / per-branch breakdowns, with kid-name
// lists for the hover popovers). ONE Postgres round-trip via the
// get_vex_team_report RPC — the joins/aggregation live in SQL (migration
// 20260718_vex_team_report_rpc). Optional ?branchId= scopes to one branch.

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/vex/api'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || null

    const supabase = createServiceClient() as any
    const { data, error } = await supabase.rpc('get_vex_team_report', { p_branch_id: branchId })
    if (error) throw error

    return NextResponse.json(data)
  } catch (e) {
    console.error('[vex report] error:', e)
    return NextResponse.json({ error: 'โหลดรายงานไม่สำเร็จ' }, { status: 500 })
  }
}

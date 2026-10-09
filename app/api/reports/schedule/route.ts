// app/api/reports/schedule/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireReportScope } from '@/lib/server/report-scope'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const access = await requireReportScope(request.headers.get('authorization'), searchParams.get('branchId'))
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status })

    const supabase = createServiceClient()
    const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Saturday)
    const weekEnd = searchParams.get('weekEnd')     // YYYY-MM-DD (Friday)

    // Single RPC returns regular classes + makeup + trial slots for the week,
    // already shaped for the report grid (see migration 20260607_weekly_timetable_rpc.sql).
    // Branch admins with several branches and no branch picked → one call per branch.
    const branchList: (string | null)[] = access.branchId || !access.branchIds ? [access.branchId ?? null] : access.branchIds
    let data: any = []
    for (const b of branchList) {
      const { data: rows, error } = await (supabase as any).rpc('get_weekly_timetable', {
        p_week_start: weekStart,
        p_week_end: weekEnd,
        p_branch_id: b,
      })
      if (error) {
        console.error('Error fetching weekly timetable:', error)
        throw error
      }
      if (branchList.length === 1) data = rows || []
      else if (Array.isArray(rows)) data.push(...rows)
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in schedule report API:', error)
    return NextResponse.json(
      { success: false, message: 'Error fetching schedule data' },
      { status: 500 }
    )
  }
}

// app/api/reports/schedule/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Saturday)
    const weekEnd = searchParams.get('weekEnd')     // YYYY-MM-DD (Friday)

    // Single RPC returns regular classes + makeup + trial slots for the week,
    // already shaped for the report grid (see migration 20260607_weekly_timetable_rpc.sql).
    const { data, error } = await (supabase as any).rpc('get_weekly_timetable', {
      p_week_start: weekStart,
      p_week_end: weekEnd,
      p_branch_id: branchId || null,
    })

    if (error) {
      console.error('Error fetching weekly timetable:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    console.error('Error in schedule report API:', error)
    return NextResponse.json(
      { success: false, message: 'Error fetching schedule data' },
      { status: 500 }
    )
  }
}

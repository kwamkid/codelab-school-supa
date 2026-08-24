// app/api/admin/reports/teacher-monthly/route.ts
// GET → per-teacher monthly evaluation numbers (sessions taught / attendance
// checked / Teacher-Feedback sent, + makeup & trial). ONE Postgres round-trip
// via get_teacher_monthly_report (migration 20260824_teacher_monthly_report_rpc).
// Query: ?month=YYYY-MM (default: current month, Bangkok) & ?branchId=<uuid>

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const branchId = searchParams.get('branchId') || null

    // The RPC takes any date inside the month; null = current month in Bangkok.
    let pMonth: string | null = null
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'month ต้องเป็นรูปแบบ YYYY-MM' }, { status: 400 })
      }
      pMonth = `${month}-01`
    }

    const supabase = createServiceClient() as any
    const { data, error } = await supabase.rpc('get_teacher_monthly_report', {
      p_month: pMonth,
      p_branch_id: branchId,
    })
    if (error) throw error

    return NextResponse.json(data)
  } catch (e) {
    console.error('[reports/teacher-monthly] error:', e)
    return NextResponse.json({ error: 'โหลดรายงานไม่สำเร็จ' }, { status: 500 })
  }
}

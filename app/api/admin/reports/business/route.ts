// app/api/admin/reports/business/route.ts
// GET → super-admin business overview (sales / cash / families / trial
// conversion / attendance-check / feedback per month × branch). ONE Postgres
// round-trip via get_business_dashboard (migration 20261009_business_dashboard_rpc).
// Computed live on every request — no cache, so the page is always current.
// Query: ?from=YYYY-MM&to=YYYY-MM (default: last 12 months incl. current, Bangkok)

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MONTH_RE = /^\d{4}-\d{2}$/

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if ((from && !MONTH_RE.test(from)) || (to && !MONTH_RE.test(to))) {
      return NextResponse.json({ error: 'from/to ต้องเป็นรูปแบบ YYYY-MM' }, { status: 400 })
    }

    const supabase = createServiceClient() as any
    const { data, error } = await supabase.rpc('get_business_dashboard', {
      p_from: from ? `${from}-01` : null,
      p_to: to ? `${to}-01` : null,
    })
    if (error) throw error

    return NextResponse.json(data)
  } catch (e) {
    console.error('[reports/business] error:', e)
    return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}

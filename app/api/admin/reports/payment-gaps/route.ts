// app/api/admin/reports/payment-gaps/route.ts
// GET → super-admin list of enrollments whose money isn't fully recorded:
// 'unrecorded' (status ชำระแล้ว but paid_amount < price — legacy rows) and
// 'unpaid' (ค้างชำระจริง), with class progress + end date.
// ONE round-trip via get_payment_gaps (migration 20261009_business_dashboard_rpc).

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const supabase = createServiceClient() as any
    const { data, error } = await supabase.rpc('get_payment_gaps')
    if (error) throw error
    return NextResponse.json({ rows: data ?? [], generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[reports/payment-gaps] error:', e)
    return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}

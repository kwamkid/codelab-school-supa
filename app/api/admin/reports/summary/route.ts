// app/api/admin/reports/summary/route.ts
// GET → compact "สรุปผล" for the hidden page /reports/summary (direct link only, no menu):
// sales per month × branch + attendance-check / Teacher-Feedback per month and per teacher.
// Reuses the two existing RPCs so numbers match /reports/business and /reports/teacher-monthly:
//   get_business_dashboard(p_from, p_to)  → sales, cash, enrollments, families, trials
//   get_teacher_monthly_report(p_month)   → one call per month (run in parallel)
// Query: ?months=N  (N previous full months + the current month, default 3, max 12)

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { addMonthsYm, bangkokMonth } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const n = Math.min(12, Math.max(1, Number(new URL(request.url).searchParams.get('months')) || 3))
    const to = bangkokMonth()
    const months = Array.from({ length: n + 1 }, (_, i) => addMonthsYm(to, i - n))

    const supabase = createServiceClient() as any
    const [biz, ...teacherMonths] = await Promise.all([
      supabase.rpc('get_business_dashboard', { p_from: `${months[0]}-01`, p_to: `${to}-01` }),
      ...months.map((m) => supabase.rpc('get_teacher_monthly_report', { p_month: `${m}-01`, p_branch_id: null })),
    ])
    if (biz.error) throw biz.error
    const bad = teacherMonths.find((r: any) => r.error)
    if (bad) throw bad.error

    const b = biz.data
    return NextResponse.json({
      generatedAt: b.generatedAt,
      today: b.today,
      months,
      branches: b.branches,
      monthly: b.monthly,
      familiesAll: b.familiesAll,
      newFamiliesInRange: b.newFamiliesInRange,
      teacherMonths: teacherMonths.map((r: any) => ({
        month: r.data.month,
        partial: r.data.partial,
        cutoff: r.data.cutoff,
        totals: r.data.totals,
        teachers: (r.data.teachers || []).map((t: any) => ({
          id: t.id,
          name: t.nickname || t.name,
          fullName: t.name,
          isActive: t.isActive,
          sessions: t.sessions,
          checked: t.checked,
          selfChecked: t.selfChecked,
          fbSessions: t.fbSessions,
          fbStudents: t.fbStudents,
          photoSessions: t.photoSessions,
          attended: t.attended,
          makeupTotal: t.makeupTotal,
          makeupChecked: t.makeupChecked,
        })),
      })),
    })
  } catch (e) {
    console.error('[reports/summary] error:', e)
    return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}

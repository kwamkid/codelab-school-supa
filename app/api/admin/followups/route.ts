// app/api/admin/followups/route.ts
// ติดตามลูกค้า (/followups) — super_admin + branch_admin (ครู 403, แอดมินสาขา clamp ตาม branch_ids)
//  GET  ?branchId=&trialDays=120&minStreak=2&endingDays=30
//       → { trial, atRisk, ending } (RPC get_trial_followups / get_at_risk_students / get_ending_students)
//  POST { kind: 'trial'|'at_risk'|'ending', refId, episode, status: 'contacted'|'no_answer', reason?, note? }
//       → บันทึกการติดต่อของ "รอบ" นั้น (customer_followups)
// migration 20261010_customer_followups

import { NextRequest, NextResponse } from 'next/server'
import { requireStaffScope, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const KINDS = ['trial', 'at_risk', 'ending'] as const
const STATUSES = ['contacted', 'no_answer'] as const
type Kind = (typeof KINDS)[number]

const clamp = (v: string | null, def: number, min: number, max: number) =>
  Math.min(Math.max(Number(v) || def, min), max)

async function auth(request: NextRequest) {
  const scope = await requireStaffScope(bearer(request.headers.get('authorization')))
  if (!scope.ok) return { error: NextResponse.json({ error: scope.error }, { status: scope.status }) }
  if (scope.role === 'teacher') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { scope }
}

export async function GET(request: NextRequest) {
  const { scope, error } = await auth(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || null

    let branchIds: string[] | null
    if (scope!.branchIds === null) {
      branchIds = branchId ? [branchId] : null
    } else {
      if (branchId && !scope!.branchIds.includes(branchId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      branchIds = branchId ? [branchId] : scope!.branchIds
      if (branchIds.length === 0) return NextResponse.json({ trial: [], atRisk: [], ending: [] })
    }

    const supabase = createServiceClient() as any
    const [trial, atRisk, ending] = await Promise.all([
      supabase.rpc('get_trial_followups', { p_branch_ids: branchIds, p_days: clamp(searchParams.get('trialDays'), 120, 1, 3650) }),
      supabase.rpc('get_at_risk_students', { p_branch_ids: branchIds, p_min_streak: clamp(searchParams.get('minStreak'), 2, 1, 20) }),
      supabase.rpc('get_ending_students', { p_branch_ids: branchIds, p_days: clamp(searchParams.get('endingDays'), 30, 1, 365) }),
    ])
    for (const r of [trial, atRisk, ending]) if (r.error) throw r.error
    return NextResponse.json({ trial: trial.data ?? [], atRisk: atRisk.data ?? [], ending: ending.data ?? [] })
  } catch (e) {
    console.error('[followups] GET error:', e)
    return NextResponse.json({ error: 'โหลดรายชื่อไม่สำเร็จ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { scope, error } = await auth(request)
  if (error) return error

  try {
    const body = await request.json().catch(() => ({}))
    const kind: Kind | null = KINDS.includes(body.kind) ? body.kind : null
    const refId = typeof body.refId === 'string' ? body.refId : ''
    const episode = typeof body.episode === 'string' ? body.episode.slice(0, 64) : ''
    const status = STATUSES.includes(body.status) ? body.status : null
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 100) || null : null
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null

    if (!kind || !refId || !episode || !status) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    if (status === 'contacted' && !reason) return NextResponse.json({ error: 'กรุณาเลือกผลการคุย' }, { status: 400 })

    const supabase = createServiceClient() as any
    // resolve the ref's branch (and that it exists) for the branch-admin clamp
    const { data: ref } = kind === 'trial'
      ? await supabase.from('trial_sessions').select('id, branch_id').eq('id', refId).maybeSingle()
      : await supabase.from('enrollments').select('id, branch_id').eq('id', refId).maybeSingle()
    if (!ref) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    if (scope!.branchIds !== null && !scope!.branchIds.includes(ref.branch_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: me } = await supabase
      .from('admin_users').select('nickname, display_name').eq('id', scope!.adminId).maybeSingle()

    const { error: insError } = await supabase.from('customer_followups').insert({
      kind,
      ref_id: refId,
      episode,
      branch_id: ref.branch_id,
      status,
      reason,
      note,
      created_by: scope!.adminId,
      created_by_name: me?.nickname || me?.display_name || null,
    })
    if (insError) throw insError
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[followups] POST error:', e)
    return NextResponse.json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}

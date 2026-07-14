// app/api/admin/vex/practices/route.ts
// GET → all practice proposals (optionally ?status= / ?team_id=), enriched with
// the kid nickname + team number/name for the admin review list.

import { NextResponse } from 'next/server'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const url = new URL(request.url)
  const status = url.searchParams.get('status') // proposed | approved | rejected | all
  const teamId = url.searchParams.get('team_id')
  const VALID_STATUSES = ['proposed', 'approved', 'rejected']

  const db = vexDb()
  try {
    let q = db.from('practices').select('*')
    // 'all' (or anything not a real enum value) → no status filter.
    if (status && VALID_STATUSES.includes(status)) q = q.eq('status', status)
    if (teamId && teamId !== 'all') q = q.eq('team_id', teamId)
    q = q.order('practice_date', { ascending: true }).order('created_at', { ascending: true })

    const { data: practices, error } = await q
    if (error) throw new Error(error.message)
    const rows = practices || []

    // Enrich with kid + team labels (small sets → fetch by id lists).
    const kidIds = Array.from(new Set(rows.map((p: any) => p.kid_id)))
    const teamIds = Array.from(new Set(rows.map((p: any) => p.team_id)))

    const [kidsRes, teamsRes] = await Promise.all([
      kidIds.length ? db.from('kids').select('id, nickname').in('id', kidIds) : Promise.resolve({ data: [] }),
      teamIds.length ? db.from('teams').select('id, team_number, name, branch_id').in('id', teamIds) : Promise.resolve({ data: [] }),
    ])
    const kidMap = new Map<string, any>((kidsRes.data || []).map((k: any) => [k.id, k]))
    const teamMap = new Map<string, any>((teamsRes.data || []).map((t: any) => [t.id, t]))

    const enriched = rows.map((p: any) => ({
      ...p,
      kidNickname: kidMap.get(p.kid_id)?.nickname ?? null,
      teamNumber: teamMap.get(p.team_id)?.team_number ?? null,
      teamName: teamMap.get(p.team_id)?.name ?? null,
      branch_id: teamMap.get(p.team_id)?.branch_id ?? null,
    }))

    return NextResponse.json({ practices: enriched })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

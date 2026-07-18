// app/api/admin/vex/practices/route.ts
// GET  → all practice proposals (optionally ?status= / ?team_id=), enriched with
//        the kid nickname + team number/name for the admin review list.
// POST → admin schedules a practice directly for one or more kids of a team.
//        Created rows are APPROVED immediately (no review — the admin is the
//        reviewer); parents get a "แอดมินนัดซ้อม" LINE notification.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'
import { notifyParentPractice } from '@/lib/vex/notify'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  // Kids may span teams — each practice row gets its own kid's team_id.
  kid_ids: z.array(z.string().uuid()).min(1),
  practice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  note: z.string().trim().max(500).optional(),
})

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  try {
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }
    const { kid_ids, practice_date, start_time, end_time, note } = parsed.data

    const db = vexDb()

    // Resolve the kids (VEX kids only) with their own team.
    const { data: kids, error: kidsError } = await db
      .from('kids')
      .select('id, nickname, team_id')
      .in('id', kid_ids)
    if (kidsError) throw new Error(kidsError.message)
    if (!kids || kids.length === 0) {
      return NextResponse.json({ error: 'ไม่พบเด็กที่เลือก' }, { status: 400 })
    }

    // Skip kids who already have a non-rejected practice on that date.
    const { data: existing } = await db
      .from('practices')
      .select('kid_id')
      .eq('practice_date', practice_date)
      .neq('status', 'rejected')
      .in('kid_id', kids.map((k: any) => k.id))
    const already = new Set((existing || []).map((p: any) => p.kid_id))
    const toCreate = kids.filter((k: any) => !already.has(k.id))

    if (toCreate.length === 0) {
      return NextResponse.json(
        { error: 'เด็กที่เลือกมีตารางซ้อมวันนั้นอยู่แล้วทุกคน' },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const rows = toCreate.map((k: any) => ({
      team_id: k.team_id,
      kid_id: k.id,
      parent_id: null, // admin-created, not a parent submission
      practice_date,
      start_time,
      end_time,
      note: note || null,
      status: 'approved', // admin schedules → no review round-trip
      reviewed_by: admin.adminId,
      reviewed_at: now,
    }))

    const { data: created, error: insertError } = await db
      .from('practices')
      .insert(rows)
      .select('*')
    if (insertError) throw new Error(insertError.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'create_scheduled_practice',
      entity: 'practice',
      entityId: null,
      after: { practice_date, start_time, end_time, kids: toCreate.map((k: any) => k.nickname) },
    })

    // Tell each kid's parent (best-effort; cron drains the queue if send fails).
    for (const p of created || []) {
      const kid = toCreate.find((k: any) => k.id === p.kid_id)
      await notifyParentPractice(p as any, 'scheduled', kid?.nickname ?? null)
    }

    return NextResponse.json({
      created: created?.length || 0,
      skipped: kids.length - toCreate.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

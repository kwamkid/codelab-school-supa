// app/api/admin/vex/practices/route.ts
// GET  → all practice proposals (optionally ?status= / ?team_id=), enriched with
//        the kid nickname + team number/name for the admin review list.
// POST → admin schedules a practice directly for one or more kids of a team.
//        Created rows are APPROVED immediately (no review — the admin is the
//        reviewer); parents get a "แอดมินนัดซ้อม" LINE notification.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { restSelect } from '@/lib/supabase/rest'
import { requireAdmin, requireViewer } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'
import { notifyParentPractice, notifyCoachPractice } from '@/lib/vex/notify'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  // Kids may span teams — each practice row gets its own kid's team_id.
  kid_ids: z.array(z.string().uuid()).min(1),
  // One or many dates — same kids + time across all of them (kids × dates rows).
  practice_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(31),
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
    const { kid_ids, practice_dates, start_time, end_time, note } = parsed.data
    const dates = [...new Set(practice_dates)].sort()

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

    // Skip kid×date combos that already have a non-rejected practice.
    const { data: existing } = await db
      .from('practices')
      .select('kid_id, practice_date')
      .in('practice_date', dates)
      .neq('status', 'rejected')
      .in('kid_id', kids.map((k: any) => k.id))
    const already = new Set((existing || []).map((p: any) => `${p.kid_id}|${p.practice_date}`))

    const now = new Date().toISOString()
    const rows = kids.flatMap((k: any) =>
      dates
        .filter((d) => !already.has(`${k.id}|${d}`))
        .map((d) => ({
          team_id: k.team_id,
          kid_id: k.id,
          parent_id: null, // admin-created, not a parent submission
          practice_date: d,
          start_time,
          end_time,
          note: note || null,
          status: 'approved', // admin schedules → no review round-trip
          reviewed_by: admin.adminId,
          reviewed_at: now,
        }))
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'เด็กที่เลือกมีตารางซ้อมวันที่เลือกอยู่แล้วทั้งหมด' },
        { status: 409 }
      )
    }

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
      after: { practice_dates: dates, start_time, end_time, kids: kids.map((k: any) => k.nickname) },
    })

    // One LINE message per kid covering ALL their new dates (not one per row —
    // a 4-date schedule shouldn't spam the parent 4 times).
    const createdByKid = new Map<string, any[]>()
    for (const p of created || []) {
      const list = createdByKid.get(p.kid_id) || []
      list.push(p)
      createdByKid.set(p.kid_id, list)
    }
    for (const [kidId, practices] of createdByKid) {
      const kid = kids.find((k: any) => k.id === kidId)
      const dates = practices.map((p) => p.practice_date)
      await notifyParentPractice(practices[0] as any, 'scheduled', kid?.nickname ?? null, dates)
      // แอดมินนัดเอง = อนุมัติทันที → ครูผู้ดูแลควรรู้ด้วย
      await notifyCoachPractice(practices[0] as any, kid?.nickname ?? null, dates)
    }

    return NextResponse.json({
      created: created?.length || 0,
      skipped: kids.length * dates.length - rows.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const admin = await requireViewer(request)
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
      teamIds.length
        ? db.from('teams').select('id, team_number, name, branch_id, coach_teacher_id').in('id', teamIds)
        : Promise.resolve({ data: [] }),
    ])
    const kidMap = new Map<string, any>((kidsRes.data || []).map((k: any) => [k.id, k]))
    const teamMap = new Map<string, any>((teamsRes.data || []).map((t: any) => [t.id, t]))

    // Submitter label: parent_id = the family that actually submitted (parents can
    // submit for another family's kid), null parent_id = admin-scheduled → reviewed_by.
    // Both live in public.* (vexDb is scoped to the vex schema) → restSelect.
    const parentIds = Array.from(new Set(rows.map((p: any) => p.parent_id).filter(Boolean)))
    const adminIds = Array.from(
      new Set(rows.filter((p: any) => !p.parent_id && p.reviewed_by).map((p: any) => p.reviewed_by))
    )
    const [submitterParents, submitterAdmins] = await Promise.all([
      parentIds.length
        ? restSelect<{ id: string; display_name: string | null; line_display_name: string | null }>('parents', {
            id: `in.(${parentIds.join(',')})`,
            select: 'id,display_name,line_display_name',
          }).catch(() => [])
        : Promise.resolve([]),
      adminIds.length
        ? restSelect<{ id: string; display_name: string | null }>('admin_users', {
            id: `in.(${adminIds.join(',')})`,
            select: 'id,display_name',
          }).catch(() => [])
        : Promise.resolve([]),
    ])
    // ครูผู้ดูแลของแต่ละทีม — ตารางซ้อมโชว์ว่าวันนั้นครูคนไหนรับผิดชอบ
    const coachIds = Array.from(
      new Set(Array.from(teamMap.values()).map((t: any) => t.coach_teacher_id).filter(Boolean))
    )
    const coachNameMap = new Map<string, string>()
    if (coachIds.length) {
      // ครูที่ปิดใช้งานแล้วไม่ต้องขึ้น — ทีมนั้นถือว่ายังไม่มีครูดูแล
      const coaches = await restSelect<{ id: string; name: string; nickname: string | null }>('teachers', {
        id: `in.(${coachIds.join(',')})`,
        is_active: 'eq.true',
        select: 'id,name,nickname',
      }).catch(() => [])
      for (const c of coaches) coachNameMap.set(c.id, c.nickname || c.name)
    }

    const parentNameMap = new Map<string, string | null>()
    for (const p of submitterParents) parentNameMap.set(p.id, p.display_name || p.line_display_name || null)
    const adminNameMap = new Map<string, string | null>()
    for (const a of submitterAdmins) adminNameMap.set(a.id, a.display_name || null)

    const enriched = rows.map((p: any) => ({
      ...p,
      kidNickname: kidMap.get(p.kid_id)?.nickname ?? null,
      teamNumber: teamMap.get(p.team_id)?.team_number ?? null,
      teamName: teamMap.get(p.team_id)?.name ?? null,
      branch_id: teamMap.get(p.team_id)?.branch_id ?? null,
      coachTeacherId: teamMap.get(p.team_id)?.coach_teacher_id ?? null,
      coachName: teamMap.get(p.team_id)?.coach_teacher_id
        ? coachNameMap.get(teamMap.get(p.team_id).coach_teacher_id) ?? null
        : null,
      submitterType: p.parent_id ? 'parent' : 'admin',
      submitterName: p.parent_id
        ? parentNameMap.get(p.parent_id) ?? null
        : adminNameMap.get(p.reviewed_by) ?? null,
    }))

    return NextResponse.json({ practices: enriched })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

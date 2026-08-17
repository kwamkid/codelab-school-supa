// app/api/admin/vex/events/attendance/route.ts
// POST { event_id, kid_id, status } → admin sets a kid's RSVP on behalf of the
// parent (บางบ้านแจ้งทางแชทแต่ไม่กดในระบบ). Same upsert as the parent-facing
// /api/liff/vex/[slug]/attendance, but guarded by requireAdmin and stamped
// updated_by = "แอดมิน <ชื่อ>" so the roster shows who last touched it.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  event_id: z.string().uuid(),
  kid_id: z.string().uuid(),
  status: z.enum(['pend', 'go', 'no']),
})

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  const { event_id, kid_id, status } = parsed.data

  const db = vexDb()
  try {
    // Kid → team (need the team's level to check the event is open to it).
    const { data: kid } = await db.from('kids').select('id, team_id, nickname').eq('id', kid_id).maybeSingle()
    if (!kid) return NextResponse.json({ error: 'ไม่พบนักเรียน' }, { status: 404 })

    const { data: team } = await db.from('teams').select('id, level').eq('id', kid.team_id).maybeSingle()
    if (!team) return NextResponse.json({ error: 'ไม่พบทีมของนักเรียน' }, { status: 404 })

    const { data: levelRow } = await db
      .from('event_levels')
      .select('event_id')
      .eq('event_id', event_id)
      .eq('level', team.level)
      .maybeSingle()
    if (!levelRow) {
      return NextResponse.json({ error: 'กิจกรรมนี้ไม่เปิดสำหรับระดับของทีมนี้' }, { status: 400 })
    }

    const { data: existing } = await db
      .from('attendance')
      .select('*')
      .eq('event_id', event_id)
      .eq('kid_id', kid_id)
      .maybeSingle()

    // Keep whatever parent_id is already on the row — an admin edit shouldn't
    // erase which family originally answered.
    const updatedBy = `แอดมิน ${admin.name || ''}`.trim()

    let saved: any
    if (existing) {
      const { data, error } = await db
        .from('attendance')
        .update({ status, updated_by: updatedBy, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      saved = data
    } else {
      const { data, error } = await db
        .from('attendance')
        .insert({ event_id, kid_id, status, updated_by: updatedBy })
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      saved = data
    }

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'attendance.admin_set',
      entity: 'attendance',
      entityId: saved.id,
      before: existing || null,
      after: saved,
    })

    return NextResponse.json({ attendance: saved })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// app/api/liff/vex/[slug]/attendance/route.ts
// POST { event_id, kid_id, status } → upsert this kid's RSVP for the event.
// Immediate, no approval. kid must belong to this team; event must be open to the
// team's level. parent_id is stamped from the resolved codelab parent.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { resolveLiffContext } from '@/lib/vex/liff-context'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  event_id: z.string().uuid(),
  kid_id: z.string().uuid(),
  status: z.enum(['pend', 'go', 'no']),
  lineUserId: z.string().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { event_id, kid_id, status } = parsed.data

  const ctx = await resolveLiffContext(request, body, slug, 'event')
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { team, parent } = ctx
  const db = vexDb()

  try {
    // kid must be on this team (any parent on the team may tick any kid).
    const { data: kid } = await db
      .from('kids')
      .select('id, team_id')
      .eq('id', kid_id)
      .maybeSingle()
    if (!kid || kid.team_id !== team.id) {
      return NextResponse.json({ error: 'ไม่พบเด็กในทีมนี้' }, { status: 400 })
    }

    // event must be open to this team's level.
    const { data: levelRow } = await db
      .from('event_levels')
      .select('event_id')
      .eq('event_id', event_id)
      .eq('level', team.level)
      .maybeSingle()
    if (!levelRow) {
      return NextResponse.json({ error: 'กิจกรรมนี้ไม่เปิดสำหรับทีมนี้' }, { status: 400 })
    }

    const { data: existing } = await db
      .from('attendance')
      .select('*')
      .eq('event_id', event_id)
      .eq('kid_id', kid_id)
      .maybeSingle()

    let saved: any
    if (existing) {
      const { data, error } = await db
        .from('attendance')
        .update({ status, parent_id: parent.id, updated_by: parent.displayName, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      saved = data
    } else {
      const { data, error } = await db
        .from('attendance')
        .insert({ event_id, kid_id, status, parent_id: parent.id, updated_by: parent.displayName })
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      saved = data
    }

    // Audit (best-effort, inlined here to avoid an extra import cycle risk).
    const { logAudit } = await import('@/lib/vex/audit')
    await logAudit({
      actorType: 'parent',
      actorId: parent.id,
      actorName: parent.displayName,
      action: 'attendance.set',
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

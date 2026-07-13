// app/api/admin/vex/events/[id]/route.ts
// PATCH  → update an event's fields and/or its levels (replaces event_levels when
//          `levels` is provided; must keep >=1 level).
// DELETE → remove the event (its attendance + event_levels are cleared first).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'
import { LEVELS } from '@/lib/vex/types'

export const dynamic = 'force-dynamic'

const levelEnum = z.enum(LEVELS as [string, ...string[]])

// All fields optional (partial update). `levels`, when present, replaces the set.
const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  date_start: z.string().date().nullable().optional(),
  date_end: z.string().date().nullable().optional(),
  place: z.string().trim().max(200).nullable().optional(),
  has_world_spot: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  levels: z.array(levelEnum).min(1).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const { id } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const { levels, ...fields } = parsed.data

  const db = vexDb()
  try {
    const { data: before } = await db.from('events').select('*').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 })

    // Update scalar fields (normalise empty → null for nullable columns).
    const patch: Record<string, any> = {}
    if (fields.name !== undefined) patch.name = fields.name
    if (fields.date_start !== undefined) patch.date_start = fields.date_start || null
    if (fields.date_end !== undefined) patch.date_end = fields.date_end || null
    if (fields.place !== undefined) patch.place = fields.place || null
    if (fields.has_world_spot !== undefined) patch.has_world_spot = fields.has_world_spot
    if (fields.sort_order !== undefined) patch.sort_order = fields.sort_order

    let updated = before
    if (Object.keys(patch).length) {
      const { data, error } = await db.from('events').update(patch).eq('id', id).select('*').single()
      if (error) throw new Error(error.message)
      updated = data
    }

    // Replace levels if provided.
    let finalLevels: string[] | undefined
    if (levels) {
      const uniqueLevels = Array.from(new Set(levels))
      await db.from('event_levels').delete().eq('event_id', id)
      const { error: lvlErr } = await db
        .from('event_levels')
        .insert(uniqueLevels.map((level) => ({ event_id: id, level })))
      if (lvlErr) throw new Error(lvlErr.message)
      finalLevels = uniqueLevels
    } else {
      const { data: lvlRows } = await db.from('event_levels').select('level').eq('event_id', id)
      finalLevels = (lvlRows || []).map((r: any) => r.level)
    }

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'event.update',
      entity: 'event',
      entityId: id,
      before,
      after: { ...updated, levels: finalLevels },
    })

    return NextResponse.json({ event: { ...updated, levels: finalLevels } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const { id } = await params
  const db = vexDb()

  try {
    const { data: before } = await db.from('events').select('*').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 })

    // Clear dependents (attendance references this event; event_levels too).
    await db.from('attendance').delete().eq('event_id', id)
    await db.from('event_levels').delete().eq('event_id', id)

    const { error } = await db.from('events').delete().eq('id', id)
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'event.delete',
      entity: 'event',
      entityId: id,
      before,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

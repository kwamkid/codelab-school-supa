// app/api/admin/vex/events/route.ts
// GET  → events (+ their levels). Optional ?level= filter (events open to that level).
// POST → create an event + its event_levels (>=1 level).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'
import { LEVELS, type Level } from '@/lib/vex/types'

export const dynamic = 'force-dynamic'

const levelEnum = z.enum(LEVELS as [string, ...string[]])

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  date_start: z.string().date().optional(),
  date_end: z.string().date().optional(),
  place: z.string().trim().max(200).optional(),
  has_world_spot: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
  levels: z.array(levelEnum).min(1),
})

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const url = new URL(request.url)
  const levelFilter = url.searchParams.get('level') as Level | null

  const db = vexDb()
  try {
    const { data: events, error } = await db
      .from('events')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('date_start', { ascending: true, nullsFirst: false })
    if (error) throw new Error(error.message)

    const { data: eventLevels } = await db.from('event_levels').select('*')
    const byEvent = new Map<string, Level[]>()
    for (const el of (eventLevels || [])) {
      const arr = byEvent.get(el.event_id) || []
      arr.push(el.level)
      byEvent.set(el.event_id, arr)
    }

    let result = (events || []).map((e: any) => ({ ...e, levels: byEvent.get(e.id) || [] }))
    if (levelFilter && LEVELS.includes(levelFilter)) {
      result = result.filter((e: any) => e.levels.includes(levelFilter))
    }

    return NextResponse.json({ events: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const { name, date_start, date_end, place, has_world_spot, sort_order, levels } = parsed.data

  const db = vexDb()
  try {
    const { data: event, error } = await db
      .from('events')
      .insert({
        name,
        date_start: date_start || null,
        date_end: date_end || null,
        place: place || null,
        has_world_spot,
        sort_order,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    const uniqueLevels = Array.from(new Set(levels))
    const { error: levelsError } = await db
      .from('event_levels')
      .insert(uniqueLevels.map((level) => ({ event_id: event.id, level })))
    if (levelsError) {
      // Roll back the orphaned event so we don't leave a level-less event.
      await db.from('events').delete().eq('id', event.id)
      throw new Error(levelsError.message)
    }

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'event.create',
      entity: 'event',
      entityId: event.id,
      after: { ...event, levels: uniqueLevels },
    })

    return NextResponse.json({ event: { ...event, levels: uniqueLevels } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

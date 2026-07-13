// app/api/admin/vex/teams/[id]/route.ts
// GET    → team + its kids.
// DELETE → cascade-delete the team (kids/attendance/practices go with it).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'
import { linkSlug } from '@/lib/vex/tokens'
import { LEVELS } from '@/lib/vex/types'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  team_number: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().max(120).nullable().optional(),
  level: z.enum(LEVELS as [string, ...string[]]).optional(),
})

/** Attach the two public link slugs to a team row for the response. */
function withLinks(team: any) {
  return {
    ...team,
    eventLink: team.event_token ? linkSlug(team.team_number, team.event_token) : null,
    practiceLink: team.practice_token ? linkSlug(team.team_number, team.practice_token) : null,
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const { id } = await params
  const db = vexDb()

  try {
    const { data: team, error } = await db.from('teams').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!team) return NextResponse.json({ error: 'ไม่พบทีม' }, { status: 404 })

    const { data: kids } = await db
      .from('kids')
      .select('*')
      .eq('team_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      team: {
        ...team,
        eventLink: team.event_token ? linkSlug(team.team_number, team.event_token) : null,
        practiceLink: team.practice_token ? linkSlug(team.team_number, team.practice_token) : null,
      },
      kids: kids || [],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

  const db = vexDb()
  try {
    const { data: before } = await db.from('teams').select('*').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'ไม่พบทีม' }, { status: 404 })

    const nextNumber = parsed.data.team_number ?? before.team_number
    const nextLevel = parsed.data.level ?? before.level

    // Keep (team_number, level) unique — check for a DIFFERENT team clashing.
    if (nextNumber !== before.team_number || nextLevel !== before.level) {
      const { data: clash } = await db
        .from('teams')
        .select('id')
        .eq('team_number', nextNumber)
        .eq('level', nextLevel)
        .neq('id', id)
        .limit(1)
        .maybeSingle()
      if (clash) {
        return NextResponse.json({ error: `ทีม ${nextNumber} ระดับนี้มีอยู่แล้ว` }, { status: 409 })
      }
    }

    const patch: Record<string, any> = {}
    if (parsed.data.team_number !== undefined) patch.team_number = parsed.data.team_number
    if (parsed.data.name !== undefined) patch.name = parsed.data.name || null
    if (parsed.data.level !== undefined) patch.level = parsed.data.level
    // Keep slug in sync when the team_number changes (slug = number-event_token).
    if (parsed.data.team_number !== undefined && before.event_token) {
      patch.slug = linkSlug(nextNumber, before.event_token)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ team: withLinks(before) })
    }

    const { data: updated, error } = await db
      .from('teams')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: `ทีม ${nextNumber} ระดับนี้มีอยู่แล้ว` }, { status: 409 })
      }
      throw new Error(error.message)
    }

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'team.update',
      entity: 'team',
      entityId: id,
      before,
      after: updated,
    })

    return NextResponse.json({ team: withLinks(updated) })
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
    const { data: team } = await db.from('teams').select('*').eq('id', id).maybeSingle()
    if (!team) return NextResponse.json({ error: 'ไม่พบทีม' }, { status: 404 })

    // Explicit cascade — the schema FKs may not have ON DELETE CASCADE, so remove
    // dependents first. attendance references kids (not the team) so it's cleared
    // via the kids' event rows; practices reference the team directly.
    const { data: kidRows } = await db.from('kids').select('id').eq('team_id', id)
    const kidIds = (kidRows || []).map((k: any) => k.id)
    if (kidIds.length) {
      await db.from('attendance').delete().in('kid_id', kidIds)
    }
    await db.from('practices').delete().eq('team_id', id)
    await db.from('kids').delete().eq('team_id', id)

    const { error } = await db.from('teams').delete().eq('id', id)
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'team.delete',
      entity: 'team',
      entityId: id,
      before: team,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

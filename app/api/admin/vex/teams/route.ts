// app/api/admin/vex/teams/route.ts
// GET  → list all VEX teams (with the two public link slugs).
// POST → create a team + two random 6-char tokens. 409 if (team_number, level) exists.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { newTeamToken, linkSlug } from '@/lib/vex/tokens'
import { logAudit } from '@/lib/vex/audit'
import { LEVELS } from '@/lib/vex/types'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  team_number: z.string().trim().min(1).max(32),
  name: z.string().trim().max(120).optional(),
  level: z.enum(LEVELS as [string, ...string[]]),
  branch_id: z.string().uuid(),
})

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  try {
    const db = vexDb()
    const { data, error } = await db
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const teamRows = data || []

    // Attach each team's kids (nickname) for the list display.
    const teamIds = teamRows.map((t: any) => t.id)
    const kidsByTeam = new Map<string, { id: string; nickname: string }[]>()
    if (teamIds.length) {
      const { data: kids } = await db
        .from('kids')
        .select('id, team_id, nickname')
        .in('team_id', teamIds)
        .order('created_at', { ascending: true })
      for (const k of kids || []) {
        const arr = kidsByTeam.get(k.team_id) || []
        arr.push({ id: k.id, nickname: k.nickname })
        kidsByTeam.set(k.team_id, arr)
      }
    }

    // Resolve branch names (public.branches, read-only).
    const branchIds = Array.from(new Set(teamRows.map((t: any) => t.branch_id).filter(Boolean)))
    const branchName = new Map<string, string>()
    if (branchIds.length) {
      const branches = await restSelect<{ id: string; name: string }>('branches', {
        id: `in.(${branchIds.join(',')})`,
        select: 'id,name',
      })
      for (const b of branches || []) branchName.set(b.id, b.name)
    }

    const teams = teamRows.map((t: any) => ({
      ...t,
      eventLink: t.event_token ? linkSlug(t.team_number, t.event_token) : null,
      practiceLink: t.practice_token ? linkSlug(t.team_number, t.practice_token) : null,
      branchName: t.branch_id ? branchName.get(t.branch_id) ?? null : null,
      kids: kidsByTeam.get(t.id) || [],
    }))
    return NextResponse.json({ teams })
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
  const { team_number, name, level, branch_id } = parsed.data

  const db = vexDb()

  try {
    // Enforce unique (team_number, level) with a friendly 409 (there is also a DB
    // unique constraint, but we check first for a clean message).
    const { data: existing } = await db
      .from('teams')
      .select('id')
      .eq('team_number', team_number)
      .eq('level', level)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: `ทีม ${team_number} ระดับนี้มีอยู่แล้ว` },
        { status: 409 }
      )
    }

    const event_token = newTeamToken()
    const practice_token = newTeamToken()
    // `slug` column is unique — use the event link as the canonical slug.
    const slug = linkSlug(team_number, event_token)

    const { data: created, error } = await db
      .from('teams')
      .insert({ team_number, name: name || null, level, branch_id, event_token, practice_token, slug })
      .select('*')
      .single()
    if (error) {
      // Unique-violation fallback (race with the check above).
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: `ทีม ${team_number} ระดับนี้มีอยู่แล้ว` }, { status: 409 })
      }
      throw new Error(error.message)
    }

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'team.create',
      entity: 'team',
      entityId: created.id,
      after: created,
    })

    return NextResponse.json({
      team: {
        ...created,
        eventLink: linkSlug(created.team_number, created.event_token),
        practiceLink: linkSlug(created.team_number, created.practice_token),
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

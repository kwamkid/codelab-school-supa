// app/api/admin/vex/teams/[id]/kids/route.ts
// POST → add a kid to the team.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'

export const dynamic = 'force-dynamic'

const addKidSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  full_name: z.string().trim().max(120).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const { id: teamId } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = addKidSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }

  const db = vexDb()
  try {
    const { data: team } = await db.from('teams').select('id').eq('id', teamId).maybeSingle()
    if (!team) return NextResponse.json({ error: 'ไม่พบทีม' }, { status: 404 })

    const { data: kid, error } = await db
      .from('kids')
      .insert({ team_id: teamId, nickname: parsed.data.nickname, full_name: parsed.data.full_name || null })
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'kid.add',
      entity: 'kid',
      entityId: kid.id,
      after: kid,
    })

    return NextResponse.json({ kid })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

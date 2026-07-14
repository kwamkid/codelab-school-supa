// app/api/admin/vex/teams/[id]/kids/route.ts
// POST → add one or many students to the team (each row snapshots nickname/
//        full_name and links student_id). Skips students already on the team.
// DELETE ?kidId= → remove a kid from the team.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'

export const dynamic = 'force-dynamic'

const studentEntry = z.object({
  student_id: z.string().uuid(),
  nickname: z.string().trim().min(1).max(60),
  full_name: z.string().trim().max(120).nullable().optional(),
})

const addSchema = z.object({
  // Preferred: add real students by id. Legacy single manual kid still allowed.
  students: z.array(studentEntry).min(1).optional(),
  nickname: z.string().trim().min(1).max(60).optional(),
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
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }

  const db = vexDb()
  try {
    const { data: team } = await db.from('teams').select('id').eq('id', teamId).maybeSingle()
    if (!team) return NextResponse.json({ error: 'ไม่พบทีม' }, { status: 404 })

    // --- Bulk add from students ---
    if (parsed.data.students?.length) {
      // Skip students already on this team.
      const { data: existing } = await db
        .from('kids')
        .select('student_id')
        .eq('team_id', teamId)
        .not('student_id', 'is', null)
      const already = new Set((existing || []).map((k: any) => k.student_id))

      const toInsert = parsed.data.students
        .filter((s) => !already.has(s.student_id))
        .map((s) => ({
          team_id: teamId,
          student_id: s.student_id,
          nickname: s.nickname,
          full_name: s.full_name || null,
        }))

      if (toInsert.length === 0) {
        return NextResponse.json({ kids: [], skipped: parsed.data.students.length })
      }

      const { data: kids, error } = await db.from('kids').insert(toInsert).select('*')
      if (error) throw new Error(error.message)

      await logAudit({
        actorType: 'admin',
        actorId: admin.adminId,
        actorName: admin.name,
        action: 'kid.add',
        entity: 'kid',
        entityId: teamId,
        after: { added: kids?.length ?? 0, students: toInsert.map((k) => k.student_id) },
      })

      return NextResponse.json({ kids: kids || [], skipped: parsed.data.students.length - toInsert.length })
    }

    // --- Legacy single manual kid ---
    if (parsed.data.nickname) {
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
      return NextResponse.json({ kids: [kid] })
    }

    return NextResponse.json({ error: 'ไม่มีนักเรียนให้เพิ่ม' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const { id: teamId } = await params
  const url = new URL(request.url)
  const kidId = url.searchParams.get('kidId')
  if (!kidId) return NextResponse.json({ error: 'ต้องระบุ kidId' }, { status: 400 })

  const db = vexDb()
  try {
    const { data: kid } = await db.from('kids').select('*').eq('id', kidId).maybeSingle()
    if (!kid || kid.team_id !== teamId) {
      return NextResponse.json({ error: 'ไม่พบเด็กในทีมนี้' }, { status: 404 })
    }

    // Clear this kid's attendance first, then remove the kid.
    await db.from('attendance').delete().eq('kid_id', kidId)
    await db.from('practices').delete().eq('kid_id', kidId)
    const { error } = await db.from('kids').delete().eq('id', kidId)
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'kid.remove',
      entity: 'kid',
      entityId: kidId,
      before: kid,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// app/api/liff/vex/[slug]/practices/[practiceId]/route.ts
// PATCH  → edit a practice this parent proposed (time/note/kid). Only allowed while
//          status='proposed' (once an admin approves/rejects it, it's locked).
// DELETE → cancel a proposal (same ownership + proposed-only rule).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { resolveLiffContext } from '@/lib/vex/liff-context'
import { logAudit } from '@/lib/vex/audit'

export const dynamic = 'force-dynamic'

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

const patchSchema = z.object({
  kid_id: z.string().uuid().optional(),
  practice_date: z.string().date().optional(),
  start_time: z.string().regex(timeRe).nullable().optional(),
  end_time: z.string().regex(timeRe).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  lineUserId: z.string().optional(),
})

// Load the practice and verify it belongs to this parent + team + is editable.
async function loadOwned(db: any, practiceId: string, teamId: string, parentId: string) {
  const { data: practice } = await db.from('practices').select('*').eq('id', practiceId).maybeSingle()
  if (!practice) return { error: 'ไม่พบคำขอ', status: 404 as const }
  if (practice.team_id !== teamId || practice.parent_id !== parentId) {
    return { error: 'ไม่มีสิทธิ์แก้ไขคำขอนี้', status: 403 as const }
  }
  if (practice.status !== 'proposed') {
    return { error: 'คำขอนี้ถูกตรวจแล้ว แก้ไข/ลบไม่ได้', status: 409 as const }
  }
  return { practice }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; practiceId: string }> }
) {
  const { slug, practiceId } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }

  const ctx = await resolveLiffContext(request, body, slug, 'practice')
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { team, parent } = ctx
  const db = vexDb()

  try {
    const owned = await loadOwned(db, practiceId, team.id, parent.id)
    if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status })
    const before = owned.practice

    // If kid changes, it must still be on this team.
    if (parsed.data.kid_id && parsed.data.kid_id !== before.kid_id) {
      const { data: kid } = await db
        .from('kids')
        .select('id, team_id')
        .eq('id', parsed.data.kid_id)
        .maybeSingle()
      if (!kid || kid.team_id !== team.id) {
        return NextResponse.json({ error: 'ไม่พบเด็กในทีมนี้' }, { status: 400 })
      }
    }

    const patch: Record<string, any> = {}
    if (parsed.data.kid_id !== undefined) patch.kid_id = parsed.data.kid_id
    if (parsed.data.practice_date !== undefined) patch.practice_date = parsed.data.practice_date
    if (parsed.data.start_time !== undefined) patch.start_time = parsed.data.start_time || null
    if (parsed.data.end_time !== undefined) patch.end_time = parsed.data.end_time || null
    if (parsed.data.note !== undefined) patch.note = parsed.data.note || null

    const nextStart = patch.start_time !== undefined ? patch.start_time : before.start_time
    const nextEnd = patch.end_time !== undefined ? patch.end_time : before.end_time
    if (nextStart && nextEnd && nextEnd <= nextStart) {
      return NextResponse.json({ error: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' }, { status: 400 })
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ practice: before })
    }

    const { data: updated, error } = await db
      .from('practices')
      .update(patch)
      .eq('id', practiceId)
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'parent',
      actorId: parent.id,
      actorName: parent.displayName,
      action: 'practice.edit',
      entity: 'practice',
      entityId: practiceId,
      before,
      after: updated,
    })

    return NextResponse.json({ practice: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; practiceId: string }> }
) {
  const { slug, practiceId } = await params

  // DELETE has no JSON body normally, but the LIFF fallback may send lineUserId.
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // no body — fine (identity comes from the ID token / session cookie)
  }

  const ctx = await resolveLiffContext(request, body, slug, 'practice')
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { team, parent } = ctx
  const db = vexDb()

  try {
    const owned = await loadOwned(db, practiceId, team.id, parent.id)
    if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status })

    const { error } = await db.from('practices').delete().eq('id', practiceId)
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'parent',
      actorId: parent.id,
      actorName: parent.displayName,
      action: 'practice.cancel',
      entity: 'practice',
      entityId: practiceId,
      before: owned.practice,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

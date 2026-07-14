// app/api/admin/vex/practices/[id]/route.ts
// PATCH → admin reviews a practice: set status (approve/reject) and/or edit its
// time/note. Reviewing stamps reviewed_by/reviewed_at; editing sets
// edited_by_admin. DELETE → remove a proposal outright.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'
import { logAudit } from '@/lib/vex/audit'

export const dynamic = 'force-dynamic'

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

const patchSchema = z.object({
  status: z.enum(['proposed', 'approved', 'rejected']).optional(),
  practice_date: z.string().date().optional(),
  start_time: z.string().regex(timeRe).nullable().optional(),
  end_time: z.string().regex(timeRe).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }

  const db = vexDb()
  try {
    const { data: before } = await db.from('practices').select('*').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 })

    const patch: Record<string, any> = {}
    // Field edits by the admin → mark edited_by_admin.
    let edited = false
    if (parsed.data.practice_date !== undefined) {
      patch.practice_date = parsed.data.practice_date
      edited = true
    }
    if (parsed.data.start_time !== undefined) {
      patch.start_time = parsed.data.start_time || null
      edited = true
    }
    if (parsed.data.end_time !== undefined) {
      patch.end_time = parsed.data.end_time || null
      edited = true
    }
    if (parsed.data.note !== undefined) {
      patch.note = parsed.data.note || null
      edited = true
    }
    if (edited) patch.edited_by_admin = true

    // Review action.
    if (parsed.data.status !== undefined) {
      patch.status = parsed.data.status
      patch.reviewed_by = admin.adminId
      patch.reviewed_at = new Date().toISOString()
    }

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
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: parsed.data.status ? `practice.${parsed.data.status}` : 'practice.edit',
      entity: 'practice',
      entityId: id,
      before,
      after: updated,
    })

    return NextResponse.json({ practice: updated })
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
    const { data: before } = await db.from('practices').select('*').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 })

    const { error } = await db.from('practices').delete().eq('id', id)
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'admin',
      actorId: admin.adminId,
      actorName: admin.name,
      action: 'practice.delete',
      entity: 'practice',
      entityId: id,
      before,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

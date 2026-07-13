// app/api/liff/vex/[slug]/practices/route.ts
// POST { kid_id, practice_date, start_time?, end_time?, note? } → propose a practice.
// Starts status='proposed'; an admin approves/rejects later.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { resolveLiffContext } from '@/lib/vex/liff-context'
import { logAudit } from '@/lib/vex/audit'

export const dynamic = 'force-dynamic'

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/ // HH:MM

const bodySchema = z.object({
  kid_id: z.string().uuid(),
  practice_date: z.string().date(),
  start_time: z.string().regex(timeRe).optional(),
  end_time: z.string().regex(timeRe).optional(),
  note: z.string().trim().max(500).optional(),
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const { kid_id, practice_date, start_time, end_time, note } = parsed.data

  if (start_time && end_time && end_time <= start_time) {
    return NextResponse.json({ error: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' }, { status: 400 })
  }

  const ctx = await resolveLiffContext(request, body, slug, 'practice')
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { team, parent } = ctx
  const db = vexDb()

  try {
    const { data: kid } = await db
      .from('kids')
      .select('id, team_id')
      .eq('id', kid_id)
      .maybeSingle()
    if (!kid || kid.team_id !== team.id) {
      return NextResponse.json({ error: 'ไม่พบเด็กในทีมนี้' }, { status: 400 })
    }

    const { data: practice, error } = await db
      .from('practices')
      .insert({
        team_id: team.id,
        kid_id,
        parent_id: parent.id,
        practice_date,
        start_time: start_time || null,
        end_time: end_time || null,
        note: note || null,
        status: 'proposed',
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await logAudit({
      actorType: 'parent',
      actorId: parent.id,
      actorName: parent.displayName,
      action: 'practice.propose',
      entity: 'practice',
      entityId: practice.id,
      after: practice,
    })

    return NextResponse.json({ practice })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// app/api/liff/vex/[slug]/summary/route.ts
// POST { kind: 'event' | 'practice' } → everything a parent's public page needs.
//   kind=event:    { team, kids, parentDisplayName, events, attendance }
//   kind=practice: { team, kids, parentDisplayName, practices } (this parent's proposals)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { vexDb } from '@/lib/vex/supabase'
import { resolveLiffContext } from '@/lib/vex/liff-context'
import type { Level } from '@/lib/vex/types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  kind: z.enum(['event', 'practice']),
  lineUserId: z.string().optional(), // fallback identity for resolveLiffUser
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
  const { kind } = parsed.data

  const ctx = await resolveLiffContext(request, body, slug, kind)
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { team, parent } = ctx
  const db = vexDb()

  try {
    const { data: kids } = await db
      .from('kids')
      .select('*')
      .eq('team_id', team.id)
      .order('created_at', { ascending: true })
    const kidList = kids || []
    const kidIds = kidList.map((k: any) => k.id)

    const base = {
      team: {
        id: team.id,
        team_number: team.team_number,
        name: team.name,
        level: team.level,
      },
      kids: kidList,
      parentDisplayName: parent.displayName,
    }

    if (kind === 'practice') {
      // ทั้งทีมเห็นตารางซ้อมร่วมกัน (ผู้ปกครองคนอื่น + ที่แอดมินเพิ่ม) — เดิมกรอง
      // parent_id ทำให้ "อีกบ้านกรอกแล้วแต่ปฏิทินเราว่าง". แก้/ลบยังทำได้เฉพาะ
      // ของตัวเอง (PATCH/DELETE เช็ค ownership ฝั่ง server อยู่แล้ว) — ส่ง
      // parentId กลับไปให้ UI ซ่อนปุ่มของแถวที่ไม่ใช่ของเรา
      const { data: practices } = await db
        .from('practices')
        .select('*')
        .eq('team_id', team.id)
        .order('practice_date', { ascending: false })
        .order('created_at', { ascending: false })
      return NextResponse.json({ ...base, parentId: parent.id, practices: practices || [] })
    }

    // kind === 'event': events whose event_levels include this team's level.
    const { data: levelRows } = await db
      .from('event_levels')
      .select('event_id')
      .eq('level', team.level as Level)
    const eventIds = Array.from(new Set((levelRows || []).map((r: any) => r.event_id)))

    let events: any[] = []
    let attendance: any[] = []
    if (eventIds.length) {
      const { data: evRows } = await db
        .from('events')
        .select('*')
        .in('id', eventIds)
        .order('sort_order', { ascending: true })
        .order('date_start', { ascending: true, nullsFirst: false })
      events = evRows || []

      if (kidIds.length) {
        const { data: attRows } = await db
          .from('attendance')
          .select('*')
          .in('event_id', eventIds)
          .in('kid_id', kidIds)
        attendance = attRows || []
      }
    }

    return NextResponse.json({ ...base, events, attendance })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

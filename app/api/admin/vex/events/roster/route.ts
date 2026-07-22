// app/api/admin/vex/events/roster/route.ts
// GET → RSVP matrix data for the admin roster page: every event (+ levels),
// every team with its kids, and all attendance rows keyed kid×event. The client
// renders the ทีม × นักเรียน rows against งาน columns (ไป / ไม่ไป / ยังไม่ตอบ).

import { NextResponse } from 'next/server'
import { vexDb } from '@/lib/vex/supabase'
import { requireViewer } from '@/lib/vex/api'
import { restSelect } from '@/lib/supabase/rest'
import type { Level } from '@/lib/vex/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireViewer(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  try {
    const db = vexDb()

    const [eventsRes, eventLevelsRes, teamsRes, kidsRes, attRes] = await Promise.all([
      db
        .from('events')
        .select('id, name, date_start, date_end, place, has_world_spot')
        .order('date_start', { ascending: true, nullsFirst: false }),
      db.from('event_levels').select('event_id, level'),
      db.from('teams').select('id, team_number, name, level, branch_id').order('team_number', { ascending: true }),
      db.from('kids').select('id, team_id, nickname, full_name, student_id').order('created_at', { ascending: true }),
      db.from('attendance').select('event_id, kid_id, status, updated_at'),
    ])
    for (const r of [eventsRes, eventLevelsRes, teamsRes, kidsRes, attRes]) {
      if (r.error) throw new Error(r.error.message)
    }

    const levelsByEvent = new Map<string, Level[]>()
    for (const el of eventLevelsRes.data || []) {
      const arr = levelsByEvent.get(el.event_id) || []
      arr.push(el.level as Level)
      levelsByEvent.set(el.event_id, arr)
    }

    const events = (eventsRes.data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      dateStart: e.date_start,
      dateEnd: e.date_end,
      place: e.place,
      hasWorldSpot: e.has_world_spot,
      levels: levelsByEvent.get(e.id) || [],
    }))

    // Parent name per kid (for the CSV export): kid.student_id → students.parent_id
    // → parents.display_name. students/parents live in public.* → restSelect.
    const studentIds = Array.from(
      new Set((kidsRes.data || []).map((k: any) => k.student_id).filter(Boolean))
    )
    const parentNameByStudent = new Map<string, string>()
    if (studentIds.length) {
      const students = await restSelect<{ id: string; parent_id: string | null }>('students', {
        id: `in.(${studentIds.join(',')})`,
        select: 'id,parent_id',
      })
      const parentIds = Array.from(new Set(students.map((s) => s.parent_id).filter(Boolean))) as string[]
      const parentName = new Map<string, string>()
      if (parentIds.length) {
        const parents = await restSelect<{ id: string; display_name: string | null }>('parents', {
          id: `in.(${parentIds.join(',')})`,
          select: 'id,display_name',
        })
        parents.forEach((p) => parentName.set(p.id, p.display_name || ''))
      }
      students.forEach((s) => {
        if (s.parent_id) parentNameByStudent.set(s.id, parentName.get(s.parent_id) || '')
      })
    }

    const kidsByTeam = new Map<
      string,
      { id: string; nickname: string; fullName: string | null; parentName: string }[]
    >()
    for (const k of kidsRes.data || []) {
      const arr = kidsByTeam.get(k.team_id) || []
      arr.push({
        id: k.id,
        nickname: k.nickname,
        fullName: k.full_name,
        parentName: k.student_id ? parentNameByStudent.get(k.student_id) || '' : '',
      })
      kidsByTeam.set(k.team_id, arr)
    }

    const teams = (teamsRes.data || [])
      .map((t: any) => ({
        teamId: t.id,
        teamNumber: t.team_number,
        teamName: t.name,
        level: t.level as Level,
        branchId: t.branch_id,
        kids: kidsByTeam.get(t.id) || [],
      }))
      .filter((t) => t.kids.length > 0)

    // kid×event → status ('go' | 'no'); absence of a key means ยังไม่ตอบ.
    const rsvps = (attRes.data || []).map((a: any) => ({
      eventId: a.event_id,
      kidId: a.kid_id,
      status: a.status,
      updatedAt: a.updated_at,
    }))

    return NextResponse.json({ events, teams, rsvps })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

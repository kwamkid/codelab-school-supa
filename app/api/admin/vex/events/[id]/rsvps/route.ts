// app/api/admin/vex/events/[id]/rsvps/route.ts
// GET → who confirmed for this competition: every kid of every team whose level
// matches the event's levels, with their RSVP status ('go' | 'no' | 'pend' —
// kids with no attendance row yet count as 'pend'). Grouped by team.

import { NextResponse } from 'next/server'
import { vexDb } from '@/lib/vex/supabase'
import { requireAdmin } from '@/lib/vex/api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  try {
    const db = vexDb()
    const eventId = params.id

    const { data: levels, error: lvErr } = await db
      .from('event_levels')
      .select('level')
      .eq('event_id', eventId)
    if (lvErr) throw new Error(lvErr.message)
    const levelList = (levels || []).map((l: any) => l.level)
    if (levelList.length === 0) return NextResponse.json({ teams: [], counts: { go: 0, no: 0, pend: 0 } })

    const { data: teams, error: tErr } = await db
      .from('teams')
      .select('id, team_number, name, level, branch_id')
      .in('level', levelList)
    if (tErr) throw new Error(tErr.message)
    const teamIds = (teams || []).map((t: any) => t.id)
    if (teamIds.length === 0) return NextResponse.json({ teams: [], counts: { go: 0, no: 0, pend: 0 } })

    const [kidsRes, attRes] = await Promise.all([
      db.from('kids').select('id, team_id, nickname').in('team_id', teamIds),
      db.from('attendance').select('kid_id, status, updated_at').eq('event_id', eventId),
    ])
    if (kidsRes.error) throw new Error(kidsRes.error.message)
    const attByKid = new Map<string, any>((attRes.data || []).map((a: any) => [a.kid_id, a]))

    const counts = { go: 0, no: 0, pend: 0 }
    const grouped = (teams || [])
      .map((t: any) => {
        const kids = (kidsRes.data || [])
          .filter((k: any) => k.team_id === t.id)
          .map((k: any) => {
            const att = attByKid.get(k.id)
            const status = (att?.status as 'go' | 'no') || 'pend'
            counts[status]++
            return { id: k.id, nickname: k.nickname, status, updatedAt: att?.updated_at || null }
          })
          // Confirmed-go first, then pending, then no
          .sort((a: any, b: any) => {
            const order = { go: 0, pend: 1, no: 2 } as const
            return order[a.status as 'go'] - order[b.status as 'go'] || a.nickname.localeCompare(b.nickname, 'th')
          })
        return {
          teamId: t.id,
          teamNumber: t.team_number,
          teamName: t.name,
          level: t.level,
          branchId: t.branch_id,
          kids,
          goCount: kids.filter((k: any) => k.status === 'go').length,
        }
      })
      .filter((t: any) => t.kids.length > 0)
      // Teams with confirmations first
      .sort((a: any, b: any) => b.goCount - a.goCount || a.teamNumber.localeCompare(b.teamNumber))

    return NextResponse.json({ teams: grouped, counts })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

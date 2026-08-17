// lib/vex/notify.ts
// Notify the family of a VEX practice request when an admin approves it or edits
// its time. Fans out to EVERY family LINE recipient (primary + accepted
// parent_line_recipients) via getParentLineIds — per the CLAUDE.md rule that no
// sender may push to parents.line_user_id directly. Uses the existing LINE outbox
// (public.line_notification_queue, type:'custom' → payload.to + payload.messages,
// one queue row per recipient). This is the ONE place VEX code touches a public.*
// table with a WRITE — queue rows, not VEX data — and it's a deliberate, isolated
// exception to reach the shared LINE notifier.

import { restSelect } from '@/lib/supabase/rest'
import { enqueueLineText } from '@/lib/supabase/services/line-queue'
import { vexDb } from '@/lib/vex/supabase'
import { getParentLineIds } from '@/lib/supabase/services/line-notifications'
import { isLineUserId } from '@/lib/line/line-user-id'

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function thaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${(y + 543) % 100}`
}

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

function timeRange(start: string | null, end: string | null): string {
  if (!start && !end) return '(ยังไม่ระบุเวลา)'
  return `${hhmm(start) || '-'}${end ? ` - ${hhmm(end)}` : ''}`
}

export type PracticeNotifyKind = 'approved' | 'rejected' | 'edited' | 'scheduled'

export interface PracticeForNotify {
  parent_id: string | null
  practice_date: string
  start_time: string | null
  end_time: string | null
  kid_id: string
  /** เหตุผลที่ไม่อนุมัติ — แนบท้ายข้อความ kind 'rejected' */
  reject_reason?: string | null
}

/**
 * Enqueue (and best-effort immediately send) a LINE notification to the parent
 * who owns `practice`. Safe to await; never throws (failures are logged and the
 * hourly cron will still drain the queue).
 */
export async function notifyParentPractice(
  practice: PracticeForNotify,
  kind: PracticeNotifyKind,
  kidNickname?: string | null,
  /** Multi-date schedule (kind 'scheduled'): list ALL dates in one message
      instead of sending one message per row. */
  allDates?: string[]
): Promise<void> {
  try {
    // Prefer the REAL parent of the kid's linked student
    // (kid.student_id → students.parent_id → parents.line_user_id). Fall back to
    // the practice's parent_id (the submitter) for kids without a student link.
    let parentId: string | null = practice.parent_id
    try {
      const { data: kid } = await vexDb()
        .from('kids')
        .select('student_id')
        .eq('id', practice.kid_id)
        .maybeSingle()
      if (kid?.student_id) {
        const students = await restSelect<{ parent_id: string | null }>('students', {
          id: `eq.${kid.student_id}`,
          select: 'parent_id',
          limit: '1',
        })
        if (students?.[0]?.parent_id) parentId = students[0].parent_id
      }
    } catch {
      // fall back to practice.parent_id
    }

    if (!parentId) return

    // Fan-out targets: primary LINE id + every accepted extra recipient of the
    // family (พ่อ+แม่). Works even when the primary hasn't linked LINE but an
    // extra recipient has.
    const rows = await restSelect<{ line_user_id: string | null }>('parents', {
      id: `eq.${parentId}`,
      select: 'line_user_id',
      limit: '1',
    })
    const lineIds = await getParentLineIds(parentId, rows?.[0]?.line_user_id ?? null)
    if (lineIds.length === 0) return // nobody in the family is linked to LINE

    const who = kidNickname ? `ของ ${kidNickname} ` : ''
    const when = `${thaiDate(practice.practice_date)} เวลา ${timeRange(practice.start_time, practice.end_time)}`

    let text: string
    if (kind === 'approved') {
      text = `✅ คำขอซ้อม${who}ได้รับการอนุมัติแล้ว\n📅 ${when}`
    } else if (kind === 'rejected') {
      const reason = (practice.reject_reason || '').trim()
      text =
        `❌ คำขอซ้อม${who}ไม่ได้รับการอนุมัติ\n📅 ${when}` +
        (reason ? `\n📝 เหตุผล: ${reason}` : '') +
        `\nกรุณาติดต่อแอดมินหรือเสนอวันใหม่`
    } else if (kind === 'scheduled') {
      // Admin-created practice (not a reply to a parent request)
      if (allDates && allDates.length > 1) {
        const dateList = allDates.map(thaiDate).join(', ')
        text = `🗓️ แอดมินนัดวันซ้อม${who}\n📅 ${dateList}\n⏰ เวลา ${timeRange(practice.start_time, practice.end_time)}`
      } else {
        text = `🗓️ แอดมินนัดวันซ้อม${who}\n📅 ${when}`
      }
    } else {
      text = `✏️ แอดมินปรับวัน/เวลาซ้อม${who}ให้ใหม่\n📅 ${when}`
    }

    await enqueueLineText(lineIds, text)
  } catch (e) {
    console.error('[vex notify] unexpected error:', e)
  }
}

// ————— ฝั่งครูผู้ดูแลทีม —————
// ครูรับ noti ได้ก็ต่อเมื่อผูก LINE แล้วจริง ๆ (teachers.line_user_id เป็น userId
// รูปแบบ U+32hex — คอลัมน์นี้มีของเก่าที่เป็นอีเมล/LINE ID พิมพ์มือปนอยู่ ห้ามเชื่อ
// ความ truthy ดู lib/line/line-user-id.ts)

interface CoachTarget {
  lineUserId: string
  label: string
}

/** ครูผู้ดูแลของทีมเหล่านี้ที่ผูก LINE แล้ว → teamId → ครู */
async function coachesForTeams(teamIds: string[]): Promise<Map<string, CoachTarget>> {
  const result = new Map<string, CoachTarget>()
  if (teamIds.length === 0) return result
  try {
    const { data: teams } = await vexDb()
      .from('teams')
      .select('id, team_number, coach_teacher_id')
      .in('id', teamIds)
    const rows = (teams || []).filter((t: any) => t.coach_teacher_id)
    if (rows.length === 0) return result

    // is_active เท่านั้น — ครูที่ลาออก/ถูกปิดใช้งานต้องไม่ได้รับแจ้งเตือนต่อ
    const coachIds = Array.from(new Set(rows.map((t: any) => t.coach_teacher_id)))
    const teachers = await restSelect<{
      id: string
      name: string
      nickname: string | null
      line_user_id: string | null
    }>('teachers', {
      id: `in.(${coachIds.join(',')})`,
      is_active: 'eq.true',
      select: 'id,name,nickname,line_user_id',
    })

    const byId = new Map(
      (teachers || [])
        .filter((t) => isLineUserId(t.line_user_id))
        .map((t) => [t.id, { lineUserId: t.line_user_id as string, label: t.nickname || t.name }])
    )
    for (const t of rows) {
      const coach = byId.get(t.coach_teacher_id)
      if (coach) result.set(t.id, coach)
    }
  } catch (e) {
    console.error('[vex notify] coach lookup failed:', e)
  }
  return result
}

/** แจ้งครูผู้ดูแลทันทีที่แอดมินอนุมัติ/นัดวันซ้อม ว่าจะมีเด็กเข้ามา */
export async function notifyCoachPractice(
  practice: { team_id: string; practice_date: string; start_time: string | null; end_time: string | null },
  kidNickname?: string | null,
  /** นัดหลายวันรวดเดียว (แอดมินเพิ่มซ้อม) — รวมเป็นข้อความเดียว */
  allDates?: string[]
): Promise<void> {
  try {
    const coach = (await coachesForTeams([practice.team_id])).get(practice.team_id)
    if (!coach) return // ยังไม่ได้ระบุครู หรือครูยังไม่ผูก LINE

    const teamRes = await vexDb().from('teams').select('team_number').eq('id', practice.team_id).maybeSingle()
    const teamNumber = teamRes.data?.team_number || '-'
    const who = kidNickname || 'นักเรียน'
    const dates =
      allDates && allDates.length > 1
        ? allDates.map(thaiDate).join(', ')
        : thaiDate(practice.practice_date)

    const text =
      `🤖 มีนักเรียนเข้าซ้อม (ทีม ${teamNumber})\n` +
      `👦 ${who}\n` +
      `📅 ${dates}\n` +
      `⏰ ${timeRange(practice.start_time, practice.end_time)}`
    await enqueueLineText([coach.lineUserId], text)
  } catch (e) {
    console.error('[vex notify] notifyCoachPractice failed:', e)
  }
}

/**
 * เตือนครูล่วงหน้า: สรุปว่าวันที่ `dateStr` มีเด็กทีมไหนมาซ้อมบ้าง — ข้อความเดียว
 * ต่อครู 1 คน (รวมทุกทีมที่เขาดูแล). เรียกจาก cron รายวัน.
 */
export async function sendCoachPracticeReminders(dateStr: string): Promise<{ coaches: number }> {
  try {
    const db = vexDb()
    const { data: practices } = await db
      .from('practices')
      .select('id, team_id, kid_id, start_time, end_time')
      .eq('practice_date', dateStr)
      .eq('status', 'approved')
    const rows = practices || []
    if (rows.length === 0) return { coaches: 0 }

    const teamIds: string[] = Array.from(new Set(rows.map((p: any) => p.team_id as string)))
    const coaches = await coachesForTeams(teamIds)
    if (coaches.size === 0) return { coaches: 0 }

    const kidIds: string[] = Array.from(new Set(rows.map((p: any) => p.kid_id as string)))
    const [{ data: teams }, { data: kids }] = await Promise.all([
      db.from('teams').select('id, team_number').in('id', teamIds),
      db.from('kids').select('id, nickname').in('id', kidIds),
    ])
    const teamNumber = new Map<string, string>()
    for (const t of (teams || []) as any[]) teamNumber.set(t.id, t.team_number)
    const kidNickname = new Map<string, string>()
    for (const k of (kids || []) as any[]) kidNickname.set(k.id, k.nickname)

    // ครู → ทีม → รายชื่อเด็ก+เวลา
    const byCoach = new Map<string, { target: CoachTarget; teams: Map<string, string[]> }>()
    for (const p of rows as any[]) {
      const coach = coaches.get(p.team_id)
      if (!coach) continue
      const entry = byCoach.get(coach.lineUserId) || { target: coach, teams: new Map<string, string[]>() }
      const label = teamNumber.get(p.team_id) || '-'
      const list = entry.teams.get(label) || []
      list.push(`${kidNickname.get(p.kid_id) || '-'} (${timeRange(p.start_time, p.end_time)})`)
      entry.teams.set(label, list)
      byCoach.set(coach.lineUserId, entry)
    }

    for (const [lineUserId, entry] of byCoach) {
      const body = Array.from(entry.teams.entries())
        .map(([team, kidsList]) => `▸ ทีม ${team}\n   ${kidsList.join('\n   ')}`)
        .join('\n')
      const text = `🔔 พรุ่งนี้มีนักเรียนเข้าซ้อม\n📅 ${thaiDate(dateStr)}\n\n${body}`
      await enqueueLineText([lineUserId], text)
    }

    return { coaches: byCoach.size }
  } catch (e) {
    console.error('[vex notify] sendCoachPracticeReminders failed:', e)
    return { coaches: 0 }
  }
}

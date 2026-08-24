// app/api/calendar/vex-practice/route.ts
// GET ?id=<vex.practices.id> → ไฟล์ .ics ของวันซ้อม (เฉพาะที่อนุมัติแล้ว)
//
// เหตุผลเดียวกับ vex-event: ปฏิทินตัวเครื่องรับข้อมูลผ่านไฟล์ text/calendar
// เท่านั้น. ต่างกันตรงวันซ้อมมี "เวลา" → เป็น timed event
//
// เวลาไทยไม่มี DST → แปลงเป็น UTC ตรง ๆ (ลบ 7 ชม.) แล้วส่งเป็น Z-time
// จะได้ไม่ต้องแนบบล็อก VTIMEZONE ให้ยาว และไม่มีทางตีความผิด

import { NextRequest, NextResponse } from 'next/server'
import { vexDb } from '@/lib/vex/supabase'

export const dynamic = 'force-dynamic'

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

const compact = (d: string) => d.replace(/-/g, '')

/** "2026-08-31" + "16:00" (เวลาไทย) → "20260831T090000Z" */
function toUtcStamp(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number)
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCHours(h - 7, m, 0, 0) // ไทย = UTC+7 ตลอดปี
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > 75) {
      out.push(current)
      current = ch
      bytes = size + 1 // บรรทัดต่อไปขึ้นต้นด้วยช่องว่าง
    } else {
      current += ch
      bytes += size
    }
  }
  if (current) out.push(current)
  return out.join('\r\n ')
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const db = vexDb()
    const { data: practice } = await db.from('practices').select('*').eq('id', id).maybeSingle()
    if (!practice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // ยังไม่อนุมัติ = ยังไม่ใช่นัดจริง ไม่ควรลงปฏิทิน
    if (practice.status !== 'approved') {
      return NextResponse.json({ error: 'ยังไม่ได้รับอนุมัติ' }, { status: 409 })
    }

    const [{ data: team }, { data: kid }] = await Promise.all([
      db.from('teams').select('team_number, name').eq('id', practice.team_id).maybeSingle(),
      db.from('kids').select('nickname').eq('id', practice.kid_id).maybeSingle(),
    ])

    const date = practice.practice_date as string
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const title = `ซ้อม VEX ทีม ${team?.team_number || ''}${kid?.nickname ? ` — ${kid.nickname}` : ''}`.trim()

    // มีเวลา → timed event; ไม่มีเวลา → ทั้งวัน (DTEND exclusive +1)
    const timeLines = practice.start_time
      ? [
          `DTSTART:${toUtcStamp(date, practice.start_time)}`,
          `DTEND:${toUtcStamp(date, practice.end_time || practice.start_time)}`,
        ]
      : [`DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(nextDay(date))}`]

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CodeLab School//VEX//TH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:vex-practice-${id}@codelab`,
      `DTSTAMP:${stamp}`,
      ...timeLines,
      `SUMMARY:${escapeIcs(title)}`,
      practice.note ? `DESCRIPTION:${escapeIcs(practice.note)}` : null,
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`อีก 2 ชั่วโมงถึงเวลาซ้อม — ${title}`)}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean) as string[]

    return new NextResponse(lines.map(foldIcsLine).join('\r\n') + '\r\n', {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="vex-practice-${compact(date)}.ics"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[calendar/vex-practice] Error:', error)
    return NextResponse.json({ error: error?.message || 'failed' }, { status: 500 })
  }
}

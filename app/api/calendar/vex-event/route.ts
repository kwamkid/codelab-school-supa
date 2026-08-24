// app/api/calendar/vex-event/route.ts
// GET ?id=<vex.events.id> → ไฟล์ .ics ของรายการแข่งขัน
//
// ทำไมต้องเป็นไฟล์จากเซิร์ฟเวอร์: การเปิดปฏิทิน "ตัวเครื่อง" ไม่มี URL scheme
// กลางที่ใส่รายละเอียดกิจกรรมได้ (iOS `calshow:` เปิดได้แค่แอป ไม่พารายละเอียดไป)
// วิธีมาตรฐานคือส่งไฟล์ text/calendar กลับไป แล้วให้ OS จับเอง —
//   iOS Safari  → เด้งหน้า "เพิ่มลงปฏิทิน" ของแอป Calendar เลย
//   Android     → ดาวน์โหลดแล้วแตะเปิดด้วยแอปปฏิทิน
// ต้องเปิดในเบราว์เซอร์ภายนอก (liff.openWindow external) — ใน webview ของ LINE
// ดาวน์โหลดไฟล์ไม่ทำงาน
//
// ไม่ต้องยืนยันตัวตน: OS เป็นคนโหลดไฟล์เอง แนบ token ไปด้วยไม่ได้ และเนื้อหาเป็น
// แค่ชื่อ/วัน/สถานที่ของรายการแข่งขัน (ไม่ใช่ข้อมูลส่วนตัวของเด็ก) + id เป็น uuid

import { NextRequest, NextResponse } from 'next/server'
import { vexDb } from '@/lib/vex/supabase'

export const dynamic = 'force-dynamic'

/** ตัดอักขระที่ ICS ถือเป็นตัวคุม (RFC 5545 §3.3.11) */
function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

const compact = (d: string) => d.replace(/-/g, '')

// RFC 5545 กำหนดว่าบรรทัดหนึ่งยาวได้ไม่เกิน 75 octet ถ้าเกินต้องตัดขึ้นบรรทัดใหม่
// แล้วเริ่มด้วยช่องว่าง — ชื่อรายการเป็นภาษาไทย (ตัวละ 3 ไบต์) เกินง่ายมาก
// ต้องตัดตามจำนวน "ไบต์" และห้ามตัดกลางตัวอักษร ไม่งั้นบางแอปอ่านไฟล์ไม่ออก
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ''
  let currentBytes = 0
  let limit = 75
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (currentBytes + size > limit) {
      out.push(current)
      current = ch
      currentBytes = size + 1 // บรรทัดต่อไปขึ้นต้นด้วยช่องว่าง 1 ตัว
      limit = 75
    } else {
      current += ch
      currentBytes += size
    }
  }
  if (current) out.push(current)
  return out.join('\r\n ')
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const db = vexDb()
    const { data: event } = await db.from('events').select('*').eq('id', id).maybeSingle()
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const start = event.date_start as string
    // ปฏิทินนับ DTEND แบบ exclusive สำหรับกิจกรรมทั้งวัน → ต้อง +1 วัน
    const end = nextDay((event.date_end as string) || start)
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CodeLab School//VEX//TH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:vex-event-${id}@codelab`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(start)}`,
      `DTEND;VALUE=DATE:${compact(end)}`,
      `SUMMARY:${escapeIcs(`[VEX] ${event.name}`)}`,
      event.place ? `LOCATION:${escapeIcs(event.place)}` : null,
      'DESCRIPTION:' + escapeIcs('รายการแข่งขัน VEX — CodeLab School'),
      // เตือนล่วงหน้า 1 วัน
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`พรุ่งนี้แข่ง ${event.name}`)}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean)

    // ICS ต้องขึ้นบรรทัดใหม่ด้วย CRLF และบรรทัดยาวต้องพับตามสเปก
    const body = (lines as string[]).map(foldIcsLine).join('\r\n') + '\r\n'
    const filename = `vex-${compact(start)}.ics`

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[calendar/vex-event] Error:', error)
    return NextResponse.json({ error: error?.message || 'failed' }, { status: 500 })
  }
}

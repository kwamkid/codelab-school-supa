// lib/supabase/services/teacher-digest.ts
// สรุปตารางสอนวันพรุ่งนี้ส่งให้ครูทาง LINE — คลาสไหน กี่โมง ที่ไหน และใครลา.
// ข้อมูลทั้งหมดมาจาก RPC get_teacher_daily_digest ครั้งเดียว (migration
// 20260818_teacher_daily_digest_rpc) ซึ่งกรองมาให้แล้วว่าเป็นครูที่ยังใช้งานอยู่
// และผูก LINE จริง → ไม่ต้องเช็คซ้ำฝั่ง TS.
//
// ครูที่พรุ่งนี้ไม่มีคลาส จะไม่อยู่ในผลลัพธ์เลย = ไม่ได้รับข้อความ (ไม่รบกวน).

import { createServiceClient } from '../server'
import { enqueueLineMessages } from './line-queue'

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function thaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${(y + 543) % 100}`
}

function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : ''
}

interface DigestClass {
  startTime: string | null
  endTime: string | null
  className: string | null
  subjectName: string | null
  sessionNumber: number | null
  totalSessions: number | null
  branchName: string | null
  roomName: string | null
  studentCount: number
  leaveNames: string[]
}

interface DigestTeacher {
  teacher_id: string
  teacher_name: string
  line_user_id: string
  classes: DigestClass[]
}

const BRAND = '#f05a5a' // เดียวกับ flex classReminder ที่ส่งให้ผู้ปกครอง
const LEAVE_COLOR = '#e67e22'

function sessionLabel(c: DigestClass): string {
  if (!c.sessionNumber) return ''
  return `ครั้งที่ ${c.sessionNumber}${c.totalSessions ? `/${c.totalSessions}` : ''}`
}

function placeLabel(c: DigestClass): string {
  return [c.branchName, c.roomName ? `ห้อง ${c.roomName}` : null].filter(Boolean).join(' · ')
}

function headcountLabel(c: DigestClass): string {
  const leaves = c.leaveNames?.length || 0
  return leaves
    ? `👥 มาเรียน ${Math.max(0, c.studentCount - leaves)}/${c.studentCount} คน`
    : `👥 นักเรียน ${c.studentCount} คน`
}

/** ข้อความสำรอง (altText + เครื่องที่แสดง flex ไม่ได้) */
function formatClassText(c: DigestClass): string {
  const session = sessionLabel(c)
  const place = placeLabel(c)
  return (
    `▸ ${hhmm(c.startTime)}-${hhmm(c.endTime)} ${c.subjectName || c.className || ''}${session ? ` (${session})` : ''}` +
    (place ? `\n   📍 ${place}` : '') +
    `\n   ${headcountLabel(c)}` +
    (c.leaveNames?.length ? `\n   🙋 ลา: ${c.leaveNames.join(', ')}` : '')
  )
}

/** การ์ด 1 คลาสใน body ของ bubble */
function classBlock(c: DigestClass) {
  const session = sessionLabel(c)
  const place = placeLabel(c)
  const contents: any[] = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `${hhmm(c.startTime)}-${hhmm(c.endTime)}`,
          size: 'sm',
          weight: 'bold',
          color: BRAND,
          flex: 0,
        },
        ...(session
          ? [{ type: 'text', text: session, size: 'xs', color: '#999999', align: 'end' }]
          : []),
      ],
    },
    {
      type: 'text',
      text: c.subjectName || c.className || '-',
      size: 'md',
      weight: 'bold',
      color: '#111111',
      wrap: true,
      margin: 'xs',
    },
  ]

  if (place) {
    contents.push({ type: 'text', text: `📍 ${place}`, size: 'xs', color: '#666666', wrap: true, margin: 'xs' })
  }
  contents.push({ type: 'text', text: headcountLabel(c), size: 'xs', color: '#666666', margin: 'xs' })
  if (c.leaveNames?.length) {
    contents.push({
      type: 'text',
      text: `🙋 ลา: ${c.leaveNames.join(', ')}`,
      size: 'xs',
      color: LEAVE_COLOR,
      wrap: true,
      margin: 'xs',
    })
  }

  return { type: 'box', layout: 'vertical', contents }
}

/** Flex bubble ตารางสอนทั้งวันของครู 1 คน */
function buildDigestFlex(dateStr: string, classes: DigestClass[]) {
  const blocks: any[] = []
  classes.forEach((c, i) => {
    if (i > 0) blocks.push({ type: 'separator', margin: 'lg' })
    blocks.push({ ...classBlock(c), margin: i > 0 ? 'lg' : 'none' })
  })

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '🔔 ตารางสอนพรุ่งนี้', weight: 'bold', size: 'md', color: '#ffffff' },
        { type: 'text', text: thaiDate(dateStr), size: 'sm', color: '#ffffff', margin: 'xs' },
      ],
      backgroundColor: BRAND,
      paddingAll: '15px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: blocks,
      paddingAll: '16px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `รวม ${classes.length} คลาส`,
          size: 'xs',
          color: '#999999',
          align: 'center',
        },
      ],
      paddingAll: '10px',
    },
  }
}

/**
 * ส่งสรุปตารางสอนของวันที่ `dateStr` ให้ครูทุกคนที่มีคลาสวันนั้น (1 ข้อความ/ครู).
 * เรียกจาก cron รายวันด้วยวันที่ของ "พรุ่งนี้".
 */
export async function sendTeacherDailyDigest(dateStr: string): Promise<{ teachers: number }> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await (supabase.rpc as any)('get_teacher_daily_digest', { p_date: dateStr })
    if (error) {
      console.error('[teacher-digest] RPC failed:', error.message)
      return { teachers: 0 }
    }

    const rows = (data || []) as DigestTeacher[]
    let sent = 0
    for (const t of rows) {
      const classes = t.classes || []
      if (classes.length === 0) continue
      const altText =
        `🔔 ตารางสอนพรุ่งนี้ ${thaiDate(dateStr)}\n\n` + classes.map(formatClassText).join('\n\n')
      await enqueueLineMessages(
        [t.line_user_id],
        // altText ตัดที่ 400 ตัว — LINE ปฏิเสธทั้งข้อความถ้ายาวเกิน
        [{ type: 'flex', altText: altText.slice(0, 400), contents: buildDigestFlex(dateStr, classes) }]
      )
      sent++
    }
    return { teachers: sent }
  } catch (e) {
    console.error('[teacher-digest] unexpected error:', e)
    return { teachers: 0 }
  }
}

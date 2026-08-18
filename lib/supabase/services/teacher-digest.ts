// lib/supabase/services/teacher-digest.ts
// สรุป "พรุ่งนี้ครูมีอะไรบ้าง" ส่งทาง LINE เป็น Flex ใบเดียว ครอบคลุม 4 ประเภท:
// คลาสปกติ (+ ใครลา) / เรียนชดเชย / ทดลองเรียน / ซ้อม VEX ของทีมที่ดูแล
//
// ข้อมูลมาจาก RPC get_teacher_daily_digest ครั้งเดียว (migration
// 20260818_teacher_digest_add_makeup_trial) ซึ่งกรองมาให้แล้วว่าเป็นครูที่ยัง
// ใช้งานอยู่และผูก LINE จริง → ไม่ต้องเช็คซ้ำฝั่ง TS
//
// ครูที่พรุ่งนี้ไม่มีอะไรเลย จะไม่อยู่ในผลลัพธ์ = ไม่ได้รับข้อความ (ไม่รบกวน)

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

type DigestType = 'class' | 'makeup' | 'trial' | 'practice'

interface DigestClass {
  type: DigestType
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
  /** ชื่อนักเรียน — ชดเชย/ทดลองเรียน = 1 คน, ซ้อม = รายชื่อทั้งทีม */
  studentName: string | null
}

interface DigestTeacher {
  teacher_id: string
  teacher_name: string
  line_user_id: string
  classes: DigestClass[]
}

const BRAND = '#f05a5a' // เดียวกับ flex classReminder ที่ส่งให้ผู้ปกครอง
const LEAVE_COLOR = '#e67e22'

// ป้ายกำกับประเภท — คลาสปกติไม่ต้องมีป้าย (เป็นค่าเริ่มต้นอยู่แล้ว)
const TYPE_META: Record<DigestType, { label: string; color: string } | null> = {
  class: null,
  makeup: { label: 'ชดเชย', color: '#9333EA' },
  trial: { label: 'ทดลองเรียน', color: '#F97316' },
  practice: { label: 'ซ้อม VEX', color: '#2563EB' },
}

function titleOf(c: DigestClass): string {
  // ซ้อมใช้ชื่อทีมเป็นหัวข้อ (className = "ทีม 2989B"), ที่เหลือใช้ชื่อวิชา
  const base = c.type === 'practice' ? c.className : c.subjectName || c.className
  const session = c.sessionNumber ? ` (ครั้งที่ ${c.sessionNumber}${c.totalSessions ? `/${c.totalSessions}` : ''})` : ''
  return `${base || '-'}${session}`
}

function placeLabel(c: DigestClass): string {
  return [c.branchName, c.roomName ? `ห้อง ${c.roomName}` : null].filter(Boolean).join(' · ')
}

/** บรรทัดคน: คลาสปกติบอกจำนวน (หักคนลา), ที่เหลือบอกชื่อ */
function peopleLabel(c: DigestClass): string {
  if (c.type === 'class') {
    const leaves = c.leaveNames?.length || 0
    return leaves
      ? `👥 มาเรียน ${Math.max(0, c.studentCount - leaves)}/${c.studentCount} คน`
      : `👥 นักเรียน ${c.studentCount} คน`
  }
  if (c.type === 'practice') {
    return `👥 ${c.studentCount} คน: ${c.studentName || '-'}`
  }
  return `👦 ${c.studentName || '-'}`
}

/** ข้อความสำรอง (altText + เครื่องที่แสดง flex ไม่ได้) */
function formatItemText(c: DigestClass): string {
  const meta = TYPE_META[c.type]
  const place = placeLabel(c)
  return (
    `▸ ${hhmm(c.startTime)}-${hhmm(c.endTime)}${meta ? ` [${meta.label}]` : ''} ${titleOf(c)}` +
    (place ? `\n   📍 ${place}` : '') +
    `\n   ${peopleLabel(c)}` +
    (c.leaveNames?.length ? `\n   🙋 ลา: ${c.leaveNames.join(', ')}` : '')
  )
}

/** การ์ด 1 รายการใน body ของ bubble */
function itemBlock(c: DigestClass) {
  const meta = TYPE_META[c.type]
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
          color: meta?.color || BRAND,
          flex: 0,
        },
        ...(meta
          ? [{ type: 'text', text: meta.label, size: 'xs', color: meta.color, align: 'end', weight: 'bold' }]
          : []),
      ],
    },
    {
      type: 'text',
      text: titleOf(c),
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
  contents.push({ type: 'text', text: peopleLabel(c), size: 'xs', color: '#666666', wrap: true, margin: 'xs' })
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

function buildDigestFlex(dateStr: string, items: DigestClass[]) {
  const blocks: any[] = []
  items.forEach((c, i) => {
    if (i > 0) blocks.push({ type: 'separator', margin: 'lg' })
    blocks.push({ ...itemBlock(c), margin: i > 0 ? 'lg' : 'none' })
  })

  const practices = items.filter((c) => c.type === 'practice').length
  const classes = items.length - practices
  const summary = [classes ? `${classes} คลาส` : null, practices ? `ซ้อม ${practices} ทีม` : null]
    .filter(Boolean)
    .join(' · ')

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '🔔 ตารางพรุ่งนี้', weight: 'bold', size: 'md', color: '#ffffff' },
        { type: 'text', text: thaiDate(dateStr), size: 'sm', color: '#ffffff', margin: 'xs' },
      ],
      backgroundColor: BRAND,
      paddingAll: '15px',
    },
    body: { type: 'box', layout: 'vertical', contents: blocks, paddingAll: '16px' },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: summary || '-', size: 'xs', color: '#999999', align: 'center' }],
      paddingAll: '10px',
    },
  }
}

/**
 * ส่งสรุปของวันที่ `dateStr` ให้ครูทุกคนที่มีงานวันนั้น (1 ข้อความ/ครู).
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
      const items = t.classes || []
      if (items.length === 0) continue
      const altText = `🔔 ตารางพรุ่งนี้ ${thaiDate(dateStr)}\n\n` + items.map(formatItemText).join('\n\n')
      await enqueueLineMessages(
        [t.line_user_id],
        // altText ตัดที่ 400 ตัว — LINE ปฏิเสธทั้งข้อความถ้ายาวเกิน
        [{ type: 'flex', altText: altText.slice(0, 400), contents: buildDigestFlex(dateStr, items) }]
      )
      sent++
    }
    return { teachers: sent }
  } catch (e) {
    console.error('[teacher-digest] unexpected error:', e)
    return { teachers: 0 }
  }
}

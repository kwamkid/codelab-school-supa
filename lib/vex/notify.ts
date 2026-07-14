// lib/vex/notify.ts
// Notify the parent who submitted a VEX practice request when an admin approves
// it or edits its time. Uses the existing LINE outbox (public.line_notification_queue,
// type:'custom' → payload.to + payload.messages). This is the ONE place VEX code
// touches a public.* table with a WRITE — a queue row, not VEX data — and it's a
// deliberate, isolated exception to reach the shared LINE notifier.

import { createServiceClient } from '@/lib/supabase/server'
import { restSelect } from '@/lib/supabase/rest'

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

export type PracticeNotifyKind = 'approved' | 'rejected' | 'edited'

export interface PracticeForNotify {
  parent_id: string | null
  practice_date: string
  start_time: string | null
  end_time: string | null
  kid_id: string
}

/**
 * Enqueue (and best-effort immediately send) a LINE notification to the parent
 * who owns `practice`. Safe to await; never throws (failures are logged and the
 * hourly cron will still drain the queue).
 */
export async function notifyParentPractice(
  practice: PracticeForNotify,
  kind: PracticeNotifyKind,
  kidNickname?: string | null
): Promise<void> {
  try {
    if (!practice.parent_id) return

    // Resolve the parent's LINE userId (needed as the push target).
    const rows = await restSelect<{ line_user_id: string | null }>('parents', {
      id: `eq.${practice.parent_id}`,
      select: 'line_user_id',
      limit: '1',
    })
    const lineUserId = rows?.[0]?.line_user_id
    if (!lineUserId) return // parent not linked to LINE → nothing to send

    const who = kidNickname ? `ของ ${kidNickname} ` : ''
    const when = `${thaiDate(practice.practice_date)} เวลา ${timeRange(practice.start_time, practice.end_time)}`

    let text: string
    if (kind === 'approved') {
      text = `✅ คำขอซ้อม${who}ได้รับการอนุมัติแล้ว\n📅 ${when}`
    } else if (kind === 'rejected') {
      text = `❌ คำขอซ้อม${who}ไม่ได้รับการอนุมัติ\n📅 ${when}\nกรุณาติดต่อแอดมินหรือเสนอวันใหม่`
    } else {
      text = `✏️ แอดมินปรับเวลาซ้อม${who}ให้ใหม่\n📅 ${when}`
    }

    const supabase = createServiceClient()
    const { error } = await supabase.from('line_notification_queue' as any).insert({
      type: 'custom',
      status: 'pending',
      payload: { to: lineUserId, messages: [{ type: 'text', text }] },
    })
    if (error) {
      console.error('[vex notify] enqueue failed:', error.message)
      return
    }

    // Best-effort immediate send (the hourly cron is the safety net).
    try {
      const { processLineQueue } = await import('@/lib/supabase/services/line-queue')
      await processLineQueue()
    } catch (e) {
      console.error('[vex notify] immediate process failed (cron will retry):', e)
    }
  } catch (e) {
    console.error('[vex notify] unexpected error:', e)
  }
}

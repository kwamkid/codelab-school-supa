// lib/vex/event-timeline.ts
// Helpers for laying VEX events out as a Thai-month-grouped timeline, split into
// upcoming vs past. Pure functions — shared by the parent RSVP page and the admin
// events tab. Dates are "YYYY-MM-DD" strings (all-day events, no timezone math).

import type { Level } from './types'

export interface TimelineEvent {
  id: string
  name: string
  date_start: string | null
  date_end: string | null
  place: string | null
  has_world_spot: boolean
  levels?: Level[]
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** "14 พ.ย. 26" — 2-digit CE year, matching the reference design. */
export function thaiShortDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  const yy = y % 100
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${String(yy).padStart(2, '0')}`
}

/** "พฤศจิกายน 2026" (CE year — matches the reference design). */
export function thaiMonthLabel(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return `${THAI_MONTHS[m - 1]} ${y}`
}

/** Display the event's date span: "14 พ.ย. 26" or "14 – 16 พ.ย. 26". */
export function thaiDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  if (!end || end === start) return thaiShortDate(start)
  return `${thaiShortDate(start)} – ${thaiShortDate(end)}`
}

/**
 * An event is "past" once its LAST day is before today. Uses date_end when set,
 * else date_start. `todayStr` is the caller's local "YYYY-MM-DD" (passed in so the
 * function stays pure / testable).
 */
export function isPastEvent(ev: TimelineEvent, todayStr: string): boolean {
  const last = ev.date_end || ev.date_start
  if (!last) return false // undated events are always treated as upcoming
  return last < todayStr
}

export interface MonthGroup {
  key: string // "YYYY-MM"
  label: string // "พฤศจิกายน 2026"
  events: TimelineEvent[]
}

/** Group events by month (by date_start), sorted; undated events go last. */
export function groupByMonth(events: TimelineEvent[]): MonthGroup[] {
  const groups = new Map<string, TimelineEvent[]>()
  const undated: TimelineEvent[] = []

  for (const ev of events) {
    if (!ev.date_start) {
      undated.push(ev)
      continue
    }
    const key = ev.date_start.slice(0, 7) // YYYY-MM
    const arr = groups.get(key) || []
    arr.push(ev)
    groups.set(key, arr)
  }

  const sortedKeys = Array.from(groups.keys()).sort()
  const result: MonthGroup[] = sortedKeys.map((key) => ({
    key,
    label: thaiMonthLabel(key + '-01'),
    events: (groups.get(key) || []).sort((a, b) =>
      (a.date_start || '').localeCompare(b.date_start || '')
    ),
  }))

  if (undated.length) {
    result.push({ key: 'undated', label: 'ยังไม่กำหนดวัน', events: undated })
  }
  return result
}

/** Split events into { upcoming, past } (each still a flat list, pre-sorted). */
export function splitByTime(
  events: TimelineEvent[],
  todayStr: string
): { upcoming: TimelineEvent[]; past: TimelineEvent[] } {
  const upcoming: TimelineEvent[] = []
  const past: TimelineEvent[] = []
  for (const ev of events) {
    ;(isPastEvent(ev, todayStr) ? past : upcoming).push(ev)
  }
  // upcoming ascending (soonest first); past descending (most recent first).
  upcoming.sort((a, b) => (a.date_start || '').localeCompare(b.date_start || ''))
  past.sort((a, b) => (b.date_start || '').localeCompare(a.date_start || ''))
  return { upcoming, past }
}

/** Caller's local today as "YYYY-MM-DD". */
export function localTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

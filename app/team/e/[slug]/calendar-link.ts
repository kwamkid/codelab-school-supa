// app/team/e/[slug]/calendar-link.ts
// Build a "Add to Google Calendar" URL for an all-day event (single day or a
// multi-day range). Google's all-day `dates` param uses an EXCLUSIVE end date
// (YYYYMMDD/YYYYMMDD where the end is the day AFTER the last day), so we always
// add one day to date_end (or to date_start when there's no end).

function ymd(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"; strip the hyphens.
  return dateStr.replace(/-/g, '')
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export interface CalendarEventInput {
  name: string
  dateStart: string | null // "YYYY-MM-DD"
  dateEnd?: string | null // "YYYY-MM-DD" (optional → single-day)
  place?: string | null
  details?: string
}

/**
 * Google Calendar template link. Returns null if there's no start date.
 * Single day  → dates=YYYYMMDD/<start+1>
 * Date range  → dates=YYYYMMDD(start)/<end+1>
 */
export function googleCalendarUrl(ev: CalendarEventInput): string | null {
  if (!ev.dateStart) return null

  const start = ymd(ev.dateStart)
  // End is exclusive: for a range use date_end+1, for a single day use start+1.
  const endSource = ev.dateEnd && ev.dateEnd >= ev.dateStart ? ev.dateEnd : ev.dateStart
  const end = addOneDay(endSource)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.name,
    dates: `${start}/${end}`,
  })
  if (ev.place) params.set('location', ev.place)
  if (ev.details) params.set('details', ev.details)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

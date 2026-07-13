'use client'

// Event RSVP timeline. Events are grouped by Thai month along a vertical timeline;
// each kid is a tappable pill that cycles pend → go → no (saved immediately).
// Past events are shown disabled under a separate "ผ่านมาแล้ว" section.

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Globe, MapPin, CalendarPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RsvpStatus } from '@/lib/vex/types'
import { googleCalendarUrl } from './calendar-link'
import {
  type TimelineEvent,
  thaiShortDate,
  thaiDateRange,
  groupByMonth,
  splitByTime,
  localTodayStr,
} from '@/lib/vex/event-timeline'

interface Kid { id: string; nickname: string }
interface AttendanceRow { event_id: string; kid_id: string; status: RsvpStatus }

interface Props {
  slug: string
  kids: Kid[]
  events: TimelineEvent[]
  initialAttendance: AttendanceRow[]
  lineUserId: string | null
  onSave: (eventId: string, kidId: string, status: RsvpStatus) => Promise<void>
}

const NEXT: Record<RsvpStatus, RsvpStatus> = { pend: 'go', go: 'no', no: 'pend' }

// Pill appearance per status (kid nickname shown inside the pill).
const CHIP_CLS: Record<RsvpStatus, string> = {
  pend: 'border-dashed border-gray-300 text-gray-600 bg-white',
  go: 'border-solid border-green-500 bg-green-50 text-green-700',
  no: 'border-solid border-red-400 bg-red-50 text-red-600 line-through',
}

export function EventRsvp({ kids, events, initialAttendance, onSave }: Props) {
  const [statuses, setStatuses] = useState<Record<string, RsvpStatus>>(() => {
    const m: Record<string, RsvpStatus> = {}
    for (const a of initialAttendance) m[`${a.event_id}:${a.kid_id}`] = a.status
    return m
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const today = useMemo(() => localTodayStr(), [])
  const { upcoming, past } = useMemo(() => splitByTime(events, today), [events, today])
  const upcomingGroups = useMemo(() => groupByMonth(upcoming), [upcoming])

  const statusFor = (eventId: string, kidId: string): RsvpStatus =>
    statuses[`${eventId}:${kidId}`] || 'pend'

  const goCount = (eventId: string) =>
    kids.reduce((n, k) => n + (statusFor(eventId, k.id) === 'go' ? 1 : 0), 0)

  const cycle = async (eventId: string, kidId: string) => {
    const key = `${eventId}:${kidId}`
    if (saving[key]) return
    const current = statusFor(eventId, kidId)
    const next = NEXT[current]

    setStatuses((prev) => ({ ...prev, [key]: next }))
    setSaving((prev) => ({ ...prev, [key]: true }))
    try {
      await onSave(eventId, kidId, next)
    } catch (e: any) {
      setStatuses((prev) => ({ ...prev, [key]: current }))
      toast.error(e?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (events.length === 0) {
    return <p className="text-center text-gray-500 py-8">ยังไม่มีกิจกรรมสำหรับทีมนี้</p>
  }

  const renderEvent = (ev: TimelineEvent, disabled: boolean) => {
    const calUrl = !disabled
      ? googleCalendarUrl({ name: ev.name, dateStart: ev.date_start, dateEnd: ev.date_end, place: ev.place })
      : null
    const going = goCount(ev.id)

    return (
      <div key={ev.id} className="relative pl-8 pb-8 last:pb-0">
        {/* timeline rail — behind the node, centered on it (node center x=8px) */}
        <span
          className={cn(
            'absolute left-[7px] top-1 bottom-0 w-0.5',
            disabled ? 'bg-gray-200' : 'bg-primary/30'
          )}
        />
        {/* timeline node */}
        <span
          className={cn(
            'absolute left-0 top-1 h-4 w-4 rounded-full border-[3px] bg-white z-10',
            disabled ? 'border-gray-300' : 'border-primary'
          )}
        />
        <div className={cn(disabled && 'opacity-60')}>
          {/* date */}
          <div className={cn('text-sm font-semibold tracking-wide', disabled ? 'text-gray-400' : 'text-primary')}>
            {thaiDateRange(ev.date_start, ev.date_end) || 'ยังไม่กำหนดวัน'}
          </div>
          {/* name */}
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="font-bold text-lg leading-tight">{ev.name}</span>
            {ev.has_world_spot && (
              <Badge className="bg-amber-100 text-amber-800 gap-1">
                <Globe className="h-3 w-3" /> World
              </Badge>
            )}
          </div>
          {/* place */}
          {ev.place && (
            <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {ev.place}
            </div>
          )}

          {/* kid chips + summary */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {kids.map((kid) => {
              const st = statusFor(ev.id, kid.id)
              const key = `${ev.id}:${kid.id}`
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => !disabled && cycle(ev.id, kid.id)}
                  disabled={disabled || saving[key]}
                  className={cn(
                    'px-4 py-1.5 rounded-full border text-sm font-medium transition',
                    CHIP_CLS[st],
                    (disabled || saving[key]) && 'cursor-not-allowed',
                    saving[key] && 'opacity-60'
                  )}
                >
                  {kid.nickname}
                </button>
              )
            })}
            {kids.length > 0 && (
              <span className="text-sm text-gray-500 ml-1">
                <span className="font-bold text-green-600">{going}</span>/{kids.length} ไป
              </span>
            )}
          </div>

          {calUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5 text-primary border-primary/40 hover:bg-primary/5"
            >
              <a href={calUrl} target="_blank" rel="noopener noreferrer">
                <CalendarPlus className="h-4 w-4" /> เพิ่มลงปฏิทิน
              </a>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upcoming — grouped by month, on a shared timeline rail */}
      {upcoming.length === 0 && past.length > 0 && (
        <p className="text-center text-gray-500 py-4">ไม่มีกิจกรรมที่กำลังจะมาถึง</p>
      )}
      {upcomingGroups.map((group) => (
        <div key={group.key}>
          <h2 className="text-sm font-bold text-gray-500 tracking-wider mb-3 pl-8">{group.label}</h2>
          <div>{group.events.map((ev) => renderEvent(ev, false))}</div>
        </div>
      ))}

      {/* Past — collapsed under a header, disabled */}
      {past.length > 0 && (
        <div className="pt-2">
          <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-3 pl-8">ผ่านมาแล้ว</h2>
          <div>{past.map((ev) => renderEvent(ev, true))}</div>
        </div>
      )}
    </div>
  )
}

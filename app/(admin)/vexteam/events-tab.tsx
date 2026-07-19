'use client'

// Competition events timeline (grouped by month, upcoming vs past) + program
// filter (IQ / V5) + create/edit/delete.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { CalendarDays, Globe, MapPin, Pencil, Trash2, Users } from 'lucide-react'
import { LEVEL_META, PROGRAM_LOGO, type Level, type Program } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'
import {
  thaiDateRange,
  groupByMonth,
  splitByTime,
  localTodayStr,
  type TimelineEvent,
} from '@/lib/vex/event-timeline'
import { CreateEventForm, type EditableEvent } from './create-event-form'

interface EventRow {
  id: string
  name: string
  date_start: string | null
  date_end: string | null
  place: string | null
  has_world_spot: boolean
  levels: Level[]
}

export function EventsTab() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [programFilter, setProgramFilter] = useState<Program | 'all'>('all')

  const [editEvent, setEditEvent] = useState<EditableEvent | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteEvent, setDeleteEvent] = useState<EditableEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const today = useMemo(() => localTodayStr(), [])

  const loadEvents = useCallback(async () => {
    const res = await authFetch('/api/admin/vex/events')
    const data = await res.json()
    if (res.ok) setEvents(data.events || [])
    else toast.error(data.error || 'โหลดกิจกรรมไม่สำเร็จ')
    setLoading(false)
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const filteredEvents = useMemo(() => {
    if (programFilter === 'all') return events as TimelineEvent[]
    return (events as TimelineEvent[]).filter((e) =>
      (e.levels || []).some((lv) => LEVEL_META[lv]?.program === programFilter)
    )
  }, [events, programFilter])

  const { upcoming, past } = useMemo(() => splitByTime(filteredEvents, today), [filteredEvents, today])
  const upcomingGroups = useMemo(() => groupByMonth(upcoming), [upcoming])

  const doDeleteEvent = async () => {
    if (!deleteEvent) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/admin/vex/events/${deleteEvent.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'ลบกิจกรรมไม่สำเร็จ')
        return
      }
      toast.success('ลบกิจกรรมแล้ว')
      setDeleteEvent(null)
      loadEvents()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setDeleting(false)
    }
  }

  const renderEvent = (ev: EventRow, disabled: boolean) => (
    <div key={ev.id} className="relative pl-8 pb-8 last:pb-0">
      <span
        className={cn('absolute left-[7px] top-1 bottom-0 w-0.5', disabled ? 'bg-gray-200' : 'bg-primary/30')}
      />
      <span
        className={cn(
          'absolute left-0 top-1 h-4 w-4 rounded-full border-[3px] bg-white z-10',
          disabled ? 'border-gray-300' : 'border-primary'
        )}
      />
      <div className={cn('flex items-start justify-between gap-3', disabled && 'opacity-60')}>
        <div className="min-w-0">
          <div className={disabled ? 'text-sm font-semibold text-gray-400' : 'text-sm font-semibold text-primary'}>
            {thaiDateRange(ev.date_start, ev.date_end) || 'ยังไม่กำหนดวัน'}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="font-bold text-lg leading-tight">{ev.name}</span>
            {ev.has_world_spot && (
              <Badge className="bg-amber-100 text-amber-800 gap-1">
                <Globe className="h-3 w-3" /> World
              </Badge>
            )}
          </div>
          {ev.place && (
            <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {ev.place}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {/* Who confirmed for this event (parents' RSVP from /team/e links) */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-gray-600"
              onClick={() => router.push(`/vexteam/events/roster?event=${ev.id}`)}
            >
              <Users className="h-4 w-4" />
              รายชื่อ
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-primary"
              onClick={() => {
                setEditEvent(ev)
                setEditOpen(true)
              }}
              aria-label="แก้ไข"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-red-600"
              onClick={() => setDeleteEvent(ev)}
              aria-label="ลบ"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {(ev.levels || []).map((lv) => (
              <LevelBadge key={lv} level={lv} logoHeight={26} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProgramFilter('all')}
            className={cn(
              'px-3 py-2 rounded-md border text-sm font-medium transition',
              programFilter === 'all'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-input text-gray-600 hover:bg-gray-50'
            )}
          >
            ทั้งหมด
          </button>
          {(['iq', 'v5'] as Program[]).map((prog) => (
            <button
              key={prog}
              type="button"
              onClick={() => setProgramFilter(prog)}
              className={cn(
                'inline-flex items-center rounded-md border px-3 py-1.5 transition',
                programFilter === prog ? 'border-primary bg-primary/5' : 'border-input bg-white hover:bg-gray-50'
              )}
              aria-label={prog === 'iq' ? 'VEX IQ' : 'VEX V5'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PROGRAM_LOGO[prog]}
                alt={prog === 'iq' ? 'VEX IQ' : 'VEX V5'}
                style={{ height: 28, width: 'auto' }}
                className="object-contain"
              />
            </button>
          ))}
        </div>
        <CreateEventForm onSaved={loadEvents} />
      </div>

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="ยังไม่มีกิจกรรม" description="สร้างกิจกรรมการแข่งขันเพื่อให้ผู้ปกครองแจ้งเข้าร่วม" />
      ) : filteredEvents.length === 0 ? (
        <EmptyState icon={CalendarDays} title="ไม่พบกิจกรรมตามตัวกรอง" description="ลองเปลี่ยนระดับ" />
      ) : (
        <div className="space-y-6">
          {upcoming.length === 0 && past.length > 0 && (
            <p className="text-center text-gray-500 py-4">ไม่มีกิจกรรมที่กำลังจะมาถึง</p>
          )}
          {upcomingGroups.map((group) => (
            <div key={group.key}>
              <h2 className="text-sm font-bold text-gray-500 tracking-wider mb-3 pl-8">{group.label}</h2>
              <div>{group.events.map((ev) => renderEvent(ev as EventRow, false))}</div>
            </div>
          ))}
          {past.length > 0 && (
            <div className="pt-2">
              <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-3 pl-8">ผ่านมาแล้ว</h2>
              <div>{past.map((ev) => renderEvent(ev as EventRow, true))}</div>
            </div>
          )}
        </div>
      )}

      {editEvent && (
        <CreateEventForm
          event={editEvent}
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o)
            if (!o) setEditEvent(null)
          }}
          onSaved={loadEvents}
        />
      )}

      <AlertDialog open={!!deleteEvent} onOpenChange={(o) => !o && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบกิจกรรม “{deleteEvent?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              จะลบการแจ้งเข้าร่วม (RSVP) ของทุกทีมสำหรับกิจกรรมนี้ด้วย ไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                doDeleteEvent()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'กำลังลบ...' : 'ลบกิจกรรม'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

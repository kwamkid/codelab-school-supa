'use client'

// VEX Team admin. Two tabs:
//  - ทีม: list teams with their two public links (event RSVP + practice) + copy buttons.
//  - กิจกรรม: list competition events with their levels.

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Trophy, Copy, Users, CalendarDays, Globe, ChevronRight, MapPin, Pencil, Trash2 } from 'lucide-react'
import { LEVELS, LEVEL_LABELS, type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'
import {
  thaiDateRange,
  groupByMonth,
  splitByTime,
  localTodayStr,
  type TimelineEvent,
} from '@/lib/vex/event-timeline'
import { CreateTeamForm } from './create-team-form'
import { CreateEventForm, type EditableEvent } from './create-event-form'

interface TeamRow {
  id: string
  team_number: string
  name: string | null
  level: Level
  eventLink: string | null
  practiceLink: string | null
}

interface EventRow {
  id: string
  name: string
  date_start: string | null
  date_end: string | null
  place: string | null
  has_world_spot: boolean
  levels: Level[]
}

function publicUrl(kind: 'e' | 'p', slug: string) {
  if (typeof window === 'undefined') return `/team/${kind}/${slug}`
  return `${window.location.origin}/team/${kind}/${slug}`
}

function CopyLinkButton({ label, url }: { label: string; url: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`คัดลอกลิงก์${label}แล้ว`)
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1">
      <Copy className="h-3.5 w-3.5" /> {label}
    </Button>
  )
}

function VexTeamAdminInner() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  // Event filters
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all') // team id

  // Active tab persisted in ?tab= (so refresh / back keeps the tab).
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') === 'events' ? 'events' : 'teams'
  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set('tab', tab)
    router.replace(`/vexteam?${params.toString()}`, { scroll: false })
  }

  // Event edit/delete
  const [editEvent, setEditEvent] = useState<EditableEvent | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteEvent, setDeleteEvent] = useState<EditableEvent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const today = useMemo(() => localTodayStr(), [])

  // Levels present across the teams, for the "team" filter → its level.
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  const filteredEvents = useMemo(() => {
    let list = events as TimelineEvent[]
    // Filter by an explicit level, OR by the selected team's level.
    let effectiveLevel: Level | null = null
    if (teamFilter !== 'all') {
      effectiveLevel = teamById.get(teamFilter)?.level ?? null
    } else if (levelFilter !== 'all') {
      effectiveLevel = levelFilter
    }
    if (effectiveLevel) {
      list = list.filter((e) => (e.levels || []).includes(effectiveLevel!))
    }
    return list
  }, [events, levelFilter, teamFilter, teamById])

  const { upcoming, past } = useMemo(
    () => splitByTime(filteredEvents, today),
    [filteredEvents, today]
  )
  const upcomingGroups = useMemo(() => groupByMonth(upcoming), [upcoming])

  const loadTeams = useCallback(async () => {
    const res = await authFetch('/api/admin/vex/teams')
    const data = await res.json()
    if (res.ok) setTeams(data.teams || [])
    else toast.error(data.error || 'โหลดทีมไม่สำเร็จ')
  }, [])

  const loadEvents = useCallback(async () => {
    const res = await authFetch('/api/admin/vex/events')
    const data = await res.json()
    if (res.ok) setEvents(data.events || [])
    else toast.error(data.error || 'โหลดกิจกรรมไม่สำเร็จ')
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadTeams(), loadEvents()])
    setLoading(false)
  }, [loadTeams, loadEvents])

  useEffect(() => {
    loadAll()
  }, [loadAll])

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

  // One event node on the admin timeline.
  const renderAdminEvent = (ev: EventRow, disabled: boolean) => (
    <div key={ev.id} className="relative pl-8 pb-8 last:pb-0">
      <span
        className={cn(
          'absolute left-0 top-1 h-4 w-4 rounded-full border-[3px] bg-white',
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
        {/* right column: edit/delete + level logos (right-aligned) */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1">
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
    <div className="p-4 sm:p-6 text-base">
      <PageHeader title="VEX Team" icon={Trophy} iconColor="text-red-600" description="จัดการทีม VEX, เด็ก และกิจกรรมการแข่งขัน" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="h-4 w-4" /> ทีม ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <CalendarDays className="h-4 w-4" /> กิจกรรม ({events.length})
          </TabsTrigger>
        </TabsList>

        {/* Teams */}
        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-end">
            <CreateTeamForm onCreated={loadTeams} />
          </div>
          {teams.length === 0 ? (
            <EmptyState icon={Users} title="ยังไม่มีทีม" description="สร้างทีม VEX ทีมแรกเพื่อเริ่มต้น" />
          ) : (
            <div className="grid gap-3">
              {teams.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href={`/vexteam/${t.id}`} className="flex-1 min-w-0 group">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{t.team_number}</span>
                        {t.name && <span className="text-gray-500">— {t.name}</span>}
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      {t.eventLink && (
                        <CopyLinkButton label="RSVP กิจกรรม" url={publicUrl('e', t.eventLink)} />
                      )}
                      {t.practiceLink && (
                        <CopyLinkButton label="ซ้อม" url={publicUrl('p', t.practiceLink)} />
                      )}
                      <LevelBadge level={t.level} logoHeight={26} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Events */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">กรองตามระดับ</label>
                <Select
                  value={levelFilter}
                  onValueChange={(v) => {
                    setLevelFilter(v as Level | 'all')
                    if (v !== 'all') setTeamFilter('all')
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกระดับ</SelectItem>
                    {LEVELS.map((lv) => (
                      <SelectItem key={lv} value={lv}>
                        {LEVEL_LABELS[lv]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">กรองตามทีม</label>
                <Select
                  value={teamFilter}
                  onValueChange={(v) => {
                    setTeamFilter(v)
                    if (v !== 'all') setLevelFilter('all')
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกทีม</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.team_number}
                        {t.name ? ` — ${t.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CreateEventForm onSaved={loadEvents} />
          </div>

          {events.length === 0 ? (
            <EmptyState icon={CalendarDays} title="ยังไม่มีกิจกรรม" description="สร้างกิจกรรมการแข่งขันเพื่อให้ผู้ปกครองแจ้งเข้าร่วม" />
          ) : filteredEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title="ไม่พบกิจกรรมตามตัวกรอง" description="ลองเปลี่ยนระดับหรือทีม" />
          ) : (
            <div className="space-y-6">
              {upcoming.length === 0 && past.length > 0 && (
                <p className="text-center text-gray-500 py-4">ไม่มีกิจกรรมที่กำลังจะมาถึง</p>
              )}
              {upcomingGroups.map((group) => (
                <div key={group.key}>
                  <h2 className="text-sm font-bold text-gray-500 tracking-wider mb-3 pl-8">{group.label}</h2>
                  <div className="relative border-l-2 border-primary/30 ml-2">
                    {group.events.map((ev) => renderAdminEvent(ev as EventRow, false))}
                  </div>
                </div>
              ))}
              {past.length > 0 && (
                <div className="pt-2">
                  <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-3 pl-8">ผ่านมาแล้ว</h2>
                  <div className="relative border-l-2 border-gray-200 ml-2">
                    {past.map((ev) => renderAdminEvent(ev as EventRow, true))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit event dialog (controlled) */}
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

      {/* Delete event confirm */}
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

export default function VexTeamAdminPage() {
  // useSearchParams (in the inner component) needs a Suspense boundary.
  return (
    <Suspense fallback={<PageLoading />}>
      <VexTeamAdminInner />
    </Suspense>
  )
}

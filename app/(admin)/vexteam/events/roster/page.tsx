'use client'

// VEX Team → รายชื่อเข้าแข่งขัน: ทีม × นักเรียน matrix against event columns
// (ไป / ไม่ไป / ยังไม่ตอบ). Filter by event, team, program; past events hidden
// by default. Reached from the events page ("รายชื่อ" per event preselects it).

import { Fragment, Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormSelect, type FormSelectOption } from '@/components/ui/form-select'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { LevelBadge } from '@/components/vex/level-badge'
import { useBranch } from '@/contexts/BranchContext'
import { LEVEL_LABELS, LEVEL_META, LEVELS, PROGRAM_LOGO, type Level, type Program } from '@/lib/vex/types'
import { thaiDateRange, localTodayStr } from '@/lib/vex/event-timeline'
import { cn } from '@/lib/utils'
import { ArrowLeft, Check, ClipboardList, Download, Globe, X } from 'lucide-react'

interface RosterEvent {
  id: string
  name: string
  dateStart: string | null
  dateEnd: string | null
  place: string | null
  hasWorldSpot: boolean
  levels: Level[]
}
interface RosterKid {
  id: string
  nickname: string
  fullName: string | null
  parentName: string
}
interface RosterTeam {
  teamId: string
  teamNumber: string
  teamName: string | null
  level: Level
  branchId: string | null
  kids: RosterKid[]
}
interface RosterRsvp { eventId: string; kidId: string; status: 'go' | 'no'; updatedAt: string | null }

const isPast = (e: RosterEvent, today: string) => {
  const last = e.dateEnd || e.dateStart
  return !!last && last < today
}

function RosterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedBranchId } = useBranch()

  const [events, setEvents] = useState<RosterEvent[]>([])
  const [teams, setTeams] = useState<RosterTeam[]>([])
  const [rsvps, setRsvps] = useState<RosterRsvp[]>([])
  const [loading, setLoading] = useState(true)

  const [programFilter, setProgramFilter] = useState<Program | 'all'>('all')
  const [eventFilter, setEventFilter] = useState<string>(searchParams.get('event') || 'all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [showPast, setShowPast] = useState(false)
  const [kidSearch, setKidSearch] = useState('')

  const today = useMemo(() => localTodayStr(), [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await authFetch('/api/admin/vex/events/roster')
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'โหลดรายชื่อไม่สำเร็จ')
          return
        }
        setEvents(data.events || [])
        setTeams(data.teams || [])
        setRsvps(data.rsvps || [])
      } catch {
        toast.error('เกิดข้อผิดพลาด')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // kid×event → RSVP row (absence = ยังไม่ตอบ)
  const rsvpMap = useMemo(() => {
    const m = new Map<string, RosterRsvp>()
    rsvps.forEach((r) => m.set(`${r.kidId}:${r.eventId}`, r))
    return m
  }, [rsvps])

  const selectedEvent = eventFilter === 'all' ? null : events.find((e) => e.id === eventFilter) || null

  const eventOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: 'all', label: 'ทุกงาน' },
      ...events.map((e) => ({
        value: e.id,
        label: e.dateStart ? `${e.name} (${thaiDateRange(e.dateStart, e.dateEnd)})` : e.name,
      })),
    ],
    [events]
  )
  const teamOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: 'all', label: 'ทุกทีม' },
      ...teams
        .filter((t) => !selectedBranchId || t.branchId === selectedBranchId)
        .map((t) => ({
          value: t.teamId,
          label: `${t.teamName ? `${t.teamNumber} — ${t.teamName}` : t.teamNumber} (${LEVEL_LABELS[t.level]})`,
        })),
    ],
    [teams, selectedBranchId]
  )

  const visibleEvents = useMemo(() => {
    if (selectedEvent) return [selectedEvent]
    return events.filter((e) => {
      if (!showPast && isPast(e, today)) return false
      if (programFilter === 'all') return true
      return e.levels.some((lv) => LEVEL_META[lv]?.program === programFilter)
    })
  }, [events, selectedEvent, showPast, today, programFilter])

  const visibleTeams = useMemo(() => {
    const q = kidSearch.trim().toLowerCase()
    return teams
      .filter((t) => !selectedBranchId || t.branchId === selectedBranchId)
      .filter((t) => teamFilter === 'all' || t.teamId === teamFilter)
      .filter((t) => (programFilter === 'all' ? true : LEVEL_META[t.level]?.program === programFilter))
      .filter((t) => (selectedEvent ? selectedEvent.levels.includes(t.level) : true))
      .map((t) =>
        q
          ? {
              ...t,
              kids: t.kids.filter(
                (k) =>
                  k.nickname.toLowerCase().includes(q) || (k.fullName || '').toLowerCase().includes(q)
              ),
            }
          : t
      )
      .filter((t) => t.kids.length > 0)
      .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.teamNumber.localeCompare(b.teamNumber))
  }, [teams, selectedBranchId, teamFilter, programFilter, selectedEvent, kidSearch])

  // Per visible event: ไป / ไม่ไป / ยังไม่ตอบ across applicable visible kids
  const columnCounts = useMemo(() => {
    const m = new Map<string, { go: number; no: number; pend: number }>()
    visibleEvents.forEach((ev) => {
      const c = { go: 0, no: 0, pend: 0 }
      visibleTeams.forEach((t) => {
        if (!ev.levels.includes(t.level)) return
        t.kids.forEach((k) => {
          const s = rsvpMap.get(`${k.id}:${ev.id}`)?.status || 'pend'
          c[s]++
        })
      })
      m.set(ev.id, c)
    })
    return m
  }, [visibleEvents, visibleTeams, rsvpMap])

  // CSV: ทีม / ระดับ / ชื่อเด็ก / ผู้ปกครอง + one status column per visible event
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const statusLabel = { go: 'ไป', no: 'ไม่ไป', pend: 'ยังไม่ตอบ' } as const
    const header = [
      'ทีม', 'ระดับ', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'ผู้ปกครอง',
      ...visibleEvents.map((ev) =>
        ev.dateStart ? `${ev.name} (${thaiDateRange(ev.dateStart, ev.dateEnd)})` : ev.name
      ),
    ]
    const rows = visibleTeams.flatMap((t) =>
      t.kids.map((k) => [
        t.teamName ? `${t.teamNumber} — ${t.teamName}` : t.teamNumber,
        LEVEL_LABELS[t.level],
        k.nickname,
        k.fullName || '',
        k.parentName,
        ...visibleEvents.map((ev) =>
          ev.levels.includes(t.level)
            ? statusLabel[rsvpMap.get(`${k.id}:${ev.id}`)?.status || 'pend']
            : '-'
        ),
      ])
    )
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `vex-rsvp-${localTodayStr()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const statusCell = (kidId: string, ev: RosterEvent, applicable: boolean) => {
    if (!applicable) return <span className="text-gray-300">–</span>
    const status = rsvpMap.get(`${kidId}:${ev.id}`)?.status || 'pend'
    if (status === 'go')
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
          <Check className="h-4 w-4 text-green-700" />
        </span>
      )
    if (status === 'no')
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
          <X className="h-4 w-4 text-red-600" />
        </span>
      )
    return <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
  }

  if (loading) return <PageLoading />

  return (
    <div className="p-4 sm:p-6 text-base">
      <PageHeader
        title="รายชื่อเข้าแข่งขัน"
        icon={ClipboardList}
        iconColor="text-red-600"
        description="ภาพรวมการยืนยันเข้าแข่งขันของแต่ละงาน แยกตามทีมและนักเรียน"
        action={
          <Button variant="outline" onClick={() => router.push('/vexteam/events')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> กิจกรรมการแข่งขัน
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <FormSelect
            value={eventFilter}
            onValueChange={setEventFilter}
            options={eventOptions}
            placeholder="เลือกงาน"
            searchPlaceholder="ค้นหางาน..."
            className="w-full sm:w-72"
          />

          <FormSelect
            value={teamFilter}
            onValueChange={setTeamFilter}
            options={teamOptions}
            placeholder="เลือกทีม"
            searchPlaceholder="ค้นหาทีม..."
            className="w-full sm:w-56"
          />

          <SearchInput
            placeholder="ค้นหาชื่อเด็ก..."
            value={kidSearch}
            onChange={setKidSearch}
            className="w-full sm:w-56"
          />

          {!selectedEvent && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none shrink-0">
              <Checkbox checked={showPast} onCheckedChange={(v) => setShowPast(v === true)} />
              แสดงงานที่ผ่านมาแล้ว
            </label>
          )}
        </div>

        <div className="lg:ml-auto">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={visibleTeams.length === 0 || visibleEvents.length === 0}
          >
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary for a single selected event */}
      {selectedEvent && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {selectedEvent.hasWorldSpot && (
            <Badge className="bg-amber-100 text-amber-800 gap-1">
              <Globe className="h-3 w-3" /> World
            </Badge>
          )}
          {(() => {
            const c = columnCounts.get(selectedEvent.id) || { go: 0, no: 0, pend: 0 }
            return (
              <>
                <Badge className="bg-green-100 text-green-700">ไป {c.go}</Badge>
                <Badge className="bg-red-100 text-red-600">ไม่ไป {c.no}</Badge>
                <Badge className="bg-gray-100 text-gray-500">ยังไม่ตอบ {c.pend}</Badge>
              </>
            )
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
            <Check className="h-3.5 w-3.5 text-green-700" />
          </span>
          ไป
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
            <X className="h-3.5 w-3.5 text-red-600" />
          </span>
          ไม่ไป
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
          ยังไม่ตอบ
        </span>
      </div>

      {visibleTeams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="ไม่พบทีม" description="ลองเปลี่ยนตัวกรองทีมหรือระดับ" />
      ) : visibleEvents.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="ไม่มีงานที่กำลังจะถึง"
          description="ติ๊ก “แสดงงานที่ผ่านมาแล้ว” เพื่อดูงานเก่า"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 text-left font-medium text-gray-600 px-3 py-2 min-w-[180px] border-b">
                  ทีม / นักเรียน
                </th>
                {visibleEvents.map((ev) => (
                  <th key={ev.id} className="px-2 py-2 text-center align-bottom min-w-[110px] max-w-[150px] border-b border-l">
                    <div className="font-semibold text-gray-800 leading-tight whitespace-normal">{ev.name}</div>
                    <div className="text-xs font-normal text-gray-500 mt-0.5">
                      {thaiDateRange(ev.dateStart, ev.dateEnd) || 'ยังไม่กำหนดวัน'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((t) => (
                <Fragment key={t.teamId}>
                  <tr className="bg-gray-50/70 border-t">
                    <td className="sticky left-0 z-10 bg-gray-50 px-3 py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <LevelBadge level={t.level} logoHeight={16} className="border-0 bg-transparent px-0 py-0" />
                        <span className="font-semibold">{t.teamNumber}</span>
                        {t.teamName && <span className="text-gray-500 truncate max-w-[120px]">{t.teamName}</span>}
                      </span>
                    </td>
                    {visibleEvents.map((ev) => {
                      const applicable = ev.levels.includes(t.level)
                      const go = applicable
                        ? t.kids.filter((k) => rsvpMap.get(`${k.id}:${ev.id}`)?.status === 'go').length
                        : 0
                      return (
                        <td key={ev.id} className="px-2 py-1.5 text-center border-l">
                          {applicable ? (
                            <span className={cn('text-xs font-medium', go > 0 ? 'text-green-700' : 'text-gray-400')}>
                              ไป {go}/{t.kids.length}
                            </span>
                          ) : (
                            <span className="text-gray-300">–</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {t.kids.map((k) => (
                    <tr key={k.id} className="border-t hover:bg-gray-50/50">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 pl-9">{k.nickname}</td>
                      {visibleEvents.map((ev) => (
                        <td key={ev.id} className="px-2 py-1.5 text-center border-l">
                          {statusCell(k.id, ev, ev.levels.includes(t.level))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-medium text-gray-600">รวมไป</td>
                {visibleEvents.map((ev) => {
                  const c = columnCounts.get(ev.id) || { go: 0, no: 0, pend: 0 }
                  return (
                    <td key={ev.id} className="px-2 py-2 text-center border-l">
                      <span className={cn('font-semibold', c.go > 0 ? 'text-green-700' : 'text-gray-400')}>
                        {c.go}
                      </span>
                      <span className="text-xs text-gray-400"> /{c.go + c.no + c.pend}</span>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function VexEventRosterPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RosterContent />
    </Suspense>
  )
}

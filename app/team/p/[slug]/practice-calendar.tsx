'use client'

// Practice scheduling calendar for parents (ported from codelab-team-scheduler).
// Month grid: tap a day to propose a practice (kid + start/end time + note); each
// proposed practice shows as a chip coloured by its approval status. Below the
// grid, a list of this month's proposals. Tapping a chip opens its detail.

import { useState, useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isBefore,
  startOfDay,
  format,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PracticeStatus } from '@/lib/vex/types'

interface Kid { id: string; nickname: string }
export interface Practice {
  id: string
  kid_id: string
  practice_date: string // YYYY-MM-DD
  start_time: string | null
  end_time: string | null
  note: string | null
  status: PracticeStatus
}

interface Props {
  kids: Kid[]
  initialPractices: Practice[]
  onSubmit: (body: {
    kid_id: string
    practice_date: string
    start_time?: string
    end_time?: string
    note?: string
  }) => Promise<Practice>
}

const STATUS_META: Record<PracticeStatus, { label: string; chip: string; dot: string }> = {
  proposed: { label: 'รออนุมัติ', chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  approved: { label: 'อนุมัติแล้ว', chip: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  rejected: { label: 'ไม่อนุมัติ', chip: 'bg-red-100 text-red-600 border-red-200', dot: 'bg-red-400' },
}

const WEEKDAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

function hhmm(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

export function PracticeCalendar({ kids, initialPractices, onSubmit }: Props) {
  const [practices, setPractices] = useState<Practice[]>(initialPractices)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Modals
  const [proposeDate, setProposeDate] = useState<string | null>(null) // YYYY-MM-DD
  const [viewing, setViewing] = useState<Practice | null>(null)

  const kidName = (id: string) => kids.find((k) => k.id === id)?.nickname || '-'

  // Build the month grid (weeks start Monday).
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    const out: Date[] = []
    let d = calStart
    while (d <= calEnd) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [currentDate])

  const today = startOfDay(new Date())
  const totalWeeks = Math.ceil(days.length / 7)

  const forDay = (date: Date) =>
    practices.filter((p) => isSameDay(new Date(p.practice_date + 'T00:00:00'), date))

  const monthPractices = useMemo(
    () =>
      practices
        .filter((p) => isSameMonth(new Date(p.practice_date + 'T00:00:00'), currentDate))
        .sort((a, b) => a.practice_date.localeCompare(b.practice_date) || (a.start_time || '').localeCompare(b.start_time || '')),
    [practices, currentDate]
  )

  const openPropose = (date: Date) => {
    // Don't allow proposing on past days.
    if (isBefore(date, today)) return
    setProposeDate(format(date, 'yyyy-MM-dd'))
  }

  const handleCreated = (p: Practice) => {
    setPractices((prev) => [...prev, p])
    setProposeDate(null)
  }

  return (
    <div className="space-y-4">
      {/* Calendar nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-50"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-bold text-lg">{format(currentDate, 'MMMM yyyy', { locale: th })}</div>
        <button
          type="button"
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-50"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Month grid */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn('p-2 text-center text-xs font-semibold', i >= 5 ? 'text-primary' : 'text-gray-500')}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(64px, 1fr))` }}>
          {days.map((day, idx) => {
            const items = forDay(day)
            const inMonth = isSameMonth(day, currentDate)
            const isToday = isSameDay(day, today)
            const isPast = isBefore(day, today) && !isToday
            const isWeekend = day.getDay() === 0 || day.getDay() === 6
            const isLastRow = idx >= days.length - 7
            const isLastCol = (idx + 1) % 7 === 0

            return (
              <div
                key={idx}
                onClick={() => openPropose(day)}
                className={cn(
                  'min-h-[64px] p-1 transition-colors',
                  !isLastRow && 'border-b',
                  !isLastCol && 'border-r',
                  !inMonth && 'bg-gray-50/60',
                  isPast ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-primary/5',
                  isToday && 'bg-amber-50/60'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      !inMonth && 'text-gray-300',
                      inMonth && isPast && 'text-gray-400',
                      inMonth && isWeekend && !isPast && 'text-primary',
                      isToday && 'bg-primary text-white'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {!isPast && inMonth && items.length === 0 && (
                    <Plus className="h-3.5 w-3.5 text-gray-300" />
                  )}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {items.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewing(p)
                      }}
                      className={cn(
                        'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded border truncate',
                        STATUS_META[p.status].chip
                      )}
                      title={`${kidName(p.kid_id)} ${hhmm(p.start_time)}`}
                    >
                      {kidName(p.kid_id)}
                    </button>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center">+{items.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        {(['proposed', 'approved', 'rejected'] as PracticeStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>

      {/* This month's list */}
      <div>
        <h3 className="font-semibold px-1 mb-2">รายการเดือนนี้ ({monthPractices.length})</h3>
        {monthPractices.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">แตะวันบนปฏิทินเพื่อเสนอวันซ้อม</p>
        ) : (
          <div className="space-y-2">
            {monthPractices.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setViewing(p)}
                className="w-full text-left bg-white rounded-lg border p-3 flex items-center justify-between gap-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="font-medium">{kidName(p.kid_id)}</div>
                  <div className="text-sm text-gray-600">
                    {format(new Date(p.practice_date + 'T00:00:00'), 'd MMM', { locale: th })}
                    {p.start_time ? ` ${hhmm(p.start_time)}` : ''}
                    {p.end_time ? ` - ${hhmm(p.end_time)}` : ''}
                  </div>
                  {p.note && <div className="text-xs text-gray-500 truncate">{p.note}</div>}
                </div>
                <Badge className={STATUS_META[p.status].chip}>{STATUS_META[p.status].label}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Propose modal */}
      {proposeDate && (
        <ProposeModal
          kids={kids}
          date={proposeDate}
          onClose={() => setProposeDate(null)}
          onSubmit={onSubmit}
          onCreated={handleCreated}
        />
      )}

      {/* Detail modal */}
      {viewing && (
        <DetailModal practice={viewing} kidName={kidName(viewing.kid_id)} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

// ---- Propose modal -------------------------------------------------------

function ProposeModal({
  kids,
  date,
  onClose,
  onSubmit,
  onCreated,
}: {
  kids: Kid[]
  date: string
  onClose: () => void
  onSubmit: Props['onSubmit']
  onCreated: (p: Practice) => void
}) {
  const [kidId, setKidId] = useState(kids[0]?.id ?? '')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('12:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (submitting) return
    if (!kidId) return toast.error('เลือกเด็ก')
    if (start && end && end <= start) return toast.error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม')
    setSubmitting(true)
    try {
      const created = await onSubmit({
        kid_id: kidId,
        practice_date: date,
        start_time: start || undefined,
        end_time: end || undefined,
        note: note.trim() || undefined,
      })
      toast.success('ส่งคำขอซ้อมแล้ว')
      onCreated(created)
    } catch (e: any) {
      toast.error(e?.message || 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="เสนอวันซ้อม" subtitle={format(new Date(date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: th })} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>เด็ก</Label>
          <Select value={kidId} onValueChange={setKidId}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกเด็ก" />
            </SelectTrigger>
            <SelectContent>
              {kids.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.nickname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="pc_start">เวลาเริ่ม</Label>
            <Input id="pc_start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc_end">เวลาจบ</Label>
            <Input id="pc_end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pc_note">หมายเหตุ (ไม่บังคับ)</Label>
          <Input id="pc_note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={submit} className="flex-1" disabled={submitting}>
            {submitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

// ---- Detail modal --------------------------------------------------------

function DetailModal({
  practice,
  kidName,
  onClose,
}: {
  practice: Practice
  kidName: string
  onClose: () => void
}) {
  return (
    <ModalShell title="รายละเอียดการซ้อม" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">เด็ก</span>
          <span className="font-medium">{kidName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">วันที่</span>
          <span className="font-medium">
            {format(new Date(practice.practice_date + 'T00:00:00'), 'd MMM yyyy', { locale: th })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">เวลา</span>
          <span className="font-medium">
            {hhmm(practice.start_time) || '-'}
            {practice.end_time ? ` - ${hhmm(practice.end_time)}` : ''}
          </span>
        </div>
        {practice.note && (
          <div>
            <div className="text-gray-500 mb-1">หมายเหตุ</div>
            <div className="bg-gray-50 rounded-lg p-2 text-sm">{practice.note}</div>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-gray-500">สถานะ</span>
          <Badge className={STATUS_META[practice.status].chip}>{STATUS_META[practice.status].label}</Badge>
        </div>
        <Button variant="outline" onClick={onClose} className="w-full mt-2">
          ปิด
        </Button>
      </div>
    </ModalShell>
  )
}

// ---- Modal shell ---------------------------------------------------------

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

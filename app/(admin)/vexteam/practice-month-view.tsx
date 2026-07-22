'use client'

// Read-only month calendar of ALL students' practice requests (already branch-
// and status-filtered by the parent). Each practice is a chip coloured by status;
// tapping a day shows its list.

import { useState, useMemo, useRef, type ReactNode } from 'react'
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
  format,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StudentBadge } from '@/components/ui/student-badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PracticeStatus } from '@/lib/vex/types'

export interface CalendarPractice {
  id: string
  kid_id: string
  practice_date: string
  start_time: string | null
  end_time: string | null
  status: PracticeStatus
  kidNickname: string | null
  teamNumber: string | null
}

const STATUS_META: Record<PracticeStatus, { label: string; chip: string; dot: string }> = {
  proposed: { label: 'รออนุมัติ', chip: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900', dot: 'bg-amber-400' },
  approved: { label: 'อนุมัติแล้ว', chip: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900', dot: 'bg-green-500' },
  rejected: { label: 'ไม่อนุมัติ', chip: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900', dot: 'bg-red-400' },
}
const WEEKDAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

// Popover รายชื่อ — trigger ได้ทั้ง "ทั้งการ์ดทีม" และปุ่ม "+N":
// เดสก์ท็อป hover ขึ้นทันที, มือถือแตะเปิด/ปิด.
// stopPropagation กันไปโดน onClick ของช่องวัน (ซึ่งเปิด day detail)
function NamesPopover({
  trigger,
  triggerClassName,
  content,
}: {
  trigger: ReactNode
  triggerClassName?: string
  content: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // ปิดแบบหน่วงเวลา + นับ hover บนตัว popover ด้วย — ถ้ากล่องเด้งขึ้นมาทับ
  // ตำแหน่งเมาส์ เบราว์เซอร์จะยิง mouseleave ที่การ์ดทันที (อาการ "โชว์แว้บแล้วหาย")
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          // outline-none: กันวงฟ้า focus ring ของเบราว์เซอร์ตอนแตะ/คลิกการ์ด
          className={cn('outline-none focus:outline-none focus-visible:outline-none', triggerClassName)}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          {trigger}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-auto max-w-64 p-2.5 text-sm space-y-1"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
        // popover นี้เปิดจาก hover — ไม่ต้องย้าย focus เข้ากล่อง (กัน focus ring)
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}

export function PracticeMonthView({
  practices,
  onReview,
  busyId,
  groupByTeam = false,
}: {
  practices: CalendarPractice[]
  /** Approve/reject a proposed practice from the day list. */
  onReview?: (id: string, status: 'approved' | 'rejected') => void
  busyId?: string | null
  /** true = ก้อนละทีม (หัวก้อน = เบอร์ทีม + รายชื่อเด็ก); false = chip ละคน (ใช้ตอนกรองทีมเดียว) */
  groupByTeam?: boolean
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const days = useMemo(() => {
    const calStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    const out: Date[] = []
    let d = calStart
    while (d <= calEnd) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [currentDate])
  const totalWeeks = Math.ceil(days.length / 7)

  const forDay = (date: Date) =>
    practices.filter((p) => isSameDay(new Date(p.practice_date + 'T00:00:00'), date))

  const selectedItems = useMemo(
    () =>
      selectedDay
        ? practices
            .filter((p) => p.practice_date === selectedDay)
            // ทีมเดียวกันอยู่ติดกันใน day list (สอดคล้องกับก้อน group บนปฏิทิน)
            .sort((a, b) => (a.teamNumber || '').localeCompare(b.teamNumber || '') || (a.start_time || '').localeCompare(b.start_time || ''))
        : [],
    [selectedDay, practices]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-bold text-lg">{format(currentDate, 'MMMM yyyy', { locale: th })}</div>
        <button
          type="button"
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn('p-2 text-center text-xs font-semibold', i >= 5 ? 'text-primary' : 'text-gray-500')}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(72px, 1fr))` }}>
          {days.map((day, idx) => {
            const items = forDay(day)
            const inMonth = isSameMonth(day, currentDate)
            const isToday = isSameDay(day, new Date())
            const dayStr = format(day, 'yyyy-MM-dd')
            const isLastRow = idx >= days.length - 7
            const isLastCol = (idx + 1) % 7 === 0
            return (
              <div
                key={idx}
                onClick={() => items.length && setSelectedDay(dayStr)}
                className={cn(
                  'min-h-[72px] p-1 transition-colors',
                  !isLastRow && 'border-b',
                  !isLastCol && 'border-r',
                  // bg-gray-50/60 (opacity variant) ไม่โดน .dark override ใน globals →
                  // ต้องใส่ dark: เอง ไม่งั้นเป็นก้อนเทาสว่างจ้าใน dark mode
                  !inMonth && 'bg-gray-50/60 dark:bg-white/[0.04]',
                  items.length ? 'cursor-pointer hover:bg-primary/5' : '',
                  isToday && 'bg-amber-50/60 dark:bg-amber-950/25'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      !inMonth && 'text-gray-300 dark:text-gray-600',
                      isToday && 'bg-primary text-white'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                {groupByTeam ? (
                  // ก้อนละทีม: หัวก้อน = เบอร์ทีม, ข้างในรายชื่อเด็ก (สี = สถานะ;
                  // ทีมเดียวกันแต่คนละสถานะแยกเป็นคนละก้อน)
                  (() => {
                    const groups: { key: string; teamNumber: string; status: PracticeStatus; kids: CalendarPractice[] }[] = []
                    for (const p of items) {
                      const key = `${p.teamNumber || '-'}|${p.status}`
                      let g = groups.find((x) => x.key === key)
                      if (!g) {
                        g = { key, teamNumber: p.teamNumber || '-', status: p.status, kids: [] }
                        groups.push(g)
                      }
                      g.kids.push(p)
                    }
                    const shown = groups.slice(0, 2)
                    const hiddenKids = groups.slice(2).reduce((s, g) => s + g.kids.length, 0)
                    return (
                      <div className="space-y-0.5 mt-0.5">
                        {shown.map((g) => (
                          // hover/แตะทั้งการ์ดทีม → popover รายชื่อครบทุกคนของทีมนั้น
                          <NamesPopover
                            key={g.key}
                            triggerClassName={cn(
                              'text-[10px] leading-tight px-1 py-0.5 rounded border cursor-pointer',
                              STATUS_META[g.status].chip
                            )}
                            trigger={
                              <>
                                <div className="font-semibold truncate">{g.teamNumber}</div>
                                {g.kids.slice(0, 3).map((k) => (
                                  <div key={k.id} className="truncate">{k.kidNickname || '-'}</div>
                                ))}
                                {g.kids.length > 3 && <div className="text-gray-500">+{g.kids.length - 3}</div>}
                              </>
                            }
                            content={
                              <>
                                <div className="font-semibold">{g.teamNumber} ({g.kids.length} คน)</div>
                                {g.kids.map((k) => (
                                  <div key={k.id}>
                                    {k.kidNickname || '-'}
                                    <span className="text-gray-400 ml-1.5">{hhmm(k.start_time)}{k.end_time ? `-${hhmm(k.end_time)}` : ''}</span>
                                  </div>
                                ))}
                              </>
                            }
                          />
                        ))}
                        {hiddenKids > 0 && (
                          <NamesPopover
                            triggerClassName="w-full text-[10px] text-gray-400 hover:text-gray-600 text-center cursor-pointer"
                            trigger={<>+{hiddenKids}</>}
                            content={
                              <>
                                {groups.slice(2).map((g) => (
                                  <div key={g.key}>
                                    <div className="font-semibold">{g.teamNumber}</div>
                                    {g.kids.map((k) => (
                                      <div key={k.id}>{k.kidNickname || '-'}</div>
                                    ))}
                                  </div>
                                ))}
                              </>
                            }
                          />
                        )}
                      </div>
                    )
                  })()
                ) : (
                  <div className="space-y-0.5 mt-0.5">
                    {items.slice(0, 3).map((p) => (
                      <NamesPopover
                        key={p.id}
                        triggerClassName={cn(
                          'text-[10px] leading-tight px-1 py-0.5 rounded border truncate cursor-pointer',
                          STATUS_META[p.status].chip
                        )}
                        trigger={<>{p.kidNickname || '-'}</>}
                        content={
                          <div>
                            {p.kidNickname || '-'}
                            <span className="text-gray-400 ml-1.5">{hhmm(p.start_time)}{p.end_time ? `-${hhmm(p.end_time)}` : ''}</span>
                          </div>
                        }
                      />
                    ))}
                    {items.length > 3 && (
                      <NamesPopover
                        triggerClassName="w-full text-[10px] text-gray-400 hover:text-gray-600 text-center cursor-pointer"
                        trigger={<>+{items.length - 3}</>}
                        content={
                          <>
                            {items.slice(3).map((p) => (
                              <div key={p.id}>
                                {p.kidNickname || '-'}
                                <span className="text-gray-400 ml-1">{hhmm(p.start_time)}</span>
                              </div>
                            ))}
                          </>
                        }
                      />
                    )}
                  </div>
                )}
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

      {/* Selected-day detail */}
      {selectedDay && selectedItems.length > 0 && (
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <div className="font-semibold">
            {format(new Date(selectedDay + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: th })} ({selectedItems.length})
          </div>
          {selectedItems.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <StudentBadge name={p.kidNickname} />
                <span className="text-sm text-gray-500">{p.teamNumber}</span>
                <span className="text-sm font-medium">
                  {hhmm(p.start_time) || '-'}
                  {p.end_time ? ` - ${hhmm(p.end_time)}` : ''}
                </span>
              </div>
              {/* Approve/reject inline when still pending; else show the status */}
              {onReview && p.status === 'proposed' ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => onReview(p.id, 'approved')}
                    disabled={busyId === p.id}
                    className="gap-1 bg-green-600 hover:bg-green-700 h-8"
                  >
                    <Check className="h-4 w-4" /> อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReview(p.id, 'rejected')}
                    disabled={busyId === p.id}
                    className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                  >
                    <X className="h-4 w-4" /> ปฏิเสธ
                  </Button>
                </div>
              ) : (
                <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_META[p.status].chip)}>
                  {STATUS_META[p.status].label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

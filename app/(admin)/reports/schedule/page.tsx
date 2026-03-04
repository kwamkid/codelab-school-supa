'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'

// --- Types ---

interface ScheduleStudent {
  id: string
  nickname: string
  name: string
}

interface ScheduleClassItem {
  id: string
  name: string
  days_of_week: number[]
  start_time: string
  end_time: string
  teacher_id: string
  teacher_nickname: string
  teacher_name: string
  subject_name: string
  subject_color: string
  students: ScheduleStudent[]
}

interface TimeSlot {
  startTime: string
  endTime: string
  key: string
}

// --- Constants ---

const DAY_LABELS: Record<number, string> = {
  0: 'อาทิตย์',
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์',
}

const THAI_SHORT_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

// Week order: Sat(6), Sun(0), Mon(1), Tue(2), Wed(3), Thu(4), Fri(5)
const WEEK_DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]

const TEACHER_COLORS = [
  '#DC2626', '#2563EB', '#059669', '#D97706',
  '#7C3AED', '#DB2777', '#0891B2', '#4F46E5',
  '#EA580C', '#65A30D', '#0D9488', '#9333EA',
]

// --- Helpers ---

function normalizeTime(t: string): string {
  return t.substring(0, 5)
}

function formatTimeLabel(t: string): string {
  const [h, m] = t.split(':')
  return `${parseInt(h)}.${m}`
}

/** Get the Saturday that starts the week containing `date` */
function getWeekSaturday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0=Sun, 6=Sat
  // If Saturday (6), it's the start. Otherwise go back to previous Saturday.
  const diff = dow >= 6 ? 0 : dow + 1
  d.setDate(d.getDate() - diff)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatThaiDate(date: Date): string {
  return `${date.getDate()} ${THAI_SHORT_MONTHS[date.getMonth()]}`
}

function formatWeekLabel(satDate: Date): string {
  const friDate = addDays(satDate, 6)
  const satYear = satDate.getFullYear() + 543
  const friYear = friDate.getFullYear() + 543
  if (satDate.getMonth() === friDate.getMonth()) {
    return `${satDate.getDate()} - ${friDate.getDate()} ${THAI_SHORT_MONTHS[satDate.getMonth()]} ${satYear}`
  }
  if (satYear === friYear) {
    return `${formatThaiDate(satDate)} - ${formatThaiDate(friDate)} ${friYear}`
  }
  return `${formatThaiDate(satDate)} ${satYear} - ${formatThaiDate(friDate)} ${friYear}`
}

function buildTeacherColorMap(data: ScheduleClassItem[]): Record<string, string> {
  const uniqueIds = [...new Set(data.map(c => c.teacher_id))].filter(Boolean)
  const map: Record<string, string> = {}
  uniqueIds.forEach((id, i) => {
    map[id] = TEACHER_COLORS[i % TEACHER_COLORS.length]
  })
  return map
}

function buildGrid(data: ScheduleClassItem[]) {
  // 1. Unique time slots
  const timeSlotMap = new Map<string, TimeSlot>()
  data.forEach(cls => {
    const start = normalizeTime(cls.start_time)
    const end = normalizeTime(cls.end_time)
    const key = `${start}-${end}`
    if (!timeSlotMap.has(key)) {
      timeSlotMap.set(key, { startTime: start, endTime: end, key })
    }
  })
  const timeSlots = Array.from(timeSlotMap.values()).sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  )

  // 2. Always use all 7 days in Sat→Fri order
  const days = WEEK_DAY_ORDER

  // 3. Build grid
  const grid = new Map<string, Map<number, ScheduleClassItem[]>>()
  timeSlots.forEach(ts => {
    const dayMap = new Map<number, ScheduleClassItem[]>()
    days.forEach(d => dayMap.set(d, []))
    grid.set(ts.key, dayMap)
  })

  // 4. Place classes
  data.forEach(cls => {
    const start = normalizeTime(cls.start_time)
    const end = normalizeTime(cls.end_time)
    const key = `${start}-${end}`
    const dayMap = grid.get(key)
    if (dayMap) {
      cls.days_of_week.forEach(day => {
        if (dayMap.has(day)) {
          dayMap.get(day)!.push(cls)
        }
      })
    }
  })

  return { timeSlots, days, grid }
}

// --- Components ---

function WeekPicker({
  weekStart,
  onWeekChange,
}: {
  weekStart: Date
  onWeekChange: (newStart: Date) => void
}) {
  const goToday = () => onWeekChange(getWeekSaturday(new Date()))
  const goPrev = () => onWeekChange(addDays(weekStart, -7))
  const goNext = () => onWeekChange(addDays(weekStart, 7))

  const isCurrentWeek = formatDateISO(weekStart) === formatDateISO(getWeekSaturday(new Date()))

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={goPrev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[200px] text-center">
        {formatWeekLabel(weekStart)}
      </div>
      <Button variant="outline" size="icon" onClick={goNext} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentWeek && (
        <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
          สัปดาห์นี้
        </Button>
      )}
    </div>
  )
}

function TeacherLegend({
  data,
  colorMap,
}: {
  data: ScheduleClassItem[]
  colorMap: Record<string, string>
}) {
  const teachers = [...new Map(data.map(c => [c.teacher_id, c])).values()]
    .filter(t => t.teacher_id)

  if (teachers.length === 0) return null

  return (
    <div className="flex flex-wrap gap-3 px-1">
      {teachers.map(t => (
        <div key={t.teacher_id} className="flex items-center gap-1.5 text-sm">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: colorMap[t.teacher_id] }}
          />
          <span>{t.teacher_nickname}</span>
        </div>
      ))}
    </div>
  )
}

function ClassCell({
  cls,
  teacherColor,
}: {
  cls: ScheduleClassItem
  teacherColor: string
}) {
  const studentNames = cls.students
    .map(s => s.nickname || s.name)
    .join(' ')

  return (
    <div
      className="rounded-lg p-2 mb-1 last:mb-0 text-xs"
      style={{ backgroundColor: `${teacherColor}15` }}
    >
      <div className="font-bold" style={{ color: teacherColor }}>
        {cls.teacher_nickname}
      </div>
      <div className="text-gray-800 font-medium">
        {cls.subject_name}
      </div>
      {studentNames && (
        <div className="text-gray-500 mt-0.5">{studentNames}</div>
      )}
    </div>
  )
}

// --- Main Page ---

export default function ScheduleReportPage() {
  const { selectedBranchId } = useBranch()
  const [data, setData] = useState<ScheduleClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekSaturday(new Date()))

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  // Build date map: dayOfWeek → actual Date for the selected week
  const weekDates = useMemo(() => {
    const map: Record<number, Date> = {}
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      map[d.getDay()] = d
    }
    return map
  }, [weekStart])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBranchId) params.append('branchId', selectedBranchId)
      params.append('weekStart', formatDateISO(weekStart))
      params.append('weekEnd', formatDateISO(weekEnd))

      const res = await fetch(`/api/reports/schedule?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error('Error loading schedule:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, weekStart, weekEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  const teacherColorMap = useMemo(() => buildTeacherColorMap(data), [data])
  const { timeSlots, days, grid } = useMemo(() => buildGrid(data), [data])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-orange-500" />
            ตารางสอน
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            ตารางเรียนรายสัปดาห์ แสดงตามช่วงเวลาและวัน
          </p>
        </div>
        <WeekPicker weekStart={weekStart} onWeekChange={setWeekStart} />
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CalendarDays className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">ไม่มีข้อมูลคลาสเรียน</p>
            <p className="text-sm mt-1">ไม่พบคลาสที่เปิดสอนในสัปดาห์นี้</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Teacher Legend */}
          <Card>
            <CardContent className="py-3">
              <TeacherLegend data={data} colorMap={teacherColorMap} />
            </CardContent>
          </Card>

          {/* Timetable Grid */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 w-[120px] text-center">
                        เวลา
                      </th>
                      {days.map(day => (
                        <th
                          key={day}
                          className="border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 text-center"
                        >
                          <div>{DAY_LABELS[day]}</div>
                          {weekDates[day] && (
                            <div className="text-xs font-normal text-gray-400">
                              {formatThaiDate(weekDates[day])}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map(ts => {
                      const dayMap = grid.get(ts.key)!
                      return (
                        <tr key={ts.key}>
                          <td className="border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 text-center whitespace-nowrap align-top bg-gray-50">
                            {formatTimeLabel(ts.startTime)} - {formatTimeLabel(ts.endTime)} น.
                          </td>
                          {days.map(day => {
                            const classes = dayMap.get(day) || []
                            return (
                              <td
                                key={day}
                                className="border border-gray-200 px-2 py-2 align-top min-w-[160px]"
                              >
                                {classes.map(cls => (
                                  <ClassCell
                                    key={cls.id}
                                    cls={cls}
                                    teacherColor={teacherColorMap[cls.teacher_id] || '#6B7280'}
                                  />
                                ))}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

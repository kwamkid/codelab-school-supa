// components/liff/schedule/monthly-calendar.tsx
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar, MapPin, User, Clock } from 'lucide-react'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'
import { StudentBadge } from '@/components/ui/student-badge'
import { TeacherBadge } from '@/components/ui/teacher-badge'
import { cn } from '@/lib/utils'

interface MonthlyCalendarProps {
  events: ScheduleEvent[]
  selectedStudentId: string
  students: any[]
  onEventClick: (event: ScheduleEvent) => void
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

// Dot/colour for an event by its status
function eventColor(event: ScheduleEvent, isPast: boolean) {
  const s = event.extendedProps.status
  if (event.extendedProps.type === 'makeup') return 'bg-purple-500'
  if (s === 'absent' || s === 'leave-requested' || event.extendedProps.hasMakeupRequest) return 'bg-red-500'
  if (s === 'completed' || isPast) return 'bg-green-500'
  return 'bg-blue-500'
}

export default function MonthlyCalendar({ events, selectedStudentId, onEventClick }: MonthlyCalendarProps) {
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate())

  const filteredEvents = selectedStudentId
    ? events.filter(e => e.extendedProps.studentId === selectedStudentId)
    : events

  const { calendar, eventsMap, year, month } = useMemo(() => {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    const firstDay = new Date(y, m, 1)
    const lastDay = new Date(y, m + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const map = new Map<number, ScheduleEvent[]>()
    filteredEvents.forEach(event => {
      if (event.start.getMonth() === m && event.start.getFullYear() === y) {
        const d = event.start.getDate()
        if (!map.has(d)) map.set(d, [])
        map.get(d)!.push(event)
      }
    })

    const cal: (number | null)[][] = []
    let week: (number | null)[] = new Array(startDayOfWeek).fill(null)
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day)
      if (week.length === 7) { cal.push(week); week = [] }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null)
      cal.push(week)
    }
    return { calendar: cal, eventsMap: map, year: y, month: m }
  }, [currentMonth, filteredEvents])

  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  // When the visible month changes, default the selected day to today (if the
  // current month is shown) or clear it.
  useEffect(() => {
    setSelectedDay(isCurrentMonth ? now.getDate() : null)
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const goPrev = () => setCurrentMonth(new Date(year, month - 1, 1))
  const goNext = () => setCurrentMonth(new Date(year, month + 1, 1))
  const goToday = () => setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))

  const isToday = (day: number) => day === now.getDate() && isCurrentMonth
  const isPastDate = (day: number) => new Date(year, month, day, 23, 59, 59) < now

  const selectedEvents = selectedDay ? (eventsMap.get(selectedDay) || []) : []

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">{THAI_MONTHS[month]} {year + 543}</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={goPrev} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={goToday} className="h-8">วันนี้</Button>
              <Button size="sm" variant="outline" onClick={goNext} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Compact grid: number + dots */}
          <div className="space-y-0.5">
            {calendar.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="aspect-square" />
                  const dayEvents = eventsMap.get(day) || []
                  const hasEvents = dayEvents.length > 0
                  const past = isPastDate(day)
                  const today = isToday(day)
                  const selected = selectedDay === day
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => hasEvents && setSelectedDay(day)}
                      className={cn(
                        'aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative transition-colors',
                        hasEvents ? 'cursor-pointer active:bg-gray-100' : 'cursor-default',
                        selected && 'bg-primary/10 ring-1 ring-primary',
                        today && !selected && 'ring-1 ring-primary/40',
                      )}
                    >
                      <span className={cn(
                        today ? 'font-bold text-primary' : past && !hasEvents ? 'text-gray-300' : 'text-gray-700',
                      )}>
                        {day}
                      </span>
                      {hasEvents && (
                        <div className="flex gap-0.5 mt-0.5 h-1.5">
                          {dayEvents.slice(0, 3).map((e, i) => (
                            <span key={i} className={cn('w-1.5 h-1.5 rounded-full', eventColor(e, past))} />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selectedDay && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              {selectedDay} {THAI_MONTHS[month]} {year + 543}
            </h4>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">ไม่มีคลาสเรียนวันนี้</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(event => {
                  const past = event.end < now
                  return (
                    // Same title / student badge / teacher badge treatment as the
                    // home + list cards — the shared badges ARE the global style.
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer active:bg-gray-100"
                      onClick={() => onEventClick(event)}
                    >
                      <span className={cn('w-3 h-3 rounded-full mt-1.5 shrink-0', eventColor(event, past))} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-semibold truncate">
                            {event.extendedProps.subjectName || event.extendedProps.className}
                          </span>
                          {event.extendedProps.type === 'makeup' ? (
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 shrink-0">Makeup</Badge>
                          ) : (
                            <StudentBadge name={event.extendedProps.studentNickname || event.extendedProps.studentName} size="md" className="shrink-0" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {event.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {event.end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.extendedProps.branchName} - {event.extendedProps.roomName}
                          </div>
                          <TeacherBadge
                            name={event.extendedProps.teacherName}
                            imageUrl={event.extendedProps.teacherImage}
                            size="md"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

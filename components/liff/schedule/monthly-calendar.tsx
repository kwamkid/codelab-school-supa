// components/liff/schedule/monthly-calendar.tsx
'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar, MapPin, User, Clock } from 'lucide-react'
import { formatDate, formatTime, getDayName } from '@/lib/utils'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'
import { cn } from '@/lib/utils'

interface MonthlyCalendarProps {
  events: ScheduleEvent[]
  selectedStudentId: string
  students: any[]
  onEventClick: (event: ScheduleEvent) => void
}

// Thai month names
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export default function MonthlyCalendar({ 
  events, 
  selectedStudentId, 
  students,
  onEventClick 
}: MonthlyCalendarProps) {
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Filter events
  const filteredEvents = selectedStudentId 
    ? events.filter(e => e.extendedProps.studentId === selectedStudentId)
    : events

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    
    // Create events map for quick lookup
    const eventsMap = new Map<string, ScheduleEvent[]>()
    filteredEvents.forEach(event => {
      if (event.start.getMonth() === month && event.start.getFullYear() === year) {
        const dateKey = event.start.getDate().toString()
        if (!eventsMap.has(dateKey)) {
          eventsMap.set(dateKey, [])
        }
        eventsMap.get(dateKey)!.push(event)
      }
    })
    
    // Create calendar grid
    const calendar: (number | null)[][] = []
    let week: (number | null)[] = new Array(startDayOfWeek).fill(null)
    
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day)
      if (week.length === 7) {
        calendar.push(week)
        week = []
      }
    }
    
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null)
      }
      calendar.push(week)
    }
    
    return { calendar, eventsMap, year, month }
  }, [currentMonth, filteredEvents])

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }
  
  const goToToday = () => {
    setCurrentMonth(new Date())
  }

  // Check if date is today
  const isToday = (day: number) => {
    return day === now.getDate() && 
           calendarData.month === now.getMonth() && 
           calendarData.year === now.getFullYear()
  }

  // Check if date is in the past
  const isPastDate = (day: number) => {
    const date = new Date(calendarData.year, calendarData.month, day, 23, 59, 59)
    return date < now
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {THAI_MONTHS[calendarData.month]} {calendarData.year + 543}
            </h3>
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="outline"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={goToToday}
              >
                วันนี้
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar body */}
            <div className="space-y-1">
              {calendarData.calendar.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <div key={dayIndex} className="aspect-[4/3] md:aspect-square" />
                    }
                    
                    const dayEvents = calendarData.eventsMap.get(day.toString()) || []
                    const isPast = isPastDate(day)
                    const isCurrentDay = isToday(day)
                    
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "relative border rounded-lg p-1 md:p-2 overflow-hidden transition-colors",
                          "min-h-[80px] md:min-h-[100px]",
                          isCurrentDay && "border-primary bg-primary/5",
                          isPast && "bg-gray-50",
                          dayEvents.length > 0 && !isPast && "hover:bg-gray-50 cursor-pointer"
                        )}
                        onClick={() => dayEvents.length > 0 && dayEvents.forEach(e => onEventClick(e))}
                      >
                        {/* Day number */}
                        <div className={cn(
                          "text-sm md:text-base font-medium mb-1",
                          isCurrentDay && "text-primary",
                          isPast && "text-gray-400"
                        )}>
                          {day}
                        </div>
                        
                        {/* Events - Bigger and clearer */}
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event, idx) => {
                            const isMakeup = event.extendedProps.type === 'makeup'
                            const isAbsent = event.extendedProps.status === 'absent' || 
                                           event.extendedProps.status === 'leave-requested'
                            const isCompleted = event.extendedProps.status === 'completed' || 
                                              (isPast && !isAbsent)
                            
                            return (
                              <div
                                key={event.id}
                                className={cn(
                                  "text-xs md:text-sm px-1.5 py-1 rounded font-medium",
                                  isMakeup && "bg-purple-100 text-purple-700",
                                  isAbsent && "bg-red-100 text-red-700 line-through",
                                  isCompleted && !isMakeup && !isAbsent && "bg-green-100 text-green-700",
                                  !isMakeup && !isAbsent && !isCompleted && "bg-blue-100 text-blue-700"
                                )}
                                title={`${event.extendedProps.studentNickname} - ${event.extendedProps.className}`}
                              >
                                <span className="block truncate">
                                  {event.extendedProps.studentNickname}
                                </span>
                                <span className="text-[10px] md:text-xs opacity-75">
                                  {event.start.toLocaleTimeString('th-TH', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>
                            )
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-600 font-medium px-1">
                              +{dayEvents.length - 3} รายการ
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Events */}
      {calendarData.eventsMap.get(now.getDate().toString()) && 
       calendarData.month === now.getMonth() && 
       calendarData.year === now.getFullYear() && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              คลาสเรียนวันนี้
            </h4>
            <div className="space-y-2">
              {calendarData.eventsMap.get(now.getDate().toString())!.map(event => (
                <div 
                  key={event.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  onClick={() => onEventClick(event)}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    event.extendedProps.type === 'makeup' ? "bg-purple-500" :
                    event.extendedProps.status === 'absent' ? "bg-red-500" :
                    "bg-blue-500"
                  )} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {event.extendedProps.studentNickname || event.extendedProps.studentName}
                      </span>
                      {event.extendedProps.type === 'makeup' && (
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          Makeup
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {event.end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.extendedProps.branchName} - {event.extendedProps.roomName}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        ครู{event.extendedProps.teacherName}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
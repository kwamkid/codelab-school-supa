// components/liff/schedule/course-calendar.tsx
'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarOff, Info } from 'lucide-react'
import { formatDate, getDayName } from '@/lib/utils'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'
import { cn } from '@/lib/utils'

interface CourseCalendarProps {
  events: ScheduleEvent[]
  selectedStudentId: string
  students: any[]
  onLeaveRequest: (event: ScheduleEvent) => void
}

interface MonthData {
  year: number
  month: number
  monthName: string
  dates: Map<number, DayData>
}

interface DayData {
  date: number
  events: ScheduleEvent[]
  dayOfWeek: number
}

// Thai month names
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

// Student colors for multi-student view
const STUDENT_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100' },
  { bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-100' },
  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-100' },
  { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-100' },
  { bg: 'bg-pink-500', text: 'text-pink-500', light: 'bg-pink-100' },
]

export default function CourseCalendar({ 
  events, 
  selectedStudentId, 
  students,
  onLeaveRequest 
}: CourseCalendarProps) {
  const now = new Date()
  
  // Filter events by student and type
  const classEvents = events.filter(e => 
    e.extendedProps.type === 'class' &&
    (selectedStudentId ? e.extendedProps.studentId === selectedStudentId : true)
  )

  // Create student color map
  const studentColorMap = new Map<string, typeof STUDENT_COLORS[0]>()
  students.forEach((student, index) => {
    studentColorMap.set(student.student.id, STUDENT_COLORS[index % STUDENT_COLORS.length])
  })

  // Group events by month
  const monthsData: MonthData[] = []
  const monthMap = new Map<string, MonthData>()

  classEvents.forEach(event => {
    const year = event.start.getFullYear()
    const month = event.start.getMonth()
    const monthKey = `${year}-${month}`
    
    if (!monthMap.has(monthKey)) {
      const monthData: MonthData = {
        year,
        month,
        monthName: THAI_MONTHS[month],
        dates: new Map()
      }
      monthMap.set(monthKey, monthData)
      monthsData.push(monthData)
    }
    
    const monthData = monthMap.get(monthKey)!
    const date = event.start.getDate()
    
    if (!monthData.dates.has(date)) {
      monthData.dates.set(date, {
        date,
        events: [],
        dayOfWeek: event.start.getDay()
      })
    }
    
    monthData.dates.get(date)!.events.push(event)
  })

  // Sort months
  monthsData.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  // Render mini calendar for a month
  const renderMiniCalendar = (monthData: MonthData) => {
    const firstDay = new Date(monthData.year, monthData.month, 1)
    const lastDay = new Date(monthData.year, monthData.month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    
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

    return (
      <div className="bg-white rounded-lg">
        {/* Calendar header */}
        <div className="grid grid-cols-7 gap-0 mb-1">
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar body */}
        <div className="space-y-0.5">
          {calendar.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-0.5">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={dayIndex} className="aspect-square" />
                }
                
                const dayData = monthData.dates.get(day)
                const hasEvents = !!dayData
                const isPast = new Date(monthData.year, monthData.month, day, 23, 59, 59) < now
                
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      "aspect-square relative flex items-center justify-center text-xs rounded",
                      hasEvents && "font-semibold",
                      isPast && "text-gray-400"
                    )}
                  >
                    {/* Day number */}
                    <span className="relative z-10">{day}</span>
                    
                    {/* Event indicators */}
                    {hasEvents && (
                      <div className="absolute inset-0 p-0.5">
                        {selectedStudentId ? (
                          // Single student - show event status
                          <div className={cn(
                            "w-full h-full rounded",
                            dayData.events.some(e => 
                              e.extendedProps.status === 'absent' || 
                              e.extendedProps.status === 'leave-requested'
                            ) ? "bg-red-100 border border-red-300" :
                            dayData.events.some(e => e.extendedProps.status === 'completed') || isPast
                              ? "bg-green-100 border border-green-300"
                              : "bg-blue-100 border border-blue-300"
                          )} />
                        ) : (
                          // Multiple students - show color dots
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {[...new Set(dayData.events.map(e => e.extendedProps.studentId))].map(studentId => {
                              const color = studentColorMap.get(studentId)
                              return (
                                <div
                                  key={studentId}
                                  className={cn("w-1.5 h-1.5 rounded-full", color?.bg)}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        
        {/* Event details for this month */}
        <div className="mt-3 space-y-1">
          {Array.from(monthData.dates.entries())
            .sort(([a], [b]) => a - b)
            .map(([date, dayData]) => {
              const dateObj = new Date(monthData.year, monthData.month, date)
              const isPast = dateObj < now
              
              return (
                <div key={date} className="text-xs">
                  <div className="font-medium text-gray-700 mb-0.5">
                    {date} {getDayName(dayData.dayOfWeek)}
                  </div>
                  {dayData.events.map(event => {
                    const studentColor = studentColorMap.get(event.extendedProps.studentId)
                    const canRequestLeave = !isPast && 
                      event.extendedProps.status !== 'absent' && 
                      event.extendedProps.status !== 'leave-requested'
                    
                    return (
                      <div 
                        key={event.id} 
                        className={cn(
                          "flex flex-col gap-1 p-1.5 rounded mb-0.5",
                          studentColor?.light
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {!selectedStudentId && (
                              <div className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0",
                                studentColor?.bg
                              )} />
                            )}
                            <span className="text-gray-700 text-xs">
                              {event.extendedProps.studentNickname}
                              {event.extendedProps.sessionNumber && (
                                <span className="text-gray-500 ml-1">
                                  (ครั้งที่ {event.extendedProps.sessionNumber})
                                </span>
                              )}
                            </span>
                          </div>
                          {canRequestLeave && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => onLeaveRequest(event)}
                            >
                              <CalendarOff className="h-3 w-3 mr-1" />
                              ขอลา
                            </Button>
                          )}
                        </div>
                        
                        {/* Show leave/makeup status */}
                        {(event.extendedProps.status === 'absent' || 
                          event.extendedProps.status === 'leave-requested' ||
                          event.extendedProps.hasMakeupRequest) && (
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant="destructive" 
                              className="text-xs h-5 px-1.5"
                            >
                              Makeup
                            </Badge>
                            {event.extendedProps.makeupScheduled ? (
                              <span className="text-xs text-green-600">
                                นัดแล้ว: {formatDate(event.extendedProps.makeupDate, 'short')}
                              </span>
                            ) : (
                              <span className="text-xs text-orange-600">
                                รอนัด
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  if (monthsData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">ไม่มีข้อมูลตารางเรียน</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      {!selectedStudentId && students.length > 1 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {students.map((student, index) => {
                const color = STUDENT_COLORS[index % STUDENT_COLORS.length]
                return (
                  <div key={student.student.id} className="flex items-center gap-1.5">
                    <div className={cn("w-3 h-3 rounded-full", color.bg)} />
                    <span className="text-sm">{student.student.nickname || student.student.name}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Course Period Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">ช่วงเวลาเรียน</p>
              <p className="text-muted-foreground">
                {formatDate(classEvents[0]?.start, 'long')} - {formatDate(classEvents[classEvents.length - 1]?.start, 'long')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Calendars */}
      <div className="grid gap-4 md:grid-cols-2">
        {monthsData.map(monthData => (
          <Card key={`${monthData.year}-${monthData.month}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {monthData.monthName} {monthData.year + 543}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderMiniCalendar(monthData)}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Status Legend */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">สถานะ</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded" />
              <span>กำลังจะถึง</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
              <span>เรียนแล้ว</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
              <span>ลาเรียน</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
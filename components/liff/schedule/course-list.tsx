// components/liff/schedule/course-list.tsx
'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StudentBadge } from '@/components/ui/student-badge'
import { TeacherBadge } from '@/components/ui/teacher-badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, MapPin, User, CalendarOff, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { formatDate, formatTime, getDayName } from '@/lib/utils'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'
import { cn } from '@/lib/utils'

interface CourseListProps {
  events: ScheduleEvent[]
  selectedStudentId: string
  students: any[]
  onLeaveRequest: (event: ScheduleEvent) => void
}

export default function CourseList({ 
  events, 
  selectedStudentId, 
  students,
  onLeaveRequest 
}: CourseListProps) {
  // Filter events by student
  const studentEvents = selectedStudentId 
    ? events.filter(e => e.extendedProps.studentId === selectedStudentId)
    : events

  // Group events by class
  const eventsByClass = studentEvents.reduce((acc, event) => {
    if (event.extendedProps.type === 'class') {
      const key = `${event.classId}-${event.extendedProps.studentId}`
      if (!acc[key]) {
        acc[key] = {
          classId: event.classId,
          className: event.extendedProps.className || event.extendedProps.subjectName,
          subjectName: event.extendedProps.subjectName || event.extendedProps.className,
          studentId: event.extendedProps.studentId,
          studentName: event.extendedProps.studentNickname || event.extendedProps.studentName,
          subjectColor: event.extendedProps.subjectColor,
          branchName: event.extendedProps.branchName,
          roomName: event.extendedProps.roomName,
          teacherName: event.extendedProps.teacherName,
          events: []
        }
      }
      acc[key].events.push(event)
    }
    return acc
  }, {} as Record<string, any>)

  // Sort events within each class
  Object.values(eventsByClass).forEach(classData => {
    classData.events.sort((a: ScheduleEvent, b: ScheduleEvent) => 
      a.start.getTime() - b.start.getTime()
    )
  })

  const now = new Date()

  // Get status icon and color
  const getStatusDisplay = (event: ScheduleEvent) => {
    const isPast = event.end < now
    const status = event.extendedProps.status
    const hasMakeup = event.extendedProps.hasMakeupRequest
    const makeupScheduled = event.extendedProps.makeupScheduled
    
    if (status === 'completed' || (isPast && status !== 'absent' && status !== 'leave-requested' && !hasMakeup)) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        label: 'เรียนแล้ว',
        subLabel: null
      }
    } else if (status === 'absent' || status === 'leave-requested' || hasMakeup) {
      return {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: 'Makeup',
        subLabel: makeupScheduled 
          ? `นัดแล้ว: ${formatDate(event.extendedProps.makeupDate, 'short')}` 
          : 'รอนัด'
      }
    } else {
      return {
        icon: Calendar,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        label: 'กำลังจะถึง',
        subLabel: null
      }
    }
  }

  const renderSession = (event: ScheduleEvent) => {
    const statusDisplay = getStatusDisplay(event)
    const isPast = event.end < now
    const canRequestLeave = !isPast &&
      event.extendedProps.status !== 'absent' &&
      event.extendedProps.status !== 'leave-requested'

    return (
      <div key={event.id} className={cn('p-3 rounded-lg border transition-colors', statusDisplay.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn('flex items-center justify-center w-8 h-8 rounded-full mt-0.5', statusDisplay.bgColor)}>
              <statusDisplay.icon className={cn('h-4 w-4', statusDisplay.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">ครั้งที่ {event.extendedProps.sessionNumber}</span>
                <span className="text-sm text-muted-foreground">{getDayName(event.start.getDay())}</span>
              </div>
              <div className="text-sm text-muted-foreground">{formatDate(event.start, 'short')}</div>
              <div className="text-sm text-muted-foreground">
                {event.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {event.end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {event.extendedProps.hasMakeupRequest && event.extendedProps.makeupScheduled && (
                <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  เรียนชดเชย: {formatDate(event.extendedProps.makeupDate, 'short')}
                  {' '}เวลา {event.extendedProps.makeupTime}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant={statusDisplay.color === 'text-green-600' ? 'default' :
                statusDisplay.color === 'text-red-600' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {statusDisplay.label}
            </Badge>
            {statusDisplay.subLabel && (
              <span className={cn('text-xs', statusDisplay.subLabel.includes('นัดแล้ว') ? 'text-green-600' : 'text-orange-600')}>
                {statusDisplay.subLabel}
              </span>
            )}
            {canRequestLeave && (
              <Button size="sm" variant="outline" onClick={() => onLeaveRequest(event)} className="text-xs h-7">
                <CalendarOff className="h-3 w-3 mr-1" />
                ขอลา
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (Object.keys(eventsByClass).length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">ไม่มีคลาสเรียน</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.values(eventsByClass).map((classData: any) => (
        <Card key={`${classData.classId}-${classData.studentId}`}>
          <CardContent className="p-3">
            {/* Class Header */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {classData.subjectColor && (
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: classData.subjectColor }}
                    />
                  )}
                  <h3 className="font-semibold text-lg">{classData.subjectName}</h3>
                </div>
                <StudentBadge name={classData.studentName} />
              </div>
              
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {classData.branchName} - {classData.roomName}
                </div>
                <TeacherBadge name={classData.teacherName} size="sm" />
              </div>
            </div>

            {/* Sessions: past sessions collapsed, upcoming shown */}
            {(() => {
              const past = classData.events.filter((e: ScheduleEvent) => e.end < now)
              const upcoming = classData.events.filter((e: ScheduleEvent) => e.end >= now)
              return (
                <div className="space-y-2">
                  {past.length > 0 && (
                    <details className="group">
                      <summary className="flex items-center gap-1 cursor-pointer select-none text-sm text-gray-500 py-1.5">
                        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        คาบที่ผ่านมาแล้ว ({past.length})
                      </summary>
                      <div className="space-y-2 mt-2">{past.map(renderSession)}</div>
                    </details>
                  )}
                  {upcoming.map(renderSession)}
                </div>
              )
            })()}

            {/* Class Summary */}
            <div className="mt-4 pt-4 border-t flex justify-between text-sm">
              <div className="flex gap-4">
                <span className="text-green-600">
                  เรียนแล้ว: {classData.events.filter((e: ScheduleEvent) => 
                    e.extendedProps.status === 'completed' || e.end < now
                  ).length}
                </span>
                <span className="text-blue-600">
                  คงเหลือ: {classData.events.filter((e: ScheduleEvent) => 
                    e.end >= now && e.extendedProps.status !== 'absent' && e.extendedProps.status !== 'leave-requested'
                  ).length}
                </span>
                <span className="text-red-600">
                  ลา/Makeup: {classData.events.filter((e: ScheduleEvent) => 
                    e.extendedProps.status === 'absent' || 
                    e.extendedProps.status === 'leave-requested' ||
                    e.extendedProps.hasMakeupRequest
                  ).length}
                </span>
              </div>
              <span className="text-muted-foreground">
                ทั้งหมด: {classData.events.length} ครั้ง
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
import { createServiceClient } from '../server'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'
import { getReferenceMaps } from './liff-ref'

export interface StudentScheduleData {
  student: {
    id: string
    name: string
    nickname?: string
    profileImage?: string
  }
  enrollments: unknown[]
  classes: unknown[]
  makeupClasses: unknown[]
}

export interface StudentStats {
  totalClasses: number
  completedClasses: number
  upcomingClasses: number
  makeupClasses: number
}

export async function getParentScheduleEvents(
  lineUserId: string,
  start: Date,
  end: Date
): Promise<{
  events: ScheduleEvent[]
  students: StudentScheduleData[]
  stats: Record<string, StudentStats>
}> {
  const supabase = createServiceClient() as any
  try {
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    const { data, error } = await supabase.rpc('get_liff_schedule', {
      p_line_user_id: lineUserId,
      p_start: startStr,
      p_end: endStr,
    })
    if (error) {
      console.error('[getParentScheduleEvents] RPC error:', error)
      return { events: [], students: [], stats: {} }
    }

    const now = new Date()
    const events: ScheduleEvent[] = []

    const toClock = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number)
      return [h || 0, m || 0] as const
    }

    // Regular class sessions
    for (const s of (data?.sessions || [])) {
      const sessionDate = new Date(s.sessionDate)
      const [sh, sm] = toClock(s.startTime)
      const [eh, em] = toClock(s.endTime)
      const eventStart = new Date(sessionDate); eventStart.setHours(sh, sm, 0, 0)
      const eventEnd = new Date(sessionDate); eventEnd.setHours(eh, em, 0, 0)
      const passed = eventEnd < now

      let backgroundColor = '#E5E7EB', borderColor = '#D1D5DB', textColor = '#374151'
      let effectiveStatus: string = s.scheduleStatus
      if (s.hasMakeup) {
        backgroundColor = '#FEE2E2'; borderColor = '#FCA5A5'; textColor = '#991B1B'
        effectiveStatus = passed ? 'absent' : 'leave-requested'
      } else if (s.attendanceStatus === 'present') {
        backgroundColor = '#D1FAE5'; borderColor = '#A7F3D0'; textColor = '#065F46'; effectiveStatus = 'completed'
      } else if (s.attendanceStatus === 'absent') {
        backgroundColor = '#FEE2E2'; borderColor = '#FCA5A5'; textColor = '#991B1B'; effectiveStatus = 'absent'
      } else if (passed) {
        backgroundColor = '#D1FAE5'; borderColor = '#A7F3D0'; textColor = '#065F46'; effectiveStatus = 'completed'
      }

      events.push({
        id: `${s.classId}-${s.scheduleId}-${s.studentId}`,
        classId: s.classId,
        title: `${s.studentNickname || s.studentName} - ${s.className}`,
        start: eventStart,
        end: eventEnd,
        backgroundColor, borderColor, textColor,
        extendedProps: {
          type: 'class',
          studentId: s.studentId,
          studentName: s.studentName,
          studentNickname: s.studentNickname,
          branchName: s.branchName,
          roomName: s.roomName,
          teacherName: s.teacherName,
          subjectName: s.subjectName,
          className: s.className,
          subjectColor: s.subjectColor,
          sessionNumber: s.sessionNumber,
          status: effectiveStatus,
          hasMakeupRequest: s.hasMakeup,
          makeupScheduled: s.makeupStatus === 'scheduled' && !!s.makeupDate,
          makeupDate: s.makeupDate || undefined,
          makeupTime: s.makeupStartTime && s.makeupEndTime ? `${s.makeupStartTime} - ${s.makeupEndTime}` : undefined,
        },
      })
    }

    // Scheduled makeup events
    for (const m of (data?.makeups || [])) {
      const d = new Date(m.makeupDate)
      const [sh, sm] = toClock(m.startTime)
      const [eh, em] = toClock(m.endTime)
      const eventStart = new Date(d); eventStart.setHours(sh, sm, 0, 0)
      const eventEnd = new Date(d); eventEnd.setHours(eh, em, 0, 0)
      let backgroundColor = '#E9D5FF', borderColor = '#D8B4FE', textColor = '#6B21A8'
      if (eventEnd < now || m.status === 'completed') {
        backgroundColor = '#D1FAE5'; borderColor = '#A7F3D0'; textColor = '#065F46'
      }
      events.push({
        id: `makeup-${m.id}-${m.studentId}`,
        classId: m.classId,
        title: `[Makeup] ${m.studentNickname || m.studentName} - ${m.className}`,
        start: eventStart,
        end: eventEnd,
        backgroundColor, borderColor, textColor,
        extendedProps: {
          type: 'makeup',
          studentId: m.studentId,
          studentName: m.studentName,
          studentNickname: m.studentNickname,
          branchName: m.branchName,
          roomName: m.roomName,
          teacherName: m.teacherName,
          subjectName: m.subjectName,
          className: m.className,
          subjectColor: m.subjectColor,
          originalClassName: m.className,
          sessionNumber: m.sessionNumber,
          makeupStatus: m.status,
        },
      })
    }

    events.sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime())

    const students: StudentScheduleData[] = (data?.students || []).map((s: any) => ({
      student: { id: s.id, name: s.name, nickname: s.nickname || undefined, profileImage: s.profileImage || undefined },
      enrollments: [], classes: [], makeupClasses: [],
    }))

    const stats: Record<string, StudentStats> = {}
    for (const st of (data?.stats || [])) {
      stats[st.studentId] = {
        totalClasses: st.totalClasses || 0,
        completedClasses: st.completedClasses || 0,
        upcomingClasses: st.upcomingClasses || 0,
        makeupClasses: st.makeupClasses || 0,
      }
    }

    return { events, students, stats }
  } catch (error) {
    console.error('[getParentScheduleEvents] Error:', error)
    return { events: [], students: [], stats: {} }
  }
}


export async function getStudentOverallStats(
  parentId: string,
  studentId: string
): Promise<StudentStats> {
  const supabase = createServiceClient() as any

  try {
    const stats = {
      totalClasses: 0,
      completedClasses: 0,
      upcomingClasses: 0,
      makeupClasses: 0,
    }

    const now = new Date()

    // Get active enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id, classes!enrollments_class_id_fkey(end_time, status)')
      .eq('student_id', studentId)
      .eq('status', 'active')

    if (!enrollments) return stats

    // Process each enrollment
    for (const enrollment of enrollments) {
      const classData = enrollment.classes as any
      if (!classData || classData.status === 'draft' || classData.status === 'cancelled') {
        continue
      }

      // Get all schedules for this class
      const { data: schedules } = await supabase
        .from('class_schedules')
        .select('session_date, status')
        .eq('class_id', enrollment.class_id)
        .neq('status', 'cancelled')

      if (!schedules) continue

      for (const schedule of schedules) {
        stats.totalClasses++

        const endTime = classData.end_time as string
        const [endHour, endMinute] = endTime.split(':').map(Number)
        const sessionEndTime = new Date(schedule.session_date)
        sessionEndTime.setHours(endHour, endMinute, 0, 0)

        if (sessionEndTime < now || schedule.status === 'completed') {
          stats.completedClasses++
        } else {
          stats.upcomingClasses++
        }
      }
    }

    // Count makeup classes
    const { data: makeupClasses } = await supabase
      .from('makeup_classes')
      .select('id')
      .eq('student_id', studentId)
      .in('status', ['scheduled', 'completed'])

    stats.makeupClasses = makeupClasses?.length || 0

    return stats
  } catch (error) {
    console.error('Error getting student overall stats:', error)
    return {
      totalClasses: 0,
      completedClasses: 0,
      upcomingClasses: 0,
      makeupClasses: 0,
    }
  }
}

// Get schedule statistics for a student (for current view only)
export function getStudentScheduleStats(
  events: ScheduleEvent[],
  studentId: string
): StudentStats {
  const studentEvents = events.filter(e => e.extendedProps.studentId === studentId)
  const now = new Date()

  const stats = {
    totalClasses: 0,
    completedClasses: 0,
    upcomingClasses: 0,
    makeupClasses: 0,
  }

  studentEvents.forEach(event => {
    if (event.extendedProps.type === 'makeup') {
      stats.makeupClasses++
    } else {
      stats.totalClasses++

      if (event.end < now || event.extendedProps.status === 'completed') {
        stats.completedClasses++
      } else {
        stats.upcomingClasses++
      }
    }
  })

  return stats
}

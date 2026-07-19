import { createServiceClient } from '../server'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'

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
    // account รอง → ใช้ line id หลักของครอบครัว (ดู resolveFamilyLineId)
    const { resolveFamilyLineId } = await import('./liff-data')
    const familyLineId = await resolveFamilyLineId(supabase, lineUserId)
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    const { data, error } = await supabase.rpc('get_liff_schedule', {
      p_line_user_id: familyLineId,
      p_start: startStr,
      p_end: endStr,
    })
    if (error) {
      console.error('[getParentScheduleEvents] RPC error:', error)
      return { events: [], students: [], stats: {} }
    }

    const events: ScheduleEvent[] = []

    // Times in the DB are Thai wall-clock. NEVER materialize them into Date
    // objects here — setHours() uses the SERVER's timezone (UTC on Vercel), so
    // a 09:00 class serialized as 09:00Z rendered as 16:00 on Thai phones.
    // Emit timezone-less ISO strings instead; the client's `new Date()` parses
    // them as its own local time (parents are in Thailand).
    const naive = (dateStr: string, time: string) => {
      const d = String(dateStr).slice(0, 10)
      const [h = '00', m = '00'] = String(time || '00:00').split(':')
      return `${d}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`
    }
    // "now" as a Bangkok wall-clock string, comparable with naive() output.
    const nowStr = new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })
      .replace(' ', 'T')

    // Regular class sessions
    for (const s of (data?.sessions || [])) {
      const eventStart = naive(s.sessionDate, s.startTime)
      const eventEnd = naive(s.sessionDate, s.endTime)
      const passed = eventEnd < nowStr

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
        // Naive local strings; the JSON layer would stringify Dates anyway and
        // the client revives with new Date() → its local timezone.
        start: eventStart as unknown as Date,
        end: eventEnd as unknown as Date,
        backgroundColor, borderColor, textColor,
        extendedProps: {
          type: 'class',
          studentId: s.studentId,
          studentName: s.studentName,
          studentNickname: s.studentNickname,
          branchName: s.branchName,
          roomName: s.roomName,
          teacherName: s.teacherName,
          teacherImage: s.teacherImage || null,
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
      const eventStart = naive(m.makeupDate, m.startTime)
      const eventEnd = naive(m.makeupDate, m.endTime)
      let backgroundColor = '#E9D5FF', borderColor = '#D8B4FE', textColor = '#6B21A8'
      if (eventEnd < nowStr || m.status === 'completed') {
        backgroundColor = '#D1FAE5'; borderColor = '#A7F3D0'; textColor = '#065F46'
      }
      events.push({
        id: `makeup-${m.id}-${m.studentId}`,
        classId: m.classId,
        title: `[Makeup] ${m.studentNickname || m.studentName} - ${m.className}`,
        start: eventStart as unknown as Date,
        end: eventEnd as unknown as Date,
        backgroundColor, borderColor, textColor,
        extendedProps: {
          type: 'makeup',
          studentId: m.studentId,
          studentName: m.studentName,
          studentNickname: m.studentNickname,
          branchName: m.branchName,
          roomName: m.roomName,
          teacherName: m.teacherName,
          teacherImage: m.teacherImage || null,
          subjectName: m.subjectName,
          className: m.className,
          subjectColor: m.subjectColor,
          originalClassName: m.className,
          sessionNumber: m.sessionNumber,
          makeupStatus: m.status,
        },
      })
    }

    // start values are naive ISO strings — lexicographic order = chronological.
    events.sort((a, b) => String(a.start).localeCompare(String(b.start)))

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

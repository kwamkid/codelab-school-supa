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
}> {
  const supabase = createServiceClient()

  try {
    // Get parent by LINE user ID
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single()

    if (parentError || !parent) {
      console.log('[getParentScheduleEvents] No parent found for lineUserId:', lineUserId)
      return { events: [], students: [] }
    }

    console.log('[getParentScheduleEvents] Found parent:', parent.id)

    // Get active students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', parent.id)
      .eq('is_active', true)

    if (studentsError || !students || students.length === 0) {
      return { events: [], students: [] }
    }

    console.log('[getParentScheduleEvents] Found active students:', students.length)

    // Get all reference data
    const [
      { data: subjects },
      { data: teachers },
      { data: branches },
      { data: rooms },
    ] = await Promise.all([
      supabase.from('subjects').select('*'),
      supabase.from('teachers').select('*'),
      supabase.from('branches').select('*'),
      supabase.from('rooms').select('*'),
    ])

    // Create lookup maps
    const subjectMap = new Map((subjects || []).map(s => [s.id, s]))
    const teacherMap = new Map((teachers || []).map(t => [t.id, t]))
    const branchMap = new Map((branches || []).map(b => [b.id, b]))
    const roomMap = new Map((rooms || []).map(r => [r.id, r]))

    const events: ScheduleEvent[] = []
    const studentsData: StudentScheduleData[] = []
    const now = new Date()

    // Process each student
    for (const student of students) {
      console.log(`[getParentScheduleEvents] Processing student: ${student.name}`)

      const studentData: StudentScheduleData = {
        student: {
          id: student.id,
          name: student.name,
          nickname: student.nickname || undefined,
          profileImage: student.profile_image || undefined,
        },
        enrollments: [],
        classes: [],
        makeupClasses: [],
      }

      // Get active enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, classes(*)')
        .eq('student_id', student.id)
        .eq('status', 'active')

      if (!enrollments) continue

      studentData.enrollments = enrollments
      console.log(`[getParentScheduleEvents] Student ${student.name} has ${enrollments.length} active enrollments`)

      // Get makeup classes for this student
      const { data: makeupClasses } = await supabase
        .from('makeup_classes')
        .select('*')
        .eq('student_id', student.id)
        .neq('status', 'cancelled')

      studentData.makeupClasses = makeupClasses || []

      // Create map of makeup requests
      const makeupRequestMap = new Map<string, unknown>()
      ;(makeupClasses || []).forEach((makeup: Record<string, unknown>) => {
        const key = `${makeup.original_class_id}-${makeup.original_schedule_id}`
        makeupRequestMap.set(key, makeup)
      })

      // Process each enrollment
      for (const enrollment of enrollments) {
        const classData = enrollment.classes as Record<string, unknown>
        if (!classData) continue

        // Skip draft or cancelled classes
        if (classData.status === 'draft' || classData.status === 'cancelled') {
          continue
        }

        const subject = subjectMap.get(classData.subject_id as string)
        const teacher = teacherMap.get(classData.teacher_id as string)
        const branch = branchMap.get(classData.branch_id as string)
        const room = roomMap.get(classData.room_id as string)

        if (!subject || !teacher || !branch) continue

        studentData.classes.push(classData)

        // Get schedules within date range
        const { data: schedules } = await supabase
          .from('class_schedules')
          .select('*')
          .eq('class_id', classData.id)
          .gte('session_date', start.toISOString().split('T')[0])
          .lte('session_date', end.toISOString().split('T')[0])
          .order('session_date', { ascending: true })

        if (!schedules) continue

        for (const schedule of schedules) {
          // Skip cancelled schedules
          if (schedule.status === 'cancelled') continue

          const sessionDate = new Date(schedule.session_date)

          // Check if there's a makeup request for this schedule
          const makeupKey = `${classData.id}-${schedule.id}`
          const hasMakeupRequest = makeupRequestMap.has(makeupKey)
          const makeupData = makeupRequestMap.get(makeupKey) as Record<string, unknown> | undefined

          // Parse times
          const startTime = classData.start_time as string
          const endTime = classData.end_time as string
          const [startHour, startMinute] = startTime.split(':').map(Number)
          const [endHour, endMinute] = endTime.split(':').map(Number)

          const eventStart = new Date(sessionDate)
          eventStart.setHours(startHour, startMinute, 0, 0)

          const eventEnd = new Date(sessionDate)
          eventEnd.setHours(endHour, endMinute, 0, 0)

          // Determine status and color
          let backgroundColor = '#E5E7EB' // Gray
          let borderColor = '#D1D5DB'
          let textColor = '#374151'
          let effectiveStatus = schedule.status

          const sessionHasPassed = eventEnd < now

          // Check attendance
          const { data: attendanceRecords } = await supabase
            .from('attendance')
            .select('*')
            .eq('schedule_id', schedule.id)
            .eq('student_id', student.id)
            .single()

          const hasAttendance = attendanceRecords

          if (hasMakeupRequest) {
            backgroundColor = '#FEE2E2' // Red-100
            borderColor = '#FCA5A5'
            textColor = '#991B1B'
            effectiveStatus = sessionHasPassed ? 'absent' : 'leave-requested'
          } else if (hasAttendance) {
            if (hasAttendance.status === 'present') {
              backgroundColor = '#D1FAE5' // Green
              borderColor = '#A7F3D0'
              textColor = '#065F46'
              effectiveStatus = 'completed'
            } else if (hasAttendance.status === 'absent') {
              backgroundColor = '#FEE2E2' // Red
              borderColor = '#FCA5A5'
              textColor = '#991B1B'
              effectiveStatus = 'absent'
            }
          } else if (sessionHasPassed) {
            backgroundColor = '#D1FAE5' // Green
            borderColor = '#A7F3D0'
            textColor = '#065F46'
            effectiveStatus = 'completed'
          }

          events.push({
            id: `${classData.id}-${schedule.id}-${student.id}`,
            classId: classData.id as string,
            title: `${student.nickname || student.name} - ${classData.name}`,
            start: eventStart,
            end: eventEnd,
            backgroundColor,
            borderColor,
            textColor,
            extendedProps: {
              type: 'class',
              studentId: student.id,
              studentName: student.name,
              studentNickname: student.nickname,
              branchName: branch.name,
              roomName: room?.name || classData.room_id,
              teacherName: teacher.nickname || teacher.name,
              subjectName: subject.name,
              className: classData.name as string,
              subjectColor: subject.color,
              sessionNumber: schedule.session_number,
              status: effectiveStatus,
              hasMakeupRequest,
              makeupScheduled: makeupData?.status === 'scheduled' && makeupData?.makeup_date,
              makeupDate: makeupData?.makeup_date as string | undefined,
              makeupTime: makeupData?.makeup_start_time && makeupData?.makeup_end_time
                ? `${makeupData.makeup_start_time} - ${makeupData.makeup_end_time}`
                : undefined,
            },
          })
        }
      }

      // Process scheduled makeup classes
      for (const makeup of studentData.makeupClasses as Record<string, unknown>[]) {
        if (makeup.status === 'cancelled' || !makeup.makeup_date) continue

        const makeupDate = new Date(makeup.makeup_date as string)
        if (makeupDate < start || makeupDate > end) continue

        // Get original class info
        const { data: originalClass } = await supabase
          .from('classes')
          .select('*')
          .eq('id', makeup.original_class_id)
          .single()

        if (!originalClass) continue

        const teacher = teacherMap.get(makeup.makeup_teacher_id as string)
        const branch = branchMap.get(makeup.makeup_branch_id as string)
        const room = roomMap.get(makeup.makeup_room_id as string)
        const subject = subjectMap.get(originalClass.subject_id)

        if (!teacher || !branch) continue

        const startTime = makeup.makeup_start_time as string
        const endTime = makeup.makeup_end_time as string
        const [startHour, startMinute] = startTime.split(':').map(Number)
        const [endHour, endMinute] = endTime.split(':').map(Number)

        const eventStart = new Date(makeupDate)
        eventStart.setHours(startHour, startMinute, 0, 0)

        const eventEnd = new Date(makeupDate)
        eventEnd.setHours(endHour, endMinute, 0, 0)

        let backgroundColor = '#E9D5FF' // Purple
        let borderColor = '#D8B4FE'
        let textColor = '#6B21A8'

        if (eventEnd < now || makeup.status === 'completed') {
          backgroundColor = '#D1FAE5' // Green
          borderColor = '#A7F3D0'
          textColor = '#065F46'
        }

        events.push({
          id: `makeup-${makeup.id}-${student.id}`,
          classId: makeup.original_class_id as string,
          title: `[Makeup] ${student.nickname || student.name} - ${originalClass.name}`,
          start: eventStart,
          end: eventEnd,
          backgroundColor,
          borderColor,
          textColor,
          extendedProps: {
            type: 'makeup',
            studentId: student.id,
            studentName: student.name,
            studentNickname: student.nickname,
            branchName: branch.name,
            roomName: room?.name || makeup.makeup_room_id,
            teacherName: teacher.nickname || teacher.name,
            subjectName: subject?.name || '',
            className: originalClass.name,
            subjectColor: subject?.color,
            originalClassName: originalClass.name,
            sessionNumber: makeup.original_session_number,
            makeupStatus: makeup.status,
          },
        })
      }

      studentsData.push(studentData)
    }

    // Sort events by date
    events.sort((a, b) => {
      const dateA = a.start as Date
      const dateB = b.start as Date
      return dateA.getTime() - dateB.getTime()
    })

    console.log(`[getParentScheduleEvents] Total events: ${events.length}`)
    return { events, students: studentsData }
  } catch (error) {
    console.error('[getParentScheduleEvents] Error:', error)
    return { events: [], students: [] }
  }
}

// Get overall statistics for a student
export async function getStudentOverallStats(
  parentId: string,
  studentId: string
): Promise<StudentStats> {
  const supabase = createServiceClient()

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
      .select('class_id, classes(end_time, status)')
      .eq('student_id', studentId)
      .eq('status', 'active')

    if (!enrollments) return stats

    // Process each enrollment
    for (const enrollment of enrollments) {
      const classData = enrollment.classes as Record<string, unknown>
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

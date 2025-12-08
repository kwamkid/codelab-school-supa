// lib/supabase/services/dashboard-optimized.ts

import { createServiceClient } from '../server'
import { EventInput } from '@fullcalendar/core'

// Calendar Event interface
export interface CalendarEvent extends EventInput {
  classId: string
  extendedProps: {
    type: 'class' | 'makeup' | 'trial' | 'holiday'
    className?: string
    classCode?: string
    branchId: string
    branchName: string
    roomName: string
    teacherName: string
    subjectColor?: string
    enrolled?: number
    maxStudents?: number
    sessionNumber?: number
    status?: string
    isFullyAttended?: boolean
    startTime?: string
    endTime?: string
    attendance?: AttendanceRecord[]
    // For makeup
    studentName?: string
    studentNickname?: string
    originalClassName?: string
    makeupStatus?: 'pending' | 'scheduled' | 'completed' | 'cancelled'
    makeupCount?: number
    makeupDetails?: MakeupDetail[]
    // For trial
    trialStudentName?: string
    trialSubjectName?: string
    trialCount?: number
    trialDetails?: TrialDetail[]
    // For holiday
    holidayType?: 'national' | 'branch'
  }
}

// Supporting types
interface AttendanceRecord {
  studentId: string
  studentName?: string
  status: 'present' | 'absent' | 'late' | 'sick' | 'leave'
  note?: string
  checkedAt?: Date
  checkedBy?: string
  feedback?: string
}

interface MakeupDetail {
  id: string
  studentName: string
  studentNickname: string
  originalClassName: string
  status: string
  attendance?: {
    status: string
    checkedBy: string
    checkedAt: Date
    note?: string
  }
}

interface TrialDetail {
  id: string
  studentName: string
  subjectId: string
  subjectName: string
  status: string
  attended?: boolean
  interestedLevel?: string
  feedback?: string
}

// Cache for static data
let staticDataCache: {
  subjects: Map<string, any>
  teachers: Map<string, any>
  branches: Map<string, any>
  rooms: Map<string, any>
  lastFetch: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function getStaticData() {
  const supabase = createServiceClient()
  const now = Date.now()

  // Return cached data if still valid
  if (staticDataCache && now - staticDataCache.lastFetch < CACHE_DURATION) {
    return staticDataCache
  }

  // Fetch fresh data
  const [subjectsResult, teachersResult, branchesResult, roomsResult] = await Promise.all([
    supabase.from('subjects').select('*'),
    supabase.from('teachers').select('*'),
    supabase.from('branches').select('*'),
    supabase.from('rooms').select('*')
  ])

  const subjects = new Map(
    (subjectsResult.data || []).map(s => [s.id, s])
  )

  const teachers = new Map(
    (teachersResult.data || []).map(t => [t.id, t])
  )

  const branches = new Map(
    (branchesResult.data || []).map(b => [b.id, b])
  )

  const rooms = new Map(
    (roomsResult.data || []).map(r => [`${r.branch_id}-${r.id}`, r])
  )

  staticDataCache = {
    subjects,
    teachers,
    branches,
    rooms,
    lastFetch: now
  }

  return staticDataCache
}

export async function getOptimizedCalendarEvents(
  start: Date,
  end: Date,
  branchId?: string
): Promise<CalendarEvent[]> {
  const supabase = createServiceClient()

  try {
    // Get static data (cached)
    const { subjects, teachers, branches, rooms } = await getStaticData()

    const events: CalendarEvent[] = []
    const now = new Date()
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    // 1. Get holidays in range
    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)

    // Process holidays
    ;(holidays || []).forEach(holiday => {
      // Filter by branch if needed
      if (branchId && holiday.type === 'branch' && !holiday.branches?.includes(branchId)) {
        return
      }

      const holidayDate = new Date(holiday.date)
      holidayDate.setHours(0, 0, 0, 0)

      const holidayEndDate = new Date(holidayDate)
      holidayEndDate.setHours(23, 59, 59, 999)

      events.push({
        id: `holiday-${holiday.id}`,
        classId: '',
        title: holiday.name,
        start: holidayDate,
        end: holidayEndDate,
        allDay: true,
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        textColor: '#FFFFFF',
        display: 'background',
        extendedProps: {
          type: 'holiday',
          branchId: branchId || 'all',
          branchName: holiday.type === 'national' ? 'ทุกสาขา' : 'เฉพาะสาขา',
          roomName: '',
          teacherName: '',
          holidayType: holiday.type
        }
      })
    })

    // 2. Get class schedules in date range
    let classQuery = supabase
      .from('class_schedules')
      .select(
        `
        id,
        session_date,
        session_number,
        status,
        classes!inner (
          id, name, code, start_time, end_time,
          subject_id, teacher_id, branch_id, room_id,
          enrolled_count, max_students, status
        )
      `
      )
      .gte('session_date', startStr)
      .lte('session_date', endStr)
      .in('status', ['scheduled', 'completed', 'rescheduled'])

    const { data: schedules } = await classQuery

    // Process schedules into events
    ;(schedules || []).forEach(schedule => {
      const classData = schedule.classes as any
      if (!classData) return

      // Skip draft or cancelled classes
      if (classData.status === 'draft' || classData.status === 'cancelled') return

      // Filter by branch if needed
      if (branchId && classData.branch_id !== branchId) return

      const subject = subjects.get(classData.subject_id)
      const teacher = teachers.get(classData.teacher_id)
      const branch = branches.get(classData.branch_id)
      const room = rooms.get(`${classData.branch_id}-${classData.room_id}`)

      if (!subject || !teacher || !branch) return

      const sessionDate = new Date(schedule.session_date)
      const [startHour, startMinute] = classData.start_time.split(':').map(Number)
      const [endHour, endMinute] = classData.end_time.split(':').map(Number)

      const eventStart = new Date(sessionDate)
      eventStart.setHours(startHour, startMinute, 0, 0)

      const eventEnd = new Date(sessionDate)
      eventEnd.setHours(endHour, endMinute, 0, 0)

      // Determine color and status
      let backgroundColor = '#E5E7EB'
      let borderColor = '#D1D5DB'
      let effectiveStatus = schedule.status
      let textColor = '#374151'

      if (eventEnd < now) {
        backgroundColor = '#D1FAE5'
        borderColor = '#A7F3D0'
        effectiveStatus = 'completed'
        textColor = '#065F46'
      }

      events.push({
        id: `${classData.id}-${schedule.id}`,
        classId: classData.id,
        title: subject.name,
        start: eventStart,
        end: eventEnd,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          type: 'class',
          className: classData.name,
          classCode: classData.code,
          branchId: classData.branch_id,
          branchName: branch.name,
          roomName: room?.name || classData.room_id,
          teacherName: teacher.nickname || teacher.name,
          subjectColor: subject.color,
          enrolled: classData.enrolled_count,
          maxStudents: classData.max_students,
          sessionNumber: schedule.session_number,
          status: effectiveStatus,
          isFullyAttended: false,
          startTime: classData.start_time,
          endTime: classData.end_time
        }
      })
    })

    // 3. Get makeup classes in range
    let makeupQuery = supabase
      .from('makeup_classes')
      .select(
        `
        id, status, original_class_id, original_session_number,
        makeup_date, makeup_start_time, makeup_end_time,
        makeup_teacher_id, makeup_branch_id, makeup_room_id,
        students (id, name, nickname),
        classes (id, name)
      `
      )
      .in('status', ['scheduled', 'completed'])
      .gte('makeup_date', startStr)
      .lte('makeup_date', endStr)

    if (branchId) {
      makeupQuery = makeupQuery.eq('makeup_branch_id', branchId)
    }

    const { data: makeups } = await makeupQuery

    // Group makeup classes by time slot
    const makeupGroups = new Map<string, any[]>()

    ;(makeups || []).forEach(makeup => {
      if (!makeup.makeup_date) return

      const dateKey = makeup.makeup_date
      const key = `${makeup.makeup_branch_id}-${makeup.makeup_room_id}-${dateKey}-${makeup.makeup_start_time}-${makeup.makeup_end_time}-${makeup.makeup_teacher_id}`

      if (!makeupGroups.has(key)) {
        makeupGroups.set(key, [])
      }
      makeupGroups.get(key)!.push(makeup)
    })

    // Process each group of makeup classes
    for (const [key, groupedMakeups] of makeupGroups) {
      if (groupedMakeups.length === 0) continue

      const firstMakeup = groupedMakeups[0]
      const teacher = teachers.get(firstMakeup.makeup_teacher_id)
      const branch = branches.get(firstMakeup.makeup_branch_id)
      const room = rooms.get(`${firstMakeup.makeup_branch_id}-${firstMakeup.makeup_room_id}`)

      if (!teacher || !branch) continue

      const makeupDate = new Date(firstMakeup.makeup_date)
      const [startHour, startMinute] = firstMakeup.makeup_start_time.split(':').map(Number)
      const [endHour, endMinute] = firstMakeup.makeup_end_time.split(':').map(Number)

      const eventStart = new Date(makeupDate)
      eventStart.setHours(startHour, startMinute, 0, 0)

      const eventEnd = new Date(makeupDate)
      eventEnd.setHours(endHour, endMinute, 0, 0)

      let backgroundColor = '#E9D5FF'
      let borderColor = '#D8B4FE'
      let textColor = '#6B21A8'

      const allCompleted = groupedMakeups.every(m => eventEnd < now || m.status === 'completed')

      if (allCompleted) {
        backgroundColor = '#D1FAE5'
        borderColor = '#A7F3D0'
        textColor = '#065F46'
      }

      // Create makeup details
      const makeupDetails: MakeupDetail[] = groupedMakeups.map(m => {
        const student = m.students as any
        const cls = m.classes as any
        return {
          id: m.id,
          studentName: student?.name || 'ไม่ระบุชื่อ',
          studentNickname: student?.nickname || 'นักเรียน',
          originalClassName: cls?.name || '',
          status: m.status
        }
      })

      const title =
        groupedMakeups.length === 1
          ? `[Makeup] ${makeupDetails[0].studentNickname} - ${makeupDetails[0].originalClassName}`
          : `[Makeup ${groupedMakeups.length} คน] ${makeupDetails.map(d => d.studentNickname).join(', ')}`

      events.push({
        id: `makeup-group-${key}`,
        classId: firstMakeup.original_class_id,
        title,
        start: eventStart,
        end: eventEnd,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          type: 'makeup',
          branchId: firstMakeup.makeup_branch_id,
          branchName: branch.name,
          roomName: room?.name || firstMakeup.makeup_room_id,
          teacherName: teacher.nickname || teacher.name,
          subjectColor: '#9333EA',
          studentName: makeupDetails.map(d => d.studentName).join(', '),
          studentNickname: makeupDetails.map(d => d.studentNickname).join(', '),
          originalClassName: [...new Set(makeupDetails.map(d => d.originalClassName))].join(', '),
          makeupStatus: groupedMakeups.every(m => m.status === 'completed') ? 'completed' : 'scheduled',
          makeupCount: groupedMakeups.length,
          makeupDetails
        }
      })
    }

    // 4. Get trial sessions in range
    let trialQuery = supabase
      .from('trial_sessions')
      .select('*')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .in('status', ['scheduled', 'attended', 'absent'])

    if (branchId) {
      trialQuery = trialQuery.eq('branch_id', branchId)
    }

    const { data: trials } = await trialQuery

    // Group trials by time slot
    const trialGroups = new Map<string, any[]>()

    ;(trials || []).forEach(trial => {
      const dateKey = trial.scheduled_date
      const key = `${trial.branch_id}-${trial.room_id}-${dateKey}-${trial.start_time}-${trial.end_time}-${trial.teacher_id}`

      if (!trialGroups.has(key)) {
        trialGroups.set(key, [])
      }
      trialGroups.get(key)!.push(trial)
    })

    // Process each group of trials
    for (const [key, groupedTrials] of trialGroups) {
      if (groupedTrials.length === 0) continue

      const firstTrial = groupedTrials[0]
      const teacher = teachers.get(firstTrial.teacher_id)
      const branch = branches.get(firstTrial.branch_id)
      const room = rooms.get(`${firstTrial.branch_id}-${firstTrial.room_id}`)

      if (!teacher || !branch) continue

      const trialDate = new Date(firstTrial.scheduled_date)
      const [startHour, startMinute] = firstTrial.start_time.split(':').map(Number)
      const [endHour, endMinute] = firstTrial.end_time.split(':').map(Number)

      const eventStart = new Date(trialDate)
      eventStart.setHours(startHour, startMinute, 0, 0)

      const eventEnd = new Date(trialDate)
      eventEnd.setHours(endHour, endMinute, 0, 0)

      let backgroundColor = '#FED7AA'
      let borderColor = '#FDBA74'
      let textColor = '#9A3412'

      const allCompleted = groupedTrials.every(
        t => eventEnd < now || t.attended || t.status === 'attended' || t.status === 'absent'
      )

      if (allCompleted) {
        backgroundColor = '#D1FAE5'
        borderColor = '#A7F3D0'
        textColor = '#065F46'
      }

      const trialDetails: TrialDetail[] = groupedTrials.map(trial => {
        const subject = subjects.get(trial.subject_id)
        return {
          id: trial.id,
          studentName: trial.student_name,
          subjectId: trial.subject_id,
          subjectName: subject?.name || 'ไม่ระบุวิชา',
          status: trial.status,
          attended: trial.attended,
          interestedLevel: trial.interested_level,
          feedback: trial.feedback
        }
      })

      const studentInfo = groupedTrials.map(trial => {
        const subject = subjects.get(trial.subject_id)
        return `${trial.student_name} (${subject?.name || 'ไม่ระบุวิชา'})`
      })

      const title =
        groupedTrials.length === 1
          ? `ทดลอง: ${studentInfo[0]}`
          : `ทดลอง ${groupedTrials.length} คน: ${groupedTrials.map(t => t.student_name).join(', ')}`

      events.push({
        id: `trial-group-${key}`,
        classId: '',
        title,
        start: eventStart,
        end: eventEnd,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          type: 'trial',
          branchId: firstTrial.branch_id,
          branchName: branch.name,
          roomName: room?.name || firstTrial.room_name || firstTrial.room_id,
          teacherName: teacher.nickname || teacher.name,
          subjectColor: '#F97316',
          trialStudentName: studentInfo.join(', '),
          trialSubjectName: [...new Set(trialDetails.map(t => t.subjectName))].join(', '),
          trialCount: groupedTrials.length,
          trialDetails
        }
      })
    }

    // Sort events by start time
    return events.sort((a, b) => {
      const dateA = a.start as Date
      const dateB = b.start as Date
      return dateA.getTime() - dateB.getTime()
    })
  } catch (error) {
    console.error('Error getting optimized calendar events:', error)
    return []
  }
}

// Dashboard statistics interface
export interface DashboardStats {
  totalStudents: number
  totalClasses: number
  activeClasses: number
  todayClasses: number
  upcomingMakeups: number
  pendingMakeups: number
  upcomingTrials: number
}

export async function getOptimizedDashboardStats(branchId?: string): Promise<DashboardStats> {
  const supabase = createServiceClient()

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayStr = today.toISOString().split('T')[0]

    // Get only active classes
    let classQuery = supabase
      .from('classes')
      .select('id, enrolled_count')
      .in('status', ['published', 'started'])

    if (branchId) {
      classQuery = classQuery.eq('branch_id', branchId)
    }

    const { data: classes } = await classQuery

    // Calculate student count
    const totalStudents = (classes || []).reduce((sum, c) => sum + (c.enrolled_count || 0), 0)

    // Get today's schedules count
    let todayQuery = supabase
      .from('class_schedules')
      .select('id, classes!inner(branch_id, status)')
      .eq('session_date', todayStr)
      .eq('status', 'scheduled')

    const { data: todaySchedules } = await todayQuery

    const todayClassCount = branchId
      ? (todaySchedules || []).filter(s => (s.classes as any).branch_id === branchId).length
      : (todaySchedules || []).length

    // Get makeup stats
    let makeupQuery = supabase
      .from('makeup_classes')
      .select('id, status, makeup_date, makeup_branch_id')
      .in('status', ['pending', 'scheduled'])

    const { data: makeups } = await makeupQuery

    let upcomingMakeups = 0
    let pendingMakeups = 0

    ;(makeups || []).forEach(m => {
      // Filter by branch if needed
      if (branchId && m.makeup_branch_id !== branchId) return

      if (m.status === 'pending') {
        pendingMakeups++
      } else if (m.status === 'scheduled' && m.makeup_date) {
        const makeupDate = new Date(m.makeup_date)
        if (makeupDate >= today) {
          upcomingMakeups++
        }
      }
    })

    // Get trial stats
    let trialQuery = supabase
      .from('trial_sessions')
      .select('id')
      .eq('status', 'scheduled')
      .gte('scheduled_date', todayStr)

    if (branchId) {
      trialQuery = trialQuery.eq('branch_id', branchId)
    }

    const { data: trials } = await trialQuery

    return {
      totalStudents,
      totalClasses: classes?.length || 0,
      activeClasses: classes?.length || 0,
      todayClasses: todayClassCount,
      upcomingMakeups,
      pendingMakeups,
      upcomingTrials: trials?.length || 0
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return {
      totalStudents: 0,
      totalClasses: 0,
      activeClasses: 0,
      todayClasses: 0,
      upcomingMakeups: 0,
      pendingMakeups: 0,
      upcomingTrials: 0
    }
  }
}

// Clear cache when needed
export function clearDashboardCache() {
  staticDataCache = null
}

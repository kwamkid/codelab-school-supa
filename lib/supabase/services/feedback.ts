// lib/supabase/services/feedback.ts

import { createServiceClient } from '../server'

export interface StudentFeedbackHistory {
  id: string
  studentId: string
  parentId: string
  classId: string
  className: string
  subjectId: string
  subjectName: string
  scheduleId: string
  sessionNumber: number
  sessionDate: Date
  feedback: string
  teacherId: string
  teacherName: string
  createdAt: Date
}

// Get feedback history for a student
export async function getStudentFeedbackHistory(
  studentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<StudentFeedbackHistory[]> {
  const supabase = createServiceClient()

  try {
    // Get all active enrollments for this student
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        class_id,
        parent_id,
        classes!inner (
          id,
          name,
          subject_id,
          teacher_id,
          subjects (id, name),
          teachers (id, name, nickname)
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'active')

    if (enrollmentError || !enrollments) {
      console.error('Error getting enrollments:', enrollmentError)
      return []
    }

    const feedbackHistory: StudentFeedbackHistory[] = []

    // For each enrollment, get class schedules with attendance and feedback
    for (const enrollment of enrollments) {
      const classData = enrollment.classes as any
      if (!classData) continue

      const subject = classData.subjects
      const teacher = classData.teachers

      // Build query for attendance with feedback
      let query = supabase
        .from('attendance')
        .select(`
          id,
          schedule_id,
          feedback,
          checked_at,
          class_schedules!inner (
            id,
            session_date,
            session_number,
            class_id
          )
        `)
        .eq('student_id', studentId)
        .eq('class_schedules.class_id', enrollment.class_id)
        .not('feedback', 'is', null)
        .neq('feedback', '')
        .order('checked_at', { ascending: false })

      const { data: attendanceRecords, error: attendanceError } = await query

      if (attendanceError) {
        console.error('Error getting attendance:', attendanceError)
        continue
      }

      if (!attendanceRecords) continue

      for (const attendance of attendanceRecords) {
        const schedule = attendance.class_schedules as any
        if (!schedule) continue

        const sessionDate = new Date(schedule.session_date)

        // Filter by date if provided
        if (startDate && sessionDate < startDate) continue
        if (endDate && sessionDate > endDate) continue

        feedbackHistory.push({
          id: `${enrollment.class_id}-${schedule.id}`,
          studentId,
          parentId: enrollment.parent_id,
          classId: enrollment.class_id,
          className: classData.name,
          subjectId: classData.subject_id,
          subjectName: subject?.name || '',
          scheduleId: schedule.id,
          sessionNumber: schedule.session_number,
          sessionDate,
          feedback: attendance.feedback,
          teacherId: classData.teacher_id,
          teacherName: teacher?.nickname || teacher?.name || '',
          createdAt: attendance.checked_at ? new Date(attendance.checked_at) : sessionDate
        })
      }
    }

    // Sort by date descending
    return feedbackHistory.sort((a, b) =>
      b.sessionDate.getTime() - a.sessionDate.getTime()
    )
  } catch (error) {
    console.error('Error getting student feedback history:', error)
    return []
  }
}

// Get all feedback for a parent's students
export async function getParentFeedbackHistory(
  parentId: string
): Promise<StudentFeedbackHistory[]> {
  const supabase = createServiceClient()

  try {
    // Get all active students for this parent
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('parent_id', parentId)
      .eq('is_active', true)

    if (studentsError || !students) {
      console.error('Error getting students:', studentsError)
      return []
    }

    const allFeedback: StudentFeedbackHistory[] = []

    for (const student of students) {
      const feedbacks = await getStudentFeedbackHistory(student.id)
      allFeedback.push(...feedbacks)
    }

    return allFeedback.sort((a, b) =>
      b.sessionDate.getTime() - a.sessionDate.getTime()
    )
  } catch (error) {
    console.error('Error getting parent feedback history:', error)
    return []
  }
}

// Get feedback by LINE user ID (for LIFF)
export async function getParentFeedbackByLineUserId(
  lineUserId: string
): Promise<StudentFeedbackHistory[]> {
  const supabase = createServiceClient()

  try {
    // Get parent by LINE user ID
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single()

    if (parentError || !parent) {
      console.log('[getParentFeedbackByLineUserId] Parent not found for lineUserId:', lineUserId)
      return []
    }

    return getParentFeedbackHistory(parent.id)
  } catch (error) {
    console.error('Error getting parent feedback by LINE user ID:', error)
    return []
  }
}

// Get feedback count for notification badge
export async function getUnreadFeedbackCount(
  parentId: string,
  lastReadDate?: Date
): Promise<number> {
  try {
    const feedbacks = await getParentFeedbackHistory(parentId)

    if (!lastReadDate) return feedbacks.length

    return feedbacks.filter(f => f.createdAt > lastReadDate).length
  } catch (error) {
    console.error('Error getting unread feedback count:', error)
    return 0
  }
}

// Get recent feedbacks for a student (limited)
export async function getRecentStudentFeedbacks(
  studentId: string,
  limit: number = 10
): Promise<StudentFeedbackHistory[]> {
  const feedbacks = await getStudentFeedbackHistory(studentId)
  return feedbacks.slice(0, limit)
}

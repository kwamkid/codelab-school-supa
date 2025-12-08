import { createServiceClient } from '../server'
import type {
  Class,
  ClassSchedule,
  ClassFull,
  InsertTables,
  UpdateTables,
  ClassStatus,
  ScheduleStatus
} from '@/types/supabase'

// ============================================
// CLASSES
// ============================================

// Get all classes
export async function getClasses(branchId?: string, teacherId?: string): Promise<Class[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (teacherId) {
    query = query.eq('teacher_id', teacherId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting classes:', error)
    throw error
  }

  return data || []
}

// Get classes with full info (using view)
export async function getClassesFull(branchId?: string): Promise<ClassFull[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('v_classes_full')
    .select('*')
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting classes full:', error)
    throw error
  }

  return data || []
}

// Get single class
export async function getClass(id: string): Promise<Class | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting class:', error)
    throw error
  }

  return data
}

// Get class with full info
export async function getClassFull(id: string): Promise<ClassFull | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_classes_full')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting class full:', error)
    throw error
  }

  return data
}

// Get classes by subject
export async function getClassesBySubject(subjectId: string): Promise<Class[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('subject_id', subjectId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error getting classes by subject:', error)
    return []
  }

  return data || []
}

// Get classes by teacher
export async function getClassesByTeacher(teacherId: string): Promise<Class[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error getting classes by teacher:', error)
    return []
  }

  return data || []
}

// Get classes by branch
export async function getClassesByBranch(branchId: string): Promise<Class[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('branch_id', branchId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error getting classes by branch:', error)
    return []
  }

  return data || []
}

// Get active classes (published or started)
export async function getActiveClasses(branchId?: string): Promise<Class[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('classes')
    .select('*')
    .in('status', ['published', 'started'])
    .order('start_date', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting active classes:', error)
    return []
  }

  return data || []
}

// Create new class with schedules
export async function createClass(
  classData: Omit<InsertTables<'classes'>, 'id' | 'created_at' | 'enrolled_count'>,
  holidayDates: Date[] = []
): Promise<string> {
  const supabase = createServiceClient()

  // Validate status
  const validStatuses: ClassStatus[] = ['draft', 'published', 'started', 'completed', 'cancelled']
  if (!classData.status || !validStatuses.includes(classData.status)) {
    classData.status = 'draft'
  }

  // Create class
  const { data: classResult, error: classError } = await supabase
    .from('classes')
    .insert({
      ...classData,
      enrolled_count: 0
    })
    .select('id')
    .single()

  if (classError) {
    console.error('Error creating class:', classError)
    throw classError
  }

  const classId = classResult.id

  // Generate schedules
  const schedules = generateSchedules(
    new Date(classData.start_date),
    new Date(classData.end_date),
    classData.days_of_week || [],
    classData.total_sessions,
    holidayDates
  )

  // Insert schedules
  if (schedules.length > 0) {
    const scheduleInserts = schedules.map((date, index) => ({
      class_id: classId,
      session_date: date.toISOString().split('T')[0],
      session_number: index + 1,
      status: 'scheduled' as ScheduleStatus
    }))

    const { error: scheduleError } = await supabase
      .from('class_schedules')
      .insert(scheduleInserts)

    if (scheduleError) {
      console.error('Error creating schedules:', scheduleError)
      // Don't throw - class is created, schedules can be added later
    }
  }

  return classId
}

// Update class
export async function updateClass(
  id: string,
  classData: UpdateTables<'classes'>
): Promise<void> {
  const supabase = createServiceClient()

  // Validate status if provided
  if (classData.status) {
    const validStatuses: ClassStatus[] = ['draft', 'published', 'started', 'completed', 'cancelled']
    if (!validStatuses.includes(classData.status)) {
      throw new Error(`Invalid status: ${classData.status}`)
    }
  }

  // Remove id and timestamps
  const { id: _, created_at: __, ...updateData } = classData as Class

  const { error } = await supabase
    .from('classes')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating class:', error)
    throw error
  }
}

// Delete class
export async function deleteClass(id: string): Promise<void> {
  const supabase = createServiceClient()

  // Check if there are enrolled students
  const classDoc = await getClass(id)
  if (classDoc && classDoc.enrolled_count > 0) {
    throw new Error('Cannot delete class with enrolled students')
  }

  // Delete schedules first (cascade should handle this, but being explicit)
  await supabase
    .from('class_schedules')
    .delete()
    .eq('class_id', id)

  // Delete the class
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting class:', error)
    throw error
  }
}

// Update class status
export async function updateClassStatus(id: string, status: ClassStatus): Promise<void> {
  const validStatuses: ClassStatus[] = ['draft', 'published', 'started', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('classes')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('Error updating class status:', error)
    throw error
  }
}

// Check if class code exists
export async function checkClassCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('classes')
    .select('id')
    .eq('code', code)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking class code:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Fix enrolled count
export async function fixEnrolledCount(classId: string, newCount: number): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('classes')
    .update({ enrolled_count: newCount })
    .eq('id', classId)

  if (error) {
    console.error('Error fixing enrolled count:', error)
    throw error
  }
}

// ============================================
// CLASS SCHEDULES
// ============================================

// Get class schedules
export async function getClassSchedules(classId: string): Promise<ClassSchedule[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .order('session_date', { ascending: true })

  if (error) {
    console.error('Error getting class schedules:', error)
    return []
  }

  return data || []
}

// Get single class schedule
export async function getClassSchedule(
  classId: string,
  scheduleId: string
): Promise<ClassSchedule | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('class_id', classId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting class schedule:', error)
    return null
  }

  return data
}

// Update class schedule
export async function updateClassSchedule(
  classId: string,
  scheduleId: string,
  data: UpdateTables<'class_schedules'>
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, class_id: __, ...updateData } = data as ClassSchedule

  const { error } = await supabase
    .from('class_schedules')
    .update(updateData)
    .eq('id', scheduleId)
    .eq('class_id', classId)

  if (error) {
    console.error('Error updating class schedule:', error)
    throw error
  }
}

// Get upcoming sessions
export async function getUpcomingSessions(
  classId: string,
  fromDate?: Date
): Promise<ClassSchedule[]> {
  const supabase = createServiceClient()
  const startDate = fromDate || new Date()

  const { data, error } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .gte('session_date', startDate.toISOString().split('T')[0])
    .neq('status', 'cancelled')
    .order('session_date', { ascending: true })

  if (error) {
    console.error('Error getting upcoming sessions:', error)
    return []
  }

  return data || []
}

// Reschedule a single session
export async function rescheduleSession(
  classId: string,
  scheduleId: string,
  newDate: Date,
  reason?: string,
  rescheduledBy?: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get current schedule
  const schedule = await getClassSchedule(classId, scheduleId)
  if (!schedule) {
    throw new Error('Schedule not found')
  }

  const { error } = await supabase
    .from('class_schedules')
    .update({
      session_date: newDate.toISOString().split('T')[0],
      status: 'rescheduled' as ScheduleStatus,
      original_date: schedule.session_date,
      rescheduled_at: new Date().toISOString(),
      rescheduled_by: rescheduledBy,
      note: reason
    })
    .eq('id', scheduleId)
    .eq('class_id', classId)

  if (error) {
    console.error('Error rescheduling session:', error)
    throw error
  }
}

// ============================================
// ATTENDANCE
// ============================================

// Get attendance for a schedule
export async function getScheduleAttendance(scheduleId: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('schedule_id', scheduleId)

  if (error) {
    console.error('Error getting attendance:', error)
    return []
  }

  return data || []
}

// Save attendance for a schedule
export async function saveAttendance(
  scheduleId: string,
  attendanceRecords: Array<{
    student_id: string
    status: 'present' | 'absent' | 'late' | 'sick' | 'leave'
    note?: string
    feedback?: string
    checked_by?: string
  }>
): Promise<void> {
  const supabase = createServiceClient()

  // Delete existing attendance for this schedule
  await supabase
    .from('attendance')
    .delete()
    .eq('schedule_id', scheduleId)

  // Insert new attendance records
  if (attendanceRecords.length > 0) {
    const inserts = attendanceRecords.map(record => ({
      schedule_id: scheduleId,
      student_id: record.student_id,
      status: record.status,
      note: record.note || null,
      feedback: record.feedback || null,
      checked_at: new Date().toISOString(),
      checked_by: record.checked_by || null
    }))

    const { error } = await supabase
      .from('attendance')
      .insert(inserts)

    if (error) {
      console.error('Error saving attendance:', error)
      throw error
    }
  }

  // Update schedule status to completed if attendance was recorded
  if (attendanceRecords.length > 0) {
    await supabase
      .from('class_schedules')
      .update({ status: 'completed' as ScheduleStatus })
      .eq('id', scheduleId)
  }
}

// ============================================
// STATISTICS
// ============================================

// Get class statistics
export async function getClassStatistics(classId: string): Promise<{
  totalSessions: number
  completedSessions: number
  upcomingSessions: number
  cancelledSessions: number
  attendanceRate: number
}> {
  const supabase = createServiceClient()
  const now = new Date().toISOString().split('T')[0]

  // Get all schedules
  const { data: schedules } = await supabase
    .from('class_schedules')
    .select('id, session_date, status')
    .eq('class_id', classId)

  if (!schedules) {
    return {
      totalSessions: 0,
      completedSessions: 0,
      upcomingSessions: 0,
      cancelledSessions: 0,
      attendanceRate: 0
    }
  }

  const stats = {
    totalSessions: schedules.length,
    completedSessions: schedules.filter(s => s.status === 'completed').length,
    upcomingSessions: schedules.filter(s => s.session_date > now && s.status !== 'cancelled').length,
    cancelledSessions: schedules.filter(s => s.status === 'cancelled').length,
    attendanceRate: 0
  }

  // Calculate attendance rate
  const completedScheduleIds = schedules
    .filter(s => s.status === 'completed')
    .map(s => s.id)

  if (completedScheduleIds.length > 0) {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .in('schedule_id', completedScheduleIds)

    if (attendance && attendance.length > 0) {
      const presentCount = attendance.filter(a =>
        a.status === 'present' || a.status === 'late'
      ).length
      stats.attendanceRate = (presentCount / attendance.length) * 100
    }
  }

  return stats
}

// Get enrolled students for a class
export async function getEnrolledStudents(classId: string): Promise<string[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('class_id', classId)
    .eq('status', 'active')

  if (error) {
    console.error('Error getting enrolled students:', error)
    return []
  }

  return data?.map(e => e.student_id) || []
}

// Get class with schedules
export async function getClassWithSchedules(
  classId: string
): Promise<(Class & { schedules?: ClassSchedule[] }) | null> {
  const classData = await getClass(classId)
  if (!classData) return null

  const schedules = await getClassSchedules(classId)
  return {
    ...classData,
    schedules
  }
}

// ============================================
// ROOM AVAILABILITY
// ============================================

// Check room availability
export async function checkRoomAvailability(
  branchId: string,
  roomId: string,
  daysOfWeek: number[],
  startTime: string,
  endTime: string,
  startDate: Date,
  endDate: Date,
  excludeClassId?: string
): Promise<{ available: boolean; conflicts?: any[] }> {
  const supabase = createServiceClient()
  const conflicts: any[] = []

  // Get classes that might conflict
  let query = supabase
    .from('classes')
    .select('*')
    .eq('branch_id', branchId)
    .eq('room_id', roomId)
    .in('status', ['draft', 'published', 'started'])

  if (excludeClassId) {
    query = query.neq('id', excludeClassId)
  }

  const { data: classes } = await query

  if (classes) {
    for (const cls of classes) {
      // Check if there's any day overlap
      const dayOverlap = cls.days_of_week.some((day: number) => daysOfWeek.includes(day))
      if (!dayOverlap) continue

      // Check date range overlap
      const clsStart = new Date(cls.start_date)
      const clsEnd = new Date(cls.end_date)
      const dateOverlap = (
        (startDate >= clsStart && startDate <= clsEnd) ||
        (endDate >= clsStart && endDate <= clsEnd) ||
        (startDate <= clsStart && endDate >= clsEnd)
      )
      if (!dateOverlap) continue

      // Check time overlap
      const timeOverlap = (
        (startTime >= cls.start_time && startTime < cls.end_time) ||
        (endTime > cls.start_time && endTime <= cls.end_time) ||
        (startTime <= cls.start_time && endTime >= cls.end_time)
      )

      if (timeOverlap) {
        conflicts.push({
          type: 'class',
          classId: cls.id,
          className: cls.name,
          classCode: cls.code,
          startTime: cls.start_time,
          endTime: cls.end_time,
          daysOfWeek: cls.days_of_week
        })
      }
    }
  }

  // TODO: Check makeup classes and trial sessions

  return {
    available: conflicts.length === 0,
    conflicts: conflicts.length > 0 ? conflicts : undefined
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate schedule dates
export function generateSchedules(
  startDate: Date,
  endDate: Date,
  daysOfWeek: number[],
  totalSessions: number,
  holidayDates: Date[]
): Date[] {
  const schedules: Date[] = []
  const currentDate = new Date(startDate)

  // Convert holiday dates to date strings for comparison
  const holidayStrings = holidayDates.map(date =>
    date.toISOString().split('T')[0]
  )

  while (schedules.length < totalSessions && currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay()
    const dateString = currentDate.toISOString().split('T')[0]

    if (daysOfWeek.includes(dayOfWeek) && !holidayStrings.includes(dateString)) {
      schedules.push(new Date(currentDate))
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return schedules
}

// Validate if class can be edited based on status
export function canEditClassDates(classData: Class): {
  canEdit: boolean
  reason?: string
} {
  const now = new Date()

  if (classData.status === 'draft' || classData.status === 'cancelled') {
    return { canEdit: true }
  }

  if (classData.status === 'published') {
    if (classData.enrolled_count === 0) {
      return { canEdit: true }
    } else if (new Date(classData.start_date) > now) {
      return {
        canEdit: true,
        reason: 'มีนักเรียนลงทะเบียนแล้ว แก้ไขได้เฉพาะบางส่วน'
      }
    }
  }

  if (classData.status === 'started') {
    return {
      canEdit: false,
      reason: 'คลาสกำลังดำเนินการอยู่ ไม่สามารถแก้ไขวันที่และเวลาได้'
    }
  }

  if (classData.status === 'completed') {
    return {
      canEdit: false,
      reason: 'คลาสจบแล้ว ไม่สามารถแก้ไขได้'
    }
  }

  return { canEdit: false, reason: 'ไม่สามารถแก้ไขได้' }
}

// Get editable fields based on class status
export function getEditableFields(classData: Class): {
  basicInfo: boolean
  schedule: boolean
  resources: boolean
  pricing: boolean
  capacity: boolean
  status: boolean
} {
  if (classData.status === 'draft' || classData.status === 'cancelled') {
    return {
      basicInfo: true,
      schedule: true,
      resources: true,
      pricing: true,
      capacity: true,
      status: true
    }
  }

  if (classData.status === 'published' && classData.enrolled_count === 0) {
    return {
      basicInfo: true,
      schedule: true,
      resources: true,
      pricing: true,
      capacity: true,
      status: true
    }
  }

  if (classData.status === 'published' && classData.enrolled_count > 0) {
    return {
      basicInfo: true,
      schedule: false,
      resources: false,
      pricing: false,
      capacity: true,
      status: true
    }
  }

  if (classData.status === 'started') {
    return {
      basicInfo: true,
      schedule: false,
      resources: false,
      pricing: false,
      capacity: false,
      status: true
    }
  }

  return {
    basicInfo: false,
    schedule: false,
    resources: false,
    pricing: false,
    capacity: false,
    status: false
  }
}

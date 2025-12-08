import { createServiceClient } from '../server'
import type {
  MakeupClass,
  InsertTables,
  UpdateTables,
  MakeupStatus,
  MakeupType
} from '@/types/supabase'

// ============================================
// GET MAKEUP CLASSES
// ============================================

// Get all makeup classes
export async function getMakeupClasses(branchId?: string | null): Promise<MakeupClass[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('makeup_classes')
    .select('*')
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting makeup classes:', error)
    throw error
  }

  return data || []
}

// Get makeup classes by student
export async function getMakeupClassesByStudent(studentId: string): Promise<MakeupClass[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error getting makeup classes by student:', error)
    throw error
  }

  return data || []
}

// Get makeup classes by class
export async function getMakeupClassesByClass(classId: string): Promise<MakeupClass[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('original_class_id', classId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error getting makeup classes by class:', error)
    throw error
  }

  return data || []
}

// Get makeup classes by status
export async function getMakeupClassesByStatus(
  status: MakeupStatus,
  branchId?: string
): Promise<MakeupClass[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('makeup_classes')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting makeup classes by status:', error)
    return []
  }

  return data || []
}

// Get single makeup class
export async function getMakeupClass(id: string): Promise<MakeupClass | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting makeup class:', error)
    throw error
  }

  return data
}

// Get makeup classes by date range
export async function getMakeupClassesByDateRange(
  startDate: Date,
  endDate: Date,
  branchId?: string
): Promise<MakeupClass[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('makeup_classes')
    .select('*')
    .eq('status', 'scheduled')
    .gte('makeup_date', startDate.toISOString().split('T')[0])
    .lte('makeup_date', endDate.toISOString().split('T')[0])
    .order('makeup_date', { ascending: true })

  if (branchId) {
    query = query.eq('makeup_branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting makeup classes by date range:', error)
    return []
  }

  return data || []
}

// Get upcoming makeup classes
export async function getUpcomingMakeupClasses(
  branchId?: string,
  limit?: number
): Promise<MakeupClass[]> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('makeup_classes')
    .select('*')
    .eq('status', 'scheduled')
    .gte('makeup_date', today)
    .order('makeup_date', { ascending: true })

  if (branchId) {
    query = query.eq('makeup_branch_id', branchId)
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting upcoming makeup classes:', error)
    return []
  }

  return data || []
}

// ============================================
// CREATE / UPDATE / DELETE
// ============================================

// Create makeup request
export async function createMakeupRequest(
  makeupData: Omit<InsertTables<'makeup_classes'>, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const supabase = createServiceClient()

  // Check if makeup already exists
  const existingMakeup = await checkMakeupExists(
    makeupData.student_id,
    makeupData.original_class_id,
    makeupData.original_schedule_id
  )

  if (existingMakeup) {
    throw new Error('Makeup request already exists for this schedule')
  }

  const { data, error } = await supabase
    .from('makeup_classes')
    .insert({
      ...makeupData,
      status: 'pending'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating makeup request:', error)
    throw error
  }

  return data.id
}

// Schedule makeup class
export async function scheduleMakeupClass(
  makeupId: string,
  scheduleData: {
    makeup_date: string
    makeup_start_time: string
    makeup_end_time: string
    makeup_teacher_id: string
    makeup_teacher_name?: string
    makeup_branch_id: string
    makeup_room_id: string
    makeup_room_name?: string
    confirmed_by: string
  }
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('makeup_classes')
    .update({
      ...scheduleData,
      status: 'scheduled' as MakeupStatus,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', makeupId)

  if (error) {
    console.error('Error scheduling makeup class:', error)
    throw error
  }
}

// Update makeup class
export async function updateMakeupClass(
  id: string,
  makeupData: Partial<UpdateTables<'makeup_classes'>>
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, created_at: __, ...updateData } = makeupData as MakeupClass

  const { error } = await supabase
    .from('makeup_classes')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating makeup class:', error)
    throw error
  }
}

// Record makeup attendance
export async function recordMakeupAttendance(
  makeupId: string,
  attendance: {
    status: 'present' | 'absent'
    checked_by: string
    note?: string
  }
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('makeup_classes')
    .update({
      status: 'completed' as MakeupStatus,
      attendance_status: attendance.status,
      attendance_checked_by: attendance.checked_by,
      attendance_checked_at: new Date().toISOString(),
      attendance_note: attendance.note || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', makeupId)

  if (error) {
    console.error('Error recording makeup attendance:', error)
    throw error
  }
}

// Cancel makeup class
export async function cancelMakeupClass(
  makeupId: string,
  reason: string,
  cancelledBy: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('makeup_classes')
    .update({
      status: 'cancelled' as MakeupStatus,
      notes: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', makeupId)

  if (error) {
    console.error('Error cancelling makeup class:', error)
    throw error
  }
}

// Delete makeup class
export async function deleteMakeupClass(
  makeupId: string,
  deletedBy: string,
  reason?: string
): Promise<void> {
  const supabase = createServiceClient()

  const makeup = await getMakeupClass(makeupId)
  if (!makeup) {
    throw new Error('Makeup class not found')
  }

  if (makeup.status === 'completed') {
    throw new Error('Cannot delete completed makeup class')
  }

  const { error } = await supabase
    .from('makeup_classes')
    .delete()
    .eq('id', makeupId)

  if (error) {
    console.error('Error deleting makeup class:', error)
    throw error
  }
}

// Revert makeup to scheduled status
export async function revertMakeupToScheduled(
  makeupId: string,
  revertedBy: string,
  reason: string
): Promise<void> {
  const supabase = createServiceClient()

  const makeup = await getMakeupClass(makeupId)
  if (!makeup) {
    throw new Error('Makeup class not found')
  }

  if (makeup.status !== 'completed') {
    throw new Error('Can only revert completed makeup classes')
  }

  const { error } = await supabase
    .from('makeup_classes')
    .update({
      status: 'scheduled' as MakeupStatus,
      attendance_status: null,
      attendance_checked_by: null,
      attendance_checked_at: null,
      attendance_note: null,
      notes: `${makeup.notes || ''}\n[${new Date().toLocaleDateString('th-TH')}] ยกเลิกการบันทึกเข้าเรียน: ${reason} (โดย ${revertedBy})`,
      updated_at: new Date().toISOString()
    })
    .eq('id', makeupId)

  if (error) {
    console.error('Error reverting makeup status:', error)
    throw error
  }
}

// ============================================
// VALIDATION
// ============================================

// Count makeup classes for student in a class
export async function getMakeupCount(studentId: string, classId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('makeup_classes')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .neq('status', 'cancelled')

  if (error) {
    console.error('Error counting makeup classes:', error)
    return 0
  }

  return count || 0
}

// Check if makeup already exists for a schedule
export async function checkMakeupExists(
  studentId: string,
  classId: string,
  scheduleId: string
): Promise<MakeupClass | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .eq('original_schedule_id', scheduleId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (error) {
    console.error('Error checking makeup exists:', error)
    return null
  }

  return data
}

// Get makeup requests for specific schedules
export async function getMakeupRequestsBySchedules(
  studentId: string,
  classId: string,
  scheduleIds: string[]
): Promise<Record<string, MakeupClass>> {
  if (scheduleIds.length === 0) return {}

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .in('original_schedule_id', scheduleIds)
    .neq('status', 'cancelled')

  if (error) {
    console.error('Error getting makeup requests by schedules:', error)
    return {}
  }

  const makeupBySchedule: Record<string, MakeupClass> = {}
  for (const makeup of data || []) {
    makeupBySchedule[makeup.original_schedule_id] = makeup
  }

  return makeupBySchedule
}

// Get makeup by original schedule
export async function getMakeupByOriginalSchedule(
  studentId: string,
  classId: string,
  scheduleId: string
): Promise<MakeupClass | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .eq('original_schedule_id', scheduleId)
    .in('status', ['pending', 'scheduled'])
    .maybeSingle()

  if (error) {
    console.error('Error getting makeup by original schedule:', error)
    return null
  }

  return data
}

// ============================================
// AVAILABILITY
// ============================================

// Check teacher availability for makeup
export async function checkTeacherAvailability(
  teacherId: string,
  date: Date,
  startTime: string,
  endTime: string,
  branchId: string,
  roomId: string,
  excludeMakeupId?: string
): Promise<{ available: boolean; reason?: string }> {
  const supabase = createServiceClient()
  const dateString = date.toISOString().split('T')[0]

  // Check for holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('name')
    .eq('branch_id', branchId)
    .eq('date', dateString)

  if (holidays && holidays.length > 0) {
    return {
      available: false,
      reason: `วันหยุด: ${holidays[0].name}`
    }
  }

  // Check teacher's other makeup classes
  let teacherQuery = supabase
    .from('makeup_classes')
    .select('*')
    .eq('makeup_teacher_id', teacherId)
    .eq('makeup_date', dateString)
    .eq('status', 'scheduled')

  if (excludeMakeupId) {
    teacherQuery = teacherQuery.neq('id', excludeMakeupId)
  }

  const { data: teacherMakeups } = await teacherQuery

  if (teacherMakeups) {
    for (const makeup of teacherMakeups) {
      const hasTimeConflict =
        (startTime >= makeup.makeup_start_time && startTime < makeup.makeup_end_time) ||
        (endTime > makeup.makeup_start_time && endTime <= makeup.makeup_end_time) ||
        (startTime <= makeup.makeup_start_time && endTime >= makeup.makeup_end_time)

      if (hasTimeConflict) {
        return {
          available: false,
          reason: `ครูมีนัดสอนชดเชยอื่น ${makeup.makeup_start_time}-${makeup.makeup_end_time}`
        }
      }
    }
  }

  // Check room availability
  let roomQuery = supabase
    .from('makeup_classes')
    .select('*')
    .eq('makeup_branch_id', branchId)
    .eq('makeup_room_id', roomId)
    .eq('makeup_date', dateString)
    .eq('status', 'scheduled')

  if (excludeMakeupId) {
    roomQuery = roomQuery.neq('id', excludeMakeupId)
  }

  const { data: roomMakeups } = await roomQuery

  if (roomMakeups) {
    for (const makeup of roomMakeups) {
      const hasTimeConflict =
        (startTime >= makeup.makeup_start_time && startTime < makeup.makeup_end_time) ||
        (endTime > makeup.makeup_start_time && endTime <= makeup.makeup_end_time) ||
        (startTime <= makeup.makeup_start_time && endTime >= makeup.makeup_end_time)

      if (hasTimeConflict) {
        return {
          available: false,
          reason: `ห้องถูกใช้สอนชดเชยอื่น ${makeup.makeup_start_time}-${makeup.makeup_end_time}`
        }
      }
    }
  }

  return { available: true }
}

// ============================================
// STATISTICS
// ============================================

// Get makeup statistics
export async function getMakeupStats(branchId?: string | null): Promise<{
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  attendanceRate: number
}> {
  const makeups = await getMakeupClasses(branchId)

  const stats = {
    total: makeups.length,
    byStatus: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    attendanceRate: 0
  }

  let completed = 0
  let attended = 0

  for (const makeup of makeups) {
    // By status
    stats.byStatus[makeup.status] = (stats.byStatus[makeup.status] || 0) + 1

    // By type
    stats.byType[makeup.type] = (stats.byType[makeup.type] || 0) + 1

    // Calculate attendance rate
    if (makeup.status === 'completed') {
      completed++
      if (makeup.attendance_status === 'present') {
        attended++
      }
    }
  }

  if (completed > 0) {
    stats.attendanceRate = (attended / completed) * 100
  }

  return stats
}

// Get makeup classes for reminder (tomorrow)
export async function getMakeupClassesForReminder(tomorrowDate: Date): Promise<MakeupClass[]> {
  const dateString = tomorrowDate.toISOString().split('T')[0]

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('makeup_classes')
    .select('*')
    .eq('status', 'scheduled')
    .eq('makeup_date', dateString)

  if (error) {
    console.error('Error getting makeup classes for reminder:', error)
    return []
  }

  return data || []
}

// Delete makeup for schedule (when attendance is updated)
export async function deleteMakeupForSchedule(
  studentId: string,
  classId: string,
  scheduleId: string,
  deletedBy: string,
  reason: string = 'Attendance updated to present'
): Promise<void> {
  const makeup = await getMakeupByOriginalSchedule(studentId, classId, scheduleId)
  if (!makeup) return

  if (makeup.status === 'completed') {
    await cancelMakeupClass(makeup.id, reason, deletedBy)
  } else {
    await deleteMakeupClass(makeup.id, deletedBy, reason)
  }
}

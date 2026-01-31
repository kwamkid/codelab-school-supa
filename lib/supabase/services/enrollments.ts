import { createServiceClient } from '../server'
import type {
  Enrollment,
  EnrollmentFull,
  InsertTables,
  UpdateTables,
  EnrollmentStatus,
  PaymentStatus
} from '@/types/supabase'

// ============================================
// QUERY INTERFACES
// ============================================

export interface EnrollmentQueryOptions {
  branchId?: string | null
  status?: EnrollmentStatus | 'all'
  paymentStatus?: PaymentStatus | 'all'
  limit?: number
  offset?: number
  orderByField?: 'enrolled_at' | 'created_at'
  orderDirection?: 'asc' | 'desc'
}

export interface PaginatedEnrollments {
  enrollments: Enrollment[]
  hasMore: boolean
  total: number
}

export interface EnrollmentStats {
  total: number
  active: number
  completed: number
  dropped: number
  totalRevenue: number
  pendingPayments: number
  pendingCount: number
  partialCount: number
  paidCount: number
}

// ============================================
// GET ENROLLMENTS
// ============================================

// Get enrollments with pagination
export async function getEnrollmentsPaginated(
  options: EnrollmentQueryOptions = {}
): Promise<PaginatedEnrollments> {
  const supabase = createServiceClient()

  const {
    branchId,
    status,
    paymentStatus,
    limit: pageSize = 20,
    offset = 0,
    orderByField = 'enrolled_at',
    orderDirection = 'desc'
  } = options

  // Build query
  let query = supabase
    .from('enrollments')
    .select('*', { count: 'exact' })

  // Filters
  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (paymentStatus && paymentStatus !== 'all') {
    query = query.eq('payment_status', paymentStatus)
  }

  // Order and pagination
  query = query
    .order(orderByField, { ascending: orderDirection === 'asc' })
    .range(offset, offset + pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error getting enrollments paginated:', error)
    throw error
  }

  return {
    enrollments: data || [],
    hasMore: (count || 0) > offset + pageSize,
    total: count || 0
  }
}

// Get all enrollments (legacy - for search/export)
export async function getEnrollments(branchId?: string | null): Promise<Enrollment[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('enrollments')
    .select('*')
    .order('enrolled_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting enrollments:', error)
    throw error
  }

  return data || []
}

// Get enrollments with full info (using view)
export async function getEnrollmentsFull(branchId?: string | null): Promise<EnrollmentFull[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('v_enrollments_full')
    .select('*')
    .order('enrolled_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting enrollments full:', error)
    throw error
  }

  return data || []
}

// Get single enrollment
export async function getEnrollment(id: string): Promise<Enrollment | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting enrollment:', error)
    throw error
  }

  return data
}

// Get enrollment with full info
export async function getEnrollmentFull(id: string): Promise<EnrollmentFull | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('v_enrollments_full')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting enrollment full:', error)
    throw error
  }

  return data
}

// ============================================
// GET BY RELATIONS
// ============================================

// Get enrollments by class
export async function getEnrollmentsByClass(classId: string): Promise<Enrollment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('class_id', classId)
    .in('status', ['active', 'completed'])
    .order('enrolled_at', { ascending: true })

  if (error) {
    console.error('Error getting enrollments by class:', error)
    throw error
  }

  return data || []
}

// Get enrollments by student
export async function getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['active', 'completed'])
    .order('enrolled_at', { ascending: false })

  if (error) {
    console.error('Error getting enrollments by student:', error)
    return []
  }

  return data || []
}

// Get enrollments by parent
export async function getEnrollmentsByParent(parentId: string): Promise<Enrollment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('parent_id', parentId)
    .order('enrolled_at', { ascending: false })

  if (error) {
    console.error('Error getting enrollments by parent:', error)
    throw error
  }

  return data || []
}

// Get enrollments by branch
export async function getEnrollmentsByBranch(branchId: string): Promise<Enrollment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('branch_id', branchId)
    .order('enrolled_at', { ascending: false })

  if (error) {
    console.error('Error getting enrollments by branch:', error)
    return []
  }

  return data || []
}

// Get active enrollments for a class (for attendance)
export async function getActiveEnrollmentsByClass(classId: string): Promise<Enrollment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('class_id', classId)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: true })

  if (error) {
    console.error('Error getting active enrollments by class:', error)
    return []
  }

  return data || []
}

// ============================================
// STATISTICS
// ============================================

// Get enrollment statistics
export async function getEnrollmentStats(branchId?: string | null): Promise<EnrollmentStats> {
  const supabase = createServiceClient()

  let query = supabase.from('enrollments').select('*')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting enrollment stats:', error)
    return {
      total: 0,
      active: 0,
      completed: 0,
      dropped: 0,
      totalRevenue: 0,
      pendingPayments: 0,
      pendingCount: 0,
      partialCount: 0,
      paidCount: 0
    }
  }

  const enrollments = data || []

  const stats: EnrollmentStats = {
    total: enrollments.length,
    active: 0,
    completed: 0,
    dropped: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    pendingCount: 0,
    partialCount: 0,
    paidCount: 0
  }

  for (const enrollment of enrollments) {
    // Count by status
    if (enrollment.status === 'active') stats.active++
    else if (enrollment.status === 'completed') stats.completed++
    else if (enrollment.status === 'dropped') stats.dropped++

    // Count by payment status
    if (enrollment.payment_status === 'pending') {
      stats.pendingCount++
      stats.pendingPayments += enrollment.final_price || 0
    } else if (enrollment.payment_status === 'partial') {
      stats.partialCount++
      stats.pendingPayments += (enrollment.final_price || 0) - (enrollment.paid_amount || 0)
    } else if (enrollment.payment_status === 'paid') {
      stats.paidCount++
      stats.totalRevenue += enrollment.paid_amount || 0
    }
  }

  return stats
}

// ============================================
// VALIDATION
// ============================================

// Check if student is already enrolled in class
export async function checkDuplicateEnrollment(
  studentId: string,
  classId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .in('status', ['active', 'completed'])

  if (error) {
    console.error('Error checking duplicate enrollment:', error)
    throw error
  }

  return (data?.length || 0) > 0
}

// Check available seats in class
export async function checkAvailableSeats(classId: string): Promise<{
  available: boolean
  currentEnrolled: number
  maxStudents: number
  availableSeats: number
}> {
  const supabase = createServiceClient()

  const { data: classData, error } = await supabase
    .from('classes')
    .select('max_students, enrolled_count')
    .eq('id', classId)
    .single()

  if (error || !classData) {
    console.error('Error checking available seats:', error)
    return {
      available: false,
      currentEnrolled: 0,
      maxStudents: 0,
      availableSeats: 0
    }
  }

  const availableSeats = classData.max_students - classData.enrolled_count

  return {
    available: availableSeats > 0,
    currentEnrolled: classData.enrolled_count,
    maxStudents: classData.max_students,
    availableSeats: Math.max(0, availableSeats)
  }
}

// ============================================
// CREATE / UPDATE / DELETE
// ============================================

// Create new enrollment
export async function createEnrollment(
  enrollmentData: Omit<InsertTables<'enrollments'>, 'id' | 'enrolled_at'>
): Promise<string> {
  const supabase = createServiceClient()

  // Check duplicate
  const isDuplicate = await checkDuplicateEnrollment(
    enrollmentData.student_id,
    enrollmentData.class_id
  )
  if (isDuplicate) {
    throw new Error('Student is already enrolled in this class')
  }

  // Check available seats
  const seats = await checkAvailableSeats(enrollmentData.class_id)
  if (!seats.available) {
    throw new Error('Class is full')
  }

  // Create enrollment
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({
      ...enrollmentData,
      enrolled_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (enrollError) {
    console.error('Error creating enrollment:', enrollError)
    throw enrollError
  }

  // Note: enrolled_count is updated automatically by database trigger on enrollments table
  // Do NOT manually increment here to avoid double-counting

  // Auto-create makeup requests for missed sessions
  await createMakeupForMissedSessions(
    enrollment.id,
    enrollmentData.class_id,
    enrollmentData.student_id,
    enrollmentData.parent_id
  )

  return enrollment.id
}

// Create makeup requests for sessions student missed (enrolled late)
async function createMakeupForMissedSessions(
  enrollmentId: string,
  classId: string,
  studentId: string,
  parentId: string
): Promise<void> {
  try {
    const supabase = createServiceClient()

    // Get class info
    const { data: classData } = await supabase
      .from('classes')
      .select('name, end_time')
      .eq('id', classId)
      .single()

    if (!classData) return

    // Get schedules
    const { data: schedules } = await supabase
      .from('class_schedules')
      .select('id, session_date, session_number, status')
      .eq('class_id', classId)
      .order('session_date', { ascending: true })

    if (!schedules) return

    const now = new Date()
    const missedSchedules = schedules.filter(schedule => {
      const sessionDate = new Date(schedule.session_date)
      const [hours, minutes] = classData.end_time.split(':').map(Number)
      sessionDate.setHours(hours, minutes, 0, 0)

      return sessionDate < now &&
        schedule.status !== 'cancelled' &&
        schedule.status !== 'rescheduled'
    })

    // Create makeup requests for missed sessions
    if (missedSchedules.length > 0) {
      const makeupInserts = missedSchedules.map(schedule => ({
        type: 'ad-hoc' as const,
        original_class_id: classId,
        original_schedule_id: schedule.id,
        student_id: studentId,
        parent_id: parentId,
        branch_id: null, // Will be filled from class
        requested_by: 'system',
        reason: 'สมัครเรียนหลังจากคลาสเริ่มแล้ว (Auto-generated)',
        status: 'pending' as const,
        original_session_number: schedule.session_number,
        original_session_date: schedule.session_date
      }))

      const { error } = await supabase
        .from('makeup_classes')
        .insert(makeupInserts)

      if (error) {
        console.error('Error creating makeup requests:', error)
      } else {
        console.log(`Created ${missedSchedules.length} makeup requests for enrollment ${enrollmentId}`)
      }
    }
  } catch (error) {
    console.error('Error creating makeup for missed sessions:', error)
  }
}

// Update enrollment
export async function updateEnrollment(
  id: string,
  enrollmentData: Partial<UpdateTables<'enrollments'>>
): Promise<void> {
  const supabase = createServiceClient()

  // Remove fields that shouldn't be updated
  const { id: _, enrolled_at: __, ...updateData } = enrollmentData as Enrollment

  const { error } = await supabase
    .from('enrollments')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating enrollment:', error)
    throw error
  }
}

// Cancel enrollment (soft)
export async function cancelEnrollment(
  id: string,
  reason: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get enrollment to get class ID
  const enrollment = await getEnrollment(id)
  if (!enrollment) throw new Error('Enrollment not found')

  // Update enrollment status
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({
      status: 'dropped' as EnrollmentStatus,
      dropped_reason: reason
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error canceling enrollment:', updateError)
    throw updateError
  }

  // Note: enrolled_count is updated automatically by database trigger on enrollments table
  // Do NOT manually decrement here to avoid double-counting
}

// Delete enrollment completely
export async function deleteEnrollment(enrollmentId: string): Promise<void> {
  const supabase = createServiceClient()

  // Get enrollment first
  const enrollment = await getEnrollment(enrollmentId)
  if (!enrollment) throw new Error('Enrollment not found')

  // Delete the enrollment
  const { error: deleteError } = await supabase
    .from('enrollments')
    .delete()
    .eq('id', enrollmentId)

  if (deleteError) {
    console.error('Error deleting enrollment:', deleteError)
    throw deleteError
  }

  // Note: enrolled_count is updated automatically by database trigger on enrollments table
  // Do NOT manually decrement here to avoid double-counting
}

// ============================================
// TRANSFER
// ============================================

// Transfer enrollment to another class
export async function transferEnrollment(
  enrollmentId: string,
  newClassId: string,
  reason?: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get current enrollment
  const enrollment = await getEnrollment(enrollmentId)
  if (!enrollment) throw new Error('Enrollment not found')

  const oldClassId = enrollment.class_id

  // Check if student is already enrolled in new class
  const isDuplicate = await checkDuplicateEnrollment(enrollment.student_id, newClassId)
  if (isDuplicate) {
    throw new Error('Student is already enrolled in the target class')
  }

  // Check available seats in new class
  const seats = await checkAvailableSeats(newClassId)
  if (!seats.available) {
    throw new Error('Target class is full')
  }

  // Build transfer record
  const transferRecord = {
    from_class_id: oldClassId,
    to_class_id: newClassId,
    transferred_at: new Date().toISOString(),
    reason: reason || 'Admin transfer'
  }

  // Get existing transfer history
  const existingHistory = enrollment.transfer_history || []
  const updatedHistory = [...existingHistory, transferRecord]

  // Update enrollment
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({
      class_id: newClassId,
      status: 'active' as EnrollmentStatus,
      transfer_history: updatedHistory
    })
    .eq('id', enrollmentId)

  if (updateError) {
    console.error('Error transferring enrollment:', updateError)
    throw updateError
  }

  // Note: enrolled_count is updated automatically by database trigger on enrollments table
  // The trigger handles class_id changes (decrement old, increment new)
}

// Get transfer history for enrollment
export async function getEnrollmentTransferHistory(
  enrollmentId: string
): Promise<Array<{
  from_class_id: string
  to_class_id: string
  transferred_at: string
  reason: string
}>> {
  const enrollment = await getEnrollment(enrollmentId)
  if (!enrollment || !enrollment.transfer_history) return []

  return enrollment.transfer_history
}

// Get available classes for transfer
export async function getAvailableClassesForTransfer(
  studentId: string,
  currentClassId: string,
  studentAge: number
): Promise<{
  eligibleClasses: any[]
  allClasses: any[]
}> {
  const supabase = createServiceClient()

  // Get all active classes except current
  const { data: allClasses } = await supabase
    .from('v_classes_full')
    .select('*')
    .in('status', ['published', 'started'])
    .neq('id', currentClassId)

  if (!allClasses) {
    return { eligibleClasses: [], allClasses: [] }
  }

  // Get subjects for age filtering
  const subjectIds = [...new Set(allClasses.map(c => c.subject_id))]
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, age_min, age_max')
    .in('id', subjectIds)

  const subjectMap = new Map(subjects?.map(s => [s.id, s]) || [])

  // Filter by age eligibility
  const eligibleClasses = allClasses.filter(cls => {
    const subject = subjectMap.get(cls.subject_id)
    if (!subject) return false

    return studentAge >= subject.age_min && studentAge <= subject.age_max
  })

  return {
    eligibleClasses,
    allClasses
  }
}

// ============================================
// PAYMENT
// ============================================

// Update payment status
export async function updatePaymentStatus(
  enrollmentId: string,
  paymentStatus: PaymentStatus,
  paidAmount?: number,
  paymentMethod?: string,
  paymentNote?: string
): Promise<void> {
  const supabase = createServiceClient()

  const updateData: Partial<UpdateTables<'enrollments'>> = {
    payment_status: paymentStatus
  }

  if (paidAmount !== undefined) {
    updateData.paid_amount = paidAmount
  }

  if (paymentMethod) {
    updateData.payment_method = paymentMethod
  }

  if (paymentNote) {
    updateData.payment_note = paymentNote
  }

  if (paymentStatus === 'paid') {
    updateData.paid_date = new Date().toISOString()
  }

  const { error } = await supabase
    .from('enrollments')
    .update(updateData)
    .eq('id', enrollmentId)

  if (error) {
    console.error('Error updating payment status:', error)
    throw error
  }
}

// Record partial payment
export async function recordPartialPayment(
  enrollmentId: string,
  amount: number,
  paymentMethod?: string,
  note?: string
): Promise<void> {
  const enrollment = await getEnrollment(enrollmentId)
  if (!enrollment) throw new Error('Enrollment not found')

  const newPaidAmount = (enrollment.paid_amount || 0) + amount
  const isPaidInFull = newPaidAmount >= (enrollment.final_price || 0)

  await updatePaymentStatus(
    enrollmentId,
    isPaidInFull ? 'paid' : 'partial',
    newPaidAmount,
    paymentMethod,
    note
  )
}

// ============================================
// BULK OPERATIONS
// ============================================

// Get enrollments by IDs
export async function getEnrollmentsByIds(ids: string[]): Promise<Enrollment[]> {
  if (ids.length === 0) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('Error getting enrollments by IDs:', error)
    throw error
  }

  return data || []
}

// Search enrollments
export async function searchEnrollments(
  searchTerm: string,
  branchId?: string
): Promise<EnrollmentFull[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('v_enrollments_full')
    .select('*')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  // Search by student name, parent name, or class name
  query = query.or(`student_name.ilike.%${searchTerm}%,parent_name.ilike.%${searchTerm}%,class_name.ilike.%${searchTerm}%`)

  const { data, error } = await query.order('enrolled_at', { ascending: false })

  if (error) {
    console.error('Error searching enrollments:', error)
    return []
  }

  return data || []
}

// Count enrollments by status
export async function countEnrollmentsByStatus(
  classId: string
): Promise<{ active: number; completed: number; dropped: number }> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('status')
    .eq('class_id', classId)

  if (error || !data) {
    return { active: 0, completed: 0, dropped: 0 }
  }

  return {
    active: data.filter(e => e.status === 'active').length,
    completed: data.filter(e => e.status === 'completed').length,
    dropped: data.filter(e => e.status === 'dropped').length
  }
}

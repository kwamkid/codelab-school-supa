import { createServiceClient } from '../server'
import type {
  TrialBooking,
  TrialSession,
  InsertTables,
  UpdateTables,
  TrialBookingStatus,
  TrialSessionStatus
} from '@/types/supabase'

// ============================================
// TRIAL BOOKINGS
// ============================================

// Get all trial bookings
export async function getTrialBookings(branchId?: string | null): Promise<TrialBooking[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('trial_bookings')
    .select('*')
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting trial bookings:', error)
    throw error
  }

  return data || []
}

// Get trial bookings by status
export async function getTrialBookingsByStatus(
  status: TrialBookingStatus
): Promise<TrialBooking[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('trial_bookings')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error getting trial bookings by status:', error)
    throw error
  }

  return data || []
}

// Get single trial booking
export async function getTrialBooking(id: string): Promise<TrialBooking | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('trial_bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting trial booking:', error)
    throw error
  }

  return data
}

// Create trial booking
export async function createTrialBooking(
  bookingData: Omit<InsertTables<'trial_bookings'>, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('trial_bookings')
    .insert({
      ...bookingData,
      status: bookingData.status || 'new'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating trial booking:', error)
    throw error
  }

  return data.id
}

// Update trial booking
export async function updateTrialBooking(
  id: string,
  bookingData: Partial<UpdateTables<'trial_bookings'>>
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, created_at: __, ...updateData } = bookingData as TrialBooking

  const { error } = await supabase
    .from('trial_bookings')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating trial booking:', error)
    throw error
  }
}

// Update booking status
export async function updateBookingStatus(
  id: string,
  status: TrialBookingStatus,
  note?: string
): Promise<void> {
  const supabase = createServiceClient()

  const updateData: Partial<UpdateTables<'trial_bookings'>> = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'contacted') {
    updateData.contacted_at = new Date().toISOString()
  }

  if (note) {
    updateData.contact_note = note
  }

  const { error } = await supabase
    .from('trial_bookings')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating booking status:', error)
    throw error
  }
}

// Cancel trial booking
export async function cancelTrialBooking(
  id: string,
  reason?: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get booking
  const booking = await getTrialBooking(id)
  if (!booking) throw new Error('Booking not found')

  if (booking.status === 'cancelled') {
    throw new Error('Booking is already cancelled')
  }

  if (booking.status === 'converted') {
    throw new Error('Cannot cancel converted booking')
  }

  // Update booking status
  const { error: bookingError } = await supabase
    .from('trial_bookings')
    .update({
      status: 'cancelled' as TrialBookingStatus,
      notes: reason || booking.notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (bookingError) {
    console.error('Error cancelling trial booking:', bookingError)
    throw bookingError
  }

  // Cancel all scheduled sessions
  const { error: sessionError } = await supabase
    .from('trial_sessions')
    .update({
      status: 'cancelled' as TrialSessionStatus,
      feedback: reason || 'ยกเลิกการจอง',
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', id)
    .eq('status', 'scheduled')

  if (sessionError) {
    console.error('Error cancelling trial sessions:', sessionError)
  }
}

// Delete trial booking (only new or cancelled)
export async function deleteTrialBooking(id: string): Promise<void> {
  const supabase = createServiceClient()

  const booking = await getTrialBooking(id)
  if (!booking) throw new Error('Booking not found')

  if (booking.status !== 'new' && booking.status !== 'cancelled') {
    throw new Error('Can only delete new or cancelled bookings')
  }

  // Delete sessions first
  const { error: sessionError } = await supabase
    .from('trial_sessions')
    .delete()
    .eq('booking_id', id)

  if (sessionError) {
    console.error('Error deleting trial sessions:', sessionError)
  }

  // Delete booking
  const { error: bookingError } = await supabase
    .from('trial_bookings')
    .delete()
    .eq('id', id)

  if (bookingError) {
    console.error('Error deleting trial booking:', bookingError)
    throw bookingError
  }
}

// ============================================
// TRIAL SESSIONS
// ============================================

// Get all trial sessions
export async function getTrialSessions(branchId?: string | null): Promise<TrialSession[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('trial_sessions')
    .select('*')
    .order('scheduled_date', { ascending: false })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting trial sessions:', error)
    throw error
  }

  return data || []
}

// Get trial sessions by booking
export async function getTrialSessionsByBooking(bookingId: string): Promise<TrialSession[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('trial_sessions')
    .select('*')
    .eq('booking_id', bookingId)
    .order('scheduled_date', { ascending: true })

  if (error) {
    console.error('Error getting trial sessions by booking:', error)
    throw error
  }

  return data || []
}

// Get single trial session
export async function getTrialSession(id: string): Promise<TrialSession | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('trial_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting trial session:', error)
    throw error
  }

  return data
}

// Get trial sessions by date range
export async function getTrialSessionsByDateRange(
  startDate: Date,
  endDate: Date,
  branchId?: string
): Promise<TrialSession[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('trial_sessions')
    .select('*')
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', endDate.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting trial sessions by date range:', error)
    return []
  }

  return data || []
}

// Create trial session
export async function createTrialSession(
  sessionData: Omit<InsertTables<'trial_sessions'>, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('trial_sessions')
    .insert({
      ...sessionData,
      status: sessionData.status || 'scheduled'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating trial session:', error)
    throw error
  }

  // Update booking status to scheduled if needed
  const booking = await getTrialBooking(sessionData.booking_id)
  if (booking && booking.status === 'new') {
    await updateBookingStatus(sessionData.booking_id, 'scheduled')
  }

  return data.id
}

// Update trial session
export async function updateTrialSession(
  id: string,
  sessionData: Partial<UpdateTables<'trial_sessions'>>
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, created_at: __, ...updateData } = sessionData as TrialSession

  // Set completed_at for completed statuses
  if (sessionData.status === 'attended' || sessionData.status === 'absent') {
    updateData.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('trial_sessions')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating trial session:', error)
    throw error
  }

  // Auto-update booking status
  if (sessionData.status === 'attended' || sessionData.status === 'absent' || sessionData.status === 'cancelled') {
    const session = await getTrialSession(id)
    if (session) {
      await checkAndUpdateBookingStatus(session.booking_id)
    }
  }
}

// Cancel trial session
export async function cancelTrialSession(id: string, reason?: string): Promise<void> {
  await updateTrialSession(id, {
    status: 'cancelled',
    feedback: reason
  })
}

// Delete trial session
export async function deleteTrialSession(id: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('trial_sessions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting trial session:', error)
    throw error
  }
}

// Reschedule trial session
export async function rescheduleTrialSession(
  sessionId: string,
  newSchedule: {
    scheduled_date: string
    start_time: string
    end_time: string
    teacher_id: string
    branch_id: string
    room_id: string
    room_name?: string
  },
  reason?: string,
  rescheduledBy: string = 'admin'
): Promise<void> {
  const supabase = createServiceClient()

  // Get current session
  const currentSession = await getTrialSession(sessionId)
  if (!currentSession) {
    throw new Error('Trial session not found')
  }

  // Build reschedule history entry
  const historyEntry = {
    original_date: currentSession.scheduled_date,
    original_time: `${currentSession.start_time}-${currentSession.end_time}`,
    new_date: newSchedule.scheduled_date,
    new_time: `${newSchedule.start_time}-${newSchedule.end_time}`,
    reason: reason || 'ไม่มาเรียนตามนัด',
    rescheduled_by: rescheduledBy,
    rescheduled_at: new Date().toISOString()
  }

  const existingHistory = currentSession.reschedule_history || []
  const updatedHistory = [...existingHistory, historyEntry]

  const { error } = await supabase
    .from('trial_sessions')
    .update({
      ...newSchedule,
      status: 'scheduled' as TrialSessionStatus,
      attended: false,
      feedback: null,
      teacher_note: null,
      interested_level: null,
      reschedule_history: updatedHistory,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error rescheduling trial session:', error)
    throw error
  }

  // Update booking status if needed
  const booking = await getTrialBooking(currentSession.booking_id)
  if (booking && booking.status === 'completed') {
    await updateBookingStatus(currentSession.booking_id, 'scheduled')
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Check and update booking status based on sessions
async function checkAndUpdateBookingStatus(bookingId: string): Promise<void> {
  try {
    const [booking, sessions] = await Promise.all([
      getTrialBooking(bookingId),
      getTrialSessionsByBooking(bookingId)
    ])

    if (!booking || sessions.length === 0) return

    // Check if any session has been converted
    const hasConverted = sessions.some(s => s.converted)
    if (hasConverted && booking.status !== 'converted') {
      await updateBookingStatus(bookingId, 'converted')
      return
    }

    // Check if all sessions are completed
    const allCompleted = sessions.every(s =>
      s.status === 'attended' ||
      s.status === 'absent' ||
      s.status === 'cancelled' ||
      s.converted
    )

    const hasAttended = sessions.some(s => s.status === 'attended')

    if (allCompleted && hasAttended && booking.status !== 'completed' && booking.status !== 'converted') {
      await updateBookingStatus(bookingId, 'completed')
    }
  } catch (error) {
    console.error('Error checking and updating booking status:', error)
  }
}

// ============================================
// ROOM AVAILABILITY
// ============================================

// Check room availability for trial
export async function checkTrialRoomAvailability(
  branchId: string,
  roomId: string,
  date: Date,
  startTime: string,
  endTime: string,
  teacherId: string,
  excludeSessionId?: string
): Promise<{
  available: boolean
  conflicts?: Array<{
    type: 'holiday' | 'room_conflict' | 'teacher_conflict'
    message: string
    details?: any
  }>
}> {
  const supabase = createServiceClient()
  const conflicts: any[] = []
  const dateString = date.toISOString().split('T')[0]

  // Check for holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .eq('branch_id', branchId)
    .eq('date', dateString)

  if (holidays && holidays.length > 0) {
    conflicts.push({
      type: 'holiday',
      message: `วันหยุด: ${holidays[0].name}`,
      details: holidays[0]
    })
  }

  // Check for room conflicts with other trial sessions
  let trialQuery = supabase
    .from('trial_sessions')
    .select('*')
    .eq('branch_id', branchId)
    .eq('room_id', roomId)
    .eq('scheduled_date', dateString)
    .eq('status', 'scheduled')

  if (excludeSessionId) {
    trialQuery = trialQuery.neq('id', excludeSessionId)
  }

  const { data: trialSessions } = await trialQuery

  if (trialSessions) {
    for (const session of trialSessions) {
      const hasTimeConflict =
        (startTime >= session.start_time && startTime < session.end_time) ||
        (endTime > session.start_time && endTime <= session.end_time) ||
        (startTime <= session.start_time && endTime >= session.end_time)

      if (hasTimeConflict) {
        conflicts.push({
          type: 'room_conflict',
          message: `ห้องถูกใช้เรียนทดลอง ${session.start_time}-${session.end_time}`,
          details: session
        })
      }
    }
  }

  // Check teacher availability
  let teacherQuery = supabase
    .from('trial_sessions')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('scheduled_date', dateString)
    .eq('status', 'scheduled')

  if (excludeSessionId) {
    teacherQuery = teacherQuery.neq('id', excludeSessionId)
  }

  const { data: teacherSessions } = await teacherQuery

  if (teacherSessions) {
    for (const session of teacherSessions) {
      const hasTimeConflict =
        (startTime >= session.start_time && startTime < session.end_time) ||
        (endTime > session.start_time && endTime <= session.end_time) ||
        (startTime <= session.start_time && endTime >= session.end_time)

      if (hasTimeConflict) {
        conflicts.push({
          type: 'teacher_conflict',
          message: `ครูมีนัดสอนทดลองอื่น ${session.start_time}-${session.end_time}`,
          details: session
        })
      }
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts: conflicts.length > 0 ? conflicts : undefined
  }
}

// ============================================
// CONVERSION
// ============================================

// Mark session as converted
export async function markSessionAsConverted(
  sessionId: string,
  classId: string,
  conversionNote?: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('trial_sessions')
    .update({
      converted: true,
      converted_to_class_id: classId,
      conversion_note: conversionNote,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error marking session as converted:', error)
    throw error
  }

  // Update booking status
  const session = await getTrialSession(sessionId)
  if (session) {
    await checkAndUpdateBookingStatus(session.booking_id)
  }
}

// ============================================
// STATISTICS
// ============================================

// Get trial booking stats
export async function getTrialBookingStats(branchId?: string | null): Promise<{
  total: number
  byStatus: Record<string, number>
  conversionRate: number
  bySource: Record<string, number>
}> {
  const bookings = await getTrialBookings(branchId)

  const stats = {
    total: bookings.length,
    byStatus: {} as Record<string, number>,
    conversionRate: 0,
    bySource: {} as Record<string, number>
  }

  for (const booking of bookings) {
    // By status
    stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1

    // By source
    if (booking.source) {
      stats.bySource[booking.source] = (stats.bySource[booking.source] || 0) + 1
    }
  }

  // Calculate conversion rate
  const converted = stats.byStatus['converted'] || 0
  const completed = stats.byStatus['completed'] || 0
  const totalCompletedOrConverted = converted + completed
  if (totalCompletedOrConverted > 0) {
    stats.conversionRate = (converted / totalCompletedOrConverted) * 100
  }

  return stats
}

// Get upcoming trial sessions
export async function getUpcomingTrialSessions(
  branchId?: string,
  limit?: number
): Promise<TrialSession[]> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('trial_sessions')
    .select('*')
    .gte('scheduled_date', today)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting upcoming trial sessions:', error)
    return []
  }

  return data || []
}

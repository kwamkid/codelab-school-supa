// lib/supabase/services/trial-bookings.ts

import { createServiceClient } from '../server'

export interface TrialBookingStudent {
  name: string
  birthdate?: Date
  schoolName?: string
  gradeLevel?: string
  subjectInterests: string[]
}

export interface TrialBooking {
  id: string
  source: 'line' | 'website' | 'admin' | 'walk-in'
  hasLineLogin: boolean
  parentLineId?: string
  parentName: string
  parentPhone: string
  parentEmail?: string
  students: TrialBookingStudent[]
  branchId?: string
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'cancelled' | 'converted'
  contactNote?: string
  bookedBy?: string
  notes?: string
  createdAt: Date
  updatedAt?: Date
  contactedAt?: Date
}

export interface TrialSession {
  id: string
  bookingId: string
  studentName: string
  subjectId: string
  branchId: string
  scheduledDate: Date
  startTime: string
  endTime: string
  teacherId: string
  roomId: string
  roomName?: string
  status: 'scheduled' | 'attended' | 'absent' | 'cancelled'
  attended?: boolean
  feedback?: string
  interestedLevel?: string
  teacherNote?: string
  converted?: boolean
  convertedToClassId?: string
  conversionNote?: string
  rescheduleHistory?: any[]
  createdAt: Date
  completedAt?: Date
}

// ==================== Trial Bookings ====================

// Get all trial bookings
export async function getTrialBookings(branchId?: string | null): Promise<TrialBooking[]> {
  const supabase = createServiceClient()

  try {
    let query = supabase
      .from('trial_bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(mapTrialBooking)
  } catch (error) {
    console.error('Error getting trial bookings:', error)
    throw error
  }
}

// Get trial bookings by status
export async function getTrialBookingsByStatus(status: TrialBooking['status']): Promise<TrialBooking[]> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('trial_bookings')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(mapTrialBooking)
  } catch (error) {
    console.error('Error getting trial bookings by status:', error)
    throw error
  }
}

// Get single trial booking
export async function getTrialBooking(id: string): Promise<TrialBooking | null> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('trial_bookings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null

    return mapTrialBooking(data)
  } catch (error) {
    console.error('Error getting trial booking:', error)
    return null
  }
}

// Create trial booking
export async function createTrialBooking(
  data: Omit<TrialBooking, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const supabase = createServiceClient()

  try {
    const insertData: any = {
      source: data.source,
      has_line_login: data.hasLineLogin,
      parent_line_id: data.parentLineId,
      parent_name: data.parentName,
      parent_phone: data.parentPhone,
      parent_email: data.parentEmail,
      students: data.students.map(s => ({
        name: s.name,
        birthdate: s.birthdate?.toISOString(),
        school_name: s.schoolName,
        grade_level: s.gradeLevel,
        subject_interests: s.subjectInterests
      })),
      branch_id: data.branchId,
      status: data.status || 'new',
      contact_note: data.contactNote,
      booked_by: data.bookedBy,
      notes: data.notes
    }

    const { data: result, error } = await supabase
      .from('trial_bookings')
      .insert(insertData)
      .select('id')
      .single()

    if (error) throw error

    return result.id
  } catch (error) {
    console.error('Error creating trial booking:', error)
    throw error
  }
}

// Update trial booking
export async function updateTrialBooking(id: string, data: Partial<TrialBooking>): Promise<void> {
  const supabase = createServiceClient()

  try {
    const updateData: any = {}

    if (data.status !== undefined) updateData.status = data.status
    if (data.contactNote !== undefined) updateData.contact_note = data.contactNote
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.branchId !== undefined) updateData.branch_id = data.branchId
    if (data.contactedAt !== undefined) updateData.contacted_at = data.contactedAt?.toISOString()

    if (data.students !== undefined) {
      updateData.students = data.students.map(s => ({
        name: s.name,
        birthdate: s.birthdate?.toISOString(),
        school_name: s.schoolName,
        grade_level: s.gradeLevel,
        subject_interests: s.subjectInterests
      }))
    }

    const { error } = await supabase
      .from('trial_bookings')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error updating trial booking:', error)
    throw error
  }
}

// Update booking status
export async function updateBookingStatus(
  id: string,
  status: TrialBooking['status'],
  note?: string
): Promise<void> {
  const supabase = createServiceClient()

  try {
    const updateData: any = { status }

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

    if (error) throw error
  } catch (error) {
    console.error('Error updating booking status:', error)
    throw error
  }
}

// Cancel trial booking
export async function cancelTrialBooking(id: string, reason?: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    const booking = await getTrialBooking(id)
    if (!booking) throw new Error('Booking not found')

    if (booking.status === 'cancelled') throw new Error('Booking is already cancelled')
    if (booking.status === 'converted') throw new Error('Cannot cancel converted booking')

    // Update booking status
    const { error: updateError } = await supabase
      .from('trial_bookings')
      .update({
        status: 'cancelled',
        notes: reason
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Cancel associated sessions
    const { error: sessionError } = await supabase
      .from('trial_sessions')
      .update({
        status: 'cancelled',
        feedback: reason || 'ยกเลิกการจอง'
      })
      .eq('booking_id', id)
      .eq('status', 'scheduled')

    if (sessionError) throw sessionError
  } catch (error) {
    console.error('Error cancelling trial booking:', error)
    throw error
  }
}

// Delete trial booking
export async function deleteTrialBooking(id: string): Promise<void> {
  const supabase = createServiceClient()

  try {
    const booking = await getTrialBooking(id)
    if (!booking) throw new Error('Booking not found')

    if (booking.status !== 'new' && booking.status !== 'cancelled') {
      throw new Error('Can only delete new or cancelled bookings')
    }

    // Delete sessions first
    await supabase.from('trial_sessions').delete().eq('booking_id', id)

    // Delete booking
    const { error } = await supabase.from('trial_bookings').delete().eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting trial booking:', error)
    throw error
  }
}

// ==================== Trial Sessions ====================

// Get all trial sessions
export async function getTrialSessions(branchId?: string | null): Promise<TrialSession[]> {
  const supabase = createServiceClient()

  try {
    let query = supabase
      .from('trial_sessions')
      .select('*')
      .order('scheduled_date', { ascending: false })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(mapTrialSession)
  } catch (error) {
    console.error('Error getting trial sessions:', error)
    throw error
  }
}

// Get trial sessions by booking
export async function getTrialSessionsByBooking(bookingId: string): Promise<TrialSession[]> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('trial_sessions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('scheduled_date', { ascending: true })

    if (error) throw error

    return (data || []).map(mapTrialSession)
  } catch (error) {
    console.error('Error getting trial sessions by booking:', error)
    throw error
  }
}

// Get single trial session
export async function getTrialSession(id: string): Promise<TrialSession | null> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('trial_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null

    return mapTrialSession(data)
  } catch (error) {
    console.error('Error getting trial session:', error)
    return null
  }
}

// Create trial session
export async function createTrialSession(
  data: Omit<TrialSession, 'id' | 'createdAt'>
): Promise<string> {
  const supabase = createServiceClient()

  try {
    const insertData = {
      booking_id: data.bookingId,
      student_name: data.studentName,
      subject_id: data.subjectId,
      branch_id: data.branchId,
      scheduled_date: data.scheduledDate.toISOString().split('T')[0],
      start_time: data.startTime,
      end_time: data.endTime,
      teacher_id: data.teacherId,
      room_id: data.roomId,
      room_name: data.roomName,
      status: data.status || 'scheduled'
    }

    const { data: result, error } = await supabase
      .from('trial_sessions')
      .insert(insertData)
      .select('id')
      .single()

    if (error) throw error

    // Update booking status if needed
    const booking = await getTrialBooking(data.bookingId)
    if (booking && booking.status === 'new') {
      await updateBookingStatus(data.bookingId, 'scheduled')
    }

    return result.id
  } catch (error) {
    console.error('Error creating trial session:', error)
    throw error
  }
}

// Update trial session
export async function updateTrialSession(id: string, data: Partial<TrialSession>): Promise<void> {
  const supabase = createServiceClient()

  try {
    const updateData: any = {}

    if (data.scheduledDate !== undefined) {
      updateData.scheduled_date = data.scheduledDate.toISOString().split('T')[0]
    }
    if (data.startTime !== undefined) updateData.start_time = data.startTime
    if (data.endTime !== undefined) updateData.end_time = data.endTime
    if (data.teacherId !== undefined) updateData.teacher_id = data.teacherId
    if (data.roomId !== undefined) updateData.room_id = data.roomId
    if (data.roomName !== undefined) updateData.room_name = data.roomName
    if (data.status !== undefined) updateData.status = data.status
    if (data.attended !== undefined) updateData.attended = data.attended
    if (data.feedback !== undefined) updateData.feedback = data.feedback
    if (data.interestedLevel !== undefined) updateData.interested_level = data.interestedLevel
    if (data.teacherNote !== undefined) updateData.teacher_note = data.teacherNote
    if (data.converted !== undefined) updateData.converted = data.converted
    if (data.convertedToClassId !== undefined) updateData.converted_to_class_id = data.convertedToClassId
    if (data.conversionNote !== undefined) updateData.conversion_note = data.conversionNote

    if (data.status === 'attended' || data.status === 'absent') {
      updateData.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('trial_sessions')
      .update(updateData)
      .eq('id', id)

    if (error) throw error

    // Auto-update booking status
    if (data.status === 'attended' || data.status === 'absent' || data.status === 'cancelled') {
      const session = await getTrialSession(id)
      if (session) {
        await checkAndUpdateBookingStatus(session.bookingId)
      }
    }
  } catch (error) {
    console.error('Error updating trial session:', error)
    throw error
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

  try {
    const { error } = await supabase.from('trial_sessions').delete().eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting trial session:', error)
    throw error
  }
}

// ==================== Helper Functions ====================

function mapTrialBooking(data: any): TrialBooking {
  return {
    id: data.id,
    source: data.source,
    hasLineLogin: data.has_line_login,
    parentLineId: data.parent_line_id,
    parentName: data.parent_name,
    parentPhone: data.parent_phone,
    parentEmail: data.parent_email,
    students: (data.students || []).map((s: any) => ({
      name: s.name,
      birthdate: s.birthdate ? new Date(s.birthdate) : undefined,
      schoolName: s.school_name,
      gradeLevel: s.grade_level,
      subjectInterests: s.subject_interests || []
    })),
    branchId: data.branch_id,
    status: data.status,
    contactNote: data.contact_note,
    bookedBy: data.booked_by,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    contactedAt: data.contacted_at ? new Date(data.contacted_at) : undefined
  }
}

function mapTrialSession(data: any): TrialSession {
  return {
    id: data.id,
    bookingId: data.booking_id,
    studentName: data.student_name,
    subjectId: data.subject_id,
    branchId: data.branch_id,
    scheduledDate: new Date(data.scheduled_date),
    startTime: data.start_time,
    endTime: data.end_time,
    teacherId: data.teacher_id,
    roomId: data.room_id,
    roomName: data.room_name,
    status: data.status,
    attended: data.attended,
    feedback: data.feedback,
    interestedLevel: data.interested_level,
    teacherNote: data.teacher_note,
    converted: data.converted,
    convertedToClassId: data.converted_to_class_id,
    conversionNote: data.conversion_note,
    rescheduleHistory: data.reschedule_history,
    createdAt: new Date(data.created_at),
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined
  }
}

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
    const allCompleted = sessions.every(
      s => s.status === 'attended' || s.status === 'absent' || s.status === 'cancelled' || s.converted
    )

    const hasAttended = sessions.some(s => s.status === 'attended')

    if (allCompleted && hasAttended && booking.status !== 'completed' && booking.status !== 'converted') {
      await updateBookingStatus(bookingId, 'completed')
    }
  } catch (error) {
    console.error('Error checking and updating booking status:', error)
  }
}

// Get trial booking stats
export async function getTrialBookingStats(branchId?: string | null): Promise<{
  total: number
  byStatus: Record<string, number>
  conversionRate: number
  bySource: Record<string, number>
}> {
  try {
    const bookings = await getTrialBookings(branchId)

    const stats = {
      total: bookings.length,
      byStatus: {} as Record<string, number>,
      conversionRate: 0,
      bySource: {} as Record<string, number>
    }

    // Count by status and source
    bookings.forEach(booking => {
      stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1
      stats.bySource[booking.source] = (stats.bySource[booking.source] || 0) + 1
    })

    // Calculate conversion rate
    const converted = stats.byStatus['converted'] || 0
    const completed = stats.byStatus['completed'] || 0
    if (completed > 0) {
      stats.conversionRate = (converted / completed) * 100
    }

    return stats
  } catch (error) {
    console.error('Error getting trial booking stats:', error)
    return {
      total: 0,
      byStatus: {},
      conversionRate: 0,
      bySource: {}
    }
  }
}

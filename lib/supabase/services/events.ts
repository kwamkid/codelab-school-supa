import { createServiceClient } from '../server'
import type {
  Event,
  EventSchedule,
  EventRegistration,
  InsertTables,
  UpdateTables,
  EventStatus
} from '@/types/supabase'

// ============================================
// EVENTS
// ============================================

// Get all events
export async function getEvents(branchId?: string): Promise<Event[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  if (branchId) {
    query = query.contains('branch_ids', [branchId])
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting events:', error)
    throw error
  }

  return data || []
}

// Get active events
export async function getActiveEvents(branchId?: string): Promise<Event[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('is_active', true)
    .order('registration_start_date', { ascending: true })

  if (branchId) {
    query = query.contains('branch_ids', [branchId])
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting active events:', error)
    return []
  }

  return data || []
}

// Get single event
export async function getEvent(id: string): Promise<Event | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting event:', error)
    throw error
  }

  return data
}

// Create event
export async function createEvent(
  eventData: Omit<InsertTables<'events'>, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('events')
    .insert({
      ...eventData,
      is_active: true,
      created_by: userId
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating event:', error)
    throw error
  }

  return data.id
}

// Update event
export async function updateEvent(
  id: string,
  eventData: Partial<UpdateTables<'events'>>,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, created_at: __, created_by: ___, ...updateData } = eventData as Event

  const { error } = await supabase
    .from('events')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
      updated_by: userId
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating event:', error)
    throw error
  }
}

// Delete event
export async function deleteEvent(id: string): Promise<void> {
  const supabase = createServiceClient()

  // Check if event has registrations
  const { count: regCount } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)

  if (regCount && regCount > 0) {
    throw new Error('ไม่สามารถลบ Event ที่มีผู้ลงทะเบียนแล้วได้')
  }

  // Delete schedules first
  const { error: scheduleError } = await supabase
    .from('event_schedules')
    .delete()
    .eq('event_id', id)

  if (scheduleError) {
    console.error('Error deleting event schedules:', scheduleError)
  }

  // Delete event
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting event:', error)
    throw error
  }
}

// ============================================
// EVENT SCHEDULES
// ============================================

// Get event schedules
export async function getEventSchedules(eventId: string): Promise<EventSchedule[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('event_schedules')
    .select('*')
    .eq('event_id', eventId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error getting event schedules:', error)
    throw error
  }

  return data || []
}

// Get single schedule
export async function getEventSchedule(id: string): Promise<EventSchedule | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('event_schedules')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting event schedule:', error)
    return null
  }

  return data
}

// Create event schedule
export async function createEventSchedule(
  scheduleData: Omit<InsertTables<'event_schedules'>, 'id' | 'attendees_by_branch'>
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('event_schedules')
    .insert({
      ...scheduleData,
      attendees_by_branch: {},
      status: 'available'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating event schedule:', error)
    throw error
  }

  return data.id
}

// Update event schedule
export async function updateEventSchedule(
  id: string,
  scheduleData: Partial<UpdateTables<'event_schedules'>>
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, ...updateData } = scheduleData as EventSchedule

  const { error } = await supabase
    .from('event_schedules')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating event schedule:', error)
    throw error
  }
}

// Delete event schedule
export async function deleteEventSchedule(id: string): Promise<void> {
  const supabase = createServiceClient()

  // Check if schedule has registrations
  const { count } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('schedule_id', id)
    .neq('status', 'cancelled')

  if (count && count > 0) {
    throw new Error('ไม่สามารถลบรอบที่มีผู้ลงทะเบียนแล้วได้')
  }

  const { error } = await supabase
    .from('event_schedules')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting event schedule:', error)
    throw error
  }
}

// Get available schedules
export async function getAvailableSchedules(eventId: string): Promise<EventSchedule[]> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('event_schedules')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'available')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error getting available schedules:', error)
    return []
  }

  return data || []
}

// ============================================
// EVENT REGISTRATIONS
// ============================================

// Get event registrations
export async function getEventRegistrations(
  eventId: string,
  options?: {
    scheduleId?: string
    branchId?: string
    status?: string
  }
): Promise<EventRegistration[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: false })

  if (options?.scheduleId) {
    query = query.eq('schedule_id', options.scheduleId)
  }

  if (options?.branchId) {
    query = query.eq('branch_id', options.branchId)
  }

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting event registrations:', error)
    throw error
  }

  return data || []
}

// Get registrations by schedule
export async function getScheduleRegistrations(scheduleId: string): Promise<EventRegistration[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('schedule_id', scheduleId)
    .neq('status', 'cancelled')
    .order('registered_at', { ascending: true })

  if (error) {
    console.error('Error getting schedule registrations:', error)
    return []
  }

  return data || []
}

// Get user's registrations
export async function getUserRegistrations(
  userId: string,
  isLineUserId: boolean = true
): Promise<EventRegistration[]> {
  const supabase = createServiceClient()
  const field = isLineUserId ? 'line_user_id' : 'parent_id'

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq(field, userId)
    .order('schedule_date', { ascending: false })

  if (error) {
    console.error('Error getting user registrations:', error)
    return []
  }

  return data || []
}

// Create event registration
export async function createEventRegistration(
  registrationData: Omit<InsertTables<'event_registrations'>, 'id' | 'registered_at' | 'status'>,
  event: Event
): Promise<string> {
  const supabase = createServiceClient()

  // Get schedule to check capacity
  const schedule = await getEventSchedule(registrationData.schedule_id)
  if (!schedule) {
    throw new Error('ไม่พบรอบเวลาที่เลือก')
  }

  // Calculate current attendees
  const attendeesByBranch = schedule.attendees_by_branch || {}
  const currentAttendees = Object.values(attendeesByBranch)
    .reduce((sum: number, count) => sum + (count as number), 0)

  if (currentAttendees >= schedule.max_attendees) {
    throw new Error('รอบนี้เต็มแล้ว')
  }

  // Calculate attendee count based on counting method
  let attendeeCount = 1
  if (event.counting_method === 'students') {
    attendeeCount = registrationData.students?.length || 1
  } else if (event.counting_method === 'parents') {
    attendeeCount = registrationData.parents?.length || 1
  }

  if (currentAttendees + attendeeCount > schedule.max_attendees) {
    throw new Error(`รอบนี้เหลือที่ว่างเพียง ${schedule.max_attendees - currentAttendees} ที่`)
  }

  // Create registration
  const { data, error } = await supabase
    .from('event_registrations')
    .insert({
      ...registrationData,
      attendee_count: attendeeCount,
      status: 'confirmed',
      registered_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating event registration:', error)
    throw error
  }

  // Update schedule attendee count
  const currentBranchCount = attendeesByBranch[registrationData.branch_id] || 0
  const newTotal = currentAttendees + attendeeCount

  await updateEventSchedule(registrationData.schedule_id, {
    attendees_by_branch: {
      ...attendeesByBranch,
      [registrationData.branch_id]: currentBranchCount + attendeeCount
    },
    status: newTotal >= schedule.max_attendees ? 'full' : 'available'
  })

  return data.id
}

// Cancel registration
export async function cancelEventRegistration(
  registrationId: string,
  reason: string,
  cancelledBy: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get registration
  const { data: registration, error: regError } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('id', registrationId)
    .single()

  if (regError || !registration) {
    throw new Error('ไม่พบข้อมูลการลงทะเบียน')
  }

  if (registration.status === 'cancelled') {
    throw new Error('การลงทะเบียนนี้ถูกยกเลิกแล้ว')
  }

  // Get schedule
  const schedule = await getEventSchedule(registration.schedule_id)
  if (!schedule) {
    throw new Error('ไม่พบข้อมูลรอบเวลา')
  }

  const attendeesByBranch = schedule.attendees_by_branch || {}
  const currentBranchCount = attendeesByBranch[registration.branch_id] || 0
  const newBranchCount = Math.max(0, currentBranchCount - registration.attendee_count)

  // Update registration
  const { error: updateError } = await supabase
    .from('event_registrations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
      cancellation_reason: reason
    })
    .eq('id', registrationId)

  if (updateError) {
    console.error('Error cancelling registration:', updateError)
    throw updateError
  }

  // Update schedule
  await updateEventSchedule(registration.schedule_id, {
    attendees_by_branch: {
      ...attendeesByBranch,
      [registration.branch_id]: newBranchCount
    },
    status: 'available'
  })
}

// Update attendance (bulk)
export async function updateEventAttendance(
  attendanceData: Array<{
    registrationId: string
    attended: boolean
    note?: string
  }>,
  checkedBy: string
): Promise<void> {
  const supabase = createServiceClient()

  for (const { registrationId, attended, note } of attendanceData) {
    const { error } = await supabase
      .from('event_registrations')
      .update({
        attended,
        attendance_checked_at: new Date().toISOString(),
        attendance_checked_by: checkedBy,
        attendance_note: note || null,
        status: attended ? 'attended' : 'no-show'
      })
      .eq('id', registrationId)

    if (error) {
      console.error('Error updating attendance:', error)
    }
  }
}

// ============================================
// UTILITIES
// ============================================

// Check if registration is open
export function isRegistrationOpen(event: Event): boolean {
  const now = new Date()
  const startDate = new Date(event.registration_start_date)
  const endDate = new Date(event.registration_end_date)

  return event.status === 'published' && now >= startDate && now <= endDate
}

// Get event statistics
export async function getEventStatistics(eventId: string) {
  const supabase = createServiceClient()

  const [event, schedules] = await Promise.all([
    getEvent(eventId),
    getEventSchedules(eventId)
  ])

  if (!event) {
    throw new Error('Event not found')
  }

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)

  const allRegs = registrations || []

  // Calculate stats
  const totalCapacity = schedules.reduce((sum, s) => sum + s.max_attendees, 0)
  const totalRegistered = allRegs.filter(r => r.status !== 'cancelled').length
  const totalAttended = allRegs.filter(r => r.status === 'attended').length
  const totalCancelled = allRegs.filter(r => r.status === 'cancelled').length

  // By branch
  const byBranch: Record<string, number> = {}
  allRegs
    .filter(r => r.status !== 'cancelled')
    .forEach(r => {
      byBranch[r.branch_id] = (byBranch[r.branch_id] || 0) + r.attendee_count
    })

  // By schedule
  const bySchedule = schedules.map(schedule => {
    const scheduleRegs = allRegs.filter(
      r => r.schedule_id === schedule.id && r.status !== 'cancelled'
    )

    return {
      scheduleId: schedule.id,
      date: schedule.date,
      startTime: schedule.start_time,
      maxAttendees: schedule.max_attendees,
      registered: scheduleRegs.reduce((sum, r) => sum + r.attendee_count, 0),
      attended: scheduleRegs.filter(r => r.status === 'attended').length
    }
  })

  return {
    totalCapacity,
    totalRegistered,
    totalAttended,
    totalCancelled,
    attendanceRate: totalRegistered > 0 ? (totalAttended / totalRegistered) * 100 : 0,
    byBranch,
    bySchedule
  }
}

// Get events for reminder
export async function getEventsForReminder(): Promise<Array<{
  event: Event
  registrations: EventRegistration[]
}>> {
  const supabase = createServiceClient()
  const results: Array<{ event: Event; registrations: EventRegistration[] }> = []

  // Get all active events with reminder enabled
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('enable_reminder', true)
    .eq('is_active', true)

  if (!events) return results

  for (const event of events) {
    // Get schedules for tomorrow (based on reminder days)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + (event.reminder_days_before || 1))
    const tomorrowString = tomorrow.toISOString().split('T')[0]

    const { data: schedules } = await supabase
      .from('event_schedules')
      .select('id')
      .eq('event_id', event.id)
      .eq('date', tomorrowString)

    if (!schedules || schedules.length === 0) continue

    const scheduleIds = schedules.map(s => s.id)

    // Get registrations for these schedules
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('*')
      .in('schedule_id', scheduleIds)
      .eq('status', 'confirmed')
      .not('line_user_id', 'is', null)

    if (registrations && registrations.length > 0) {
      results.push({ event, registrations })
    }
  }

  return results
}

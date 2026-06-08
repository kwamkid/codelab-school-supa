// lib/services/events.ts

import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';
import { Event, EventSchedule, EventRegistration } from '@/types/models';

// ==================== Database Row Interfaces ====================

interface EventRow {
  id: string;
  name: string;
  description: string;
  full_description: string | null;
  image_url: string | null;
  location: string;
  location_url: string | null;
  branch_ids: string[];
  event_type: string;
  highlights: string[] | null;
  target_audience: string | null;
  what_to_bring: string[] | null;
  registration_start_date: string;
  registration_end_date: string;
  counting_method: string;
  enable_reminder: boolean;
  reminder_days_before: number;
  reminder_time: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface EventScheduleRow {
  id: string;
  event_id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_attendees: number;
  max_attendees_by_branch: Record<string, number>;
  attendees_by_branch: Record<string, number>;
  status: string;
}

interface EventRegistrationRow {
  id: string;
  event_id: string;
  event_name: string;
  schedule_id: string;
  schedule_date: string;
  schedule_time: string;
  branch_id: string;
  is_guest: boolean;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  parent_id: string | null;
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  parent_address: string | null;
  parents: any[];
  students: any[];
  attendee_count: number;
  status: string;
  registered_at: string;
  registered_from: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  attended: boolean | null;
  attendance_checked_at: string | null;
  attendance_checked_by: string | null;
  attendance_note: string | null;
  special_request: string | null;
  referral_source: string | null;
}

// ==================== Mapping Functions ====================

function mapToEvent(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fullDescription: row.full_description || undefined,
    imageUrl: row.image_url || undefined,
    location: row.location,
    locationUrl: row.location_url || undefined,
    branchIds: row.branch_ids || [],
    eventType: row.event_type as Event['eventType'],
    highlights: row.highlights || undefined,
    targetAudience: row.target_audience || undefined,
    whatToBring: row.what_to_bring || undefined,
    registrationStartDate: new Date(row.registration_start_date),
    registrationEndDate: new Date(row.registration_end_date),
    countingMethod: row.counting_method as Event['countingMethod'],
    enableReminder: row.enable_reminder,
    reminderDaysBefore: row.reminder_days_before,
    reminderTime: row.reminder_time || undefined,
    status: row.status as Event['status'],
    viewCount: row.view_count || 0,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by || '',
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    updatedBy: row.updated_by || undefined,
  };
}

function mapToEventSchedule(row: EventScheduleRow): EventSchedule {
  return {
    id: row.id,
    eventId: row.event_id,
    date: new Date(row.date),
    startTime: row.start_time,
    endTime: row.end_time,
    maxAttendees: row.max_attendees,
    maxAttendeesByBranch: row.max_attendees_by_branch || {},
    attendeesByBranch: row.attendees_by_branch || {},
    status: row.status as EventSchedule['status'],
  };
}

function mapToEventRegistration(row: EventRegistrationRow): EventRegistration {
  return {
    id: row.id,
    eventId: row.event_id,
    eventName: row.event_name,
    scheduleId: row.schedule_id,
    scheduleDate: new Date(row.schedule_date),
    scheduleTime: row.schedule_time,
    branchId: row.branch_id,
    isGuest: row.is_guest,
    lineUserId: row.line_user_id || undefined,
    lineDisplayName: row.line_display_name || undefined,
    linePictureUrl: row.line_picture_url || undefined,
    parentId: row.parent_id || undefined,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    parentEmail: row.parent_email || undefined,
    parentAddress: row.parent_address || undefined,
    parents: row.parents || [],
    students: (row.students || []).map((s: any) => ({
      studentId: s.studentId,
      name: s.name,
      nickname: s.nickname,
      birthdate: s.birthdate ? new Date(s.birthdate) : new Date(),
      schoolName: s.schoolName,
      gradeLevel: s.gradeLevel,
    })),
    attendeeCount: row.attendee_count,
    status: row.status as EventRegistration['status'],
    registeredAt: new Date(row.registered_at),
    registeredFrom: row.registered_from as EventRegistration['registeredFrom'],
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    attended: row.attended || undefined,
    attendanceCheckedAt: row.attendance_checked_at ? new Date(row.attendance_checked_at) : undefined,
    attendanceCheckedBy: row.attendance_checked_by || undefined,
    attendanceNote: row.attendance_note || undefined,
    specialRequest: row.special_request || undefined,
    referralSource: row.referral_source || undefined,
  };
}

// ==================== Event CRUD Operations ====================

// Get all events
export async function getEvents(branchId?: string): Promise<Event[]> {
  try {
    const supabase = getClient();
    let query = supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (branchId) {
      // Filter by branch - use contains for array
      query = query.contains('branch_ids', [branchId]);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(mapToEvent);
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
}

// Get single event
export async function getEvent(id: string): Promise<Event | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? mapToEvent(data) : null;
  } catch (error) {
    console.error('Error getting event:', error);
    throw error;
  }
}

// Create new event
export async function createEvent(
  eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  try {
    const insertData = {
      name: eventData.name,
      description: eventData.description,
      full_description: eventData.fullDescription || null,
      image_url: eventData.imageUrl || null,
      location: eventData.location,
      location_url: eventData.locationUrl || null,
      branch_ids: eventData.branchIds || [],
      event_type: eventData.eventType,
      highlights: eventData.highlights || null,
      target_audience: eventData.targetAudience || null,
      what_to_bring: eventData.whatToBring || null,
      registration_start_date: eventData.registrationStartDate.toISOString(),
      registration_end_date: eventData.registrationEndDate.toISOString(),
      counting_method: eventData.countingMethod,
      enable_reminder: eventData.enableReminder ?? true,
      reminder_days_before: eventData.reminderDaysBefore || 1,
      reminder_time: eventData.reminderTime || null,
      status: eventData.status,
      is_active: true,
      created_by: userId,
    };

    const result = await adminMutation({
      table: 'events',
      operation: 'insert',
      data: insertData,
      options: { select: true, single: true }
    });
    return result.id;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

// Update event
export async function updateEvent(
  id: string,
  eventData: Partial<Event>,
  userId: string
): Promise<void> {
  try {
    const updateData: any = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    // Map camelCase to snake_case
    if (eventData.name !== undefined) updateData.name = eventData.name;
    if (eventData.description !== undefined) updateData.description = eventData.description;
    if (eventData.fullDescription !== undefined) updateData.full_description = eventData.fullDescription;
    if (eventData.imageUrl !== undefined) updateData.image_url = eventData.imageUrl;
    if (eventData.location !== undefined) updateData.location = eventData.location;
    if (eventData.locationUrl !== undefined) updateData.location_url = eventData.locationUrl;
    if (eventData.branchIds !== undefined) updateData.branch_ids = eventData.branchIds;
    if (eventData.eventType !== undefined) updateData.event_type = eventData.eventType;
    if (eventData.highlights !== undefined) updateData.highlights = eventData.highlights;
    if (eventData.targetAudience !== undefined) updateData.target_audience = eventData.targetAudience;
    if (eventData.whatToBring !== undefined) updateData.what_to_bring = eventData.whatToBring;
    if (eventData.registrationStartDate !== undefined) {
      updateData.registration_start_date = eventData.registrationStartDate.toISOString();
    }
    if (eventData.registrationEndDate !== undefined) {
      updateData.registration_end_date = eventData.registrationEndDate.toISOString();
    }
    if (eventData.countingMethod !== undefined) updateData.counting_method = eventData.countingMethod;
    if (eventData.enableReminder !== undefined) updateData.enable_reminder = eventData.enableReminder;
    if (eventData.reminderDaysBefore !== undefined) updateData.reminder_days_before = eventData.reminderDaysBefore;
    if (eventData.reminderTime !== undefined) updateData.reminder_time = eventData.reminderTime;
    if (eventData.status !== undefined) updateData.status = eventData.status;
    if (eventData.isActive !== undefined) updateData.is_active = eventData.isActive;

    await adminMutation({
      table: 'events',
      operation: 'update',
      data: updateData,
      match: { id }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
}

// Duplicate event - Copy event + schedules, force status to 'draft'
export async function duplicateEvent(
  eventId: string,
  userId: string
): Promise<string> {
  try {
    const [sourceEvent, sourceSchedules] = await Promise.all([
      getEvent(eventId),
      getEventSchedules(eventId),
    ]);

    if (!sourceEvent) {
      throw new Error('ไม่พบ Event ต้นฉบับ');
    }

    const newEventId = await createEvent(
      {
        name: `${sourceEvent.name} (สำเนา)`,
        description: sourceEvent.description,
        fullDescription: sourceEvent.fullDescription,
        imageUrl: sourceEvent.imageUrl,
        location: sourceEvent.location,
        locationUrl: sourceEvent.locationUrl,
        branchIds: sourceEvent.branchIds,
        eventType: sourceEvent.eventType,
        highlights: sourceEvent.highlights,
        targetAudience: sourceEvent.targetAudience,
        whatToBring: sourceEvent.whatToBring,
        registrationStartDate: sourceEvent.registrationStartDate,
        registrationEndDate: sourceEvent.registrationEndDate,
        countingMethod: sourceEvent.countingMethod,
        enableReminder: sourceEvent.enableReminder,
        reminderDaysBefore: sourceEvent.reminderDaysBefore,
        reminderTime: sourceEvent.reminderTime,
        status: 'draft',
        isActive: true,
        createdBy: userId,
      } as Omit<Event, 'id' | 'createdAt' | 'updatedAt'>,
      userId
    );

    if (sourceSchedules.length > 0) {
      await Promise.all(
        sourceSchedules.map((schedule) =>
          createEventSchedule({
            eventId: newEventId,
            date: schedule.date,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: schedule.maxAttendees,
            maxAttendeesByBranch: schedule.maxAttendeesByBranch,
            status: 'available',
          })
        )
      );
    }

    return newEventId;
  } catch (error) {
    console.error('Error duplicating event:', error);
    throw error;
  }
}

// Delete event - Uses API route to bypass RLS restrictions
export async function deleteEvent(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/admin/events/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete event');
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
}

// ==================== Event Schedule Operations ====================

// Get event schedules
export async function getEventSchedules(eventId: string): Promise<EventSchedule[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('event_schedules')
      .select('*')
      .eq('event_id', eventId)
      .order('date', { ascending: true });

    if (error) throw error;

    const schedules = (data || []).map(mapToEventSchedule);

    // Sort by date and then by startTime
    return schedules.sort((a, b) => {
      // First compare by date
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) {
        return dateCompare;
      }

      // If same date, compare by startTime
      const [aHours, aMinutes] = a.startTime.split(':').map(Number);
      const [bHours, bMinutes] = b.startTime.split(':').map(Number);

      const aTimeMinutes = aHours * 60 + aMinutes;
      const bTimeMinutes = bHours * 60 + bMinutes;

      return aTimeMinutes - bTimeMinutes;
    });
  } catch (error) {
    console.error('Error getting event schedules:', error);
    throw error;
  }
}

// Create event schedule
export async function createEventSchedule(
  scheduleData: Omit<EventSchedule, 'id' | 'attendeesByBranch'>
): Promise<string> {
  try {
    const insertData = {
      event_id: scheduleData.eventId,
      date: scheduleData.date.toISOString().split('T')[0], // DATE format
      start_time: scheduleData.startTime,
      end_time: scheduleData.endTime,
      max_attendees: scheduleData.maxAttendees,
      max_attendees_by_branch: (scheduleData as any).maxAttendeesByBranch || {},
      attendees_by_branch: {},
      status: 'available',
    };

    const result = await adminMutation({
      table: 'event_schedules',
      operation: 'insert',
      data: insertData,
      options: { select: true, single: true }
    });
    return result.id;
  } catch (error) {
    console.error('Error creating event schedule:', error);
    throw error;
  }
}

// Update event schedule
export async function updateEventSchedule(
  id: string,
  scheduleData: Partial<EventSchedule>
): Promise<void> {
  try {
    const updateData: any = {};

    if (scheduleData.date !== undefined) {
      updateData.date = scheduleData.date.toISOString().split('T')[0];
    }
    if (scheduleData.startTime !== undefined) updateData.start_time = scheduleData.startTime;
    if (scheduleData.endTime !== undefined) updateData.end_time = scheduleData.endTime;
    if (scheduleData.maxAttendees !== undefined) updateData.max_attendees = scheduleData.maxAttendees;
    if ((scheduleData as any).maxAttendeesByBranch !== undefined) updateData.max_attendees_by_branch = (scheduleData as any).maxAttendeesByBranch;
    if (scheduleData.attendeesByBranch !== undefined) updateData.attendees_by_branch = scheduleData.attendeesByBranch;
    if (scheduleData.status !== undefined) updateData.status = scheduleData.status;

    await adminMutation({
      table: 'event_schedules',
      operation: 'update',
      data: updateData,
      match: { id }
    });
  } catch (error) {
    console.error('Error updating event schedule:', error);
    throw error;
  }
}

// Delete event schedule
export async function deleteEventSchedule(id: string): Promise<void> {
  try {
    // Check if schedule has registrations
    const registrations = await getScheduleRegistrations(id);
    if (registrations.length > 0) {
      throw new Error('ไม่สามารถลบรอบที่มีผู้ลงทะเบียนแล้วได้');
    }

    await adminMutation({
      table: 'event_schedules',
      operation: 'delete',
      match: { id }
    });
  } catch (error) {
    console.error('Error deleting event schedule:', error);
    throw error;
  }
}

// ==================== Event Registration Operations ====================

// Get event registrations
export async function getEventRegistrations(
  eventId: string,
  options?: {
    scheduleId?: string;
    branchId?: string;
    status?: EventRegistration['status'];
  }
): Promise<EventRegistration[]> {
  try {
    const supabase = getClient();
    let query = supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId);

    // Add additional filters
    if (options?.scheduleId) {
      query = query.eq('schedule_id', options.scheduleId);
    }
    if (options?.branchId) {
      query = query.eq('branch_id', options.branchId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    query = query.order('registered_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(mapToEventRegistration);
  } catch (error) {
    console.error('Error getting event registrations:', error);
    throw error;
  }
}

// Get registrations by schedule
export async function getScheduleRegistrations(scheduleId: string): Promise<EventRegistration[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('schedule_id', scheduleId)
      .neq('status', 'cancelled');

    if (error) throw error;
    return (data || []).map(mapToEventRegistration);
  } catch (error) {
    console.error('Error getting schedule registrations:', error);
    throw error;
  }
}

// Get user's registrations
export async function getUserRegistrations(
  userId: string,
  isLineUserId: boolean = true
): Promise<EventRegistration[]> {
  try {
    const supabase = getClient();
    const field = isLineUserId ? 'line_user_id' : 'parent_id';

    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq(field, userId)
      .order('schedule_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapToEventRegistration);
  } catch (error) {
    console.error('Error getting user registrations:', error);
    throw error;
  }
}

// Create event registration
export async function createEventRegistration(
  registrationData: Omit<EventRegistration, 'id' | 'registeredAt' | 'status'>,
  event: Event
): Promise<string> {
  try {
    const supabase = getClient();

    // Get schedule to check capacity
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('event_schedules')
      .select('*')
      .eq('id', registrationData.scheduleId)
      .single();

    if (scheduleError) {
      if (scheduleError.code === 'PGRST116') {
        throw new Error('ไม่พบรอบเวลาที่เลือก');
      }
      throw scheduleError;
    }

    const schedule = mapToEventSchedule(scheduleData);

    // Calculate current attendees
    const currentAttendees = Object.values(schedule.attendeesByBranch || {})
      .reduce((sum, count) => sum + count, 0);

    // Check if full
    if (currentAttendees >= schedule.maxAttendees) {
      throw new Error('รอบนี้เต็มแล้ว');
    }

    // Calculate attendee count based on counting method
    let attendeeCount = 1; // default
    if (event.countingMethod === 'students') {
      attendeeCount = registrationData.students.length;
    } else if (event.countingMethod === 'parents') {
      attendeeCount = registrationData.parents.length;
    }

    // Check if will exceed capacity
    if (currentAttendees + attendeeCount > schedule.maxAttendees) {
      throw new Error(`รอบนี้เหลือที่ว่างเพียง ${schedule.maxAttendees - currentAttendees} ที่`);
    }

    console.log('[createEventRegistration] Creating registration with:', {
      scheduleId: registrationData.scheduleId,
      branchId: registrationData.branchId,
      attendeeCount,
      currentAttendees,
      maxAttendees: schedule.maxAttendees
    });

    // Prepare students data with proper date handling
    const studentsData = registrationData.students.map(s => ({
      studentId: s.studentId,
      name: s.name,
      nickname: s.nickname,
      birthdate: s.birthdate ? s.birthdate.toISOString() : null,
      schoolName: s.schoolName,
      gradeLevel: s.gradeLevel,
    }));

    // Create registration
    const insertData = {
      event_id: registrationData.eventId,
      event_name: registrationData.eventName,
      schedule_id: registrationData.scheduleId,
      schedule_date: registrationData.scheduleDate.toISOString().split('T')[0],
      schedule_time: registrationData.scheduleTime,
      branch_id: registrationData.branchId,
      is_guest: registrationData.isGuest,
      line_user_id: registrationData.lineUserId || null,
      line_display_name: registrationData.lineDisplayName || null,
      line_picture_url: registrationData.linePictureUrl || null,
      parent_id: registrationData.parentId || null,
      parent_name: registrationData.parentName,
      parent_phone: registrationData.parentPhone,
      parent_email: registrationData.parentEmail || null,
      parent_address: registrationData.parentAddress || null,
      parents: registrationData.parents,
      students: studentsData,
      attendee_count: attendeeCount,
      status: 'confirmed',
      registered_from: registrationData.registeredFrom,
      special_request: registrationData.specialRequest || null,
      referral_source: registrationData.referralSource || null,
    };

    const result = await adminMutation({
      table: 'event_registrations',
      operation: 'insert',
      data: insertData,
      options: { select: true, single: true }
    });

    // Update schedule attendee count
    const currentBranchCount = schedule.attendeesByBranch[registrationData.branchId] || 0;
    const newTotal = currentAttendees + attendeeCount;
    const updatedAttendeesByBranch = {
      ...schedule.attendeesByBranch,
      [registrationData.branchId]: currentBranchCount + attendeeCount,
    };

    const scheduleUpdateData = {
      attendees_by_branch: updatedAttendeesByBranch,
      status: newTotal >= schedule.maxAttendees ? 'full' : 'available',
    };

    console.log('[createEventRegistration] Updating schedule with:', scheduleUpdateData);

    await adminMutation({
      table: 'event_schedules',
      operation: 'update',
      data: scheduleUpdateData,
      match: { id: registrationData.scheduleId }
    });

    console.log('[createEventRegistration] Registration created successfully:', result.id);

    return result.id;
  } catch (error) {
    console.error('Error creating event registration:', error);
    throw error;
  }
}

// Update registration schedule and/or branch (admin only)
export async function updateRegistrationSchedule(
  registrationId: string,
  newScheduleId: string,
  newBranchId: string
): Promise<void> {
  try {
    const supabase = getClient();

    // Load registration
    const { data: regData, error: regError } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError) {
      if (regError.code === 'PGRST116') {
        throw new Error('ไม่พบข้อมูลการลงทะเบียน');
      }
      throw regError;
    }

    const registration = mapToEventRegistration(regData);

    if (registration.status === 'cancelled') {
      throw new Error('ไม่สามารถแก้ไขการลงทะเบียนที่ยกเลิกแล้ว');
    }

    const noScheduleChange = registration.scheduleId === newScheduleId;
    const noBranchChange = registration.branchId === newBranchId;
    if (noScheduleChange && noBranchChange) {
      return;
    }

    // Load new schedule
    const { data: newSchedData, error: newSchedError } = await supabase
      .from('event_schedules')
      .select('*')
      .eq('id', newScheduleId)
      .single();

    if (newSchedError) {
      if (newSchedError.code === 'PGRST116') {
        throw new Error('ไม่พบรอบเวลาที่เลือก');
      }
      throw newSchedError;
    }

    const newSchedule = mapToEventSchedule(newSchedData);
    const attendeeCount = registration.attendeeCount;

    // Compute current attendees in target schedule (excluding this registration if same schedule)
    const newBranchCurrent = newSchedule.attendeesByBranch[newBranchId] || 0;
    const totalCurrent = Object.values(newSchedule.attendeesByBranch).reduce(
      (sum, count) => sum + count,
      0
    );

    // Subtract this registration's count if it's already in the new schedule (same schedule, different branch only)
    const sameScheduleOldBranchCount =
      noScheduleChange && registration.branchId === newBranchId ? attendeeCount : 0;
    const sameScheduleOldBranchInOtherBranch =
      noScheduleChange && registration.branchId !== newBranchId ? attendeeCount : 0;

    const effectiveTotal = totalCurrent - (noScheduleChange ? attendeeCount : 0);
    const effectiveBranch = newBranchCurrent - sameScheduleOldBranchCount;

    // Capacity check: per-branch first, then total
    const mabb = (newSchedule as any).maxAttendeesByBranch as Record<string, number> | undefined;
    const branchMax = mabb && mabb[newBranchId];
    if (typeof branchMax === 'number' && branchMax > 0) {
      if (effectiveBranch + attendeeCount > branchMax) {
        throw new Error(
          `รอบนี้สาขาที่เลือกเหลือที่ว่างเพียง ${Math.max(0, branchMax - effectiveBranch)} ที่`
        );
      }
    }
    if (effectiveTotal + attendeeCount > newSchedule.maxAttendees) {
      throw new Error(
        `รอบนี้เหลือที่ว่างเพียง ${Math.max(0, newSchedule.maxAttendees - effectiveTotal)} ที่`
      );
    }

    // Update old schedule (decrement) — only if schedule actually changes
    if (!noScheduleChange) {
      const { data: oldSchedData, error: oldSchedError } = await supabase
        .from('event_schedules')
        .select('*')
        .eq('id', registration.scheduleId)
        .single();

      if (oldSchedError && oldSchedError.code !== 'PGRST116') throw oldSchedError;

      if (oldSchedData) {
        const oldSchedule = mapToEventSchedule(oldSchedData);
        const oldBranchCount = oldSchedule.attendeesByBranch[registration.branchId] || 0;
        const updatedOldByBranch = {
          ...oldSchedule.attendeesByBranch,
          [registration.branchId]: Math.max(0, oldBranchCount - attendeeCount),
        };
        await adminMutation({
          table: 'event_schedules',
          operation: 'update',
          data: {
            attendees_by_branch: updatedOldByBranch,
            status: 'available',
          },
          match: { id: registration.scheduleId },
        });
      }
    }

    // Update new schedule (increment) — handles both same-schedule branch swap and schedule change
    const updatedNewByBranch: Record<string, number> = { ...newSchedule.attendeesByBranch };
    if (noScheduleChange && registration.branchId !== newBranchId) {
      // Branch swap within same schedule: subtract from old branch, add to new branch
      const oldBranchInSame = updatedNewByBranch[registration.branchId] || 0;
      updatedNewByBranch[registration.branchId] = Math.max(0, oldBranchInSame - attendeeCount);
      updatedNewByBranch[newBranchId] = (updatedNewByBranch[newBranchId] || 0) + attendeeCount;
    } else if (!noScheduleChange) {
      updatedNewByBranch[newBranchId] = (updatedNewByBranch[newBranchId] || 0) + attendeeCount;
    }

    const newTotalAfter = Object.values(updatedNewByBranch).reduce((sum, count) => sum + count, 0);
    await adminMutation({
      table: 'event_schedules',
      operation: 'update',
      data: {
        attendees_by_branch: updatedNewByBranch,
        status: newTotalAfter >= newSchedule.maxAttendees ? 'full' : 'available',
      },
      match: { id: newScheduleId },
    });

    // Update registration row
    await adminMutation({
      table: 'event_registrations',
      operation: 'update',
      data: {
        schedule_id: newScheduleId,
        schedule_date: newSchedule.date.toISOString().split('T')[0],
        schedule_time: `${newSchedule.startTime}-${newSchedule.endTime}`,
        branch_id: newBranchId,
      },
      match: { id: registrationId },
    });
  } catch (error) {
    console.error('Error updating registration schedule:', error);
    throw error;
  }
}

// Cancel registration
export async function cancelEventRegistration(
  registrationId: string,
  reason: string,
  cancelledBy: string
): Promise<void> {
  try {
    const supabase = getClient();

    // Get registration
    const { data: regData, error: regError } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError) {
      if (regError.code === 'PGRST116') {
        throw new Error('ไม่พบข้อมูลการลงทะเบียน');
      }
      throw regError;
    }

    const registration = mapToEventRegistration(regData);

    if (registration.status === 'cancelled') {
      throw new Error('การลงทะเบียนนี้ถูกยกเลิกแล้ว');
    }

    console.log('[cancelEventRegistration] Cancelling registration:', {
      registrationId,
      scheduleId: registration.scheduleId,
      branchId: registration.branchId,
      attendeeCount: registration.attendeeCount
    });

    // Get current schedule data
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('event_schedules')
      .select('*')
      .eq('id', registration.scheduleId)
      .single();

    if (scheduleError) {
      if (scheduleError.code === 'PGRST116') {
        throw new Error('ไม่พบข้อมูลรอบเวลา');
      }
      throw scheduleError;
    }

    const schedule = mapToEventSchedule(scheduleData);
    const currentBranchCount = schedule.attendeesByBranch[registration.branchId] || 0;
    const newBranchCount = Math.max(0, currentBranchCount - registration.attendeeCount); // Prevent negative

    console.log('[cancelEventRegistration] Current branch count:', currentBranchCount, 'New count:', newBranchCount);

    // Update registration
    await adminMutation({
      table: 'event_registrations',
      operation: 'update',
      data: {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
      },
      match: { id: registrationId }
    });

    // Update schedule attendee count
    const updatedAttendeesByBranch = {
      ...schedule.attendeesByBranch,
      [registration.branchId]: newBranchCount,
    };

    const scheduleUpdateData = {
      attendees_by_branch: updatedAttendeesByBranch,
      status: 'available', // Always available after cancellation
    };

    await adminMutation({
      table: 'event_schedules',
      operation: 'update',
      data: scheduleUpdateData,
      match: { id: registration.scheduleId }
    });

    console.log('[cancelEventRegistration] Cancellation completed');
  } catch (error) {
    console.error('Error cancelling registration:', error);
    throw error;
  }
}

// Update attendance (bulk)
export async function updateEventAttendance(
  attendanceData: Array<{
    registrationId: string;
    attended: boolean;
    note?: string;
  }>,
  checkedBy: string
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const updates = attendanceData.map(({ registrationId, attended, note }) => {
      return adminMutation({
        table: 'event_registrations',
        operation: 'update',
        data: {
          attended,
          attendance_checked_at: now,
          attendance_checked_by: checkedBy,
          attendance_note: note || null,
          status: attended ? 'attended' : 'no-show',
        },
        match: { id: registrationId }
      });
    });

    await Promise.all(updates);
  } catch (error) {
    console.error('Error updating attendance:', error);
    throw error;
  }
}

// ==================== Event Utilities ====================

// Check if registration is open
export function isRegistrationOpen(event: Event): boolean {
  const now = new Date();
  return event.status === 'published' &&
         now >= event.registrationStartDate &&
         now <= event.registrationEndDate;
}

// Get available schedules
export async function getAvailableSchedules(eventId: string): Promise<EventSchedule[]> {
  const schedules = await getEventSchedules(eventId); // Already sorted by date and time
  const now = new Date();

  return schedules.filter(schedule => {
    const scheduleDateTime = new Date(schedule.date);
    const [hours, minutes] = schedule.startTime.split(':');
    scheduleDateTime.setHours(parseInt(hours), parseInt(minutes));

    return schedule.status === 'available' && scheduleDateTime > now;
  });
  // No need to sort again since getEventSchedules already returns sorted results
}

// Get event statistics
export async function getEventStatistics(eventId: string) {
  try {
    const [event, schedules, registrations] = await Promise.all([
      getEvent(eventId),
      getEventSchedules(eventId),
      getEventRegistrations(eventId)
    ]);

    if (!event) {
      throw new Error('Event not found');
    }

    // Calculate stats
    const totalCapacity = schedules.reduce((sum, s) => sum + s.maxAttendees, 0);
    const totalRegistered = registrations.filter(r => r.status !== 'cancelled').length;
    const totalAttended = registrations.filter(r => r.status === 'attended').length;
    const totalCancelled = registrations.filter(r => r.status === 'cancelled').length;

    // By branch
    const byBranch: Record<string, number> = {};
    registrations
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        byBranch[r.branchId] = (byBranch[r.branchId] || 0) + r.attendeeCount;
      });

    // By schedule
    const bySchedule = schedules.map(schedule => {
      const scheduleRegs = registrations.filter(
        r => r.scheduleId === schedule.id && r.status !== 'cancelled'
      );

      return {
        scheduleId: schedule.id,
        date: schedule.date,
        startTime: schedule.startTime,
        maxAttendees: schedule.maxAttendees,
        registered: scheduleRegs.reduce((sum, r) => sum + r.attendeeCount, 0),
        attended: scheduleRegs.filter(r => r.status === 'attended').length
      };
    });

    return {
      totalCapacity,
      totalRegistered,
      totalAttended,
      totalCancelled,
      attendanceRate: totalRegistered > 0 ? (totalAttended / totalRegistered) * 100 : 0,
      byBranch,
      bySchedule
    };
  } catch (error) {
    console.error('Error getting event statistics:', error);
    throw error;
  }
}

// ==================== Event Reminder Functions ====================

// Get events for reminder
export async function getEventsForReminder(): Promise<Array<{
  event: Event;
  registrations: EventRegistration[];
}>> {
  try {
    const supabase = getClient();

    // Get all active events with reminder enabled
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .eq('enable_reminder', true)
      .eq('is_active', true);

    if (eventsError) throw eventsError;

    const events = (eventsData || []).map(mapToEvent);
    const results = [];

    for (const event of events) {
      // Get all schedules for this event
      const schedules = await getEventSchedules(event.id);

      // Check which schedules need reminders
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + (event.reminderDaysBefore || 1));
      tomorrow.setHours(0, 0, 0, 0);

      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);

      const schedulesToRemind = schedules.filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= tomorrow && scheduleDate <= endOfTomorrow;
      });

      if (schedulesToRemind.length > 0) {
        // Get registrations for these schedules
        const registrations = [];
        for (const schedule of schedulesToRemind) {
          const scheduleRegs = await getScheduleRegistrations(schedule.id);
          registrations.push(...scheduleRegs);
        }

        // Filter only confirmed registrations with LINE ID
        const confirmedWithLine = registrations.filter(
          r => r.status === 'confirmed' && r.lineUserId
        );

        if (confirmedWithLine.length > 0) {
          results.push({ event, registrations: confirmedWithLine });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error getting events for reminder:', error);
    throw error;
  }
}

// NOTE: Event reminders are sent server-side by lib/supabase/services/events.ts
// (used by app/api/cron/reminders). The former duplicate here imported the deleted
// client Firebase notifier (./line-notifications) and broke the build, so it was removed.

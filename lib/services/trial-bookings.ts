// lib/services/trial-bookings.ts

import { getClient } from '@/lib/supabase/client';
import { TrialBooking, TrialSession } from '@/types/models';
import { checkParentPhoneExists } from './parents';

// ==================== Trial Bookings ====================

// Get all trial bookings
export async function getTrialBookings(branchId?: string | null): Promise<TrialBooking[]> {
  try {
    const supabase = getClient();

    let query = supabase
      .from('trial_bookings')
      .select(`
        *,
        trial_booking_students (
          id,
          name,
          school_name,
          grade_level,
          birthdate,
          subject_interests
        )
      `)
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(booking => ({
      id: booking.id,
      source: booking.source,
      parentName: booking.parent_name,
      parentPhone: booking.parent_phone,
      parentEmail: booking.parent_email,
      students: (booking.trial_booking_students || []).map((s: any) => ({
        name: s.name,
        schoolName: s.school_name,
        gradeLevel: s.grade_level,
        birthdate: s.birthdate ? new Date(s.birthdate) : undefined,
        subjectInterests: s.subject_interests || []
      })),
      branchId: booking.branch_id,
      status: booking.status,
      assignedTo: booking.assigned_to,
      contactedAt: booking.contacted_at ? new Date(booking.contacted_at) : undefined,
      contactNote: booking.contact_note,
      createdAt: new Date(booking.created_at),
      updatedAt: booking.updated_at ? new Date(booking.updated_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting trial bookings:', error);
    throw error;
  }
}

// Get trial bookings by status
export async function getTrialBookingsByStatus(status: TrialBooking['status']): Promise<TrialBooking[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('trial_bookings')
      .select(`
        *,
        trial_booking_students (
          id,
          name,
          school_name,
          grade_level,
          birthdate,
          subject_interests
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(booking => ({
      id: booking.id,
      source: booking.source,
      parentName: booking.parent_name,
      parentPhone: booking.parent_phone,
      parentEmail: booking.parent_email,
      students: (booking.trial_booking_students || []).map((s: any) => ({
        name: s.name,
        schoolName: s.school_name,
        gradeLevel: s.grade_level,
        birthdate: s.birthdate ? new Date(s.birthdate) : undefined,
        subjectInterests: s.subject_interests || []
      })),
      branchId: booking.branch_id,
      status: booking.status,
      assignedTo: booking.assigned_to,
      contactedAt: booking.contacted_at ? new Date(booking.contacted_at) : undefined,
      contactNote: booking.contact_note,
      createdAt: new Date(booking.created_at),
      updatedAt: booking.updated_at ? new Date(booking.updated_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting trial bookings by status:', error);
    throw error;
  }
}

// Get single trial booking
export async function getTrialBooking(id: string): Promise<TrialBooking | null> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('trial_bookings')
      .select(`
        *,
        trial_booking_students (
          id,
          name,
          school_name,
          grade_level,
          birthdate,
          subject_interests
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      source: data.source,
      parentName: data.parent_name,
      parentPhone: data.parent_phone,
      parentEmail: data.parent_email,
      students: (data.trial_booking_students || []).map((s: any) => ({
        name: s.name,
        schoolName: s.school_name,
        gradeLevel: s.grade_level,
        birthdate: s.birthdate ? new Date(s.birthdate) : undefined,
        subjectInterests: s.subject_interests || []
      })),
      branchId: data.branch_id,
      status: data.status,
      assignedTo: data.assigned_to,
      contactedAt: data.contacted_at ? new Date(data.contacted_at) : undefined,
      contactNote: data.contact_note,
      createdAt: new Date(data.created_at),
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  } catch (error) {
    console.error('Error getting trial booking:', error);
    throw error;
  }
}

// Create trial booking
export async function createTrialBooking(
  data: Omit<TrialBooking, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const supabase = getClient();

    // Create the booking first
    const bookingData: any = {
      source: data.source || 'online',
      parent_name: data.parentName,
      parent_phone: data.parentPhone,
      parent_email: data.parentEmail,
      branch_id: data.branchId,
      status: data.status || 'new',
      assigned_to: data.assignedTo,
      contact_note: data.contactNote,
    };

    const { data: booking, error: bookingError } = await supabase
      .from('trial_bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Create student records
    if (data.students && data.students.length > 0) {
      const studentsData = data.students.map(student => ({
        booking_id: booking.id,
        name: student.name,
        school_name: student.schoolName,
        grade_level: student.gradeLevel,
        birthdate: student.birthdate ? student.birthdate.toISOString().split('T')[0] : null,
        subject_interests: student.subjectInterests || []
      }));

      const { error: studentsError } = await supabase
        .from('trial_booking_students')
        .insert(studentsData);

      if (studentsError) throw studentsError;
    }

    return booking.id;
  } catch (error) {
    console.error('Error creating trial booking:', error);
    throw error;
  }
}

// Update trial booking
export async function updateTrialBooking(
  id: string,
  data: Partial<TrialBooking>
): Promise<void> {
  try {
    const supabase = getClient();

    // Prepare update data
    const updateData: any = {};

    if (data.source !== undefined) updateData.source = data.source;
    if (data.parentName !== undefined) updateData.parent_name = data.parentName;
    if (data.parentPhone !== undefined) updateData.parent_phone = data.parentPhone;
    if (data.parentEmail !== undefined) updateData.parent_email = data.parentEmail;
    if (data.branchId !== undefined) updateData.branch_id = data.branchId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.assignedTo !== undefined) updateData.assigned_to = data.assignedTo;
    if (data.contactedAt !== undefined) updateData.contacted_at = data.contactedAt?.toISOString();
    if (data.contactNote !== undefined) updateData.contact_note = data.contactNote;

    // Update booking
    const { error: bookingError } = await supabase
      .from('trial_bookings')
      .update(updateData)
      .eq('id', id);

    if (bookingError) throw bookingError;

    // Update students if provided
    if (data.students) {
      // Delete existing students
      await supabase
        .from('trial_booking_students')
        .delete()
        .eq('booking_id', id);

      // Insert new students
      if (data.students.length > 0) {
        const studentsData = data.students.map(student => ({
          booking_id: id,
          name: student.name,
          school_name: student.schoolName,
          grade_level: student.gradeLevel,
          birthdate: student.birthdate ? student.birthdate.toISOString().split('T')[0] : null,
          subject_interests: student.subjectInterests || []
        }));

        const { error: studentsError } = await supabase
          .from('trial_booking_students')
          .insert(studentsData);

        if (studentsError) throw studentsError;
      }
    }
  } catch (error) {
    console.error('Error updating trial booking:', error);
    throw error;
  }
}

// Update booking branch (สำหรับแก้ record เก่าที่ไม่มีสาขา)
export async function updateBookingBranch(
  id: string,
  branchId: string
): Promise<void> {
  try {
    const supabase = getClient();

    const { error } = await supabase
      .from('trial_bookings')
      .update({ branch_id: branchId })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating booking branch:', error);
    throw error;
  }
}

// Update booking status
export async function updateBookingStatus(
  id: string,
  status: TrialBooking['status'],
  note?: string
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = { status };

    if (status === 'contacted') {
      updateData.contacted_at = new Date().toISOString();
    }

    if (note) {
      updateData.contact_note = note;
    }

    const { error } = await supabase
      .from('trial_bookings')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

// Cancel trial booking
export async function cancelTrialBooking(
  id: string,
  reason?: string
): Promise<void> {
  try {
    const supabase = getClient();

    // Get booking first to check if it can be cancelled
    const booking = await getTrialBooking(id);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    if (booking.status === 'converted') {
      throw new Error('Cannot cancel converted booking');
    }

    // Update booking status to cancelled
    const updateData: any = { status: 'cancelled' };

    if (reason) {
      updateData.contact_note = reason;
    }

    const { error: bookingError } = await supabase
      .from('trial_bookings')
      .update(updateData)
      .eq('id', id);

    if (bookingError) throw bookingError;

    // Cancel all associated trial sessions
    const sessions = await getTrialSessionsByBooking(id);

    for (const session of sessions) {
      if (session.status === 'scheduled') {
        const { error: sessionError } = await supabase
          .from('trial_sessions')
          .update({
            status: 'cancelled',
            feedback: reason || 'ยกเลิกการจอง'
          })
          .eq('id', session.id);

        if (sessionError) throw sessionError;
      }
    }
  } catch (error) {
    console.error('Error cancelling trial booking:', error);
    throw error;
  }
}

// ==================== Trial Sessions ====================

// Get all trial sessions
export async function getTrialSessions(branchId?: string | null): Promise<TrialSession[]> {
  try {
    const supabase = getClient();

    let query = supabase
      .from('trial_sessions')
      .select('*')
      .order('scheduled_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get reschedule history for all sessions
    const sessionIds = (data || []).map(s => s.id);
    let rescheduleHistories: any = {};

    if (sessionIds.length > 0) {
      const { data: histories, error: historyError } = await supabase
        .from('trial_reschedule_history')
        .select('*')
        .in('session_id', sessionIds)
        .order('rescheduled_at', { ascending: true });

      if (!historyError && histories) {
        // Group by session_id
        histories.forEach((h: any) => {
          if (!rescheduleHistories[h.session_id]) {
            rescheduleHistories[h.session_id] = [];
          }
          rescheduleHistories[h.session_id].push({
            originalDate: new Date(h.original_date),
            originalTime: h.original_time,
            newDate: new Date(h.new_date),
            newTime: h.new_time,
            reason: h.reason,
            rescheduledBy: h.rescheduled_by,
            rescheduledAt: new Date(h.rescheduled_at)
          });
        });
      }
    }

    return (data || []).map(session => ({
      id: session.id,
      bookingId: session.booking_id,
      studentName: session.student_name,
      subjectId: session.subject_id,
      branchId: session.branch_id,
      scheduledDate: new Date(session.scheduled_date),
      startTime: session.start_time,
      endTime: session.end_time,
      teacherId: session.teacher_id,
      roomId: session.room_id,
      roomName: session.room_name,
      status: session.status,
      attended: session.attended,
      feedback: session.feedback,
      interestedLevel: session.interested_level,
      teacherNote: session.teacher_note,
      converted: session.converted,
      convertedToClassId: session.converted_to_class_id,
      conversionNote: session.conversion_note,
      rescheduleHistory: rescheduleHistories[session.id] || [],
      createdAt: new Date(session.created_at),
      completedAt: session.completed_at ? new Date(session.completed_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting trial sessions:', error);
    throw error;
  }
}

// Get trial sessions by booking
export async function getTrialSessionsByBooking(bookingId: string): Promise<TrialSession[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('trial_sessions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    // Get reschedule history for all sessions
    const sessionIds = (data || []).map(s => s.id);
    let rescheduleHistories: any = {};

    if (sessionIds.length > 0) {
      const { data: histories, error: historyError } = await supabase
        .from('trial_reschedule_history')
        .select('*')
        .in('session_id', sessionIds)
        .order('rescheduled_at', { ascending: true });

      if (!historyError && histories) {
        // Group by session_id
        histories.forEach((h: any) => {
          if (!rescheduleHistories[h.session_id]) {
            rescheduleHistories[h.session_id] = [];
          }
          rescheduleHistories[h.session_id].push({
            originalDate: new Date(h.original_date),
            originalTime: h.original_time,
            newDate: new Date(h.new_date),
            newTime: h.new_time,
            reason: h.reason,
            rescheduledBy: h.rescheduled_by,
            rescheduledAt: new Date(h.rescheduled_at)
          });
        });
      }
    }

    return (data || []).map(session => ({
      id: session.id,
      bookingId: session.booking_id,
      studentName: session.student_name,
      subjectId: session.subject_id,
      branchId: session.branch_id,
      scheduledDate: new Date(session.scheduled_date),
      startTime: session.start_time,
      endTime: session.end_time,
      teacherId: session.teacher_id,
      roomId: session.room_id,
      roomName: session.room_name,
      status: session.status,
      attended: session.attended,
      feedback: session.feedback,
      interestedLevel: session.interested_level,
      teacherNote: session.teacher_note,
      converted: session.converted,
      convertedToClassId: session.converted_to_class_id,
      conversionNote: session.conversion_note,
      rescheduleHistory: rescheduleHistories[session.id] || [],
      createdAt: new Date(session.created_at),
      completedAt: session.completed_at ? new Date(session.completed_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting trial sessions by booking:', error);
    throw error;
  }
}

// Get single trial session
export async function getTrialSession(id: string): Promise<TrialSession | null> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('trial_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    // Get reschedule history
    const { data: histories } = await supabase
      .from('trial_reschedule_history')
      .select('*')
      .eq('session_id', id)
      .order('rescheduled_at', { ascending: true });

    const rescheduleHistory = (histories || []).map((h: any) => ({
      originalDate: new Date(h.original_date),
      originalTime: h.original_time,
      newDate: new Date(h.new_date),
      newTime: h.new_time,
      reason: h.reason,
      rescheduledBy: h.rescheduled_by,
      rescheduledAt: new Date(h.rescheduled_at)
    }));

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
      rescheduleHistory,
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
  } catch (error) {
    console.error('Error getting trial session:', error);
    throw error;
  }
}

// Create trial session
export async function createTrialSession(
  data: Omit<TrialSession, 'id' | 'createdAt'>
): Promise<string> {
  try {
    const supabase = getClient();

    const sessionData = {
      booking_id: data.bookingId,
      student_name: data.studentName,
      subject_id: data.subjectId,
      scheduled_date: data.scheduledDate.toISOString().split('T')[0],
      start_time: data.startTime,
      end_time: data.endTime,
      teacher_id: data.teacherId,
      branch_id: data.branchId,
      room_id: data.roomId,
      room_name: data.roomName,
      status: data.status || 'scheduled',
      attended: data.attended,
      feedback: data.feedback,
      teacher_note: data.teacherNote,
      interested_level: data.interestedLevel,
      converted: data.converted,
      converted_to_class_id: data.convertedToClassId,
      conversion_note: data.conversionNote,
      completed_at: data.completedAt?.toISOString(),
    };

    const { data: session, error } = await supabase
      .from('trial_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) throw error;

    // Update booking status to scheduled if needed
    const booking = await getTrialBooking(data.bookingId);
    if (booking && booking.status === 'new') {
      await updateBookingStatus(data.bookingId, 'scheduled');
    }

    return session.id;
  } catch (error) {
    console.error('Error creating trial session:', error);
    throw error;
  }
}

// Update trial session
export async function updateTrialSession(
  id: string,
  data: Partial<TrialSession>
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    if (data.studentName !== undefined) updateData.student_name = data.studentName;
    if (data.subjectId !== undefined) updateData.subject_id = data.subjectId;
    if (data.scheduledDate !== undefined) updateData.scheduled_date = data.scheduledDate.toISOString().split('T')[0];
    if (data.startTime !== undefined) updateData.start_time = data.startTime;
    if (data.endTime !== undefined) updateData.end_time = data.endTime;
    if (data.teacherId !== undefined) updateData.teacher_id = data.teacherId;
    if (data.branchId !== undefined) updateData.branch_id = data.branchId;
    if (data.roomId !== undefined) updateData.room_id = data.roomId;
    if (data.roomName !== undefined) updateData.room_name = data.roomName;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.attended !== undefined) updateData.attended = data.attended;
    if (data.feedback !== undefined) updateData.feedback = data.feedback;
    if (data.teacherNote !== undefined) updateData.teacher_note = data.teacherNote;
    if (data.interestedLevel !== undefined) updateData.interested_level = data.interestedLevel;
    if (data.converted !== undefined) updateData.converted = data.converted;
    if (data.convertedToClassId !== undefined) updateData.converted_to_class_id = data.convertedToClassId;
    if (data.conversionNote !== undefined) updateData.conversion_note = data.conversionNote;
    if (data.completedAt !== undefined) updateData.completed_at = data.completedAt?.toISOString();

    if (data.status === 'attended' || data.status === 'absent') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('trial_sessions')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    // Auto-update booking status based on all sessions
    if (data.status === 'attended' || data.status === 'absent' || data.status === 'cancelled') {
      const session = await getTrialSession(id);
      if (session) {
        await checkAndUpdateBookingStatus(session.bookingId);
      }
    }
  } catch (error) {
    console.error('Error updating trial session:', error);
    throw error;
  }
}

// Helper function to check and update booking status
async function checkAndUpdateBookingStatus(bookingId: string): Promise<void> {
  try {
    const [booking, sessions] = await Promise.all([
      getTrialBooking(bookingId),
      getTrialSessionsByBooking(bookingId)
    ]);

    if (!booking || sessions.length === 0) return;

    // Check if any session has been converted
    const hasConverted = sessions.some(s => s.converted);
    if (hasConverted && booking.status !== 'converted') {
      await updateBookingStatus(bookingId, 'converted');
      return;
    }

    // Check if all sessions are completed (attended, absent, cancelled, or converted)
    const allCompleted = sessions.every(s =>
      s.status === 'attended' ||
      s.status === 'absent' ||
      s.status === 'cancelled' ||
      s.converted
    );

    // Check if at least one session was attended
    const hasAttended = sessions.some(s => s.status === 'attended');

    if (allCompleted && hasAttended && booking.status !== 'completed' && booking.status !== 'converted') {
      await updateBookingStatus(bookingId, 'completed');
    }
  } catch (error) {
    console.error('Error checking and updating booking status:', error);
  }
}

// Cancel trial session
export async function cancelTrialSession(id: string, reason?: string): Promise<void> {
  try {
    await updateTrialSession(id, {
      status: 'cancelled',
      feedback: reason,
    });
  } catch (error) {
    console.error('Error cancelling trial session:', error);
    throw error;
  }
}

// Delete trial session
export async function deleteTrialSession(id: string): Promise<void> {
  try {
    const supabase = getClient();

    const { error } = await supabase
      .from('trial_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting trial session:', error);
    throw error;
  }
}

// Reschedule trial session with history tracking
export async function rescheduleTrialSession(
  sessionId: string,
  newSchedule: {
    scheduledDate: Date;
    startTime: string;
    endTime: string;
    teacherId: string;
    branchId: string;
    roomId: string;
    roomName?: string;
  },
  reason?: string,
  rescheduledBy: string = 'admin'
): Promise<void> {
  try {
    const supabase = getClient();

    // Get current session data
    const currentSession = await getTrialSession(sessionId);
    if (!currentSession) {
      throw new Error('Trial session not found');
    }

    // Create reschedule history entry
    const historyEntry = {
      session_id: sessionId,
      original_date: currentSession.scheduledDate.toISOString().split('T')[0],
      original_time: currentSession.startTime,
      new_date: newSchedule.scheduledDate.toISOString().split('T')[0],
      new_time: newSchedule.startTime,
      reason: reason || 'ไม่มาเรียนตามนัด',
      rescheduled_by: rescheduledBy,
    };

    const { error: historyError } = await supabase
      .from('trial_reschedule_history')
      .insert(historyEntry);

    if (historyError) throw historyError;

    // Update the session
    const updateData: any = {
      scheduled_date: newSchedule.scheduledDate.toISOString().split('T')[0],
      start_time: newSchedule.startTime,
      end_time: newSchedule.endTime,
      teacher_id: newSchedule.teacherId,
      branch_id: newSchedule.branchId,
      room_id: newSchedule.roomId,
      room_name: newSchedule.roomName,
      status: 'scheduled',
      attended: false,
      feedback: null,
      teacher_note: null,
      interested_level: null,
    };

    const { error: updateError } = await supabase
      .from('trial_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Also update booking status back to scheduled if needed
    const booking = await getTrialBooking(currentSession.bookingId);
    if (booking && booking.status === 'completed') {
      await updateBookingStatus(currentSession.bookingId, 'scheduled');
    }
  } catch (error) {
    console.error('Error rescheduling trial session:', error);
    throw error;
  }
}

// Check room availability for trial with comprehensive checks
export async function checkTrialRoomAvailability(
  branchId: string,
  roomId: string,
  date: Date,
  startTime: string,
  endTime: string,
  teacherId: string,
  excludeSessionId?: string
): Promise<{
  available: boolean;
  conflicts?: Array<{
    type: 'holiday' | 'room_conflict' | 'teacher_conflict';
    message: string;
    details?: any;
  }>;
}> {
  try {
    // Use centralized availability checker
    const { checkAvailability } = await import('../utils/availability');

    const result = await checkAvailability({
      date,
      startTime,
      endTime,
      branchId,
      roomId,
      teacherId,
      excludeId: excludeSessionId,
      excludeType: 'trial'
    });

    return {
      available: result.available,
      conflicts: result.available ? undefined : result.reasons
    };
  } catch (error) {
    console.error('Error checking room availability:', error);
    return {
      available: false,
      conflicts: [{
        type: 'room_conflict',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ'
      }]
    };
  }
}

// Convert trial to enrollment with enhanced data
export async function convertTrialToEnrollment(
  bookingId: string,
  sessionId: string,
  conversionData: {
    // Parent info
    useExistingParent?: boolean;
    existingParentId?: string;
    parentName: string;
    parentPhone: string;
    parentEmail?: string;
    emergencyPhone?: string;
    address?: {
      houseNumber: string;
      street?: string;
      subDistrict: string;
      district: string;
      province: string;
      postalCode: string;
    };

    // Student info
    useExistingStudent?: boolean;
    existingStudentId?: string;
    studentName?: string;
    studentNickname?: string;
    studentBirthdate?: Date;
    studentGender?: 'M' | 'F';
    studentSchoolName?: string;
    studentGradeLevel?: string;
    studentAllergies?: string;
    studentSpecialNeeds?: string;
    emergencyContact?: string;
    emergencyContactPhone?: string;

    // Class and pricing
    classId: string;
    pricing: {
      originalPrice: number;
      discount: number;
      discountType: 'percentage' | 'fixed';
      finalPrice: number;
      promotionCode?: string;
    };
  }
): Promise<{
  parentId: string;
  studentId: string;
  enrollmentId: string;
}> {
  try {
    // Get booking and session data
    const [booking, session] = await Promise.all([
      getTrialBooking(bookingId),
      getTrialSession(sessionId),
    ]);

    if (!booking || !session) {
      throw new Error('Booking or session not found');
    }

    // Import required services
    const { createParent, createStudent } = await import('./parents');
    const { createEnrollment, checkDuplicateEnrollment, checkAvailableSeats } = await import('./enrollments');
    const { getClass } = await import('./classes');

    let parentId: string;
    let studentId: string;

    // Handle parent
    if (conversionData.useExistingParent && conversionData.existingParentId) {
      parentId = conversionData.existingParentId;
    } else {
      // Create new parent
      const parentData: any = {
        displayName: conversionData.parentName,
        phone: conversionData.parentPhone,
        email: conversionData.parentEmail,
        preferredBranchId: session.branchId,
      };

      if (conversionData.emergencyPhone) {
        parentData.emergencyPhone = conversionData.emergencyPhone;
      }

      if (conversionData.address) {
        parentData.address = conversionData.address;
      }

      parentId = await createParent(parentData);
    }

    // Handle student
    if (conversionData.useExistingStudent && conversionData.existingStudentId) {
      studentId = conversionData.existingStudentId;
    } else {
      // Create new student
      if (!conversionData.studentName || !conversionData.studentNickname || !conversionData.studentBirthdate || !conversionData.studentGender) {
        throw new Error('Missing required student information');
      }

      studentId = await createStudent(parentId, {
        name: conversionData.studentName,
        nickname: conversionData.studentNickname,
        birthdate: conversionData.studentBirthdate,
        gender: conversionData.studentGender,
        schoolName: conversionData.studentSchoolName,
        gradeLevel: conversionData.studentGradeLevel,
        allergies: conversionData.studentAllergies,
        specialNeeds: conversionData.studentSpecialNeeds,
        emergencyContact: conversionData.emergencyContact,
        emergencyPhone: conversionData.emergencyContactPhone,
        isActive: true,
      });
    }

    // Check for duplicate enrollment
    const isDuplicate = await checkDuplicateEnrollment(studentId, conversionData.classId);
    if (isDuplicate) {
      throw new Error('นักเรียนได้ลงทะเบียนในคลาสนี้แล้ว');
    }

    // Check available seats
    const seatsInfo = await checkAvailableSeats(conversionData.classId);
    if (!seatsInfo.available) {
      throw new Error(`คลาสเต็มแล้ว (${seatsInfo.currentEnrolled}/${seatsInfo.maxStudents})`);
    }

    // Get class data for branch ID
    const classData = await getClass(conversionData.classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    // Create enrollment
    const enrollmentId = await createEnrollment({
      studentId,
      classId: conversionData.classId,
      parentId,
      branchId: classData.branchId,
      status: 'active',
      pricing: conversionData.pricing,
      payment: {
        method: 'cash',
        status: 'pending',
        paidAmount: 0,
      },
    });

    // Update trial session as converted
    await updateTrialSession(sessionId, {
      converted: true,
      convertedToClassId: conversionData.classId,
      conversionNote: `Converted to ${classData.name}`,
    });

    // Check and update booking status
    await checkAndUpdateBookingStatus(bookingId);

    // Log conversion for tracking
    console.log('Trial conversion successful:', {
      bookingId,
      sessionId,
      parentId,
      studentId,
      enrollmentId,
      classId: conversionData.classId,
      useExistingParent: conversionData.useExistingParent,
      useExistingStudent: conversionData.useExistingStudent,
    });

    return { parentId, studentId, enrollmentId };
  } catch (error) {
    console.error('Error converting trial to enrollment:', error);
    throw error;
  }
}

// Delete trial booking (only for new or cancelled bookings)
export async function deleteTrialBooking(id: string): Promise<void> {
  try {
    const supabase = getClient();

    // Get booking to check status
    const booking = await getTrialBooking(id);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Only allow deletion for new or cancelled bookings
    if (booking.status !== 'new' && booking.status !== 'cancelled') {
      throw new Error('Can only delete new or cancelled bookings');
    }

    // Delete all associated trial sessions first (cascade will handle students)
    const { error: sessionsError } = await supabase
      .from('trial_sessions')
      .delete()
      .eq('booking_id', id);

    if (sessionsError) throw sessionsError;

    // Delete the booking (cascade will handle trial_booking_students)
    const { error: bookingError } = await supabase
      .from('trial_bookings')
      .delete()
      .eq('id', id);

    if (bookingError) throw bookingError;
  } catch (error) {
    console.error('Error deleting trial booking:', error);
    throw error;
  }
}

// Get trial booking stats
export async function getTrialBookingStats(branchId?: string | null): Promise<{
  total: number;
  byStatus: Record<string, number>;
  conversionRate: number;
  bySource: Record<string, number>;
}> {
  try {
    const bookings = await getTrialBookings(branchId);

    const stats = {
      total: bookings.length,
      byStatus: {} as Record<string, number>,
      conversionRate: 0,
      bySource: {} as Record<string, number>,
    };

    // Count by status and source
    bookings.forEach(booking => {
      // By status
      stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1;

      // By source
      stats.bySource[booking.source] = (stats.bySource[booking.source] || 0) + 1;
    });

    // Calculate conversion rate
    const converted = stats.byStatus['converted'] || 0;
    const completed = stats.byStatus['completed'] || 0;
    if (completed > 0) {
      stats.conversionRate = (converted / completed) * 100;
    }

    return stats;
  } catch (error) {
    console.error('Error getting trial booking stats:', error);
    return {
      total: 0,
      byStatus: {},
      conversionRate: 0,
      bySource: {},
    };
  }
}

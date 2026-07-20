// lib/services/classes.ts

import { Class, ClassSchedule } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { getRoomsByBranch } from './rooms';
import { getHolidaysForBranch } from './holidays';
import { adminMutation } from '@/lib/admin-mutation';
import { checkAvailability, type AvailabilityIssue, type AvailabilityWarning } from '@/lib/utils/availability';

const TABLE_NAME = 'classes';

// Coerce a value to a uuid string, or null if it isn't a valid uuid.
// Guards uuid FK columns (e.g. rescheduled_by) against placeholder strings.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuidOrNull(v: string | null | undefined): string | null {
  return v && UUID_RE.test(v) ? v : null;
}

// Lightweight schedule rows (id/date/number/status only) — one query, no
// per-row attendance fetch. Used by pause/resume where attendance isn't needed.
// (getClassSchedules loads attendance per row → 30+ requests on long courses.)
interface LiteSchedule {
  id: string;
  sessionDate: Date;
  sessionNumber: number;
  status: string;
}
async function getScheduleRowsLite(classId: string): Promise<LiteSchedule[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('class_schedules')
    .select('id, session_date, session_number, status')
    .eq('class_id', classId)
    .order('session_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    sessionDate: new Date(r.session_date),
    sessionNumber: r.session_number,
    status: r.status || 'scheduled',
  }));
}

// Helper function to get local date string (YYYY-MM-DD) without timezone issues
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Type for database row - classes table
interface ClassRow {
  id: string;
  name: string;
  subject_id: string;
  teacher_id: string;
  branch_id: string;
  room_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_students: number;
  enrolled_student_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Map database row to Class model
function mapToClass(row: any): Class {
  return {
    id: row.id,
    subjectId: row.subject_id,
    teacherId: row.teacher_id,
    branchId: row.branch_id,
    roomId: row.room_id,
    name: row.name,
    code: row.code || '',
    description: row.description,
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
    totalSessions: row.total_sessions || 0,
    daysOfWeek: row.days_of_week || [],
    startTime: row.start_time,
    endTime: row.end_time,
    maxStudents: row.max_students,
    minStudents: row.min_students || 1,
    enrolledCount: row.enrolled_count || 0,
    pricing: {
      pricePerSession: row.price_per_session || 0,
      totalPrice: row.total_price || 0,
      materialFee: row.material_fee,
      registrationFee: row.registration_fee,
    },
    completedSessions: row.completed_sessions ?? undefined,
    status: row.status || 'draft',
    pauseFrom: row.pause_from ? new Date(row.pause_from) : null,
    pauseTo: row.pause_to ? new Date(row.pause_to) : null,
    lastShiftDate: row.last_shift_date ? new Date(row.last_shift_date) : null,
    createdAt: new Date(row.created_at),
  };
}

// Get all classes
export async function getClasses(branchId?: string, teacherId?: string): Promise<Class[]> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('*')
      // Most recently-ended classes first; classes without an end date sink last.
      .order('end_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(mapToClass);
  } catch (error) {
    console.error('Error getting classes:', error);
    throw error;
  }
}

// Get single class
export async function getClass(id: string): Promise<Class | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;

    return mapToClass(data);
  } catch (error) {
    console.error('Error getting class:', error);
    throw error;
  }
}

// Get classes by subject
export async function getClassesBySubject(subjectId: string): Promise<Class[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('subject_id', subjectId)
      .order('start_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapToClass);
  } catch (error) {
    console.error('Error getting classes by subject:', error);
    return [];
  }
}

// Get classes by teacher
export async function getClassesByTeacher(teacherId: string): Promise<Class[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('teacher_id', teacherId)
      .order('start_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapToClass);
  } catch (error) {
    console.error('Error getting classes by teacher:', error);
    return [];
  }
}

// Get classes by branch
export async function getClassesByBranch(branchId: string): Promise<Class[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('branch_id', branchId)
      .order('start_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapToClass);
  } catch (error) {
    console.error('Error getting classes by branch:', error);
    return [];
  }
}

// Create new class with schedules
export async function createClass(
  classData: Omit<Class, 'id' | 'createdAt' | 'enrolledCount'>
): Promise<string> {
  try {
    // Validate status
    const validStatuses = ['draft', 'published', 'started', 'completed', 'cancelled'];
    if (!classData.status || !validStatuses.includes(classData.status)) {
      console.warn('Invalid or empty status provided, defaulting to "draft"');
      classData.status = 'draft';
    }

    // Get holidays for the branch
    const maxEndDate = new Date(classData.startDate);
    maxEndDate.setMonth(maxEndDate.getMonth() + 6);

    const holidays = await getHolidaysForBranch(
      classData.branchId,
      classData.startDate,
      maxEndDate
    );

    const holidayDates = holidays.map(h => h.date);

    // Insert class
    const data = await adminMutation({
      table: 'classes',
      operation: 'insert',
      data: {
        name: classData.name,
        code: classData.code,
        description: classData.description,
        subject_id: classData.subjectId,
        teacher_id: classData.teacherId,
        branch_id: classData.branchId,
        room_id: classData.roomId,
        start_date: classData.startDate.toISOString(),
        end_date: classData.endDate.toISOString(),
        total_sessions: classData.totalSessions,
        days_of_week: classData.daysOfWeek,
        start_time: classData.startTime,
        end_time: classData.endTime,
        max_students: classData.maxStudents,
        min_students: classData.minStudents,
        enrolled_count: 0,
        price_per_session: classData.pricing.pricePerSession,
        total_price: classData.pricing.totalPrice,
        material_fee: classData.pricing.materialFee,
        registration_fee: classData.pricing.registrationFee,
        status: classData.status || 'draft',
      },
      options: { select: true, single: true },
    });

    if (!data) throw new Error('No data returned from insert');

    const classId = data.id;

    // Generate schedules
    const schedules = generateSchedules(
      classData.startDate,
      classData.endDate,
      classData.daysOfWeek,
      classData.totalSessions,
      holidayDates
    );

    // Insert schedules (use local date string to avoid UTC timezone shift)
    const scheduleInserts = schedules.map((schedule, index) => ({
      class_id: classId,
      session_date: getLocalDateString(schedule),
      session_number: index + 1,
      status: 'scheduled',
    }));

    if (scheduleInserts.length > 0) {
      await adminMutation({
        table: 'class_schedules',
        operation: 'insert',
        data: scheduleInserts,
      });
    }

    return classId;
  } catch (error) {
    console.error('Error creating class:', error);
    throw error;
  }
}

// Update class
export async function updateClass(
  id: string,
  classData: Partial<Class>
): Promise<void> {
  try {
    const updateData: any = {};

    if (classData.name !== undefined) updateData.name = classData.name;
    if (classData.code !== undefined) updateData.code = classData.code;
    if (classData.description !== undefined) updateData.description = classData.description;
    if (classData.subjectId !== undefined) updateData.subject_id = classData.subjectId;
    if (classData.teacherId !== undefined) updateData.teacher_id = classData.teacherId;
    if (classData.branchId !== undefined) updateData.branch_id = classData.branchId;
    if (classData.roomId !== undefined) updateData.room_id = classData.roomId;
    if (classData.startDate !== undefined) updateData.start_date = classData.startDate.toISOString();
    if (classData.endDate !== undefined) updateData.end_date = classData.endDate.toISOString();
    if (classData.totalSessions !== undefined) updateData.total_sessions = classData.totalSessions;
    if (classData.daysOfWeek !== undefined) updateData.days_of_week = classData.daysOfWeek;
    if (classData.startTime !== undefined) updateData.start_time = classData.startTime;
    if (classData.endTime !== undefined) updateData.end_time = classData.endTime;
    if (classData.maxStudents !== undefined) updateData.max_students = classData.maxStudents;
    if (classData.minStudents !== undefined) updateData.min_students = classData.minStudents;
    if (classData.enrolledCount !== undefined) updateData.enrolled_count = classData.enrolledCount;

    if (classData.pricing) {
      if (classData.pricing.pricePerSession !== undefined) updateData.price_per_session = classData.pricing.pricePerSession;
      if (classData.pricing.totalPrice !== undefined) updateData.total_price = classData.pricing.totalPrice;
      if (classData.pricing.materialFee !== undefined) updateData.material_fee = classData.pricing.materialFee;
      if (classData.pricing.registrationFee !== undefined) updateData.registration_fee = classData.pricing.registrationFee;
    }

    if (classData.status !== undefined) {
      const validStatuses = ['draft', 'published', 'started', 'completed', 'cancelled'];
      if (!validStatuses.includes(classData.status)) {
        throw new Error(`Invalid status: ${classData.status}`);
      }
      updateData.status = classData.status;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: updateData,
      match: { id },
    });
  } catch (error) {
    console.error('Error updating class:', error);
    throw error;
  }
}

// Delete class - Uses API route to bypass RLS restrictions
export async function deleteClass(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/admin/classes/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete class');
    }
  } catch (error) {
    console.error('Error deleting class:', error);
    throw error;
  }
}

// Get class schedules
export async function getClassSchedules(classId: string): Promise<ClassSchedule[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('class_id', classId)
      .order('session_date', { ascending: true });

    if (error) throw error;

    // Load attendance for all schedules
    const { getAttendanceBySchedule } = await import('./attendance');
    const schedules = await Promise.all((data || []).map(async (row: any) => {
      const attendance = await getAttendanceBySchedule(row.id);

      return {
        id: row.id,
        classId: row.class_id,
        sessionDate: new Date(row.session_date),
        sessionNumber: row.session_number,
        topic: row.topic,
        status: row.status || 'scheduled',
        actualTeacherId: row.actual_teacher_id,
        actualRoomId: row.actual_room_id,
        actualStartTime: row.actual_start_time || undefined,
        actualEndTime: row.actual_end_time || undefined,
        note: row.note,
        attendance: attendance.map(att => ({
          studentId: att.studentId,
          status: att.status,
          note: att.note,
          checkedAt: att.checkedAt,
          checkedBy: att.checkedBy,
          feedback: att.feedback,
          photos: att.photos
        })),
        originalDate: row.original_date ? new Date(row.original_date) : undefined,
        rescheduledAt: row.rescheduled_at ? new Date(row.rescheduled_at) : undefined,
        rescheduledBy: row.rescheduled_by,
      };
    }));

    return schedules;
  } catch (error) {
    console.error('Error getting class schedules:', error);
    return [];
  }
}

// Get single class schedule
export async function getClassSchedule(
  classId: string,
  scheduleId: string
): Promise<ClassSchedule | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('class_id', classId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    if (!data) return null;
    const row: any = data;

    // Load attendance from separate table
    const { getAttendanceBySchedule } = await import('./attendance');
    const attendance = await getAttendanceBySchedule(row.id);

    return {
      id: row.id,
      classId: row.class_id,
      sessionDate: new Date(row.session_date),
      sessionNumber: row.session_number,
      topic: row.topic,
      status: row.status || 'scheduled',
      actualTeacherId: row.actual_teacher_id,
      actualRoomId: row.actual_room_id,
      actualStartTime: row.actual_start_time || undefined,
      actualEndTime: row.actual_end_time || undefined,
      note: row.note,
      attendance: attendance.map(att => ({
        studentId: att.studentId,
        status: att.status,
        note: att.note,
        checkedAt: att.checkedAt,
        checkedBy: att.checkedBy,
        feedback: att.feedback,
        photos: att.photos
      })),
      originalDate: row.original_date ? new Date(row.original_date) : undefined,
      rescheduledAt: row.rescheduled_at ? new Date(row.rescheduled_at) : undefined,
      rescheduledBy: row.rescheduled_by,
    };
  } catch (error) {
    console.error('Error getting class schedule:', error);
    return null;
  }
}

// Update class schedule
export async function updateClassSchedule(
  classId: string,
  scheduleId: string,
  data: Partial<ClassSchedule>
): Promise<void> {
  try {
    // Get current schedule data
    const currentSchedule = await getClassSchedule(classId, scheduleId);
    if (!currentSchedule) {
      throw new Error('Schedule not found');
    }

    const updateData: any = {};

    if (data.sessionDate !== undefined) updateData.session_date = data.sessionDate.toISOString();
    if (data.sessionNumber !== undefined) updateData.session_number = data.sessionNumber;
    if (data.topic !== undefined) updateData.topic = data.topic;
    if (data.actualTeacherId !== undefined) updateData.actual_teacher_id = data.actualTeacherId;
    if (data.actualRoomId !== undefined) updateData.actual_room_id = data.actualRoomId;
    if (data.note !== undefined) updateData.note = data.note;

    // Handle attendance updates - save to separate attendance table
    if (data.attendance !== undefined) {
      const { saveAttendance } = await import('./attendance');
      await saveAttendance(scheduleId, data.attendance);

      // Only mark as 'completed' if attendance was taken (has present/late/sick/leave status)
      // Don't mark as completed for makeup requests (only 'absent' status)
      const hasActualAttendance = data.attendance.some(att =>
        att.status === 'present' || att.status === 'late' || att.status === 'sick' || att.status === 'leave'
      );

      if (hasActualAttendance) {
        updateData.status = 'completed';
      } else if (data.attendance.length === 0) {
        updateData.status = 'scheduled';
      }
      // If only 'absent' status (makeup requests), keep current status unchanged
    } else if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.originalDate !== undefined) updateData.original_date = data.originalDate.toISOString();
    if (data.rescheduledAt !== undefined) updateData.rescheduled_at = data.rescheduledAt.toISOString();
    if (data.rescheduledBy !== undefined) updateData.rescheduled_by = data.rescheduledBy;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await adminMutation({
      table: 'class_schedules',
      operation: 'update',
      data: updateData,
      match: { id: scheduleId, class_id: classId },
    });
  } catch (error) {
    console.error('Error updating class schedule:', error);
    throw error;
  }
}

// Generate schedule dates
function generateSchedules(
  startDate: Date,
  endDate: Date,
  daysOfWeek: number[],
  totalSessions: number,
  holidayDates: Date[]
): Date[] {
  const schedules: Date[] = [];
  const currentDate = new Date(startDate);

  const holidayStrings = holidayDates.map(date =>
    getLocalDateString(date)
  );

  while (schedules.length < totalSessions && currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dateString = getLocalDateString(currentDate);

    if (daysOfWeek.includes(dayOfWeek) && !holidayStrings.includes(dateString)) {
      schedules.push(new Date(currentDate));
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedules;
}

// Check if class code exists
export async function checkClassCodeExists(code: string, excludeId?: string): Promise<boolean> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('code', code);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking class code:', error);
    throw error;
  }
}

// Update class status
export async function updateClassStatus(id: string, status: Class['status']): Promise<void> {
  try {
    const validStatuses = ['draft', 'published', 'started', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: { status },
      match: { id },
    });
  } catch (error) {
    console.error('Error updating class status:', error);
    throw error;
  }
}

// Get active classes (published or started)
export async function getActiveClasses(branchId?: string): Promise<Class[]> {
  try {
    const classes = await getClasses(branchId);
    return classes.filter(c => c.status === 'published' || c.status === 'started');
  } catch (error) {
    console.error('Error getting active classes:', error);
    return [];
  }
}

// Normalize time string to HH:mm format for consistent comparison
function normalizeTime(time: string): string {
  return time.substring(0, 5); // "10:30:00" -> "10:30", "10:30" -> "10:30"
}

// Check room availability for a time slot
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
  try {
    const conflicts: any[] = [];
    const normStart = normalizeTime(startTime);
    const normEnd = normalizeTime(endTime);

    const classes = await getClassesByBranch(branchId);

    const potentialClassConflicts = classes.filter(cls => {
      if (excludeClassId && cls.id === excludeClassId) return false;
      if (cls.status === 'cancelled' || cls.status === 'completed') return false;
      if (cls.roomId !== roomId) return false;

      const dayOverlap = cls.daysOfWeek.some(day => daysOfWeek.includes(day));
      if (!dayOverlap) return false;

      const dateOverlap = (
        (startDate >= cls.startDate && startDate <= cls.endDate) ||
        (endDate >= cls.startDate && endDate <= cls.endDate) ||
        (startDate <= cls.startDate && endDate >= cls.endDate)
      );
      if (!dateOverlap) return false;

      const clsStart = normalizeTime(cls.startTime);
      const clsEnd = normalizeTime(cls.endTime);

      // Times that are exactly adjacent (e.g. 08:30-10:30 and 10:30-12:30) do NOT overlap
      const timeOverlap = normStart < clsEnd && normEnd > clsStart;

      return timeOverlap;
    });

    potentialClassConflicts.forEach(cls => {
      conflicts.push({
        type: 'class',
        classId: cls.id,
        className: cls.name,
        classCode: cls.code,
        startTime: normalizeTime(cls.startTime),
        endTime: normalizeTime(cls.endTime),
        daysOfWeek: cls.daysOfWeek,
      });
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  } catch (error) {
    console.error('Error checking room availability:', error);
    return { available: false };
  }
}

// Get upcoming sessions for a class
export async function getUpcomingSessions(
  classId: string,
  fromDate?: Date
): Promise<ClassSchedule[]> {
  try {
    const supabase = getClient();
    const startDate = fromDate || new Date();

    const { data, error } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('class_id', classId)
      .gte('session_date', startDate.toISOString())
      .neq('status', 'cancelled')
      .order('session_date', { ascending: true });

    if (error) throw error;

    // Load attendance for all schedules
    const { getAttendanceBySchedule } = await import('./attendance');
    const schedules = await Promise.all((data || []).map(async (row: any) => {
      const attendance = await getAttendanceBySchedule(row.id);

      return {
        id: row.id,
        classId: row.class_id,
        sessionDate: new Date(row.session_date),
        sessionNumber: row.session_number,
        topic: row.topic,
        status: row.status || 'scheduled',
        actualTeacherId: row.actual_teacher_id,
        actualRoomId: row.actual_room_id,
        actualStartTime: row.actual_start_time || undefined,
        actualEndTime: row.actual_end_time || undefined,
        note: row.note,
        attendance: attendance.map(att => ({
          studentId: att.studentId,
          status: att.status,
          note: att.note,
          checkedAt: att.checkedAt,
          checkedBy: att.checkedBy,
          feedback: att.feedback,
          photos: att.photos
        })),
        originalDate: row.original_date ? new Date(row.original_date) : undefined,
        rescheduledAt: row.rescheduled_at ? new Date(row.rescheduled_at) : undefined,
        rescheduledBy: row.rescheduled_by,
      };
    }));

    return schedules;
  } catch (error) {
    console.error('Error getting upcoming sessions:', error);
    return [];
  }
}

// Reschedule a single session
export async function rescheduleSession(
  classId: string,
  scheduleId: string,
  newDate: Date,
  reason?: string,
  rescheduledBy?: string
): Promise<void> {
  try {
    const currentSchedule = await getClassSchedule(classId, scheduleId);
    if (!currentSchedule) {
      throw new Error('Schedule not found');
    }

    await adminMutation({
      table: 'class_schedules',
      operation: 'update',
      data: {
        session_date: newDate.toISOString(),
        status: 'rescheduled',
        original_date: currentSchedule.sessionDate.toISOString(),
        rescheduled_at: new Date().toISOString(),
        rescheduled_by: rescheduledBy || '',
        note: reason || '',
      },
      match: { id: scheduleId, class_id: classId },
    });
  } catch (error) {
    console.error('Error rescheduling session:', error);
    throw error;
  }
}

// Get class statistics
export async function getClassStatistics(classId: string): Promise<{
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  cancelledSessions: number;
  attendanceRate: number;
}> {
  try {
    const schedules = await getClassSchedules(classId);
    const now = new Date();

    const stats = {
      totalSessions: schedules.length,
      completedSessions: 0,
      upcomingSessions: 0,
      cancelledSessions: 0,
      attendanceRate: 0,
    };

    let totalAttendanceCount = 0;
    let totalStudentSessions = 0;

    schedules.forEach(schedule => {
      if (schedule.status === 'cancelled') {
        stats.cancelledSessions++;
      } else if (schedule.sessionDate > now) {
        stats.upcomingSessions++;
      } else if (schedule.status === 'completed' || schedule.attendance) {
        stats.completedSessions++;

        if (schedule.attendance) {
          const presentCount = schedule.attendance.filter(a => a.status === 'present').length;
          totalAttendanceCount += presentCount;
          totalStudentSessions += schedule.attendance.length;
        }
      }
    });

    if (totalStudentSessions > 0) {
      stats.attendanceRate = (totalAttendanceCount / totalStudentSessions) * 100;
    }

    return stats;
  } catch (error) {
    console.error('Error getting class statistics:', error);
    return {
      totalSessions: 0,
      completedSessions: 0,
      upcomingSessions: 0,
      cancelledSessions: 0,
      attendanceRate: 0,
    };
  }
}

// Batch update multiple schedules
export async function batchUpdateSchedules(
  classId: string,
  updates: Array<{ scheduleId: string; data: Partial<ClassSchedule> }>
): Promise<void> {
  try {
    for (const { scheduleId, data } of updates) {
      const updateData: any = {};

      if (data.sessionDate) updateData.session_date = data.sessionDate.toISOString();
      if (data.originalDate) updateData.original_date = data.originalDate.toISOString();
      if (data.status) updateData.status = data.status;
      if (data.topic) updateData.topic = data.topic;
      if (data.note) updateData.note = data.note;

      if (Object.keys(updateData).length > 0) {
        await adminMutation({
          table: 'class_schedules',
          operation: 'update',
          data: updateData,
          match: { id: scheduleId, class_id: classId },
        });
      }
    }
  } catch (error) {
    console.error('Error batch updating schedules:', error);
    throw error;
  }
}

// Increment enrolled count by 1
export async function incrementEnrolledCount(classId: string): Promise<void> {
  try {
    const classData = await getClass(classId);
    if (!classData) return;
    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: { enrolled_count: classData.enrolledCount + 1 },
      match: { id: classId },
    });
  } catch (error) {
    console.error('Error incrementing enrolled count:', error);
  }
}

// Decrement enrolled count by 1
export async function decrementEnrolledCount(classId: string): Promise<void> {
  try {
    const classData = await getClass(classId);
    if (!classData) return;
    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: { enrolled_count: Math.max(0, classData.enrolledCount - 1) },
      match: { id: classId },
    });
  } catch (error) {
    console.error('Error decrementing enrolled count:', error);
  }
}

// Fix enrolled count
export async function fixEnrolledCount(classId: string, newCount: number): Promise<void> {
  try {
    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: { enrolled_count: newCount },
      match: { id: classId },
    });
  } catch (error) {
    console.error('Error fixing enrolled count:', error);
    throw error;
  }
}

// Get class with schedules included
export async function getClassWithSchedules(classId: string): Promise<(Class & { schedules?: ClassSchedule[] }) | null> {
  try {
    const classData = await getClass(classId);
    if (!classData) return null;

    const schedules = await getClassSchedules(classId);
    return {
      ...classData,
      schedules
    };
  } catch (error) {
    console.error('Error getting class with schedules:', error);
    return null;
  }
}

// Get attendance for a specific student across all classes
export async function getStudentAttendanceHistory(
  studentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Array<{
  classId: string;
  scheduleId: string;
  sessionDate: Date;
  sessionNumber: number;
  status: 'present' | 'absent' | 'late';
  note?: string;
  checkedAt?: Date;
  checkedBy?: string;
}>> {
  try {
    const { getEnrollmentsByStudent } = await import('./enrollments');
    const enrollments = await getEnrollmentsByStudent(studentId);

    const attendanceHistory: any[] = [];

    for (const enrollment of enrollments) {
      const schedules = await getClassSchedules(enrollment.classId);

      const filteredSchedules = schedules.filter(schedule => {
        if (startDate && schedule.sessionDate < startDate) return false;
        if (endDate && schedule.sessionDate > endDate) return false;
        return true;
      });

      filteredSchedules.forEach(schedule => {
        if (schedule.attendance) {
          const studentAttendance = schedule.attendance.find(
            att => att.studentId === studentId
          );

          if (studentAttendance) {
            attendanceHistory.push({
              classId: enrollment.classId,
              scheduleId: schedule.id,
              sessionDate: schedule.sessionDate,
              sessionNumber: schedule.sessionNumber,
              status: studentAttendance.status,
              note: studentAttendance.note,
              checkedAt: (studentAttendance as any).checkedAt,
              checkedBy: (studentAttendance as any).checkedBy
            });
          }
        }
      });
    }

    return attendanceHistory.sort((a, b) =>
      b.sessionDate.getTime() - a.sessionDate.getTime()
    );
  } catch (error) {
    console.error('Error getting student attendance history:', error);
    return [];
  }
}

// Get attendance summary for a class
export async function getClassAttendanceSummary(classId: string): Promise<{
  totalSessions: number;
  completedSessions: number;
  studentStats: Map<string, {
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  }>;
}> {
  try {
    const schedules = await getClassSchedules(classId);
    const studentStats = new Map();

    let completedSessions = 0;

    schedules.forEach(schedule => {
      if (schedule.attendance && schedule.attendance.length > 0) {
        completedSessions++;

        schedule.attendance.forEach(att => {
          if (!studentStats.has(att.studentId)) {
            studentStats.set(att.studentId, {
              present: 0,
              absent: 0,
              late: 0,
              attendanceRate: 0
            });
          }

          const stats = studentStats.get(att.studentId)!;
          if (att.status === 'present') stats.present++;
          else if (att.status === 'absent') stats.absent++;
          else if (att.status === 'late') stats.late++;
        });
      }
    });

    studentStats.forEach((stats, studentId) => {
      const total = stats.present + stats.absent + stats.late;
      if (total > 0) {
        stats.attendanceRate = ((stats.present + stats.late) / total) * 100;
      }
    });

    return {
      totalSessions: schedules.length,
      completedSessions,
      studentStats
    };
  } catch (error) {
    console.error('Error getting class attendance summary:', error);
    return {
      totalSessions: 0,
      completedSessions: 0,
      studentStats: new Map()
    };
  }
}

// Get enrolled students for a class
export async function getEnrolledStudents(classId: string): Promise<string[]> {
  try {
    const { getEnrollmentsByClass } = await import('./enrollments');
    const enrollments = await getEnrollmentsByClass(classId);

    return enrollments
      .filter(e => e.status === 'active')
      .map(e => e.studentId);
  } catch (error) {
    console.error('Error getting enrolled students:', error);
    return [];
  }
}

// Manual update class status based on dates and sessions
export async function updateClassStatusBasedOnDates(classId: string): Promise<void> {
  try {
    const classDoc = await getClass(classId);
    if (!classDoc) return;

    const now = new Date();

    if (classDoc.status === 'published' && classDoc.startDate <= now) {
      await adminMutation({
        table: 'classes',
        operation: 'update',
        data: { status: 'started' },
        match: { id: classId },
      });
      return;
    }

    if (classDoc.status === 'started') {
      const endDateOnly = new Date(classDoc.endDate);
      endDateOnly.setHours(23, 59, 59, 999);

      if (endDateOnly < now) {
        const schedules = await getClassSchedules(classId);
        let allSessionsPassed = true;

        for (const schedule of schedules) {
          if (schedule.status !== 'cancelled' && schedule.sessionDate > now) {
            allSessionsPassed = false;
            break;
          }
        }

        if (allSessionsPassed) {
          await adminMutation({
            table: 'classes',
            operation: 'update',
            data: { status: 'completed' },
            match: { id: classId },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error updating class status:', error);
    throw error;
  }
}

// Batch update all classes status
export async function batchUpdateClassStatuses(): Promise<{
  updated: number;
  errors: string[];
}> {
  try {
    const classes = await getClasses();
    const activeClasses = classes.filter(c =>
      c.status === 'published' || c.status === 'started'
    );

    let updated = 0;
    const errors: string[] = [];

    for (const cls of activeClasses) {
      try {
        const oldStatus = cls.status;
        await updateClassStatusBasedOnDates(cls.id);

        const updatedClass = await getClass(cls.id);
        if (updatedClass && updatedClass.status !== oldStatus) {
          updated++;
        }
      } catch (error) {
        errors.push(`Class ${cls.id}: ${error}`);
      }
    }

    return { updated, errors };
  } catch (error) {
    console.error('Error in batch update:', error);
    return { updated: 0, errors: [String(error)] };
  }
}

// Validate if class can be edited based on status and dates
export function canEditClassDates(classData: Class): {
  canEdit: boolean;
  reason?: string;
} {
  const now = new Date();

  if (classData.status === 'draft' || classData.status === 'cancelled') {
    return { canEdit: true };
  }

  if (classData.status === 'published') {
    if (classData.enrolledCount === 0) {
      return { canEdit: true };
    } else if (classData.startDate > now) {
      return {
        canEdit: true,
        reason: 'มีนักเรียนลงทะเบียนแล้ว แก้ไขได้เฉพาะบางส่วน'
      };
    }
  }

  if (classData.status === 'started') {
    return {
      canEdit: false,
      reason: 'คลาสกำลังดำเนินการอยู่ ไม่สามารถแก้ไขวันที่และเวลาได้'
    };
  }

  if (classData.status === 'completed') {
    return {
      canEdit: false,
      reason: 'คลาสจบแล้ว ไม่สามารถแก้ไขได้'
    };
  }

  return { canEdit: false, reason: 'ไม่สามารถแก้ไขได้' };
}

// Get editable fields based on class status
// isSuperAdmin overrides locks — super admin can edit all fields
// === Change Teacher/Room for active classes ===

export async function changeClassResources(
  classId: string,
  params: {
    newTeacherId?: string;
    newRoomId?: string;
    effectiveDate: string; // YYYY-MM-DD
    reason?: string;
    changedBy: string;
  }
): Promise<{ updatedSchedules: number }> {
  if (!params.newTeacherId && !params.newRoomId) {
    throw new Error('ต้องเลือกครูหรือห้องใหม่อย่างน้อย 1 อย่าง');
  }

  // Get current class data
  const classData = await getClass(classId);
  if (!classData) throw new Error('ไม่พบข้อมูลคลาส');

  const oldTeacherId = classData.teacherId;
  const oldRoomId = classData.roomId;

  // Get future scheduled sessions
  const schedules = await getClassSchedules(classId);
  const futureSchedules = schedules.filter(s => {
    const dateStr = s.sessionDate instanceof Date
      ? s.sessionDate.toISOString().split('T')[0]
      : String(s.sessionDate).split('T')[0];
    return s.status === 'scheduled' && dateStr >= params.effectiveDate;
  });

  // 1. Update class level
  const classUpdateData: any = {};
  if (params.newTeacherId) classUpdateData.teacher_id = params.newTeacherId;
  if (params.newRoomId) classUpdateData.room_id = params.newRoomId;

  await adminMutation({
    table: 'classes',
    operation: 'update',
    data: classUpdateData,
    match: { id: classId },
  });

  // 2. Update future schedules
  for (const schedule of futureSchedules) {
    const scheduleUpdate: any = {};
    if (params.newTeacherId) scheduleUpdate.actual_teacher_id = params.newTeacherId;
    if (params.newRoomId) scheduleUpdate.actual_room_id = params.newRoomId;

    await adminMutation({
      table: 'class_schedules',
      operation: 'update',
      data: scheduleUpdate,
      match: { id: schedule.id },
    });
  }

  // 3. Set old teacher/room on past completed sessions (preserve history)
  const pastCompleted = schedules.filter(s => s.status === 'completed' && !s.actualTeacherId);
  if (params.newTeacherId && pastCompleted.length > 0) {
    for (const schedule of pastCompleted) {
      await adminMutation({
        table: 'class_schedules',
        operation: 'update',
        data: { actual_teacher_id: oldTeacherId },
        match: { id: schedule.id },
      });
    }
  }

  console.log(`[changeClassResources] classId=${classId}, updated ${futureSchedules.length} future schedules, preserved ${pastCompleted.length} past sessions`);

  return { updatedSchedules: futureSchedules.length };
}

// === Auto-generate class code ===

export function generateClassCode(params: {
  subjectCode: string;   // e.g. "ROB", "COD"
  dayOfWeek: number;     // 0=Sun, 1=Mon, ...
  startTime: string;     // "09:00"
  existingCodes: string[]; // existing codes to check duplicates
}): string {
  const dayMap: Record<number, string> = {
    0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT'
  };

  const day = dayMap[params.dayOfWeek] || 'UNK';
  const time = params.startTime.replace(':', '');
  const base = `${params.subjectCode}-${day}-${time}`;

  // Find next running number
  const existing = params.existingCodes.filter(c => c.startsWith(base));
  if (existing.length === 0) return base;

  let max = 0;
  for (const code of existing) {
    const suffix = code.replace(`${base}-`, '');
    const num = parseInt(suffix);
    if (!isNaN(num) && num > max) max = num;
  }
  return `${base}-${String(max + 1).padStart(2, '0')}`;
}

// Edit permissions are driven by ENROLLMENT, not role or status:
//   - no students yet  → everything editable (e.g. push the start date out)
//   - has students      → lock schedule/resources/pricing; only the name,
//                          description, max-capacity and status stay editable.
// `_legacyCanEditAll` is kept for call-site compatibility but intentionally
// ignored — a super admin must NOT be able to rewrite the schedule of a class
// that students have already enrolled in.
export function getEditableFields(classData: Class, _legacyCanEditAll = false): {
  basicInfo: boolean;
  schedule: boolean;
  resources: boolean;
  pricing: boolean;
  capacity: boolean;
  status: boolean;
} {
  const hasStudents = classData.enrolledCount > 0;

  if (!hasStudents) {
    return {
      basicInfo: true,
      schedule: true,
      resources: true,
      pricing: true,
      capacity: true,
      status: true,
    };
  }

  // Has students → schedule/resources/pricing are frozen.
  return {
    basicInfo: true,   // name, description
    schedule: false,
    resources: false,
    pricing: false,
    capacity: true,    // max students (can raise; UI blocks lowering below enrolled)
    status: true,
  };
}

// Regenerate future class schedules (keeps past/completed ones)
export async function regenerateClassSchedules(
  classId: string,
  classData: {
    startDate: Date;
    endDate: Date;
    daysOfWeek: number[];
    totalSessions: number;
    branchId: string;
  }
): Promise<{ deleted: number; created: number }> {
  const today = getLocalDateString(new Date());

  // 1. Get existing schedules (use admin route to bypass RLS)
  const existingSchedules = (await adminMutation({
    table: 'class_schedules',
    operation: 'select',
    match: { class_id: classId },
    options: { select: '*', order: 'session_date.asc' },
  })) as any[] || [];

  // 2. Separate: keep past/attended, delete future unattended
  const keepSchedules = (existingSchedules || []).filter(s => {
    return s.session_date < today || s.status === 'completed';
  });
  const deleteSchedules = (existingSchedules || []).filter(s => {
    return s.session_date >= today && s.status !== 'completed';
  });

  // 3. Delete future schedules
  if (deleteSchedules.length > 0) {
    const deleteIds = deleteSchedules.map(s => s.id);
    for (const id of deleteIds) {
      await adminMutation({
        table: 'class_schedules',
        operation: 'delete',
        match: { id },
      });
    }
  }

  // 4. Generate new schedules from today onwards
  const holidays = await getHolidaysForBranch(
    classData.branchId,
    new Date(),
    classData.endDate
  );
  const holidayDates = holidays.map(h => h.date);

  const remainingSessions = classData.totalSessions - keepSchedules.length;
  if (remainingSessions <= 0) {
    return { deleted: deleteSchedules.length, created: 0 };
  }

  // Anchor generation on the (new) class start date — NOT "today" — so that
  // re-dating a not-yet-started class regenerates sessions on the correct days.
  // Never create dates in the past (keeps mid-course "push remaining" behaviour).
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const desiredStart = new Date(classData.startDate);
  desiredStart.setHours(0, 0, 0, 0);
  const startFrom = desiredStart > todayStart ? desiredStart : todayStart;

  const newDates = generateSchedules(
    startFrom,
    classData.endDate,
    classData.daysOfWeek,
    remainingSessions,
    holidayDates
  );

  // 5. Insert new schedules (use local date string to avoid UTC timezone shift)
  const nextSessionNumber = keepSchedules.length + 1;
  const scheduleInserts = newDates.map((date, index) => ({
    class_id: classId,
    session_date: getLocalDateString(date),
    session_number: nextSessionNumber + index,
    status: 'scheduled',
  }));

  if (scheduleInserts.length > 0) {
    await adminMutation({
      table: 'class_schedules',
      operation: 'insert',
      data: scheduleInserts,
    });
  }

  return { deleted: deleteSchedules.length, created: scheduleInserts.length };
}

// Get info for ending a class early (preview before confirming)
export async function getEndClassPreview(classId: string): Promise<{
  lastSessionDate: string | null;
  completedSessions: number;
  futureSessions: number;
  totalSessions: number;
}> {
  try {
    const schedules = await getClassSchedules(classId);
    const today = getLocalDateString(new Date());

    const completedSessions = schedules.filter(s => s.status === 'completed').length;
    const futureSessions = schedules.filter(s =>
      s.status === 'scheduled' && s.sessionDate.toISOString().slice(0, 10) > today
    ).length;

    // Find the last completed or past session date
    const pastSessions = schedules
      .filter(s => s.status === 'completed' || (s.status === 'scheduled' && s.sessionDate.toISOString().slice(0, 10) <= today))
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());

    const lastSessionDate = pastSessions.length > 0
      ? getLocalDateString(pastSessions[0].sessionDate)
      : null;

    return {
      lastSessionDate,
      completedSessions,
      futureSessions,
      totalSessions: schedules.length,
    };
  } catch (error) {
    console.error('Error getting end class preview:', error);
    throw error;
  }
}

// End a class immediately: set status to completed, update end_date, cancel future sessions
export async function endClassNow(classId: string): Promise<{ newEndDate: string }> {
  try {
    const schedules = await getClassSchedules(classId);
    const today = getLocalDateString(new Date());

    // Find the last session that already happened (completed or past scheduled)
    const pastSessions = schedules
      .filter(s => s.status === 'completed' || (s.status === 'scheduled' && s.sessionDate.toISOString().slice(0, 10) <= today))
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());

    const newEndDate = pastSessions.length > 0
      ? getLocalDateString(pastSessions[0].sessionDate)
      : today;

    // Cancel all future scheduled sessions
    const futureScheduleIds = schedules
      .filter(s => s.status === 'scheduled' && s.sessionDate.toISOString().slice(0, 10) > today)
      .map(s => s.id);

    if (futureScheduleIds.length > 0) {
      await adminMutation({
        table: 'class_schedules',
        operation: 'update',
        data: { status: 'cancelled' },
        filters: [{ column: 'id', op: 'in', value: futureScheduleIds }],
      });
    }

    // Update class: set status to completed and update end_date
    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: {
        status: 'completed',
        end_date: newEndDate,
      },
      match: { id: classId },
    });

    return { newEndDate };
  } catch (error) {
    console.error('Error ending class:', error);
    throw error;
  }
}

// ============================================================================
// Whole-class pause / resume (พักทั้งคลาส)
// Separate from per-student pauseEnrollment: NO makeup is created — sessions in
// the pause window are simply cancelled (hidden from timetables) and the
// remaining sessions are re-booked on resume via a manual editor.
// ============================================================================

export interface ResumeDraftSession {
  sessionNumber: number;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  roomId: string;
  teacherId: string;
}

// The default date to (re)book from = the day AFTER the last kept session
// (completed or past/future non-cancelled), or today if there are none.
// Used so a pause re-books the course continuing from where it left off.
function nextDateAfterLastSession(schedules: ClassSchedule[]): string {
  const today = getLocalDateString(new Date());
  const kept = schedules
    .filter((s) => s.status !== 'cancelled')
    .map((s) => getLocalDateString(s.sessionDate))
    .sort();
  const lastDate = kept.length ? kept[kept.length - 1] : null;
  if (!lastDate) return today;
  const d = new Date(lastDate);
  d.setDate(d.getDate() + 1);
  const next = getLocalDateString(d);
  return next > today ? next : today;
}

// Compute default booking rows for the sessions still to be scheduled.
//   keptBeforeDate – sessions before this date stay put and count as "kept"
//   genFrom        – first date to start generating new sessions from
// (the two differ on a known-range pause: kept = before pauseFrom, but we
//  generate from after pauseTo so the paused weeks are skipped, not reused.)
async function computeDefaultRows(
  cls: Class,
  schedules: { status: string; sessionDate: Date }[],
  keptBeforeDate: string,
  genFrom: string
): Promise<ResumeDraftSession[]> {
  const keptCount = schedules.filter(
    (s) =>
      s.status === 'completed' ||
      (s.status !== 'cancelled' && getLocalDateString(s.sessionDate) < keptBeforeDate)
  ).length;
  const remaining = Math.max(0, cls.totalSessions - keptCount);

  const start = new Date(genFrom);
  const horizon = new Date(genFrom);
  horizon.setMonth(horizon.getMonth() + 12);
  const holidays = await getHolidaysForBranch(cls.branchId, start, horizon);
  const dates = generateSchedules(start, horizon, cls.daysOfWeek, remaining, holidays.map((h) => h.date));

  return dates.map((d, i) => ({
    sessionNumber: keptCount + 1 + i,
    date: getLocalDateString(d),
    startTime: normalizeTime(cls.startTime),
    endTime: normalizeTime(cls.endTime),
    roomId: cls.roomId,
    teacherId: cls.teacherId,
  }));
}

// Replace all cancelled + future-scheduled (from `fromDate`) rows with the given
// rows. Shared by mode-A pause (auto-rebook) and resume (mode-B). Returns counts
// + new end date + how many booked rows currently conflict (room/teacher).
// Replace rows from `deleteFrom` onward (plus any cancelled rows) with `rows`.
// Exactly TWO DB round-trips: one batch delete + one batch insert. No per-row
// loops, no availability calls here (the editor checks conflicts live).
async function rebookSessions(
  cls: Class,
  deleteFrom: string,
  rows: ResumeDraftSession[]
): Promise<{ created: number; deleted: number; newEndDate: string }> {
  const all = await getScheduleRowsLite(cls.id);
  const toRemove = all.filter(
    (s) =>
      s.status === 'cancelled' ||
      (s.status === 'scheduled' && getLocalDateString(s.sessionDate) >= deleteFrom)
  );

  // A makeup_classes.original_schedule_id FK (NO ACTION) points at some of these
  // rows — hard-deleting them would raise a FK violation and abort the whole
  // shift/pause. So split: rows referenced by a live makeup are CANCELLED (row
  // kept, FK intact, makeup history preserved); the rest are deleted as before.
  const removeIds = toRemove.map((s) => s.id);
  let referencedIds = new Set<string>();
  if (removeIds.length > 0) {
    const supabase = getClient();
    const { data: refMakeups } = await (supabase as any)
      .from('makeup_classes')
      .select('original_schedule_id')
      .in('original_schedule_id', removeIds)
      .neq('status', 'cancelled');
    referencedIds = new Set((refMakeups || []).map((m: any) => m.original_schedule_id));
  }
  const toCancel = toRemove.filter((s) => referencedIds.has(s.id) && s.status !== 'cancelled');
  const toDelete = toRemove.filter((s) => !referencedIds.has(s.id));

  console.log(
    `[rebookSessions] class=${cls.id} deleteFrom=${deleteFrom} → deleting ${toDelete.length}, cancelling ${toCancel.length} (has makeup), inserting ${rows.length}`
  );

  // Cancel sessions that a makeup references (can't delete — FK). Keeps the
  // original session on record so the linked makeup/leave still resolves.
  if (toCancel.length > 0) {
    await adminMutation({
      table: 'class_schedules',
      operation: 'update',
      data: { status: 'cancelled', note: '[เลื่อน/พักคลาส] มีการลา/ชดเชยผูกกับคาบนี้' },
      filters: [{ op: 'in', column: 'id', value: toCancel.map((s) => s.id) }],
    });
  }

  // 1 request: batch delete (only rows with no makeup reference)
  if (toDelete.length > 0) {
    await adminMutation({
      table: 'class_schedules',
      operation: 'delete',
      filters: [{ op: 'in', column: 'id', value: toDelete.map((s) => s.id) }],
    });
  }

  const defaultStart = normalizeTime(cls.startTime);
  const defaultEnd = normalizeTime(cls.endTime);
  const inserts = rows.map((r) => {
    const rowStart = normalizeTime(r.startTime);
    const rowEnd = normalizeTime(r.endTime);
    return {
      class_id: cls.id,
      session_date: r.date,
      session_number: r.sessionNumber,
      status: 'scheduled',
      actual_room_id: r.roomId && r.roomId !== cls.roomId ? r.roomId : null,
      actual_teacher_id: r.teacherId && r.teacherId !== cls.teacherId ? r.teacherId : null,
      actual_start_time: rowStart !== defaultStart ? rowStart : null,
      actual_end_time: rowEnd !== defaultEnd ? rowEnd : null,
    };
  });

  // 1 request: batch insert (adminMutation accepts an array)
  if (inserts.length > 0) {
    await adminMutation({ table: 'class_schedules', operation: 'insert', data: inserts });
  }

  const newEndDate = rows.length
    ? rows.reduce((max, r) => (r.date > max ? r.date : max), rows[0].date)
    : getLocalDateString(cls.endDate);

  console.log(`[rebookSessions] done. newEndDate=${newEndDate}`);
  return { created: inserts.length, deleted: toDelete.length + toCancel.length, newEndDate };
}

// Pause a whole class.
//   mode 'known'  → cancel sessions in [pauseFrom, pauseTo] AND immediately
//                   re-book the remaining sessions continuing after the last
//                   kept session (no makeup, no lingering paused state).
//   mode 'open'   → cancel all scheduled sessions from pauseFrom onward and
//                   leave the class flagged paused (pause_to set) until the
//                   admin resumes and books new dates.
export async function pauseClass(
  classId: string,
  pauseFrom: string,
  pauseTo: string | null,
  reason: string,
  by: string,
  mode: 'known' | 'open' = 'known'
): Promise<{ cancelled: number; created?: number; newEndDate?: string }> {
  const cls = await getClass(classId);
  if (!cls) throw new Error('ไม่พบข้อมูลคลาส');

  console.log(`[pauseClass] class=${classId} mode=${mode} from=${pauseFrom} to=${pauseTo}`);

  const schedules = await getScheduleRowsLite(classId);
  const targets = schedules.filter((s) => {
    if (s.status !== 'scheduled') return false;
    const d = getLocalDateString(s.sessionDate);
    if (mode === 'open') return d >= pauseFrom; // open-ended: from start onward
    return pauseTo ? d >= pauseFrom && d <= pauseTo : d >= pauseFrom;
  });
  console.log(`[pauseClass] ${targets.length} session(s) in window`);

  if (mode === 'open') {
    // Open-ended: cancel the windowed sessions (batch) + leave the class paused.
    if (targets.length > 0) {
      await adminMutation({
        table: 'class_schedules',
        operation: 'update',
        data: {
          status: 'cancelled',
          note: `[พักทั้งคลาส] ${reason || ''}`.trim(),
          rescheduled_by: asUuidOrNull(by),
          rescheduled_at: new Date().toISOString(),
        },
        filters: [{ op: 'in', column: 'id', value: targets.map((s) => s.id) }],
      });
    }
    await adminMutation({
      table: 'classes',
      operation: 'update',
      data: { pause_from: pauseFrom, pause_to: pauseTo ?? pauseFrom },
      match: { id: classId },
    });
    return { cancelled: targets.length };
  }

  // mode 'known': skip the paused weeks and shift the remaining sessions to
  // start AFTER pauseTo. Sessions before pauseFrom stay put; sessions from
  // pauseFrom onward are deleted and re-generated starting the day after pauseTo.
  const after = schedules; // current rows (nothing cancelled yet in this mode)
  const windowEnd = pauseTo || pauseFrom;
  const genFrom = (() => {
    const d = new Date(windowEnd);
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  })();

  // kept = before pauseFrom; generate from the day after pauseTo; delete from pauseFrom.
  const rows = await computeDefaultRows(cls, after, pauseFrom, genFrom);
  const result = await rebookSessions(cls, pauseFrom, rows);

  await adminMutation({
    table: 'classes',
    operation: 'update',
    data: { end_date: result.newEndDate, pause_from: null, pause_to: null },
    match: { id: classId },
  });

  console.log(
    `[pauseClass] done. cancelled ${targets.length}, rebooked ${result.created}, newEndDate ${result.newEndDate}`
  );
  return {
    cancelled: targets.length,
    created: result.created,
    newEndDate: result.newEndDate,
  };
}

// Cancel a single session and shift every remaining session one slot later
// (i.e. skip this week → everything moves ~1 week forward), WITHOUT creating any
// makeup. Used by the attendance checker's "เลื่อนคลาส (ยกคาบ)" action so a
// teacher/admin can bump a whole class at check-in time.
//
// Mechanically this is pauseClass('known') with a single-day window: the target
// session is dropped and the remaining sessions are re-generated from the class's
// weekly pattern starting after that day, extending end_date. After rebooking we
// check the new future rows for room/teacher conflicts and report the count so
// the UI can warn (an admin then resolves them) — we do NOT auto-resolve here.
export async function shiftClassFromSession(
  classId: string,
  sessionDate: string, // the session being cancelled (local YYYY-MM-DD)
  reason: string,
  by: string
): Promise<{ cancelled: number; created: number; newEndDate: string; conflicts: number }> {
  const cls = await getClass(classId);
  if (!cls) throw new Error('ไม่พบข้อมูลคลาส');

  const schedules = await getScheduleRowsLite(classId);
  const target = schedules.find(
    (s) => s.status === 'scheduled' && getLocalDateString(s.sessionDate) === sessionDate
  );
  if (!target) throw new Error('ไม่พบคาบเรียนที่จะเลื่อน (อาจถูกเช็คชื่อหรือยกเลิกไปแล้ว)');

  // Regenerate remaining sessions from the day after this one (reuses pause logic).
  const genFrom = (() => {
    const d = new Date(sessionDate);
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  })();
  const rows = await computeDefaultRows(cls, schedules, sessionDate, genFrom);
  const result = await rebookSessions(cls, sessionDate, rows);

  await adminMutation({
    table: 'classes',
    operation: 'update',
    data: { end_date: result.newEndDate, last_shift_date: sessionDate },
    match: { id: classId },
  });

  // Count room/teacher conflicts across the newly-booked dates (one RPC call).
  let conflicts = 0;
  try {
    const supabase = getClient();
    const { data, error } = await (supabase as any).rpc('check_range_availability', {
      p_dates: rows.map((r) => r.date),
      p_start_time: normalizeTime(cls.startTime),
      p_end_time: normalizeTime(cls.endTime),
      p_branch_id: cls.branchId,
      p_room_id: cls.roomId,
      p_teacher_id: cls.teacherId,
      p_exclude_class_id: classId,
    });
    if (!error) {
      conflicts = ((data || []) as any[]).filter((row) => (row.conflicts || []).length > 0).length;
    }
  } catch (e) {
    console.warn('[shiftClassFromSession] conflict check failed (non-fatal):', e);
  }

  console.log(
    `[shiftClassFromSession] class=${classId} cancelled ${target ? 1 : 0}, rebooked ${result.created}, conflicts ${conflicts}`
  );

  // แจ้งผู้ปกครองทุกคนในคลาสว่าตารางเลื่อน (fire-and-forget — noti ล่มไม่บล็อกการเลื่อน)
  notifyScheduleChange(classId, 'rescheduled', sessionDate, rows[0]?.date);

  void reason; void by; // reason/by reserved for future audit note
  return { cancelled: 1, created: result.created, newEndDate: result.newEndDate, conflicts };
}

// ยิงแจ้งเตือนเปลี่ยนตารางแบบไม่รอผล — ผ่าน API (ส่ง LINE ได้เฉพาะ server)
function notifyScheduleChange(
  classId: string,
  changeType: 'cancelled' | 'rescheduled',
  originalDate: string,
  newDate?: string
) {
  (async () => {
    try {
      const { authFetch } = await import('@/lib/auth-fetch');
      await authFetch('/api/admin/notifications/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, changeType, originalDate, newDate }),
      });
    } catch (e) {
      console.warn('[notifyScheduleChange] failed (non-fatal):', e);
    }
  })();
}

// Undo the most recent "ลายกคลาส" shift: regenerate the remaining sessions from
// the cancelled date INCLUSIVE (same pattern generator the shift used, so the
// original dates come back exactly — holidays included). Only valid while that
// date hasn't passed and none of the shifted sessions has been checked yet.
export async function undoShiftClassFromSession(
  classId: string
): Promise<{ restoredDate: string; created: number; newEndDate: string; conflicts: number }> {
  const cls = await getClass(classId);
  if (!cls) throw new Error('ไม่พบข้อมูลคลาส');
  if (!cls.lastShiftDate) throw new Error('คลาสนี้ไม่มีการลายกคลาสให้ยกเลิก');

  const shiftDate = getLocalDateString(cls.lastShiftDate);
  if (shiftDate < getLocalDateString(new Date())) {
    throw new Error('เลยวันของคาบที่ถูกเลื่อนแล้ว ไม่สามารถยกเลิกได้');
  }

  const schedules = await getScheduleRowsLite(classId);
  const touched = schedules.some(
    (s) => s.status === 'completed' && getLocalDateString(s.sessionDate) >= shiftDate
  );
  if (touched) throw new Error('มีคาบหลังวันเลื่อนถูกเช็คชื่อไปแล้ว ไม่สามารถยกเลิกได้');

  // วันที่คลาสถูกเลื่อนไปไว้ (คาบ scheduled แรกตั้งแต่ shiftDate) — ใช้บอกผู้ปกครองว่า
  // "วันเดิม" ของการเลื่อนกลับคือวันไหน
  const movedFirstDate = schedules
    .filter((s) => s.status === 'scheduled' && getLocalDateString(s.sessionDate) >= shiftDate)
    .map((s) => getLocalDateString(s.sessionDate))
    .sort()[0];

  // keptBefore = genFrom = shiftDate → the cancelled session itself is re-created.
  const rows = await computeDefaultRows(cls, schedules, shiftDate, shiftDate);
  const result = await rebookSessions(cls, shiftDate, rows);

  await adminMutation({
    table: 'classes',
    operation: 'update',
    data: { end_date: result.newEndDate, last_shift_date: null },
    match: { id: classId },
  });

  // Same non-fatal room/teacher conflict count as the shift itself.
  let conflicts = 0;
  try {
    const supabase = getClient();
    const { data, error } = await (supabase as any).rpc('check_range_availability', {
      p_dates: rows.map((r) => r.date),
      p_start_time: normalizeTime(cls.startTime),
      p_end_time: normalizeTime(cls.endTime),
      p_branch_id: cls.branchId,
      p_room_id: cls.roomId,
      p_teacher_id: cls.teacherId,
      p_exclude_class_id: classId,
    });
    if (!error) {
      conflicts = ((data || []) as any[]).filter((row) => (row.conflicts || []).length > 0).length;
    }
  } catch (e) {
    console.warn('[undoShiftClassFromSession] conflict check failed (non-fatal):', e);
  }

  console.log(
    `[undoShiftClassFromSession] class=${classId} restored from ${shiftDate}, rebooked ${result.created}, conflicts ${conflicts}`
  );

  // แจ้งผู้ปกครอง: ตารางเลื่อนกลับมาเรียนวันเดิม
  if (movedFirstDate && movedFirstDate !== shiftDate) {
    notifyScheduleChange(classId, 'rescheduled', movedFirstDate, shiftDate);
  }

  return { restoredDate: shiftDate, created: result.created, newEndDate: result.newEndDate, conflicts };
}

// Read-only: auto-fill default resume rows starting from the day after the last
// kept session (or an explicit fromDate). The editor lets the admin tweak rows.
export async function buildResumeDraft(
  classId: string,
  fromDate?: string
): Promise<{ rows: ResumeDraftSession[]; fromDate: string }> {
  const cls = await getClass(classId);
  if (!cls) throw new Error('ไม่พบข้อมูลคลาส');

  const schedules = await getClassSchedules(classId);
  const start = fromDate || nextDateAfterLastSession(schedules);
  // resume: kept = before start, generate from start (same date for both).
  const rows = await computeDefaultRows(cls, schedules, start, start);
  return { rows, fromDate: start };
}

// Thin wrapper for per-row availability checks in the resume editor
// (warns, never blocks).
export async function checkSessionAvailability(params: {
  classId: string;
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  roomId: string;
  teacherId: string;
}): Promise<{ reasons: AvailabilityIssue[]; warnings: AvailabilityWarning[] }> {
  const res = await checkAvailability({
    date: new Date(params.date),
    startTime: params.startTime,
    endTime: params.endTime,
    branchId: params.branchId,
    roomId: params.roomId,
    teacherId: params.teacherId,
    excludeId: params.classId,
    excludeType: 'class',
    allowConflicts: true,
  });
  return { reasons: res.reasons || [], warnings: res.warnings || [] };
}

// Commit the resume: replace all future scheduled rows (and any leftover
// cancelled rows) with the admin-confirmed rows from the editor. NO makeup.
// Used by both mode-B (open-ended) resume and re-editing after a mode-A pause.
export async function resumeClass(
  classId: string,
  resumeDate: string,
  rows: ResumeDraftSession[],
  _by: string
): Promise<{ created: number; deleted: number; newEndDate: string }> {
  const cls = await getClass(classId);
  if (!cls) throw new Error('ไม่พบข้อมูลคลาส');

  console.log(`[resumeClass] class=${classId} resumeDate=${resumeDate} rows=${rows.length}`);
  const result = await rebookSessions(cls, resumeDate, rows);

  await adminMutation({
    table: 'classes',
    operation: 'update',
    data: { end_date: result.newEndDate, pause_from: null, pause_to: null },
    match: { id: classId },
  });

  return result;
}

// Export functions
export {
  generateSchedules,
};

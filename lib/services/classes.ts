// lib/services/classes.ts

import { Class, ClassSchedule } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { getRoomsByBranch } from './rooms';
import { getHolidaysForBranch } from './holidays';

const TABLE_NAME = 'classes';

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
    status: row.status || 'draft',
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
    const supabase = getClient();

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
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
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
      })
      .select()
      .single();

    if (error) throw error;
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

    // Insert schedules
    const scheduleInserts = schedules.map((schedule, index) => ({
      class_id: classId,
      session_date: schedule.toISOString(),
      session_number: index + 1,
      status: 'scheduled',
    }));

    if (scheduleInserts.length > 0) {
      const { error: scheduleError } = await supabase
        .from('class_schedules')
        .insert(scheduleInserts);

      if (scheduleError) throw scheduleError;
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
    const supabase = getClient();

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

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
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
        note: row.note,
        attendance: attendance.map(att => ({
          studentId: att.studentId,
          status: att.status,
          note: att.note,
          checkedAt: att.checkedAt,
          checkedBy: att.checkedBy,
          feedback: att.feedback
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

    // Load attendance from separate table
    const { getAttendanceBySchedule } = await import('./attendance');
    const attendance = await getAttendanceBySchedule(data.id);

    return {
      id: data.id,
      classId: data.class_id,
      sessionDate: new Date(data.session_date),
      sessionNumber: data.session_number,
      topic: data.topic,
      status: data.status || 'scheduled',
      actualTeacherId: data.actual_teacher_id,
      note: data.note,
      attendance: attendance.map(att => ({
        studentId: att.studentId,
        status: att.status,
        note: att.note,
        checkedAt: att.checkedAt,
        checkedBy: att.checkedBy,
        feedback: att.feedback
      })),
      originalDate: data.original_date ? new Date(data.original_date) : undefined,
      rescheduledAt: data.rescheduled_at ? new Date(data.rescheduled_at) : undefined,
      rescheduledBy: data.rescheduled_by,
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
    const supabase = getClient();

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

    const { error } = await supabase
      .from('class_schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .eq('class_id', classId);

    if (error) throw error;
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

    const supabase = getClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ status })
      .eq('id', id);

    if (error) throw error;
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

      const timeOverlap = (
        (startTime >= cls.startTime && startTime < cls.endTime) ||
        (endTime > cls.startTime && endTime <= cls.endTime) ||
        (startTime <= cls.startTime && endTime >= cls.endTime)
      );

      return timeOverlap;
    });

    potentialClassConflicts.forEach(cls => {
      conflicts.push({
        type: 'class',
        classId: cls.id,
        className: cls.name,
        classCode: cls.code,
        startTime: cls.startTime,
        endTime: cls.endTime,
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
        note: row.note,
        attendance: attendance.map(att => ({
          studentId: att.studentId,
          status: att.status,
          note: att.note,
          checkedAt: att.checkedAt,
          checkedBy: att.checkedBy,
          feedback: att.feedback
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
    const supabase = getClient();

    const currentSchedule = await getClassSchedule(classId, scheduleId);
    if (!currentSchedule) {
      throw new Error('Schedule not found');
    }

    const { error } = await supabase
      .from('class_schedules')
      .update({
        session_date: newDate.toISOString(),
        status: 'rescheduled',
        original_date: currentSchedule.sessionDate.toISOString(),
        rescheduled_at: new Date().toISOString(),
        rescheduled_by: rescheduledBy || '',
        note: reason || ''
      })
      .eq('id', scheduleId)
      .eq('class_id', classId);

    if (error) throw error;
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
    const supabase = getClient();

    for (const { scheduleId, data } of updates) {
      const updateData: any = {};

      if (data.sessionDate) updateData.session_date = data.sessionDate.toISOString();
      if (data.originalDate) updateData.original_date = data.originalDate.toISOString();
      if (data.status) updateData.status = data.status;
      if (data.topic) updateData.topic = data.topic;
      if (data.note) updateData.note = data.note;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('class_schedules')
          .update(updateData)
          .eq('id', scheduleId)
          .eq('class_id', classId);

        if (error) throw error;
      }
    }
  } catch (error) {
    console.error('Error batch updating schedules:', error);
    throw error;
  }
}

// Fix enrolled count
export async function fixEnrolledCount(classId: string, newCount: number): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ enrolled_count: newCount })
      .eq('id', classId);

    if (error) throw error;
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
    const supabase = getClient();

    if (classDoc.status === 'published' && classDoc.startDate <= now) {
      await supabase
        .from(TABLE_NAME)
        .update({ status: 'started' })
        .eq('id', classId);
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
          await supabase
            .from(TABLE_NAME)
            .update({ status: 'completed' })
            .eq('id', classId);
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
export function getEditableFields(classData: Class): {
  basicInfo: boolean;
  schedule: boolean;
  resources: boolean;
  pricing: boolean;
  capacity: boolean;
  status: boolean;
} {
  if (classData.status === 'draft' || classData.status === 'cancelled') {
    return {
      basicInfo: true,
      schedule: true,
      resources: true,
      pricing: true,
      capacity: true,
      status: true
    };
  }

  if (classData.status === 'published' && classData.enrolledCount === 0) {
    return {
      basicInfo: true,
      schedule: true,
      resources: true,
      pricing: true,
      capacity: true,
      status: true
    };
  }

  if (classData.status === 'published' && classData.enrolledCount > 0) {
    return {
      basicInfo: true,
      schedule: false,
      resources: false,
      pricing: false,
      capacity: true,
      status: true
    };
  }

  if (classData.status === 'started') {
    return {
      basicInfo: true,
      schedule: false,
      resources: false,
      pricing: false,
      capacity: false,
      status: true
    };
  }

  return {
    basicInfo: false,
    schedule: false,
    resources: false,
    pricing: false,
    capacity: false,
    status: false
  };
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
    const supabase = getClient();
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
      const { error: cancelError } = await supabase
        .from('class_schedules')
        .update({ status: 'cancelled' })
        .in('id', futureScheduleIds);

      if (cancelError) {
        console.error('Error cancelling future sessions:', cancelError);
        throw cancelError;
      }
    }

    // Update class: set status to completed and update end_date
    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        status: 'completed',
        end_date: newEndDate,
      })
      .eq('id', classId);

    if (updateError) throw updateError;

    return { newEndDate };
  } catch (error) {
    console.error('Error ending class:', error);
    throw error;
  }
}

// Export functions
export {
  generateSchedules,
};

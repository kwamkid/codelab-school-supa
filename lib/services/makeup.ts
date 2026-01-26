// lib/services/makeup.ts - Migrated to Supabase

import { getClient } from '@/lib/supabase/client';
import { MakeupClass } from '@/types/models';
import { getClassSchedule, updateClassSchedule, getClass } from './classes';
import { getStudentWithParent } from './parents';
import { getBranch } from './branches';
import { getSubject } from './subjects';
import { sendMakeupNotification } from './line-notifications';

// Helper function to convert database row to MakeupClass
function dbRowToMakeupClass(row: any): MakeupClass {
  return {
    id: row.id,
    type: row.type,
    originalClassId: row.original_class_id,
    originalScheduleId: row.original_schedule_id,
    originalSessionNumber: row.original_session_number,
    originalSessionDate: row.original_session_date ? new Date(row.original_session_date) : undefined,

    className: row.class_name || '',
    classCode: row.class_code || '',
    subjectId: row.subject_id || '',
    subjectName: row.subject_name || '',

    studentId: row.student_id,
    studentName: row.student_name || '',
    studentNickname: row.student_nickname || '',

    parentId: row.parent_id,
    parentName: row.parent_name || '',
    parentPhone: row.parent_phone || '',
    parentLineUserId: row.parent_line_user_id,

    branchId: row.branch_id || '',
    branchName: row.branch_name || '',

    requestDate: row.request_date ? new Date(row.request_date) : new Date(),
    requestedBy: row.requested_by,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,

    makeupSchedule: row.makeup_date ? {
      date: new Date(row.makeup_date),
      startTime: row.makeup_start_time,
      endTime: row.makeup_end_time,
      teacherId: row.makeup_teacher_id,
      teacherName: row.makeup_teacher_name,
      branchId: row.makeup_branch_id,
      roomId: row.makeup_room_id,
      roomName: row.makeup_room_name,
      confirmedAt: row.makeup_confirmed_at ? new Date(row.makeup_confirmed_at) : undefined,
      confirmedBy: row.makeup_confirmed_by,
    } : undefined,

    attendance: row.attendance_status ? {
      status: row.attendance_status,
      checkedBy: row.attendance_checked_by,
      checkedAt: row.attendance_checked_at ? new Date(row.attendance_checked_at) : new Date(),
      note: row.attendance_note,
    } : undefined,
  } as MakeupClass;
}

// Get all makeup classes - Now with denormalized data! ✨
export async function getMakeupClasses(branchId?: string | null): Promise<MakeupClass[]> {
  try {
    const supabase = getClient();
    let query = supabase
      .from('makeup_classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(dbRowToMakeupClass);
  } catch (error) {
    console.error('Error getting makeup classes:', error);
    throw error;
  }
}

// Get makeup classes by student
export async function getMakeupClassesByStudent(studentId: string): Promise<MakeupClass[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(dbRowToMakeupClass);
  } catch (error) {
    console.error('Error getting makeup classes by student:', error);
    throw error;
  }
}

// Get makeup classes by class
export async function getMakeupClassesByClass(classId: string): Promise<MakeupClass[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('original_class_id', classId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(dbRowToMakeupClass);
  } catch (error) {
    console.error('Error getting makeup classes by class:', error);
    throw error;
  }
}

// Get single makeup class
export async function getMakeupClass(id: string): Promise<MakeupClass | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return dbRowToMakeupClass(data);
  } catch (error) {
    console.error('Error getting makeup class:', error);
    throw error;
  }
}

// Count makeup classes for student in a class
export async function getMakeupCount(studentId: string, classId: string): Promise<number> {
  try {
    const supabase = getClient();
    const { count, error } = await supabase
      .from('makeup_classes')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('original_class_id', classId)
      .neq('status', 'cancelled');

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Error counting makeup classes:', error);
    return 0;
  }
}

// Check if student can create more makeup for a class
export async function canCreateMakeup(
  studentId: string, 
  classId: string,
  bypassLimit: boolean = false
): Promise<{ allowed: boolean; currentCount: number; limit: number; message?: string }> {
  try {
    const { getMakeupSettings } = await import('./settings');
    const settings = await getMakeupSettings();
    
    if (!settings.autoCreateMakeup && !bypassLimit) {
      return {
        allowed: false,
        currentCount: 0,
        limit: 0,
        message: 'การสร้าง Makeup อัตโนมัติถูกปิดอยู่'
      };
    }
    
    const currentCount = await getMakeupCount(studentId, classId);
    
    if (settings.makeupLimitPerCourse === 0 || bypassLimit) {
      return {
        allowed: true,
        currentCount,
        limit: settings.makeupLimitPerCourse,
      };
    }
    
    const allowed = currentCount < settings.makeupLimitPerCourse;
    
    return {
      allowed,
      currentCount,
      limit: settings.makeupLimitPerCourse,
      message: allowed ? undefined : `เกินจำนวนครั้งที่ชดเชยได้ (${currentCount}/${settings.makeupLimitPerCourse})`
    };
  } catch (error) {
    console.error('Error checking makeup limit:', error);
    return {
      allowed: true,
      currentCount: 0,
      limit: 0
    };
  }
}

// Get makeup requests for specific schedules
export async function getMakeupRequestsBySchedules(
  studentId: string,
  classId: string,
  scheduleIds: string[]
): Promise<Record<string, MakeupClass>> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('student_id', studentId)
      .eq('original_class_id', classId)
      .neq('status', 'cancelled');

    if (error) throw error;

    const makeupBySchedule: Record<string, MakeupClass> = {};

    (data || []).forEach(row => {
      if (scheduleIds.includes(row.original_schedule_id)) {
        const makeup = dbRowToMakeupClass(row);
        makeupBySchedule[row.original_schedule_id] = makeup;
      }
    });

    return makeupBySchedule;
  } catch (error) {
    console.error('Error getting makeup requests by schedules:', error);
    return {};
  }
}

// Check if makeup already exists for a schedule
export async function checkMakeupExists(
  studentId: string,
  classId: string,
  scheduleId: string
): Promise<MakeupClass | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('student_id', studentId)
      .eq('original_class_id', classId)
      .eq('original_schedule_id', scheduleId)
      .neq('status', 'cancelled')
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) return null;

    return dbRowToMakeupClass(data[0]);
  } catch (error) {
    console.error('Error checking makeup exists:', error);
    return null;
  }
}

// Create makeup class request
export async function createMakeupRequest(
  data: Omit<MakeupClass, 'id' | 'createdAt' | 'updatedAt' | 'className' | 'classCode' | 'subjectId' | 'subjectName' | 'studentName' | 'studentNickname' | 'parentName' | 'parentPhone' | 'parentLineUserId' | 'branchId' | 'branchName'>
): Promise<string> {
  try {
    // Check if makeup already exists
    const existingMakeup = await checkMakeupExists(
      data.studentId,
      data.originalClassId,
      data.originalScheduleId
    );

    if (existingMakeup) {
      throw new Error('Makeup request already exists for this schedule');
    }

    // Load all required data for denormalization
    const [student, classData, schedule] = await Promise.all([
      getStudentWithParent(data.studentId),
      getClass(data.originalClassId),
      getClassSchedule(data.originalClassId, data.originalScheduleId)
    ]);

    if (!student) {
      throw new Error('Student not found');
    }

    if (!classData) {
      throw new Error('Class not found');
    }

    // Load additional data
    const [subject, branch] = await Promise.all([
      getSubject(classData.subjectId),
      getBranch(classData.branchId)
    ]);

    const supabase = getClient();

    // Create makeup request with denormalized data
    const { data: insertedData, error: insertError } = await supabase
      .from('makeup_classes')
      .insert({
        // Original data
        type: data.type,
        original_class_id: data.originalClassId,
        original_schedule_id: data.originalScheduleId,
        original_session_number: schedule?.sessionNumber || null,
        original_session_date: schedule?.sessionDate ? schedule.sessionDate.toISOString() : null,

        // Denormalized class data
        class_name: classData.name,
        class_code: classData.code,
        subject_id: classData.subjectId,
        subject_name: subject?.name || '',

        // Student data
        student_id: data.studentId,
        student_name: student.name,
        student_nickname: student.nickname || '',

        // Parent data
        parent_id: student.parentId,
        parent_name: student.parentName,
        parent_phone: student.parentPhone,
        parent_line_user_id: student.parentLineUserId || null,

        // Branch data
        branch_id: classData.branchId,
        branch_name: branch?.name || '',

        // Request info
        request_date: data.requestDate.toISOString(),
        requested_by: data.requestedBy,
        reason: data.reason,
        status: 'pending',
        notes: data.notes || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Update original schedule attendance
    if (schedule) {
      const updatedAttendance = schedule.attendance || [];
      const studentIndex = updatedAttendance.findIndex(a => a.studentId === data.studentId);

      console.log('🔄 Updating schedule attendance for makeup request:', {
        scheduleId: data.originalScheduleId,
        studentId: data.studentId,
        currentAttendanceCount: updatedAttendance.length,
        scheduleStatus: schedule.status
      });

      if (studentIndex >= 0) {
        updatedAttendance[studentIndex] = {
          studentId: data.studentId,
          status: 'absent',
          note: `Makeup requested: ${data.reason}`
        };
      } else {
        updatedAttendance.push({
          studentId: data.studentId,
          status: 'absent',
          note: `Makeup requested: ${data.reason}`
        });
      }

      console.log('📝 Calling updateClassSchedule with attendance:', {
        attendanceCount: updatedAttendance.length,
        statuses: updatedAttendance.map(a => a.status)
      });

      await updateClassSchedule(data.originalClassId, data.originalScheduleId, {
        attendance: updatedAttendance
      });

      console.log('✅ Schedule updated successfully');
    }

    return insertedData.id;
  } catch (error) {
    console.error('Error creating makeup request:', error);
    throw error;
  }
}

// Schedule makeup class with LINE notification
export async function scheduleMakeupClass(
  makeupId: string,
  scheduleData: MakeupClass['makeupSchedule'] & { confirmedBy: string }
): Promise<void> {
  try {
    // Load teacher and room names for denormalization
    const [teacher, room] = await Promise.all([
      import('./teachers').then(m => m.getTeacher(scheduleData.teacherId)),
      import('./rooms').then(m => m.getRoom(scheduleData.branchId, scheduleData.roomId))
    ]);

    const supabase = getClient();

    // Update with denormalized teacher/room names
    const { error } = await supabase
      .from('makeup_classes')
      .update({
        status: 'scheduled',
        makeup_date: scheduleData.date.toISOString(),
        makeup_start_time: scheduleData.startTime,
        makeup_end_time: scheduleData.endTime,
        makeup_teacher_id: scheduleData.teacherId,
        makeup_teacher_name: teacher?.nickname || teacher?.name || null,
        makeup_branch_id: scheduleData.branchId,
        makeup_room_id: scheduleData.roomId,
        makeup_room_name: room?.name || null,
        makeup_confirmed_at: new Date().toISOString(),
        makeup_confirmed_by: scheduleData.confirmedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', makeupId);

    if (error) throw error;

    // Send LINE notification
    try {
      await sendMakeupNotification(makeupId, 'scheduled');
      console.log(`LINE notification sent for scheduled makeup ${makeupId}`);
    } catch (notificationError) {
      console.error('Error sending LINE notification:', notificationError);
    }
  } catch (error) {
    console.error('Error scheduling makeup class:', error);
    throw error;
  }
}

// Record makeup attendance
export async function recordMakeupAttendance(
  makeupId: string,
  attendance: {
    status: 'present' | 'absent';
    checkedBy: string;
    note?: string;
  }
): Promise<void> {
  try {
    const supabase = getClient();

    const { error } = await supabase
      .from('makeup_classes')
      .update({
        status: 'completed',
        attendance_status: attendance.status,
        attendance_checked_by: attendance.checkedBy,
        attendance_checked_at: new Date().toISOString(),
        attendance_note: attendance.note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', makeupId);

    if (error) throw error;
  } catch (error) {
    console.error('Error recording makeup attendance:', error);
    throw error;
  }
}

// Cancel makeup class
export async function cancelMakeupClass(
  makeupId: string,
  reason: string,
  cancelledBy: string
): Promise<void> {
  try {
    const supabase = getClient();

    const { error } = await supabase
      .from('makeup_classes')
      .update({
        status: 'cancelled',
        notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', makeupId);

    if (error) throw error;
  } catch (error) {
    console.error('Error cancelling makeup class:', error);
    throw error;
  }
}

// Get upcoming makeup classes for a branch
export async function getUpcomingMakeupClasses(
  branchId: string,
  startDate: Date,
  endDate: Date
): Promise<MakeupClass[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('status', 'scheduled')
      .eq('branch_id', branchId)
      .gte('makeup_date', startDate.toISOString())
      .lte('makeup_date', endDate.toISOString())
      .order('makeup_date', { ascending: true });

    if (error) throw error;

    return (data || []).map(dbRowToMakeupClass);
  } catch (error) {
    console.error('Error getting upcoming makeup classes:', error);
    throw error;
  }
}

// Get makeup classes that need reminder tomorrow
export async function getMakeupClassesForReminder(tomorrowDate: Date): Promise<MakeupClass[]> {
  try {
    const startOfDay = new Date(tomorrowDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(tomorrowDate);
    endOfDay.setHours(23, 59, 59, 999);

    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('status', 'scheduled')
      .gte('makeup_date', startOfDay.toISOString())
      .lte('makeup_date', endOfDay.toISOString());

    if (error) throw error;

    return (data || []).map(dbRowToMakeupClass);
  } catch (error) {
    console.error('Error getting makeup classes for reminder:', error);
    return [];
  }
}

// Update makeup attendance
export async function updateMakeupAttendance(
  makeupId: string,
  attendance: {
    status: 'present' | 'absent';
    checkedBy: string;
    note?: string;
  }
): Promise<void> {
  try {
    const makeup = await getMakeupClass(makeupId);
    if (!makeup) {
      throw new Error('Makeup class not found');
    }

    if (makeup.status !== 'completed') {
      throw new Error('Can only update attendance for completed makeup classes');
    }

    const supabase = getClient();
    const { error } = await supabase
      .from('makeup_classes')
      .update({
        attendance_status: attendance.status,
        attendance_checked_by: attendance.checkedBy,
        attendance_checked_at: new Date().toISOString(),
        attendance_note: attendance.note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', makeupId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating makeup attendance:', error);
    throw error;
  }
}

// Revert makeup to scheduled status
export async function revertMakeupToScheduled(
  makeupId: string,
  revertedBy: string,
  reason: string
): Promise<void> {
  try {
    const makeup = await getMakeupClass(makeupId);
    if (!makeup) {
      throw new Error('Makeup class not found');
    }

    if (makeup.status !== 'completed') {
      throw new Error('Can only revert completed makeup classes');
    }

    const supabase = getClient();

    // Update makeup class
    const { error: updateError } = await supabase
      .from('makeup_classes')
      .update({
        status: 'scheduled',
        attendance_status: null,
        attendance_checked_by: null,
        attendance_checked_at: null,
        attendance_note: null,
        updated_at: new Date().toISOString(),
        notes: `${makeup.notes || ''}\n[${new Date().toLocaleDateString('th-TH')}] ยกเลิกการบันทึกเข้าเรียน: ${reason} (โดย ${revertedBy})`
      })
      .eq('id', makeupId);

    if (updateError) throw updateError;

    // Create audit log
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        type: 'makeup_attendance_reverted',
        document_id: makeupId,
        performed_by: revertedBy,
        performed_at: new Date().toISOString(),
        reason,
        previous_data: {
          status: makeup.status,
          attendance: makeup.attendance
        }
      });

    if (logError) {
      console.error('Error creating audit log:', logError);
      // Don't throw, just log the error
    }
  } catch (error) {
    console.error('Error reverting makeup status:', error);
    throw error;
  }
}

// Delete makeup class - Uses API route to bypass RLS restrictions
export async function deleteMakeupClass(
  makeupId: string,
  deletedBy: string,
  reason?: string
): Promise<void> {
  try {
    const response = await fetch(`/api/admin/makeup/${makeupId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deletedBy, reason }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete makeup class');
    }
  } catch (error) {
    console.error('Error deleting makeup class:', error);
    throw error;
  }
}

// Check teacher availability
export async function checkTeacherAvailability(
  teacherId: string,
  date: Date,
  startTime: string,
  endTime: string,
  branchId: string,
  roomId: string,
  excludeMakeupId?: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const { checkAvailability } = await import('../utils/availability');
    
    const result = await checkAvailability({
      date,
      startTime,
      endTime,
      branchId,
      roomId,
      teacherId,
      excludeId: excludeMakeupId,
      excludeType: 'makeup'
    });
    
    if (!result.available) {
      const firstIssue = result.reasons[0];
      return {
        available: false,
        reason: firstIssue.message
      };
    }
    
    return { available: true };
  } catch (error) {
    console.error('Error checking teacher availability:', error);
    return { available: false, reason: 'เกิดข้อผิดพลาดในการตรวจสอบ' };
  }
}

// Get makeup class by original schedule
export async function getMakeupByOriginalSchedule(
  studentId: string,
  classId: string,
  scheduleId: string
): Promise<MakeupClass | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('student_id', studentId)
      .eq('original_class_id', classId)
      .eq('original_schedule_id', scheduleId)
      .in('status', ['pending', 'scheduled'])
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return dbRowToMakeupClass(data[0]);
    }

    return null;
  } catch (error) {
    console.error('Error getting makeup by original schedule:', error);
    return null;
  }
}

// Delete makeup class for schedule
export async function deleteMakeupForSchedule(
  studentId: string,
  classId: string,
  scheduleId: string,
  deletedBy: string,
  reason: string = 'Attendance updated to present'
): Promise<void> {
  try {
    const makeup = await getMakeupByOriginalSchedule(studentId, classId, scheduleId);
    if (!makeup) return;

    if (makeup.status === 'completed') {
      await cancelMakeupClass(makeup.id, reason, deletedBy);
    } else {
      await deleteMakeupClass(makeup.id, deletedBy, reason);
    }
  } catch (error) {
    console.error('Error deleting makeup for schedule:', error);
    throw error;
  }
}
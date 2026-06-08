// lib/services/attendance.ts

import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

// Attendance record interface
export interface AttendanceRecord {
  id: string;
  scheduleId: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'sick' | 'leave';
  note?: string;
  feedback?: string;
  checkedAt?: Date;
  checkedBy?: string;
}

// Database row interface
interface AttendanceRow {
  id: string;
  schedule_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'sick' | 'leave';
  note: string | null;
  feedback: string | null;
  checked_at: string | null;
  checked_by: string | null;
}

// Map database row to model
function mapToAttendance(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    studentId: row.student_id,
    status: row.status,
    note: row.note || undefined,
    feedback: row.feedback || undefined,
    checkedAt: row.checked_at ? new Date(row.checked_at) : undefined,
    checkedBy: row.checked_by || undefined
  };
}

// Get all attendance records for a schedule
export async function getAttendanceBySchedule(scheduleId: string): Promise<AttendanceRecord[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('student_id');

    if (error) throw error;
    return (data || []).map(mapToAttendance);
  } catch (error) {
    console.error('Error getting attendance by schedule:', error);
    return [];
  }
}

// Get single attendance record
export async function getAttendanceRecord(
  scheduleId: string,
  studentId: string
): Promise<AttendanceRecord | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? mapToAttendance(data) : null;
  } catch (error) {
    console.error('Error getting attendance record:', error);
    return null;
  }
}

// Save attendance for a schedule (per-record update/insert)
export async function saveAttendance(
  scheduleId: string,
  attendanceRecords: Array<{
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'sick' | 'leave';
    note?: string;
    feedback?: string;
    checkedAt?: Date;
    checkedBy?: string;
  }>
): Promise<void> {
  try {
    const supabase = getClient();

    // Get existing attendance for this schedule
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, student_id')
      .eq('schedule_id', scheduleId);

    const existingMap = new Map((existing || []).map(row => [row.student_id, row.id]));
    const newStudentIds = attendanceRecords.map(r => r.studentId);

    // Update existing records or insert new ones
    for (const record of attendanceRecords) {
      const existingId = existingMap.get(record.studentId);
      const rowData = {
        schedule_id: scheduleId,
        student_id: record.studentId,
        status: record.status,
        note: record.note || null,
        feedback: record.feedback || null,
        checked_at: record.checkedAt ? record.checkedAt.toISOString() : new Date().toISOString(),
        checked_by: record.checkedBy || null
      };

      if (existingId) {
        // Update existing record
        await adminMutation({
          table: 'attendance',
          operation: 'update',
          data: rowData,
          match: { id: existingId }
        });
      } else {
        // Insert new record
        await adminMutation({
          table: 'attendance',
          operation: 'insert',
          data: rowData
        });
      }
    }

    // Delete records for students no longer in the list
    const toDelete = (existing || [])
      .filter(row => !newStudentIds.includes(row.student_id));

    for (const row of toDelete) {
      await adminMutation({
        table: 'attendance',
        operation: 'delete',
        match: { id: row.id }
      });
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
    throw error;
  }
}

// Update single attendance record
export async function updateAttendanceRecord(
  scheduleId: string,
  studentId: string,
  data: {
    status?: 'present' | 'absent' | 'late' | 'sick' | 'leave';
    note?: string;
    feedback?: string;
    checkedAt?: Date;
    checkedBy?: string;
  }
): Promise<void> {
  try {
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.feedback !== undefined) updateData.feedback = data.feedback;
    if (data.checkedAt !== undefined) updateData.checked_at = data.checkedAt.toISOString();
    if (data.checkedBy !== undefined) updateData.checked_by = data.checkedBy;

    await adminMutation({
      table: 'attendance',
      operation: 'update',
      data: updateData,
      match: { schedule_id: scheduleId, student_id: studentId }
    });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    throw error;
  }
}

// Delete attendance record
export async function deleteAttendanceRecord(
  scheduleId: string,
  studentId: string
): Promise<void> {
  try {
    await adminMutation({
      table: 'attendance',
      operation: 'delete',
      match: { schedule_id: scheduleId, student_id: studentId }
    });
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    throw error;
  }
}

// Delete all attendance for a schedule
export async function deleteAttendanceBySchedule(scheduleId: string): Promise<void> {
  try {
    await adminMutation({
      table: 'attendance',
      operation: 'delete',
      match: { schedule_id: scheduleId }
    });
  } catch (error) {
    console.error('Error deleting attendance by schedule:', error);
    throw error;
  }
}

// Get attendance statistics for a schedule
export async function getAttendanceStats(scheduleId: string): Promise<{
  total: number;
  present: number;
  absent: number;
  late: number;
  sick: number;
  leave: number;
}> {
  try {
    const records = await getAttendanceBySchedule(scheduleId);

    const stats = {
      total: records.length,
      present: 0,
      absent: 0,
      late: 0,
      sick: 0,
      leave: 0
    };

    records.forEach(record => {
      stats[record.status]++;
    });

    return stats;
  } catch (error) {
    console.error('Error getting attendance stats:', error);
    return {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      sick: 0,
      leave: 0
    };
  }
}

// ============================================
// Save attendance + auto create/cancel makeup (shared by attendance page & dashboard modal)
// ============================================
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'sick' | 'leave';

export async function saveAttendanceWithMakeup(params: {
  classId: string;
  scheduleId: string;
  records: Array<{ studentId: string; studentName?: string; status: AttendanceStatus | ''; note?: string; feedback?: string }>;
  initialStatuses?: Record<string, string>;
  checkedBy: string;
  actualTeacherId?: string;
  globalNote?: string;
  sessionNumber?: number;
  sessionDate?: Date;
}): Promise<{ makeupCreated: number; makeupCancelled: number; limitExceeded: string[] }> {
  const { updateClassSchedule } = await import('./classes');
  const { getMakeupSettings } = await import('./settings');
  const { getMakeupCount, getMakeupByOriginalSchedule, deleteMakeupForSchedule, createMakeupRequest } = await import('./makeup');
  const { getStudentWithParent } = await import('./parents');

  const { classId, scheduleId, initialStatuses = {}, checkedBy, actualTeacherId, globalNote, sessionNumber, sessionDate } = params;

  const toSave = params.records.filter(
    (r): r is { studentId: string; studentName?: string; status: AttendanceStatus; note?: string; feedback?: string } => r.status !== ''
  );

  const attendanceData = toSave.map((r) => ({
    studentId: r.studentId,
    status: r.status,
    note: r.note,
    feedback: r.feedback,
    checkedAt: new Date(),
    checkedBy,
  }));

  // Save the schedule + attendance (status completed when at least one record)
  await updateClassSchedule(classId, scheduleId, {
    actualTeacherId,
    attendance: attendanceData,
    note: globalNote,
    status: attendanceData.length > 0 ? 'completed' : 'scheduled',
  });

  const makeupSettings = await getMakeupSettings();
  const absentStatuses = makeupSettings.allowMakeupForStatuses as string[];
  let makeupCancelled = 0;
  let makeupCreated = 0;
  const limitExceeded: string[] = [];

  // 1) Cancel makeup for students changed FROM absent/sick/leave TO present/late
  const changedToPresent = toSave.filter((r) => {
    const prev = initialStatuses[r.studentId];
    const wasAbsent = !!prev && absentStatuses.includes(prev);
    const nowPresent = r.status === 'present' || r.status === 'late';
    return wasAbsent && nowPresent;
  });
  for (const s of changedToPresent) {
    try {
      await deleteMakeupForSchedule(s.studentId, classId, scheduleId, checkedBy, 'แก้ไขการเช็คชื่อ - เปลี่ยนเป็นมาเรียน');
      makeupCancelled++;
    } catch (e) {
      console.warn('Failed to cancel makeup', s.studentId, e);
    }
  }

  // 2) Create makeup for newly absent students
  const forMakeup = toSave.filter((r) => absentStatuses.includes(r.status));
  if (makeupSettings.autoCreateMakeup && forMakeup.length > 0) {
    for (const s of forMakeup) {
      try {
        const existing = await getMakeupByOriginalSchedule(s.studentId, classId, scheduleId);
        if (existing) continue;
        if (makeupSettings.makeupLimitPerCourse > 0) {
          const cnt = await getMakeupCount(s.studentId, classId);
          if (cnt >= makeupSettings.makeupLimitPerCourse) {
            limitExceeded.push(s.studentName || s.studentId);
            continue;
          }
        }
        const sd = await getStudentWithParent(s.studentId);
        if (sd) {
          await createMakeupRequest({
            type: 'ad-hoc',
            originalClassId: classId,
            originalScheduleId: scheduleId,
            studentId: s.studentId,
            parentId: sd.parentId,
            requestDate: new Date(),
            requestedBy: checkedBy,
            reason: s.status === 'sick' ? 'ป่วย' : s.status === 'leave' ? 'ลา' : 'ขาดเรียน',
            status: 'pending',
            originalSessionNumber: sessionNumber,
            originalSessionDate: sessionDate,
          } as any);
          makeupCreated++;
        }
      } catch (e) {
        console.error('Error creating makeup for student', s.studentId, e);
      }
    }
  }

  return { makeupCreated, makeupCancelled, limitExceeded };
}

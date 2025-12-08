// lib/services/attendance.ts

import { getClient } from '@/lib/supabase/client';

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

// Save attendance for a schedule (batch upsert)
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

    // First, delete all existing attendance for this schedule
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('schedule_id', scheduleId);

    if (deleteError) throw deleteError;

    // Then insert new attendance records
    if (attendanceRecords.length > 0) {
      const insertData = attendanceRecords.map(record => ({
        schedule_id: scheduleId,
        student_id: record.studentId,
        status: record.status,
        note: record.note || null,
        feedback: record.feedback || null,
        checked_at: record.checkedAt ? record.checkedAt.toISOString() : new Date().toISOString(),
        checked_by: record.checkedBy || null
      }));

      const { error: insertError } = await supabase
        .from('attendance')
        .insert(insertData);

      if (insertError) throw insertError;
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
    const supabase = getClient();

    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.feedback !== undefined) updateData.feedback = data.feedback;
    if (data.checkedAt !== undefined) updateData.checked_at = data.checkedAt.toISOString();
    if (data.checkedBy !== undefined) updateData.checked_by = data.checkedBy;

    const { error } = await supabase
      .from('attendance')
      .update(updateData)
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId);

    if (error) throw error;
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
    const supabase = getClient();
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    throw error;
  }
}

// Delete all attendance for a schedule
export async function deleteAttendanceBySchedule(scheduleId: string): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('schedule_id', scheduleId);

    if (error) throw error;
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

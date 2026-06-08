import { getClient } from '@/lib/supabase/client';
import { getClass } from './classes';
import { getSubject } from './subjects';
import { getTeacher } from './teachers';
import { getStudentsByParent } from './parents';

export interface StudentFeedbackHistory {
  id: string;
  studentId: string;
  parentId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  scheduleId: string;
  sessionNumber: number;
  sessionDate: Date;
  feedback: string;
  photos: string[];
  teacherId: string;
  teacherName: string;
  createdAt: Date;
}

// Get feedback history for a student — reads the Supabase `attendance` table
// (records that have feedback text and/or photos), resolving class/subject/teacher.
export async function getStudentFeedbackHistory(
  studentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<StudentFeedbackHistory[]> {
  try {
    const supabase = getClient();

    // 1. Attendance rows for this student that carry feedback or photos
    const { data: attRows, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId);
    if (error) throw error;

    const relevant = (attRows || []).filter(
      (r: any) => (r.feedback && r.feedback.trim()) || (Array.isArray(r.photos) && r.photos.length > 0)
    );
    if (relevant.length === 0) return [];

    // 2. Load the schedules these records belong to
    const scheduleIds = [...new Set(relevant.map((r: any) => r.schedule_id))];
    const { data: schedRows } = await supabase
      .from('class_schedules')
      .select('id, class_id, session_number, session_date, actual_teacher_id')
      .in('id', scheduleIds as string[]);
    const scheduleMap = new Map((schedRows || []).map((s: any) => [s.id, s]));

    // Small caches to avoid refetching the same class/subject/teacher
    const classCache = new Map<string, any>();
    const subjectCache = new Map<string, any>();
    const teacherCache = new Map<string, any>();
    const getClassCached = async (id: string) => {
      if (!classCache.has(id)) classCache.set(id, await getClass(id));
      return classCache.get(id);
    };
    const getSubjectCached = async (id: string) => {
      if (!subjectCache.has(id)) subjectCache.set(id, await getSubject(id));
      return subjectCache.get(id);
    };
    const getTeacherCached = async (id: string) => {
      if (!teacherCache.has(id)) teacherCache.set(id, await getTeacher(id));
      return teacherCache.get(id);
    };

    const history: StudentFeedbackHistory[] = [];

    for (const r of relevant) {
      const schedule = scheduleMap.get(r.schedule_id);
      if (!schedule) continue;

      const sessionDate = new Date(schedule.session_date);
      if (startDate && sessionDate < startDate) continue;
      if (endDate && sessionDate > endDate) continue;

      const classData = await getClassCached(schedule.class_id);
      if (!classData) continue;

      const subject = await getSubjectCached(classData.subjectId);
      const teacherId = schedule.actual_teacher_id || classData.teacherId;
      const teacher = await getTeacherCached(teacherId);

      history.push({
        id: r.id,
        studentId,
        parentId: '',
        classId: classData.id,
        className: classData.name,
        subjectId: classData.subjectId,
        subjectName: subject?.name || '',
        scheduleId: schedule.id,
        sessionNumber: schedule.session_number,
        sessionDate,
        feedback: r.feedback || '',
        photos: Array.isArray(r.photos) ? r.photos : [],
        teacherId,
        teacherName: teacher?.nickname || teacher?.name || '',
        createdAt: r.checked_at ? new Date(r.checked_at) : sessionDate,
      });
    }

    return history.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());
  } catch (error) {
    console.error('Error getting student feedback history:', error);
    return [];
  }
}

// Get all feedback for a parent's students
export async function getParentFeedbackHistory(
  parentId: string
): Promise<StudentFeedbackHistory[]> {
  try {
    const students = await getStudentsByParent(parentId);

    const allFeedback: StudentFeedbackHistory[] = [];
    for (const student of students) {
      if (!student.isActive) continue;
      const feedbacks = await getStudentFeedbackHistory(student.id);
      allFeedback.push(...feedbacks.map(f => ({ ...f, parentId })));
    }

    return allFeedback.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());
  } catch (error) {
    console.error('Error getting parent feedback history:', error);
    return [];
  }
}

// Get feedback count for notification badge
export async function getUnreadFeedbackCount(
  parentId: string,
  lastReadDate?: Date
): Promise<number> {
  try {
    const feedbacks = await getParentFeedbackHistory(parentId);
    if (!lastReadDate) return feedbacks.length;
    return feedbacks.filter(f => f.createdAt > lastReadDate).length;
  } catch (error) {
    console.error('Error getting unread feedback count:', error);
    return 0;
  }
}

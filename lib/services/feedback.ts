import { getClass } from './classes';
import { getSubject } from './subjects';
import { getTeacher } from './teachers';
import { getStudent } from './parents';

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
  teacherId: string;
  teacherName: string;
  createdAt: Date;
}

// Get feedback history for a student
export async function getStudentFeedbackHistory(
  studentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<StudentFeedbackHistory[]> {
  try {
    // Get all enrollments for this student
    const { getEnrollmentsByStudent } = await import('./enrollments');
    const enrollments = await getEnrollmentsByStudent(studentId);
    
    const feedbackHistory: StudentFeedbackHistory[] = [];
    
    // For each enrollment, get class schedules with feedback
    for (const enrollment of enrollments) {
      const classData = await getClass(enrollment.classId);
      if (!classData) continue;
      
      const subject = await getSubject(classData.subjectId);
      const teacher = await getTeacher(classData.teacherId);
      
      // Get schedules for this class
      const schedulesRef = collection(db, 'classes', enrollment.classId, 'schedules');
      let q = query(schedulesRef, orderBy('sessionDate', 'desc'));
      
      const querySnapshot = await getDocs(q);
      
      for (const doc of querySnapshot.docs) {
        const schedule = doc.data();
        const sessionDate = schedule.sessionDate.toDate();
        
        // Filter by date if provided
        if (startDate && sessionDate < startDate) continue;
        if (endDate && sessionDate > endDate) continue;
        
        // Check if this student has feedback in this session
        if (schedule.attendance) {
          const studentAttendance = schedule.attendance.find(
            (att: any) => att.studentId === studentId && att.feedback
          );
          
          if (studentAttendance && studentAttendance.feedback) {
            feedbackHistory.push({
              id: `${enrollment.classId}-${doc.id}`,
              studentId,
              parentId: enrollment.parentId,
              classId: enrollment.classId,
              className: classData.name,
              subjectId: classData.subjectId,
              subjectName: subject?.name || '',
              scheduleId: doc.id,
              sessionNumber: schedule.sessionNumber,
              sessionDate,
              feedback: studentAttendance.feedback,
              teacherId: schedule.actualTeacherId || classData.teacherId,
              teacherName: teacher?.nickname || teacher?.name || '',
              createdAt: studentAttendance.checkedAt?.toDate() || sessionDate
            });
          }
        }
      }
    }
    
    // Sort by date descending
    return feedbackHistory.sort((a, b) => 
      b.sessionDate.getTime() - a.sessionDate.getTime()
    );
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
    const { getStudentsByParent } = await import('./parents');
    const students = await getStudentsByParent(parentId);
    
    const allFeedback: StudentFeedbackHistory[] = [];
    
    for (const student of students) {
      if (!student.isActive) continue;
      const feedbacks = await getStudentFeedbackHistory(student.id);
      allFeedback.push(...feedbacks);
    }
    
    return allFeedback.sort((a, b) => 
      b.sessionDate.getTime() - a.sessionDate.getTime()
    );
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
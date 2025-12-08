// lib/services/liff-schedule.ts

import { getParentByLineId, getStudentsByParent } from './parents';
import { getEnrollmentsByStudent } from './enrollments';
import { getClass, getClassSchedules } from './classes';
import { getMakeupClassesByStudent } from './makeup';
import { getSubjects } from './subjects';
import { getTeachers } from './teachers';
import { getBranches } from './branches';
import { getRoomsByBranch } from './rooms';
import { ScheduleEvent } from '@/components/liff/schedule-calendar';

export interface StudentScheduleData {
  student: {
    id: string;
    name: string;
    nickname?: string;
    profileImage?: string;
  };
  enrollments: any[];
  classes: any[];
  makeupClasses: any[];
}

export interface StudentStats {
  totalClasses: number;
  completedClasses: number;
  upcomingClasses: number;
  makeupClasses: number;
}

export async function getParentScheduleEvents(
  lineUserId: string,
  start: Date,
  end: Date
): Promise<{
  events: ScheduleEvent[];
  students: StudentScheduleData[];
}> {
  try {
    // Get parent
    const parent = await getParentByLineId(lineUserId);
    if (!parent) {
      console.log('[getParentScheduleEvents] No parent found for lineUserId:', lineUserId);
      return { events: [], students: [] };
    }

    console.log('[getParentScheduleEvents] Found parent:', parent.id);

    // Get students
    const students = await getStudentsByParent(parent.id);
    const activeStudents = students.filter(s => s.isActive);
    
    console.log('[getParentScheduleEvents] Found active students:', activeStudents.length);
    
    if (activeStudents.length === 0) {
      return { events: [], students: [] };
    }

    // Get all necessary data
    const [subjects, teachers, branches] = await Promise.all([
      getSubjects(),
      getTeachers(),
      getBranches()
    ]);

    // Create lookup maps
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const teacherMap = new Map(teachers.map(t => [t.id, t]));
    const branchMap = new Map(branches.map(b => [b.id, b]));

    // Get all rooms data
    const allRooms = await Promise.all(
      branches.map(async (branch) => {
        const rooms = await getRoomsByBranch(branch.id);
        return rooms.map(room => ({ ...room, branchId: branch.id }));
      })
    );
    const roomMap = new Map(
      allRooms.flat().map(room => [`${room.branchId}-${room.id}`, room])
    );

    const events: ScheduleEvent[] = [];
    const studentsData: StudentScheduleData[] = [];
    const now = new Date();

    // Process each student
    for (const student of activeStudents) {
      console.log(`[getParentScheduleEvents] Processing student: ${student.name}`);
      
      const studentData: StudentScheduleData = {
        student: {
          id: student.id,
          name: student.name,
          nickname: student.nickname,
          profileImage: student.profileImage
        },
        enrollments: [],
        classes: [],
        makeupClasses: []
      };

      // Get enrollments
      const enrollments = await getEnrollmentsByStudent(student.id);
      const activeEnrollments = enrollments.filter(e => e.status === 'active');
      studentData.enrollments = activeEnrollments;
      
      console.log(`[getParentScheduleEvents] Student ${student.name} has ${activeEnrollments.length} active enrollments`);

      // Get ALL makeup classes for this student first (not just in date range)
      const allMakeupClasses = await getMakeupClassesByStudent(student.id);
      studentData.makeupClasses = allMakeupClasses;
      
      console.log(`[getParentScheduleEvents] Student ${student.name} has ${allMakeupClasses.length} total makeup classes`);
      
      // Create a map of makeup requests by originalClassId and originalScheduleId
      const makeupRequestMap = new Map<string, any>();
      allMakeupClasses.forEach(makeup => {
        if (makeup.status !== 'cancelled') {
          const key = `${makeup.originalClassId}-${makeup.originalScheduleId}`;
          makeupRequestMap.set(key, makeup);
          console.log(`[getParentScheduleEvents] Makeup request found: ${key}, status: ${makeup.status}`);
        }
      });

      // Process each enrollment
      for (const enrollment of activeEnrollments) {
        try {
          const classData = await getClass(enrollment.classId);
          if (!classData) {
            console.log(`[getParentScheduleEvents] Class not found: ${enrollment.classId}`);
            continue;
          }
          
          // Skip draft or cancelled classes
          if (classData.status === 'draft' || classData.status === 'cancelled') {
            console.log(`[getParentScheduleEvents] Skipping ${classData.status} class: ${classData.name}`);
            continue;
          }

          const subject = subjectMap.get(classData.subjectId);
          const teacher = teacherMap.get(classData.teacherId);
          const branch = branchMap.get(classData.branchId);
          const room = roomMap.get(`${classData.branchId}-${classData.roomId}`);

          if (!subject || !teacher || !branch) {
            console.log(`[getParentScheduleEvents] Missing data for class ${classData.name}`);
            continue;
          }

          studentData.classes.push(classData);

          // Get schedules within date range
          const schedulesRef = collection(db, 'classes', classData.id, 'schedules');
          const scheduleQuery = query(
            schedulesRef,
            where('sessionDate', '>=', Timestamp.fromDate(start)),
            where('sessionDate', '<=', Timestamp.fromDate(end)),
            orderBy('sessionDate', 'asc')
          );

          const scheduleSnapshot = await getDocs(scheduleQuery);
          console.log(`[getParentScheduleEvents] Found ${scheduleSnapshot.size} schedules for class ${classData.name}`);
          
          scheduleSnapshot.forEach(doc => {
            const schedule = doc.data();
            const sessionDate = schedule.sessionDate.toDate();
            
            // Skip cancelled schedules
            if (schedule.status === 'cancelled') return;
            
            // Check if there's a makeup request for this schedule
            const makeupKey = `${classData.id}-${doc.id}`;
            const hasMakeupRequest = makeupRequestMap.has(makeupKey);
            const makeupData = makeupRequestMap.get(makeupKey);
            
            console.log(`[getParentScheduleEvents] Schedule ${doc.id}, session ${schedule.sessionNumber}, hasMakeup: ${hasMakeupRequest}`);

            // Parse times
            const [startHour, startMinute] = classData.startTime.split(':').map(Number);
            const [endHour, endMinute] = classData.endTime.split(':').map(Number);
            
            const eventStart = new Date(sessionDate);
            eventStart.setHours(startHour, startMinute, 0, 0);
            
            const eventEnd = new Date(sessionDate);
            eventEnd.setHours(endHour, endMinute, 0, 0);

            // Determine status and color
            let backgroundColor = '#E5E7EB'; // Gray
            let borderColor = '#D1D5DB';
            let textColor = '#374151';
            let effectiveStatus = schedule.status;
            
            // Check if session has passed
            const sessionHasPassed = eventEnd < now;
            
            // Check attendance
            const hasAttendance = schedule.attendance && schedule.attendance.find(
              (a: any) => a.studentId === student.id
            );
            
            // Determine status based on various conditions
            if (hasMakeupRequest) {
              // Has makeup request - should be red
              backgroundColor = '#FEE2E2'; // Red-100
              borderColor = '#FCA5A5'; // Red-300
              textColor = '#991B1B'; // Red-800
              effectiveStatus = sessionHasPassed ? 'absent' : 'leave-requested';
              console.log(`[getParentScheduleEvents] Setting red color for makeup request: ${makeupKey}`);
            } else if (hasAttendance) {
              if (hasAttendance.status === 'present') {
                backgroundColor = '#D1FAE5'; // Green
                borderColor = '#A7F3D0';
                textColor = '#065F46';
                effectiveStatus = 'completed';
              } else if (hasAttendance.status === 'absent') {
                backgroundColor = '#FEE2E2'; // Red
                borderColor = '#FCA5A5';
                textColor = '#991B1B';
                effectiveStatus = 'absent';
              }
            } else if (sessionHasPassed) {
              // Past session without attendance data - assume completed
              backgroundColor = '#D1FAE5'; // Green
              borderColor = '#A7F3D0';
              textColor = '#065F46';
              effectiveStatus = 'completed';
            }

            events.push({
              id: `${classData.id}-${doc.id}-${student.id}`,
              classId: classData.id,
              title: `${student.nickname || student.name} - ${classData.name}`,
              start: eventStart,
              end: eventEnd,
              backgroundColor,
              borderColor,
              textColor,
              extendedProps: {
                type: 'class',
                studentId: student.id,
                studentName: student.name,
                studentNickname: student.nickname,
                branchName: branch.name,
                roomName: room?.name || classData.roomId,
                teacherName: teacher.nickname || teacher.name,
                subjectName: subject.name,
                className: classData.name,
                subjectColor: subject.color,
                sessionNumber: schedule.sessionNumber,
                status: effectiveStatus,
                hasMakeupRequest: hasMakeupRequest,
                makeupScheduled: makeupData?.status === 'scheduled' && makeupData?.makeupSchedule,
                makeupDate: makeupData?.makeupSchedule?.date?.toISOString(),
                makeupTime: makeupData?.makeupSchedule ? `${makeupData.makeupSchedule.startTime} - ${makeupData.makeupSchedule.endTime}` : undefined
              }
            });
          });
        } catch (error) {
          console.error(`[getParentScheduleEvents] Error loading class ${enrollment.classId}:`, error);
        }
      }

      // Process makeup classes that fall within the date range
      for (const makeup of allMakeupClasses) {
        if (makeup.status === 'cancelled' || !makeup.makeupSchedule) continue;
        
        const makeupDate = new Date(makeup.makeupSchedule.date);
        if (makeupDate < start || makeupDate > end) continue;

        // Get class info
        const originalClass = await getClass(makeup.originalClassId);
        if (!originalClass) continue;

        const teacher = teacherMap.get(makeup.makeupSchedule.teacherId);
        const branch = branchMap.get(makeup.makeupSchedule.branchId);
        const room = roomMap.get(`${makeup.makeupSchedule.branchId}-${makeup.makeupSchedule.roomId}`);
        const subject = subjectMap.get(originalClass.subjectId);

        if (!teacher || !branch) continue;

        // Parse times
        const [startHour, startMinute] = makeup.makeupSchedule.startTime.split(':').map(Number);
        const [endHour, endMinute] = makeup.makeupSchedule.endTime.split(':').map(Number);
        
        const eventStart = new Date(makeupDate);
        eventStart.setHours(startHour, startMinute, 0, 0);
        
        const eventEnd = new Date(makeupDate);
        eventEnd.setHours(endHour, endMinute, 0, 0);
        
        // Determine color
        let backgroundColor = '#E9D5FF'; // Purple
        let borderColor = '#D8B4FE';
        let textColor = '#6B21A8';
        
        if (eventEnd < now || makeup.attendance || makeup.status === 'completed') {
          backgroundColor = '#D1FAE5'; // Green
          borderColor = '#A7F3D0';
          textColor = '#065F46';
        }

        // Get original session number
        let originalSessionNumber;
        try {
          const { getClassSchedule } = await import('./classes');
          const originalSchedule = await getClassSchedule(makeup.originalClassId, makeup.originalScheduleId);
          originalSessionNumber = originalSchedule?.sessionNumber;
        } catch (error) {
          console.error('Error getting original session number:', error);
        }

        events.push({
          id: `makeup-${makeup.id}-${student.id}`,
          classId: makeup.originalClassId,
          title: `[Makeup] ${student.nickname || student.name} - ${originalClass.name}`,
          start: eventStart,
          end: eventEnd,
          backgroundColor,
          borderColor,
          textColor,
          extendedProps: {
            type: 'makeup',
            studentId: student.id,
            studentName: student.name,
            studentNickname: student.nickname,
            branchName: branch.name,
            roomName: room?.name || makeup.makeupSchedule.roomId,
            teacherName: teacher.nickname || teacher.name,
            subjectName: subject?.name || '',
            className: originalClass.name,
            subjectColor: subject?.color,
            originalClassName: originalClass.name,
            sessionNumber: originalSessionNumber,
            makeupStatus: makeup.status
          }
        });
      }

      studentsData.push(studentData);
    }

    // Sort events by date
    events.sort((a, b) => {
      const dateA = a.start as Date;
      const dateB = b.start as Date;
      return dateA.getTime() - dateB.getTime();
    });

    console.log(`[getParentScheduleEvents] Total events: ${events.length}`);
    return { events, students: studentsData };
  } catch (error) {
    console.error('[getParentScheduleEvents] Error:', error);
    return { events: [], students: [] };
  }
}

// Get overall statistics for a student (ALL TIME, not just current view)
export async function getStudentOverallStats(
  parentId: string,
  studentId: string
): Promise<StudentStats> {
  try {
    const stats = {
      totalClasses: 0,
      completedClasses: 0,
      upcomingClasses: 0,
      makeupClasses: 0
    };

    const now = new Date();

    // Get all active enrollments
    const enrollments = await getEnrollmentsByStudent(studentId);
    const activeEnrollments = enrollments.filter(e => e.status === 'active');

    // Process each enrollment to count ALL sessions
    for (const enrollment of activeEnrollments) {
      const classData = await getClass(enrollment.classId);
      if (!classData || classData.status === 'draft' || classData.status === 'cancelled') {
        continue;
      }

      // Get ALL schedules for this class
      const schedules = await getClassSchedules(enrollment.classId);
      
      schedules.forEach(schedule => {
        // Skip cancelled sessions
        if (schedule.status === 'cancelled') return;
        
        stats.totalClasses++;
        
        // Create full datetime for comparison
        const [endHour, endMinute] = classData.endTime.split(':').map(Number);
        const sessionEndTime = new Date(schedule.sessionDate);
        sessionEndTime.setHours(endHour, endMinute, 0, 0);
        
        // Check if completed
        if (sessionEndTime < now || schedule.status === 'completed') {
          stats.completedClasses++;
        } else {
          stats.upcomingClasses++;
        }
      });
    }

    // Count ALL makeup classes (completed and scheduled)
    const makeupClasses = await getMakeupClassesByStudent(studentId);
    stats.makeupClasses = makeupClasses.filter(m => 
      m.status === 'scheduled' || m.status === 'completed'
    ).length;

    return stats;
  } catch (error) {
    console.error('Error getting student overall stats:', error);
    return {
      totalClasses: 0,
      completedClasses: 0,
      upcomingClasses: 0,
      makeupClasses: 0
    };
  }
}

// Get schedule statistics for a student (for current view only)
export function getStudentScheduleStats(
  events: ScheduleEvent[],
  studentId: string
): StudentStats {
  const studentEvents = events.filter(e => e.extendedProps.studentId === studentId);
  const now = new Date();

  const stats = {
    totalClasses: 0,
    completedClasses: 0,
    upcomingClasses: 0,
    makeupClasses: 0
  };

  studentEvents.forEach(event => {
    if (event.extendedProps.type === 'makeup') {
      stats.makeupClasses++;
    } else {
      stats.totalClasses++;
      
      if (event.end < now || event.extendedProps.status === 'completed') {
        stats.completedClasses++;
      } else {
        stats.upcomingClasses++;
      }
    }
  });

  return stats;
}
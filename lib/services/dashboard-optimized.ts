// lib/services/dashboard-optimized.ts

import { EventInput } from '@fullcalendar/core';
import { Holiday, MakeupClass, TrialSession, Class, Subject, Teacher, Branch, Room } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

// Calendar Event interface
export interface CalendarEvent extends EventInput {
  classId: string;
  extendedProps: {
    type: 'class' | 'makeup' | 'trial' | 'holiday';
    className?: string;
    classCode?: string;
    branchId: string;
    branchName: string;
    roomName: string;
    teacherName: string;
    subjectColor?: string;
    enrolled?: number;
    maxStudents?: number;
    sessionNumber?: number;
    status?: string;
    isFullyAttended?: boolean;
    startTime?: string;
    endTime?: string;
    attendance?: AttendanceRecord[];
    // For makeup
    studentName?: string;
    studentNickname?: string;
    originalClassName?: string;
    makeupStatus?: 'pending' | 'scheduled' | 'completed' | 'cancelled';
    makeupCount?: number;
    makeupDetails?: MakeupDetail[];
    // For trial
    trialStudentName?: string;
    trialSubjectName?: string;
    trialCount?: number;
    trialDetails?: TrialDetail[];
    // For holiday
    holidayType?: 'national' | 'branch';
  };
}

// Supporting types
interface AttendanceRecord {
  studentId: string;
  studentName?: string;
  status: 'present' | 'absent' | 'late' | 'sick' | 'leave';
  note?: string;
  checkedAt?: Date;
  checkedBy?: string;
  feedback?: string;
}

interface MakeupDetail {
  id: string;
  studentName: string;
  studentNickname: string;
  originalClassName: string;
  status: string;
  attendance?: {
    status: string;
    checkedBy: string;
    checkedAt: Date;
    note?: string;
  };
}

interface TrialDetail {
  id: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  status: string;
  attended?: boolean;
  interestedLevel?: string;
  feedback?: string;
}

interface StudentInfo {
  id: string;
  name: string;
  nickname: string;
  birthdate?: Date;
  gender?: string;
  schoolName?: string;
  gradeLevel?: string;
}

interface ScheduleData {
  sessionDate: Date;
  sessionNumber: number;
  topic?: string;
  status: string;
  actualTeacherId?: string;
  note?: string;
  attendance?: AttendanceRecord[];
  originalDate?: Date;
  rescheduledAt?: Date;
  rescheduledBy?: string;
}

// Cache for static data
let staticDataCache: {
  subjects: Map<string, Subject>;
  teachers: Map<string, Teacher>;
  branches: Map<string, Branch>;
  rooms: Map<string, Room>;
  lastFetch: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get local date string (YYYY-MM-DD) without timezone issues
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getStaticData() {
  const now = Date.now();

  // Return cached data if still valid
  if (staticDataCache && (now - staticDataCache.lastFetch) < CACHE_DURATION) {
    return staticDataCache;
  }

  const supabase = getClient();

  // Fetch fresh data
  const [subjectsResult, teachersResult, branchesResult] = await Promise.all([
    supabase.from('subjects').select('*'),
    supabase.from('teachers').select('*'),
    supabase.from('branches').select('*')
  ]);

  const subjects = new Map<string, Subject>(
    (subjectsResult.data || []).map(subjectData => {
      const subject: Subject = {
        id: subjectData.id,
        name: subjectData.name,
        code: subjectData.code,
        description: subjectData.description,
        category: subjectData.category,
        level: subjectData.level,
        ageRangeMin: subjectData.age_range_min,
        ageRangeMax: subjectData.age_range_max,
        color: subjectData.color,
        icon: subjectData.icon,
        prerequisites: subjectData.prerequisites || [],
        isActive: subjectData.is_active
      };

      return [subjectData.id, subject];
    })
  );

  const teachers = new Map<string, Teacher>(
    (teachersResult.data || []).map(teacherData => {
      const teacher: Teacher = {
        id: teacherData.id,
        name: teacherData.name,
        nickname: teacherData.nickname,
        email: teacherData.email,
        phone: teacherData.phone,
        lineUserId: teacherData.line_user_id,
        specialties: teacherData.specialties || [],
        availableBranches: teacherData.available_branches || [],
        profileImage: teacherData.profile_image,
        hourlyRate: teacherData.hourly_rate,
        bankName: teacherData.bank_name,
        bankAccountNumber: teacherData.bank_account_number,
        bankAccountName: teacherData.bank_account_name,
        isActive: teacherData.is_active,
        hasLogin: teacherData.has_login,
        createdAt: new Date(teacherData.created_at),
        updatedAt: teacherData.updated_at ? new Date(teacherData.updated_at) : undefined
      };
      return [teacherData.id, teacher];
    })
  );

  const branches = new Map<string, Branch>(
    (branchesResult.data || []).map(branchData => {
      const branch: Branch = {
        id: branchData.id,
        name: branchData.name,
        code: branchData.code,
        address: branchData.address,
        phone: branchData.phone,
        locationLat: branchData.location_lat,
        locationLng: branchData.location_lng,
        openTime: branchData.open_time,
        closeTime: branchData.close_time,
        openDays: branchData.open_days || [],
        isActive: branchData.is_active,
        managerName: branchData.manager_name,
        managerPhone: branchData.manager_phone,
        lineGroupUrl: branchData.line_group_url,
        createdAt: new Date(branchData.created_at)
      };
      return [branchData.id, branch];
    })
  );

  // Get all rooms for all branches
  const roomsMap = new Map<string, Room>();
  const { data: roomsData } = await supabase.from('rooms').select('*');

  (roomsData || []).forEach(roomData => {
    const room: Room = {
      id: roomData.id,
      branchId: roomData.branch_id,
      name: roomData.name,
      capacity: roomData.capacity,
      floor: roomData.floor,
      hasProjector: roomData.has_projector,
      hasWhiteboard: roomData.has_whiteboard,
      isActive: roomData.is_active
    };
    roomsMap.set(`${roomData.branch_id}-${roomData.id}`, room);
  });

  staticDataCache = {
    subjects,
    teachers,
    branches,
    rooms: roomsMap,
    lastFetch: now
  };

  return staticDataCache;
}

export async function getOptimizedCalendarEvents(
  start: Date,
  end: Date,
  branchId?: string
): Promise<CalendarEvent[]> {
  try {
    const supabase = getClient();

    // Get static data (cached)
    const { subjects, teachers, branches, rooms } = await getStaticData();

    const events: CalendarEvent[] = [];
    const now = new Date();

    // 1. Get holidays in range
    let holidaysQuery = supabase
      .from('holidays')
      .select('*')
      .gte('date', getLocalDateString(start))
      .lte('date', getLocalDateString(end));

    const { data: holidaysData } = await holidaysQuery;

    // Process holidays
    (holidaysData || []).forEach(holidayData => {
      const holiday: Holiday = {
        id: holidayData.id,
        name: holidayData.name,
        date: new Date(holidayData.date),
        type: holidayData.type,
        branches: holidayData.branches || [],
        description: holidayData.description
      };

      // Filter by branch if needed
      if (branchId && holiday.type === 'branch' && !holiday.branches?.includes(branchId)) {
        return;
      }

      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);

      const holidayEndDate = new Date(holidayDate);
      holidayEndDate.setHours(23, 59, 59, 999);

      events.push({
        id: `holiday-${holiday.id}`,
        classId: '',
        title: holiday.name,
        start: holidayDate,
        end: holidayEndDate,
        allDay: true,
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        textColor: '#FFFFFF',
        display: 'background',
        extendedProps: {
          type: 'holiday',
          branchId: branchId || 'all',
          branchName: holiday.type === 'national' ? 'ทุกสาขา' : 'เฉพาะสาขา',
          roomName: '',
          teacherName: '',
          holidayType: holiday.type
        }
      });
    });

    // 2. Get class schedules in date range
    // Get classes with schedules in the date range
    const startDateStr = getLocalDateString(start);
    const endDateStr = getLocalDateString(end);

    let classesQuery = supabase
      .from('classes')
      .select('*')
      .in('status', ['published', 'started']);

    if (branchId) {
      classesQuery = classesQuery.eq('branch_id', branchId);
    }

    const { data: classesData } = await classesQuery;

    // Get all schedules in the date range
    let schedulesQuery = supabase
      .from('class_schedules')
      .select('*')
      .gte('session_date', startDateStr)
      .lte('session_date', endDateStr);

    const { data: allSchedulesData } = await schedulesQuery;

    // Create a map of classes for quick lookup
    const classesMap = new Map<string, any>();
    (classesData || []).forEach(classDoc => {
      classesMap.set(classDoc.id, classDoc);
    });

    // Process schedules and match with their classes
    const allSchedules = (allSchedulesData || [])
      .filter(scheduleDoc => classesMap.has(scheduleDoc.class_id))
      .map(scheduleDoc => {
        const classDoc = classesMap.get(scheduleDoc.class_id)!;

        const classData: Class = {
          id: classDoc.id,
          subjectId: classDoc.subject_id,
          teacherId: classDoc.teacher_id,
          branchId: classDoc.branch_id,
          roomId: classDoc.room_id,
          name: classDoc.name,
          code: classDoc.code,
          description: classDoc.description,
          startDate: new Date(classDoc.start_date),
          endDate: new Date(classDoc.end_date),
          totalSessions: classDoc.total_sessions,
          daysOfWeek: classDoc.days_of_week || [],
          startTime: classDoc.start_time,
          endTime: classDoc.end_time,
          maxStudents: classDoc.max_students,
          minStudents: classDoc.min_students,
          enrolledCount: classDoc.enrolled_count,
          pricePerSession: classDoc.price_per_session,
          totalPrice: classDoc.total_price,
          materialFee: classDoc.material_fee,
          registrationFee: classDoc.registration_fee,
          status: classDoc.status,
          createdAt: new Date(classDoc.created_at)
        };

        return {
          id: scheduleDoc.id,
          classId: scheduleDoc.class_id,
          classData,
          scheduleData: {
            sessionDate: new Date(scheduleDoc.session_date),
            sessionNumber: scheduleDoc.session_number,
            topic: scheduleDoc.topic,
            status: scheduleDoc.status,
            actualTeacherId: scheduleDoc.actual_teacher_id,
            note: scheduleDoc.note,
            attendance: scheduleDoc.attendance || undefined,
            originalDate: scheduleDoc.original_date ? new Date(scheduleDoc.original_date) : undefined,
            rescheduledAt: scheduleDoc.rescheduled_at ? new Date(scheduleDoc.rescheduled_at) : undefined,
            rescheduledBy: scheduleDoc.rescheduled_by
          } as ScheduleData
        };
      });

    // Process schedules into events
    allSchedules.forEach(({ id, classId, classData, scheduleData }) => {
      const subject = subjects.get(classData.subjectId);
      const teacher = teachers.get(classData.teacherId);
      const branch = branches.get(classData.branchId);
      const room = rooms.get(`${classData.branchId}-${classData.roomId}`);

      if (!subject || !teacher || !branch) {
        return;
      }

      const sessionDate = scheduleData.sessionDate;
      const [startHour, startMinute] = classData.startTime.split(':').map(Number);
      const [endHour, endMinute] = classData.endTime.split(':').map(Number);

      const eventStart = new Date(sessionDate);
      eventStart.setHours(startHour, startMinute, 0, 0);

      const eventEnd = new Date(sessionDate);
      eventEnd.setHours(endHour, endMinute, 0, 0);

      // Determine color and status
      let backgroundColor = '#E5E7EB';
      let borderColor = '#D1D5DB';
      let effectiveStatus = scheduleData.status;
      let textColor = '#374151';

      if (eventEnd < now) {
        backgroundColor = '#D1FAE5';
        borderColor = '#A7F3D0';
        effectiveStatus = 'completed';
        textColor = '#065F46';
      }

      const eventTitle = subject.name;

      events.push({
        id: `${classId}-${id}`,
        classId: classId,
        title: eventTitle,
        start: eventStart,
        end: eventEnd,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          type: 'class',
          className: classData.name,
          classCode: classData.code,
          branchId: classData.branchId,
          branchName: branch.name,
          roomName: room?.name || classData.roomId,
          teacherName: teacher.nickname || teacher.name,
          subjectColor: subject.color,
          enrolled: classData.enrolledCount,
          maxStudents: classData.maxStudents,
          sessionNumber: scheduleData.sessionNumber,
          status: effectiveStatus,
          isFullyAttended: false,
          startTime: classData.startTime,
          endTime: classData.endTime,
          attendance: scheduleData.attendance
        }
      });
    });

    // 3. Get makeup classes in range
    let makeupQuery = supabase
      .from('makeup_classes')
      .select('*')
      .gte('makeup_date', startDateStr)
      .lte('makeup_date', endDateStr)
      .in('status', ['scheduled', 'completed']);

    if (branchId) {
      makeupQuery = makeupQuery.eq('makeup_branch_id', branchId);
    }

    const { data: makeupData } = await makeupQuery;

    // Get unique class IDs
    const classIds = new Set<string>();

    (makeupData || []).forEach(data => {
      classIds.add(data.original_class_id);
    });

    // Batch get class info
    const classInfoMap = new Map<string, Class>();
    if (classIds.size > 0) {
      for (const classId of classIds) {
        const classDoc = (classesData || []).find(doc => doc.id === classId);
        if (classDoc) {
          classInfoMap.set(classId, {
            id: classDoc.id,
            subjectId: classDoc.subject_id,
            teacherId: classDoc.teacher_id,
            branchId: classDoc.branch_id,
            roomId: classDoc.room_id,
            name: classDoc.name,
            code: classDoc.code,
            description: classDoc.description,
            startDate: new Date(classDoc.start_date),
            endDate: new Date(classDoc.end_date),
            totalSessions: classDoc.total_sessions,
            daysOfWeek: classDoc.days_of_week || [],
            startTime: classDoc.start_time,
            endTime: classDoc.end_time,
            maxStudents: classDoc.max_students,
            minStudents: classDoc.min_students,
            enrolledCount: classDoc.enrolled_count,
            pricePerSession: classDoc.price_per_session,
            totalPrice: classDoc.total_price,
            materialFee: classDoc.material_fee,
            registrationFee: classDoc.registration_fee,
            status: classDoc.status,
            createdAt: new Date(classDoc.created_at)
          });
        }
      }
    }

    // Fetch all students for makeup classes in one query to avoid N+1 problem
    const studentIds = [...new Set((makeupData || []).map(doc => doc.student_id))];
    const studentsMap = new Map<string, StudentInfo>();

    if (studentIds.length > 0) {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds);

      (studentsData || []).forEach(studentData => {
        studentsMap.set(studentData.id, {
          id: studentData.id,
          name: studentData.name || 'ไม่ระบุชื่อ',
          nickname: studentData.nickname || 'นักเรียน',
          birthdate: studentData.birthdate ? new Date(studentData.birthdate) : undefined,
          gender: studentData.gender,
          schoolName: studentData.school_name,
          gradeLevel: studentData.grade_level
        });
      });
    }

    // Group makeup classes by time slot
    const makeupGroups = new Map<string, MakeupClass[]>();

    for (const doc of (makeupData || [])) {
      const makeup: MakeupClass = {
        id: doc.id,
        type: doc.type,
        originalClassId: doc.original_class_id,
        originalScheduleId: doc.original_schedule_id,
        studentId: doc.student_id,
        parentId: doc.parent_id,
        requestDate: new Date(doc.request_date),
        requestedBy: doc.requested_by,
        reason: doc.reason,
        status: doc.status,
        makeupSchedule: doc.makeup_date ? {
          date: new Date(doc.makeup_date),
          startTime: doc.makeup_start_time,
          endTime: doc.makeup_end_time,
          teacherId: doc.makeup_teacher_id,
          branchId: doc.makeup_branch_id,
          roomId: doc.makeup_room_id,
          confirmedAt: doc.makeup_confirmed_at ? new Date(doc.makeup_confirmed_at) : undefined,
          confirmedBy: doc.makeup_confirmed_by
        } : undefined,
        attendance: doc.attendance_status ? {
          status: doc.attendance_status,
          checkedBy: doc.attendance_checked_by,
          checkedAt: doc.attendance_checked_at ? new Date(doc.attendance_checked_at) : undefined,
          note: doc.attendance_note
        } : undefined,
        createdAt: new Date(doc.created_at),
        updatedAt: doc.updated_at ? new Date(doc.updated_at) : undefined,
        notes: doc.notes,
        originalSessionNumber: doc.original_session_number,
        originalSessionDate: doc.original_session_date ? new Date(doc.original_session_date) : undefined
      };

      if (!makeup.makeupSchedule) continue;

      const makeupDate = makeup.makeupSchedule.date;
      const dateKey = getLocalDateString(makeupDate);
      const key = `${makeup.makeupSchedule.branchId}-${makeup.makeupSchedule.roomId}-${dateKey}-${makeup.makeupSchedule.startTime}-${makeup.makeupSchedule.endTime}-${makeup.makeupSchedule.teacherId}`;

      if (!makeupGroups.has(key)) {
        makeupGroups.set(key, []);
      }

      makeupGroups.get(key)!.push(makeup);
    }

    // Process each group of makeup classes
    for (const [key, groupedMakeups] of makeupGroups) {
      if (groupedMakeups.length === 0) continue;

      const firstMakeup = groupedMakeups[0];
      const teacher = teachers.get(firstMakeup.makeupSchedule!.teacherId);
      const branch = branches.get(firstMakeup.makeupSchedule!.branchId);
      const room = rooms.get(`${firstMakeup.makeupSchedule!.branchId}-${firstMakeup.makeupSchedule!.roomId}`);

      if (!teacher || !branch) continue;

      const makeupDate = firstMakeup.makeupSchedule!.date;
      const [startHour, startMinute] = firstMakeup.makeupSchedule!.startTime.split(':').map(Number);
      const [endHour, endMinute] = firstMakeup.makeupSchedule!.endTime.split(':').map(Number);

      const eventStart = new Date(makeupDate);
      eventStart.setHours(startHour, startMinute, 0, 0);

      const eventEnd = new Date(makeupDate);
      eventEnd.setHours(endHour, endMinute, 0, 0);

      let backgroundColor = '#E9D5FF';
      let borderColor = '#D8B4FE';
      let textColor = '#6B21A8';

      const allCompleted = groupedMakeups.every(makeup =>
        eventEnd < now || makeup.attendance || makeup.status === 'completed'
      );

      if (allCompleted) {
        backgroundColor = '#D1FAE5';
        borderColor = '#A7F3D0';
        textColor = '#065F46';
      }

      // Create makeup details using the pre-fetched students map
      const makeupDetails = groupedMakeups.map(makeup => {
        const originalClass = classInfoMap.get(makeup.originalClassId);
        const student = studentsMap.get(makeup.studentId);
        const studentName = student?.name || 'ไม่ระบุชื่อ';
        const studentNickname = student?.nickname || 'นักเรียน';

        return {
          id: makeup.id,
          studentName: studentName,
          studentNickname: studentNickname,
          originalClassName: originalClass?.name || '',
          status: makeup.status,
          attendance: makeup.attendance
        };
      });

      const title = groupedMakeups.length === 1
        ? `[Makeup] ${makeupDetails[0].studentNickname} - ${makeupDetails[0].originalClassName}`
        : `[Makeup ${groupedMakeups.length} คน] ${makeupDetails.map(d => d.studentNickname).join(', ')}`;

      const uniqueClasses = [...new Set(makeupDetails.map(d => d.originalClassName))];

      events.push({
        id: `makeup-group-${key}`,
        classId: firstMakeup.originalClassId,
        title,
        start: eventStart,
        end: eventEnd,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          type: 'makeup',
          branchId: firstMakeup.makeupSchedule!.branchId,
          branchName: branch.name,
          roomName: room?.name || firstMakeup.makeupSchedule!.roomId,
          teacherName: teacher.nickname || teacher.name,
          subjectColor: '#9333EA',
          studentName: makeupDetails.map(d => d.studentName).join(', '),
          studentNickname: makeupDetails.map(d => d.studentNickname).join(', '),
          originalClassName: uniqueClasses.join(', '),
          makeupStatus: groupedMakeups.every(m => m.status === 'completed') ? 'completed' : 'scheduled',
          makeupCount: groupedMakeups.length,
          makeupDetails: makeupDetails
        }
      });
    }

    // 4. Get trial sessions in range
    let trialQuery = supabase
      .from('trial_sessions')
      .select('*')
      .gte('scheduled_date', startDateStr)
      .lte('scheduled_date', endDateStr)
      .in('status', ['scheduled', 'attended', 'absent', 'cancelled']);

    if (branchId) {
      trialQuery = trialQuery.eq('branch_id', branchId);
    }

    const { data: trialData } = await trialQuery;

    // Group trials by time slot
    const trialGroups = new Map<string, TrialSession[]>();

    (trialData || []).forEach(trialDoc => {
      const trial: TrialSession = {
        id: trialDoc.id,
        bookingId: trialDoc.booking_id,
        studentName: trialDoc.student_name,
        subjectId: trialDoc.subject_id,
        scheduledDate: new Date(trialDoc.scheduled_date),
        startTime: trialDoc.start_time,
        endTime: trialDoc.end_time,
        teacherId: trialDoc.teacher_id,
        branchId: trialDoc.branch_id,
        roomId: trialDoc.room_id,
        roomName: trialDoc.room_name,
        status: trialDoc.status,
        attended: trialDoc.attended,
        feedback: trialDoc.feedback,
        teacherNote: trialDoc.teacher_note,
        interestedLevel: trialDoc.interested_level,
        converted: trialDoc.converted,
        convertedToClassId: trialDoc.converted_to_class_id,
        conversionNote: trialDoc.conversion_note,
        rescheduleHistory: trialDoc.reschedule_history,
        createdAt: new Date(trialDoc.created_at),
        completedAt: trialDoc.completed_at ? new Date(trialDoc.completed_at) : undefined
      };

      const trialDate = trial.scheduledDate;
      const dateKey = getLocalDateString(trialDate);
      const key = `${trial.branchId}-${trial.roomId}-${dateKey}-${trial.startTime}-${trial.endTime}-${trial.teacherId}`;

      if (!trialGroups.has(key)) {
        trialGroups.set(key, []);
      }

      trialGroups.get(key)!.push(trial);
    });

    // Process each group of trials
    for (const [key, groupedTrials] of trialGroups) {
      if (groupedTrials.length === 0) continue;

      const firstTrial = groupedTrials[0];
      const teacher = teachers.get(firstTrial.teacherId);
      const branch = branches.get(firstTrial.branchId);
      const room = rooms.get(`${firstTrial.branchId}-${firstTrial.roomId}`);

      if (!teacher || !branch) continue;

      const trialDate = firstTrial.scheduledDate;
      const [startHour, startMinute] = firstTrial.startTime.split(':').map(Number);
      const [endHour, endMinute] = firstTrial.endTime.split(':').map(Number);

      const eventStart = new Date(trialDate);
      eventStart.setHours(startHour, startMinute, 0, 0);

      const eventEnd = new Date(trialDate);
      eventEnd.setHours(endHour, endMinute, 0, 0);

      let backgroundColor = '#FED7AA';
      let borderColor = '#FDBA74';
      let textColor = '#9A3412';

      const allCompleted = groupedTrials.every(trial =>
        eventEnd < now || trial.attended || trial.status === 'attended' || trial.status === 'absent'
      );

      if (allCompleted) {
        backgroundColor = '#D1FAE5';
        borderColor = '#A7F3D0';
        textColor = '#065F46';
      }

      const studentInfo = groupedTrials.map(trial => {
        const subject = subjects.get(trial.subjectId);
        return `${trial.studentName} (${subject?.name || 'ไม่ระบุวิชา'})`;
      });

      const title = groupedTrials.length === 1
        ? `ทดลอง: ${studentInfo[0]}`
        : `ทดลอง ${groupedTrials.length} คน: ${groupedTrials.map(t => t.studentName).join(', ')}`;

      const uniqueSubjects = [...new Set(groupedTrials.map(t => {
        const subject = subjects.get(t.subjectId);
        return subject?.name || 'ไม่ระบุวิชา';
      }))];

      const trialDetails: TrialDetail[] = groupedTrials.map(trial => {
        const subject = subjects.get(trial.subjectId);
        return {
          id: trial.id,
          studentName: trial.studentName,
          subjectId: trial.subjectId,
          subjectName: subject?.name || 'ไม่ระบุวิชา',
          status: trial.status,
          attended: trial.attended,
          interestedLevel: trial.interestedLevel,
          feedback: trial.feedback
        };
      });

      events.push({
        id: `trial-group-${key}`,
        classId: '',
        title,
        start: eventStart,
        end: eventEnd,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          type: 'trial',
          branchId: firstTrial.branchId,
          branchName: branch.name,
          roomName: room?.name || firstTrial.roomName || firstTrial.roomId,
          teacherName: teacher.nickname || teacher.name,
          subjectColor: '#F97316',
          trialStudentName: studentInfo.join(', '),
          trialSubjectName: uniqueSubjects.join(', '),
          trialCount: groupedTrials.length,
          trialDetails: trialDetails
        }
      });
    }

    // Sort events by start time
    return events.sort((a, b) => {
      const dateA = a.start as Date;
      const dateB = b.start as Date;
      return dateA.getTime() - dateB.getTime();
    });

  } catch (error) {
    console.error('Error getting optimized calendar events:', error);
    return [];
  }
}

// Dashboard statistics interface
export interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  activeClasses: number;
  todayClasses: number;
  upcomingMakeups: number;
  pendingMakeups: number;
  upcomingTrials: number;
}

export async function getOptimizedDashboardStats(branchId?: string): Promise<DashboardStats> {
  try {
    const supabase = getClient();

    // Use local date to avoid timezone issues
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Get only active classes
    let classQuery = supabase
      .from('classes')
      .select('*')
      .in('status', ['published', 'started']);

    if (branchId) {
      classQuery = classQuery.eq('branch_id', branchId);
    }

    const { data: classData } = await classQuery;

    // Get total student count from students table (all students in system)
    const { count: totalStudents } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true });

    // Get today's events count - count unique classes, not events
    const todayEvents = await getOptimizedCalendarEvents(today, tomorrow, branchId);
    const uniqueClassIds = new Set(
      todayEvents
        .filter(e => e.extendedProps.type === 'class')
        .map(e => e.classId)
    );
    const todayClassCount = uniqueClassIds.size;

    // Get makeup stats - join with classes to filter by branch
    let makeupQuery = supabase
      .from('makeup_classes')
      .select(`
        *,
        classes!makeup_classes_original_class_id_fkey(branch_id)
      `)
      .in('status', ['pending', 'scheduled']);

    if (branchId) {
      makeupQuery = makeupQuery.eq('classes.branch_id', branchId);
    }

    const { data: makeupData, error: makeupError } = await makeupQuery;

    console.log('🔍 DEBUG Makeup Stats:');
    console.log('  Branch ID:', branchId || 'ALL');
    console.log('  Total makeup data:', makeupData?.length || 0);
    console.log('  Makeup error:', makeupError);
    if (makeupData && makeupData.length > 0) {
      console.log('  First item:', makeupData[0]);
    }

    let upcomingMakeups = 0;
    let pendingMakeups = 0;

    (makeupData || []).forEach(doc => {
      if (doc.status === 'pending') {
        pendingMakeups++;
      } else if (doc.status === 'scheduled' && doc.makeup_date) {
        const makeupDate = new Date(doc.makeup_date);
        if (makeupDate >= today) {
          upcomingMakeups++;
        }
      }
    });

    console.log('  Pending count:', pendingMakeups);
    console.log('  Upcoming count:', upcomingMakeups);

    // Get trial stats
    let trialQuery = supabase
      .from('trial_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_date', getLocalDateString(today));

    if (branchId) {
      trialQuery = trialQuery.eq('branch_id', branchId);
    }

    const { data: trialData } = await trialQuery;

    return {
      totalStudents,
      totalClasses: classData?.length || 0,
      activeClasses: classData?.length || 0,
      todayClasses: todayClassCount,
      upcomingMakeups,
      pendingMakeups,
      upcomingTrials: trialData?.length || 0
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return {
      totalStudents: 0,
      totalClasses: 0,
      activeClasses: 0,
      todayClasses: 0,
      upcomingMakeups: 0,
      pendingMakeups: 0,
      upcomingTrials: 0
    };
  }
}

// Clear cache when needed
export function clearDashboardCache() {
  staticDataCache = null;
}

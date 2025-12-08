// lib/utils/availability.ts

import { getClient } from '@/lib/supabase/client';
import { isHoliday } from '@/lib/services/holidays';
import { getClasses, getClassSchedules } from '@/lib/services/classes';
import { getMakeupClasses } from '@/lib/services/makeup';
import { getTrialSessions } from '@/lib/services/trial-bookings';
import { getSubjects } from '@/lib/services/subjects';
import { Class, MakeupClass, TrialSession } from '@/types/models';

export interface AvailabilityCheckResult {
  available: boolean;
  reasons: AvailabilityIssue[];
  warnings?: AvailabilityWarning[]; // เพิ่ม warnings
}

export interface AvailabilityIssue {
  type: 'holiday' | 'room_conflict' | 'teacher_conflict';
  message: string;
  details?: {
    conflictType?: 'class' | 'makeup' | 'trial';
    conflictName?: string;
    conflictTime?: string;
    holidayName?: string;
  };
}

// เพิ่ม interface สำหรับ warning
export interface AvailabilityWarning {
  type: 'room_conflict' | 'teacher_conflict';
  message: string;
  details: {
    conflictType: 'class' | 'makeup' | 'trial';
    conflictName: string;
    conflictTime: string;
    studentNames?: string[]; // สำหรับกรณี makeup หลายคน
  };
}

export interface AvailabilityCheckParams {
  date: Date;
  startTime: string;
  endTime: string;
  branchId: string;
  roomId: string;
  teacherId: string;
  excludeId?: string; // For editing existing sessions
  excludeType?: 'class' | 'makeup' | 'trial';
  allowConflicts?: boolean; // เพิ่ม flag สำหรับอนุญาตให้มี conflicts
}

/**
 * Comprehensive availability check for scheduling
 * แก้ไขให้ return warnings แทน errors สำหรับ makeup และ trial
 */
export async function checkAvailability(
  params: AvailabilityCheckParams
): Promise<AvailabilityCheckResult> {
  const issues: AvailabilityIssue[] = [];
  const warnings: AvailabilityWarning[] = [];
  
  try {
    // 1. Check if it's a holiday - ยังคงเป็น issue (ห้ามจัดในวันหยุด)
    const holidayCheck = await checkHolidayConflict(params.date, params.branchId);
    if (holidayCheck) {
      issues.push(holidayCheck);
    }
    
    // 2. Check room availability
    const roomWarnings = await checkRoomAvailability(params);
    
    // แยกเป็น issues หรือ warnings ตามประเภท
    for (const warning of roomWarnings) {
      // ถ้าเป็น trial หรือ makeup ให้เป็น warning
      if (params.excludeType === 'trial' || params.excludeType === 'makeup' || params.allowConflicts) {
        warnings.push({
          type: warning.type as 'room_conflict',
          message: warning.message,
          details: {
            conflictType: warning.details?.conflictType || 'class' as 'class' | 'makeup' | 'trial',
            conflictName: warning.details?.conflictName || '',
            conflictTime: warning.details?.conflictTime || ''
          }
        });
      } else {
        // สำหรับ class ปกติ ถ้าชนกับ trial ให้เป็น warning, ถ้าชนกับ class/makeup ให้เป็น issue
        if (warning.details?.conflictType === 'trial') {
          warnings.push({
            type: warning.type as 'room_conflict',
            message: warning.message,
            details: {
              conflictType: 'trial',
              conflictName: warning.details?.conflictName || '',
              conflictTime: warning.details?.conflictTime || ''
            }
          });
        } else {
          issues.push(warning);
        }
      }
    }
    
    // 3. Check teacher availability
    const teacherWarnings = await checkTeacherAvailability(params);
    
    // แยกเป็น issues หรือ warnings ตามประเภท (เหมือนกับ room)
    for (const warning of teacherWarnings) {
      // ถ้าเป็น trial หรือ makeup ให้เป็น warning
      if (params.excludeType === 'trial' || params.excludeType === 'makeup' || params.allowConflicts) {
        warnings.push({
          type: warning.type as 'teacher_conflict',
          message: warning.message,
          details: {
            conflictType: warning.details?.conflictType || 'class' as 'class' | 'makeup' | 'trial',
            conflictName: warning.details?.conflictName || '',
            conflictTime: warning.details?.conflictTime || ''
          }
        });
      } else {
        // สำหรับ class ปกติ ถ้าชนกับ trial ให้เป็น warning, ถ้าชนกับ class/makeup ให้เป็น issue
        if (warning.details?.conflictType === 'trial') {
          warnings.push({
            type: warning.type as 'teacher_conflict',
            message: warning.message,
            details: {
              conflictType: 'trial',
              conflictName: warning.details?.conflictName || '',
              conflictTime: warning.details?.conflictTime || ''
            }
          });
        } else {
          issues.push(warning);
        }
      }
    }
    
    return {
      available: issues.length === 0, // available ถ้าไม่มี issues
      reasons: issues,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      available: false,
      reasons: [{
        type: 'room_conflict',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ'
      }]
    };
  }
}

/**
 * Check if the date is a holiday
 */
async function checkHolidayConflict(
  date: Date,
  branchId: string
): Promise<AvailabilityIssue | null> {
  const isHolidayDate = await isHoliday(date, branchId);
  
  if (isHolidayDate) {
    // Get holiday details for better message
    const { getHolidaysForBranch } = await import('@/lib/services/holidays');
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const holidays = await getHolidaysForBranch(branchId, startOfDay, endOfDay);
    const holidayName = holidays.length > 0 ? holidays[0].name : 'วันหยุด';
    
    return {
      type: 'holiday',
      message: `วันที่เลือกเป็นวันหยุด (${holidayName})`,
      details: {
        holidayName
      }
    };
  }
  
  return null;
}

/**
 * Check room availability - แก้ให้ return AvailabilityIssue[] เหมือนเดิม
 * แต่ caller จะเปลี่ยนเป็น warnings ถ้าเป็น makeup/trial
 */
async function checkRoomAvailability(
  params: AvailabilityCheckParams
): Promise<AvailabilityIssue[]> {
  const issues: AvailabilityIssue[] = [];
  const { date, startTime, endTime, branchId, roomId, excludeId, excludeType } = params;
  
  // Get room name first
  const { getRoomsByBranch } = await import('@/lib/services/rooms');
  const rooms = await getRoomsByBranch(branchId);
  const room = rooms.find(r => r.id === roomId);
  const roomName = room?.name || roomId;
  
  // 1. Check regular classes on that day
  const dayOfWeek = date.getDay();
  const classes = await getClasses();
  
  // Create date without time for comparison
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  // Filter classes for the same branch, room, and day
  const relevantClasses = classes.filter(cls => 
    cls.branchId === branchId &&
    cls.roomId === roomId &&
    cls.daysOfWeek.includes(dayOfWeek) &&
    (cls.status === 'published' || cls.status === 'started') &&
    new Date(cls.startDate) <= dateOnly &&
    new Date(cls.endDate) >= dateOnly &&
    !(excludeType === 'class' && cls.id === excludeId)
  );
  
  // Batch check all schedules
  if (relevantClasses.length > 0) {
    const supabase = getClient();
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Get all schedules for relevant classes in one query
    const schedulePromises = relevantClasses.map(async cls => {
      const { data, error } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('class_id', cls.id)
        .eq('session_date', dateString)
        .neq('status', 'cancelled');

      if (error) {
        console.error('Error fetching schedules:', error);
        return [];
      }

      return data || [];
    });

    const scheduleResults = await Promise.all(schedulePromises);

    // Check each class with schedule
    relevantClasses.forEach((cls, index) => {
      if (scheduleResults[index].length > 0) {
        // Check time overlap
        if (startTime < cls.endTime && endTime > cls.startTime) {
          issues.push({
            type: 'room_conflict',
            message: `ห้อง ${roomName} ไม่ว่าง - มีคลาส ${cls.name} เวลา ${cls.startTime}-${cls.endTime}`,
            details: {
              conflictType: 'class',
              conflictName: cls.name,
              conflictTime: `${cls.startTime}-${cls.endTime}`
            }
          });
        }
      }
    });
  }
  
  // 2. Check makeup classes - ไม่ตรวจสอบถ้าเป็น makeup
  if (excludeType !== 'makeup') {
    const makeupClasses = await getMakeupClasses();

    // Get current makeup's details if we're scheduling a makeup (excludeId is the makeup being scheduled)
    let currentMakeup: MakeupClass | undefined;
    if (excludeId) {
      currentMakeup = makeupClasses.find(m => m.id === excludeId);
    }

    // Filter makeup classes for the same branch, room, and date
    // BUT allow multiple students from the same original session to be scheduled together
    const relevantMakeups = makeupClasses.filter(makeup => {
      // Basic checks
      if (!makeup.makeupSchedule) return false;
      if (makeup.status !== 'scheduled') return false;
      if (makeup.makeupSchedule.branchId !== branchId) return false;
      if (makeup.makeupSchedule.roomId !== roomId) return false;
      if (new Date(makeup.makeupSchedule.date).toDateString() !== date.toDateString()) return false;
      if (makeup.id === excludeId) return false;

      // NEW: If we're scheduling a makeup, allow other students from the same original session
      if (currentMakeup) {
        // Same original session but different student = allow (not a conflict)
        if (makeup.originalScheduleId === currentMakeup.originalScheduleId &&
            makeup.studentId !== currentMakeup.studentId) {
          return false; // Don't treat as conflict
        }
      }

      return true;
    });
    
    // Group makeups by time slot for better display
    const makeupsByTimeSlot = new Map<string, MakeupClass[]>();
    
    for (const makeup of relevantMakeups) {
      if (makeup.makeupSchedule) {
        // Check time overlap
        if (startTime < makeup.makeupSchedule.endTime && endTime > makeup.makeupSchedule.startTime) {
          const timeKey = `${makeup.makeupSchedule.startTime}-${makeup.makeupSchedule.endTime}`;
          if (!makeupsByTimeSlot.has(timeKey)) {
            makeupsByTimeSlot.set(timeKey, []);
          }
          makeupsByTimeSlot.get(timeKey)!.push(makeup);
        }
      }
    }
    
    // Create issues for makeup conflicts
    for (const [timeSlot, makeups] of makeupsByTimeSlot) {
      const { getStudent } = await import('@/lib/services/parents');
      const studentNames = await Promise.all(
        makeups.map(async (makeup) => {
          const student = await getStudent(makeup.parentId, makeup.studentId);
          return student?.nickname || student?.name || 'นักเรียน';
        })
      );
      
      const message = makeups.length === 1
        ? `ห้อง ${roomName} มี Makeup Class ของ ${studentNames[0]} เวลา ${timeSlot}`
        : `ห้อง ${roomName} มี Makeup Class ${makeups.length} คน (${studentNames.join(', ')}) เวลา ${timeSlot}`;
      
      issues.push({
        type: 'room_conflict',
        message,
        details: {
          conflictType: 'makeup',
          conflictName: studentNames.join(', '),
          conflictTime: timeSlot
        }
      });
    }
  }
  
  // 3. Check trial sessions - ไม่ตรวจสอบถ้าเป็น trial
  if (excludeType !== 'trial') {
    const trialSessions = await getTrialSessions();
    
    // Filter trial sessions for the same branch, room, and date
    const relevantTrials = trialSessions.filter(trial =>
      trial.status === 'scheduled' &&
      trial.branchId === branchId &&
      trial.roomId === roomId &&
      new Date(trial.scheduledDate).toDateString() === date.toDateString() &&
      trial.id !== excludeId
    );
    
    // Group trials by time slot
    const trialsByTimeSlot = new Map<string, TrialSession[]>();
    
    for (const trial of relevantTrials) {
      // Check time overlap
      if (startTime < trial.endTime && endTime > trial.startTime) {
        const timeKey = `${trial.startTime}-${trial.endTime}`;
        if (!trialsByTimeSlot.has(timeKey)) {
          trialsByTimeSlot.set(timeKey, []);
        }
        trialsByTimeSlot.get(timeKey)!.push(trial);
      }
    }
    
    // Create issues for trial conflicts
    for (const [timeSlot, trials] of trialsByTimeSlot) {
      const studentNames = trials.map(t => t.studentName);
      
      const message = trials.length === 1
        ? `ห้อง ${roomName} มีทดลองเรียนของ ${studentNames[0]} เวลา ${timeSlot}`
        : `ห้อง ${roomName} มีทดลองเรียน ${trials.length} คน (${studentNames.join(', ')}) เวลา ${timeSlot}`;
      
      issues.push({
        type: 'room_conflict',
        message,
        details: {
          conflictType: 'trial',
          conflictName: studentNames.join(', '),
          conflictTime: timeSlot
        }
      });
    }
  }
  
  return issues;
}

/**
 * Check teacher availability
 */
async function checkTeacherAvailability(
  params: AvailabilityCheckParams
): Promise<AvailabilityIssue[]> {
  const issues: AvailabilityIssue[] = [];
  const { date, startTime, endTime, teacherId, excludeId, excludeType } = params;
  
  // 1. Check regular classes
  const dayOfWeek = date.getDay();
  const classes = await getClasses();
  
  // Create date without time for comparison
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  // Filter classes for the same teacher and day
  const teacherClasses = classes.filter(cls => 
    cls.teacherId === teacherId &&
    cls.daysOfWeek.includes(dayOfWeek) &&
    (cls.status === 'published' || cls.status === 'started') &&
    new Date(cls.startDate) <= dateOnly &&
    new Date(cls.endDate) >= dateOnly &&
    !(excludeType === 'class' && cls.id === excludeId)
  );
  
  // Batch check all schedules
  if (teacherClasses.length > 0) {
    const supabase = getClient();
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const schedulePromises = teacherClasses.map(async cls => {
      const { data, error } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('class_id', cls.id)
        .eq('session_date', dateString)
        .neq('status', 'cancelled');

      if (error) {
        console.error('Error fetching schedules:', error);
        return [];
      }

      return data || [];
    });

    const scheduleResults = await Promise.all(schedulePromises);

    teacherClasses.forEach((cls, index) => {
      if (scheduleResults[index].length > 0) {
        // Check time overlap
        if (startTime < cls.endTime && endTime > cls.startTime) {
          issues.push({
            type: 'teacher_conflict',
            message: `ครูไม่ว่าง - มีคลาส ${cls.name} เวลา ${cls.startTime}-${cls.endTime}`,
            details: {
              conflictType: 'class',
              conflictName: cls.name,
              conflictTime: `${cls.startTime}-${cls.endTime}`
            }
          });
        }
      }
    });
  }
  
  // 2. Check makeup classes - ไม่ตรวจสอบถ้าเป็น makeup  
  if (excludeType !== 'makeup') {
    const makeupClasses = await getMakeupClasses();
    
    // Filter makeup classes for the same teacher and date
    const teacherMakeups = makeupClasses.filter(makeup => 
      makeup.status === 'scheduled' &&
      makeup.makeupSchedule &&
      makeup.makeupSchedule.teacherId === teacherId &&
      new Date(makeup.makeupSchedule.date).toDateString() === date.toDateString() &&
      makeup.id !== excludeId
    );
    
    // Group makeups by time slot
    const makeupsByTimeSlot = new Map<string, MakeupClass[]>();
    
    for (const makeup of teacherMakeups) {
      if (makeup.makeupSchedule) {
        // Check time overlap
        if (startTime < makeup.makeupSchedule.endTime && endTime > makeup.makeupSchedule.startTime) {
          const timeKey = `${makeup.makeupSchedule.startTime}-${makeup.makeupSchedule.endTime}`;
          if (!makeupsByTimeSlot.has(timeKey)) {
            makeupsByTimeSlot.set(timeKey, []);
          }
          makeupsByTimeSlot.get(timeKey)!.push(makeup);
        }
      }
    }
    
    // Create issues for makeup conflicts
    for (const [timeSlot, makeups] of makeupsByTimeSlot) {
      const { getStudent } = await import('@/lib/services/parents');
      const studentNames = await Promise.all(
        makeups.map(async (makeup) => {
          const student = await getStudent(makeup.parentId, makeup.studentId);
          return student?.nickname || student?.name || 'นักเรียน';
        })
      );
      
      const message = makeups.length === 1
        ? `ครูไม่ว่าง - Makeup Class ของ ${studentNames[0]} เวลา ${timeSlot}`
        : `ครูไม่ว่าง - Makeup Class ${makeups.length} คน (${studentNames.join(', ')}) เวลา ${timeSlot}`;
      
      issues.push({
        type: 'teacher_conflict',
        message,
        details: {
          conflictType: 'makeup',
          conflictName: studentNames.join(', '),
          conflictTime: timeSlot
        }
      });
    }
  }
  
  // 3. Check trial sessions - ไม่ตรวจสอบถ้าเป็น trial
  if (excludeType !== 'trial') {
    const trialSessions = await getTrialSessions();
    
    // Filter trial sessions for the same teacher and date
    const teacherTrials = trialSessions.filter(trial =>
      trial.status === 'scheduled' &&
      trial.teacherId === teacherId &&
      new Date(trial.scheduledDate).toDateString() === date.toDateString() &&
      trial.id !== excludeId
    );
    
    // Group trials by time slot
    const trialsByTimeSlot = new Map<string, TrialSession[]>();
    
    for (const trial of teacherTrials) {
      // Check time overlap
      if (startTime < trial.endTime && endTime > trial.startTime) {
        const timeKey = `${trial.startTime}-${trial.endTime}`;
        if (!trialsByTimeSlot.has(timeKey)) {
          trialsByTimeSlot.set(timeKey, []);
        }
        trialsByTimeSlot.get(timeKey)!.push(trial);
      }
    }
    
    // Create issues for trial conflicts
    for (const [timeSlot, trials] of trialsByTimeSlot) {
      const studentNames = trials.map(t => t.studentName);
      
      const message = trials.length === 1
        ? `ครูไม่ว่าง - ทดลองเรียนของ ${studentNames[0]} เวลา ${timeSlot}`
        : `ครูไม่ว่าง - ทดลองเรียน ${trials.length} คน (${studentNames.join(', ')}) เวลา ${timeSlot}`;
      
      issues.push({
        type: 'teacher_conflict',
        message,
        details: {
          conflictType: 'trial',
          conflictName: studentNames.join(', '),
          conflictTime: timeSlot
        }
      });
    }
  }
  
  return issues;
}

/**
 * Quick check if a specific time slot is available
 */
export async function isTimeSlotAvailable(
  params: AvailabilityCheckParams
): Promise<boolean> {
  const result = await checkAvailability(params);
  return result.available;
}

/**
 * Optimized get all conflicts for a specific date and branch
 */
export async function getDayConflicts(
  date: Date,
  branchId: string
): Promise<{
  isHoliday: boolean;
  holidayName?: string;
  busySlots: Array<{
    startTime: string;
    endTime: string;
    type: 'class' | 'makeup' | 'trial';
    name: string;
    roomId: string;
    roomName?: string;
    teacherId: string;
    teacherName?: string;
    subjectId?: string;
    subjectColor?: string;
    studentName?: string;
    subjectName?: string;
    trialCount?: number;
    classId?: string;
    sessionNumber?: number;
    totalSessions?: number;
    isCompleted?: boolean;
    trialDetails?: Array<{
      id: string;
      studentName: string;
      subjectId: string;
      subjectName: string;
      status: string;
      attended?: boolean;
    }>;
  }>;
}> {
  // Check holiday
  const holidayCheck = await checkHolidayConflict(date, branchId);
  
  const busySlots: Array<{
    startTime: string;
    endTime: string;
    type: 'class' | 'makeup' | 'trial';
    name: string;
    roomId: string;
    roomName?: string;
    teacherId: string;
    teacherName?: string;
    subjectId?: string;
    subjectColor?: string;
    studentName?: string;
    subjectName?: string;
    trialCount?: number;
    classId?: string;
    sessionNumber?: number;
    totalSessions?: number;
    isCompleted?: boolean;
    trialDetails?: Array<{
      id: string;
      studentName: string;
      subjectId: string;
      subjectName: string;
      status: string;
      attended?: boolean;
    }>;
  }> = [];
  
  // Load all data in parallel
  const [classes, makeupClasses, trialSessions, subjects] = await Promise.all([
    getClasses(),
    getMakeupClasses(), 
    getTrialSessions(),
    getSubjects()
  ]);
  
  // Get teachers and rooms
  const { getTeachers } = await import('@/lib/services/teachers');
  const { getRoomsByBranch } = await import('@/lib/services/rooms');
  const [teachers, rooms] = await Promise.all([
    getTeachers(),
    getRoomsByBranch(branchId)
  ]);
  
  // Create lookup maps
  const teacherMap = new Map(teachers.map(t => [t.id, t]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  
  // Get all classes on that day
  const dayOfWeek = date.getDay();
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  const relevantClasses = classes.filter(cls => 
    cls.branchId === branchId &&
    cls.daysOfWeek.includes(dayOfWeek) &&
    (cls.status === 'published' || cls.status === 'started' || cls.status === 'completed') &&
    new Date(cls.startDate) <= dateOnly &&
    new Date(cls.endDate) >= dateOnly
  );
  
  // Batch load all schedules for relevant classes
  if (relevantClasses.length > 0) {
    const supabase = getClient();
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Get all schedules for relevant classes
    const schedulePromises = relevantClasses.map(async cls => {
      const { data, error } = await supabase
        .from('class_schedules')
        .select('id, session_number, session_date, status, topic')
        .eq('class_id', cls.id)
        .eq('session_date', dateString)
        .neq('status', 'cancelled');

      if (error) {
        console.error(`Error fetching schedules for class ${cls.id.substring(0, 8)}:`, error);
        return { classId: cls.id, schedules: [] };
      }

      return { classId: cls.id, schedules: data || [] };
    });

    const scheduleResults = await Promise.all(schedulePromises);

    // Process results
    relevantClasses.forEach((cls, index) => {
      const result = scheduleResults[index];

      if (result.schedules.length > 0) {
        const sessionData = result.schedules[0];
        const teacher = teacherMap.get(cls.teacherId);
        const room = roomMap.get(cls.roomId);
        const subject = subjectMap.get(cls.subjectId);

        busySlots.push({
          startTime: cls.startTime,
          endTime: cls.endTime,
          type: 'class',
          name: cls.name,
          roomId: cls.roomId,
          roomName: room?.name || cls.roomId,
          teacherId: cls.teacherId,
          teacherName: teacher?.nickname || teacher?.name || 'ไม่ระบุครู',
          subjectId: cls.subjectId,
          subjectName: subject?.name,
          subjectColor: subject?.color,
          classId: cls.id,
          sessionNumber: sessionData.session_number,
          totalSessions: cls.totalSessions,
          isCompleted: cls.status === 'completed'
        });
      }
    });
  }
  
  // Process makeup classes (already optimized)
  const relevantMakeups = makeupClasses.filter(makeup => 
    makeup.status === 'scheduled' &&
    makeup.makeupSchedule &&
    makeup.makeupSchedule.branchId === branchId &&
    new Date(makeup.makeupSchedule.date).toDateString() === date.toDateString()
  );
  
  // Batch load students for makeup classes
  if (relevantMakeups.length > 0) {
    const { getStudent } = await import('@/lib/services/parents');
    const studentPromises = relevantMakeups.map(makeup => 
      getStudent(makeup.parentId, makeup.studentId)
    );
    const students = await Promise.all(studentPromises);
    
    relevantMakeups.forEach((makeup, index) => {
      if (makeup.makeupSchedule) {
        const student = students[index];
        const teacher = teacherMap.get(makeup.makeupSchedule.teacherId);
        const room = roomMap.get(makeup.makeupSchedule.roomId);
        const originalClass = classes.find(c => c.id === makeup.originalClassId);
        const subject = originalClass ? subjectMap.get(originalClass.subjectId) : null;
        
        busySlots.push({
          startTime: makeup.makeupSchedule.startTime,
          endTime: makeup.makeupSchedule.endTime,
          type: 'makeup',
          name: `Makeup: ${student?.nickname || 'นักเรียน'}`,
          roomId: makeup.makeupSchedule.roomId,
          roomName: room?.name || makeup.makeupSchedule.roomId,
          teacherId: makeup.makeupSchedule.teacherId,
          teacherName: teacher?.nickname || teacher?.name || 'ไม่ระบุครู',
          studentName: student?.nickname || student?.name || 'นักเรียน',
          subjectId: originalClass?.subjectId,
          subjectName: subject?.name,
          subjectColor: subject?.color
        });
      }
    });
  }
  
  // Process trial sessions (already optimized with grouping)
  const relevantTrials = trialSessions.filter(trial =>
    trial.status === 'scheduled' &&
    trial.branchId === branchId &&
    new Date(trial.scheduledDate).toDateString() === date.toDateString()
  );
  
  // Group trials by time slot and room
  const trialGroups = new Map<string, TrialSession[]>();
  
  for (const trial of relevantTrials) {
    const key = `${trial.startTime}-${trial.endTime}-${trial.roomId}-${trial.teacherId}`;
    
    if (!trialGroups.has(key)) {
      trialGroups.set(key, []);
    }
    
    trialGroups.get(key)!.push(trial);
  }
  
  // Process each group
  for (const [key, trials] of trialGroups) {
    const firstTrial = trials[0];
    const teacher = teacherMap.get(firstTrial.teacherId);
    const room = roomMap.get(firstTrial.roomId);
    
    const studentNames = trials.map(t => t.studentName).join(', ');
    
    const uniqueSubjects = [...new Set(trials.map(t => {
      const subject = subjectMap.get(t.subjectId);
      return subject?.name || 'ไม่ระบุวิชา';
    }))];
    
    const trialDetails = trials.map(trial => {
      const subject = subjectMap.get(trial.subjectId);
      return {
        id: trial.id,
        studentName: trial.studentName,
        subjectId: trial.subjectId,
        subjectName: subject?.name || 'ไม่ระบุวิชา',
        status: trial.status,
        attended: trial.attended
      };
    });
    
    busySlots.push({
      startTime: firstTrial.startTime,
      endTime: firstTrial.endTime,
      type: 'trial',
      name: trials.length === 1 
        ? `ทดลอง: ${studentNames}` 
        : `ทดลอง ${trials.length} คน: ${studentNames}`,
      roomId: firstTrial.roomId,
      roomName: room?.name || firstTrial.roomName || firstTrial.roomId,
      teacherId: firstTrial.teacherId,
      teacherName: teacher?.nickname || teacher?.name || 'ไม่ระบุครู',
      studentName: studentNames,
      subjectName: uniqueSubjects.join(', '),
      trialCount: trials.length,
      trialDetails: trialDetails
    });
  }
  
  return {
    isHoliday: !!holidayCheck,
    holidayName: holidayCheck?.details?.holidayName,
    busySlots: busySlots.sort((a, b) => a.startTime.localeCompare(b.startTime))
  };
}
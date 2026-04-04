import { Class, ClassSchedule } from '@/types/models';
import { getClasses, getClassSchedules, updateClassSchedule, generateSchedules } from './classes';
import { getHolidaysForBranch } from './holidays';
import { adminMutation } from '@/lib/admin-mutation';
import { getClient } from '@/lib/supabase/client';

// Helper: get local date string (YYYY-MM-DD)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Types สำหรับ preview
export interface ReschedulePreviewClass {
  classId: string;
  className: string;
  code: string;
  branchId: string;
  totalSessions: number;
  currentScheduleCount: number;
  datesToRemove: string[];   // วันที่จะเอาออก (ตกวันหยุด หรือเลื่อนออก)
  datesToAdd: string[];      // วันที่จะเพิ่มเข้ามา (วันใหม่ หรือวันที่กลับมา)
  newEndDate: string;
  noChange: boolean;
}

export interface ReschedulePreview {
  totalClasses: number;
  affectedClasses: number;
  classDetails: ReschedulePreviewClass[];
}

// ========== RPC data types ==========

interface RpcResult {
  classes: {
    id: string;
    name: string;
    code: string;
    branch_id: string;
    start_date: string;
    end_date: string;
    days_of_week: number[];
    total_sessions: number;
    status: string;
  }[];
  schedules: {
    id: string;
    class_id: string;
    session_date: string;
    session_number: number;
    status: string;
  }[];
  makeup_refs: {
    original_class_id: string;
    original_schedule_id: string;
  }[];
  holidays: {
    id: string;
    name: string;
    date: string;
    type: string;
    branches: string[];
  }[];
}

async function fetchRescheduleData(): Promise<RpcResult> {
  const supabase = getClient();
  const { data, error } = await supabase.rpc('get_reschedule_preview');
  if (error) throw error;
  return data as RpcResult;
}

// Helper: get holiday date set for a branch
function getHolidaySetForBranch(
  allHolidays: RpcResult['holidays'],
  branchId: string,
): Set<string> {
  return new Set(
    allHolidays
      .filter(h => h.type === 'national' || h.branches?.includes(branchId))
      .map(h => h.date)
  );
}

// Helper: generate full schedule dates (pure computation)
function computeFullSchedule(
  startDate: string,
  daysOfWeek: number[],
  totalSessions: number,
  holidaySet: Set<string>,
): string[] {
  const schedules: string[] = [];
  const currentDate = new Date(startDate + 'T00:00:00');
  const maxDate = new Date(currentDate);
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  while (schedules.length < totalSessions && currentDate <= maxDate) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = getLocalDateString(currentDate);

    if (daysOfWeek.includes(dayOfWeek) && !holidaySet.has(dateStr)) {
      schedules.push(dateStr);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedules;
}

// Core: คำนวณ preview สำหรับ 1 class
function computeClassPreview(
  cls: RpcResult['classes'][0],
  schedules: RpcResult['schedules'],
  makeupScheduleIds: Set<string>,
  holidaySet: Set<string>,
) {
  // Keep: completed หรือมี makeup อ้างอิง
  const keepSchedules = schedules.filter(s =>
    s.status === 'completed' || makeupScheduleIds.has(s.id)
  );
  const keepDates = new Set(keepSchedules.map(s => s.session_date));

  // Delete: ที่เหลือทั้งหมด (จะถูก regenerate)
  const deleteSchedules = schedules.filter(s =>
    s.status !== 'completed' && !makeupScheduleIds.has(s.id)
  );

  // สร้างตารางใหม่ทั้งหมด (หลบวันหยุด)
  const idealSchedule = computeFullSchedule(
    cls.start_date, cls.days_of_week, cls.total_sessions, holidaySet
  );
  const idealSet = new Set(idealSchedule);

  // วันที่ต้องสร้างใหม่ = idealSchedule ลบ keepDates
  const newDatesToCreate = idealSchedule.filter(d => !keepDates.has(d));

  // ตารางสุดท้าย = keep + new sorted
  const finalSchedule = [...Array.from(keepDates), ...newDatesToCreate].sort();
  const newEndDate = finalSchedule.length > 0
    ? finalSchedule[finalSchedule.length - 1]
    : cls.end_date;

  // เช็คว่าเปลี่ยนไหม — เทียบ current dates กับ final dates
  const currentDates = new Set(schedules.map(s => s.session_date));
  const currentDatesSorted = [...currentDates].sort();
  const noChange = currentDatesSorted.length === finalSchedule.length &&
    currentDatesSorted.every((d, i) => d === finalSchedule[i]);

  // วันที่จะเอาออก = อยู่ใน current แต่ไม่อยู่ใน ideal (ที่ลบได้)
  const datesToRemove = deleteSchedules
    .filter(s => !idealSet.has(s.session_date))
    .map(s => s.session_date)
    .sort();

  // วันที่จะเพิ่ม = อยู่ใน ideal แต่ไม่อยู่ใน current
  const datesToAdd = idealSchedule
    .filter(d => !currentDates.has(d))
    .sort();

  return {
    keepSchedules,
    deleteSchedules,
    newDatesToCreate,
    finalSchedule,
    newEndDate,
    noChange,
    datesToRemove,
    datesToAdd,
  };
}

// ========== STEP 1: Preview ==========

export async function previewRescheduleAllClasses(): Promise<ReschedulePreview> {
  const data = await fetchRescheduleData();

  const schedulesByClass = new Map<string, RpcResult['schedules']>();
  for (const s of data.schedules) {
    if (!schedulesByClass.has(s.class_id)) schedulesByClass.set(s.class_id, []);
    schedulesByClass.get(s.class_id)!.push(s);
  }

  const makeupByClass = new Map<string, Set<string>>();
  for (const m of data.makeup_refs) {
    if (!makeupByClass.has(m.original_class_id)) makeupByClass.set(m.original_class_id, new Set());
    makeupByClass.get(m.original_class_id)!.add(m.original_schedule_id);
  }

  const classDetails: ReschedulePreviewClass[] = [];
  let affectedClasses = 0;

  for (const cls of data.classes) {
    const schedules = schedulesByClass.get(cls.id) || [];
    const makeupScheduleIds = makeupByClass.get(cls.id) || new Set();
    const holidaySet = getHolidaySetForBranch(data.holidays, cls.branch_id);

    const result = computeClassPreview(cls, schedules, makeupScheduleIds, holidaySet);

    if (!result.noChange) affectedClasses++;

    classDetails.push({
      classId: cls.id,
      className: cls.name,
      code: cls.code,
      branchId: cls.branch_id,
      totalSessions: cls.total_sessions,
      currentScheduleCount: schedules.length,
      datesToRemove: result.datesToRemove,
      datesToAdd: result.datesToAdd,
      newEndDate: result.newEndDate,
      noChange: result.noChange,
    });
  }

  return { totalClasses: data.classes.length, affectedClasses, classDetails };
}

// ========== STEP 2: Execute ==========

export async function rescheduleAllClasses(): Promise<{
  processedCount: number;
  details: { className: string; action: string }[]
}> {
  try {
    const data = await fetchRescheduleData();

    const schedulesByClass = new Map<string, RpcResult['schedules']>();
    for (const s of data.schedules) {
      if (!schedulesByClass.has(s.class_id)) schedulesByClass.set(s.class_id, []);
      schedulesByClass.get(s.class_id)!.push(s);
    }
    const makeupByClass = new Map<string, Set<string>>();
    for (const m of data.makeup_refs) {
      if (!makeupByClass.has(m.original_class_id)) makeupByClass.set(m.original_class_id, new Set());
      makeupByClass.get(m.original_class_id)!.add(m.original_schedule_id);
    }

    let processedCount = 0;
    const details: { className: string; action: string }[] = [];

    for (const cls of data.classes) {
      const schedules = schedulesByClass.get(cls.id) || [];
      const makeupScheduleIds = makeupByClass.get(cls.id) || new Set();
      const holidaySet = getHolidaySetForBranch(data.holidays, cls.branch_id);

      const result = computeClassPreview(cls, schedules, makeupScheduleIds, holidaySet);

      if (result.noChange) continue;

      // 1. ลบ schedules ที่ไม่ใช่ keep (batch delete)
      if (result.deleteSchedules.length > 0) {
        const deleteIds = result.deleteSchedules.map(s => s.id);
        await adminMutation({
          table: 'class_schedules',
          operation: 'delete',
          filters: [{ column: 'id', op: 'in', value: deleteIds }],
        });
      }

      // 2. Insert วันใหม่ + renumber ทั้งหมด
      if (result.newDatesToCreate.length > 0) {
        // session_number: keep schedules ก็ต้อง renumber ตาม finalSchedule order
        // แต่เราสร้างเฉพาะ new dates — keep dates ยัง session_number เดิม
        // ดังนั้น renumber keep schedules ก่อน แล้วค่อย insert new ต่อ

        // Renumber keep schedules ตาม position ใน finalSchedule
        for (const keepSch of result.keepSchedules) {
          const newNumber = result.finalSchedule.indexOf(keepSch.session_date) + 1;
          if (newNumber !== keepSch.session_number && newNumber > 0) {
            await adminMutation({
              table: 'class_schedules',
              operation: 'update',
              data: { session_number: newNumber },
              match: { id: keepSch.id },
            });
          }
        }

        // Insert new dates with correct session numbers
        const scheduleInserts = result.newDatesToCreate.map(date => ({
          class_id: cls.id,
          session_date: date,
          session_number: result.finalSchedule.indexOf(date) + 1,
          status: 'scheduled',
        }));

        await adminMutation({
          table: 'class_schedules',
          operation: 'insert',
          data: scheduleInserts,
        });
      }

      // 3. อัพเดต endDate
      if (result.newEndDate !== cls.end_date) {
        await adminMutation({
          table: 'classes',
          operation: 'update',
          data: { end_date: result.newEndDate },
          match: { id: cls.id },
        });
      }

      processedCount++;
      const keepNote = result.keepSchedules.length > 0 ? ` (เก็บ ${result.keepSchedules.length} ครั้ง)` : '';
      details.push({
        className: cls.name,
        action: `ลบ ${result.deleteSchedules.length} → สร้างใหม่ ${result.newDatesToCreate.length} ครั้ง${keepNote}`
      });
    }

    return { processedCount, details };
  } catch (error) {
    console.error('Error rescheduling all classes:', error);
    throw error;
  }
}

// ดึงประวัติการ reschedule ของคลาส
export async function getRescheduleHistory(
  classId: string
): Promise<ClassSchedule[]> {
  try {
    const schedules = await getClassSchedules(classId);
    return schedules.filter(s =>
      s.status === 'rescheduled' && s.originalDate
    );
  } catch (error) {
    console.error('Error getting reschedule history:', error);
    return [];
  }
}

// หาวันที่ว่างถัดไปสำหรับคลาส (สำหรับ reschedule แบบเดี่ยว)
export async function findNextAvailableDate(
  cls: Class,
  fromDate: Date,
  maxDate: Date
): Promise<Date | null> {
  try {
    const currentDate = new Date(fromDate);
    currentDate.setDate(currentDate.getDate() + 1);

    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay();

      if (cls.daysOfWeek.includes(dayOfWeek)) {
        const holidays = await getHolidaysForBranch(cls.branchId, currentDate, currentDate);

        if (holidays.length === 0) {
          const schedules = await getClassSchedules(cls.id);
          const hasSchedule = schedules.some(s =>
            getLocalDateString(new Date(s.sessionDate)) === getLocalDateString(currentDate)
          );

          if (!hasSchedule) {
            return new Date(currentDate);
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return null;
  } catch (error) {
    console.error('Error finding next available date:', error);
    return null;
  }
}

// Reschedule คลาสเดี่ยว
export async function rescheduleClass(
  classId: string,
  scheduleId: string,
  newDate: Date,
  reason: string,
  userId: string
): Promise<void> {
  try {
    const schedules = await getClassSchedules(classId);
    const currentSchedule = schedules.find(s => s.id === scheduleId);

    if (!currentSchedule) {
      throw new Error('Schedule not found');
    }

    await updateClassSchedule(classId, scheduleId, {
      sessionDate: newDate,
      status: 'rescheduled',
      originalDate: currentSchedule.sessionDate,
      rescheduledAt: new Date(),
      rescheduledBy: userId,
      note: reason
    });

  } catch (error) {
    console.error('Error rescheduling class:', error);
    throw error;
  }
}

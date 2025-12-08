import { Class, ClassSchedule } from '@/types/models';
import { getClasses, getClassSchedules, updateClassSchedule } from './classes';
import { getHolidaysForBranch } from './holidays';

// Generate schedule dates helper
async function generateScheduleDates(
  startDate: Date,
  daysOfWeek: number[],
  totalSessions: number,
  branchId: string
): Promise<Date[]> {
  const schedules: Date[] = [];
  const currentDate = new Date(startDate.getTime());
  
  // Get all holidays for the branch
  const maxEndDate = new Date(startDate);
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 1); // ดูล่วงหน้า 1 ปี
  
  const holidays = await getHolidaysForBranch(branchId, startDate, maxEndDate);
  
  // Create a Set of holiday dates for faster lookup
  const holidayDates = new Set(
    holidays.map(h => h.date.toDateString())
  );
  
  while (schedules.length < totalSessions) {
    const dayOfWeek = currentDate.getDay();
    
    // Check if it's a scheduled day and not a holiday
    if (daysOfWeek.includes(dayOfWeek) && !holidayDates.has(currentDate.toDateString())) {
      schedules.push(new Date(currentDate));
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return schedules;
}

// Reschedule ทุกคลาสให้ตรงกับจำนวนครั้งที่กำหนด
export async function rescheduleAllClasses(): Promise<{ 
  processedCount: number; 
  details: { className: string; action: string }[] 
}> {
  try {
    let processedCount = 0;
    const details: { className: string; action: string }[] = [];
    
    // ดึงคลาสทั้งหมดที่ active
    const classes = await getClasses();
    const activeClasses = classes.filter(c => 
      ['published', 'started'].includes(c.status)
    );
    
    console.log(`Found ${activeClasses.length} active classes to reschedule`);
    
    const batch = writeBatch(db);
    
    for (const cls of activeClasses) {
      console.log(`Processing class: ${cls.name}`);
      
      // ลบ schedules เดิมทั้งหมด
      const schedulesRef = collection(db, 'classes', cls.id, 'schedules');
      const existingSchedules = await getDocs(schedulesRef);
      
      // ลบทั้งหมดใน batch
      existingSchedules.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      
      console.log(`Deleted ${existingSchedules.size} existing schedules`);
      
      // สร้าง schedules ใหม่
      const newSchedules = await generateScheduleDates(
        cls.startDate,
        cls.daysOfWeek,
        cls.totalSessions,
        cls.branchId
      );
      
      console.log(`Generated ${newSchedules.length} new schedules`);
      
      // สร้าง schedule documents ใน batch
      for (let i = 0; i < newSchedules.length; i++) {
        const scheduleRef = doc(collection(db, 'classes', cls.id, 'schedules'));
        batch.set(scheduleRef, {
          classId: cls.id,
          sessionDate: Timestamp.fromDate(newSchedules[i]),
          sessionNumber: i + 1,
          status: 'scheduled',
          // note: 'สร้างจากการ reschedule ทั้งหมด'
        });
      }
      
      // อัพเดต endDate ให้ตรงกับวันสุดท้าย
      if (newSchedules.length > 0) {
        const newEndDate = newSchedules[newSchedules.length - 1];
        const classRef = doc(db, 'classes', cls.id);
        batch.update(classRef, {
          endDate: Timestamp.fromDate(newEndDate)
        });
      }
      
      processedCount++;
      details.push({
        className: cls.name,
        action: `จัดตารางใหม่ ${newSchedules.length} ครั้ง (ตามที่กำหนด: ${cls.totalSessions} ครั้ง)`
      });
    }
    
    // Commit batch
    await batch.commit();
    
    return { processedCount, details };
  } catch (error) {
    console.error('Error rescheduling all classes:', error);
    throw error;
  }
}

// ตรวจสอบว่าเป็นวันหยุดหรือไม่
async function checkIfHoliday(
  date: Date,
  branchId: string
): Promise<boolean> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Query วันหยุดทั้งหมดในวันนั้น
    const q = query(
      collection(db, 'holidays'),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay))
    );
    
    const snapshot = await getDocs(q);
    
    // ตรวจสอบว่ามีวันหยุดที่กระทบ branch นี้หรือไม่
    for (const docSnap of snapshot.docs) {
      const holiday = docSnap.data();
      if (holiday.type === 'national' || 
          holiday.branches?.includes(branchId)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking holiday:', error);
    return false;
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
    
    // หาวันที่ตรงกับวันเรียนของคลาส
    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay();
      
      if (cls.daysOfWeek.includes(dayOfWeek)) {
        // ตรวจสอบว่าไม่ใช่วันหยุด
        const isHolidayDate = await checkIfHoliday(
          currentDate,
          cls.branchId
        );
        
        if (!isHolidayDate) {
          // ตรวจสอบว่าไม่มีคลาสอื่นในวันนี้แล้ว
          const schedules = await getClassSchedules(cls.id);
          const hasSchedule = schedules.some(s => 
            new Date(s.sessionDate).toDateString() === currentDate.toDateString()
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
    // Get current schedule
    const schedules = await getClassSchedules(classId);
    const currentSchedule = schedules.find(s => s.id === scheduleId);
    
    if (!currentSchedule) {
      throw new Error('Schedule not found');
    }
    
    // Update schedule
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
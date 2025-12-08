// lib/services/line-notifications.ts

import { formatDate, formatTime, getDayName } from '@/lib/utils';

// ดึง LINE settings
async function getLineSettings() {
  const docRef = doc(db, 'settings', 'line');
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// Helper to get base URL
function getBaseUrl(): string {
  // Check if we're on the server
  if (typeof window === 'undefined') {
    // Server-side: Priority order
    // 1. NEXT_PUBLIC_APP_URL (manual setting - highest priority)
    if (process.env.NEXT_PUBLIC_APP_URL) {
      const url = process.env.NEXT_PUBLIC_APP_URL;
      console.log('[getBaseUrl] Using NEXT_PUBLIC_APP_URL:', url.substring(0, 30) + '...');
      return url;
    }
    
    // 2. VERCEL_URL (automatic on Vercel - fallback)
    if (process.env.VERCEL_URL) {
      const url = `https://${process.env.VERCEL_URL}`;
      console.log('[getBaseUrl] Using VERCEL_URL:', url.substring(0, 30) + '...');
      return url;
    }
    
    // 3. Fallback for local development
    console.warn('[getBaseUrl] ⚠️ No URL configured, using localhost (this will fail on Vercel!)');
    return 'http://localhost:3000';
  }
  
  // Client-side: use window.location
  return window.location.origin;
}

// ส่งข้อความผ่าน LINE API (รองรับทั้ง text และ flex)
export async function sendLineMessage(
  userId: string,
  message: string,
  accessToken?: string,
  options?: {
    useFlexMessage?: boolean;
    flexTemplate?: string;
    flexData?: any;
    altText?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // ถ้าไม่ได้ส่ง token มา ให้ดึงจาก settings
    if (!accessToken) {
      const settings = await getLineSettings();
      accessToken = settings?.messagingChannelAccessToken;
    }
    
    if (!accessToken) {
      console.log('[sendLineMessage] No access token found');
      return { success: false, error: 'ไม่พบ Channel Access Token' };
    }
    
    // ตรวจสอบว่าเปิดการแจ้งเตือนหรือไม่
    const settings = await getLineSettings();
    if (!settings?.enableNotifications) {
      console.log('[sendLineMessage] Notifications are disabled');
      return { success: false, error: 'การแจ้งเตือนถูกปิดอยู่' };
    }
    
    console.log(`[sendLineMessage] Sending to user: ${userId.substring(0, 10)}...`);
    
    // Get base URL for fetch
    const baseUrl = getBaseUrl();
    
    // ถ้าต้องการส่งแบบ Flex Message
    if (options?.useFlexMessage && options?.flexTemplate && options?.flexData) {
      console.log(`[sendLineMessage] Using flex template: ${options.flexTemplate}`);
      
      const response = await fetch(`${baseUrl}/api/line/send-flex-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          template: options.flexTemplate,
          data: options.flexData,
          altText: options.altText || message.split('\n')[0],
          accessToken 
        })
      });
      
      const result = await response.json();
      console.log('[sendLineMessage] Flex message result:', result);
      return result;
    }
    
    // ส่งแบบ text ปกติ
    console.log('[sendLineMessage] Using text message');
    
    const response = await fetch(`${baseUrl}/api/line/send-message-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId, 
        message,
        accessToken 
      })
    });
    
    const result = await response.json();
    console.log('[sendLineMessage] Text message result:', result);
    return result;
  } catch (error) {
    console.error('[sendLineMessage] Error:', error);
    return { success: false, error: 'เกิดข้อผิดพลาด' };
  }
}

// 1. แจ้งเตือนก่อนเรียน (คลาสปกติ)
export async function sendClassReminder(
  studentId: string,
  classId: string,
  scheduleDate: Date,
  scheduleId?: string // เพิ่ม parameter นี้เพื่อดึง schedule data
): Promise<boolean> {
  try {
    console.log(`\n[sendClassReminder] Starting for student: ${studentId}, class: ${classId}`);
    console.log(`[sendClassReminder] Schedule date: ${scheduleDate.toISOString()}`);
    console.log(`[sendClassReminder] Schedule ID: ${scheduleId || 'not provided'}`);
    
    // ดึงข้อมูลนักเรียน - ใช้วิธีตรงๆ แทน
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('status', '==', 'active')
    );
    const enrollmentSnapshot = await getDocs(enrollmentsQuery);
    
    if (enrollmentSnapshot.empty) {
      console.log('[sendClassReminder] No active enrollment found');
      return false;
    }
    
    const enrollment = enrollmentSnapshot.docs[0].data();
    const parentId = enrollment.parentId;
    
    console.log(`[sendClassReminder] Found enrollment, parent: ${parentId}`);
    
    // ดึงข้อมูลผู้ปกครอง
    const parentDoc = await getDoc(doc(db, 'parents', parentId));
    if (!parentDoc.exists() || !parentDoc.data().lineUserId) {
      console.log('[sendClassReminder] Parent not found or no LINE ID');
      return false;
    }
    const parent = parentDoc.data();
    
    console.log(`[sendClassReminder] Parent LINE ID: ${parent.lineUserId?.substring(0, 10)}...`);
    
    // ดึงข้อมูลนักเรียน
    const studentDoc = await getDoc(doc(db, 'parents', parentId, 'students', studentId));
    if (!studentDoc.exists()) {
      console.log('[sendClassReminder] Student not found');
      return false;
    }
    const student = studentDoc.data();
    
    // ดึงข้อมูลคลาส
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
      console.log('[sendClassReminder] Class not found');
      return false;
    }
    const classData = classDoc.data();
    
    console.log(`[sendClassReminder] Class: ${classData.name}`);
    
    // ดึง sessionNumber จาก schedule ถ้ามี scheduleId
    let sessionNumber: number | undefined;
    if (scheduleId) {
      const scheduleDoc = await getDoc(doc(db, 'classes', classId, 'schedules', scheduleId));
      if (scheduleDoc.exists()) {
        sessionNumber = scheduleDoc.data().sessionNumber;
        console.log(`[sendClassReminder] Found session number: ${sessionNumber}`);
      }
    }
    
    // ถ้าไม่มี scheduleId ให้ลองหาจาก date
    if (!sessionNumber) {
      console.log('[sendClassReminder] Trying to find schedule by date...');
      
      const nextDay = new Date(scheduleDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const schedulesQuery = query(
        collection(db, 'classes', classId, 'schedules'),
        where('sessionDate', '>=', Timestamp.fromDate(scheduleDate)),
        where('sessionDate', '<', Timestamp.fromDate(nextDay))
      );
      
      const schedulesSnapshot = await getDocs(schedulesQuery);
      if (!schedulesSnapshot.empty) {
        sessionNumber = schedulesSnapshot.docs[0].data().sessionNumber;
        console.log(`[sendClassReminder] Found session number from query: ${sessionNumber}`);
      }
    }
    
    // ดึงข้อมูลวิชา
    const subjectDoc = await getDoc(doc(db, 'subjects', classData.subjectId));
    const subject = subjectDoc.exists() ? subjectDoc.data() : null;
    
    // ดึงข้อมูลครู
    const teacherDoc = await getDoc(doc(db, 'teachers', classData.teacherId));
    const teacher = teacherDoc.exists() ? teacherDoc.data() : null;
    
    // ดึงข้อมูลสาขา
    const branchDoc = await getDoc(doc(db, 'branches', classData.branchId));
    const branch = branchDoc.exists() ? branchDoc.data() : null;
    
    // ดึงข้อมูลห้อง
    const roomDoc = await getDoc(doc(db, 'branches', classData.branchId, 'rooms', classData.roomId));
    const room = roomDoc.exists() ? roomDoc.data() : null;
    
    console.log('[sendClassReminder] All data collected, preparing to send...');
    console.log(`[sendClassReminder] Session number: ${sessionNumber || 'not found'}`);
    
    // ส่งข้อความแบบ Flex Message
    const result = await sendLineMessage(parent.lineUserId, '', undefined, {
      useFlexMessage: true,
      flexTemplate: 'classReminder',
      flexData: {
        studentName: student.nickname || student.name,
        className: classData.name,
        sessionNumber: sessionNumber, // ส่ง sessionNumber ไป
        date: formatDate(scheduleDate, 'long'),
        startTime: formatTime(classData.startTime),
        endTime: formatTime(classData.endTime),
        teacherName: `ครู${teacher?.nickname || teacher?.name || 'ไม่ระบุ'}`,
        location: branch?.name || '',
        roomName: room?.name || classData.roomId
      },
      altText: `แจ้งเตือนคลาสเรียนพรุ่งนี้ - น้อง${student.nickname || student.name}`
    });
    
    if (result.success) {
      console.log(`[sendClassReminder] ✓ Successfully sent reminder for student ${studentId} class ${classId}`);
    } else {
      console.log(`[sendClassReminder] ✗ Failed to send reminder: ${result.error}`);
    }
    
    return result.success;
  } catch (error) {
    console.error('[sendClassReminder] Error:', error);
    return false;
  }
}

// 2. แจ้งเตือน Makeup Class
export async function sendMakeupNotification(
  makeupId: string,
  type: 'scheduled' | 'reminder'
): Promise<boolean> {
  try {
    console.log(`\n[sendMakeupNotification] Starting for makeup: ${makeupId}, type: ${type}`);
    
    // ดึงข้อมูล makeup
    const makeupDoc = await getDoc(doc(db, 'makeupClasses', makeupId));
    if (!makeupDoc.exists()) {
      console.log('[sendMakeupNotification] Makeup not found');
      return false;
    }
    const makeup = makeupDoc.data();
    
    if (!makeup.makeupSchedule) {
      console.log('[sendMakeupNotification] No makeup schedule');
      return false;
    }
    
    // ดึงข้อมูลผู้ปกครอง
    const parentDoc = await getDoc(doc(db, 'parents', makeup.parentId));
    if (!parentDoc.exists() || !parentDoc.data().lineUserId) {
      console.log('[sendMakeupNotification] Parent not found or no LINE ID');
      return false;
    }
    const parent = parentDoc.data();
    
    console.log(`[sendMakeupNotification] Parent LINE ID: ${parent.lineUserId?.substring(0, 10)}...`);
    
    // ดึงข้อมูลนักเรียน
    const studentDoc = await getDoc(doc(db, 'parents', makeup.parentId, 'students', makeup.studentId));
    if (!studentDoc.exists()) {
      console.log('[sendMakeupNotification] Student not found');
      return false;
    }
    const student = studentDoc.data();
    
    // ดึงข้อมูลคลาสเดิม
    const classDoc = await getDoc(doc(db, 'classes', makeup.originalClassId));
    const classData = classDoc.exists() ? classDoc.data() : null;
    
    // ดึงข้อมูลวิชา
    const subjectDoc = classData ? await getDoc(doc(db, 'subjects', classData.subjectId)) : null;
    const subject = subjectDoc?.exists() ? subjectDoc.data() : null;
    
    // ดึงข้อมูลครู
    const teacherDoc = await getDoc(doc(db, 'teachers', makeup.makeupSchedule.teacherId));
    const teacher = teacherDoc.exists() ? teacherDoc.data() : null;
    
    // ดึงข้อมูลสาขาและห้อง
    const branchDoc = await getDoc(doc(db, 'branches', makeup.makeupSchedule.branchId));
    const branch = branchDoc.exists() ? branchDoc.data() : null;
    
    const roomDoc = await getDoc(doc(db, 'branches', makeup.makeupSchedule.branchId, 'rooms', makeup.makeupSchedule.roomId));
    const room = roomDoc.exists() ? roomDoc.data() : null;
    
    // แปลง Timestamp เป็น Date
    const makeupDate = makeup.makeupSchedule.date.toDate ? makeup.makeupSchedule.date.toDate() : new Date(makeup.makeupSchedule.date);
    
    console.log('[sendMakeupNotification] All data collected, preparing to send...');
    
    // ส่งข้อความแบบ Flex Message
    const result = await sendLineMessage(parent.lineUserId, '', undefined, {
      useFlexMessage: true,
      flexTemplate: type === 'reminder' ? 'makeupReminder' : 'makeupConfirmation',
      flexData: {
        studentName: student.nickname || student.name,
        className: classData?.name || 'Makeup Class',
        sessionNumber: makeup.originalSessionNumber,
        date: formatDate(makeupDate, 'long'),
        startTime: formatTime(makeup.makeupSchedule.startTime),
        endTime: formatTime(makeup.makeupSchedule.endTime),
        teacherName: `ครู${teacher?.nickname || teacher?.name || 'ไม่ระบุ'}`,
        location: branch?.name || '',
        roomName: room?.name || makeup.makeupSchedule.roomId
      },
      altText: type === 'reminder' 
        ? `แจ้งเตือน Makeup Class พรุ่งนี้ - น้อง${student.nickname || student.name}`
        : `ยืนยันการนัด Makeup Class - น้อง${student.nickname || student.name}`
    });
    
    if (result.success) {
      console.log(`[sendMakeupNotification] ✓ Successfully sent makeup ${type} for makeup ${makeupId}`);
    } else {
      console.error(`[sendMakeupNotification] ✗ Failed to send makeup ${type}:`, result.error);
    }
    
    return result.success;
  } catch (error) {
    console.error('[sendMakeupNotification] Error:', error);
    return false;
  }
}

// 3. ยืนยันการจองทดลองเรียน
export async function sendTrialConfirmation(
  trialSessionId: string
): Promise<boolean> {
  try {
    console.log(`\n[sendTrialConfirmation] Starting for trial: ${trialSessionId}`);
    
    const trialDoc = await getDoc(doc(db, 'trialSessions', trialSessionId));
    if (!trialDoc.exists()) {
      console.log('[sendTrialConfirmation] Trial not found');
      return false;
    }
    const trial = trialDoc.data();
    
    // ดึงข้อมูล booking
    const bookingDoc = await getDoc(doc(db, 'trialBookings', trial.bookingId));
    if (!bookingDoc.exists()) {
      console.log('[sendTrialConfirmation] Booking not found');
      return false;
    }
    const booking = bookingDoc.data();
    
    // ถ้าไม่มี LINE ID ส่งไม่ได้
    if (!booking.parentLineId) {
      console.log('[sendTrialConfirmation] No LINE ID in booking');
      return false;
    }
    
    console.log(`[sendTrialConfirmation] Booking LINE ID: ${booking.parentLineId.substring(0, 10)}...`);
    
    // ดึงข้อมูลวิชา
    const subjectDoc = await getDoc(doc(db, 'subjects', trial.subjectId));
    const subject = subjectDoc.exists() ? subjectDoc.data() : null;
    
    // ดึงข้อมูลสาขา
    const branchDoc = await getDoc(doc(db, 'branches', trial.branchId));
    const branch = branchDoc.exists() ? branchDoc.data() : null;
    
    // ดึงข้อมูลห้อง
    const roomDoc = await getDoc(doc(db, 'branches', trial.branchId, 'rooms', trial.roomId));
    const room = roomDoc.exists() ? roomDoc.data() : null;
    
    console.log('[sendTrialConfirmation] All data collected, preparing to send...');
    
    // ส่งข้อความแบบ Flex Message
    const result = await sendLineMessage(booking.parentLineId, '', undefined, {
      useFlexMessage: true,
      flexTemplate: 'trialConfirmation',
      flexData: {
        studentName: trial.studentName,
        subjectName: subject?.name || 'ไม่ระบุ',
        date: formatDate(trial.scheduledDate.toDate(), 'long'),
        startTime: formatTime(trial.startTime),
        endTime: formatTime(trial.endTime),
        location: branch?.name || 'ไม่ระบุ',
        roomName: room?.name || trial.roomName || 'ไม่ระบุ',
        contactPhone: branch?.phone || '081-234-5678'
      },
      altText: `ยืนยันการทดลองเรียน - น้อง${trial.studentName}`
    });
    
    if (result.success) {
      console.log('[sendTrialConfirmation] ✓ Successfully sent trial confirmation');
    } else {
      console.log('[sendTrialConfirmation] ✗ Failed to send trial confirmation:', result.error);
    }
    
    return result.success;
  } catch (error) {
    console.error('[sendTrialConfirmation] Error:', error);
    return false;
  }
}

// แจ้งเตือนผู้ปกครองเมื่อมี feedback ใหม่
export async function sendFeedbackNotification(
  parentLineId: string,
  studentName: string,
  className: string,
  teacherName: string,
  feedback: string
): Promise<boolean> {
  try {
    console.log(`\n[sendFeedbackNotification] Sending to parent: ${parentLineId.substring(0, 10)}...`);
    
    const message = `📝 Teacher Feedback\n\n` +
      `นักเรียน: ${studentName}\n` +
      `คลาส: ${className}\n` +
      `จากครู: ${teacherName}\n\n` +
      `"${feedback}"\n\n` +
      `ดูทั้งหมดได้ที่เมนู Teacher Feedback`;
      
    const result = await sendLineMessage(parentLineId, message);
    
    if (result.success) {
      console.log('[sendFeedbackNotification] ✓ Successfully sent feedback notification');
    } else {
      console.log('[sendFeedbackNotification] ✗ Failed to send feedback notification:', result.error);
    }
    
    return result.success;
  } catch (error) {
    console.error('[sendFeedbackNotification] Error:', error);
    return false;
  }
}
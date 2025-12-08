// User Types
export interface Parent {
  id: string;
  lineUserId?: string;
  displayName: string;
  pictureUrl?: string;
  phone: string;
  emergencyPhone?: string;
  email?: string;
  address?: {
    houseNumber: string;
    street?: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };
  preferredBranchId?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

// Admin User - สำหรับ Authentication และ Permissions
export interface AdminUser {
  id: string; // uid จาก Firebase Auth
  email: string;
  displayName: string;
  role: 'super_admin' | 'branch_admin' | 'teacher';
  branchIds: string[]; // สาขาที่ดูแลได้ (empty array = ทุกสาขา)
  permissions?: {
    canManageUsers?: boolean;
    canManageSettings?: boolean;
    canViewReports?: boolean;
    canManageAllBranches?: boolean;
  };
  teacherId?: string; // เพิ่ม: reference ไปยัง teachers collection (สำหรับ role='teacher')
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Student {
  id: string;
  parentId: string;
  name: string;
  nickname: string;
  birthdate: Date;
  gender: 'M' | 'F';
  schoolName?: string;
  gradeLevel?: string;
  profileImage?: string;
  allergies?: string;
  specialNeeds?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive: boolean;
}

// Branch & Location Types
export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  location?: {
    lat: number;
    lng: number;
  };
  openTime: string;
  closeTime: string;
  openDays: number[];
  isActive: boolean;
  managerName?: string;
  managerPhone?: string;
  lineGroupUrl?: string;
  createdAt: Date;
}

export interface Room {
  id: string;
  branchId: string;
  name: string;
  capacity: number;
  floor?: string;
  hasProjector: boolean;
  hasWhiteboard: boolean;
  isActive: boolean;
}

// Academic Types
export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string;
  category: 'Coding' | 'Robotics' | 'AI' | 'Other';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  ageRange: {
    min: number;
    max: number;
  };
  color: string;
  icon?: string;
  prerequisites?: string[];
  isActive: boolean;
}

// Teacher - ข้อมูลครูแบบละเอียด (ใช้สำหรับระบบการสอน)
export interface Teacher {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  phone: string;
  lineUserId?: string;
  specialties: string[]; // subject IDs
  availableBranches: string[]; // branch IDs
  profileImage?: string;
  hourlyRate?: number;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  isActive: boolean;
  hasLogin?: boolean; // เพิ่ม: flag บอกว่ามี adminUser หรือยัง
  createdAt?: Date; // เพิ่ม: วันที่สร้าง
  updatedAt?: Date; // เพิ่ม: วันที่อัปเดต
}

export interface Class {
  id: string;
  subjectId: string; // ใช้แบบเดิม ไม่ต้องแก้
  teacherId: string;
  branchId: string;
  roomId: string;
  name: string; // ชื่อคลาส เช่น "VEX Beginner - Sat Morning A"
  code: string; // รหัสคลาส เช่น "BKK01-VEXG01-2501-A"
  description?: string;
  startDate: Date;
  endDate: Date;
  totalSessions: number; // ดึงมาจาก curriculum หรือกำหนดเอง
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  maxStudents: number;
  minStudents: number;
  enrolledCount: number;
  pricing: {
    pricePerSession: number;
    totalPrice: number;
    materialFee?: number;
    registrationFee?: number;
  };
  status: 'draft' | 'published' | 'started' | 'completed' | 'cancelled';
  createdAt: Date;
}

// Update ClassSchedule interface - เพิ่ม feedback ใน attendance
export interface ClassSchedule {
  id: string;
  classId: string;
  sessionDate: Date;
  sessionNumber: number;
  topic?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  actualTeacherId?: string;
  note?: string;
  attendance?: {
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'sick' | 'leave';
    note?: string;
    checkedAt?: Date;
    checkedBy?: string;
    // เพิ่ม feedback field (optional)
    feedback?: string; // เปลี่ยนเป็น string ธรรมดา
  }[];
  originalDate?: Date;
  rescheduledAt?: Date;
  rescheduledBy?: string;
}

// เพิ่ม interface ใหม่สำหรับ Feedback History
export interface StudentFeedback {
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

// Enrollment & Payment Types
export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  parentId: string;
  branchId: string;
  enrolledAt: Date;
  status: 'active' | 'completed' | 'dropped' | 'transferred';
  pricing: {
    originalPrice: number;
    discount: number;
    discountType: 'percentage' | 'fixed';
    finalPrice: number;
    promotionCode?: string;
  };
  payment: {
    method: 'cash' | 'transfer' | 'credit';
    status: 'pending' | 'partial' | 'paid';
    paidAmount: number;
    paidDate?: Date;
    receiptNumber?: string;
  };
  transferredFrom?: string;
  droppedReason?: string;
  transferHistory?: Array<{
    fromClassId: string;
    toClassId: string;
    transferredAt: Date;
    reason: string;
  }>;
}

// Trial & Booking Types
export interface TrialBooking {
  id: string;
  source: 'online' | 'walkin' | 'phone';
  
  // Parent Info (ยังไม่เป็น Parent จริง)
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  
  // Students (รองรับหลายคน)
  students: {
    name: string;
    schoolName?: string;
    gradeLevel?: string;
    birthdate?: Date;              // ✨ เพิ่มใหม่: วันเกิด
    subjectInterests: string[]; // วิชาที่สนใจ (subject IDs)
  }[];

  branchId?: string; // สาขาที่ติดต่อ/จอง
  
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'converted' | 'cancelled';
  
  // Admin จัดการ
  assignedTo?: string; // admin ID ที่รับผิดชอบ
  contactedAt?: Date;
  contactNote?: string;
  
  createdAt: Date;
  updatedAt?: Date;
}

export interface TrialSession {
  id: string;
  bookingId: string;
  studentName: string;
  
  // Schedule
  subjectId: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  
  // Resources
  teacherId: string;
  branchId: string;
  roomId: string;
  roomName?: string;
  
  status: 'scheduled' | 'attended' | 'absent' | 'cancelled';
  
  // After trial
  attended?: boolean;
  feedback?: string;
  teacherNote?: string;
  interestedLevel?: 'high' | 'medium' | 'low' | 'not_interested';
  
  // Conversion
  converted?: boolean;
  convertedToClassId?: string;
  conversionNote?: string;
  
  // Rescheduling history
  rescheduleHistory?: Array<{
    originalDate: Date;
    originalTime: string;
    newDate: Date;
    newTime: string;
    reason?: string;
    rescheduledBy: string;
    rescheduledAt: Date;
  }>;
  
  createdAt: Date;
  completedAt?: Date;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'reminder' | 'announcement' | 'schedule_change' | 'payment' | 'makeup' | 'system';
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  data?: { [key: string]: unknown };
  sentAt: Date;
  readAt?: Date;
  isRead: boolean;
}

// Promotion Types
export interface Promotion {
  id: string;
  name: string;
  code: string;
  description: string;
  type: 'percentage' | 'fixed' | 'package';
  value: number;
  conditions: {
    minPurchase?: number;
    applicableTo: ('subjects' | 'branches' | 'all')[];
    validBranches?: string[];
    validSubjects?: string[];
  };
  startDate: Date;
  endDate: Date;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
}

// Holiday Types
export interface Holiday {
  id: string;
  name: string;
  date: Date;
  type: 'national' | 'branch';
  branches?: string[]; // Empty for national holidays, branch IDs for branch-specific
  description?: string;
}

// Room Availability Check Result
export interface RoomAvailabilityResult {
  available: boolean;
  conflicts?: {
    classId: string;
    className: string;
    classCode: string;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
  }[];
}

// Makeup Class Types - Updated with Denormalized Data
export interface MakeupClass {
  id: string;
  type: 'scheduled' | 'ad-hoc';
  
  // Original Class Info
  originalClassId: string;
  originalScheduleId: string;
  originalSessionNumber?: number;
  originalSessionDate?: Date;
  
  // Denormalized Class Data ✨
  className: string;              // เพิ่ม: ชื่อคลาสเดิม
  classCode: string;              // เพิ่ม: รหัสคลาสเดิม
  subjectId: string;              // เพิ่ม: วิชา
  subjectName: string;            // เพิ่ม: ชื่อวิชา
  
  // Student Info
  studentId: string;
  
  // Denormalized Student Data ✨
  studentName: string;            // เพิ่ม: ชื่อเต็มนักเรียน
  studentNickname: string;        // เพิ่ม: ชื่อเล่น
  
  // Parent Info
  parentId: string;
  
  // Denormalized Parent Data ✨
  parentName: string;             // เพิ่ม: ชื่อผู้ปกครอง
  parentPhone: string;            // เพิ่ม: เบอร์ผู้ปกครอง
  parentLineUserId?: string;      // เพิ่ม: LINE User ID (สำหรับส่ง notification)
  
  // Branch Info - เพิ่มทั้ง section ✨
  branchId: string;               // เพิ่ม: สาขาที่เรียน
  branchName: string;             // เพิ่ม: ชื่อสาขา
  
  // Request Info
  requestDate: Date;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  
  // Makeup Schedule
  makeupSchedule?: {
    date: Date;
    startTime: string;
    endTime: string;
    teacherId: string;
    teacherName?: string;         // เพิ่ม: ชื่อครู (optional)
    branchId: string;
    roomId: string;
    roomName?: string;            // เพิ่ม: ชื่อห้อง (optional)
    confirmedAt?: Date;
    confirmedBy?: string;
  };
  
  // Attendance
  attendance?: {
    status: 'present' | 'absent';
    checkedBy: string;
    checkedAt: Date;
    note?: string;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date;
  notes?: string;
}

export interface LinkToken {
  id: string;                    // Document ID ใน Firestore
  token: string;                 // Token 32 ตัวอักษร สำหรับ QR Code
  parentId: string;              // ID ของผู้ปกครองที่จะเชื่อมต่อ
  createdAt: Date;               // วันเวลาที่สร้าง token
  expiresAt: Date;               // วันเวลาที่หมดอายุ (24 ชม.)
  used: boolean;                 // สถานะการใช้งาน
  usedAt?: Date;                 // วันเวลาที่ใช้ (optional - มีค่าเมื่อใช้แล้ว)
  linkedLineUserId?: string;     // LINE User ID ที่เชื่อมต่อ (optional - มีค่าเมื่อใช้แล้ว)
}

// Utility Types for Migration
export interface MigrationResult {
  success: number;
  failed: number;
  errors: string[];
  details?: {
    teacherId: string;
    teacherName: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }[];
}

// Teaching Materials - สื่อการสอนที่ผูกกับวิชา
export interface TeachingMaterial {
  id: string;
  subjectId: string; // ผูกกับวิชาโดยตรง
  sessionNumber: number; // ครั้งที่
  title: string; // ชื่อบทเรียน
  description?: string; // คำอธิบายสั้นๆ
  objectives: string[]; // จุดประสงค์การเรียนรู้
  materials: string[]; // อุปกรณ์ที่ใช้
  preparation: string[]; // การเตรียมตัวก่อนสอน
  canvaUrl: string; // Canva share URL
  embedUrl: string; // Auto-generated embed URL
  thumbnailUrl?: string; // รูป thumbnail
  duration: number; // ระยะเวลา (นาที)
  teachingNotes?: string; // บันทึกสำหรับครู
  tags?: string[]; // แท็ก เช่น ["hands-on", "group-work", "assessment"]
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// Teaching Materials - สื่อการสอนที่ผูกกับวิชา
export interface TeachingMaterial {
  id: string;
  subjectId: string; // ผูกกับวิชาโดยตรง
  sessionNumber: number; // ครั้งที่
  title: string; // ชื่อบทเรียน
  description?: string; // คำอธิบายสั้นๆ
  objectives: string[]; // จุดประสงค์การเรียนรู้
  materials: string[]; // อุปกรณ์ที่ใช้
  preparation: string[]; // การเตรียมตัวก่อนสอน
  canvaUrl: string; // Canva share URL
  embedUrl: string; // Auto-generated embed URL
  thumbnailUrl?: string; // รูป thumbnail
  duration: number; // ระยะเวลา (นาที)
  teachingNotes?: string; // บันทึกสำหรับครู
  tags?: string[]; // แท็ก เช่น ["hands-on", "group-work", "assessment"]
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

// Event Types - ระบบจัดงาน/กิจกรรม
export interface Event {
  id: string;
  name: string;                          // ชื่องาน
  description: string;                   // คำอธิบายสั้นๆ
  fullDescription?: string;              // รายละเอียดแบบยาว (รองรับ markdown)
  imageUrl?: string;                     // URL รูปภาพ Event
  location: string;                      // สถานที่จัดงาน
  locationUrl?: string;                  // Google Maps URL
  
  // Branch Settings
  branchIds: string[];                   // สาขาที่จัด Event
  
  // Event Type & Display
  eventType: 'open-house' | 'parent-meeting' | 'showcase' | 'workshop' | 'other';
  highlights?: string[];                 // จุดเด่นของงาน
  targetAudience?: string;               // กลุ่มเป้าหมาย
  whatToBring?: string[];                // สิ่งที่ควรนำมา
  
  // Registration Settings
  registrationStartDate: Date;           // เปิดรับลงทะเบียน
  registrationEndDate: Date;             // ปิดรับลงทะเบียน
  
  // Counting Method
  countingMethod: 'students' | 'parents' | 'registrations';
  
  // Reminder Settings
  enableReminder: boolean;               // เปิด/ปิดการแจ้งเตือน
  reminderDaysBefore: number;            // แจ้งเตือนล่วงหน้ากี่วัน (default: 1)
  reminderTime?: string;                 // เวลาที่จะส่ง reminder
  
  // Status
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  createdBy: string;                     // userId ของคนสร้าง
  updatedAt?: Date;
  updatedBy?: string;
}

export interface EventSchedule {
  id: string;
  eventId: string;                       // Reference to events
  date: Date;                            // วันที่จัด
  startTime: string;                     // เวลาเริ่ม "09:00"
  endTime: string;                       // เวลาจบ "12:00"
  maxAttendees: number;                  // จำนวนรับสูงสุด
  
  // นับแยกตามสาขา
  attendeesByBranch: {
    [branchId: string]: number;          // จำนวนที่ลงแต่ละสาขา
  };
  
  status: 'available' | 'full' | 'cancelled';
}

export interface EventRegistration {
  id: string;
  eventId: string;
  eventName: string;                     // เก็บชื่อไว้เลย
  scheduleId: string;
  scheduleDate: Date;                    // เก็บวันที่ไว้เลย
  scheduleTime: string;                  // เก็บเวลาไว้เลย "09:00-12:00"
  branchId: string;                      // สาขาที่เลือก
  
  // Registration Info - รองรับทั้ง Guest และ Login
  isGuest: boolean;                      // flag ว่าเป็น Guest หรือไม่
  
  // ถ้า Login ด้วย LINE
  lineUserId?: string;
  lineDisplayName?: string;
  linePictureUrl?: string;
  
  // ถ้ามี Parent Account
  parentId?: string;
  
  // ข้อมูลที่กรอก (ทั้ง Guest และ Login)
  parentName: string;                    // ชื่อผู้ติดต่อหลัก
  parentPhone: string;
  parentEmail?: string;
  parentAddress?: string;
  
  // Parents - สำหรับกรณีนับผู้ปกครอง
  parents: {
    name: string;
    phone: string;
    email?: string;
    isMainContact: boolean;
  }[];
  
  // Students - สำหรับกรณีนับนักเรียน
  students: {
    studentId?: string;                  // ถ้ามีในระบบ
    name: string;
    nickname: string;
    birthdate: Date;
    schoolName?: string;
    gradeLevel?: string;
  }[];
  
  // Counting
  attendeeCount: number;                 // จำนวนที่นับ (ขึ้นอยู่กับ countingMethod)
  
  // Status & Tracking
  status: 'confirmed' | 'cancelled' | 'attended' | 'no-show';
  registeredAt: Date;
  registeredFrom: 'liff' | 'admin';      // ลงผ่าน LIFF หรือ Admin ลงให้
  
  // Cancellation
  cancelledAt?: Date;
  cancelledBy?: string;                  // userId ของคนที่ยกเลิก
  cancellationReason?: string;
  
  // Attendance
  attended?: boolean;
  attendanceCheckedAt?: Date;
  attendanceCheckedBy?: string;
  attendanceNote?: string;
  
  // Additional
  specialRequest?: string;               // ความต้องการพิเศษ
  referralSource?: string;               // รู้จักงานนี้จากที่ไหน
}
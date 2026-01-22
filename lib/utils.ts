import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date function
// Format date function
export function formatDate(date: any, format: 'short' | 'long' | 'full' | 'time' = 'short'): string {
  // Handle null/undefined
  if (!date) {
    return '-';
  }

  let d: Date;
  
  try {
    // Check if already a Date object
    if (date instanceof Date) {
      d = date;
    } 
    // Check if string or number
    else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } 
    // Check if Firestore Timestamp
    else if (date && typeof date === 'object') {
      // Firestore Timestamp has toDate() method
      if (date.toDate && typeof date.toDate === 'function') {
        d = date.toDate();
      } 
      // Firestore timestamp raw object has seconds property
      else if (date.seconds) {
        d = new Date(date.seconds * 1000);
      } 
      // Unknown object type
      else {
        console.warn('Unknown date object type:', date);
        return '-';
      }
    } 
    // Unknown type
    else {
      console.warn('Unknown date type:', typeof date, date);
      return '-';
    }
    
    // Check if valid date
    if (!d || isNaN(d.getTime())) {
      console.warn('Invalid date:', date);
      return '-';
    }

    // Format based on type
    if (format === 'time') {
      return new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    }

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: format === 'long' || format === 'full' ? 'long' : 'short',
      year: 'numeric',
    };

    // Add time for 'full' format
    if (format === 'full') {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return new Intl.DateTimeFormat('th-TH', options).format(d);
    
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', date);
    return '-';
  }
}

// Format date with day name (แยก function สำหรับกรณีที่ต้องการแสดงวัน)
export function formatDateWithDay(date: any): string {
  // Handle null/undefined
  if (!date) {
    return '-';
  }

  let d: Date;
  
  try {
    // Check if already a Date object
    if (date instanceof Date) {
      d = date;
    } 
    // Check if string or number
    else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } 
    // Check if Firestore Timestamp
    else if (date && typeof date === 'object') {
      // Firestore Timestamp has toDate() method
      if (date.toDate && typeof date.toDate === 'function') {
        d = date.toDate();
      } 
      // Firestore timestamp raw object has seconds property
      else if (date.seconds) {
        d = new Date(date.seconds * 1000);
      } 
      // Unknown object type
      else {
        console.warn('Unknown date object type in formatDateWithDay:', date);
        return '-';
      }
    } 
    // Unknown type
    else {
      console.warn('Unknown date type in formatDateWithDay:', typeof date, date);
      return '-';
    }
    
    // Check if valid date
    if (!d || isNaN(d.getTime())) {
      console.warn('Invalid date in formatDateWithDay:', date);
      return '-';
    }

    const dayName = getDayName(d.getDay());
    const dateStr = formatDate(d, 'long');
    
    return `${dayName}, ${dateStr}`;
    
  } catch (error) {
    console.error('Error formatting date with day:', error, 'Input:', date);
    return '-';
  }
}

// Format time (HH:mm)
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')} น.`;
}

// Get day name in Thai
export function getDayName(dayIndex: number): string {
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return days[dayIndex] || '';
}

// Get short day name in English (3 letters)
export function getShortDayNameEN(dayIndex: number): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[dayIndex] || '';
}

// Format date as DD/MM/YY (Buddhist year) e.g., "29/11/68"
export function formatDateCompact(date: any): string {
  if (!date) {
    return '-';
  }

  let d: Date;

  try {
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else if (date && typeof date === 'object') {
      if (date.toDate && typeof date.toDate === 'function') {
        d = date.toDate();
      } else if (date.seconds) {
        d = new Date(date.seconds * 1000);
      } else {
        return '-';
      }
    } else {
      return '-';
    }

    if (!d || isNaN(d.getTime())) {
      return '-';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear() + 543).slice(-2); // Buddhist year, last 2 digits

    return `${day}/${month}/${year}`;

  } catch (error) {
    console.error('Error formatting compact date:', error);
    return '-';
  }
}

// Format date with short English day (e.g., "SAT 25/10/68")
export function formatDateShort(date: any): string {
  if (!date) {
    return '-';
  }

  let d: Date;

  try {
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else if (date && typeof date === 'object') {
      if (date.toDate && typeof date.toDate === 'function') {
        d = date.toDate();
      } else if (date.seconds) {
        d = new Date(date.seconds * 1000);
      } else {
        return '-';
      }
    } else {
      return '-';
    }

    if (!d || isNaN(d.getTime())) {
      return '-';
    }

    const dayName = getShortDayNameEN(d.getDay());
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear() + 543).slice(-2); // Buddhist year, last 2 digits

    return `${dayName} ${day}/${month}/${year}`;

  } catch (error) {
    console.error('Error formatting short date:', error);
    return '-';
  }
}

// Get days of week display
export function getDaysOfWeekDisplay(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 7) return 'ทุกวัน';
  
  const sortedDays = [...days].sort((a, b) => a - b);
  const dayNames = sortedDays.map(day => getDayName(day));
  
  return dayNames.join(', ');
}

// Format phone number
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as XXX-XXX-XXXX
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

// Calculate age from birthdate
export function calculateAge(birthdate: Date): number {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Generate class code
export function generateClassCode(subjectCode: string, branchCode: string, date: Date): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${branchCode}-${subjectCode}-${year}${month}-${random}`;
}

// Check if date is in the past
export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate < today;
}

// Get date range display
export function getDateRangeDisplay(startDate: Date, endDate: Date): string {
  const start = formatDate(startDate, 'short');
  const end = formatDate(endDate, 'short');
  
  return `${start} - ${end}`;
}

// Get status color
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Class status
    'draft': 'bg-gray-100 text-gray-700',
    'published': 'bg-blue-100 text-blue-700',
    'started': 'bg-green-100 text-green-700',
    'completed': 'bg-gray-100 text-gray-700',
    'cancelled': 'bg-red-100 text-red-700',
    
    // Enrollment status
    'active': 'bg-green-100 text-green-700',
    'dropped': 'bg-red-100 text-red-700',
    'transferred': 'bg-yellow-100 text-yellow-700',
    
    // Payment status
    'pending': 'bg-yellow-100 text-yellow-700',
    'partial': 'bg-orange-100 text-orange-700',
    'paid': 'bg-green-100 text-green-700',
    
    // Trial status
    'confirmed': 'bg-blue-100 text-blue-700',
    'converted': 'bg-green-100 text-green-700',
  };
  
  return statusColors[status] || 'bg-gray-100 text-gray-700';
}

// Get status text
export function getStatusText(status: string): string {
  const statusTexts: Record<string, string> = {
    // Class status
    'draft': 'ร่าง',
    'published': 'เปิดรับสมัคร',
    'started': 'กำลังเรียน',
    'completed': 'จบแล้ว',
    'cancelled': 'ยกเลิก',
    
    // Enrollment status
    'active': 'กำลังเรียน',
    'dropped': 'ยกเลิก',
    'transferred': 'ย้ายคลาส',
    
    // Payment status
    'pending': 'รอชำระ',
    'partial': 'ชำระบางส่วน',
    'paid': 'ชำระแล้ว',
    
    // Trial status
    'confirmed': 'ยืนยันแล้ว',
    'converted': 'สมัครเรียน',
  };
  
  return statusTexts[status] || status;
}

// เพิ่ม function นี้ใน lib/utils.ts

export function convertGoogleDriveUrl(url: string): string {
  if (!url || !url.includes('drive.google.com')) {
    return url;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId = '';
  
  if (url.includes('/file/d/')) {
    // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match) fileId = match[1];
  } else if (url.includes('id=')) {
    // Format: https://drive.google.com/open?id=FILE_ID
    const match = url.match(/id=([a-zA-Z0-9-_]+)/);
    if (match) fileId = match[1];
  } else if (url.includes('/folders/')) {
    // This is a folder link, not an image
    console.warn('Google Drive folder links are not supported');
    return url;
  }
  
  if (fileId) {
    // Convert to direct image URL
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  
  return url;
}
// lib/calendar-link.ts
// เปิด "เพิ่มลงปฏิทิน" ให้ตรงกับเครื่องของผู้ใช้มากที่สุด
//
//   iOS/iPadOS/Mac → ไฟล์ .ics จาก API ของเรา (Safari เด้งหน้าเพิ่มลงปฏิทินของ
//                    แอป Calendar ให้เลย ได้เตือนล่วงหน้าติดไปด้วย)
//   ที่เหลือ        → ลิงก์ Google Calendar (แอนดรอยด์ส่วนใหญ่มีแอปนี้ กดแล้วเข้าแอปตรง)
//
// ทั้งสองทางต้องเปิดใน "เบราว์เซอร์ภายนอก" — webview ของ LINE ดาวน์โหลดไฟล์
// ไม่ทำงาน กดแล้วจะเงียบไปเฉย ๆ

import { googleCalendarUrl } from '@/lib/utils'

export function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
}

export function icsUrl(kind: 'vex-event' | 'vex-practice', id: string): string {
  return `${window.location.origin}/api/calendar/${kind}?id=${id}`
}

/** เปิดลิงก์ปฏิทิน — ในแอป LINE ต้องเด้งออกเบราว์เซอร์ภายนอก */
export function openCalendarUrl(liff: any, url: string) {
  if (liff?.isInClient?.()) liff.openWindow({ url, external: true })
  else window.open(url, '_blank')
}

/** รายการแข่งขัน (กิจกรรมทั้งวัน) */
export function openEventInCalendar(
  liff: any,
  event: {
    id: string
    name: string
    dateStart: string
    dateEnd?: string | null
    place?: string | null
    details?: string | null
  }
) {
  const url = isAppleDevice()
    ? icsUrl('vex-event', event.id)
    : googleCalendarUrl({
        title: `[VEX] ${event.name}`,
        startDate: event.dateStart,
        endDate: event.dateEnd,
        location: event.place,
        details: event.details,
      })
  openCalendarUrl(liff, url)
}

/** วันซ้อมที่อนุมัติแล้ว (มีเวลา) */
export function openPracticeInCalendar(
  liff: any,
  practice: {
    id: string
    date: string
    startTime?: string | null
    endTime?: string | null
    title: string
    note?: string | null
  }
) {
  const url = isAppleDevice()
    ? icsUrl('vex-practice', practice.id)
    : googleCalendarUrl({
        title: practice.title,
        startDate: practice.date,
        startTime: practice.startTime,
        endTime: practice.endTime,
        details: practice.note,
      })
  openCalendarUrl(liff, url)
}

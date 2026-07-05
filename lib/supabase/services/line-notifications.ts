// lib/supabase/services/line-notifications.ts

import { createServiceClient } from '../server'
import { formatDate, formatTime, getDayName } from '@/lib/utils'
import { getLineSettings } from './line-settings'
import { logNotification } from '@/lib/services/notification-logger'

// Helper to get base URL
function getBaseUrl(): string {
  // Check if we're on the server
  if (typeof window === 'undefined') {
    // Server-side: Priority order
    // 1. NEXT_PUBLIC_APP_URL (manual setting - highest priority)
    if (process.env.NEXT_PUBLIC_APP_URL) {
      const url = process.env.NEXT_PUBLIC_APP_URL
      console.log('[getBaseUrl] Using NEXT_PUBLIC_APP_URL:', url.substring(0, 30) + '...')
      return url
    }

    // 2. VERCEL_URL (automatic on Vercel - fallback)
    if (process.env.VERCEL_URL) {
      const url = `https://${process.env.VERCEL_URL}`
      console.log('[getBaseUrl] Using VERCEL_URL:', url.substring(0, 30) + '...')
      return url
    }

    // 3. Fallback for local development
    console.warn('[getBaseUrl] No URL configured, using localhost')
    return 'http://localhost:3000'
  }

  // Client-side: use window.location
  return window.location.origin
}

// ส่งข้อความผ่าน LINE API (รองรับทั้ง text และ flex)
export async function sendLineMessage(
  userId: string,
  message: string,
  accessToken?: string,
  options?: {
    useFlexMessage?: boolean
    flexTemplate?: string
    flexData?: any
    altText?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // ถ้าไม่ได้ส่ง token มา ให้ดึงจาก settings
    if (!accessToken) {
      const settings = await getLineSettings()
      accessToken = settings?.messagingChannelAccessToken
    }

    if (!accessToken) {
      console.log('[sendLineMessage] No access token found')
      return { success: false, error: 'ไม่พบ Channel Access Token' }
    }

    // ตรวจสอบว่าเปิดการแจ้งเตือนหรือไม่
    const settings = await getLineSettings()
    if (!settings?.enableNotifications) {
      console.log('[sendLineMessage] Notifications are disabled')
      return { success: false, error: 'การแจ้งเตือนถูกปิดอยู่' }
    }

    console.log(`[sendLineMessage] Sending to user: ${userId.substring(0, 10)}...`)

    // Get base URL for fetch
    const baseUrl = getBaseUrl()

    // ถ้าต้องการส่งแบบ Flex Message
    if (options?.useFlexMessage && options?.flexTemplate && options?.flexData) {
      console.log(`[sendLineMessage] Using flex template: ${options.flexTemplate}`)

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
      })

      const result = await response.json()
      console.log('[sendLineMessage] Flex message result:', result)
      return result
    }

    // ส่งแบบ text ปกติ
    console.log('[sendLineMessage] Using text message')

    const response = await fetch(`${baseUrl}/api/line/send-message-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        message,
        accessToken
      })
    })

    const result = await response.json()
    console.log('[sendLineMessage] Text message result:', result)
    return result
  } catch (error) {
    console.error('[sendLineMessage] Error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}

// 1. แจ้งเตือนก่อนเรียน (คลาสปกติ)
export async function sendClassReminder(
  studentId: string,
  classId: string,
  scheduleDate: Date,
  scheduleId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    console.log(`\n[sendClassReminder] Starting for student: ${studentId}, class: ${classId}`)
    console.log(`[sendClassReminder] Schedule date: ${scheduleDate.toISOString()}`)

    // Get student and parent info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id, name, nickname, parent_id,
        parents (id, line_user_id)
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      console.log('[sendClassReminder] Student not found')
      return false
    }

    const parent = student.parents as any
    if (!parent?.line_user_id) {
      console.log('[sendClassReminder] Parent not found or no LINE ID')
      return false
    }

    console.log(`[sendClassReminder] Parent LINE ID: ${parent.line_user_id?.substring(0, 10)}...`)

    // Get class data with related info
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select(`
        id, name, start_time, end_time, branch_id, room_id, teacher_id, subject_id,
        subjects (id, name),
        teachers (id, name, nickname),
        branches (id, name),
        rooms (id, name)
      `)
      .eq('id', classId)
      .single()

    if (classError || !classData) {
      console.log('[sendClassReminder] Class not found')
      return false
    }

    console.log(`[sendClassReminder] Class: ${classData.name}`)

    // Get session number from schedule if available
    let sessionNumber: number | undefined
    if (scheduleId) {
      const { data: schedule } = await supabase
        .from('class_schedules')
        .select('session_number')
        .eq('id', scheduleId)
        .single()

      if (schedule) {
        sessionNumber = schedule.session_number
        console.log(`[sendClassReminder] Found session number: ${sessionNumber}`)
      }
    }

    const subject = classData.subjects as any
    const teacher = classData.teachers as any
    const branch = classData.branches as any
    const room = classData.rooms as any

    console.log('[sendClassReminder] All data collected, preparing to send...')

    // ส่งข้อความแบบ Flex Message
    const result = await sendLineMessage(parent.line_user_id, '', undefined, {
      useFlexMessage: true,
      flexTemplate: 'classReminder',
      flexData: {
        studentName: student.nickname || student.name,
        className: classData.name,
        subjectName: subject?.name || classData.name,
        sessionNumber,
        date: formatDate(scheduleDate, 'long'),
        startTime: formatTime(classData.start_time),
        endTime: formatTime(classData.end_time),
        teacherName: `ครู${teacher?.nickname || teacher?.name || 'ไม่ระบุ'}`,
        location: branch?.name || '',
        roomName: room?.name || classData.room_id
      },
      altText: `แจ้งเตือนคลาสเรียนพรุ่งนี้ - น้อง${student.nickname || student.name}`
    })

    if (result.success) {
      console.log(`[sendClassReminder] Successfully sent reminder for student ${studentId}`)
    } else {
      console.log(`[sendClassReminder] Failed to send reminder: ${result.error}`)
    }

    // Build detailed message preview
    const studentName = student.nickname || student.name
    const sessionText = sessionNumber ? ` (ครั้งที่ ${sessionNumber})` : ''
    const messagePreview = [
      `🔔 แจ้งเตือนคลาสเรียนพรุ่งนี้`,
      `👦 นักเรียน: ${studentName}`,
      `📚 วิชา: ${subject?.name || classData.name}${sessionText}`,
      `📅 วันที่: ${formatDate(scheduleDate, 'long')}`,
      `⏰ เวลา: ${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`,
      `👩‍🏫 ครูผู้สอน: ครู${teacher?.nickname || teacher?.name || 'ไม่ระบุ'}`,
      `📍 สถานที่: ${branch?.name || '-'}`,
      `🚪 ห้อง: ${room?.name || classData.room_id || '-'}`
    ].join('\n')

    // Log notification
    await logNotification({
      type: 'class-reminder',
      recipientType: 'parent',
      recipientId: parent.id,
      recipientName: `${studentName}'s parent`,
      lineUserId: parent.line_user_id,
      studentId: student.id,
      studentName: studentName,
      classId: classData.id,
      className: classData.name,
      scheduleId: scheduleId,
      messagePreview: messagePreview,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendClassReminder] Error:', error)
    return false
  }
}

// Row shape returned by the get_class_reminders(p_date) RPC.
export interface ClassReminderRow {
  schedule_id: string
  session_date: string
  session_number: number | null
  class_id: string
  class_name: string
  start_time: string | null
  end_time: string | null
  subject_name: string | null
  teacher_name: string | null
  teacher_nickname: string | null
  branch_name: string | null
  room_name: string | null
  student_id: string
  student_name: string
  student_nickname: string | null
  parent_id: string
  line_user_id: string
}

// 1b. แจ้งเตือนก่อนเรียน — fed by the get_class_reminders RPC.
// The RPC has already done all the joins + filtering (pause / leave / makeup), so this
// does NO extra queries: it just formats the LINE message, sends it, and logs.
export async function sendClassReminderFromRow(row: ClassReminderRow): Promise<boolean> {
  try {
    const studentName = row.student_nickname || row.student_name
    const teacherLabel = `ครู${row.teacher_nickname || row.teacher_name || 'ไม่ระบุ'}`
    const scheduleDate = new Date(row.session_date)
    const sessionNumber = row.session_number ?? undefined

    const result = await sendLineMessage(row.line_user_id, '', undefined, {
      useFlexMessage: true,
      flexTemplate: 'classReminder',
      flexData: {
        studentName,
        className: row.class_name,
        subjectName: row.subject_name || row.class_name,
        sessionNumber,
        date: formatDate(scheduleDate, 'long'),
        startTime: formatTime(row.start_time || ''),
        endTime: formatTime(row.end_time || ''),
        teacherName: teacherLabel,
        location: row.branch_name || '',
        roomName: row.room_name || ''
      },
      altText: `แจ้งเตือนคลาสเรียนพรุ่งนี้ - น้อง${studentName}`
    })

    const sessionText = sessionNumber ? ` (ครั้งที่ ${sessionNumber})` : ''
    const messagePreview = [
      `🔔 แจ้งเตือนคลาสเรียนพรุ่งนี้`,
      `👦 นักเรียน: ${studentName}`,
      `📚 วิชา: ${row.subject_name || row.class_name}${sessionText}`,
      `📅 วันที่: ${formatDate(scheduleDate, 'long')}`,
      `⏰ เวลา: ${formatTime(row.start_time || '')} - ${formatTime(row.end_time || '')}`,
      `👩‍🏫 ครูผู้สอน: ${teacherLabel}`,
      `📍 สถานที่: ${row.branch_name || '-'}`,
      `🚪 ห้อง: ${row.room_name || '-'}`
    ].join('\n')

    await logNotification({
      type: 'class-reminder',
      recipientType: 'parent',
      recipientId: row.parent_id,
      recipientName: `${studentName}'s parent`,
      lineUserId: row.line_user_id,
      studentId: row.student_id,
      studentName,
      classId: row.class_id,
      className: row.class_name,
      scheduleId: row.schedule_id,
      messagePreview,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendClassReminderFromRow] Error:', error)
    return false
  }
}

// 2. แจ้งเตือน Makeup Class
export async function sendMakeupNotification(
  makeupId: string,
  type: 'scheduled' | 'reminder'
): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    console.log(`\n[sendMakeupNotification] Starting for makeup: ${makeupId}, type: ${type}`)

    // Get makeup class data
    const { data: makeup, error: makeupError } = await supabase
      .from('makeup_classes')
      .select(`
        *,
        students (id, name, nickname, parent_id),
        classes (id, name, subject_id)
      `)
      .eq('id', makeupId)
      .single()

    if (makeupError || !makeup) {
      console.log('[sendMakeupNotification] Makeup not found')
      return false
    }

    if (!makeup.makeup_date || !makeup.makeup_start_time) {
      console.log('[sendMakeupNotification] No makeup schedule')
      return false
    }

    const student = makeup.students as any
    const classData = makeup.classes as any

    // Get parent
    const { data: parent } = await supabase
      .from('parents')
      .select('id, line_user_id')
      .eq('id', student?.parent_id)
      .single()

    if (!parent?.line_user_id) {
      console.log('[sendMakeupNotification] Parent not found or no LINE ID')
      return false
    }

    console.log(`[sendMakeupNotification] Parent LINE ID: ${parent.line_user_id?.substring(0, 10)}...`)

    // Get teacher, branch, room, subject info
    const [teacherResult, branchResult, roomResult, subjectResult] = await Promise.all([
      supabase.from('teachers').select('id, name, nickname').eq('id', makeup.makeup_teacher_id).single(),
      supabase.from('branches').select('id, name').eq('id', makeup.makeup_branch_id).single(),
      supabase.from('rooms').select('id, name').eq('id', makeup.makeup_room_id).single(),
      classData?.subject_id
        ? supabase.from('subjects').select('id, name').eq('id', classData.subject_id).single()
        : Promise.resolve({ data: null })
    ])

    const teacher = teacherResult.data
    const branch = branchResult.data
    const room = roomResult.data
    const subjectName = subjectResult.data?.name || classData?.name || 'Makeup Class'

    const makeupDate = new Date(makeup.makeup_date)

    console.log('[sendMakeupNotification] All data collected, preparing to send...')

    // ส่งข้อความแบบ Flex Message
    const result = await sendLineMessage(parent.line_user_id, '', undefined, {
      useFlexMessage: true,
      flexTemplate: type === 'reminder' ? 'makeupReminder' : 'makeupConfirmation',
      flexData: {
        studentName: student?.nickname || student?.name,
        className: classData?.name || 'Makeup Class',
        subjectName,
        sessionNumber: makeup.original_session_number,
        date: formatDate(makeupDate, 'long'),
        startTime: formatTime(makeup.makeup_start_time),
        endTime: formatTime(makeup.makeup_end_time),
        teacherName: `ครู${teacher?.nickname || teacher?.name || 'ไม่ระบุ'}`,
        location: branch?.name || '',
        roomName: room?.name || makeup.makeup_room_id
      },
      altText:
        type === 'reminder'
          ? `แจ้งเตือน Makeup Class พรุ่งนี้ - น้อง${student?.nickname || student?.name}`
          : `ยืนยันการนัด Makeup Class - น้อง${student?.nickname || student?.name}`
    })

    if (result.success) {
      console.log(`[sendMakeupNotification] Successfully sent makeup ${type}`)
    } else {
      console.error(`[sendMakeupNotification] Failed to send makeup ${type}:`, result.error)
    }

    // Build detailed message preview
    const studentName = student?.nickname || student?.name
    const sessionText = makeup.original_session_number ? ` (ครั้งที่ ${makeup.original_session_number})` : ''
    const headerText = type === 'reminder' ? '⏰ แจ้งเตือน Makeup Class พรุ่งนี้' : '✅ ยืนยันการนัด Makeup Class'
    const messagePreview = [
      headerText,
      `👦 นักเรียน: ${studentName}`,
      `📚 วิชา: ${subjectName}${sessionText}`,
      `📅 วันที่: ${formatDate(makeupDate, 'long')}`,
      `⏰ เวลา: ${formatTime(makeup.makeup_start_time)} - ${formatTime(makeup.makeup_end_time)}`,
      `👩‍🏫 ครูผู้สอน: ครู${teacher?.nickname || teacher?.name || 'ไม่ระบุ'}`,
      `📍 สถานที่: ${branch?.name || '-'}`,
      `🚪 ห้อง: ${room?.name || makeup.makeup_room_id || '-'}`
    ].join('\n')

    // Log notification
    await logNotification({
      type: type === 'reminder' ? 'makeup-reminder' : 'makeup-scheduled',
      recipientType: 'parent',
      recipientId: parent.id,
      recipientName: `${studentName}'s parent`,
      lineUserId: parent.line_user_id,
      studentId: student?.id,
      studentName: studentName,
      classId: classData?.id,
      className: classData?.name,
      makeupId: makeupId,
      messagePreview: messagePreview,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendMakeupNotification] Error:', error)
    return false
  }
}

// 3. ยืนยันการจองทดลองเรียน
export async function sendTrialConfirmation(
  trialSessionId: string,
  type: 'confirmation' | 'reminder' = 'confirmation'
): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    console.log(`\n[sendTrialConfirmation] Starting for trial: ${trialSessionId}, type: ${type}`)

    // Get trial session data
    const { data: trial, error: trialError } = await supabase
      .from('trial_sessions')
      .select(`
        *,
        trial_bookings (id, parent_line_id),
        subjects (id, name),
        branches (id, name, phone),
        rooms (id, name)
      `)
      .eq('id', trialSessionId)
      .single()

    if (trialError || !trial) {
      console.log('[sendTrialConfirmation] Trial not found')
      return false
    }

    const booking = trial.trial_bookings as any
    if (!booking?.parent_line_id) {
      console.log('[sendTrialConfirmation] No LINE ID in booking')
      return false
    }

    console.log(`[sendTrialConfirmation] Booking LINE ID: ${booking.parent_line_id.substring(0, 10)}...`)

    const subject = trial.subjects as any
    const branch = trial.branches as any
    const room = trial.rooms as any

    console.log('[sendTrialConfirmation] All data collected, preparing to send...')

    // ส่งข้อความแบบ Flex Message
    const result = await sendLineMessage(booking.parent_line_id, '', undefined, {
      useFlexMessage: true,
      flexTemplate: type === 'reminder' ? 'trialReminder' : 'trialConfirmation',
      flexData: {
        studentName: trial.student_name,
        subjectName: subject?.name || 'ไม่ระบุ',
        date: formatDate(new Date(trial.scheduled_date), 'long'),
        startTime: formatTime(trial.start_time),
        endTime: formatTime(trial.end_time),
        location: branch?.name || 'ไม่ระบุ',
        roomName: room?.name || trial.room_name || 'ไม่ระบุ',
        contactPhone: branch?.phone || '081-234-5678'
      },
      altText:
        type === 'reminder'
          ? `แจ้งเตือนทดลองเรียนพรุ่งนี้ - น้อง${trial.student_name}`
          : `ยืนยันการทดลองเรียน - น้อง${trial.student_name}`
    })

    if (result.success) {
      console.log('[sendTrialConfirmation] Successfully sent trial confirmation')
    } else {
      console.log('[sendTrialConfirmation] Failed to send trial confirmation:', result.error)
    }

    // Build detailed message preview
    const headerText = type === 'reminder' ? '⏰ แจ้งเตือนทดลองเรียนพรุ่งนี้' : '✅ ยืนยันการทดลองเรียน'
    const messagePreview = [
      headerText,
      `👦 นักเรียน: ${trial.student_name}`,
      `📚 วิชา: ${subject?.name || 'ไม่ระบุ'}`,
      `📅 วันที่: ${formatDate(new Date(trial.scheduled_date), 'long')}`,
      `⏰ เวลา: ${formatTime(trial.start_time)} - ${formatTime(trial.end_time)}`,
      `📍 สถานที่: ${branch?.name || 'ไม่ระบุ'}`,
      `🚪 ห้อง: ${room?.name || trial.room_name || 'ไม่ระบุ'}`,
      `📞 ติดต่อ: ${branch?.phone || '081-234-5678'}`
    ].join('\n')

    // Log notification
    await logNotification({
      type: type === 'reminder' ? 'trial-reminder' : 'trial-confirmation',
      recipientType: 'parent',
      recipientId: booking.id,
      recipientName: `${trial.student_name}'s parent`,
      lineUserId: booking.parent_line_id,
      studentName: trial.student_name,
      messagePreview: messagePreview,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendTrialConfirmation] Error:', error)
    return false
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
    console.log(`\n[sendFeedbackNotification] Sending to parent: ${parentLineId.substring(0, 10)}...`)

    const message =
      `📝 Teacher Feedback\n\n` +
      `นักเรียน: ${studentName}\n` +
      `คลาส: ${className}\n` +
      `จากครู: ${teacherName}\n\n` +
      `"${feedback}"\n\n` +
      `ดูทั้งหมดได้ที่เมนู Teacher Feedback`

    const result = await sendLineMessage(parentLineId, message)

    if (result.success) {
      console.log('[sendFeedbackNotification] Successfully sent feedback notification')
    } else {
      console.log('[sendFeedbackNotification] Failed to send feedback notification:', result.error)
    }

    // Log notification
    await logNotification({
      type: 'feedback',
      recipientType: 'parent',
      recipientName: `${studentName}'s parent`,
      lineUserId: parentLineId,
      studentName: studentName,
      className: className,
      messagePreview: message,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendFeedbackNotification] Error:', error)
    return false
  }
}

// แจ้งเตือนการเปลี่ยนแปลงตารางเรียน
export async function sendScheduleChangeNotification(
  parentLineId: string,
  studentName: string,
  className: string,
  changeType: 'cancelled' | 'rescheduled',
  originalDate: Date,
  newDate?: Date
): Promise<boolean> {
  try {
    console.log(`\n[sendScheduleChangeNotification] Sending to parent...`)

    let message = ''
    if (changeType === 'cancelled') {
      message =
        `⚠️ แจ้งยกเลิกคลาสเรียน\n\n` +
        `นักเรียน: ${studentName}\n` +
        `คลาส: ${className}\n` +
        `วันที่ยกเลิก: ${formatDate(originalDate, 'long')}\n\n` +
        `กรุณาติดต่อสถาบันเพื่อนัดเรียนชดเชย`
    } else {
      message =
        `📅 แจ้งเลื่อนคลาสเรียน\n\n` +
        `นักเรียน: ${studentName}\n` +
        `คลาส: ${className}\n` +
        `วันเดิม: ${formatDate(originalDate, 'long')}\n` +
        `วันใหม่: ${newDate ? formatDate(newDate, 'long') : 'รอกำหนด'}`
    }

    const result = await sendLineMessage(parentLineId, message)

    if (result.success) {
      console.log('[sendScheduleChangeNotification] Successfully sent notification')
    } else {
      console.log('[sendScheduleChangeNotification] Failed to send notification:', result.error)
    }

    // Log notification
    await logNotification({
      type: 'schedule-change',
      recipientType: 'parent',
      recipientName: `${studentName}'s parent`,
      lineUserId: parentLineId,
      studentName: studentName,
      className: className,
      messagePreview: message,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendScheduleChangeNotification] Error:', error)
    return false
  }
}

// แจ้งเตือนการชำระเงิน
export async function sendPaymentReminder(
  parentLineId: string,
  studentName: string,
  className: string,
  amount: number,
  dueDate: Date
): Promise<boolean> {
  try {
    console.log(`\n[sendPaymentReminder] Sending to parent...`)

    const message =
      `💰 แจ้งเตือนการชำระเงิน\n\n` +
      `นักเรียน: ${studentName}\n` +
      `คลาส: ${className}\n` +
      `จำนวนเงิน: ${amount.toLocaleString()} บาท\n` +
      `กำหนดชำระ: ${formatDate(dueDate, 'long')}\n\n` +
      `กรุณาชำระเงินภายในวันที่กำหนด`

    const result = await sendLineMessage(parentLineId, message)

    if (result.success) {
      console.log('[sendPaymentReminder] Successfully sent payment reminder')
    } else {
      console.log('[sendPaymentReminder] Failed to send payment reminder:', result.error)
    }

    // Log notification
    await logNotification({
      type: 'payment-reminder',
      recipientType: 'parent',
      recipientName: `${studentName}'s parent`,
      lineUserId: parentLineId,
      studentName: studentName,
      className: className,
      messagePreview: message,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error,
      sentAt: new Date()
    })

    return result.success
  } catch (error) {
    console.error('[sendPaymentReminder] Error:', error)
    return false
  }
}

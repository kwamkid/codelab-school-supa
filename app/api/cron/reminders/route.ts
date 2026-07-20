// app/api/cron/reminders/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendClassReminderFromRow, sendMakeupNotification, sendTrialConfirmation, sendPaymentReminder, type ClassReminderRow } from '@/lib/supabase/services/line-notifications'
import { getEventsForReminder, sendEventReminder } from '@/lib/supabase/services/events'

export const dynamic = 'force-dynamic'

// Verify secret key
function verifySecret(request: NextRequest): boolean {
  const querySecret = request.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in environment variables!')
    return false
  }

  if (!querySecret) {
    console.error('[Cron] No secret parameter provided')
    return false
  }

  const isValid = querySecret === cronSecret

  if (!isValid) {
    console.error('[Cron] Invalid secret provided')
  } else {
    console.log('[Cron] ✓ Authorization successful')
  }

  return isValid
}

export async function GET(request: NextRequest) {
  console.log('\n=== Starting combined reminder cron job ===')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Thailand Time:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))

  // Verify request
  if (!verifySecret(request)) {
    console.error('[Cron] ❌ Unauthorized request blocked')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

    let totalSent = 0
    const results = {
      classReminders: 0,
      makeupReminders: 0,
      trialReminders: 0,
      eventReminders: 0,
      paymentReminders: 0,
      errors: [] as string[]
    }

    console.log('Current time:', now.toLocaleString('th-TH'))
    console.log('Checking for tomorrow:', tomorrow.toLocaleDateString('th-TH'))

    // ============================================
    // 1. Class Reminders
    // ============================================
    console.log('\n--- Part 1: Class Reminders ---')

    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // One RPC call resolves everything: which (student × session) should be reminded
    // tomorrow, with all message data joined in. It filters out paused classes, students
    // on leave, and students with a makeup/absent for that exact session — in SQL.
    // get_class_reminders is not in the generated Database types → cast (see CLAUDE.md).
    const { data: reminderRows, error: reminderError } = await (supabase as any)
      .rpc('get_class_reminders', { p_date: tomorrowStr })

    if (reminderError) {
      console.error('Error fetching class reminders:', reminderError)
      results.errors.push(`Class reminder RPC error: ${reminderError.message}`)
    }

    const rows = (reminderRows as ClassReminderRow[] | null) || []
    console.log(`Found ${rows.length} class reminders to send for tomorrow`)

    for (const row of rows) {
      try {
        const success = await sendClassReminderFromRow(row)
        if (success) {
          results.classReminders++
          totalSent++
          console.log(`  ✓ Sent reminder for student ${row.student_id} (${row.class_name})`)
        } else {
          console.log(`  ✗ Failed to send for student ${row.student_id}`)
        }
      } catch (error) {
        console.error(`  ! Error for student ${row.student_id}:`, error)
        results.errors.push(`Class reminder error: ${error}`)
      }
    }

    // ============================================
    // 2. Makeup Class Reminders
    // ============================================
    console.log('\n--- Part 2: Makeup Class Reminders ---')

    const { data: makeups } = await supabase
      .from('makeup_classes')
      .select('id, student_id')
      .eq('status', 'scheduled')
      .gte('makeup_date', tomorrow.toISOString().split('T')[0])
      .lt('makeup_date', dayAfterTomorrow.toISOString().split('T')[0])

    console.log(`Found ${makeups?.length || 0} makeup classes for tomorrow`)

    for (const makeup of makeups || []) {
      try {
        console.log(`\nProcessing makeup for student ${makeup.student_id}`)

        const success = await sendMakeupNotification(makeup.id, 'reminder')
        if (success) {
          results.makeupReminders++
          totalSent++
          console.log('  ✓ Sent makeup reminder')
        } else {
          console.log('  ✗ Failed to send makeup reminder')
        }
      } catch (error) {
        console.error('  ! Makeup reminder error:', error)
        results.errors.push(`Makeup reminder error: ${error}`)
      }
    }

    // ============================================
    // 3. Trial Reminders (ทดลองเรียน)
    // ============================================
    console.log('\n--- Part 3: Trial Reminders ---')

    const { data: trials } = await supabase
      .from('trial_sessions')
      .select('id, student_name')
      .eq('status', 'scheduled')
      .gte('scheduled_date', tomorrow.toISOString().split('T')[0])
      .lt('scheduled_date', dayAfterTomorrow.toISOString().split('T')[0])

    console.log(`Found ${trials?.length || 0} trial sessions for tomorrow`)

    for (const trial of trials || []) {
      try {
        console.log(`\nProcessing trial for ${trial.student_name}`)

        const success = await sendTrialConfirmation(trial.id, 'reminder')
        if (success) {
          results.trialReminders++
          totalSent++
          console.log('  ✓ Sent trial reminder')
        } else {
          console.log('  ✗ Failed to send trial reminder')
        }
      } catch (error) {
        console.error('  ! Trial reminder error:', error)
        results.errors.push(`Trial reminder error: ${error}`)
      }
    }

    // ============================================
    // 4. Event Reminders
    // ============================================
    console.log('\n--- Part 4: Event Reminders ---')

    // Get events that need reminders
    const eventsToRemind = await getEventsForReminder()
    console.log(`Found ${eventsToRemind.length} events with reminders to send`)

    // Process each event
    for (const { event, registrations } of eventsToRemind) {
      console.log(`\nProcessing event: ${event.name}`)
      console.log(`Found ${registrations.length} registrations to remind`)

      // Send reminder to each registration
      for (const registration of registrations) {
        try {
          const success = await sendEventReminder(registration, event)

          if (success) {
            results.eventReminders++
            totalSent++
            console.log(`  ✓ Sent reminder for registration ${registration.id}`)
          } else {
            console.log(`  ✗ Failed to send reminder for registration ${registration.id}`)
          }
        } catch (error) {
          console.error(`  ! Error sending reminder for registration ${registration.id}:`, error)
          results.errors.push(`Event reminder error: ${error}`)
        }
      }
    }

    // ============================================
    // 5. Payment Reminders (ทวงค่าเรียน) — สัปดาห์ละครั้ง เฉพาะวันจันทร์ (เวลาไทย)
    // ============================================
    console.log('\n--- Part 5: Payment Reminders (weekly, Monday) ---')

    const bkkWeekday = now.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' })
    if (bkkWeekday !== 'Mon') {
      console.log(`Not Monday in Bangkok (${bkkWeekday}) — skip payment reminders`)
    } else {
      // enrollment ที่ยังเรียนอยู่ + ค้างชำระ ของคลาสที่ยังไม่จบ
      const { data: unpaid, error: unpaidError } = await supabase
        .from('enrollments')
        .select(`
          id, final_price, paid_amount, payment_status,
          students (id, name, nickname, parents (id, line_user_id)),
          classes (id, name, status, subjects (name))
        `)
        .eq('status', 'active')
        .in('payment_status', ['pending', 'partial'])

      if (unpaidError) {
        console.error('Error fetching unpaid enrollments:', unpaidError)
        results.errors.push(`Payment reminder query error: ${unpaidError.message}`)
      }

      // กันส่งซ้ำ: ข้ามถ้าเพิ่งทวง enrollment นี้ไปใน 6 วันที่ผ่านมา
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()

      console.log(`Found ${unpaid?.length || 0} unpaid active enrollments`)

      for (const enr of (unpaid || []) as any[]) {
        try {
          const cls = enr.classes
          const student = enr.students
          const parent = student?.parents
          if (!cls || !['published', 'started'].includes(cls.status)) continue
          if (!parent?.line_user_id) continue

          const outstanding = Number(enr.final_price || 0) - Number(enr.paid_amount || 0)
          if (outstanding <= 0) continue

          const { count } = await supabase
            .from('notification_logs')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'payment-reminder')
            .eq('student_id', student.id)
            .eq('class_id', cls.id)
            .gte('created_at', sixDaysAgo)
          if ((count || 0) > 0) {
            console.log(`  - Skip (already reminded this week): ${student.nickname || student.name}`)
            continue
          }

          // ผู้ปกครองไม่ควรเห็นรหัสคลาส → ใช้ชื่อวิชา
          const displayName = (cls.subjects as any)?.name || cls.name
          const success = await sendPaymentReminder(
            parent.line_user_id,
            student.nickname || student.name,
            displayName,
            outstanding,
            undefined,
            { studentId: student.id, classId: cls.id }
          )
          if (success) {
            results.paymentReminders++
            totalSent++
            console.log(`  ✓ Sent payment reminder: ${student.nickname || student.name} ค้าง ${outstanding}`)
          } else {
            console.log(`  ✗ Failed payment reminder for student ${student.id}`)
          }
        } catch (error) {
          console.error('  ! Payment reminder error:', error)
          results.errors.push(`Payment reminder error: ${error}`)
        }
      }
    }

    // ============================================
    // Summary
    // ============================================
    console.log('\n=== Combined reminder cron job completed ===')
    console.log('Summary:', {
      totalSent,
      classReminders: results.classReminders,
      makeupReminders: results.makeupReminders,
      trialReminders: results.trialReminders,
      eventReminders: results.eventReminders,
      paymentReminders: results.paymentReminders,
      errors: results.errors.length
    })

    return NextResponse.json({
      success: true,
      message: `ส่งการแจ้งเตือนทั้งหมด ${totalSent} รายการ`,
      sentCount: totalSent,
      details: results,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('!!! Combined reminder cron job error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

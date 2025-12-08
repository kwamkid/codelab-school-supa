// app/api/cron/reminders/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendClassReminder, sendMakeupNotification } from '@/lib/supabase/services/line-notifications'
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
      eventReminders: 0,
      errors: [] as string[]
    }

    console.log('Current time:', now.toLocaleString('th-TH'))
    console.log('Checking for tomorrow:', tomorrow.toLocaleDateString('th-TH'))

    // ============================================
    // 1. Class Reminders
    // ============================================
    console.log('\n--- Part 1: Class Reminders ---')

    // Get active classes
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('status', 'started')

    if (classesError) {
      console.error('Error fetching classes:', classesError)
    }

    console.log(`Found ${classes?.length || 0} active classes`)

    for (const cls of classes || []) {
      // Get schedules for tomorrow
      const { data: schedules } = await supabase
        .from('class_schedules')
        .select('id, session_date, session_number')
        .eq('class_id', cls.id)
        .eq('status', 'scheduled')
        .gte('session_date', tomorrow.toISOString().split('T')[0])
        .lt('session_date', dayAfterTomorrow.toISOString().split('T')[0])

      if (schedules && schedules.length > 0) {
        console.log(`\nClass "${cls.name}": Found ${schedules.length} sessions tomorrow`)

        // Get active enrollments
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', cls.id)
          .eq('status', 'active')

        console.log(`  - ${enrollments?.length || 0} active students`)

        // Process each schedule
        for (const schedule of schedules) {
          console.log(`\n  Processing schedule ${schedule.id} (Session #${schedule.session_number})`)

          // Send reminder to each student
          for (const enrollment of enrollments || []) {
            try {
              const success = await sendClassReminder(
                enrollment.student_id,
                cls.id,
                new Date(schedule.session_date),
                schedule.id
              )

              if (success) {
                results.classReminders++
                totalSent++
                console.log(`    ✓ Sent reminder for student ${enrollment.student_id}`)
              } else {
                console.log(`    ✗ Failed to send for student ${enrollment.student_id}`)
              }
            } catch (error) {
              console.error(`    ! Error for student ${enrollment.student_id}:`, error)
              results.errors.push(`Class reminder error: ${error}`)
            }
          }
        }
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
    // 3. Event Reminders
    // ============================================
    console.log('\n--- Part 3: Event Reminders ---')

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
    // Summary
    // ============================================
    console.log('\n=== Combined reminder cron job completed ===')
    console.log('Summary:', {
      totalSent,
      classReminders: results.classReminders,
      makeupReminders: results.makeupReminders,
      eventReminders: results.eventReminders,
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

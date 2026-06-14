// app/api/cron/update-class-status/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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
  console.log('\n=== Starting class status update cron job ===')
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
    const todayStr = now.toISOString().split('T')[0]

    const results = {
      classesChecked: 0,
      classesCompleted: 0,
      classesStarted: 0,
      eventsChecked: 0,
      eventsCompleted: 0,
      errors: [] as string[]
    }

    console.log('Current time:', now.toLocaleString('th-TH'))

    // 1. Update classes that should be marked as 'completed'
    console.log('\n--- Checking for completed classes ---')

    const { data: activeClasses, error: classesError } = await supabase
      .from('classes')
      .select('id, name, status, start_date, end_date')
      .in('status', ['started', 'published'])

    if (classesError) {
      console.error('Error fetching classes:', classesError)
      throw classesError
    }

    console.log(`Found ${activeClasses?.length || 0} active/published classes`)

    for (const cls of activeClasses || []) {
      try {
        results.classesChecked++

        // Check if endDate has passed
        if (!cls.end_date) {
          console.log(`Class ${cls.id} has no endDate`)
          continue
        }

        const endDate = new Date(cls.end_date)
        endDate.setHours(23, 59, 59, 999) // End of day

        if (endDate < now) {
          // Class has ended - check if all sessions are completed
          console.log(`Class "${cls.name}" (${cls.id}) end date has passed`)

          // Get all future schedules for this class
          const { data: futureSchedules } = await supabase
            .from('class_schedules')
            .select('id, session_date')
            .eq('class_id', cls.id)
            .neq('status', 'cancelled')
            .gt('session_date', todayStr)

          const hasFutureSessions = (futureSchedules?.length || 0) > 0

          if (!hasFutureSessions) {
            console.log(`  ✓ Marking class as completed`)

            const { error: updateError } = await supabase
              .from('classes')
              .update({
                status: 'completed'
              })
              .eq('id', cls.id)

            if (updateError) {
              console.error(`  ✗ Error updating class:`, updateError)
              results.errors.push(`Class ${cls.id}: ${updateError.message}`)
            } else {
              results.classesCompleted++
            }
          } else {
            console.log(`  - Class still has future sessions`)
          }
        }

        // 2. Update classes that should be marked as 'started'
        if (cls.status === 'published') {
          const startDate = new Date(cls.start_date)
          if (startDate <= now) {
            console.log(`Class "${cls.name}" (${cls.id}) should be started`)

            const { error: updateError } = await supabase
              .from('classes')
              .update({
                status: 'started'
              })
              .eq('id', cls.id)

            if (updateError) {
              console.error(`  ✗ Error updating class:`, updateError)
              results.errors.push(`Class ${cls.id}: ${updateError.message}`)
            } else {
              results.classesStarted++
            }
          }
        }
      } catch (error) {
        console.error(`Error processing class ${cls.id}:`, error)
        results.errors.push(`Class ${cls.id}: ${error}`)
      }
    }

    // 3. Mark published events as 'completed' once their LAST schedule day has passed.
    console.log('\n--- Checking for completed events ---')

    // `events`/`event_schedules` aren't in the generated Database types → cast to any.
    const { data: publishedEvents, error: eventsError } = await (supabase as any)
      .from('events')
      .select('id, name, status')
      .eq('status', 'published')

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      throw eventsError
    }

    console.log(`Found ${publishedEvents?.length || 0} published events`)

    for (const ev of (publishedEvents || []) as any[]) {
      try {
        results.eventsChecked++

        // The event's last day = max schedule date. If there's no schedule, skip.
        const { data: schedules } = await (supabase as any)
          .from('event_schedules')
          .select('date')
          .eq('event_id', ev.id)
          .order('date', { ascending: false })
          .limit(1)

        const lastDateStr = schedules?.[0]?.date
        if (!lastDateStr) {
          console.log(`Event "${ev.name}" (${ev.id}) has no schedules — skip`)
          continue
        }

        const lastDay = new Date(lastDateStr)
        lastDay.setHours(23, 59, 59, 999) // end of the last event day

        if (lastDay < now) {
          console.log(`  ✓ Event "${ev.name}" past last day (${lastDateStr}) → completed`)
          const { error: updateError } = await (supabase as any)
            .from('events')
            .update({ status: 'completed' })
            .eq('id', ev.id)

          if (updateError) {
            console.error(`  ✗ Error updating event:`, updateError)
            results.errors.push(`Event ${ev.id}: ${updateError.message}`)
          } else {
            results.eventsCompleted++
          }
        }
      } catch (error) {
        console.error(`Error processing event ${ev.id}:`, error)
        results.errors.push(`Event ${ev.id}: ${error}`)
      }
    }

    console.log('\n=== Class & event status update completed ===')
    console.log('Summary:', {
      classesChecked: results.classesChecked,
      classesCompleted: results.classesCompleted,
      classesStarted: results.classesStarted,
      eventsChecked: results.eventsChecked,
      eventsCompleted: results.eventsCompleted,
      errors: results.errors.length
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${results.classesCompleted} completed classes, ${results.classesStarted} started classes, ${results.eventsCompleted} completed events`,
      details: results,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('!!! Class status update cron job error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

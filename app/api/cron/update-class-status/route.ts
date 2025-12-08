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

    console.log('\n=== Class status update completed ===')
    console.log('Summary:', {
      classesChecked: results.classesChecked,
      classesCompleted: results.classesCompleted,
      classesStarted: results.classesStarted,
      errors: results.errors.length
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${results.classesCompleted} completed classes, ${results.classesStarted} started classes`,
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

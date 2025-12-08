// app/api/test/makeup-notification/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMakeupNotification } from '@/lib/supabase/services/line-notifications'
import { getMakeupClass } from '@/lib/supabase/services/makeup'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const { makeupId, type = 'scheduled' } = body

    if (!makeupId) {
      return NextResponse.json({ success: false, message: 'Makeup ID is required' }, { status: 400 })
    }

    console.log('=== Testing Makeup Notification ===')
    console.log('Makeup ID:', makeupId)
    console.log('Type:', type)

    // Step 1: Get makeup data
    const makeup = await getMakeupClass(makeupId)
    if (!makeup) {
      return NextResponse.json({ success: false, message: 'Makeup class not found' }, { status: 404 })
    }
    console.log('Makeup data:', {
      id: makeup.id,
      status: makeup.status,
      studentId: makeup.studentId,
      parentId: makeup.parentId,
      hasSchedule: !!makeup.makeupSchedule
    })

    // Step 2: Check if makeup is scheduled
    if (makeup.status !== 'scheduled' || !makeup.makeupSchedule) {
      return NextResponse.json({
        success: false,
        message: 'Makeup class is not scheduled yet',
        data: {
          status: makeup.status,
          hasSchedule: !!makeup.makeupSchedule
        }
      })
    }

    // Step 3: Get student and parent data from Supabase
    // Get student
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, name, nickname')
      .eq('id', makeup.studentId)
      .single()

    if (studentError || !studentData) {
      return NextResponse.json({
        success: false,
        message: 'Student not found',
        data: { parentId: makeup.parentId, studentId: makeup.studentId }
      })
    }
    console.log('Student:', {
      name: studentData.name,
      nickname: studentData.nickname
    })

    // Get parent
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, display_name, line_user_id')
      .eq('id', makeup.parentId)
      .single()

    if (parentError || !parentData) {
      return NextResponse.json({
        success: false,
        message: 'Parent not found'
      })
    }
    console.log('Parent:', {
      displayName: parentData.display_name,
      hasLineId: !!parentData.line_user_id,
      lineUserId: parentData.line_user_id ? 'EXISTS' : 'NOT_EXISTS'
    })

    if (!parentData.line_user_id) {
      return NextResponse.json({
        success: false,
        message: 'Parent does not have LINE ID connected',
        data: {
          parentId: parentData.id,
          parentName: parentData.display_name
        }
      })
    }

    // Step 4: Try to send notification
    console.log('Attempting to send notification...')

    try {
      const success = await sendMakeupNotification(makeupId, type as 'scheduled' | 'reminder')

      console.log('Notification result:', success)

      return NextResponse.json({
        success,
        message: success ? 'Notification sent successfully' : 'Failed to send notification',
        data: {
          makeupId,
          studentName: studentData.name,
          parentName: parentData.display_name,
          hasLineId: !!parentData.line_user_id,
          scheduleDate: makeup.makeupSchedule.date,
          scheduleTime: `${makeup.makeupSchedule.startTime} - ${makeup.makeupSchedule.endTime}`
        }
      })
    } catch (notifError) {
      console.error('Notification error:', notifError)
      return NextResponse.json({
        success: false,
        message: 'Error sending notification',
        error: notifError instanceof Error ? notifError.message : 'Unknown error',
        data: {
          makeupId,
          studentName: studentData.name,
          parentName: parentData.display_name
        }
      })
    }
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
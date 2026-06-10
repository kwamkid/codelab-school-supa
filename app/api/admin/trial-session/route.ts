import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTrialConfirmation } from '@/lib/supabase/services/line-notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const data = await request.json()

    const sessionData = {
      booking_id: data.bookingId,
      student_name: data.studentName,
      subject_id: data.subjectId,
      scheduled_date: data.scheduledDate,
      start_time: data.startTime,
      end_time: data.endTime,
      teacher_id: data.teacherId,
      branch_id: data.branchId,
      room_id: data.roomId,
      room_name: data.roomName,
      status: data.status || 'scheduled',
    }

    // Check for duplicate: same booking, student, date, time, status=scheduled
    const { data: existing } = await supabase
      .from('trial_sessions')
      .select('id')
      .eq('booking_id', data.bookingId)
      .eq('student_name', data.studentName)
      .eq('scheduled_date', data.scheduledDate)
      .eq('start_time', data.startTime)
      .eq('status', 'scheduled')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ id: existing[0].id })
    }

    const { data: session, error } = await supabase
      .from('trial_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) {
      console.error('Error creating trial session:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update booking status to scheduled if needed
    const { data: booking } = await supabase
      .from('trial_bookings')
      .select('status')
      .eq('id', data.bookingId)
      .single()

    if (booking && (booking.status === 'new' || booking.status === 'contacted')) {
      await supabase
        .from('trial_bookings')
        .update({ status: 'scheduled' })
        .eq('id', data.bookingId)
    }

    // Send LINE confirmation to parent (best-effort, only for scheduled sessions).
    // sendTrialConfirmation no-ops if the booking has no parent_line_id.
    if (sessionData.status === 'scheduled') {
      sendTrialConfirmation(session.id).catch((err) =>
        console.error('[trial-session] confirmation send failed:', err)
      )
    }

    return NextResponse.json({ id: session.id })
  } catch (error) {
    console.error('Error in trial session API:', error)
    return NextResponse.json(
      { error: 'Failed to create trial session' },
      { status: 500 }
    )
  }
}

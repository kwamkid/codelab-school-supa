// app/api/admin/trial-booking/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// DELETE - Delete a trial booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting trial booking:', id)

    // Get booking to check status
    const { data: booking, error: fetchError } = await supabase
      .from('trial_bookings')
      .select('id, status, parent_name')
      .eq('id', id)
      .single()

    if (fetchError || !booking) {
      console.error('Booking not found:', fetchError)
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลการจอง' },
        { status: 404 }
      )
    }

    // Only allow deletion for new or cancelled bookings
    if (booking.status !== 'new' && booking.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'สามารถลบได้เฉพาะการจองที่สถานะ "ใหม่" หรือ "ยกเลิก" เท่านั้น' },
        { status: 400 }
      )
    }

    // Delete all associated trial sessions first
    const { error: sessionsError } = await supabase
      .from('trial_sessions')
      .delete()
      .eq('booking_id', id)

    if (sessionsError) {
      console.error('Error deleting sessions:', sessionsError)
      throw sessionsError
    }

    // Delete all associated trial booking students
    const { error: studentsError } = await supabase
      .from('trial_booking_students')
      .delete()
      .eq('booking_id', id)

    if (studentsError) {
      console.error('Error deleting students:', studentsError)
      throw studentsError
    }

    // Delete the booking
    const { error: bookingError } = await supabase
      .from('trial_bookings')
      .delete()
      .eq('id', id)

    if (bookingError) {
      console.error('Error deleting booking:', bookingError)
      throw bookingError
    }

    console.log('Booking deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบข้อมูลการจองเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting trial booking:', error)
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการลบข้อมูล',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

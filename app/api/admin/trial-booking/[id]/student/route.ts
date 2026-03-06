// app/api/admin/trial-booking/[id]/student/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete a student from a trial booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id: bookingId } = await params

  try {
    const { studentIndex } = await request.json()

    if (typeof studentIndex !== 'number' || studentIndex < 0) {
      return NextResponse.json(
        { error: 'studentIndex ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Get all students for this booking
    const { data: students, error } = await supabase
      .from('trial_booking_students')
      .select('id, name')
      .eq('booking_id', bookingId)
      .order('id', { ascending: true })

    if (error) throw error

    if (!students || students.length <= 1) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบนักเรียนคนสุดท้ายได้' },
        { status: 400 }
      )
    }

    if (studentIndex >= students.length) {
      return NextResponse.json(
        { error: 'ไม่พบนักเรียนที่ต้องการลบ' },
        { status: 404 }
      )
    }

    const studentToDelete = students[studentIndex]

    // Delete the student
    const { error: deleteError } = await supabase
      .from('trial_booking_students')
      .delete()
      .eq('id', studentToDelete.id)

    if (deleteError) throw deleteError

    return NextResponse.json({
      success: true,
      message: `ลบนักเรียน "${studentToDelete.name}" เรียบร้อย`,
    })
  } catch (error: unknown) {
    console.error('Error deleting booking student:', error)
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการลบนักเรียน',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

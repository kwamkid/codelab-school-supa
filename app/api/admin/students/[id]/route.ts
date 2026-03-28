// app/api/admin/students/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete a student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'
  const adminId = searchParams.get('adminId')

  try {
    console.log('Deleting student:', id, { force, adminId })

    // Check if student exists
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !student) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลนักเรียน' }, { status: 404 })
    }

    if (force) {
      // Force delete requires superadmin
      if (!adminId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users' as any)
        .select('role')
        .eq('id', adminId)
        .single()

      if (adminError || !adminUser || (adminUser as any).role !== 'super_admin') {
        return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่สามารถลบได้' }, { status: 403 })
      }

      // Cascade delete all related records
      console.log('Force deleting student with cascade:', id)

      // 1. Delete attendance records
      const { error: attendanceErr } = await supabase
        .from('attendance')
        .delete()
        .eq('student_id', id)
      if (attendanceErr) console.error('Error deleting attendance:', attendanceErr)

      // 2. Delete makeup_classes records
      const { error: makeupErr } = await supabase
        .from('makeup_classes')
        .delete()
        .eq('student_id', id)
      if (makeupErr) console.error('Error deleting makeup_classes:', makeupErr)

      // 3. Delete student_feedback records
      const { error: feedbackErr } = await supabase
        .from('student_feedback' as any)
        .delete()
        .eq('student_id', id)
      if (feedbackErr) console.error('Error deleting student_feedback:', feedbackErr)

      // 4. Delete event_registration_students records
      const { error: eventErr } = await supabase
        .from('event_registration_students' as any)
        .delete()
        .eq('student_id', id)
      if (eventErr) console.error('Error deleting event_registration_students:', eventErr)

      // 5. Delete enrollments (payment_transactions cascade automatically)
      const { error: enrollErr } = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', id)
      if (enrollErr) console.error('Error deleting enrollments:', enrollErr)

      // 6. Finally delete the student
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

    } else {
      // Normal delete — block if has any enrollments
      const { count: enrollmentCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', id)
        .in('status', ['active', 'pending'])

      if (enrollmentCount && enrollmentCount > 0) {
        return NextResponse.json(
          { error: 'ไม่สามารถลบนักเรียนที่มีการลงทะเบียนเรียนอยู่ได้' },
          { status: 400 }
        )
      }

      // Check for attendance records
      const { count: attendanceCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', id)

      if (attendanceCount && attendanceCount > 0) {
        return NextResponse.json(
          { error: 'ไม่สามารถลบนักเรียนที่มีประวัติเข้าเรียนได้ ต้องใช้สิทธิ์ Super Admin' },
          { status: 400 }
        )
      }

      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
    }

    console.log('Student deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบข้อมูลนักเรียนเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting student:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

// app/api/admin/students/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff, requireSuperAdmin, bearer } from '@/lib/server/admin-auth'

export const dynamic = 'force-dynamic'

// DELETE - Delete a student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'
  const token = bearer(request.headers.get('authorization'))

  // Force (cascade) delete = super admin only, verified from the token.
  // The old `adminId` query param is ignored (it was spoofable).
  let adminId: string | undefined
  if (force) {
    const auth = await requireSuperAdmin(token)
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 403 ? 'เฉพาะ Super Admin เท่านั้นที่สามารถลบได้' : auth.error },
        { status: auth.status }
      )
    }
    adminId = auth.adminId
  } else {
    const auth = await requireStaff(token)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (auth.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    adminId = auth.adminId
  }

  const supabase = createServiceClient()
  const { id } = await params

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
      // Super admin already verified above.
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
        .in('status', ['active', 'pending'] as any)

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

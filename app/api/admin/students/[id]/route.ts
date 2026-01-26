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

  try {
    console.log('Deleting student:', id)

    // Check if student exists
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !student) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลนักเรียน' }, { status: 404 })
    }

    // Check if student has active enrollments
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

    // Delete the student
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

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

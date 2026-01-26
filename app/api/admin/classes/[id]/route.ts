// app/api/admin/classes/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete a class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting class:', id)

    // Check if class exists
    const { data: classData, error: fetchError } = await supabase
      .from('classes')
      .select('id, name, status, enrolled_count')
      .eq('id', id)
      .single()

    if (fetchError || !classData) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลคลาส' }, { status: 404 })
    }

    // Only allow deletion for draft classes or classes with no enrollments
    if (classData.status !== 'draft' && classData.enrolled_count > 0) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบคลาสที่มีนักเรียนลงทะเบียนได้' },
        { status: 400 }
      )
    }

    // Delete schedules first
    const { error: scheduleError } = await supabase
      .from('class_schedules')
      .delete()
      .eq('class_id', id)

    if (scheduleError) {
      console.error('Error deleting schedules:', scheduleError)
      throw scheduleError
    }

    // Delete the class
    const { error: deleteError } = await supabase
      .from('classes')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    console.log('Class deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบคลาสเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting class:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

// app/api/admin/enrollments/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete an enrollment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting enrollment:', id)

    // Check if enrollment exists
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select('id, class_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !enrollment) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลการลงทะเบียน' }, { status: 404 })
    }

    // Delete the enrollment
    const { error: deleteError } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Note: enrolled_count is updated automatically by database trigger on enrollments table
    // Do NOT manually decrement here to avoid double-counting

    console.log('Enrollment deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบการลงทะเบียนเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting enrollment:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

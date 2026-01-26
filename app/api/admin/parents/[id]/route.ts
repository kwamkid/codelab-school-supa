// app/api/admin/parents/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete a parent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting parent:', id)

    // Check if parent exists
    const { data: parent, error: fetchError } = await supabase
      .from('parents')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !parent) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ปกครอง' }, { status: 404 })
    }

    // Check if parent has students
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', id)

    if (studentCount && studentCount > 0) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบผู้ปกครองที่มีนักเรียนในระบบได้ กรุณาลบนักเรียนก่อน' },
        { status: 400 }
      )
    }

    // Delete the parent
    const { error: deleteError } = await supabase
      .from('parents')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    console.log('Parent deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบผู้ปกครองเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting parent:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

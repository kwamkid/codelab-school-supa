// app/api/admin/teachers/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Soft delete a teacher (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Soft deleting teacher:', id)

    // Check if teacher exists
    const { data: teacher, error: fetchError } = await supabase
      .from('teachers')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !teacher) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลครู' }, { status: 404 })
    }

    // Soft delete teacher (set is_active = false)
    const { error: updateError } = await supabase
      .from('teachers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Also soft delete admin_users if exists
    await supabase
      .from('admin_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: 'system',
      })
      .eq('teacher_id', id)

    console.log('Teacher soft deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ปิดการใช้งานครูเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting teacher:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

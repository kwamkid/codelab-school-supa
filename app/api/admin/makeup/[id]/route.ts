// app/api/admin/makeup/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// DELETE - Delete a makeup class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    // Get request body for deletedBy and reason
    const body = await request.json().catch(() => ({}))
    const { deletedBy, reason } = body

    console.log('Deleting makeup class:', id)

    // Get makeup to check status
    const { data: makeup, error: fetchError } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !makeup) {
      console.error('Makeup not found:', fetchError)
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล Makeup Class' },
        { status: 404 }
      )
    }

    // Only allow deletion for non-completed makeup
    if (makeup.status === 'completed') {
      return NextResponse.json(
        { error: 'ไม่สามารถลบ Makeup ที่เรียนเสร็จแล้วได้' },
        { status: 400 }
      )
    }

    // Delete the makeup class
    const { error: deleteError } = await supabase
      .from('makeup_classes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting makeup:', deleteError)
      throw deleteError
    }

    // Create deletion log (optional, don't fail if it errors)
    if (deletedBy) {
      const { error: logError } = await supabase
        .from('deletion_logs')
        .insert({
          type: 'makeup_class',
          document_id: id,
          deleted_by: deletedBy,
          deleted_at: new Date().toISOString(),
          reason: reason || 'No reason provided',
          original_data: {
            studentId: makeup.student_id,
            classId: makeup.original_class_id,
            scheduleId: makeup.original_schedule_id,
            status: makeup.status,
            requestDate: makeup.request_date
          }
        })

      if (logError) {
        console.error('Error creating deletion log:', logError)
        // Don't throw, just log the error
      }
    }

    console.log('Makeup deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบ Makeup Class เรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting makeup class:', error)
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดในการลบข้อมูล',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

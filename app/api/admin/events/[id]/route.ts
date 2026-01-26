// app/api/admin/events/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE - Delete an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServiceClient()
  const { id } = await params

  try {
    console.log('Deleting event:', id)

    // Check if event exists
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('id, name, status')
      .eq('id', id)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลกิจกรรม' }, { status: 404 })
    }

    // Check if event has registrations
    const { count } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบกิจกรรมที่มีผู้ลงทะเบียนได้' },
        { status: 400 }
      )
    }

    // Delete event (schedules will cascade)
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    console.log('Event deleted successfully:', id)

    return NextResponse.json({
      success: true,
      message: 'ลบกิจกรรมเรียบร้อย'
    })
  } catch (error: any) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อมูล', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

// app/api/liff/cancel-leave/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const { makeupId, studentId, classId, scheduleId } = body

    // Validate required fields
    if (!makeupId || !studentId || !classId || !scheduleId) {
      return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    // Get makeup request
    const { data: makeup, error: makeupError } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('id', makeupId)
      .single()

    if (makeupError || !makeup) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลการลา' }, { status: 404 })
    }

    // Check if can cancel
    if (makeup.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถยกเลิกได้ เนื่องจากมีการนัดเรียนชดเชยแล้ว' },
        { status: 400 }
      )
    }

    // Check if the original class date is in the future
    const now = new Date()
    const originalDate = makeup.original_session_date ? new Date(makeup.original_session_date) : new Date()

    if (originalDate < now) {
      return NextResponse.json({ success: false, message: 'ไม่สามารถยกเลิกการลาย้อนหลังได้' }, { status: 400 })
    }

    // Delete makeup request
    const { error: deleteError } = await supabase.from('makeup_classes').delete().eq('id', makeupId)

    if (deleteError) {
      console.error('[Cancel Leave] Error deleting makeup:', deleteError)
      throw deleteError
    }

    // Delete attendance record
    try {
      await supabase.from('attendance').delete().eq('schedule_id', scheduleId).eq('student_id', studentId)
    } catch (updateError) {
      console.error('[Cancel Leave] Error updating attendance:', updateError)
      // Continue even if attendance update fails
    }

    console.log(`[Cancel Leave] Cancelled makeup request ${makeupId} for student ${studentId}`)

    return NextResponse.json({
      success: true,
      message: 'ยกเลิกการลาเรียนเรียบร้อยแล้ว'
    })
  } catch (error) {
    console.error('[Cancel Leave] Error:', error)

    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 })
  }
}

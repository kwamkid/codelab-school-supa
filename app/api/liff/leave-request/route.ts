// app/api/liff/leave-request/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const { studentId, classId, scheduleId, reason, type } = body

    // Validate required fields
    if (!studentId || !classId || !scheduleId) {
      return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    // Get enrollment to find parentId
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('parent_id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('status', 'active')
      .single()

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลการลงทะเบียน' }, { status: 404 })
    }

    const parentId = enrollment.parent_id

    // Get class schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('class_id', classId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลคาบเรียน' }, { status: 404 })
    }

    // Check if schedule is in the future
    const now = new Date()
    const scheduleDate = new Date(schedule.session_date)

    if (scheduleDate < now) {
      return NextResponse.json({ success: false, message: 'ไม่สามารถลาย้อนหลังได้' }, { status: 400 })
    }

    // Check if makeup already exists
    const { data: existingMakeup } = await supabase
      .from('makeup_classes')
      .select('id')
      .eq('student_id', studentId)
      .eq('original_class_id', classId)
      .eq('original_schedule_id', scheduleId)
      .in('status', ['pending', 'scheduled'])
      .limit(1)

    if (existingMakeup && existingMakeup.length > 0) {
      return NextResponse.json({ success: false, message: 'มีการขอลาในคาบนี้แล้ว' }, { status: 400 })
    }

    // Check quota - count scheduled makeups
    const { data: quotaMakeups } = await supabase
      .from('makeup_classes')
      .select('id')
      .eq('student_id', studentId)
      .eq('original_class_id', classId)
      .eq('type', 'scheduled')
      .in('requested_by', ['parent-liff', 'parent'])

    // Count absences from attendance records
    const { data: absences } = await supabase
      .from('attendance')
      .select('id, class_schedules!inner(class_id)')
      .eq('student_id', studentId)
      .eq('status', 'absent')
      .eq('class_schedules.class_id', classId)

    const scheduledMakeups = quotaMakeups?.length || 0
    const totalAbsences = absences?.length || 0
    const totalUsed = scheduledMakeups + totalAbsences
    const MAKEUP_QUOTA = 4

    console.log(
      `[LIFF Leave Request] Quota check - Scheduled: ${scheduledMakeups}, Absences: ${totalAbsences}, Total: ${totalUsed}/${MAKEUP_QUOTA}`
    )

    if (totalUsed >= MAKEUP_QUOTA) {
      return NextResponse.json(
        {
          success: false,
          message: `ใช้สิทธิ์ครบ ${MAKEUP_QUOTA} ครั้งแล้ว (ลา ${scheduledMakeups} + ขาด ${totalAbsences})`,
          quotaDetails: {
            scheduled: scheduledMakeups,
            absences: totalAbsences,
            total: totalUsed,
            limit: MAKEUP_QUOTA
          }
        },
        { status: 400 }
      )
    }

    // Create makeup request
    const { data: makeupResult, error: makeupError } = await supabase
      .from('makeup_classes')
      .insert({
        type: type || 'scheduled',
        original_class_id: classId,
        original_schedule_id: scheduleId,
        student_id: studentId,
        parent_id: parentId,
        requested_by: 'parent-liff',
        reason: reason || 'ลาผ่านระบบ LIFF',
        status: 'pending',
        original_session_number: schedule.session_number || 0,
        original_session_date: schedule.session_date
      })
      .select('id')
      .single()

    if (makeupError) {
      console.error('[LIFF Leave Request] Error creating makeup:', makeupError)
      throw makeupError
    }

    // Update/create attendance record (mark as absent)
    try {
      // Check if attendance record exists
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('student_id', studentId)
        .single()

      if (existingAttendance) {
        // Update existing attendance
        await supabase
          .from('attendance')
          .update({
            status: 'absent',
            note: 'ลาผ่านระบบ LIFF',
            checked_at: new Date().toISOString(),
            checked_by: 'parent-liff'
          })
          .eq('id', existingAttendance.id)
      } else {
        // Insert new attendance record
        await supabase.from('attendance').insert({
          schedule_id: scheduleId,
          student_id: studentId,
          status: 'absent',
          note: 'ลาผ่านระบบ LIFF',
          checked_at: new Date().toISOString(),
          checked_by: 'parent-liff'
        })
      }
    } catch (updateError) {
      console.error('[LIFF Leave Request] Error updating attendance:', updateError)
      // Continue even if attendance update fails
    }

    console.log(
      `[LIFF Leave Request] Created makeup request ${makeupResult.id} for student ${studentId} (Total used: ${totalUsed + 1}/${MAKEUP_QUOTA})`
    )

    return NextResponse.json({
      success: true,
      message: 'บันทึกการลาเรียนเรียบร้อยแล้ว',
      makeupId: makeupResult.id,
      quotaUsed: totalUsed + 1,
      quotaLimit: MAKEUP_QUOTA,
      quotaDetails: {
        scheduled: scheduledMakeups + 1,
        absences: totalAbsences,
        total: totalUsed + 1
      }
    })
  } catch (error) {
    console.error('[LIFF Leave Request] Error:', error)

    if (error instanceof Error && error.message.includes('permission')) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ในการดำเนินการ' }, { status: 403 })
    }

    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 })
  }
}

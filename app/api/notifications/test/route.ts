// app/api/notifications/test/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { sendClassReminder } from '@/lib/supabase/services/line-notifications'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, studentId, classId, scheduleDate } = body

    console.log('\n=== Test Notification ===')
    console.log('Type:', type)
    console.log('Data:', { studentId, classId, scheduleDate })

    let result: { success: boolean; error?: string } = { success: false }

    if (type === 'class-reminder') {
      if (!studentId || !classId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Missing studentId or classId'
          },
          { status: 400 }
        )
      }

      // ถ้าไม่ได้ส่ง scheduleDate มา ให้ใช้วันพรุ่งนี้
      const tomorrow = scheduleDate ? new Date(scheduleDate) : new Date()
      if (!scheduleDate) {
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)
      }

      console.log('Sending class reminder for tomorrow:', tomorrow.toISOString())

      result = (await sendClassReminder(studentId, classId, tomorrow))
        ? { success: true }
        : { success: false, error: 'Failed to send' }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid notification type'
        },
        { status: 400 }
      )
    }

    if (result.success) {
      console.log('✓ Notification sent successfully')
      return NextResponse.json({
        success: true,
        message: 'ส่งการแจ้งเตือนสำเร็จ'
      })
    } else {
      console.log('✗ Failed to send notification:', result.error)
      return NextResponse.json({
        success: false,
        message: result.error || 'ไม่สามารถส่งการแจ้งเตือนได้'
      })
    }
  } catch (error) {
    console.error('Test notification error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาด',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET: ดึงข้อมูลสำหรับทดสอบ
export async function GET(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const { searchParams } = new URL(request.url)
    const dataType = searchParams.get('type')
    const parentId = searchParams.get('parentId')
    const studentId = searchParams.get('studentId')

    if (!dataType) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing type parameter'
        },
        { status: 400 }
      )
    }

    let data: any[] = []

    switch (dataType) {
      case 'parents-with-line': {
        // ดึงผู้ปกครองที่มี LINE ID
        const { data: parents, error } = await supabase
          .from('parents')
          .select('id, display_name, phone, line_user_id')
          .not('line_user_id', 'is', null)
          .limit(100)

        if (error) throw error

        data = (parents || []).map(p => ({
          id: p.id,
          displayName: p.display_name,
          phone: p.phone,
          lineUserId: p.line_user_id
        }))

        break
      }

      case 'students-by-parent': {
        // ดึงนักเรียนของผู้ปกครอง
        if (!parentId) {
          return NextResponse.json(
            {
              success: false,
              message: 'Missing parentId parameter'
            },
            { status: 400 }
          )
        }

        const { data: students, error } = await supabase
          .from('students')
          .select('id, name, nickname, profile_image')
          .eq('parent_id', parentId)
          .eq('is_active', true)

        if (error) throw error

        data = (students || []).map(s => ({
          id: s.id,
          name: s.name,
          nickname: s.nickname,
          profileImage: s.profile_image
        }))

        break
      }

      case 'classes-by-student': {
        // ดึงคลาสของนักเรียน
        if (!studentId) {
          return NextResponse.json(
            {
              success: false,
              message: 'Missing studentId parameter'
            },
            { status: 400 }
          )
        }

        // Get active enrollments with class, subject, and branch data
        const { data: enrollments, error } = await supabase
          .from('enrollments')
          .select(
            `
            id,
            class_id,
            classes!enrollments_class_id_fkey (
              id,
              name,
              code,
              status,
              start_time,
              end_time,
              days_of_week,
              subject_id,
              branch_id,
              subjects (name),
              branches (name)
            )
          `
          )
          .eq('student_id', studentId)
          .eq('status', 'active')

        if (error) throw error

        for (const enrollment of enrollments || []) {
          const classData = enrollment.classes as any

          // Skip draft or cancelled classes
          if (classData.status === 'draft' || classData.status === 'cancelled') {
            continue
          }

          data.push({
            enrollmentId: enrollment.id,
            classId: classData.id,
            className: classData.name,
            classCode: classData.code,
            subjectName: classData.subjects?.name || 'ไม่ระบุ',
            branchName: classData.branches?.name || 'ไม่ระบุ',
            status: classData.status,
            startTime: classData.start_time,
            endTime: classData.end_time,
            daysOfWeek: classData.days_of_week
          })
        }

        break
      }

      default:
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid data type'
          },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Get test data error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาด',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
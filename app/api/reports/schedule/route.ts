// app/api/reports/schedule/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Saturday)
    const weekEnd = searchParams.get('weekEnd')     // YYYY-MM-DD (Friday)

    // Query active classes with teacher, subject, and enrolled students
    let query = supabase
      .from('classes')
      .select(`
        id,
        name,
        days_of_week,
        start_time,
        end_time,
        start_date,
        end_date,
        teacher_id,
        subject_id,
        teachers (id, name, nickname),
        subjects (id, name, color),
        enrollments!enrollments_class_id_fkey (
          id,
          status,
          student_id,
          students (id, name, nickname)
        )
      `)
      .in('status', ['published', 'started'])

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    // Filter classes whose date range overlaps with the selected week
    if (weekStart && weekEnd) {
      query = query
        .lte('start_date', weekEnd)
        .gte('end_date', weekStart)
    }

    const { data: classes, error } = await query

    if (error) {
      console.error('Error fetching schedule data:', error)
      throw error
    }

    // Transform data
    const scheduleItems = (classes || []).map((cls: any) => {
      const teacher = cls.teachers
      const subject = cls.subjects
      const enrollments = cls.enrollments || []

      // Filter active enrollments only
      const activeStudents = enrollments
        .filter((e: any) => e.status === 'active')
        .map((e: any) => ({
          id: e.students?.id || '',
          nickname: e.students?.nickname || '',
          name: e.students?.name || ''
        }))
        .filter((s: any) => s.id)

      return {
        id: cls.id,
        name: cls.name,
        days_of_week: cls.days_of_week || [],
        start_time: cls.start_time || '',
        end_time: cls.end_time || '',
        teacher_id: teacher?.id || '',
        teacher_nickname: teacher?.nickname || teacher?.name || '',
        teacher_name: teacher?.name || '',
        subject_name: subject?.name || '',
        subject_color: subject?.color || '#6B7280',
        students: activeStudents
      }
    })

    return NextResponse.json({
      success: true,
      data: scheduleItems
    })
  } catch (error) {
    console.error('Error in schedule report API:', error)
    return NextResponse.json(
      { success: false, message: 'Error fetching schedule data' },
      { status: 500 }
    )
  }
}

// app/api/reports/enrollment/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface EnrollmentStats {
  total: number
  fromTrial: number
  walkIn: number
  byPaymentStatus: {
    paid: number
    partial: number
    pending: number
  }
  byStatus: {
    active: number
    completed: number
    dropped: number
    transferred: number
  }
  totalRevenue: number
  paidRevenue: number
  pendingRevenue: number
  bySubject: Array<{
    subjectId: string
    subjectName: string
    total: number
    revenue: number
  }>
  byBranch: Array<{
    branchId: string
    branchName: string
    total: number
    fromTrial: number
    revenue: number
  }>
}

interface Enrollment {
  id: string
  student_name: string
  student_nickname: string | null
  class_name: string
  subject_name: string | null
  branch_name: string | null
  enrolled_at: string
  status: string
  payment_status: string
  final_price: number
  paid_amount: number
  from_trial: boolean
  parent_name: string | null
  parent_phone: string | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const branchId = searchParams.get('branchId')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Build query for enrollments
    // Use explicit foreign key hint because enrollments has two FKs to classes (class_id and transferred_from)
    let query = supabase
      .from('enrollments')
      .select(`
        id,
        enrolled_at,
        status,
        payment_status,
        final_price,
        paid_amount,
        students (id, name, nickname, parent_id),
        classes!enrollments_class_id_fkey (id, name, subject_id, subjects (id, name)),
        branches (id, name),
        parents (id, display_name, phone)
      `, { count: 'exact' })
      .order('enrolled_at', { ascending: false })

    // Apply date filters on enrolled_at
    if (startDate) {
      query = query.gte('enrolled_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('enrolled_at', `${endDate}T23:59:59`)
    }
    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    // Get paginated results
    const offset = (page - 1) * pageSize
    const { data: enrollments, error: enrollmentsError, count } = await query
      .range(offset, offset + pageSize - 1)

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError)
      throw enrollmentsError
    }

    // Get all enrollments for stats (without pagination)
    // Use explicit foreign key hint because enrollments has two FKs to classes (class_id and transferred_from)
    let statsQuery = supabase
      .from('enrollments')
      .select(`
        id,
        enrolled_at,
        status,
        payment_status,
        final_price,
        paid_amount,
        branch_id,
        branches (id, name),
        classes!enrollments_class_id_fkey (id, name, subject_id, subjects (id, name))
      `)

    if (startDate) {
      statsQuery = statsQuery.gte('enrolled_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      statsQuery = statsQuery.lte('enrolled_at', `${endDate}T23:59:59`)
    }
    if (branchId) {
      statsQuery = statsQuery.eq('branch_id', branchId)
    }

    const { data: allEnrollments, error: statsError } = await statsQuery

    if (statsError) {
      console.error('Error fetching stats:', statsError)
      throw statsError
    }

    // Get trial conversions to check which enrollments came from trial
    let trialQuery = supabase
      .from('trial_sessions')
      .select('converted_to_class_id, student_name')
      .eq('converted', true)

    const { data: trialConversions } = await trialQuery

    // Create a set of class_ids that came from trial conversions
    const trialClassIds = new Set(
      (trialConversions || []).map(t => t.converted_to_class_id).filter(Boolean)
    )

    // Calculate stats
    const stats: EnrollmentStats = {
      total: allEnrollments?.length || 0,
      fromTrial: 0,
      walkIn: 0,
      byPaymentStatus: {
        paid: 0,
        partial: 0,
        pending: 0
      },
      byStatus: {
        active: 0,
        completed: 0,
        dropped: 0,
        transferred: 0
      },
      totalRevenue: 0,
      paidRevenue: 0,
      pendingRevenue: 0,
      bySubject: [],
      byBranch: []
    }

    const subjectMap = new Map<string, { name: string, total: number, revenue: number }>()
    const branchMap = new Map<string, { name: string, total: number, fromTrial: number, revenue: number }>()

    for (const enrollment of allEnrollments || []) {
      const classData = enrollment.classes as any
      const isFromTrial = classData?.id && trialClassIds.has(classData.id)

      // Count source
      if (isFromTrial) {
        stats.fromTrial++
      } else {
        stats.walkIn++
      }

      // Count by payment status
      const paymentStatus = enrollment.payment_status as keyof typeof stats.byPaymentStatus
      if (stats.byPaymentStatus.hasOwnProperty(paymentStatus)) {
        stats.byPaymentStatus[paymentStatus]++
      }

      // Count by enrollment status
      const status = enrollment.status as keyof typeof stats.byStatus
      if (stats.byStatus.hasOwnProperty(status)) {
        stats.byStatus[status]++
      }

      // Calculate revenue
      const finalPrice = enrollment.final_price || 0
      const paidAmount = enrollment.paid_amount || 0
      stats.totalRevenue += finalPrice
      stats.paidRevenue += paidAmount
      stats.pendingRevenue += (finalPrice - paidAmount)

      // Aggregate by subject
      const subject = classData?.subjects as any
      if (subject?.id) {
        const existing = subjectMap.get(subject.id)
        if (existing) {
          existing.total++
          existing.revenue += finalPrice
        } else {
          subjectMap.set(subject.id, {
            name: subject.name,
            total: 1,
            revenue: finalPrice
          })
        }
      }

      // Aggregate by branch
      const branch = enrollment.branches as any
      if (branch?.id) {
        const existing = branchMap.get(branch.id)
        if (existing) {
          existing.total++
          if (isFromTrial) existing.fromTrial++
          existing.revenue += finalPrice
        } else {
          branchMap.set(branch.id, {
            name: branch.name,
            total: 1,
            fromTrial: isFromTrial ? 1 : 0,
            revenue: finalPrice
          })
        }
      }
    }

    // Convert maps to arrays
    stats.bySubject = Array.from(subjectMap.entries()).map(([subjectId, data]) => ({
      subjectId,
      subjectName: data.name,
      total: data.total,
      revenue: data.revenue
    })).sort((a, b) => b.total - a.total)

    stats.byBranch = Array.from(branchMap.entries()).map(([branchId, data]) => ({
      branchId,
      branchName: data.name,
      total: data.total,
      fromTrial: data.fromTrial,
      revenue: data.revenue
    })).sort((a, b) => b.total - a.total)

    // Transform enrollments for response
    const transformedEnrollments: Enrollment[] = (enrollments || []).map(enrollment => {
      const student = enrollment.students as any
      const classData = enrollment.classes as any
      const branch = enrollment.branches as any
      const parent = enrollment.parents as any
      const subject = classData?.subjects as any
      const isFromTrial = classData?.id && trialClassIds.has(classData.id)

      return {
        id: enrollment.id,
        student_name: student?.name || '-',
        student_nickname: student?.nickname || null,
        class_name: classData?.name || '-',
        subject_name: subject?.name || null,
        branch_name: branch?.name || null,
        enrolled_at: enrollment.enrolled_at,
        status: enrollment.status,
        payment_status: enrollment.payment_status,
        final_price: enrollment.final_price || 0,
        paid_amount: enrollment.paid_amount || 0,
        from_trial: isFromTrial,
        parent_name: parent?.display_name || null,
        parent_phone: parent?.phone || null
      }
    })

    return NextResponse.json({
      success: true,
      stats,
      enrollments: transformedEnrollments,
      total: count || 0,
      page,
      pageSize
    })
  } catch (error) {
    console.error('Error in enrollment report API:', error)
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

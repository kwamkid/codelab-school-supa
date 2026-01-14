// app/api/reports/trial/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface TrialStats {
  total: number
  attended: number
  absent: number
  cancelled: number
  converted: number
  attendedRate: number
  conversionRate: number
  byInterestLevel: {
    high: number
    medium: number
    low: number
    not_interested: number
    null: number
  }
  bySubject: Array<{
    subjectId: string
    subjectName: string
    total: number
    converted: number
    conversionRate: number
  }>
  byBranch: Array<{
    branchId: string
    branchName: string
    total: number
    attended: number
    converted: number
    conversionRate: number
  }>
}

interface TrialSession {
  id: string
  student_name: string
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
  attended: boolean
  interested_level: string | null
  converted: boolean
  feedback: string | null
  subject_name: string | null
  branch_name: string | null
  teacher_name: string | null
  parent_name: string | null
  parent_phone: string | null
  source: string | null
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

    // Build query for trial sessions
    let query = supabase
      .from('trial_sessions')
      .select(`
        id,
        student_name,
        scheduled_date,
        start_time,
        end_time,
        status,
        attended,
        interested_level,
        converted,
        feedback,
        subjects (id, name),
        branches (id, name),
        teachers (id, name, nickname),
        trial_bookings (id, parent_name, parent_phone, source)
      `, { count: 'exact' })
      .order('scheduled_date', { ascending: false })

    // Apply date filters
    if (startDate) {
      query = query.gte('scheduled_date', startDate)
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate)
    }
    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    // Get paginated results
    const offset = (page - 1) * pageSize
    const { data: sessions, error: sessionsError, count } = await query
      .range(offset, offset + pageSize - 1)

    if (sessionsError) {
      console.error('Error fetching trial sessions:', sessionsError)
      throw sessionsError
    }

    // Get stats query (without pagination)
    let statsQuery = supabase
      .from('trial_sessions')
      .select(`
        id,
        status,
        attended,
        interested_level,
        converted,
        subject_id,
        branch_id,
        subjects (id, name),
        branches (id, name)
      `)

    if (startDate) {
      statsQuery = statsQuery.gte('scheduled_date', startDate)
    }
    if (endDate) {
      statsQuery = statsQuery.lte('scheduled_date', endDate)
    }
    if (branchId) {
      statsQuery = statsQuery.eq('branch_id', branchId)
    }

    const { data: allSessions, error: statsError } = await statsQuery

    if (statsError) {
      console.error('Error fetching stats:', statsError)
      throw statsError
    }

    // Calculate stats
    const stats: TrialStats = {
      total: allSessions?.length || 0,
      attended: 0,
      absent: 0,
      cancelled: 0,
      converted: 0,
      attendedRate: 0,
      conversionRate: 0,
      byInterestLevel: {
        high: 0,
        medium: 0,
        low: 0,
        not_interested: 0,
        null: 0
      },
      bySubject: [],
      byBranch: []
    }

    const subjectMap = new Map<string, { name: string, total: number, converted: number }>()
    const branchMap = new Map<string, { name: string, total: number, attended: number, converted: number }>()

    for (const session of allSessions || []) {
      // Count by status
      if (session.status === 'attended' || session.attended) {
        stats.attended++
      } else if (session.status === 'absent') {
        stats.absent++
      } else if (session.status === 'cancelled') {
        stats.cancelled++
      }

      // Count converted
      if (session.converted) {
        stats.converted++
      }

      // Count by interest level
      const level = session.interested_level as keyof typeof stats.byInterestLevel
      if (level && stats.byInterestLevel.hasOwnProperty(level)) {
        stats.byInterestLevel[level]++
      } else {
        stats.byInterestLevel.null++
      }

      // Aggregate by subject
      const subject = session.subjects as any
      if (subject?.id) {
        const existing = subjectMap.get(subject.id)
        if (existing) {
          existing.total++
          if (session.converted) existing.converted++
        } else {
          subjectMap.set(subject.id, {
            name: subject.name,
            total: 1,
            converted: session.converted ? 1 : 0
          })
        }
      }

      // Aggregate by branch
      const branch = session.branches as any
      if (branch?.id) {
        const existing = branchMap.get(branch.id)
        if (existing) {
          existing.total++
          if (session.status === 'attended' || session.attended) existing.attended++
          if (session.converted) existing.converted++
        } else {
          branchMap.set(branch.id, {
            name: branch.name,
            total: 1,
            attended: (session.status === 'attended' || session.attended) ? 1 : 0,
            converted: session.converted ? 1 : 0
          })
        }
      }
    }

    // Calculate rates
    stats.attendedRate = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0
    stats.conversionRate = stats.attended > 0 ? Math.round((stats.converted / stats.attended) * 100) : 0

    // Convert maps to arrays
    stats.bySubject = Array.from(subjectMap.entries()).map(([subjectId, data]) => ({
      subjectId,
      subjectName: data.name,
      total: data.total,
      converted: data.converted,
      conversionRate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)

    stats.byBranch = Array.from(branchMap.entries()).map(([branchId, data]) => ({
      branchId,
      branchName: data.name,
      total: data.total,
      attended: data.attended,
      converted: data.converted,
      conversionRate: data.attended > 0 ? Math.round((data.converted / data.attended) * 100) : 0
    })).sort((a, b) => b.total - a.total)

    // Transform sessions for response
    const transformedSessions: TrialSession[] = (sessions || []).map(session => {
      const subject = session.subjects as any
      const branch = session.branches as any
      const teacher = session.teachers as any
      const booking = session.trial_bookings as any

      return {
        id: session.id,
        student_name: session.student_name,
        scheduled_date: session.scheduled_date,
        start_time: session.start_time,
        end_time: session.end_time,
        status: session.status,
        attended: session.attended,
        interested_level: session.interested_level,
        converted: session.converted,
        feedback: session.feedback,
        subject_name: subject?.name || null,
        branch_name: branch?.name || null,
        teacher_name: teacher?.nickname || teacher?.name || null,
        parent_name: booking?.parent_name || null,
        parent_phone: booking?.parent_phone || null,
        source: booking?.source || null
      }
    })

    return NextResponse.json({
      success: true,
      stats,
      sessions: transformedSessions,
      total: count || 0,
      page,
      pageSize
    })
  } catch (error) {
    console.error('Error in trial report API:', error)
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

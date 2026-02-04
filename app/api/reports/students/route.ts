import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeGradeLevel } from '@/lib/constants/grade-levels'
import { gradeLevels } from '@/lib/constants/grade-levels'
import { groupSchoolNames } from '@/lib/utils/normalize-school-name'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const branchId = searchParams.get('branchId')
    const status = searchParams.get('status') || 'all'

    // Step 1: Get all enrollments to map student -> branches
    const { data: allEnrollments } = await supabase
      .from('enrollments')
      .select('student_id, branch_id')

    const studentBranchMap = new Map<string, Set<string>>()
    for (const e of (allEnrollments || []) as Array<{ student_id: string; branch_id: string }>) {
      if (!studentBranchMap.has(e.student_id)) {
        studentBranchMap.set(e.student_id, new Set())
      }
      studentBranchMap.get(e.student_id)!.add(e.branch_id)
    }

    // Step 2: Get branches for names
    const { data: branchesRaw } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    const branches = (branchesRaw || []) as Array<{ id: string; name: string }>
    const branchNameMap = new Map<string, string>()
    for (const b of branches) {
      branchNameMap.set(b.id, b.name)
    }

    // Step 3: If branch filter, find student IDs
    let studentIdsInBranch: Set<string> | null = null

    if (branchId) {
      studentIdsInBranch = new Set<string>()
      for (const [studentId, branchIds] of studentBranchMap) {
        if (branchIds.has(branchId)) {
          studentIdsInBranch.add(studentId)
        }
      }
    }

    // Step 4: Stats query
    let statsQuery = supabase
      .from('students')
      .select('id, gender, grade_level, school_name, is_active')

    if (studentIdsInBranch) {
      statsQuery = statsQuery.in('id', [...studentIdsInBranch])
    }
    if (status === 'active') {
      statsQuery = statsQuery.eq('is_active', true)
    } else if (status === 'inactive') {
      statsQuery = statsQuery.eq('is_active', false)
    }

    const { data: allStudentsRaw, error: statsError } = await statsQuery

    if (statsError) {
      console.error('Error fetching stats:', statsError)
      throw statsError
    }

    const allStudents = (allStudentsRaw || []) as Array<{
      id: string
      gender: string
      grade_level: string | null
      school_name: string | null
      is_active: boolean
    }>

    // Step 5: Calculate stats
    let active = 0
    let inactive = 0
    const byGender = { male: 0, female: 0 }
    let noSchool = 0
    let noGrade = 0

    const gradeLevelMap = new Map<string, number>()
    const schoolNames: string[] = []

    // For branch breakdown: school -> branchId -> count
    const schoolBranchCounts = new Map<string, Map<string, number>>()

    for (const s of allStudents) {
      if (s.is_active) active++
      else inactive++

      if (s.gender === 'M') byGender.male++
      else if (s.gender === 'F') byGender.female++

      if (s.grade_level) {
        const normalized = normalizeGradeLevel(s.grade_level)
        gradeLevelMap.set(normalized, (gradeLevelMap.get(normalized) || 0) + 1)
      } else {
        noGrade++
      }

      if (s.school_name && s.school_name.trim()) {
        schoolNames.push(s.school_name)

        // Track which branches this student belongs to
        const studentBranches = studentBranchMap.get(s.id)
        if (studentBranches) {
          if (!schoolBranchCounts.has(s.school_name)) {
            schoolBranchCounts.set(s.school_name, new Map())
          }
          const branchCounts = schoolBranchCounts.get(s.school_name)!
          for (const bid of studentBranches) {
            branchCounts.set(bid, (branchCounts.get(bid) || 0) + 1)
          }
        }
      } else {
        noSchool++
      }
    }

    // Build grade level stats with categories
    const gradeCategoryOrder = [
      'อนุบาล',
      'ประถมศึกษา',
      'มัธยมศึกษาตอนต้น',
      'มัธยมศึกษาตอนปลาย',
      'International - Early Years',
      'International - Primary',
      'International - Secondary',
      'British - Primary',
      'British - Secondary',
      'British - Sixth Form',
      'อื่นๆ',
    ]

    const byGradeLevel = Array.from(gradeLevelMap.entries())
      .map(([gradeLevel, gradeCount]) => {
        const found = gradeLevels.find(g => g.value === gradeLevel)
        return {
          gradeLevel,
          category: found?.category || 'อื่นๆ',
          count: gradeCount,
        }
      })
      .sort((a, b) => {
        const catA = gradeCategoryOrder.indexOf(a.category)
        const catB = gradeCategoryOrder.indexOf(b.category)
        if (catA !== catB) return (catA === -1 ? 999 : catA) - (catB === -1 ? 999 : catB)
        return b.count - a.count
      })

    // Build school stats using groupSchoolNames
    const bySchool = groupSchoolNames(schoolNames)

    // Build bySchool with branch breakdown
    const bySchoolWithBranches = bySchool.map((school) => {
      // Aggregate branch counts from all variants of this school name
      const aggregatedBranches = new Map<string, number>()
      for (const variant of school.variants) {
        const branchCounts = schoolBranchCounts.get(variant)
        if (branchCounts) {
          for (const [bid, cnt] of branchCounts) {
            aggregatedBranches.set(bid, (aggregatedBranches.get(bid) || 0) + cnt)
          }
        }
      }

      const branchBreakdown: Record<string, number> = {}
      for (const [bid, cnt] of aggregatedBranches) {
        const bName = branchNameMap.get(bid)
        if (bName) {
          branchBreakdown[bName] = cnt
        }
      }

      return {
        displayName: school.displayName,
        count: school.count,
        variants: school.variants,
        byBranch: branchBreakdown,
      }
    })

    // Build branch stats summary
    const byBranch = branches.map((b) => {
      let count = 0
      for (const [studentId, branchIds] of studentBranchMap) {
        if (branchIds.has(b.id)) {
          // Check if this student is in our filtered set
          const student = allStudents.find(s => s.id === studentId)
          if (student) count++
        }
      }
      return { branchId: b.id, branchName: b.name, count }
    }).filter(b => b.count > 0)

    return NextResponse.json({
      success: true,
      stats: {
        total: allStudents.length,
        active,
        inactive,
        byGender,
        byGradeLevel,
        bySchool: bySchoolWithBranches,
        byBranch,
        noSchool,
        noGrade,
      },
    })
  } catch (error) {
    console.error('Error in student report:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student report' },
      { status: 500 }
    )
  }
}

// lib/supabase/services/data-cleaning.ts

import { createServiceClient } from '../server'
import type { Student } from '@/types/models'

// ============================================
// Types
// ============================================
export interface OrphanedStudent extends Student {
  parentName: string
  canDelete: boolean
  hasEnrollments: boolean
}

export interface DataCleaningStats {
  totalParents: number
  totalStudents: number
  validStudents: number
  orphanedStudents: number
  orphanedMakeups: number
}

// ============================================
// Check Orphaned Students
// ============================================
export async function getOrphanedStudents(): Promise<OrphanedStudent[]> {
  const supabase = createServiceClient()

  try {
    console.time('getOrphanedStudents')

    // Get all parent IDs
    const { data: parents } = await supabase.from('parents').select('id')

    const validParentIds = new Set((parents || []).map(p => p.id))

    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')

    if (studentsError) throw studentsError

    // Find orphaned students
    const orphanedStudents: OrphanedStudent[] = []

    for (const student of students || []) {
      if (!student.parent_id || !validParentIds.has(student.parent_id)) {
        // Check if has enrollments
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', student.id)
          .limit(1)

        const hasEnrollments = (enrollments?.length || 0) > 0

        orphanedStudents.push({
          id: student.id,
          parentId: student.parent_id || 'unknown',
          name: student.name || 'Unknown',
          nickname: student.nickname || '-',
          birthdate: student.birthdate ? new Date(student.birthdate) : new Date(),
          gender: student.gender || 'M',
          schoolName: student.school_name,
          gradeLevel: student.grade_level,
          profileImage: student.profile_image,
          allergies: student.allergies,
          specialNeeds: student.special_needs,
          emergencyContact: student.emergency_contact,
          emergencyPhone: student.emergency_phone,
          isActive: student.is_active ?? true,
          parentName: 'ไม่พบผู้ปกครอง',
          canDelete: !hasEnrollments,
          hasEnrollments
        })
      }
    }

    console.timeEnd('getOrphanedStudents')
    return orphanedStudents
  } catch (error) {
    console.error('Error getting orphaned students:', error)
    throw error
  }
}

// ============================================
// Get Data Cleaning Stats
// ============================================
export async function getDataCleaningStats(): Promise<DataCleaningStats> {
  const supabase = createServiceClient()

  try {
    console.time('getDataCleaningStats')

    // Get counts in parallel
    const [parentsResult, studentsResult, makeupsResult, classesResult] = await Promise.all([
      supabase.from('parents').select('id', { count: 'exact' }),
      supabase.from('students').select('id, parent_id'),
      supabase.from('makeup_classes').select('id, original_class_id'),
      supabase.from('classes').select('id')
    ])

    const validParentIds = new Set((parentsResult.data || []).map(p => p.id))
    const students = studentsResult.data || []

    // Count orphaned students
    let orphanedCount = 0
    students.forEach(student => {
      if (!student.parent_id || !validParentIds.has(student.parent_id)) {
        orphanedCount++
      }
    })

    // Count orphaned makeups
    const validClassIds = new Set((classesResult.data || []).map(c => c.id))
    const makeups = makeupsResult.data || []

    let orphanedMakeupsCount = 0
    makeups.forEach(makeup => {
      if (makeup.original_class_id && !validClassIds.has(makeup.original_class_id)) {
        orphanedMakeupsCount++
      }
    })

    console.timeEnd('getDataCleaningStats')

    return {
      totalParents: parentsResult.count || 0,
      totalStudents: students.length,
      validStudents: students.length - orphanedCount,
      orphanedStudents: orphanedCount,
      orphanedMakeups: orphanedMakeupsCount
    }
  } catch (error) {
    console.error('Error getting data cleaning stats:', error)
    throw error
  }
}

// ============================================
// Delete Orphaned Student
// ============================================
export async function deleteOrphanedStudent(
  parentId: string,
  studentId: string
): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Double check has no enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .limit(1)

    if (enrollments && enrollments.length > 0) {
      throw new Error('ไม่สามารถลบนักเรียนที่มีประวัติการลงทะเบียนได้')
    }

    // Delete student document
    const { error } = await supabase.from('students').delete().eq('id', studentId)

    if (error) throw error

    console.log('Orphaned student deleted:', studentId)
  } catch (error) {
    console.error('Error deleting orphaned student:', error)
    throw error
  }
}

// ============================================
// Delete Orphaned Makeups
// ============================================
export async function deleteOrphanedMakeups(): Promise<number> {
  const supabase = createServiceClient()

  try {
    // Get all class IDs
    const { data: classes } = await supabase.from('classes').select('id')

    const validClassIds = new Set((classes || []).map(c => c.id))

    // Get all makeups
    const { data: makeups } = await supabase.from('makeup_classes').select('id, original_class_id')

    // Find orphaned makeups
    const orphanedIds: string[] = []
    ;(makeups || []).forEach(makeup => {
      if (makeup.original_class_id && !validClassIds.has(makeup.original_class_id)) {
        orphanedIds.push(makeup.id)
      }
    })

    if (orphanedIds.length === 0) return 0

    // Delete orphaned makeups
    const { error } = await supabase.from('makeup_classes').delete().in('id', orphanedIds)

    if (error) throw error

    console.log('Orphaned makeups deleted:', orphanedIds.length)
    return orphanedIds.length
  } catch (error) {
    console.error('Error deleting orphaned makeups:', error)
    throw error
  }
}

// ============================================
// Clean Up Expired Tokens
// ============================================
export async function cleanUpExpiredTokens(): Promise<number> {
  const supabase = createServiceClient()

  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('link_tokens')
      .delete()
      .lt('expires_at', now)
      .eq('used', false)
      .select('id')

    if (error) throw error

    return data?.length || 0
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error)
    return 0
  }
}

// ============================================
// Clean Up Old Notifications
// ============================================
export async function cleanUpOldNotifications(daysOld: number = 30): Promise<number> {
  const supabase = createServiceClient()

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .eq('is_read', true)
      .select('id')

    if (error) throw error

    return data?.length || 0
  } catch (error) {
    console.error('Error cleaning up old notifications:', error)
    return 0
  }
}

// ============================================
// Run Full Data Cleanup
// ============================================
export async function runFullCleanup(): Promise<{
  orphanedStudents: number
  orphanedMakeups: number
  expiredTokens: number
  oldNotifications: number
}> {
  try {
    const [orphanedMakeups, expiredTokens, oldNotifications] = await Promise.all([
      deleteOrphanedMakeups(),
      cleanUpExpiredTokens(),
      cleanUpOldNotifications()
    ])

    return {
      orphanedStudents: 0, // Don't auto-delete students
      orphanedMakeups,
      expiredTokens,
      oldNotifications
    }
  } catch (error) {
    console.error('Error running full cleanup:', error)
    throw error
  }
}

// lib/supabase/services/factory-reset.ts

import { createServiceClient } from '../server'

// Tables ที่ต้องล้าง (ไม่รวม settings)
const TABLES_TO_RESET = [
  'attendance',
  'makeup_classes',
  'class_schedules',
  'enrollments',
  'classes',
  'students',
  'parents',
  'trial_sessions',
  'trial_bookings',
  'notifications',
  'link_tokens',
  'holidays',
  'rooms',
  'teachers',
  'subjects',
  'branches'
]

// ลำดับที่ต้องลบ (เพื่อหลีกเลี่ยง FK constraints)
const DELETE_ORDER = [
  'attendance',
  'notifications',
  'link_tokens',
  'makeup_classes',
  'class_schedules',
  'enrollments',
  'trial_sessions',
  'trial_bookings',
  'classes',
  'students',
  'parents',
  'holidays',
  'rooms',
  'teachers',
  'subjects',
  'branches'
]

export interface ResetProgress {
  total: number
  current: number
  currentTable: string
  status: 'preparing' | 'deleting' | 'completed' | 'error'
  error?: string
}

// ฟังก์ชันล้างข้อมูลทั้งหมด
export async function factoryReset(
  onProgress?: (progress: ResetProgress) => void
): Promise<void> {
  const supabase = createServiceClient()

  try {
    // นับจำนวน records ทั้งหมดก่อน
    const totalCount = await countAllRecords()
    let currentCount = 0

    if (onProgress) {
      onProgress({
        total: totalCount,
        current: 0,
        currentTable: 'Preparing...',
        status: 'preparing'
      })
    }

    // ล้างแต่ละ table ตามลำดับ
    for (const tableName of DELETE_ORDER) {
      if (onProgress) {
        onProgress({
          total: totalCount,
          current: currentCount,
          currentTable: tableName,
          status: 'deleting'
        })
      }

      // ล้าง table
      const deletedCount = await deleteTable(tableName)
      currentCount += deletedCount

      console.log(`Deleted ${deletedCount} records from ${tableName}`)
    }

    if (onProgress) {
      onProgress({
        total: totalCount,
        current: totalCount,
        currentTable: 'Completed',
        status: 'completed'
      })
    }
  } catch (error) {
    console.error('Factory reset error:', error)

    if (onProgress) {
      onProgress({
        total: 0,
        current: 0,
        currentTable: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    throw error
  }
}

// นับจำนวน records ทั้งหมด
async function countAllRecords(): Promise<number> {
  const supabase = createServiceClient()
  let total = 0

  for (const tableName of TABLES_TO_RESET) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (!error && count !== null) {
        total += count
      }
    } catch (error) {
      console.warn(`Error counting ${tableName}:`, error)
    }
  }

  return total
}

// ล้าง table
async function deleteTable(tableName: string): Promise<number> {
  const supabase = createServiceClient()

  try {
    // Get count first
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (!count || count === 0) return 0

    // Delete all records - Supabase requires a filter
    // We use a condition that matches all records
    const { error } = await supabase.from(tableName).delete().gte('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      // Try alternative delete method
      const { error: error2 } = await supabase.from(tableName).delete().neq('id', '')

      if (error2) {
        console.error(`Error deleting from ${tableName}:`, error2)
        return 0
      }
    }

    return count
  } catch (error) {
    console.error(`Error deleting table ${tableName}:`, error)
    return 0
  }
}

// ตรวจสอบว่ามีข้อมูลหรือไม่
export async function hasAnyData(): Promise<boolean> {
  const supabase = createServiceClient()

  for (const tableName of TABLES_TO_RESET) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (!error && count && count > 0) {
        return true
      }
    } catch (error) {
      console.warn(`Error checking ${tableName}:`, error)
    }
  }

  return false
}

// ดึงสถิติข้อมูลปัจจุบัน
export async function getDataStatistics(): Promise<Record<string, number>> {
  const supabase = createServiceClient()
  const stats: Record<string, number> = {}

  for (const tableName of TABLES_TO_RESET) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        stats[tableName] = count || 0
      } else {
        stats[tableName] = 0
      }
    } catch (error) {
      stats[tableName] = 0
    }
  }

  return stats
}

// ลบข้อมูลเฉพาะ branch
export async function resetBranchData(branchId: string): Promise<{
  deleted: Record<string, number>
}> {
  const supabase = createServiceClient()
  const deleted: Record<string, number> = {}

  try {
    // Delete attendance for classes in this branch
    const { data: classes } = await supabase.from('classes').select('id').eq('branch_id', branchId)

    const classIds = (classes || []).map(c => c.id)

    if (classIds.length > 0) {
      // Get schedules for these classes
      const { data: schedules } = await supabase
        .from('class_schedules')
        .select('id')
        .in('class_id', classIds)

      const scheduleIds = (schedules || []).map(s => s.id)

      // Delete attendance
      if (scheduleIds.length > 0) {
        const { data } = await supabase
          .from('attendance')
          .delete()
          .in('schedule_id', scheduleIds)
          .select('id')

        deleted.attendance = data?.length || 0
      }

      // Delete schedules
      const { data: deletedSchedules } = await supabase
        .from('class_schedules')
        .delete()
        .in('class_id', classIds)
        .select('id')

      deleted.class_schedules = deletedSchedules?.length || 0

      // Delete enrollments
      const { data: deletedEnrollments } = await supabase
        .from('enrollments')
        .delete()
        .in('class_id', classIds)
        .select('id')

      deleted.enrollments = deletedEnrollments?.length || 0

      // Delete classes
      const { data: deletedClasses } = await supabase
        .from('classes')
        .delete()
        .eq('branch_id', branchId)
        .select('id')

      deleted.classes = deletedClasses?.length || 0
    }

    // Delete makeup classes for this branch
    const { data: deletedMakeups } = await supabase
      .from('makeup_classes')
      .delete()
      .eq('makeup_branch_id', branchId)
      .select('id')

    deleted.makeup_classes = deletedMakeups?.length || 0

    // Delete trial sessions for this branch
    const { data: deletedTrialSessions } = await supabase
      .from('trial_sessions')
      .delete()
      .eq('branch_id', branchId)
      .select('id')

    deleted.trial_sessions = deletedTrialSessions?.length || 0

    // Delete rooms for this branch
    const { data: deletedRooms } = await supabase.from('rooms').delete().eq('branch_id', branchId).select('id')

    deleted.rooms = deletedRooms?.length || 0

    // Delete holidays for this branch
    const { data: deletedHolidays } = await supabase
      .from('holidays')
      .delete()
      .contains('branches', [branchId])
      .select('id')

    deleted.holidays = deletedHolidays?.length || 0

    return { deleted }
  } catch (error) {
    console.error('Error resetting branch data:', error)
    throw error
  }
}

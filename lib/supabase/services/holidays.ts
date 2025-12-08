import { createServiceClient } from '../server'
import type {
  Holiday,
  InsertTables,
  UpdateTables,
  HolidayType
} from '@/types/supabase'

// ============================================
// GET HOLIDAYS
// ============================================

// Get holidays for a specific year
export async function getHolidays(year: number): Promise<Holiday[]> {
  const supabase = createServiceClient()

  const startOfYear = `${year}-01-01`
  const endOfYear = `${year}-12-31`

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', startOfYear)
    .lte('date', endOfYear)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error getting holidays:', error)
    return []
  }

  return data || []
}

// Get all holidays
export async function getAllHolidays(): Promise<Holiday[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    console.error('Error getting all holidays:', error)
    throw error
  }

  return data || []
}

// Get holidays for a specific branch and date range
export async function getHolidaysForBranch(
  branchId: string,
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  const supabase = createServiceClient()

  const startString = startDate.toISOString().split('T')[0]
  const endString = endDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', startString)
    .lte('date', endString)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error getting branch holidays:', error)
    return []
  }

  // Filter holidays that apply to this branch
  return (data || []).filter(holiday => {
    // National holidays apply to all branches
    if (holiday.type === 'national') return true
    // Branch-specific holidays
    return holiday.branches?.includes(branchId)
  })
}

// Get holidays by branch (current year)
export async function getHolidaysByBranch(branchId: string | null): Promise<Holiday[]> {
  const currentYear = new Date().getFullYear()
  const allHolidays = await getHolidays(currentYear)

  if (!branchId) {
    // Return all holidays if no branch specified (super admin)
    return allHolidays
  }

  // Filter holidays that apply to this branch
  return allHolidays.filter(holiday => {
    if (holiday.type === 'national') return true
    return holiday.branches?.includes(branchId)
  })
}

// Get holidays in date range
export async function getHolidaysInRange(
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  const supabase = createServiceClient()

  const startString = startDate.toISOString().split('T')[0]
  const endString = endDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', startString)
    .lte('date', endString)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error getting holidays in range:', error)
    throw error
  }

  return data || []
}

// Get holidays for calendar view
export async function getHolidaysForCalendar(
  year: number,
  month: number,
  branchId?: string
): Promise<Holiday[]> {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)

  if (branchId) {
    return getHolidaysForBranch(branchId, startDate, endDate)
  }

  return getHolidaysInRange(startDate, endDate)
}

// ============================================
// CRUD OPERATIONS
// ============================================

// Add new holiday
export async function addHoliday(
  holidayData: Omit<InsertTables<'holidays'>, 'id'>
): Promise<{ id: string }> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('holidays')
    .insert(holidayData)
    .select('id')
    .single()

  if (error) {
    console.error('Error adding holiday:', error)
    throw error
  }

  return { id: data.id }
}

// Update holiday
export async function updateHoliday(
  id: string,
  holidayData: Partial<UpdateTables<'holidays'>>
): Promise<void> {
  const supabase = createServiceClient()

  const { id: _, ...updateData } = holidayData as Holiday

  const { error } = await supabase
    .from('holidays')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating holiday:', error)
    throw error
  }
}

// Delete holiday
export async function deleteHoliday(id: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting holiday:', error)
    throw error
  }
}

// Delete all holidays for a specific year
export async function deleteAllHolidays(year: number): Promise<number> {
  const supabase = createServiceClient()

  const startOfYear = `${year}-01-01`
  const endOfYear = `${year}-12-31`

  const { data, error } = await supabase
    .from('holidays')
    .delete()
    .gte('date', startOfYear)
    .lte('date', endOfYear)
    .select('id')

  if (error) {
    console.error('Error deleting all holidays:', error)
    throw error
  }

  return data?.length || 0
}

// ============================================
// VALIDATION
// ============================================

// Check if holiday exists
export async function checkHolidayExists(
  date: Date,
  name?: string,
  branchId?: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()
  const dateString = date.toISOString().split('T')[0]

  let query = supabase
    .from('holidays')
    .select('id, name, type, branches')
    .eq('date', dateString)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('Error checking holiday exists:', error)
    return false
  }

  // Filter results
  const holidays = data.filter(holiday => {
    // If name is provided, check for exact name match
    if (name && holiday.name === name) return true

    // Check if it's the same branch or national holiday
    if (!branchId) {
      return true
    }

    if (holiday.type === 'national') return true
    if (holiday.branches?.includes(branchId)) return true

    return false
  })

  return holidays.length > 0
}

// Check if a specific date is a holiday for a branch
export async function isHoliday(
  date: Date,
  branchId: string
): Promise<boolean> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const holidays = await getHolidaysForBranch(branchId, startOfDay, endOfDay)
  return holidays.length > 0
}

// Get holiday for a specific date and branch
export async function getHolidayForDate(
  date: Date,
  branchId: string
): Promise<Holiday | null> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const holidays = await getHolidaysForBranch(branchId, startOfDay, endOfDay)
  return holidays.length > 0 ? holidays[0] : null
}

// ============================================
// BULK OPERATIONS
// ============================================

// Import holidays in bulk
export async function importHolidays(
  holidays: Array<Omit<InsertTables<'holidays'>, 'id'>>
): Promise<number> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('holidays')
    .insert(holidays)
    .select('id')

  if (error) {
    console.error('Error importing holidays:', error)
    throw error
  }

  return data?.length || 0
}

// Copy holidays from one year to another
export async function copyHolidaysToYear(
  fromYear: number,
  toYear: number
): Promise<number> {
  const holidays = await getHolidays(fromYear)
  const yearDiff = toYear - fromYear

  const newHolidays = holidays.map(holiday => {
    const oldDate = new Date(holiday.date)
    const newDate = new Date(oldDate)
    newDate.setFullYear(newDate.getFullYear() + yearDiff)

    return {
      name: holiday.name,
      date: newDate.toISOString().split('T')[0],
      type: holiday.type,
      branches: holiday.branches,
      description: holiday.description
    }
  })

  return importHolidays(newHolidays)
}

// ============================================
// STATISTICS
// ============================================

// Get holiday statistics for a year
export async function getHolidayStats(year: number): Promise<{
  total: number
  byType: Record<string, number>
  byMonth: Record<number, number>
}> {
  const holidays = await getHolidays(year)

  const stats = {
    total: holidays.length,
    byType: {} as Record<string, number>,
    byMonth: {} as Record<number, number>
  }

  for (const holiday of holidays) {
    // By type
    stats.byType[holiday.type] = (stats.byType[holiday.type] || 0) + 1

    // By month
    const month = new Date(holiday.date).getMonth() + 1
    stats.byMonth[month] = (stats.byMonth[month] || 0) + 1
  }

  return stats
}

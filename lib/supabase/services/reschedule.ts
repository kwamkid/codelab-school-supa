// lib/supabase/services/reschedule.ts

import { createServiceClient } from '../server'

// Generate schedule dates helper
async function generateScheduleDates(
  startDate: Date,
  daysOfWeek: number[],
  totalSessions: number,
  branchId: string
): Promise<Date[]> {
  const supabase = createServiceClient()
  const schedules: Date[] = []
  const currentDate = new Date(startDate.getTime())

  // Get all holidays for the branch
  const maxEndDate = new Date(startDate)
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 1) // ดูล่วงหน้า 1 ปี

  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', maxEndDate.toISOString().split('T')[0])

  // Create a Set of holiday dates for faster lookup
  const holidayDates = new Set(
    (holidays || [])
      .filter(h => h.type === 'national' || h.branches?.includes(branchId))
      .map(h => new Date(h.date).toDateString())
  )

  while (schedules.length < totalSessions) {
    const dayOfWeek = currentDate.getDay()

    // Check if it's a scheduled day and not a holiday
    if (daysOfWeek.includes(dayOfWeek) && !holidayDates.has(currentDate.toDateString())) {
      schedules.push(new Date(currentDate))
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return schedules
}

// Reschedule ทุกคลาสให้ตรงกับจำนวนครั้งที่กำหนด
export async function rescheduleAllClasses(): Promise<{
  processedCount: number
  details: { className: string; action: string }[]
}> {
  const supabase = createServiceClient()

  try {
    let processedCount = 0
    const details: { className: string; action: string }[] = []

    // ดึงคลาสทั้งหมดที่ active
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .in('status', ['published', 'started'])

    if (classError || !classes) {
      throw classError || new Error('No classes found')
    }

    console.log(`Found ${classes.length} active classes to reschedule`)

    for (const cls of classes) {
      console.log(`Processing class: ${cls.name}`)

      // ลบ schedules เดิมทั้งหมด
      const { data: existingSchedules } = await supabase
        .from('class_schedules')
        .select('id')
        .eq('class_id', cls.id)

      const existingCount = existingSchedules?.length || 0

      // Delete existing schedules
      const { error: deleteError } = await supabase
        .from('class_schedules')
        .delete()
        .eq('class_id', cls.id)

      if (deleteError) {
        console.error(`Error deleting schedules for ${cls.name}:`, deleteError)
        continue
      }

      console.log(`Deleted ${existingCount} existing schedules`)

      // สร้าง schedules ใหม่
      const newSchedules = await generateScheduleDates(
        new Date(cls.start_date),
        cls.days_of_week || [],
        cls.total_sessions || 0,
        cls.branch_id
      )

      console.log(`Generated ${newSchedules.length} new schedules`)

      // Insert new schedules
      const schedulesToInsert = newSchedules.map((date, index) => ({
        class_id: cls.id,
        session_date: date.toISOString().split('T')[0],
        session_number: index + 1,
        status: 'scheduled'
      }))

      if (schedulesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('class_schedules')
          .insert(schedulesToInsert)

        if (insertError) {
          console.error(`Error inserting schedules for ${cls.name}:`, insertError)
          continue
        }

        // อัพเดต endDate ให้ตรงกับวันสุดท้าย
        const newEndDate = newSchedules[newSchedules.length - 1]
        await supabase
          .from('classes')
          .update({ end_date: newEndDate.toISOString().split('T')[0] })
          .eq('id', cls.id)
      }

      processedCount++
      details.push({
        className: cls.name,
        action: `จัดตารางใหม่ ${newSchedules.length} ครั้ง (ตามที่กำหนด: ${cls.total_sessions} ครั้ง)`
      })
    }

    return { processedCount, details }
  } catch (error) {
    console.error('Error rescheduling all classes:', error)
    throw error
  }
}

// ตรวจสอบว่าเป็นวันหยุดหรือไม่
async function checkIfHoliday(date: Date, branchId: string): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    const dateStr = date.toISOString().split('T')[0]

    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .eq('date', dateStr)

    if (!holidays || holidays.length === 0) return false

    // ตรวจสอบว่ามีวันหยุดที่กระทบ branch นี้หรือไม่
    for (const holiday of holidays) {
      if (holiday.type === 'national' || holiday.branches?.includes(branchId)) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Error checking holiday:', error)
    return false
  }
}

// ดึงประวัติการ reschedule ของคลาส
export async function getRescheduleHistory(classId: string): Promise<any[]> {
  const supabase = createServiceClient()

  try {
    const { data: schedules, error } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('class_id', classId)
      .eq('status', 'rescheduled')
      .not('original_date', 'is', null)

    if (error) throw error

    return (schedules || []).map(s => ({
      id: s.id,
      classId: s.class_id,
      sessionDate: new Date(s.session_date),
      sessionNumber: s.session_number,
      status: s.status,
      originalDate: s.original_date ? new Date(s.original_date) : undefined,
      rescheduledAt: s.rescheduled_at ? new Date(s.rescheduled_at) : undefined,
      rescheduledBy: s.rescheduled_by,
      note: s.note
    }))
  } catch (error) {
    console.error('Error getting reschedule history:', error)
    return []
  }
}

// หาวันที่ว่างถัดไปสำหรับคลาส (สำหรับ reschedule แบบเดี่ยว)
export async function findNextAvailableDate(
  classId: string,
  fromDate: Date,
  maxDate: Date
): Promise<Date | null> {
  const supabase = createServiceClient()

  try {
    // Get class data
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single()

    if (classError || !cls) return null

    const currentDate = new Date(fromDate)
    currentDate.setDate(currentDate.getDate() + 1)

    // Get existing schedules for this class
    const { data: existingSchedules } = await supabase
      .from('class_schedules')
      .select('session_date')
      .eq('class_id', classId)

    const scheduledDates = new Set(
      (existingSchedules || []).map(s => new Date(s.session_date).toDateString())
    )

    // หาวันที่ตรงกับวันเรียนของคลาส
    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay()

      if (cls.days_of_week?.includes(dayOfWeek)) {
        // ตรวจสอบว่าไม่ใช่วันหยุด
        const isHolidayDate = await checkIfHoliday(currentDate, cls.branch_id)

        if (!isHolidayDate) {
          // ตรวจสอบว่าไม่มีคลาสอื่นในวันนี้แล้ว
          if (!scheduledDates.has(currentDate.toDateString())) {
            return new Date(currentDate)
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return null
  } catch (error) {
    console.error('Error finding next available date:', error)
    return null
  }
}

// Reschedule คลาสเดี่ยว
export async function rescheduleClass(
  classId: string,
  scheduleId: string,
  newDate: Date,
  reason: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Get current schedule
    const { data: currentSchedule, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !currentSchedule) {
      throw new Error('Schedule not found')
    }

    // Update schedule
    const { error: updateError } = await supabase
      .from('class_schedules')
      .update({
        session_date: newDate.toISOString().split('T')[0],
        status: 'rescheduled',
        original_date: currentSchedule.session_date,
        rescheduled_at: new Date().toISOString(),
        rescheduled_by: userId,
        note: reason
      })
      .eq('id', scheduleId)

    if (updateError) throw updateError
  } catch (error) {
    console.error('Error rescheduling class:', error)
    throw error
  }
}

// Cancel a schedule
export async function cancelSchedule(
  classId: string,
  scheduleId: string,
  reason: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  try {
    const { error } = await supabase
      .from('class_schedules')
      .update({
        status: 'cancelled',
        note: reason,
        rescheduled_at: new Date().toISOString(),
        rescheduled_by: userId
      })
      .eq('id', scheduleId)

    if (error) throw error
  } catch (error) {
    console.error('Error cancelling schedule:', error)
    throw error
  }
}

// Bulk reschedule for holiday
export async function rescheduleForHoliday(
  holidayDate: Date,
  branchId: string,
  userId: string
): Promise<{
  processedCount: number
  details: { className: string; action: string }[]
}> {
  const supabase = createServiceClient()

  try {
    let processedCount = 0
    const details: { className: string; action: string }[] = []

    const dateStr = holidayDate.toISOString().split('T')[0]

    // Find all schedules on the holiday date
    const { data: schedules, error: schedulesError } = await supabase
      .from('class_schedules')
      .select(`
        *,
        classes!inner (id, name, branch_id, days_of_week)
      `)
      .eq('session_date', dateStr)
      .eq('status', 'scheduled')

    if (schedulesError || !schedules) {
      return { processedCount: 0, details: [] }
    }

    // Filter by branch if specified
    const filteredSchedules = branchId
      ? schedules.filter(s => (s.classes as any).branch_id === branchId)
      : schedules

    for (const schedule of filteredSchedules) {
      const cls = schedule.classes as any
      const maxDate = new Date(holidayDate)
      maxDate.setMonth(maxDate.getMonth() + 3) // Look up to 3 months ahead

      const newDate = await findNextAvailableDate(cls.id, holidayDate, maxDate)

      if (newDate) {
        await rescheduleClass(cls.id, schedule.id, newDate, `เลื่อนจากวันหยุด ${dateStr}`, userId)
        processedCount++
        details.push({
          className: cls.name,
          action: `เลื่อนจาก ${dateStr} เป็น ${newDate.toISOString().split('T')[0]}`
        })
      } else {
        details.push({
          className: cls.name,
          action: `ไม่พบวันว่างสำหรับเลื่อน`
        })
      }
    }

    return { processedCount, details }
  } catch (error) {
    console.error('Error rescheduling for holiday:', error)
    throw error
  }
}

// Get schedules affected by a date (for holiday preview)
export async function getSchedulesOnDate(
  date: Date,
  branchId?: string
): Promise<
  {
    id: string
    classId: string
    className: string
    sessionNumber: number
    branchId: string
    branchName: string
  }[]
> {
  const supabase = createServiceClient()

  try {
    const dateStr = date.toISOString().split('T')[0]

    let query = supabase
      .from('class_schedules')
      .select(
        `
        id,
        session_number,
        classes!inner (
          id,
          name,
          branch_id,
          branches (id, name)
        )
      `
      )
      .eq('session_date', dateStr)
      .eq('status', 'scheduled')

    const { data, error } = await query

    if (error || !data) return []

    let results = data.map(s => {
      const cls = s.classes as any
      return {
        id: s.id,
        classId: cls.id,
        className: cls.name,
        sessionNumber: s.session_number,
        branchId: cls.branch_id,
        branchName: cls.branches?.name || ''
      }
    })

    // Filter by branch if specified
    if (branchId) {
      results = results.filter(r => r.branchId === branchId)
    }

    return results
  } catch (error) {
    console.error('Error getting schedules on date:', error)
    return []
  }
}

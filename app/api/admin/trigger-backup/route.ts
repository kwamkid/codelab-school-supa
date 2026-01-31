// app/api/admin/trigger-backup/route.ts

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ตารางทั้งหมดที่ต้อง backup
const TABLES_TO_BACKUP = [
  'branches',
  'rooms',
  'parents',
  'students',
  'teachers',
  'admin_users',
  'subjects',
  'classes',
  'class_schedules',
  'teaching_materials',
  'attendance',
  'enrollments',
  'enrollment_transfer_history',
  'trial_bookings',
  'trial_booking_students',
  'trial_sessions',
  'trial_reschedule_history',
  'makeup_classes',
  'events',
  'event_schedules',
  'event_registrations',
  'event_registration_parents',
  'event_registration_students',
  'notifications',
  'student_feedback',
  'promotions',
  'holidays',
  'settings',
]

// คำนวณสัปดาห์ของเดือน (1-4)
function getWeekOfMonth(): number {
  const now = new Date()
  const day = now.getDate()
  const week = Math.ceil(day / 7)
  return Math.min(week, 4)
}

export async function POST() {
  const startTime = Date.now()
  console.log('\n=== Starting manual database backup ===')
  console.log('Thailand Time:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))

  const supabase = createServiceClient()
  const weekNumber = getWeekOfMonth()
  const fileName = `backup_week_${weekNumber}.json`

  try {
    // ดึงข้อมูลทุกตาราง
    const backupData: Record<string, { count: number; data: unknown[] }> = {}
    let totalRows = 0
    let tablesCount = 0

    for (const table of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')

        if (error) {
          console.error(`[Backup] Error fetching ${table}:`, error.message)
          backupData[table] = { count: 0, data: [] }
        } else {
          const rows = data || []
          backupData[table] = { count: rows.length, data: rows }
          totalRows += rows.length
          tablesCount++
          console.log(`[Backup] ${table}: ${rows.length} rows`)
        }
      } catch (err) {
        console.error(`[Backup] Exception on ${table}:`, err)
        backupData[table] = { count: 0, data: [] }
      }
    }

    // สร้าง JSON backup
    const backupJson = JSON.stringify({
      metadata: {
        created_at: new Date().toISOString(),
        week_number: weekNumber,
        tables_count: tablesCount,
        total_rows: totalRows,
      },
      tables: backupData,
    })

    const fileSizeBytes = new Blob([backupJson]).size

    // Upload ไป Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, backupJson, {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const durationMs = Date.now() - startTime

    // บันทึก log
    await supabase.from('backup_logs').insert({
      file_name: fileName,
      status: 'success',
      tables_count: tablesCount,
      total_rows: totalRows,
      file_size_bytes: fileSizeBytes,
      duration_ms: durationMs,
    })

    console.log(`[Backup] Complete! File: ${fileName}, Size: ${(fileSizeBytes / 1024).toFixed(1)} KB, Duration: ${durationMs}ms`)

    return NextResponse.json({
      success: true,
      file_name: fileName,
      tables_count: tablesCount,
      total_rows: totalRows,
      file_size_bytes: fileSizeBytes,
      duration_ms: durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Backup] Failed:', errorMessage)

    // บันทึก log แม้ fail
    await supabase.from('backup_logs').insert({
      file_name: fileName,
      status: 'failed',
      duration_ms: durationMs,
      error_message: errorMessage,
    })

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration_ms: durationMs,
    }, { status: 500 })
  }
}

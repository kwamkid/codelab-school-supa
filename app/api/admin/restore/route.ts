// app/api/admin/restore/route.ts

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ลำดับการลบ (leaf → root เพื่อหลีกเลี่ยง FK constraints)
const DELETE_ORDER = [
  'student_feedback',
  'notifications',
  'event_registration_students',
  'event_registration_parents',
  'event_registrations',
  'event_schedules',
  'events',
  'enrollment_transfer_history',
  'makeup_classes',
  'trial_reschedule_history',
  'trial_sessions',
  'trial_booking_students',
  'trial_bookings',
  'attendance',
  'enrollments',
  'class_schedules',
  'teaching_materials',
  'classes',
  'students',
  'admin_users',
  'rooms',
  'parents',
  'teachers',
  'subjects',
  'branches',
  'holidays',
  'promotions',
  'settings',
]

// ลำดับการ insert (root → leaf ตาม FK dependencies)
const INSERT_ORDER = [
  'branches',
  'subjects',
  'teachers',
  'parents',
  'settings',
  'holidays',
  'promotions',
  'admin_users',
  'rooms',
  'students',
  'classes',
  'teaching_materials',
  'class_schedules',
  'enrollments',
  'attendance',
  'trial_bookings',
  'trial_booking_students',
  'trial_sessions',
  'trial_reschedule_history',
  'makeup_classes',
  'enrollment_transfer_history',
  'events',
  'event_schedules',
  'event_registrations',
  'event_registration_parents',
  'event_registration_students',
  'notifications',
  'student_feedback',
]

// ตารางที่ต้อง backup ก่อน restore (safety backup)
const TABLES_TO_BACKUP = [
  'branches', 'rooms', 'parents', 'students', 'teachers', 'admin_users',
  'subjects', 'classes', 'class_schedules', 'teaching_materials', 'attendance',
  'enrollments', 'enrollment_transfer_history', 'trial_bookings',
  'trial_booking_students', 'trial_sessions', 'trial_reschedule_history',
  'makeup_classes', 'events', 'event_schedules', 'event_registrations',
  'event_registration_parents', 'event_registration_students', 'notifications',
  'student_feedback', 'promotions', 'holidays', 'settings',
]

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function deleteTable(supabase: ReturnType<typeof createClient>, tableName: string): Promise<number> {
  try {
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (!count || count === 0) return 0

    const { error } = await supabase
      .from(tableName)
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      const { error: error2 } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '')

      if (error2) {
        throw new Error(`Delete ${tableName}: ${error2.message}`)
      }
    }

    return count
  } catch (err) {
    console.error(`[Restore] Delete error on ${tableName}:`, err)
    throw err
  }
}

async function upsertInChunks(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  rows: Record<string, unknown>[],
  chunkSize = 500
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0
  const errors: string[] = []

  // admin_users: set auth_user_id = null (FK ไป auth.users ที่ไม่ได้ backup)
  if (tableName === 'admin_users') {
    rows = rows.map(row => ({ ...row, auth_user_id: null }))
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)

    const { error } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false })

    if (error) {
      errors.push(`${tableName}[${i}-${i + chunk.length}]: ${error.message}`)
    } else {
      inserted += chunk.length
    }
  }

  return { inserted, errors }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { fileName } = await request.json()

    if (!fileName || !/^backup_week_[1-4]\.json$/.test(fileName)) {
      return Response.json({ error: 'Invalid file name' }, { status: 400 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        const supabase = getSupabase()

        try {
          // === Phase 1: Download backup ===
          send({ phase: 'download', status: 'in_progress', message: 'กำลังดาวน์โหลดไฟล์ backup...' })

          const { data: fileData, error: downloadError } = await supabase.storage
            .from('backups')
            .download(fileName)

          if (downloadError || !fileData) {
            send({ phase: 'download', status: 'error', error: downloadError?.message || 'File not found' })
            controller.close()
            return
          }

          const backupText = await fileData.text()
          const backup = JSON.parse(backupText)
          send({ phase: 'download', status: 'complete', metadata: backup.metadata })

          // === Phase 2: Safety backup ===
          send({ phase: 'safety_backup', status: 'in_progress', message: 'กำลังสร้าง Safety Backup...' })

          try {
            const safetyData: Record<string, { count: number; data: unknown[] }> = {}
            let safetyTotalRows = 0
            let safetyTablesCount = 0

            for (const table of TABLES_TO_BACKUP) {
              const { data, error } = await supabase.from(table).select('*')
              if (!error && data) {
                safetyData[table] = { count: data.length, data }
                safetyTotalRows += data.length
                safetyTablesCount++
              } else {
                safetyData[table] = { count: 0, data: [] }
              }
            }

            const safetyJson = JSON.stringify({
              metadata: {
                created_at: new Date().toISOString(),
                week_number: 0,
                tables_count: safetyTablesCount,
                total_rows: safetyTotalRows,
                type: 'pre_restore_safety',
              },
              tables: safetyData,
            })

            await supabase.storage
              .from('backups')
              .upload('backup_pre_restore.json', safetyJson, {
                contentType: 'application/json',
                upsert: true,
              })

            send({ phase: 'safety_backup', status: 'complete', message: 'Safety Backup สำเร็จ' })
          } catch (safetyErr) {
            send({ phase: 'safety_backup', status: 'warning', message: 'Safety Backup ล้มเหลว แต่จะดำเนินการ restore ต่อ' })
          }

          // === Phase 3: Delete existing data ===
          const totalDeleteTables = DELETE_ORDER.length
          let deleteProgress = 0

          for (const table of DELETE_ORDER) {
            send({
              phase: 'delete',
              table,
              status: 'in_progress',
              progress: deleteProgress,
              total: totalDeleteTables,
              message: `กำลังลบข้อมูล ${table}...`
            })

            try {
              const deletedCount = await deleteTable(supabase, table)
              deleteProgress++
              send({
                phase: 'delete',
                table,
                status: 'complete',
                deletedCount,
                progress: deleteProgress,
                total: totalDeleteTables,
              })
            } catch (err) {
              deleteProgress++
              send({
                phase: 'delete',
                table,
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown error',
                progress: deleteProgress,
                total: totalDeleteTables,
              })
            }
          }

          // === Phase 4: Insert backup data ===
          const totalInsertTables = INSERT_ORDER.length
          let insertProgress = 0
          let totalRowsRestored = 0
          let tablesRestored = 0
          const allErrors: string[] = []

          for (const table of INSERT_ORDER) {
            const tableData = backup.tables?.[table]
            const rows = tableData?.data || []

            send({
              phase: 'insert',
              table,
              status: 'in_progress',
              rowCount: rows.length,
              progress: insertProgress,
              total: totalInsertTables,
              message: `กำลัง restore ${table} (${rows.length} rows)...`
            })

            if (rows.length === 0) {
              insertProgress++
              send({
                phase: 'insert',
                table,
                status: 'complete',
                inserted: 0,
                progress: insertProgress,
                total: totalInsertTables,
              })
              tablesRestored++
              continue
            }

            const { inserted, errors } = await upsertInChunks(supabase, table, rows)
            totalRowsRestored += inserted
            insertProgress++

            if (errors.length > 0) {
              allErrors.push(...errors)
              send({
                phase: 'insert',
                table,
                status: 'warning',
                inserted,
                errors,
                progress: insertProgress,
                total: totalInsertTables,
              })
            } else {
              send({
                phase: 'insert',
                table,
                status: 'complete',
                inserted,
                progress: insertProgress,
                total: totalInsertTables,
              })
            }

            tablesRestored++
          }

          // === Phase 5: Log restore ===
          const durationMs = Date.now() - startTime

          await supabase.from('backup_logs').insert({
            file_name: fileName,
            status: 'restored',
            tables_count: tablesRestored,
            total_rows: totalRowsRestored,
            file_size_bytes: 0,
            duration_ms: durationMs,
            error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
          })

          send({
            phase: 'complete',
            status: allErrors.length > 0 ? 'partial' : 'success',
            tablesRestored,
            totalRowsRestored,
            durationMs,
            errors: allErrors,
            message: allErrors.length > 0
              ? `Restore เสร็จสิ้น (บางตารางมี error)`
              : `Restore สำเร็จ! ${tablesRestored} ตาราง, ${totalRowsRestored.toLocaleString()} rows`
          })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          console.error('[Restore] Fatal error:', errorMessage)

          const durationMs = Date.now() - startTime
          const supabase2 = getSupabase()
          await supabase2.from('backup_logs').insert({
            file_name: fileName,
            status: 'failed',
            duration_ms: durationMs,
            error_message: `Restore failed: ${errorMessage}`,
          }).catch(() => {})

          send({
            phase: 'error',
            status: 'error',
            error: errorMessage,
            durationMs: Date.now() - startTime,
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

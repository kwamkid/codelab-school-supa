import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Whitelist of tables that can be mutated via this endpoint
const ALLOWED_TABLES = [
  'branches',
  'rooms',
  'teachers',
  'subjects',
  'settings',
  'classes',
  'class_schedules',
  'enrollments',
  'trial_bookings',
  'trial_booking_students',
  'trial_sessions',
  'makeup_classes',
  'events',
  'event_schedules',
  'event_registrations',
  'holidays',
  'parents',
  'students',
  'admin_users',
  'attendance',
  'teaching_materials',
  'notifications',
  'link_tokens',
  'enrollment_transfer_history',
  'audit_logs',
  'trial_reschedule_history',
  'payment_transactions',
  'branch_payment_settings',
  'invoice_companies',
  'invoices',
  'credit_notes',
]

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const { table, operation, data, match, filters, options } = body

    // Validate table
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { error: `Table "${table}" is not allowed` },
        { status: 400 }
      )
    }

    // Validate operation
    if (!['insert', 'update', 'delete', 'upsert'].includes(operation)) {
      return NextResponse.json(
        { error: `Invalid operation "${operation}"` },
        { status: 400 }
      )
    }

    // Build query
    let query: any

    switch (operation) {
      case 'insert':
        query = supabase.from(table).insert(data)
        break
      case 'update':
        query = supabase.from(table).update(data)
        break
      case 'delete':
        query = supabase.from(table).delete()
        break
      case 'upsert':
        query = supabase.from(table).upsert(data,
          options?.onConflict ? { onConflict: options.onConflict } : undefined
        )
        break
    }

    // Apply simple .eq() match conditions
    if (match) {
      for (const [key, value] of Object.entries(match)) {
        query = query.eq(key, value)
      }
    }

    // Apply advanced filters (gte, lte, in, neq, etc.)
    if (filters && Array.isArray(filters)) {
      for (const f of filters) {
        switch (f.op) {
          case 'eq': query = query.eq(f.column, f.value); break
          case 'neq': query = query.neq(f.column, f.value); break
          case 'gt': query = query.gt(f.column, f.value); break
          case 'gte': query = query.gte(f.column, f.value); break
          case 'lt': query = query.lt(f.column, f.value); break
          case 'lte': query = query.lte(f.column, f.value); break
          case 'in': query = query.in(f.column, f.value); break
          case 'is': query = query.is(f.column, f.value); break
        }
      }
    }

    // Apply select
    if (options?.select) {
      query = query.select(
        typeof options.select === 'string' ? options.select : undefined
      )
    }

    // Apply single
    if (options?.single) {
      query = query.single()
    }

    const { data: result, error } = await query

    if (error) {
      console.error(`[admin/mutation] ${operation} on ${table}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[admin/mutation] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

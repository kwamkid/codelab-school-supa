// app/api/admin/data-cleaning/route.ts
// Server wrapper around the server-only data-cleaning service (uses service role).
// GET  ?action=stats     → getDataCleaningStats()
// GET  ?action=orphaned  → getOrphanedStudents()
// POST { parentId, studentId } → deleteOrphanedStudent()

import { NextRequest, NextResponse } from 'next/server'
import {
  getDataCleaningStats,
  getOrphanedStudents,
  deleteOrphanedStudent,
} from '@/lib/supabase/services/data-cleaning'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action')
  try {
    if (action === 'stats') {
      return NextResponse.json(await getDataCleaningStats())
    }
    if (action === 'orphaned') {
      return NextResponse.json(await getOrphanedStudents())
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { parentId, studentId } = await request.json()
    if (!parentId || !studentId) {
      return NextResponse.json({ error: 'parentId and studentId are required' }, { status: 400 })
    }
    await deleteOrphanedStudent(parentId, studentId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

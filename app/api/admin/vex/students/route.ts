// app/api/admin/vex/students/route.ts
// GET ?q= → search active public.students for the "add students to team" picker.
// Returns nickname + full name + school + grade so the admin can pick the right
// one. Read-only access to public.students (allowed by the golden rule).

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/vex/api'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()

  try {
    const params: Record<string, string> = {
      select: 'id,name,nickname,school_name,grade_level,student_code',
      is_active: 'eq.true',
      order: 'nickname.asc',
      limit: '50',
    }
    // PostgREST OR-ilike across the useful fields.
    if (q) {
      const like = `*${q}*`
      params.or = `(nickname.ilike.${like},name.ilike.${like},school_name.ilike.${like},student_code.ilike.${like})`
    }

    const rows = await restSelect<{
      id: string
      name: string | null
      nickname: string | null
      school_name: string | null
      grade_level: string | null
      student_code: string | null
    }>('students', params)

    return NextResponse.json({ students: rows || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

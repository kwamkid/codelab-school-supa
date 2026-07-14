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

    // Enrich each student with the subject names they're enrolled in
    // (student → enrollments → classes.subject_id → subjects.name).
    const studentIds = (rows || []).map((s) => s.id)
    const coursesByStudent = new Map<string, string[]>()
    if (studentIds.length) {
      const enrollments = await restSelect<{ student_id: string; class_id: string; status: string }>(
        'enrollments',
        { select: 'student_id,class_id,status', student_id: `in.(${studentIds.join(',')})` }
      )
      const active = (enrollments || []).filter((e) => e.status !== 'dropped')
      const classIds = Array.from(new Set(active.map((e) => e.class_id).filter(Boolean)))
      const subjectByClass = new Map<string, string>()
      if (classIds.length) {
        const classes = await restSelect<{ id: string; subject_id: string | null }>('classes', {
          select: 'id,subject_id',
          id: `in.(${classIds.join(',')})`,
        })
        const subjectIds = Array.from(new Set((classes || []).map((c) => c.subject_id).filter(Boolean)))
        const subjectName = new Map<string, string>()
        if (subjectIds.length) {
          const subjects = await restSelect<{ id: string; name: string }>('subjects', {
            select: 'id,name',
            id: `in.(${subjectIds.join(',')})`,
          })
          for (const s of subjects || []) subjectName.set(s.id, s.name)
        }
        for (const c of classes || []) {
          if (c.subject_id) subjectByClass.set(c.id, subjectName.get(c.subject_id) || '')
        }
      }
      for (const e of active) {
        const name = subjectByClass.get(e.class_id)
        if (!name) continue
        const arr = coursesByStudent.get(e.student_id) || []
        if (!arr.includes(name)) arr.push(name)
        coursesByStudent.set(e.student_id, arr)
      }
    }

    const students = (rows || []).map((s) => ({ ...s, courses: coursesByStudent.get(s.id) || [] }))
    return NextResponse.json({ students })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

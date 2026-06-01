import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET ?classId= — enrolled students of a class (staff). Used by the scores page
// to show a class roster + each student's quiz scores.
export async function GET(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const classId = new URL(request.url).searchParams.get('classId')
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 })

  try {
    const rows = await restSelect<any>('enrollments', {
      class_id: `eq.${classId}`,
      select: 'student_id,status,student:students(id,name,nickname,student_code,school_name)',
    })
    const seen = new Set<string>()
    const students = [] as any[]
    for (const r of rows) {
      const s = r.student
      if (s && !seen.has(s.id) && r.status !== 'cancelled' && r.status !== 'dropped') {
        seen.add(s.id)
        students.push(s)
      }
    }
    return NextResponse.json(students)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

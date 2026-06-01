import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET — quiz scores (staff). Filters: ?student= &quizId= &school= &studentId= &from= &to=
// This powers requirement B1 (view student scores, talent-spotting).
export async function GET(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const params: Record<string, string> = { select: '*', order: 'created_at.desc' }
  const student = searchParams.get('student')
  const quizId = searchParams.get('quizId')
  const school = searchParams.get('school')
  const studentId = searchParams.get('studentId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (student) params.student_name = `ilike.*${student}*`
  if (quizId) params.quiz_id = `eq.${quizId}`
  if (school) params.school_name = `ilike.*${school}*`
  if (studentId) params.student_id = `eq.${studentId}`
  if (from) params['created_at'] = `gte.${from}`
  // (single created_at key supports one bound; for a range use the dedicated reporting view later)
  if (to && !from) params['created_at'] = `lte.${to}`

  try {
    const rows = await restSelect('quiz_results', params)
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

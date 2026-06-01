import { NextRequest, NextResponse } from 'next/server'
import { restSelect } from '@/lib/supabase/rest'
import { resolveSchoolName } from '@/lib/server/resolve-school'

export const dynamic = 'force-dynamic'

const norm = (s: any) => String(s ?? '').trim().toLowerCase()

// POST { code, school } — public: a student fetches THEIR OWN quiz history
// (verified by code + school, same as login).
export async function POST(request: NextRequest) {
  try {
    const { code, school } = await request.json()
    if (!code || !school) return NextResponse.json({ error: 'กรุณากรอกรหัสและโรงเรียน' }, { status: 400 })

    const students = await restSelect<any>('students', {
      student_code: `ilike.${String(code).trim()}`,
      select: 'id,student_code,name,nickname,school_name,is_active',
      limit: '1',
    })
    const s = students?.[0]
    const resolved = await resolveSchoolName(school)
    const schoolOk = s && (norm(s.school_name) === norm(resolved) || norm(s.school_name) === norm(school))
    if (!s || s.is_active === false || !schoolOk) {
      return NextResponse.json({ error: 'ไม่พบรหัสนักเรียนนี้ หรือโรงเรียนไม่ตรง' }, { status: 404 })
    }

    const results = await restSelect('quiz_results', {
      student_id: `eq.${s.id}`,
      select: 'id,quiz_title_th,quiz_title,emoji,score,max_score,percentage,total_questions,total_time,created_at',
      order: 'created_at.desc',
    })

    return NextResponse.json({
      student: { name: s.name, nickname: s.nickname, studentCode: s.student_code },
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

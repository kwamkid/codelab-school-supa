import { NextRequest, NextResponse } from 'next/server'
import { restSelect } from '@/lib/supabase/rest'
import { resolveSchoolName } from '@/lib/server/resolve-school'

export const dynamic = 'force-dynamic'

const norm = (s: any) => String(s ?? '').trim().toLowerCase()

// POST { code, school } — public lightweight student "login" for quizzes.
// Looks up the student by code, then requires the selected school to match
// the student's school_name. Returns minimal student info on success.
export async function POST(request: NextRequest) {
  try {
    const { code, school } = await request.json()
    if (!code || !school) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกรหัสนักเรียนและเลือกโรงเรียน' }, { status: 400 })
    }

    const rows = await restSelect<any>('students', {
      student_code: `ilike.${String(code).trim()}`,
      select: 'id,student_code,name,nickname,school_name,is_active',
      limit: '1',
    })
    const s = rows?.[0]

    // accept full name / English / abbreviation / alias by resolving to canonical
    const resolved = await resolveSchoolName(school)
    const schoolOk = s && (norm(s.school_name) === norm(resolved) || norm(s.school_name) === norm(school))
    if (!s || s.is_active === false || !schoolOk) {
      return NextResponse.json({ ok: false, error: 'ไม่พบรหัสนักเรียนนี้ หรือโรงเรียนไม่ตรง' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      student: {
        id: s.id,
        studentCode: s.student_code,
        name: s.name,
        nickname: s.nickname,
        schoolName: s.school_name,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

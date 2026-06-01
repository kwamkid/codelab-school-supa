import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect, restInsert } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET — list quizzes (meta only; no questions/answers). Optional ?category= & ?active=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params: Record<string, string> = {
    select: '*,category:quiz_categories(name),questions:quiz_questions(count)',
    order: 'created_at.desc',
  }
  const category = searchParams.get('category')
  if (category) params.category_id = `eq.${category}`
  if (searchParams.get('active') === 'true') params.is_active = 'eq.true'

  try {
    const rows = await restSelect<any>('quizzes', params)
    const mapped = (rows || []).map((r) => ({
      ...r,
      categoryName: r.category?.name ?? null,
      questionCount: r.questions?.[0]?.count ?? 0,
    }))
    return NextResponse.json(mapped)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — create quiz with questions (staff)
export async function POST(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { titleTh, titleEn, icon, difficulty, categoryId, isActive, questionCount, questions = [] } = body
    const title = titleTh || body.title
    if (!title) return NextResponse.json({ error: 'กรุณาระบุชื่อข้อสอบ' }, { status: 400 })

    const [quiz] = await restInsert<{ id: string }>('quizzes', {
      title,
      title_th: titleTh || title,
      title_en: titleEn || null,
      icon: icon || 'FileText',
      difficulty: difficulty || 'ปานกลาง',
      category_id: categoryId || null,
      question_count: questionCount && questionCount > 0 ? questionCount : null,
      is_active: isActive !== false,
      created_by: auth.adminId,
    })

    if (Array.isArray(questions) && questions.length > 0) {
      const rows = questions.map((q: any, i: number) => ({
        quiz_id: quiz.id,
        sort_order: q.sortOrder ?? i + 1,
        question_th: q.questionTh ?? q.question ?? null,
        question_en: q.questionEn ?? null,
        options: q.options ?? q.optionsTh ?? [],
        options_th: q.optionsTh ?? q.options ?? [],
        options_en: q.optionsEn ?? [],
        correct_answer: q.correctAnswer ?? 0,
        points: q.points ?? 10,
        competency: q.competency ?? null,
      }))
      await restInsert('quiz_questions', rows)
    }

    return NextResponse.json({ id: quiz.id })
  } catch (err: any) {
    console.error('[quiz] create error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect, restInsert, restPatch, restDelete } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET — full quiz incl. questions WITH correct_answer (staff, for editing)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    const quizzes = await restSelect('quizzes', { id: `eq.${id}`, select: '*', limit: '1' })
    const quiz = quizzes?.[0]
    if (!quiz) return NextResponse.json({ error: 'ไม่พบข้อสอบ' }, { status: 404 })
    const questions = await restSelect('quiz_questions', {
      quiz_id: `eq.${id}`,
      select: '*',
      order: 'sort_order.asc',
    })
    return NextResponse.json({ quiz, questions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update quiz fields; if `questions` provided, replace them wholesale (staff)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    const body = await request.json()
    const data: Record<string, any> = {}
    if (body.titleTh !== undefined) { data.title = body.titleTh; data.title_th = body.titleTh }
    if (body.titleEn !== undefined) data.title_en = body.titleEn
    if (body.icon !== undefined) data.icon = body.icon
    if (body.questionCount !== undefined) data.question_count = body.questionCount && body.questionCount > 0 ? body.questionCount : null
    if (body.difficulty !== undefined) data.difficulty = body.difficulty
    if (body.categoryId !== undefined) data.category_id = body.categoryId
    if (body.isActive !== undefined) data.is_active = body.isActive
    if (Object.keys(data).length > 0) {
      await restPatch('quizzes', { id: `eq.${id}` }, data)
    }

    if (Array.isArray(body.questions)) {
      await restDelete('quiz_questions', { quiz_id: `eq.${id}` })
      if (body.questions.length > 0) {
        const rows = body.questions.map((q: any, i: number) => ({
          quiz_id: id,
          sort_order: q.sortOrder ?? i + 1,
          question_th: q.questionTh ?? q.question ?? null,
          question_en: q.questionEn ?? null,
          options: q.options ?? q.optionsTh ?? [],
          options_th: q.optionsTh ?? q.options ?? [],
          options_en: q.optionsEn ?? [],
          correct_answer: q.correctAnswer ?? 0,
          points: q.points ?? 10,
          competency: q.competency ?? null,
          image_url: q.imageUrl ?? null,
        }))
        await restInsert('quiz_questions', rows)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[quiz] update error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove quiz (questions cascade) (staff)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    await restDelete('quizzes', { id: `eq.${id}` })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

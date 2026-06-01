import { NextRequest, NextResponse } from 'next/server'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// POST { questionId, selected } — public: reveal correctness for ONE question
// after the student has answered it (enables immediate feedback). The student has
// already committed `selected`, so revealing that question's answer is fine.
export async function POST(request: NextRequest) {
  try {
    const { questionId, selected } = await request.json()
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })
    const rows = await restSelect<any>('quiz_questions', {
      id: `eq.${questionId}`,
      select: 'correct_answer',
      limit: '1',
    })
    const q = rows?.[0]
    if (!q) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ correctAnswer: q.correct_answer, isCorrect: selected === q.correct_answer })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET — public: quiz meta + questions WITHOUT correct_answer (for taking).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const quizzes = await restSelect('quizzes', { id: `eq.${id}`, select: '*', limit: '1' })
    const quiz = quizzes?.[0]
    if (!quiz || quiz.is_active === false) {
      return NextResponse.json({ error: 'ไม่พบแบบทดสอบ' }, { status: 404 })
    }
    // NOTE: deliberately omit correct_answer
    const questions = await restSelect('quiz_questions', {
      quiz_id: `eq.${id}`,
      select: 'id,sort_order,question,question_th,question_en,options,options_th,options_en,points',
      order: 'sort_order.asc',
    })
    return NextResponse.json({ quiz, questions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { restSelect, restInsert } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// POST — public: grade the attempt SERVER-SIDE (answers are never trusted from client)
// Body: { quizId, studentId?, studentCode?, studentName, schoolName?,
//         answers: [{questionId, selected, timeSpent}], totalTime, originalTotalQuestions? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quizId, studentId, studentCode, studentName, schoolName, answers = [], totalTime = 0, originalTotalQuestions } = body
    if (!quizId || !studentName || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    }

    // Authoritative question data (with correct_answer + points)
    const questions = await restSelect<any>('quiz_questions', {
      quiz_id: `eq.${quizId}`,
      select: 'id,correct_answer,points',
    })
    const qMap = new Map(questions.map((q) => [q.id, q]))

    let score = 0
    let maxScore = 0
    const graded = answers.map((a: any) => {
      const q = qMap.get(a.questionId)
      const points = q?.points ?? 0
      maxScore += points
      const isCorrect = !!q && a.selected === q.correct_answer
      const pointsEarned = isCorrect ? points : 0
      score += pointsEarned
      return {
        questionId: a.questionId,
        selected: a.selected ?? null,
        timeSpent: a.timeSpent ?? 0,
        correctAnswer: q?.correct_answer ?? null,
        isCorrect,
        pointsEarned,
      }
    })

    const totalQuestions = answers.length
    const percentage = maxScore ? Math.round((score / maxScore) * 10000) / 100 : 0

    // Quiz snapshot for the result row
    const quizzes = await restSelect<any>('quizzes', { id: `eq.${quizId}`, select: '*', limit: '1' })
    const quiz = quizzes?.[0] || {}

    // derive the student's branch from their latest enrollment (for per-branch analytics)
    let branchId: string | null = null
    let branchName: string | null = null
    if (studentId) {
      try {
        const enr = await restSelect<any>('enrollments', {
          student_id: `eq.${studentId}`,
          select: 'branch_id,enrolled_at',
          order: 'enrolled_at.desc',
          limit: '1',
        })
        branchId = enr?.[0]?.branch_id || null
        if (branchId) {
          const b = await restSelect<any>('branches', { id: `eq.${branchId}`, select: 'name', limit: '1' })
          branchName = b?.[0]?.name || null
        }
      } catch { /* non-fatal */ }
    }

    const [result] = await restInsert<{ id: string }>('quiz_results', {
      student_id: studentId || null,
      student_code: studentCode || null,
      student_name: studentName,
      school_name: schoolName || null,
      branch_id: branchId,
      branch_name: branchName,
      quiz_id: quizId,
      quiz_title: quiz.title || null,
      quiz_title_th: quiz.title_th || null,
      quiz_title_en: quiz.title_en || null,
      emoji: quiz.icon || null,   // snapshot the quiz icon name (no emoji)
      difficulty: quiz.difficulty || null,
      score,
      max_score: maxScore,
      percentage,
      total_questions: totalQuestions,
      selected_question_count: totalQuestions,
      original_total_questions: originalTotalQuestions ?? totalQuestions,
      total_time: totalTime,
      answers: graded,
    })

    return NextResponse.json({ resultId: result.id, score, maxScore, percentage, gradedAnswers: graded })
  } catch (err: any) {
    console.error('[quiz] submit error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

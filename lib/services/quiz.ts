// Client service for the quiz system. Wraps the /api/quiz/* routes.
import { getClient } from '@/lib/supabase/client'
import type { QuizQuestionPublic, StudentLite, SubmittedAnswer } from '@/types/quiz'

async function authToken(): Promise<string> {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No auth session')
  return session.access_token
}

async function staffFetch(url: string, init: RequestInit = {}) {
  const token = await authToken()
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

// ---------- Public (student) ----------

export async function verifyStudent(code: string, school: string): Promise<StudentLite> {
  const res = await fetch('/api/quiz/verify-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, school }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) throw new Error(json.error || 'ไม่สามารถยืนยันตัวตนได้')
  return json.student
}

export async function getQuizForTaking(quizId: string): Promise<{ quiz: any; questions: QuizQuestionPublic[] }> {
  const res = await fetch(`/api/quiz/take/${quizId}`, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'ไม่พบแบบทดสอบ')
  return json
}

export async function checkAnswer(questionId: string, selected: number | null) {
  const res = await fetch('/api/quiz/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, selected }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'check failed')
  return json as { correctAnswer: number; isCorrect: boolean }
}

export interface SubmitInput {
  quizId: string
  studentId?: string
  studentCode?: string
  studentName: string
  schoolName?: string
  answers: SubmittedAnswer[]
  totalTime: number
  originalTotalQuestions?: number
}
export async function submitQuiz(input: SubmitInput) {
  const res = await fetch('/api/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'ส่งคำตอบไม่สำเร็จ')
  return json as { resultId: string; score: number; maxScore: number; percentage: number; gradedAnswers: any[] }
}

export async function getMyResults(code: string, school: string) {
  const res = await fetch('/api/quiz/my-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, school }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'ไม่พบประวัติ')
  return json as { student: { name: string; nickname: string; studentCode: string }; results: any[] }
}

// ---------- Categories ----------

export async function getCategories() {
  const res = await fetch('/api/quiz/categories', { cache: 'no-store' })
  if (!res.ok) throw new Error('โหลดหมวดหมู่ไม่สำเร็จ')
  return res.json()
}
export const createCategory = (data: any) => staffFetch('/api/quiz/categories', { method: 'POST', body: JSON.stringify(data) })
export const updateCategory = (id: string, data: any) => staffFetch(`/api/quiz/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteCategory = (id: string) => staffFetch(`/api/quiz/categories/${id}`, { method: 'DELETE' })

// ---------- Quizzes ----------

export async function getQuizzes(opts: { category?: string; activeOnly?: boolean } = {}) {
  const qs = new URLSearchParams()
  if (opts.category) qs.set('category', opts.category)
  if (opts.activeOnly) qs.set('active', 'true')
  const res = await fetch(`/api/quiz/quizzes?${qs.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('โหลดรายการข้อสอบไม่สำเร็จ')
  return res.json()
}
export const createQuiz = (data: any) => staffFetch('/api/quiz/quizzes', { method: 'POST', body: JSON.stringify(data) })
export const getQuizForEdit = (id: string) => staffFetch(`/api/quiz/quizzes/${id}`)
export const updateQuiz = (id: string, data: any) => staffFetch(`/api/quiz/quizzes/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteQuiz = (id: string) => staffFetch(`/api/quiz/quizzes/${id}`, { method: 'DELETE' })

// ---------- Results (staff) ----------

export interface ResultFilters {
  student?: string
  quizId?: string
  school?: string
  studentId?: string
  from?: string
  to?: string
}
export async function getQuizResults(filters: ResultFilters = {}) {
  const qs = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v) })
  return staffFetch(`/api/quiz/results?${qs.toString()}`)
}

/** Enrolled students of a class (id, name, nickname, student_code, school_name). */
export async function getClassRoster(classId: string) {
  return staffFetch(`/api/quiz/class-roster?classId=${classId}`)
}

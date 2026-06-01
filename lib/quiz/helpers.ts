// Quiz helpers — grading, randomization, time, localization. See dev-plan/quiz.md §5.
import type { QuizLang } from '@/types/quiz';

export interface GradeInfo {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  icon: string;        // lucide icon name (no emoji) — render via QuizIcon
  label: string;       // Thai label
  color: string;       // tailwind text color
  passed: boolean;
}

/** Grade scale: A ≥90, B ≥80, C ≥70, D ≥60, F <60. */
export function calculateGrade(percentage: number): GradeInfo {
  if (percentage >= 90) return { grade: 'A', icon: 'Trophy', label: 'ยอดเยี่ยม!', color: 'text-green-600', passed: true };
  if (percentage >= 80) return { grade: 'B', icon: 'Award', label: 'เก่งมาก!', color: 'text-blue-600', passed: true };
  if (percentage >= 70) return { grade: 'C', icon: 'ThumbsUp', label: 'ดี!', color: 'text-yellow-600', passed: true };
  if (percentage >= 60) return { grade: 'D', icon: 'Flame', label: 'พยายามอีกนิด', color: 'text-orange-600', passed: true };
  return { grade: 'F', icon: 'BookOpen', label: 'ทบทวนอีกครั้งนะ', color: 'text-red-600', passed: false };
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Default time budget: 30 seconds per question. */
export function quizDurationSec(questionCount: number): number {
  return questionCount * 30;
}

/** Seconds → MM:SS */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Timer color by remaining seconds. */
export function timerColor(remainingSec: number): string {
  if (remainingSec > 20) return 'text-green-600';
  if (remainingSec > 10) return 'text-yellow-600';
  return 'text-red-600';
}

export function percentage(score: number, maxScore: number): number {
  if (!maxScore) return 0;
  return Math.round((score / maxScore) * 10000) / 100; // 2 decimals
}

/**
 * Pick the localized value: obj[field+'Th'|'En'] with fallback to the base field.
 * e.g. getLocalizedField(quiz, 'title', 'en') → quiz.titleEn || quiz.title
 */
export function getLocalizedField<T extends Record<string, any>>(
  obj: T | null | undefined,
  field: string,
  lang: QuizLang
): string {
  if (!obj) return '';
  const suffix = lang === 'en' ? 'En' : 'Th';
  return obj[`${field}${suffix}`] || obj[field] || '';
}

/** Localized options array (optionsTh / optionsEn fallback options). */
export function getLocalizedOptions(
  q: { options?: string[]; optionsTh?: string[]; optionsEn?: string[] },
  lang: QuizLang
): string[] {
  const localized = lang === 'en' ? q.optionsEn : q.optionsTh;
  if (localized && localized.length) return localized;
  return q.options || [];
}

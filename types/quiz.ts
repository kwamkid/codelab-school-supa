// Quiz system types — see dev-plan/quiz.md
export type QuizDifficulty = 'ง่าย' | 'ปานกลาง' | 'ยาก';
export type QuizLang = 'th' | 'en';

export interface QuizCategory {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  color: string;          // tailwind gradient class e.g. 'from-blue-400 to-cyan-400'
  iconType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Quiz {
  id: string;
  title: string;
  titleTh?: string;
  titleEn?: string;
  emoji: string;
  difficulty: QuizDifficulty;
  categoryId?: string;
  categoryName?: string;     // joined for display
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  questionCount?: number;    // joined for display
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  sortOrder: number;
  question?: string;
  questionTh?: string;
  questionEn?: string;
  options: string[];
  optionsTh: string[];
  optionsEn: string[];
  correctAnswer: number;     // 0-3
  points: number;
}

/** Question shape sent to students — NO correctAnswer (graded server-side). */
export interface QuizQuestionPublic {
  id: string;
  sortOrder: number;
  question?: string;
  questionTh?: string;
  questionEn?: string;
  options: string[];
  optionsTh: string[];
  optionsEn: string[];
  points: number;
}

/** One answer the student submits. */
export interface SubmittedAnswer {
  questionId: string;
  selected: number | null;   // chosen option index, null = unanswered
  timeSpent?: number;        // seconds on this question
}

/** One graded answer stored in quiz_results.answers. */
export interface GradedAnswer extends SubmittedAnswer {
  correctAnswer: number;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface QuizResult {
  id: string;
  studentId?: string;
  studentCode?: string;
  studentName: string;
  schoolName?: string;
  quizId?: string;
  quizTitle?: string;
  quizTitleTh?: string;
  quizTitleEn?: string;
  emoji?: string;
  difficulty?: string;
  score: number;
  maxScore: number;
  percentage: number;
  totalQuestions: number;
  selectedQuestionCount?: number;
  originalTotalQuestions?: number;
  totalTime: number;         // seconds
  answers: GradedAnswer[];
  quizData?: any;            // snapshot of quiz at attempt time
  createdAt?: string;
}

/** Minimal student returned by code+school verification. */
export interface StudentLite {
  id: string;
  studentCode?: string;
  name: string;
  nickname: string;
  schoolName?: string;
}

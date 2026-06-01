// Quiz bilingual strings. See dev-plan/quiz.md §5.3. Expand keys as UI grows.
import type { QuizLang } from '@/types/quiz';

type Dict = Record<string, { th: string; en: string }>;

const STRINGS: Dict = {
  // common
  back: { th: 'กลับ', en: 'Back' },
  next: { th: 'ถัดไป', en: 'Next' },
  start: { th: 'เริ่ม', en: 'Start' },
  submit: { th: 'ส่งคำตอบ', en: 'Submit' },
  loading: { th: 'กำลังโหลด...', en: 'Loading...' },
  search: { th: 'ค้นหา...', en: 'Search...' },

  // student login
  welcome: { th: 'พร้อมทำแบบทดสอบกันมั้ย?', en: 'Ready for the quiz?' },
  enterCode: { th: 'กรอกรหัสนักเรียน', en: 'Enter student code' },
  selectSchool: { th: 'เลือกโรงเรียนของคุณ', en: 'Select your school' },
  letsGo: { th: 'เริ่มกันเลย!', en: "Let's go!" },
  codeNotFound: { th: 'ไม่พบรหัสนักเรียนนี้ หรือโรงเรียนไม่ตรง', en: 'Student code not found or school mismatch' },

  // quiz taking
  question: { th: 'ข้อที่', en: 'Question' },
  score: { th: 'คะแนน', en: 'Score' },
  timeUp: { th: 'หมดเวลา!', en: "Time's up!" },
  correct: { th: 'ถูกต้อง!', en: 'Correct!' },
  wrong: { th: 'ผิด!', en: 'Wrong!' },
  correctAnswerIs: { th: 'คำตอบที่ถูก', en: 'Correct answer' },

  // result
  yourScore: { th: 'คะแนนของคุณ', en: 'Your score' },
  retake: { th: 'ทำใหม่', en: 'Retake' },
  viewAnswers: { th: 'ดูเฉลย', en: 'View answers' },
  home: { th: 'หน้าหลัก', en: 'Home' },

  // admin
  createQuiz: { th: 'สร้างข้อสอบ', en: 'Create quiz' },
  viewScores: { th: 'ดูคะแนน', en: 'View scores' },
  manageCategories: { th: 'จัดการหมวดหมู่', en: 'Manage categories' },
  questionsCount: { th: 'คำถาม', en: 'questions' },
};

export function t(key: string, lang: QuizLang = 'th'): string {
  return STRINGS[key]?.[lang] ?? key;
}

export const DIFFICULTY_OPTIONS: { value: string; th: string; en: string }[] = [
  { value: 'ง่าย', th: 'ง่าย', en: 'Easy' },
  { value: 'ปานกลาง', th: 'ปานกลาง', en: 'Medium' },
  { value: 'ยาก', th: 'ยาก', en: 'Hard' },
];

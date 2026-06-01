'use client';

import { useParams } from 'next/navigation';
import QuizEditor from '@/components/quiz/quiz-editor';

export default function EditQuizPage() {
  const params = useParams();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) || '';
  return <QuizEditor quizId={id} />;
}

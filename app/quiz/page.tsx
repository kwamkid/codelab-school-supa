'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SearchInput } from '@/components/ui/search-input';
import { Loader2, History, ChevronRight, Sparkles } from 'lucide-react';
import { QuizIcon } from '@/components/quiz/quiz-icons';
import { QuizBackground } from '@/components/quiz/quiz-bg';
import { FlagToggle } from '@/components/quiz/flag-toggle';
import { getQuizzes } from '@/lib/services/quiz';

type Lang = 'th' | 'en';

const DIFF: Record<string, { th: string; en: string; dot: string; chip: string }> = {
  'ง่าย': { th: 'ง่าย', en: 'Easy', dot: 'bg-green-500', chip: 'bg-green-50 text-green-700' },
  'ปานกลาง': { th: 'ปานกลาง', en: 'Medium', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  'ยาก': { th: 'ยาก', en: 'Hard', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
};

export default function QuizBrowsePage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<Lang>('th');

  useEffect(() => {
    getQuizzes({ activeOnly: true }).then(setQuizzes).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const t = (th: string, en: string) => (lang === 'en' ? en : th);

  const filtered = quizzes.filter((q) =>
    (q.title_th || q.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.title_en || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.categoryName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <QuizBackground headerRight={<FlagToggle lang={lang} onChange={setLang} />}>
      <div className="w-full max-w-4xl mx-auto px-4 pb-10 pt-4 sm:pt-8">
        {/* hero */}
        <div className="text-center text-white mb-7">
          <h1 className="text-4xl font-extrabold drop-shadow-sm">{t('แบบทดสอบ', 'Quizzes')}</h1>
          <p className="text-white/85 mt-1">{t('เลือกข้อสอบที่จะทำ', 'Pick a quiz to start')}</p>
        </div>

        {/* search + history */}
        <div className="flex gap-2 mb-5 max-w-2xl mx-auto">
          <div className="flex-1">
            <SearchInput variant="onDark" placeholder={t('ค้นหาข้อสอบ...', 'Search quizzes...')} value={search} onChange={setSearch} />
          </div>
          <Link href="/quiz/history">
            <button className="h-full px-4 rounded-xl bg-white/20 text-white flex items-center gap-1.5 hover:bg-white/30 backdrop-blur-sm transition-colors whitespace-nowrap">
              <History className="h-4 w-4" /> {t('ประวัติ', 'History')}
            </button>
          </Link>
        </div>

        {/* list */}
        {loading ? (
          <div className="flex justify-center py-20 text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/85 py-16">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-3"><Sparkles className="h-8 w-8" /></div>
            {t('ยังไม่มีแบบทดสอบ', 'No quizzes yet')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((q) => {
              const diff = DIFF[q.difficulty];
              return (
                <Link key={q.id} href={`/quiz/${q.id}`} className="block group">
                  <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-4">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ef443a] to-[#ff7a3c] text-white flex items-center justify-center shrink-0 shadow-inner">
                      <QuizIcon name={q.icon} className="h-7 w-7" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{(lang === 'en' ? q.title_en : q.title_th) || q.title}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5 flex-wrap">
                        {q.categoryName && <span className="font-medium text-gray-600">{q.categoryName}</span>}
                        <span>{q.questionCount} {t('ข้อ', 'questions')}</span>
                        {diff && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${diff.chip}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} /> {t(diff.th, diff.en)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-[#ef443a] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </QuizBackground>
  );
}

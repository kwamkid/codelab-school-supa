'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { QuizIcon } from '@/components/quiz/quiz-icons';
import { QuizBackground } from '@/components/quiz/quiz-bg';
import { FlagToggle } from '@/components/quiz/flag-toggle';
import { ArrowLeft, AlertCircle, Loader2, History, BarChart3, Target, Trophy } from 'lucide-react';
import { getMyResults } from '@/lib/services/quiz';
import { getRememberedStudent, rememberStudent } from '@/lib/quiz/remember';
import { formatTime } from '@/lib/quiz/helpers';
import { formatDate } from '@/lib/utils';

const pctColor = (p: number) =>
  p >= 80 ? 'bg-green-100 text-green-700' : p >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

export default function QuizHistoryPage() {
  const [code, setCode] = useState('');
  const [school, setSchool] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ student: any; results: any[] } | null>(null);
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const t = (th: string, en: string) => (lang === 'en' ? en : th);

  useEffect(() => {
    const r = getRememberedStudent();
    if (r) { setCode(r.code); setSchool(r.school); }
  }, []);

  const lookup = async () => {
    if (!code.trim() || !school.trim()) { setError(t('กรอกรหัสและเลือกโรงเรียน','Enter your code and select a school')); return; }
    setLoading(true); setError('');
    try {
      const res = await getMyResults(code.trim(), school.trim());
      rememberStudent(code, school);
      setData(res);
    }
    catch (e: any) { setError(e.message || 'ไม่พบประวัติ'); setData(null); }
    finally { setLoading(false); }
  };

  const stats = data?.results.length
    ? {
        count: data.results.length,
        avg: Math.round(data.results.reduce((a, r) => a + Number(r.percentage || 0), 0) / data.results.length),
        best: Math.max(...data.results.map((r) => Number(r.percentage || 0))),
      }
    : null;

  return (
    <QuizBackground headerRight={<FlagToggle lang={lang} onChange={setLang} />}>
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="border border-white/15 bg-white/10 backdrop-blur-2xl text-white shadow-2xl">
          <CardHeader className="text-center pt-7 pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 text-white flex items-center justify-center mb-2">
              <History className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl text-white">{t('ประวัติคะแนนของฉัน','My quiz history')}</CardTitle>
            <p className="text-sm text-white/60 mt-1">{t('กรอกรหัสนักเรียนและโรงเรียนเพื่อดูคะแนนย้อนหลัง','Enter your student code and school to see past scores')}</p>
          </CardHeader>

          <CardContent className="p-6 pt-2 space-y-5">
            {error && (
              <Alert variant="destructive" className="bg-red-500/15 border-red-400/40 text-white"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
            )}

            {!data && (
              <>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('รหัสนักเรียน','Student code')}</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CL0001" className="h-12 text-center font-mono text-lg uppercase bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/40" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">{t('โรงเรียน','School')}</Label>
                  <SchoolNameCombobox value={school} onChange={setSchool} placeholder={t('เลือกโรงเรียน','Select school')} className="bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/40" />
                </div>
                <Button onClick={lookup} disabled={loading} className="w-full h-12 bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] text-white font-medium">
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}{t('ดูประวัติ','View history')}
                </Button>
              </>
            )}

            {data && (
              <>
                <div className="text-center">
                  <p className="font-bold text-lg text-white">{data.student.nickname || data.student.name}</p>
                  <p className="font-mono text-xs text-[#ef443a]">{data.student.studentCode}</p>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/10 p-3 text-center">
                      <BarChart3 className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
                      <div className="font-bold text-lg">{stats.count}</div>
                      <div className="text-xs text-white/60">{t('ครั้ง','attempts')}</div>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3 text-center">
                      <Target className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                      <div className="font-bold text-lg">{stats.avg}%</div>
                      <div className="text-xs text-white/60">{t('เฉลี่ย','average')}</div>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3 text-center">
                      <Trophy className="h-5 w-5 mx-auto text-green-500 mb-1" />
                      <div className="font-bold text-lg">{stats.best}%</div>
                      <div className="text-xs text-white/60">{t('สูงสุด','best')}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[46vh] overflow-y-auto -mx-1 px-1">
                  {data.results.map((r) => (
                    <div key={r.id} className="rounded-xl border border-white/15 bg-white/5 p-3 flex items-center gap-3 hover:bg-white/10 transition-colors">
                      <span className="w-9 h-9 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                        <QuizIcon name={r.emoji} className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.quiz_title_th || r.quiz_title}</div>
                        <div className="text-xs text-white/60">{r.score}/{r.max_score} · {formatTime(r.total_time || 0)} · {r.created_at ? formatDate(new Date(r.created_at), 'short') : ''}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${pctColor(Number(r.percentage))}`}>{r.percentage}%</span>
                    </div>
                  ))}
                  {data.results.length === 0 && (
                    <p className="text-center text-white/60 py-8">{t('ยังไม่มีประวัติการทำข้อสอบ','No quiz history yet')}</p>
                  )}
                </div>

                <Button variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => { setData(null); setCode(''); setSchool(''); }}>
                  {t('ดูคนอื่น','Another student')}
                </Button>
              </>
            )}

            <div className="pt-1 text-center">
              <Link href="/quiz" className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> {t('กลับ','Back')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </QuizBackground>
  );
}

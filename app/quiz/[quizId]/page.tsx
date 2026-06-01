'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { QuizIcon } from '@/components/quiz/quiz-icons';
import { QuizBackground } from '@/components/quiz/quiz-bg';
import { FlagToggle } from '@/components/quiz/flag-toggle';
import { Loader2, AlertCircle, Clock, CheckCircle2, XCircle, Trophy, Sparkles, History, RotateCcw } from 'lucide-react';
import { verifyStudent, getQuizForTaking, submitQuiz, checkAnswer } from '@/lib/services/quiz';
import { shuffleArray, quizDurationSec, formatTime, timerColor, calculateGrade } from '@/lib/quiz/helpers';
import { quizSound } from '@/lib/quiz/audio';
import { getRememberedStudent, rememberStudent, forgetStudent } from '@/lib/quiz/remember';
import type { QuizQuestionPublic, StudentLite } from '@/types/quiz';

type Phase = 'loading' | 'login' | 'intro' | 'taking' | 'submitting' | 'result' | 'error';
type Lang = 'th' | 'en';

// dark-glass shared styles
const GLASS_CARD = 'border border-white/15 bg-white/10 backdrop-blur-2xl text-white shadow-2xl';
const GLASS_INPUT = 'bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/40 focus-visible:border-white/50';

const qText = (q: any, lang: Lang) =>
  (lang === 'en' ? q.question_en : q.question_th) || q.question_th || q.question_en || q.question || '';
const qOptions = (q: any, lang: Lang): string[] => {
  const loc = lang === 'en' ? q.options_en : q.options_th;
  if (Array.isArray(loc) && loc.length) return loc;
  return q.options_th || q.options_en || q.options || [];
};

export default function StudentQuizPage() {
  const params = useParams();
  const quizId = (Array.isArray(params.quizId) ? params.quizId[0] : params.quizId) || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Lang>('th');

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [ordered, setOrdered] = useState<any[]>([]);

  const [code, setCode] = useState('');
  const [school, setSchool] = useState('');
  const [student, setStudent] = useState<StudentLite | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [chosenCount, setChosenCount] = useState(10);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<{ correctAnswer: number; isCorrect: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const questionStartRef = useRef<number>(0);
  const timeSpentRef = useRef<Record<string, number>>({});
  const startedAtRef = useRef<number>(0);

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    getQuizForTaking(quizId)
      .then(({ quiz, questions }) => {
        if (!mounted) return;
        setQuiz(quiz); setQuestions(questions); setPhase('login');
      })
      .catch((e) => { if (mounted) { setError(e.message || 'ไม่พบแบบทดสอบ'); setPhase('error'); } });
    return () => { mounted = false; };
  }, [quizId]);

  // prefill remembered student (same device)
  useEffect(() => {
    const r = getRememberedStudent();
    if (r) { setCode(r.code); setSchool(r.school); }
  }, []);

  const total = ordered.length;
  const current = ordered[idx];

  const handleLogin = async () => {
    if (!code.trim() || !school.trim()) { setError('กรุณากรอกรหัสนักเรียนและเลือกโรงเรียน'); return; }
    setVerifying(true); setError('');
    try {
      const s = await verifyStudent(code.trim(), school.trim());
      rememberStudent(code, school);
      setChosenCount(Math.min(10, questions.length || 10));
      setStudent(s); setPhase('intro');
    } catch (e: any) {
      setError(e.message || 'ยืนยันตัวตนไม่สำเร็จ');
    } finally { setVerifying(false); }
  };

  const startQuiz = () => {
    const pool = shuffleArray(questions);
    const teacherFixed = quiz?.question_count && quiz.question_count > 0;
    const qc = teacherFixed ? Math.min(quiz.question_count, pool.length) : Math.min(chosenCount, pool.length);
    const drawn = pool.slice(0, qc).map((q: any) => {
      const baseTh: any[] = (q.options_th?.length ? q.options_th : q.options) || [];
      const nonEmpty = baseTh.map((t, i) => ({ t, i })).filter((o) => String(o.t ?? '').trim()).map((o) => o.i);
      return { ...q, perm: shuffleArray(nonEmpty) };
    });
    setOrdered(drawn); setIdx(0); setAnswers({}); setRevealed(null);
    setResult(null);
    submittingRef.current = false;
    timeSpentRef.current = {};
    setRemaining(quizDurationSec(drawn.length));
    startedAtRef.current = Date.now();
    questionStartRef.current = Date.now();
    setPhase('taking');
  };

  useEffect(() => {
    if (phase !== 'taking') return;
    if (remaining <= 0) { void doSubmit(); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining]);

  const recordTime = (questionId: string) => {
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
    timeSpentRef.current[questionId] = (timeSpentRef.current[questionId] || 0) + spent;
    questionStartRef.current = Date.now();
  };

  const selectAnswer = (optionIdx: number) => {
    if (!current || revealed) return;
    quizSound.click();
    setAnswers((a) => ({ ...a, [current.id]: optionIdx }));
  };

  const submitAnswer = async () => {
    if (!current || answers[current.id] === undefined) return;
    setChecking(true);
    try {
      const r = await checkAnswer(current.id, answers[current.id]);
      setRevealed(r);
      r.isCorrect ? quizSound.correct() : quizSound.wrong();
    } catch {
      goNext();
    } finally { setChecking(false); }
  };

  const goNext = () => {
    if (current) recordTime(current.id);
    setRevealed(null);
    if (idx < total - 1) setIdx(idx + 1);
    else void doSubmit();
  };

  const submittingRef = useRef(false);
  const doSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (current) recordTime(current.id);
    setPhase('submitting');
    try {
      const res = await submitQuiz({
        quizId,
        studentId: student?.id,
        studentCode: student?.studentCode,
        studentName: student?.name || '',
        schoolName: student?.schoolName,
        answers: ordered.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? null, timeSpent: timeSpentRef.current[q.id] || 0 })),
        totalTime: Math.round((Date.now() - startedAtRef.current) / 1000),
        originalTotalQuestions: questions.length,
      });
      setResult(res);
      quizSound.complete();
      setPhase('result');
    } catch (e: any) {
      setError(e.message || 'ส่งคำตอบไม่สำเร็จ'); setPhase('error');
    }
  };

  const grade = result ? calculateGrade(result.percentage) : null;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  return (
    <QuizBackground headerRight={<FlagToggle lang={lang} onChange={setLang} />}>
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">

        <Card className={GLASS_CARD}>
          {phase === 'loading' && (
            <CardContent className="py-16 flex flex-col items-center text-white/70"><Loader2 className="h-8 w-8 animate-spin mb-3" /> กำลังโหลด...</CardContent>
          )}

          {phase === 'error' && (
            <CardContent className="py-10"><Alert variant="destructive" className="bg-red-500/15 border-red-400/40 text-white"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert></CardContent>
          )}

          {phase === 'login' && quiz && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 text-white flex items-center justify-center mb-2">
                  <QuizIcon name={quiz.icon} className="h-8 w-8" />
                </div>
                <CardTitle className="text-xl text-white">{(lang === 'en' ? quiz.title_en : quiz.title_th) || quiz.title}</CardTitle>
                <p className="text-sm text-white/60">{questions.length} {lang === 'en' ? 'questions' : 'ข้อ'}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && <Alert variant="destructive" className="bg-red-500/15 border-red-400/40 text-white"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="space-y-2">
                  <Label className="text-white/80">{lang === 'en' ? 'Student code' : 'รหัสนักเรียน'}</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CL0001" className={`h-12 text-center font-mono text-lg uppercase ${GLASS_INPUT}`} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">{lang === 'en' ? 'Your school' : 'โรงเรียนของคุณ'}</Label>
                  <SchoolNameCombobox value={school} onChange={setSchool} placeholder={lang === 'en' ? 'Select school' : 'เลือกโรงเรียน'} className={GLASS_INPUT} />
                </div>
                <Button onClick={handleLogin} disabled={verifying} className="w-full h-12 bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] hover:opacity-90 text-white">
                  {verifying && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {lang === 'en' ? "Let's go!" : 'เริ่มกันเลย!'}
                </Button>
                {code && (
                  <button type="button" onClick={() => { setCode(''); setSchool(''); forgetStudent(); }} className="block mx-auto text-xs text-white/60 hover:text-white">
                    {lang === 'en' ? 'Not you? Clear' : 'ไม่ใช่ฉัน? ล้างข้อมูลที่จำไว้'}
                  </button>
                )}
              </CardContent>
            </>
          )}

          {phase === 'intro' && student && (
            <CardContent className="py-10 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center"><Sparkles className="h-7 w-7" /></div>
              <p className="text-lg font-semibold">{lang === 'en' ? 'Hi' : 'สวัสดี'} {student.nickname || student.name}!</p>
              <p className="text-white/60 flex items-center justify-center gap-2">
                <QuizIcon name={quiz?.icon} className="h-4 w-4" />
                {(lang === 'en' ? quiz?.title_en : quiz?.title_th) || quiz?.title}
              </p>
              {(() => {
                const pool = questions.length;
                const teacherFixed = !!(quiz?.question_count && quiz.question_count > 0);
                if (teacherFixed) {
                  const drawCount = Math.min(quiz.question_count, pool);
                  return (
                    <p className="text-sm text-white/50">
                      {drawCount} {lang === 'en' ? 'questions' : 'ข้อ'}
                      {drawCount < pool && <> ({lang === 'en' ? `random from ${pool}` : `สุ่มจาก ${pool}`})</>}
                      {' · '}{formatTime(quizDurationSec(drawCount))}
                    </p>
                  );
                }
                if (pool <= 5) {
                  return <p className="text-sm text-white/50">{pool} {lang === 'en' ? 'questions' : 'ข้อ'} · {formatTime(quizDurationSec(pool))}</p>;
                }
                const presets = [5, 10, 20, 30].filter((n) => n < pool);
                const choices = [...presets, pool];
                const eff = Math.min(chosenCount, pool);
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-white/70">{lang === 'en' ? 'How many questions?' : 'อยากทำกี่ข้อ?'} <span className="text-white/50">({lang === 'en' ? `from ${pool}` : `จากทั้งหมด ${pool}`})</span></p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {choices.map((n) => (
                        <button
                          key={n}
                          onClick={() => setChosenCount(n)}
                          className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${eff === n ? 'border-[#ff7a3c] bg-white/15 text-white' : 'border-white/25 text-white/70 hover:border-white/40'}`}
                        >
                          {n === pool ? (lang === 'en' ? `All (${pool})` : `ทั้งหมด (${pool})`) : `${n} ${lang === 'en' ? 'q' : 'ข้อ'}`}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/50">{lang === 'en' ? `~${formatTime(quizDurationSec(eff))} · randomly drawn` : `เวลา ~${formatTime(quizDurationSec(eff))} · สุ่มข้อให้`}</p>
                  </div>
                );
              })()}
              <Button onClick={startQuiz} className="w-full h-12 bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] hover:opacity-90 text-white">{lang === 'en' ? 'Start quiz' : 'เริ่มทำข้อสอบ'}</Button>
            </CardContent>
          )}

          {phase === 'submitting' && (
            <CardContent className="py-16 flex flex-col items-center text-white/70"><Loader2 className="h-8 w-8 animate-spin mb-3" /> {lang === 'en' ? 'Scoring...' : 'กำลังตรวจคะแนน...'}</CardContent>
          )}

          {phase === 'taking' && current && (
            <CardContent className="py-6 space-y-4 max-h-[calc(100dvh-7.5rem)] overflow-y-auto">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">{lang === 'en' ? 'Question' : 'ข้อ'} {idx + 1}/{total}</span>
                <span className={`flex items-center gap-1 font-mono font-bold ${timerColor(remaining)}`}><Clock className="h-4 w-4" /> {formatTime(remaining)}</span>
              </div>
              <div className="h-2 bg-white/15 rounded-full overflow-hidden"><div className="h-full bg-[#ff7a3c] transition-all" style={{ width: `${(idx / total) * 100}%` }} /></div>

              <p className="text-lg font-semibold">{qText(current, lang)}</p>
              {current.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.image_url} alt="" className="mx-auto max-h-[26vh] rounded-lg object-contain" />
              )}

              <div className="space-y-2">
                {(current.perm as number[]).map((origIdx: number, displayPos: number) => {
                  const opt = qOptions(current, lang)[origIdx];
                  const selected = answers[current.id] === origIdx;
                  let cls = 'border-white/20 bg-white/5 hover:bg-white/10';
                  if (revealed) {
                    if (origIdx === revealed.correctAnswer) cls = 'border-green-400 bg-green-500/20';
                    else if (selected) cls = 'border-red-400 bg-red-500/20';
                    else cls = 'border-white/15 opacity-50';
                  } else if (selected) cls = 'border-[#ff7a3c] bg-white/15 font-medium';
                  return (
                    <button key={origIdx} onClick={() => selectAnswer(origIdx)} disabled={!!revealed}
                      className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors flex items-center ${cls}`}>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/15 text-sm mr-2 shrink-0">{String.fromCharCode(65 + displayPos)}</span>
                      <span className="flex-1">{opt}</span>
                      {revealed && origIdx === revealed.correctAnswer && <CheckCircle2 className="h-5 w-5 text-green-400" />}
                      {revealed && selected && origIdx !== revealed.correctAnswer && <XCircle className="h-5 w-5 text-red-400" />}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className={`text-center font-semibold ${revealed.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {revealed.isCorrect ? (lang === 'en' ? 'Correct!' : 'ถูกต้อง!') : (lang === 'en' ? 'Wrong!' : 'ยังไม่ถูก')}
                </div>
              )}

              {!revealed ? (
                <Button onClick={submitAnswer} disabled={answers[current.id] === undefined || checking} className="w-full h-12 bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] hover:opacity-90 text-white">
                  {checking && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}{lang === 'en' ? 'Submit' : 'ส่งคำตอบ'}
                </Button>
              ) : (
                <Button onClick={goNext} className="w-full h-12 bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] hover:opacity-90 text-white">
                  {idx < total - 1 ? (lang === 'en' ? 'Next' : 'ข้อถัดไป') : (lang === 'en' ? 'Finish' : 'ดูผลคะแนน')}
                </Button>
              )}
            </CardContent>
          )}

          {phase === 'result' && result && grade && (
            <CardContent className="py-8 text-center space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-white/15 flex items-center justify-center text-white">
                <QuizIcon name={grade.icon} className="h-10 w-10" />
              </div>
              <p className="text-2xl font-bold">{grade.label}</p>
              <div><div className="text-5xl font-bold">{result.percentage}%</div><div className="text-white/60">{lang === 'en' ? 'Grade' : 'เกรด'} {grade.grade}</div></div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-white/10 p-3"><Trophy className="h-5 w-5 mx-auto text-yellow-400 mb-1" /><div className="font-bold">{result.score}/{result.maxScore}</div><div className="text-xs text-white/60">{lang === 'en' ? 'Score' : 'คะแนน'}</div></div>
                <div className="rounded-lg bg-white/10 p-3"><CheckCircle2 className="h-5 w-5 mx-auto text-green-400 mb-1" /><div className="font-bold">{result.gradedAnswers.filter((a: any) => a.isCorrect).length}/{total}</div><div className="text-xs text-white/60">{lang === 'en' ? 'Correct' : 'ข้อถูก'}</div></div>
                <div className="rounded-lg bg-white/10 p-3"><Clock className="h-5 w-5 mx-auto text-sky-400 mb-1" /><div className="font-bold">{answeredCount}/{total}</div><div className="text-xs text-white/60">{lang === 'en' ? 'Answered' : 'ตอบแล้ว'}</div></div>
              </div>
              <div className="text-left space-y-2 pt-2">
                {ordered.map((q, i) => {
                  const g = result.gradedAnswers.find((a: any) => a.questionId === q.id);
                  const opts = qOptions(q, lang);
                  return (
                    <div key={q.id} className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm">
                      <div className="flex items-start gap-2">
                        {g?.isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                        <div>
                          <p className="font-medium">{i + 1}. {qText(q, lang)}</p>
                          {!g?.isCorrect && g?.correctAnswer != null && (
                            <p className="text-green-400 mt-1">{lang === 'en' ? 'Correct' : 'คำตอบที่ถูก'}: {opts[g.correctAnswer]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                <Button onClick={() => { window.location.href = '/quiz'; }} className="bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] hover:opacity-90 text-white">
                  {lang === 'en' ? 'Other quizzes' : 'ทำข้อสอบอื่น'}
                </Button>
                <Button variant="outline" onClick={() => { window.location.href = '/quiz/history'; }} className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <History className="h-4 w-4 mr-2" />{lang === 'en' ? 'My history' : 'ประวัติของฉัน'}
                </Button>
                <Button variant="outline" onClick={startQuiz} className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <RotateCcw className="h-4 w-4 mr-2" />{lang === 'en' ? 'Retake' : 'ทำซ้ำ'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      </div>
    </QuizBackground>
  );
}

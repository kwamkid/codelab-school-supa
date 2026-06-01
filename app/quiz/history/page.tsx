'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { QuizIcon } from '@/components/quiz/quiz-icons';
import { QuizBackground } from '@/components/quiz/quiz-bg';
import { ArrowLeft, AlertCircle, Loader2, History, BarChart3, Target, Trophy } from 'lucide-react';
import { getMyResults } from '@/lib/services/quiz';
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

  const lookup = async () => {
    if (!code.trim() || !school.trim()) { setError('กรอกรหัสและเลือกโรงเรียน'); return; }
    setLoading(true); setError('');
    try { setData(await getMyResults(code.trim(), school.trim())); }
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
    <QuizBackground>
      <div className="max-w-2xl mx-auto py-6 px-4 w-full">
        <Link href="/quiz">
          <button className="text-white/90 hover:text-white mb-4 flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </button>
        </Link>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pt-7 pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 text-[#ef443a] flex items-center justify-center mb-2">
              <History className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">ประวัติคะแนนของฉัน</CardTitle>
            <p className="text-sm text-gray-500 mt-1">กรอกรหัสนักเรียนและโรงเรียนเพื่อดูคะแนนย้อนหลัง</p>
          </CardHeader>

          <CardContent className="p-6 pt-2 space-y-5">
            {error && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
            )}

            {!data && (
              <>
                <div className="space-y-2">
                  <Label>รหัสนักเรียน</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CL0001" className="h-12 text-center font-mono text-lg uppercase" />
                </div>
                <div className="space-y-2">
                  <Label>โรงเรียน</Label>
                  <SchoolNameCombobox value={school} onChange={setSchool} placeholder="เลือกโรงเรียน" />
                </div>
                <Button onClick={lookup} disabled={loading} className="w-full h-12 bg-gradient-to-r from-[#ef443a] to-[#ff7a3c] text-white font-medium">
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}ดูประวัติ
                </Button>
              </>
            )}

            {data && (
              <>
                <div className="text-center">
                  <p className="font-bold text-lg text-gray-900">{data.student.nickname || data.student.name}</p>
                  <p className="font-mono text-xs text-[#ef443a]">{data.student.studentCode}</p>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <BarChart3 className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
                      <div className="font-bold text-lg">{stats.count}</div>
                      <div className="text-xs text-gray-500">ครั้ง</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <Target className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                      <div className="font-bold text-lg">{stats.avg}%</div>
                      <div className="text-xs text-gray-500">เฉลี่ย</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center">
                      <Trophy className="h-5 w-5 mx-auto text-green-500 mb-1" />
                      <div className="font-bold text-lg">{stats.best}%</div>
                      <div className="text-xs text-gray-500">สูงสุด</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[46vh] overflow-y-auto -mx-1 px-1">
                  {data.results.map((r) => (
                    <div key={r.id} className="rounded-xl border p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                      <span className="w-9 h-9 rounded-lg bg-red-50 text-[#ef443a] flex items-center justify-center shrink-0">
                        <QuizIcon name={r.emoji} className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.quiz_title_th || r.quiz_title}</div>
                        <div className="text-xs text-gray-500">{r.score}/{r.max_score} · {formatTime(r.total_time || 0)} · {r.created_at ? formatDate(new Date(r.created_at), 'short') : ''}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${pctColor(Number(r.percentage))}`}>{r.percentage}%</span>
                    </div>
                  ))}
                  {data.results.length === 0 && (
                    <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติการทำข้อสอบ</p>
                  )}
                </div>

                <Button variant="outline" className="w-full" onClick={() => { setData(null); setCode(''); setSchool(''); }}>
                  ดูคนอื่น
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </QuizBackground>
  );
}

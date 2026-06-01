'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { FormSelect } from '@/components/ui/form-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SectionLoading } from '@/components/ui/loading';
import { ArrowLeft, Download, Users, Trophy, Target, BarChart3 } from 'lucide-react';
import { QuizIcon } from '@/components/quiz/quiz-icons';
import { getQuizResults, getQuizzes, getClassRoster } from '@/lib/services/quiz';
import { getClasses } from '@/lib/services/classes';
import { getBranches } from '@/lib/services/branches';
import { formatDate } from '@/lib/utils';
import { formatTime } from '@/lib/quiz/helpers';
import { toast } from 'sonner';

function pctColor(p: number) {
  if (p >= 80) return 'bg-green-100 text-green-700 border-green-200';
  if (p >= 60) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function ScoresInner() {
  const sp = useSearchParams();

  const [results, setResults] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [student, setStudent] = useState('');
  const [school, setSchool] = useState('');
  const [quizId, setQuizId] = useState(sp.get('quizId') || 'all');
  const [classId, setClassId] = useState('all');
  const [branchId, setBranchId] = useState('all');

  const classMode = classId !== 'all';

  useEffect(() => {
    getQuizzes().then(setQuizzes).catch(() => {});
    getClasses().then(setClasses).catch(() => {});
    getBranches().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getQuizResults({ quizId: quizId !== 'all' ? quizId : undefined })
      .then(setResults)
      .catch((e) => toast.error(e.message || 'โหลดคะแนนไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [quizId]);

  useEffect(() => {
    if (!classMode) { setRoster([]); return; }
    setRosterLoading(true);
    getClassRoster(classId)
      .then(setRoster)
      .catch((e) => toast.error(e.message || 'โหลดรายชื่อคลาสไม่สำเร็จ'))
      .finally(() => setRosterLoading(false));
  }, [classId, classMode]);

  const matchSearch = (name: string, code: string, sch: string) => {
    if (student && !`${name} ${code || ''}`.toLowerCase().includes(student.toLowerCase())) return false;
    if (school && !(sch || '').toLowerCase().includes(school.toLowerCase())) return false;
    return true;
  };

  // attempts view (no class selected)
  const filteredAttempts = useMemo(
    () => results.filter((r) => matchSearch(r.student_name, r.student_code, r.school_name) && (branchId === 'all' || r.branch_id === branchId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, student, school, branchId]
  );

  // class roster view: aggregate each enrolled student's results
  const rosterRows = useMemo(() => {
    const byStudent = new Map<string, any[]>();
    for (const r of results) {
      if (!r.student_id) continue;
      const arr = byStudent.get(r.student_id) || [];
      arr.push(r);
      byStudent.set(r.student_id, arr);
    }
    return roster
      .filter((s) => matchSearch(s.name, s.student_code, s.school_name))
      .map((s) => {
        const rs = byStudent.get(s.id) || []; // results already sorted created_at desc
        const pcts = rs.map((r) => Number(r.percentage || 0));
        return {
          student: s,
          count: rs.length,
          best: pcts.length ? Math.max(...pcts) : null,
          avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
          last: rs.length ? rs[0].created_at : null,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, results, student, school]);

  const stats = useMemo(() => {
    if (classMode) {
      const done = rosterRows.filter((r) => r.count > 0);
      const avg = done.length ? Math.round(done.reduce((a, r) => a + (r.best || 0), 0) / done.length) : 0;
      return { a: rosterRows.length, aLabel: 'นักเรียนในคลาส', b: done.length, bLabel: 'ทำแล้ว', avg, max: done.length ? Math.max(...done.map((r) => r.best || 0)) : 0 };
    }
    const uniq = new Set(filteredAttempts.map((r) => r.student_id || r.student_name)).size;
    const pcts = filteredAttempts.map((r) => Number(r.percentage || 0));
    return {
      a: uniq, aLabel: 'นักเรียน',
      b: filteredAttempts.length, bLabel: 'ทำทั้งหมด',
      avg: pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : 0,
      max: pcts.length ? Math.max(...pcts) : 0,
    };
  }, [classMode, rosterRows, filteredAttempts]);

  const exportCsv = () => {
    let headers: string[]; let rows: any[][];
    if (classMode) {
      headers = ['รหัสนักเรียน', 'ชื่อนักเรียน', 'โรงเรียน', 'ทำแล้ว(ครั้ง)', 'สูงสุด%', 'เฉลี่ย%', 'ล่าสุด'];
      rows = rosterRows.map((r) => [r.student.student_code || '', r.student.name, r.student.school_name || '', r.count, r.best ?? '-', r.avg ?? '-', r.last ? new Date(r.last).toLocaleString('th-TH') : '-']);
    } else {
      headers = ['รหัสนักเรียน', 'ชื่อนักเรียน', 'สาขา', 'โรงเรียน', 'ข้อสอบ', 'คะแนน', 'คะแนนเต็ม', 'เปอร์เซ็นต์', 'จำนวนข้อ', 'เวลา(วินาที)', 'วันที่'];
      rows = filteredAttempts.map((r) => [r.student_code || '', r.student_name, r.branch_name || '', r.school_name || '', r.quiz_title_th || r.quiz_title || '', r.score, r.max_score, r.percentage, r.total_questions, r.total_time, r.created_at ? new Date(r.created_at).toLocaleString('th-TH') : '']);
    }
    const csv = '﻿' + [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `quiz-scores-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const classOptions = [{ value: 'all', label: 'ทุกคลาส' }, ...classes.map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name }))];
  const quizOptions = [{ value: 'all', label: 'ทุกข้อสอบ' }, ...quizzes.map((q) => ({ value: q.id, label: q.title_th || q.title }))];
  const branchOptions = [{ value: 'all', label: 'ทุกสาขา' }, ...branches.map((b) => ({ value: b.id, label: b.name }))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/quizzes"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-indigo-500" />คะแนนนักเรียน</h1>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={classMode ? rosterRows.length === 0 : filteredAttempts.length === 0}>
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <SearchInput placeholder="ค้นหา ชื่อ/รหัสนักเรียน..." value={student} onChange={setStudent} />
          <SearchInput placeholder="ค้นหาโรงเรียน..." value={school} onChange={setSchool} />
          <FormSelect value={branchId} onValueChange={setBranchId} options={branchOptions} />
          <FormSelect value={classId} onValueChange={setClassId} options={classOptions} />
          <FormSelect value={quizId} onValueChange={setQuizId} options={quizOptions} />
        </CardContent>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{stats.aLabel}</CardTitle><Users className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.a}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{stats.bLabel}</CardTitle><BarChart3 className="h-4 w-4 text-indigo-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.b}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">เฉลี่ย</CardTitle><Target className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.avg}%</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">สูงสุด</CardTitle><Trophy className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.max}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading || rosterLoading ? <SectionLoading /> : classMode ? (
            /* CLASS ROSTER VIEW */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>นักเรียน</TableHead>
                  <TableHead>โรงเรียน</TableHead>
                  <TableHead className="text-center">ทำแล้ว</TableHead>
                  <TableHead className="text-center">สูงสุด</TableHead>
                  <TableHead className="text-center">เฉลี่ย</TableHead>
                  <TableHead>ล่าสุด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosterRows.map((r) => (
                  <TableRow key={r.student.id} className={r.count === 0 ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="font-medium">{r.student.name}</div>
                      {r.student.student_code && <div className="font-mono text-xs text-red-600">{r.student.student_code}</div>}
                    </TableCell>
                    <TableCell className="text-gray-600">{r.student.school_name || '-'}</TableCell>
                    <TableCell className="text-center">{r.count > 0 ? `${r.count} ครั้ง` : <span className="text-gray-400">ยังไม่ทำ</span>}</TableCell>
                    <TableCell className="text-center">{r.best != null ? <Badge variant="outline" className={pctColor(r.best)}>{r.best}%</Badge> : '-'}</TableCell>
                    <TableCell className="text-center">{r.avg != null ? `${r.avg}%` : '-'}</TableCell>
                    <TableCell className="text-gray-500">{r.last ? formatDate(new Date(r.last), 'short') : '-'}</TableCell>
                  </TableRow>
                ))}
                {rosterRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">ไม่มีนักเรียนในคลาสนี้</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            /* ATTEMPTS VIEW */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>นักเรียน</TableHead>
                  <TableHead>สาขา</TableHead>
                  <TableHead>โรงเรียน</TableHead>
                  <TableHead>ข้อสอบ</TableHead>
                  <TableHead className="text-center">คะแนน</TableHead>
                  <TableHead className="text-center">เวลา</TableHead>
                  <TableHead>วันที่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.student_name}</div>
                      {r.student_code && <div className="font-mono text-xs text-red-600">{r.student_code}</div>}
                    </TableCell>
                    <TableCell className="text-gray-600">{r.branch_name || '-'}</TableCell>
                    <TableCell className="text-gray-600">{r.school_name || '-'}</TableCell>
                    <TableCell><span className="inline-flex items-center gap-1.5"><QuizIcon name={r.emoji} className="h-4 w-4 text-gray-400" />{r.quiz_title_th || r.quiz_title}</span></TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={pctColor(Number(r.percentage))}>{r.percentage}%</Badge>
                      <div className="text-xs text-gray-500 mt-0.5">{r.score}/{r.max_score}</div>
                    </TableCell>
                    <TableCell className="text-center text-gray-600">{formatTime(r.total_time || 0)}</TableCell>
                    <TableCell className="text-gray-500">{r.created_at ? formatDate(new Date(r.created_at), 'short') : '-'}</TableCell>
                  </TableRow>
                ))}
                {filteredAttempts.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">ยังไม่มีคะแนน</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuizScoresPage() {
  return (
    <Suspense fallback={<SectionLoading />}>
      <ScoresInner />
    </Suspense>
  );
}

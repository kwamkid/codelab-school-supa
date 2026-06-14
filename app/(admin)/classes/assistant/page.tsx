'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useBranch } from '@/contexts/BranchContext';
import { Subject, Room, Teacher } from '@/types/models';
import { getActiveSubjects } from '@/lib/services/subjects';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import { getActiveTeachers } from '@/lib/services/teachers';
import {
  findClassesForStudent,
  suggestNewClassSlots,
  getTopSubjects,
  type ClassMatch,
  type SuggestSlotResult,
  type StudentAvailabilitySlot,
} from '@/lib/services/scheduling-assistant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FormSelect } from '@/components/ui/form-select';
import { TimePicker } from '@/components/ui/time-range-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, CalendarPlus, Loader2, Users, Clock, MapPin, AlertTriangle,
  CheckCircle2, CalendarDays, GraduationCap, ChevronLeft, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DAY_LABELS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const DAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function dowList(days: number[]) {
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

function fmtThai(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function SectionTitle({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {desc && <p className="text-sm text-gray-500">{desc}</p>}
      </div>
    </div>
  );
}

export default function SchedulingAssistantPage() {
  const { selectedBranchId } = useBranch();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    getActiveSubjects().then(setSubjects).catch(() => {});
  }, []);
  useEffect(() => {
    if (!selectedBranchId) { setRooms([]); setTeachers([]); return; }
    getActiveRoomsByBranch(selectedBranchId).then(setRooms).catch(() => {});
    getActiveTeachers(selectedBranchId).then(setTeachers).catch(() => {});
  }, [selectedBranchId]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/classes" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2">
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้าคลาสเรียน
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-violet-500" />
          ผู้ช่วยจัดตาราง
        </h1>
        <p className="text-gray-600 mt-1">หาคลาสให้เด็กใหม่ หรือดูว่าจะเปิดคลาสใหม่ช่วงไหนได้บ้าง</p>
      </div>

      {!selectedBranchId ? (
        <Card><CardContent className="py-10 text-center text-gray-500">กรุณาเลือกสาขาก่อนใช้งาน</CardContent></Card>
      ) : (
        <Tabs defaultValue="find" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="find" className="gap-2"><Search className="h-4 w-4" />หาคลาสให้เด็ก</TabsTrigger>
            <TabsTrigger value="open" className="gap-2"><CalendarPlus className="h-4 w-4" />เปิดคลาสใหม่</TabsTrigger>
          </TabsList>

          <TabsContent value="find">
            <FindClassTab subjects={subjects} branchId={selectedBranchId} />
          </TabsContent>
          <TabsContent value="open">
            <OpenClassTab subjects={subjects} rooms={rooms} teachers={teachers} branchId={selectedBranchId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================
// Tab 1 — Find class for a student
// ============================================================
function FindClassTab({ subjects, branchId }: { subjects: Subject[]; branchId: string }) {
  const [subjectId, setSubjectId] = useState('');
  const [age, setAge] = useState('');
  const [availDays, setAvailDays] = useState<number[]>([]);
  const [availStart, setAvailStart] = useState('09:00');
  const [availEnd, setAvailEnd] = useState('18:00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ exact: ClassMatch[]; nearby: ClassMatch[] } | null>(null);
  const [topSubjects, setTopSubjects] = useState<{ id: string; name: string; color: string; count: number }[]>([]);

  useEffect(() => {
    getTopSubjects(branchId, 3).then(setTopSubjects).catch(() => {});
  }, [branchId]);

  // Quick presets
  const AGE_PRESETS = [6, 8, 10, 12, 14];
  const TIME_PRESETS = [
    { label: 'เช้า', start: '09:00', end: '12:00' },
    { label: 'บ่าย', start: '13:00', end: '16:00' },
    { label: 'เย็น', start: '16:00', end: '18:00' },
    { label: 'ทั้งวัน', start: '09:00', end: '18:00' },
  ];

  const toggleDay = (d: number) =>
    setAvailDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSearch = async () => {
    if (!subjectId) { toast.error('กรุณาเลือกวิชา'); return; }
    setLoading(true);
    try {
      const availability: StudentAvailabilitySlot[] = availDays.map((d) => ({
        dayOfWeek: d, startTime: availStart, endTime: availEnd,
      }));
      const res = await findClassesForStudent({
        subjectId, branchId,
        age: age ? parseInt(age) : undefined,
        availability: availability.length ? availability : undefined,
      });
      setResult(res);
    } catch (e) {
      console.error(e);
      toast.error('ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon={Search} title="ข้อมูลเด็ก" desc="กรอกเพื่อค้นหาคลาสที่เข้าได้" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>วิชาที่สนใจ *</Label>
              <FormSelect
                value={subjectId}
                onValueChange={setSubjectId}
                placeholder="เลือกวิชา"
                searchPlaceholder="ค้นหาวิชา..."
                options={subjects.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
              />
              {topSubjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topSubjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubjectId(s.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        subjectId === s.id ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary'
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                      <span className="text-gray-400">({s.count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>อายุเด็ก (ปี)</Label>
              <Input type="number" min="0" value={age} onChange={(e) => setAge(e.target.value)} placeholder="เช่น 9" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {AGE_PRESETS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAge(String(a))}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      age === String(a) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary'
                    )}
                  >
                    {a} ปี
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>ช่วงเวลาที่ว่าง</Label>
              <div className="flex gap-2">
                <TimePicker value={availStart} onChange={setAvailStart} />
                <TimePicker value={availEnd} onChange={setAvailEnd} min={availStart} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TIME_PRESETS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => { setAvailStart(t.start); setAvailEnd(t.end); }}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      availStart === t.start && availEnd === t.end ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-primary'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>วันที่เด็กว่าง (เว้นว่าง = ทุกวัน)</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    availDays.includes(d)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <Button onClick={handleSearch} disabled={loading} className="min-w-[140px]">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังค้นหา...</> : <><Search className="h-4 w-4 mr-2" />ค้นหาคลาส</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (() => {
        // "ตรง" = the requested subject AND it fits the student's day/time (seats
        // already guaranteed). Everything else (same subject off-time, or nearby
        // subjects) goes to "แนะนำเพิ่ม".
        const matched = result.exact.filter((m) => m.fitsAvailability);
        const suggested = [
          ...result.exact.filter((m) => !m.fitsAvailability),
          ...result.nearby,
        ];
        return (
          <div className="space-y-6">
            <ClassMatchList title="✅ ตรงกับที่ต้องการ" matches={matched} emptyText="ไม่มีคลาสวิชานี้ที่ตรงวัน/เวลาที่เด็กว่าง — ดูคลาสแนะนำเพิ่มด้านล่าง" />
            {suggested.length > 0 && (
              <ClassMatchList title="💡 แนะนำเพิ่มเติม" matches={suggested} emptyText="" />
            )}
          </div>
        );
      })()}
    </div>
  );
}

function ClassMatchList({ title, matches, emptyText }: { title: string; matches: ClassMatch[]; emptyText: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title} ({matches.length})</h3>
      {matches.length === 0 ? (
        emptyText ? <p className="text-sm text-gray-400">{emptyText}</p> : null
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {matches.map((m) => (
            <Card key={m.classId} className={cn((!m.fitsAvailability || m.isFull) && 'opacity-70')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 truncate">{m.subjectName}</p>
                      {m.isFull && <Badge className="bg-red-100 text-red-700 text-[10px] shrink-0">เต็ม</Badge>}
                      {!m.isExactSubject && <Badge variant="outline" className="text-violet-600 border-violet-200 text-[10px] shrink-0">ใกล้เคียง</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{m.classCode}</p>
                  </div>
                  <Badge variant={m.makeupCount === 0 ? 'secondary' : 'outline'} className={m.makeupCount === 0 ? 'bg-green-100 text-green-700' : 'text-amber-700'}>
                    {m.makeupCount === 0 ? 'ไม่ต้อง makeup' : `makeup ${m.makeupCount} ครั้ง`}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gray-400" />{dowList(m.daysOfWeek)} · {m.startTime}-{m.endTime}</div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />เริ่มเรียน {fmtThai(m.classStartDate)}</div>
                  {m.hasStarted && (
                    <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />คลาสถัดไป {m.nextSessionDate ? fmtThai(m.nextSessionDate) : '-'} {m.nextSessionNumber ? `(ครั้งที่ ${m.nextSessionNumber}/${m.totalSessions})` : ''}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    {m.isFull ? (
                      <span className="text-red-600 font-medium">เต็ม ({m.enrolledCount}/{m.maxStudents})</span>
                    ) : (
                      <span>ที่นั่งว่าง {m.seatsLeft}/{m.maxStudents}</span>
                    )}
                  </div>
                </div>

                {/* Enrolled classmates: nickname · age · school */}
                {m.classmates.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    <p className="text-xs text-gray-400 mb-1">
                      เด็กในคลาส{m.avgClassmateAge != null ? ` (อายุเฉลี่ย ${m.avgClassmateAge} ปี)` : ''}
                    </p>
                    <div className="space-y-0.5">
                      {m.classmates.map((c, i) => (
                        <div key={i} className="text-xs text-gray-600">
                          {c.nickname}
                          {c.age != null && <span className="text-gray-400"> · {c.age} ปี</span>}
                          {c.schoolName && <span className="text-gray-400"> · {c.schoolName}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {!m.fitsDay && <Badge variant="outline" className="text-orange-600 border-orange-200"><AlertTriangle className="h-3 w-3 mr-1" />ไม่ตรงวันที่ว่าง</Badge>}
                  {m.fitsDay && !m.fitsTime && <Badge variant="outline" className="text-orange-600 border-orange-200"><AlertTriangle className="h-3 w-3 mr-1" />ไม่ตรงเวลาที่ว่าง</Badge>}
                  {m.ageFits === false && <Badge variant="outline" className="text-orange-600 border-orange-200"><AlertTriangle className="h-3 w-3 mr-1" />อายุไม่ตรงช่วงวิชา</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab 2 — Suggest when to open a new class
// ============================================================
function OpenClassTab({ subjects, rooms, teachers, branchId }: { subjects: Subject[]; rooms: Room[]; teachers: Teacher[]; branchId: string }) {
  const [roomId, setRoomId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [totalSessions, setTotalSessions] = useState('12');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestSlotResult | null>(null);

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleCheck = async () => {
    if (!roomId || !teacherId) { toast.error('กรุณาเลือกห้องและครู'); return; }
    if (!startDate) { toast.error('กรุณาเลือกวันที่เริ่ม'); return; }
    if (days.length === 0) { toast.error('กรุณาเลือกวันเรียน'); return; }
    const n = parseInt(totalSessions);
    if (!n || n < 1) { toast.error('จำนวนครั้งไม่ถูกต้อง'); return; }
    setLoading(true);
    try {
      const res = await suggestNewClassSlots({
        branchId, roomId, teacherId, startTime, endTime,
        startDate: new Date(startDate + 'T00:00:00'),
        daysOfWeek: days, totalSessions: n,
      });
      setResult(res);
    } catch (e) {
      console.error(e);
      toast.error('ตรวจสอบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <SectionTitle icon={CalendarPlus} title="ข้อมูลคลาสใหม่" desc="ระบุห้อง ครู และเวลา เพื่อเช็คว่าเปิดได้ครบกี่ครั้ง" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>วิชา</Label>
              <FormSelect value={subjectId} onValueChange={setSubjectId} placeholder="เลือกวิชา" searchPlaceholder="ค้นหาวิชา..."
                options={subjects.map((s) => ({ value: s.id, label: s.name, color: s.color }))} />
            </div>
            <div className="space-y-2">
              <Label>ห้องเรียน *</Label>
              <FormSelect value={roomId} onValueChange={setRoomId} placeholder="เลือกห้อง"
                options={rooms.map((r) => ({ value: r.id, label: `${r.name} (จุ ${r.capacity})` }))} />
            </div>
            <div className="space-y-2">
              <Label>ครูผู้สอน *</Label>
              <FormSelect value={teacherId} onValueChange={setTeacherId} placeholder="เลือกครู" searchPlaceholder="ค้นหาครู..."
                options={teachers.map((t) => ({ value: t.id, label: t.nickname || t.name }))} />
            </div>
            <div className="space-y-2">
              <Label>วันที่เริ่ม *</Label>
              <DateRangePicker mode="single" value={startDate} onChange={(d) => setStartDate(d || '')} minDate={new Date()} placeholder="เลือกวันที่" />
            </div>
            <div className="space-y-2">
              <Label>ช่วงเวลา *</Label>
              <div className="flex gap-2">
                <TimePicker value={startTime} onChange={setStartTime} />
                <TimePicker value={endTime} onChange={setEndTime} min={startTime} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>จำนวนครั้ง *</Label>
              <Input type="number" min="1" value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>วันเรียนในสัปดาห์ *</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    days.includes(d) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <Button onClick={handleCheck} disabled={loading} className="min-w-[160px]">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังตรวจสอบ...</> : <><CalendarPlus className="h-4 w-4 mr-2" />ตรวจสอบช่วงเวลา</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && <OpenClassResult result={result} totalSessions={parseInt(totalSessions)} />}
    </div>
  );
}

function OpenClassResult({ result, totalSessions }: { result: SuggestSlotResult; totalSessions: number }) {
  if (result.sessions.length === 0) {
    return <Card><CardContent className="py-8 text-center text-gray-500">ไม่สามารถสร้างตารางได้ (อาจติดวันหยุดทั้งหมดในช่วงที่กำหนด)</CardContent></Card>;
  }
  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      {result.canOpenFully ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">เปิดคลาสได้ครบ {totalSessions} ครั้ง</p>
              <p className="text-sm text-green-700">เรียนจบ {result.lastSessionDate ? fmtThai(result.lastSessionDate) : '-'} โดยไม่ชนห้อง/ครู</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">
                เปิดได้แค่ {result.conflictFreeLeading} ครั้งแรก แล้วชนที่ครั้งที่ {result.firstConflictSession}
              </p>
              <p className="text-sm text-amber-700">ลองเลื่อนวันเริ่ม เปลี่ยนห้อง/ครู หรือเปลี่ยนวันเรียน</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session-by-session */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">ไล่ทุกครั้ง ({result.sessions.length} ครั้ง)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.sessions.map((s) => (
              <div key={s.sessionNumber} className={cn('rounded-lg border p-2.5 text-sm', s.ok ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50')}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">ครั้งที่ {s.sessionNumber}</span>
                  {s.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{fmtThai(s.date)}</div>
                {s.conflicts.map((c, i) => (
                  <div key={i} className="text-xs text-red-600 mt-1">{c.message}</div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

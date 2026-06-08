'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  CalendarDays,
  GraduationCap,
  Presentation,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { AttendanceDialog } from '@/components/attendance/attendance-dialog';

// --- Types ---

interface TeacherStudent {
  id: string;
  nickname: string;
  name: string;
}

interface TeacherScheduleItem {
  schedule_id: string;
  class_id: string;
  type: 'class' | 'makeup' | 'trial';
  subject_name: string;
  subject_color: string;
  class_name: string;
  class_code: string;
  start_time: string;
  end_time: string;
  enrolled_count: number | null;
  max_students: number | null;
  session_number: number | null;
  total_sessions: number | null;
  schedule_status: string;
  room_name: string;
  branch_name: string;
  subject_id: string | null;
  material_id: string | null;
  students: TeacherStudent[];
}

// --- Helpers ---

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function formatDateThai(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `วัน${days[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  makeup: { label: 'เรียนชดเชย', className: 'bg-purple-100 text-purple-700' },
  trial: { label: 'ทดลองเรียน', className: 'bg-orange-100 text-orange-700' },
};

// --- Class Card ---

function ScheduleCard({
  item,
  onCheckAttendance,
}: {
  item: TeacherScheduleItem;
  onCheckAttendance: (item: TeacherScheduleItem) => void;
}) {
  const badge = TYPE_BADGE[item.type];
  const studentCount = item.students.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        {/* Color accent + time */}
        <div
          className="w-1.5 shrink-0"
          style={{ backgroundColor: item.subject_color }}
        />
        <CardContent className="flex-1 p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900">{item.subject_name}</span>
                {badge && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                {item.session_number != null && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    ครั้งที่ {item.session_number}
                    {item.total_sessions != null && `/${item.total_sessions}`}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5 truncate">{item.class_name}</p>
            </div>

            {/* Time */}
            <div className="flex items-center gap-1.5 text-base font-semibold text-gray-800 shrink-0">
              <Clock className="h-4 w-4 text-orange-500" />
              {item.start_time} - {item.end_time}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
            {item.room_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {item.room_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {studentCount} คน
              {item.max_students != null && ` / ${item.max_students}`}
            </span>
            {item.branch_name && (
              <span className="text-gray-400">{item.branch_name}</span>
            )}
          </div>

          {/* Students */}
          {studentCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {item.students.map((s, i) => (
                <span
                  key={s.id || `${item.schedule_id}-${i}`}
                  className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-sm text-gray-700"
                  title={s.name}
                >
                  {s.nickname || s.name}
                </span>
              ))}
            </div>
          )}

          {/* Actions: check-in (regular classes) + open slide (classes + makeup).
              Slide is matched by subject + session number; makeup uses the original session. */}
          {(item.type === 'class' || item.type === 'makeup') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.type === 'class' && (
                <Button
                  variant="outline"
                  onClick={() => onCheckAttendance(item)}
                  className="border-green-300 text-green-700 hover:bg-green-50 hover:text-green-700"
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  เช็คชื่อ
                </Button>
              )}
              {item.material_id && item.subject_id ? (
                <Button
                  asChild
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href={`/teaching/slides/${item.subject_id}/${item.material_id}`}>
                    <Presentation className="h-4 w-4 mr-2" />
                    เปิดสไลด์การสอน
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" disabled className="text-gray-400">
                  <Presentation className="h-4 w-4 mr-2" />
                  ยังไม่มีสไลด์
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

// --- Stat card ---

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-500">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Page ---

export default function TeacherHomePage() {
  const { adminUser, teacher } = useAuth();
  const { selectedBranchId, isAllBranches } = useBranch();

  const teacherId = adminUser?.teacherId;
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TeacherScheduleItem[]>([]);

  const isToday = selectedDate === toDateStr(new Date());
  const teacherLabel = teacher?.nickname || teacher?.name || adminUser?.displayName || '';

  // Attendance dialog (opened from a class card)
  const [attItem, setAttItem] = useState<TeacherScheduleItem | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!teacherId) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const supabase = getClient();
      const { data, error } = await (supabase as any).rpc('get_teacher_daily_schedule', {
        p_teacher_id: teacherId,
        p_date: selectedDate,
        p_branch_id: selectedBranchId || null,
      });
      if (error) throw error;
      setItems((data as TeacherScheduleItem[]) || []);
    } catch (error) {
      console.error('Error loading teacher schedule:', error);
      toast.error('ไม่สามารถโหลดตารางสอนได้');
    } finally {
      setLoading(false);
    }
  }, [teacherId, selectedDate, selectedBranchId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const totalStudents = useMemo(
    () => items.reduce((sum, it) => sum + it.students.length, 0),
    [items]
  );

  // Not a teacher account
  if (adminUser && !teacherId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
          <GraduationCap className="h-12 w-12 mb-3" />
          <p className="text-lg font-medium">หน้านี้สำหรับครูผู้สอน</p>
          <p className="text-sm mt-1">บัญชีของคุณไม่ได้เชื่อมกับข้อมูลครู</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            สวัสดี{teacherLabel ? ` ครู${teacherLabel}` : ''} 👋
          </h1>
          <p className="text-base text-gray-600 mt-1">
            {formatDateThai(selectedDate)}
            {isToday && <span className="text-orange-600 font-medium ml-1">(วันนี้)</span>}
            {!isAllBranches && <span className="text-red-600 font-medium ml-2">(เฉพาะสาขาที่เลือก)</span>}
          </p>
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setSelectedDate(toDateStr(new Date()))}>
              วันนี้
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="คลาสที่ต้องสอน" value={items.length} />
        <StatCard icon={<Users className="h-5 w-5" />} label="นักเรียนที่ต้องดูแล" value={totalStudents} />
      </div>

      {/* Schedule list */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CalendarDays className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">{isToday ? 'วันนี้ไม่มีคลาสสอน' : 'ไม่มีคลาสสอนในวันนี้'}</p>
            <p className="text-sm mt-1">พักผ่อนได้เลย 😊</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <ScheduleCard
              key={`${item.type}-${item.schedule_id}`}
              item={item}
              onCheckAttendance={setAttItem}
            />
          ))}
        </div>
      )}

      {/* Attendance check-in (regular classes) */}
      {attItem && attItem.type === 'class' && (
        <AttendanceDialog
          open={!!attItem}
          onOpenChange={(o) => { if (!o) setAttItem(null); }}
          classId={attItem.class_id}
          className={`${attItem.subject_name} · ${attItem.class_name}`}
          classCode={attItem.class_code}
          scheduleId={attItem.schedule_id}
          onSaved={() => { setAttItem(null); loadSchedule(); }}
        />
      )}
    </div>
  );
}

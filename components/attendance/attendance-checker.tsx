'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getClass, getClassSchedule } from '@/lib/services/classes';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { getTeachersByBranch } from '@/lib/services/teachers';
import { getStudentWithParent } from '@/lib/services/parents';
import { saveAttendanceWithMakeup } from '@/lib/services/attendance';
import { Class, ClassSchedule, Teacher } from '@/types/models';
import { formatDateWithDay, formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ClockIcon as ClockIconOutline,
  Save,
  UserCheck,
  AlertTriangle,
  CheckCheck,
  Loader2,
} from 'lucide-react';

interface StudentAttendance {
  studentId: string;
  studentName: string;
  studentNickname?: string;
  parentId: string;
  parentName: string;
  status: 'present' | 'absent' | 'late' | 'sick' | 'leave' | '';
  note: string;
  feedback: string;
}

export interface AttendanceCheckerProps {
  classId: string;
  scheduleId: string;
  /** Show the class/session header inside the component (default true) */
  showHeader?: boolean;
  /** Called after a successful save */
  onSaved?: (result: { makeupCreated: number; makeupCancelled: number; limitExceeded: string[] }) => void;
  /** Cancel / back action */
  onCancel?: () => void;
  cancelLabel?: string;
}

export function AttendanceChecker({
  classId,
  scheduleId,
  showHeader = true,
  onSaved,
  onCancel,
  cancelLabel = 'ยกเลิก',
}: AttendanceCheckerProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classData, setClassData] = useState<Class | null>(null);
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [actualTeacherId, setActualTeacherId] = useState<string>('');
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [initialAttendance, setInitialAttendance] = useState<Record<string, string>>({});
  const [globalNote, setGlobalNote] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        setLoading(true);
        setNotFound(false);
        const [cls, sched, enrollments] = await Promise.all([
          getClass(classId),
          getClassSchedule(classId, scheduleId),
          getEnrollmentsByClass(classId),
        ]);

        if (!cls || !sched) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (cancelled) return;

        setClassData(cls);
        setSchedule(sched);
        setActualTeacherId(sched.actualTeacherId || cls.teacherId);

        const branchTeachers = await getTeachersByBranch(cls.branchId);
        if (cancelled) return;
        setTeachers(branchTeachers);

        const enrolledStudentIds = [...new Set(
          enrollments.filter(e => e.status === 'active' || e.status === 'completed').map(e => e.studentId)
        )];

        const studentsWithDetails = await Promise.all(
          enrolledStudentIds.map(async (studentId) => {
            const studentData = await getStudentWithParent(studentId);
            if (!studentData) return null;
            const existing = sched.attendance?.find(att => att.studentId === studentId);
            return {
              studentId,
              studentName: studentData.name,
              studentNickname: studentData.nickname,
              parentId: studentData.parentId,
              parentName: studentData.parentName,
              status: existing?.status || '',
              note: existing?.note || '',
              feedback: existing?.feedback || '',
            } as StudentAttendance;
          })
        );
        if (cancelled) return;

        const validStudents = (studentsWithDetails.filter(Boolean) as StudentAttendance[]).sort(
          (a, b) => (a.studentNickname?.localeCompare(b.studentNickname || '') || a.studentName.localeCompare(b.studentName))
        );
        setAttendance(validStudents);

        const initialMap: Record<string, string> = {};
        validStudents.forEach(s => { if (s.status) initialMap[s.studentId] = s.status; });
        setInitialAttendance(initialMap);
        setIsEditMode(Object.keys(initialMap).length > 0);
        if (sched.note) setGlobalNote(sched.note);
      } catch (error) {
        console.error('Error loading attendance data:', error);
        if (!cancelled) {
          toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [classId, scheduleId]);

  const handleAttendanceChange = (studentId: string, status: StudentAttendance['status']) => {
    setAttendance(prev => prev.map(att => (att.studentId === studentId ? { ...att, status } : att)));
    setHasChanges(true);
  };
  const handleNoteChange = (studentId: string, note: string) => {
    setAttendance(prev => prev.map(att => (att.studentId === studentId ? { ...att, note } : att)));
    setHasChanges(true);
  };
  const handleFeedbackChange = (studentId: string, feedback: string) => {
    setAttendance(prev => prev.map(att => (att.studentId === studentId ? { ...att, feedback } : att)));
    setHasChanges(true);
  };
  const handleMarkAllPresent = () => {
    setAttendance(prev => prev.map(att => ({ ...att, status: 'present' })));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveAttendanceWithMakeup({
        classId,
        scheduleId,
        records: attendance.map(a => ({
          studentId: a.studentId,
          studentName: a.studentNickname || a.studentName,
          status: a.status,
          note: a.note,
          feedback: a.feedback,
        })),
        initialStatuses: initialAttendance,
        checkedBy: user?.uid || '',
        actualTeacherId,
        globalNote,
        sessionNumber: schedule?.sessionNumber,
        sessionDate: schedule?.sessionDate,
      });

      const parts: string[] = [];
      if (res.makeupCancelled > 0) parts.push(`ยกเลิก Makeup ${res.makeupCancelled} คน`);
      if (res.makeupCreated > 0) parts.push(`สร้าง Makeup ${res.makeupCreated} คน`);
      if (res.limitExceeded.length > 0) parts.push(`เกินลิมิต: ${res.limitExceeded.join(', ')}`);
      toast.success(parts.length ? `บันทึกการเช็คชื่อเรียบร้อยแล้ว (${parts.join(' / ')})` : 'บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      onSaved?.(res);
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const stats = (() => {
    const checked = attendance.filter(a => a.status !== '');
    return {
      total: attendance.length,
      checked: checked.length,
      present: checked.filter(a => a.status === 'present').length,
      absent: checked.filter(a => a.status === 'absent').length,
      late: checked.filter(a => a.status === 'late').length,
      sick: checked.filter(a => a.status === 'sick').length,
      leave: checked.filter(a => a.status === 'leave').length,
    };
  })();

  const getStatusButton = (status: StudentAttendance['status']) => {
    const configs = {
      present: { label: 'มา', icon: CheckCircle, color: 'border border-green-200 text-green-700 bg-green-50 hover:bg-green-200 dark:border-green-900 dark:text-green-300 dark:bg-green-950/40 dark:hover:bg-green-900/50', activeColor: 'border border-green-600 text-white bg-green-600 hover:bg-green-700' },
      absent: { label: 'ขาด', icon: XCircle, color: 'border border-red-200 text-red-700 bg-red-50 hover:bg-red-200 dark:border-red-900 dark:text-red-300 dark:bg-red-950/40 dark:hover:bg-red-900/50', activeColor: 'border border-red-600 text-white bg-red-600 hover:bg-red-700' },
      late: { label: 'สาย', icon: ClockIconOutline, color: 'border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-200 dark:border-orange-900 dark:text-orange-300 dark:bg-orange-950/40 dark:hover:bg-orange-900/50', activeColor: 'border border-orange-600 text-white bg-orange-600 hover:bg-orange-700' },
      sick: { label: 'ป่วย', icon: AlertTriangle, color: 'border border-yellow-200 text-yellow-700 bg-yellow-50 hover:bg-yellow-200 dark:border-yellow-900 dark:text-yellow-300 dark:bg-yellow-950/40 dark:hover:bg-yellow-900/50', activeColor: 'border border-yellow-600 text-white bg-yellow-600 hover:bg-yellow-700' },
      leave: { label: 'ลา', icon: AlertCircle, color: 'border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-200 dark:border-blue-900 dark:text-blue-300 dark:bg-blue-950/40 dark:hover:bg-blue-900/50', activeColor: 'border border-blue-600 text-white bg-blue-600 hover:bg-blue-700' },
    };
    return configs[status as keyof typeof configs];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> กำลังโหลดข้อมูล...
      </div>
    );
  }
  if (notFound || !classData || !schedule) {
    return <div className="py-12 text-center text-gray-500">ไม่พบข้อมูลคาบเรียน</div>;
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div>
          <h2 className="text-xl font-bold tracking-tight">เช็คชื่อ - {classData.name}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground mt-2 text-sm">
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />ครั้งที่ {schedule.sessionNumber}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatDateWithDay(schedule.sessionDate)}</span>
            <span>{formatTime(classData.startTime)} - {formatTime(classData.endTime)}</span>
          </div>
        </div>
      )}

      {/* Teacher (compact inline) */}
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-sm text-muted-foreground shrink-0">ครูผู้สอน</Label>
        <Select value={actualTeacherId} onValueChange={(value) => { setActualTeacherId(value); setHasChanges(true); }}>
          <SelectTrigger className="h-9 w-auto min-w-[180px]">
            <SelectValue placeholder="เลือกครู" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  <span>{teacher.nickname || teacher.name}</span>
                  {teacher.id === classData.teacherId && (
                    <Badge variant="secondary" className="ml-2 text-xs">ครูประจำ</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {actualTeacherId !== classData.teacherId && (
          <span className="text-xs text-amber-600 dark:text-amber-400">* สอนแทน</span>
        )}
      </div>

      {/* Student list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <CardTitle className="text-base">รายชื่อนักเรียน ({attendance.length} คน)</CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-300">เช็คแล้ว: {stats.checked}/{stats.total}</span>
              <span className="text-green-600">มา: {stats.present}</span>
              <span className="text-red-600">ขาด: {stats.absent + stats.sick + stats.leave}</span>
              <span className="text-orange-600">สาย: {stats.late}</span>
              <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>
                <CheckCheck className="h-4 w-4 mr-1" /> มาทั้งหมด
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-center py-6 text-gray-500">ยังไม่มีนักเรียนลงทะเบียน</p>
          ) : (
            <div className="divide-y dark:divide-slate-700">
              {attendance.map((student, index) => (
                <div key={student.studentId} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {index + 1}. {student.studentNickname || student.studentName}
                        {student.studentNickname && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">({student.studentName})</span>
                        )}
                      </p>
                      <Link
                        href={`/parents/${student.parentId}`}
                        className="text-[11px] text-blue-600 hover:underline truncate block dark:text-blue-400"
                      >
                        {student.parentName}
                      </Link>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {(['present', 'late', 'absent', 'leave', 'sick'] as const).map((status) => {
                        const config = getStatusButton(status);
                        const Icon = config.icon;
                        const isSelected = student.status === status;
                        return (
                          <Tooltip key={status} label={config.label}>
                            <button
                              onClick={() => handleAttendanceChange(student.studentId, status)}
                              aria-label={config.label}
                              className={cn(
                                'inline-flex items-center justify-center rounded-md h-8 w-8 transition-colors',
                                isSelected ? config.activeColor : config.color
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>

                  {(student.status === 'absent' || student.status === 'sick' || student.status === 'leave') && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                      <AlertCircle className="h-3 w-3 shrink-0" /> จะสร้าง Makeup อัตโนมัติเมื่อบันทึก
                    </p>
                  )}

                  {student.status !== 'present' && student.status !== '' && (
                    <Textarea
                      placeholder="หมายเหตุ..."
                      value={student.note}
                      onChange={(e) => handleNoteChange(student.studentId, e.target.value)}
                      className="h-14 mt-2 text-sm"
                    />
                  )}

                  {(student.status === 'present' || student.status === 'late') && (
                    <Textarea
                      placeholder="Feedback ถึงผู้ปกครอง (ไม่บังคับ)..."
                      value={student.feedback}
                      onChange={(e) => handleFeedbackChange(student.studentId, e.target.value)}
                      className="h-14 mt-2 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {cancelLabel}
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || !hasChanges || (!isEditMode && stats.checked < stats.total)}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</>
          ) : !isEditMode && stats.checked < stats.total ? (
            <><AlertCircle className="h-4 w-4 mr-2" />เช็คให้ครบ ({stats.checked}/{stats.total})</>
          ) : (
            <><Save className="h-4 w-4 mr-2" />{isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกการเช็คชื่อ'}</>
          )}
        </Button>
      </div>
    </div>
  );
}

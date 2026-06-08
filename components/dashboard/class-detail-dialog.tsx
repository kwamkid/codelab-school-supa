'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { CalendarEvent } from '@/lib/services/dashboard';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  UserCircle,
  School,
  ClipboardCheck,
  Pencil,
  Check,
  X,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { getStudent } from '@/lib/services/parents';
import { updateTrialSession } from '@/lib/services/trial-bookings';
import { recordMakeupAttendance, updateMakeupAttendance } from '@/lib/services/makeup';
import { getAttendanceBySchedule, saveAttendanceWithMakeup, type AttendanceStatus } from '@/lib/services/attendance';
import { useAuth } from '@/hooks/useSupabaseAuth';
import { Enrollment } from '@/types/models';

const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: 'present', label: 'มา', active: 'bg-green-500 text-white border-green-500' },
  { value: 'late', label: 'สาย', active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'absent', label: 'ขาด', active: 'bg-red-500 text-white border-red-500' },
  { value: 'leave', label: 'ลา', active: 'bg-blue-500 text-white border-blue-500' },
  { value: 'sick', label: 'ป่วย', active: 'bg-purple-500 text-white border-purple-500' },
];
import { ChangeTeacherPanel } from './change-teacher-dialog';

const THAI_MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// e.g. "6 มิ.ย. 69"
function formatThaiShortDate(d: Date): string {
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS_ABBR[d.getMonth()]} ${yy}`;
}

interface ClassDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  scheduleId: string;
  onAttendanceSaved?: () => void;
  onTeacherChanged?: () => void;
}

interface EnrolledStudent {
  id: string;
  name: string;
  nickname: string;
  parentId: string;
}

export default function ClassDetailDialog({ 
  open, 
  onOpenChange, 
  event,
  scheduleId,
  onAttendanceSaved,
  onTeacherChanged
}: ClassDetailDialogProps) {
  const { adminUser } = useAuth();
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showChangeTeacher, setShowChangeTeacher] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  // Inline attendance (regular class)
  const [showAttendance, setShowAttendance] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);
  const [attMap, setAttMap] = useState<Record<string, AttendanceStatus>>({});
  const [attInitial, setAttInitial] = useState<Record<string, string>>({});
  // Locally reflect a teacher change without closing/reopening the modal
  const [teacherOverride, setTeacherOverride] = useState<{ name: string; image?: string } | null>(null);

  // Reset transient state whenever a different session is opened
  useEffect(() => {
    setShowChangeTeacher(false);
    setShowAttendance(false);
    setTeacherOverride(null);
  }, [scheduleId]);

  useEffect(() => {
    if (open && event && event.extendedProps.type === 'class') {
      console.log('=== Class Detail Dialog Debug ===');
      console.log('Event:', event);
      console.log('Event title:', event.title);
      console.log('Event extendedProps:', event.extendedProps);
      console.log('className:', (event.extendedProps as any).className);
      console.log('All props:', JSON.stringify(event.extendedProps, null, 2));
      console.log('================================');
      loadEnrolledStudents();
    }
  }, [open, event]);

  const loadEnrolledStudents = async () => {
    if (!event || event.extendedProps.type !== 'class') return;
    
    setLoadingStudents(true);
    try {
      // Get enrollments for this class
      const enrollments = await getEnrollmentsByClass(event.classId);
      
      // Get student details for each enrollment
      const studentsData: EnrolledStudent[] = [];
      for (const enrollment of enrollments) {
        const student = await getStudent(enrollment.parentId, enrollment.studentId);
        if (student) {
          studentsData.push({
            id: student.id,
            name: student.name,
            nickname: student.nickname,
            parentId: enrollment.parentId
          });
        }
      }
      
      // Sort by nickname
      studentsData.sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'));
      setEnrolledStudents(studentsData);
    } catch (error) {
      console.error('Error loading enrolled students:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  if (!event) return null;

  const isMakeup = event.extendedProps.type === 'makeup';
  const isTrial = event.extendedProps.type === 'trial';
  const isRegularClass = event.extendedProps.type === 'class';

  // Enter inline attendance (regular class) — default everyone present, prefill existing
  const enterAttendance = async () => {
    setShowAttendance(true);
    setAttLoading(true);
    try {
      const existing = await getAttendanceBySchedule(scheduleId);
      const initial: Record<string, string> = {};
      const map: Record<string, AttendanceStatus> = {};
      enrolledStudents.forEach((s) => {
        const rec = existing.find((e) => e.studentId === s.id);
        initial[s.id] = rec?.status || '';
        map[s.id] = (rec?.status as AttendanceStatus) || 'present';
      });
      setAttInitial(initial);
      setAttMap(map);
    } catch {
      const map: Record<string, AttendanceStatus> = {};
      enrolledStudents.forEach((s) => { map[s.id] = 'present'; });
      setAttMap(map);
      setAttInitial({});
    } finally {
      setAttLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!event) return;
    setAttSaving(true);
    try {
      const records = enrolledStudents.map((s) => ({
        studentId: s.id,
        studentName: s.nickname || s.name,
        status: attMap[s.id] || ('present' as AttendanceStatus),
      }));
      const res = await saveAttendanceWithMakeup({
        classId: event.classId,
        scheduleId,
        records,
        initialStatuses: attInitial,
        checkedBy: adminUser?.id || 'system',
        sessionNumber: event.extendedProps.sessionNumber,
        sessionDate: event.start as Date,
      });
      if (res.makeupCreated > 0) toast.success(`สร้าง Makeup ${res.makeupCreated} คน`);
      if (res.limitExceeded.length > 0) toast.warning(`เกินลิมิต Makeup: ${res.limitExceeded.join(', ')}`);
      onAttendanceSaved?.();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('บันทึกการเช็คชื่อไม่สำเร็จ');
    } finally {
      setAttSaving(false);
    }
  };

  // Quick attendance for trial / makeup (single student)
  const markAttendance = async (present: boolean) => {
    if (!event) return;
    setSavingAttendance(true);
    try {
      if (isTrial) {
        await updateTrialSession(scheduleId, {
          status: present ? 'attended' : 'absent',
          attended: present,
        });
      } else if (isMakeup) {
        const payload = {
          status: (present ? 'present' : 'absent') as 'present' | 'absent',
          checkedBy: adminUser?.id || 'system',
        };
        if (event.extendedProps.status === 'completed') {
          await updateMakeupAttendance(scheduleId, payload);
        } else {
          await recordMakeupAttendance(scheduleId, payload);
        }
      }
      onAttendanceSaved?.();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('บันทึกการเช็คชื่อไม่สำเร็จ');
    } finally {
      setSavingAttendance(false);
    }
  };
  const eventDate = event.start as Date;
  const eventEndDate = event.end as Date | null;

  // Status color and icon
  const getStatusBadge = () => {
    const now = new Date();
    const isPast = eventEndDate ? eventEndDate < now : false;
    
    if (isMakeup) {
      if (isPast || event.extendedProps.makeupStatus === 'completed') {
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            เรียนเสร็จแล้ว
          </Badge>
        );
      }
      return (
        <Badge className="bg-purple-100 text-purple-700">
          <UserCircle className="h-3 w-3 mr-1" />
          Makeup Class
        </Badge>
      );
    } else if (isTrial) {
      if (isPast) {
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            ทดลองเรียนเสร็จแล้ว
          </Badge>
        );
      }
      return (
        <Badge className="bg-orange-100 text-orange-700">
          <School className="h-3 w-3 mr-1" />
          ทดลองเรียน
        </Badge>
      );
    } else if (isRegularClass) {
      if (isPast) {
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            สอนเสร็จแล้ว
          </Badge>
        );
      } else {
        const now = new Date();
        const isToday = eventDate.toDateString() === now.toDateString();
        const startTime = eventDate;
        
        if (isToday && now >= startTime && now <= eventEndDate!) {
          return (
            <Badge className="bg-blue-100 text-blue-700">
              <Clock className="h-3 w-3 mr-1 animate-pulse" />
              กำลังเรียน
            </Badge>
          );
        } else {
          return (
            <Badge className="bg-gray-100 text-gray-700">
              <Calendar className="h-3 w-3 mr-1" />
              รอเรียน
            </Badge>
          );
        }
      }
    }
  };

  // Get title based on event type - ใช้ event.title โดยตรง
  const getEventTitle = () => {
    if (isMakeup) {
      if (event.extendedProps.makeupCount && event.extendedProps.makeupCount > 1) {
        return `Makeup Class ${event.extendedProps.makeupCount} คน`;
      }
      return `${event.extendedProps.originalClassName} - Makeup`;
    } else if (isTrial) {
      return event.extendedProps.trialSubjectName || 'ทดลองเรียน';
    } else {
      // For regular class, use the event title (which is subject name)
      return event.title;
    }
  };

  // Format time safely
  const formatEventTime = () => {
    const startTime = eventDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (eventEndDate) {
      const endTime = eventEndDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${startTime} - ${endTime}`;
    } else {
      return startTime;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {showChangeTeacher ? (
          <ChangeTeacherPanel
            event={event}
            scheduleId={scheduleId}
            onCancel={() => setShowChangeTeacher(false)}
            onChanged={(t) => {
              setTeacherOverride(t);
              setShowChangeTeacher(false);
              onTeacherChanged?.();
            }}
          />
        ) : showAttendance ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tooltip label="กลับ">
                  <button onClick={() => setShowAttendance(false)} className="text-gray-400 hover:text-gray-600" aria-label="กลับ">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </Tooltip>
                <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                เช็คชื่อ
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {getEventTitle()} · {formatThaiShortDate(eventDate)} {formatEventTime()}
              </p>
            </DialogHeader>

            <div className="py-2">
              {attLoading ? (
                <div className="text-center py-8 text-gray-500">กำลังโหลดรายชื่อ...</div>
              ) : enrolledStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">ยังไม่มีนักเรียนลงทะเบียน</div>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                  {enrolledStudents.map((student, index) => (
                    <div key={student.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{student.nickname}</p>
                          <p className="text-xs text-gray-500 truncate">{student.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {ATTENDANCE_STATUSES.map((st) => {
                          const selected = (attMap[student.id] || 'present') === st.value;
                          return (
                            <button
                              key={st.value}
                              onClick={() => setAttMap((m) => ({ ...m, [student.id]: st.value }))}
                              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                                selected ? st.active : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t mt-2">
              <button
                onClick={() => setAttMap(Object.fromEntries(enrolledStudents.map((s) => [s.id, 'present' as AttendanceStatus])))}
                className="text-xs text-gray-500 hover:text-gray-700"
                disabled={attSaving || enrolledStudents.length === 0}
              >
                ตั้งทั้งหมดเป็น “มาเรียน”
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAttendance(false)} disabled={attSaving}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSaveAttendance} disabled={attSaving || attLoading || enrolledStudents.length === 0}>
                  {attSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  บันทึกการเช็คชื่อ
                </Button>
              </div>
            </div>
          </>
        ) : (
        <>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {/* Subject color dot */}
                {event.extendedProps.subjectColor && (
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: event.extendedProps.subjectColor }}
                  />
                )}
                <DialogTitle className="text-xl">
                  {getEventTitle()}
                  {event.extendedProps.sessionNumber && !isMakeup && !isTrial && (
                    <span className="ml-2 text-sm text-gray-500">(ครั้งที่ {event.extendedProps.sessionNumber})</span>
                  )}
                </DialogTitle>
              </div>
              {/* Show class name or code */}
              <p className="text-sm text-gray-500 mt-1">
                {(() => {
                  const props = event.extendedProps as any;
                  if (isRegularClass) {
                    // Try className first, then classCode, then show debug info
                    return props.className || props.classCode || `Class ID: ${event.classId}`;
                  } else if (isMakeup) {
                    if (props.makeupCount && props.makeupCount > 1) {
                      return `${props.makeupCount} นักเรียนเรียนชดเชย`;
                    }
                    return `Makeup Class - ${props.studentNickname || 'นักเรียน'}`;
                  } else if (isTrial) {
                    return 'ทดลองเรียน';
                  }
                  return '';
                })()}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{formatThaiShortDate(eventDate)} {formatEventTime()}</span>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location and Teacher Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                <span className="text-gray-500">ห้อง:</span>{' '}
                <span className="font-medium">{event.extendedProps.roomName}</span>
                <span className="text-gray-400 ml-1">({event.extendedProps.branchName})</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 shrink-0 ring-1 ring-gray-200">
                {(teacherOverride?.image ?? event.extendedProps.teacherImage) ? (
                  <AvatarImage src={teacherOverride?.image ?? event.extendedProps.teacherImage} alt={teacherOverride?.name ?? event.extendedProps.teacherName} />
                ) : null}
                <AvatarFallback className="bg-gray-200 text-gray-600 text-[10px]">
                  {((teacherOverride?.name ?? event.extendedProps.teacherName) || '?').trim().slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                <span className="text-gray-500">ครูผู้สอน:</span>{' '}
                <span className="font-medium">{teacherOverride?.name ?? event.extendedProps.teacherName}</span>
              </span>
              <button
                onClick={() => setShowChangeTeacher(true)}
                className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                <Pencil className="h-3 w-3" />
                เปลี่ยนครู
              </button>
            </div>
          </div>

          {/* For Trial Classes */}
          {isTrial && (
            <>
              {/* Show trial count if grouped */}
              {event.extendedProps.trialCount && event.extendedProps.trialCount > 1 && (
                <div className="p-3 bg-orange-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">มีนักเรียนทดลองเรียน {event.extendedProps.trialCount} คนในช่วงเวลานี้</span>
                  </div>
                  {event.extendedProps.trialDetails && (
                    <div className="mt-2 space-y-1">
                      {event.extendedProps.trialDetails.map((detail, index) => (
                        <div key={detail.id} className="text-xs text-orange-600 ml-6">
                          {index + 1}. {detail.studentName} - {detail.subjectName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trial Student Info */}
              <div className="p-4 bg-orange-50 rounded-lg space-y-2">
                <h3 className="font-medium text-orange-900">ข้อมูลทดลองเรียน</h3>
                <div className="text-sm text-orange-700">
                  <p>นักเรียน: {event.extendedProps.trialStudentName}</p>
                  <p>วิชา: {event.extendedProps.trialSubjectName}</p>
                </div>
              </div>
            </>
          )}

          {/* For Makeup Classes */}
          {isMakeup && (
            <div className="p-4 bg-purple-50 rounded-lg space-y-2">
              <h3 className="font-medium text-purple-900">ข้อมูล Makeup Class</h3>
              
              {/* แสดงจำนวนนักเรียนถ้ามีหลายคน */}
              {event.extendedProps.makeupCount && event.extendedProps.makeupCount > 1 && (
                <div className="flex items-center gap-2 text-purple-700 mb-3">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">มีนักเรียนเรียนชดเชย {event.extendedProps.makeupCount} คนในช่วงเวลานี้</span>
                </div>
              )}
              
              {/* แสดงรายละเอียดนักเรียน */}
              {event.extendedProps.makeupDetails && event.extendedProps.makeupDetails.length > 1 ? (
                <div className="space-y-2">
                  {event.extendedProps.makeupDetails.map((detail, index) => (
                    <div key={detail.id} className="text-sm text-purple-700 p-2 bg-purple-100 rounded">
                      <p className="font-medium">{index + 1}. {detail.studentNickname} ({detail.studentName})</p>
                      <p className="text-xs">คลาสเดิม: {detail.originalClassName}</p>
                      {detail.attendance && (
                        <p className="text-xs mt-1">
                          สถานะ: {detail.attendance.status === 'present' ? 'เข้าเรียน' : 'ขาดเรียน'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-purple-700">
                  <p>นักเรียน: {event.extendedProps.studentNickname} ({event.extendedProps.studentName})</p>
                  <p>คลาสเดิม: {event.extendedProps.originalClassName}</p>
                </div>
              )}
            </div>
          )}

          {/* For Regular Classes - Show enrolled students */}
          {isRegularClass && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium text-gray-900">รายชื่อนักเรียน</h3>
                  <Badge variant="secondary">
                    {event.extendedProps.enrolled || 0} คน
                  </Badge>
                </div>
              </div>

              {loadingStudents ? (
                <div className="text-center py-4 text-gray-500">
                  กำลังโหลดรายชื่อนักเรียน...
                </div>
              ) : enrolledStudents.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {enrolledStudents.map((student, index) => (
                    <div 
                      key={student.id} 
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{student.nickname}</p>
                        <p className="text-xs text-gray-500">{student.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  ยังไม่มีนักเรียนลงทะเบียน
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          <div className="flex items-center gap-2">
            {/* Regular class → inline attendance in this modal */}
            {isRegularClass && (
              <Button variant="outline" onClick={enterAttendance}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                เช็คชื่อ
              </Button>
            )}

            {/* Trial / Makeup (single student) → quick มาเรียน / ขาด */}
            {(isTrial || isMakeup) && (
              <>
                <span className="text-sm text-gray-500 mr-1">เช็คชื่อ:</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingAttendance}
                  onClick={() => markAttendance(true)}
                  className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  มาเรียน
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingAttendance}
                  onClick={() => markAttendance(false)}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  ขาด
                </Button>
              </>
            )}
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ปิด
          </Button>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
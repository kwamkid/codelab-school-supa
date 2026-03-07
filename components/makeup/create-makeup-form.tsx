'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Student, Class, ClassSchedule, Teacher, Room, Enrollment, MakeupClass } from '@/types/models';
import {
  createMakeupRequest,
  scheduleMakeupClass,
  getMakeupRequestsBySchedules,
  canCreateMakeup,
  getMakeupClass
} from '@/lib/services/makeup';
import { getClassSchedules } from '@/lib/services/classes';
import { getEnrollmentsByStudent } from '@/lib/services/enrollments';
import { getActiveTeachers } from '@/lib/services/teachers';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import { getAllStudentsWithParents } from '@/lib/services/parents';
import { checkAvailability, AvailabilityWarning } from '@/lib/utils/availability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { Textarea } from "@/components/ui/textarea";
import {
  Save, X, User, AlertCircle, CalendarPlus, CheckCircle, Clock,
  Info, AlertTriangle, Users, CheckCircle2, ChevronLeft
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from '@/components/ui/alert';
import StudentSearchSelect from '@/components/ui/student-search-select';
import { Badge } from "@/components/ui/badge";
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from "@/components/ui/progress";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import Link from 'next/link';
import { SectionLoading } from '@/components/ui/loading';

interface CreateMakeupFormProps {
  mode: 'create' | 'edit';
  makeupId?: string;
}

export default function CreateMakeupForm({ mode, makeupId }: CreateMakeupFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedBranchId, isAllBranches } = useBranch();
  const { user, adminUser, canAccessBranch, isSuperAdmin, isBranchAdmin } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<{ enrollment: Enrollment; class: Class }[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingMakeups, setExistingMakeups] = useState<Record<string, any>>({});
  const [makeupLimit, setMakeupLimit] = useState<{ currentCount: number; limit: number; allowed: boolean } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityWarnings, setAvailabilityWarnings] = useState<AvailabilityWarning[]>([]);
  const [availabilityIssues, setAvailabilityIssues] = useState<{ type: string; message: string }[]>([]);
  const [existingMakeup, setExistingMakeup] = useState<MakeupClass | null>(null);
  const [loadingMakeup, setLoadingMakeup] = useState(mode === 'edit');

  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    scheduleId: '',
    type: 'scheduled' as 'scheduled' | 'ad-hoc',
    reason: '',
    reasonCategory: 'other' as 'sick' | 'leave' | 'other',
    makeupDate: '',
    makeupStartTime: '',
    makeupEndTime: '',
    makeupTeacherId: '',
    makeupRoomId: ''
  });

  const canBypassLimit = isSuperAdmin() || isBranchAdmin();

  // Determine if fields are editable
  const isEditMode = mode === 'edit';
  const isCompleteOrCancelled = existingMakeup?.status === 'completed' || existingMakeup?.status === 'cancelled';
  const isLeftColumnDisabled = isEditMode; // student, class, schedule always disabled in edit
  const isRightColumnDisabled = isCompleteOrCancelled;
  const isReasonDisabled = isCompleteOrCancelled;

  // Load students
  const { data: allStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', 'all'],
    queryFn: getAllStudentsWithParents,
    staleTime: 300000,
  });

  // Filter active students by branch
  const activeStudents = useMemo(() => {
    return allStudents.filter(s => {
      if (!s.isActive) return false;
      if (isAllBranches || adminUser?.role === 'super_admin') return true;
      return true;
    });
  }, [allStudents, isAllBranches, adminUser]);

  // Load existing makeup data for edit mode
  useEffect(() => {
    if (mode === 'edit' && makeupId) {
      loadExistingMakeup();
    }
  }, [mode, makeupId]);

  const loadExistingMakeup = async () => {
    if (!makeupId) return;
    setLoadingMakeup(true);
    try {
      const makeup = await getMakeupClass(makeupId);
      if (!makeup) {
        toast.error('ไม่พบข้อมูล Makeup');
        router.push('/makeup');
        return;
      }
      setExistingMakeup(makeup);

      // Detect reason category
      let reasonCategory: 'sick' | 'leave' | 'other' = 'other';
      if (makeup.reason.startsWith('ป่วย')) reasonCategory = 'sick';
      else if (makeup.reason.startsWith('ลากิจ')) reasonCategory = 'leave';

      setFormData({
        studentId: makeup.studentId,
        classId: makeup.originalClassId,
        scheduleId: makeup.originalScheduleId,
        type: makeup.type,
        reason: makeup.reason,
        reasonCategory,
        makeupDate: makeup.makeupSchedule?.date
          ? new Date(makeup.makeupSchedule.date).toISOString().split('T')[0]
          : '',
        makeupStartTime: makeup.makeupSchedule?.startTime || '',
        makeupEndTime: makeup.makeupSchedule?.endTime || '',
        makeupTeacherId: makeup.makeupSchedule?.teacherId || '',
        makeupRoomId: makeup.makeupSchedule?.roomId || '',
      });

      // Load branch data if makeup has schedule
      if (makeup.branchId) {
        loadBranchData(makeup.branchId);
      }
    } catch (error) {
      console.error('Error loading makeup:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoadingMakeup(false);
    }
  };

  // When student is selected, load their enrolled classes
  useEffect(() => {
    if (formData.studentId && mode === 'create') {
      loadStudentEnrollments();
    } else if (!formData.studentId) {
      setEnrolledClasses([]);
      setFormData(prev => ({ ...prev, classId: '', scheduleId: '' }));
      setMakeupLimit(null);
    }
  }, [formData.studentId]);

  // When class is selected, load schedules and check makeup limit
  useEffect(() => {
    if (formData.classId && formData.studentId) {
      if (mode === 'create') {
        loadClassSchedules();
        checkMakeupLimit();
      }
      const selectedClass = enrolledClasses.find(ec => ec.class.id === formData.classId)?.class;
      if (selectedClass && mode === 'create') {
        setFormData(prev => ({
          ...prev,
          makeupStartTime: selectedClass.startTime?.substring(0, 5) || '',
          makeupEndTime: selectedClass.endTime?.substring(0, 5) || '',
          makeupTeacherId: selectedClass.teacherId
        }));
        loadBranchData(selectedClass.branchId);
      }
    } else if (mode === 'create') {
      setSchedules([]);
      setFormData(prev => ({ ...prev, scheduleId: '' }));
      setMakeupLimit(null);
    }
  }, [formData.classId, formData.studentId]);

  // Check availability when schedule form changes
  useEffect(() => {
    if (formData.makeupDate && formData.makeupStartTime &&
      formData.makeupEndTime && formData.makeupTeacherId && formData.makeupRoomId) {
      checkScheduleAvailability();
    } else {
      setAvailabilityWarnings([]);
      setAvailabilityIssues([]);
    }
  }, [formData.makeupDate, formData.makeupStartTime, formData.makeupEndTime,
    formData.makeupTeacherId, formData.makeupRoomId]);

  const loadStudentEnrollments = async () => {
    if (!formData.studentId) return;
    setLoadingEnrollments(true);
    try {
      const enrollments = await getEnrollmentsByStudent(formData.studentId);
      const activeEnrollments = enrollments.filter(e => e.status === 'active');
      const { getClass } = await import('@/lib/services/classes');
      const enrollmentWithClasses = await Promise.all(
        activeEnrollments.map(async (enrollment) => {
          try {
            const cls = await getClass(enrollment.classId);
            if (cls && ['published', 'started'].includes(cls.status)) {
              if (canAccessBranch(cls.branchId)) {
                return { enrollment, class: cls };
              }
            }
          } catch (error) {
            console.error(`Error loading class ${enrollment.classId}:`, error);
          }
          return null;
        })
      );
      setEnrolledClasses(enrollmentWithClasses.filter(Boolean) as { enrollment: Enrollment; class: Class }[]);
    } catch (error) {
      console.error('Error loading enrollments:', error);
      toast.error('ไม่สามารถโหลดข้อมูลคลาสของนักเรียนได้');
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const loadClassSchedules = async () => {
    if (!formData.classId || !formData.studentId) return;
    setLoadingSchedules(true);
    try {
      const schedulesData = await getClassSchedules(formData.classId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const availableSchedules = schedulesData.filter(s => {
        const scheduleDate = new Date(s.sessionDate);
        scheduleDate.setHours(0, 0, 0, 0);
        return scheduleDate >= today && s.status === 'scheduled';
      });
      setSchedules(availableSchedules);
      const scheduleIds = availableSchedules.map(s => s.id);
      const makeupRequests = await getMakeupRequestsBySchedules(
        formData.studentId,
        formData.classId,
        scheduleIds
      );
      setExistingMakeups(makeupRequests);
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('ไม่สามารถโหลดตารางเรียนได้');
    } finally {
      setLoadingSchedules(false);
    }
  };

  const checkMakeupLimit = async () => {
    if (!formData.studentId || !formData.classId) return;
    try {
      const limitInfo = await canCreateMakeup(formData.studentId, formData.classId, canBypassLimit);
      setMakeupLimit(limitInfo);
    } catch (error) {
      console.error('Error checking makeup limit:', error);
    }
  };

  const loadBranchData = async (branchId: string) => {
    try {
      if (!canAccessBranch(branchId)) {
        toast.error('คุณไม่มีสิทธิ์จัดการ Makeup ในสาขานี้');
        return;
      }
      const [teachersData, roomsData] = await Promise.all([
        getActiveTeachers(),
        getActiveRoomsByBranch(branchId)
      ]);
      const branchTeachers = teachersData.filter(t =>
        t.availableBranches.includes(branchId)
      );
      setTeachers(branchTeachers);
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading branch data:', error);
    }
  };

  const checkScheduleAvailability = async () => {
    if (!formData.makeupDate || !formData.makeupStartTime || !formData.makeupEndTime ||
      !formData.makeupTeacherId || !formData.makeupRoomId) {
      return;
    }
    const branchId = existingMakeup?.branchId ||
      enrolledClasses.find(ec => ec.class.id === formData.classId)?.class.branchId;
    if (!branchId) return;

    setCheckingAvailability(true);
    try {
      const result = await checkAvailability({
        date: new Date(formData.makeupDate),
        startTime: formData.makeupStartTime,
        endTime: formData.makeupEndTime,
        branchId,
        roomId: formData.makeupRoomId,
        teacherId: formData.makeupTeacherId,
        excludeType: 'makeup',
        allowConflicts: true
      });
      setAvailabilityIssues(result.reasons);
      setAvailabilityWarnings(result.warnings || []);
    } catch (error) {
      console.error('Error checking availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const hasScheduleData = formData.makeupDate && formData.makeupTeacherId && formData.makeupRoomId;

  const handleSubmit = async () => {
    if (!formData.studentId || !formData.classId || !formData.scheduleId || !formData.reason.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (mode === 'create' && existingMakeups[formData.scheduleId]) {
      toast.error('มีการขอ Makeup สำหรับวันนี้แล้ว');
      return;
    }
    if (makeupLimit && !makeupLimit.allowed && !canBypassLimit) {
      toast.error(`เกินจำนวนครั้งที่ชดเชยได้ (${makeupLimit.currentCount}/${makeupLimit.limit})`);
      return;
    }
    if (hasScheduleData) {
      const holidayIssue = availabilityIssues.find(issue => issue.type === 'holiday');
      if (holidayIssue) {
        toast.error('ไม่สามารถจัด Makeup Class ในวันหยุดได้');
        return;
      }
      if (availabilityWarnings.length > 0) {
        const confirmMessage = `มีคลาส/กิจกรรมอื่นในช่วงเวลานี้:\n${availabilityWarnings.map(w => `- ${w.message}`).join('\n')}\n\nคุณต้องการจัด Makeup Class ในเวลานี้หรือไม่?`;
        if (!confirm(confirmMessage)) return;
      }
    }
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    const selectedStudent = allStudents.find(s => s.id === formData.studentId);
    if (!selectedStudent) {
      toast.error('ไม่พบข้อมูลนักเรียน');
      return;
    }

    setLoading(true);
    try {
      const makeupId = await createMakeupRequest({
        type: formData.type,
        originalClassId: formData.classId,
        originalScheduleId: formData.scheduleId,
        studentId: formData.studentId,
        parentId: selectedStudent.parentId,
        requestDate: new Date(),
        requestedBy: user.uid,
        reason: formData.reason,
        status: 'pending'
      });

      if (hasScheduleData && makeupId) {
        const branchId = enrolledClasses.find(ec => ec.class.id === formData.classId)?.class.branchId || '';
        await scheduleMakeupClass(makeupId, {
          date: new Date(formData.makeupDate),
          startTime: formData.makeupStartTime,
          endTime: formData.makeupEndTime,
          teacherId: formData.makeupTeacherId,
          branchId,
          roomId: formData.makeupRoomId,
          confirmedBy: user.uid
        });
        toast.success('สร้างและนัด Makeup Class เรียบร้อยแล้ว');
      } else {
        toast.success('สร้าง Makeup Request เรียบร้อยแล้ว');
      }

      await queryClient.invalidateQueries({ queryKey: ['makeupClasses'] });
      window.dispatchEvent(new CustomEvent('makeup-changed'));
      router.push('/makeup');
    } catch (error: any) {
      console.error('Error creating makeup request:', error);
      if (error.message === 'Makeup request already exists for this schedule') {
        toast.error('มีการขอ Makeup สำหรับวันนี้แล้ว');
      } else {
        toast.error('ไม่สามารถสร้าง Makeup Request ได้');
      }
    } finally {
      setLoading(false);
    }
  };

  const getScheduleInfo = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return '';
    return `ครั้งที่ ${schedule.sessionNumber} - ${formatDate(schedule.sessionDate, 'long')}`;
  };

  const getMakeupStatusBadge = (makeup: any) => {
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'scheduled': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
    };
    const statusLabels: Record<string, string> = {
      'pending': 'รอจัดตาราง',
      'scheduled': 'นัดแล้ว',
      'completed': 'เรียนแล้ว',
    };
    const statusIcons: Record<string, any> = {
      'pending': Clock,
      'scheduled': CalendarPlus,
      'completed': CheckCircle,
    };
    const Icon = statusIcons[makeup.status] || Clock;
    return (
      <Badge className={statusColors[makeup.status] || ''}>
        <Icon className="h-3 w-3 mr-1" />
        {statusLabels[makeup.status] || makeup.status}
      </Badge>
    );
  };

  const handleReasonCategoryChange = (category: 'sick' | 'leave' | 'other') => {
    setFormData(prev => {
      let reason = '';
      if (category === 'sick') reason = 'ป่วย - ';
      else if (category === 'leave') reason = 'ลากิจ - ';
      return { ...prev, reasonCategory: category, reason };
    });
  };

  const getGroupedWarnings = () => {
    const roomWarnings = availabilityWarnings.filter(w => w.type === 'room_conflict');
    const teacherWarnings = availabilityWarnings.filter(w => w.type === 'teacher_conflict');
    return { roomWarnings, teacherWarnings };
  };

  // Loading state
  if (loadingStudents && allStudents.length === 0) {
    return <SectionLoading text="กำลังโหลดข้อมูลนักเรียน..." />;
  }
  if (loadingMakeup) {
    return <SectionLoading text="กำลังโหลดข้อมูล Makeup..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Link href="/makeup" className="inline-flex items-center text-base text-gray-600 hover:text-gray-900">
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับ
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          {mode === 'create' ? 'สร้าง Makeup Request' : 'รายละเอียด Makeup'}
        </h1>
        <p className="text-gray-600 mt-1 text-base">
          {mode === 'create'
            ? 'บันทึกการขอเรียนชดเชยสำหรับนักเรียนที่จะขาดเรียน'
            : `สถานะ: ${existingMakeup?.status === 'pending' ? 'รอจัดตาราง' : existingMakeup?.status === 'scheduled' ? 'นัดแล้ว' : existingMakeup?.status === 'completed' ? 'เรียนแล้ว' : 'ยกเลิก'}`
          }
        </p>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Absence Info */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลการขาด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Student Selection */}
            {isEditMode && existingMakeup ? (
              <div className="space-y-2">
                <Label>นักเรียน</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-md">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-base">
                    {existingMakeup.studentNickname || existingMakeup.studentName}
                  </span>
                  <span className="text-gray-500 text-base">({existingMakeup.studentName})</span>
                </div>
              </div>
            ) : (
              <StudentSearchSelect
                students={activeStudents}
                value={formData.studentId}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  studentId: value,
                  classId: '',
                  scheduleId: ''
                }))}
                label="นักเรียน"
                required
                placeholder="ค้นหาด้วยชื่อนักเรียน, ชื่อผู้ปกครอง, LINE, เบอร์โทร..."
              />
            )}

            {/* Class Selection */}
            {isEditMode && existingMakeup ? (
              <div className="space-y-2">
                <Label>คลาส</Label>
                <div className="px-3 py-2 bg-gray-50 border rounded-md text-base">
                  <p className="font-medium">{existingMakeup.className}</p>
                  <p className="text-gray-500">{existingMakeup.classCode} - {existingMakeup.subjectName}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>คลาสที่ลงทะเบียน *</Label>
                <Select
                  value={formData.classId}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    classId: value,
                    scheduleId: ''
                  }))}
                  disabled={!formData.studentId || loadingEnrollments}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !formData.studentId ? "เลือกนักเรียนก่อน" :
                        loadingEnrollments ? "กำลังโหลด..." :
                          "เลือกคลาส"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {enrolledClasses.length === 0 ? (
                      <div className="p-2 text-center text-base text-gray-500">
                        {!formData.studentId ? "กรุณาเลือกนักเรียนก่อน" :
                          "นักเรียนยังไม่ได้ลงทะเบียนคลาสใดในสาขาที่คุณมีสิทธิ์"}
                      </div>
                    ) : (
                      enrolledClasses.map(({ enrollment, class: cls }) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          <div>
                            <p className="font-medium">{cls.name}</p>
                            <p className="text-xs text-gray-500">{cls.code}</p>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Makeup Limit Info */}
            {makeupLimit && formData.classId && mode === 'create' && (
              <Alert className={`py-2 ${makeupLimit.allowed || canBypassLimit ? "border-blue-200" : "border-amber-200"}`}>
                <div className="flex items-start gap-2">
                  <Info className={`h-4 w-4 mt-0.5 ${makeupLimit.allowed || canBypassLimit ? "text-blue-600" : "text-amber-600"}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-medium">
                        Makeup: {makeupLimit.currentCount}/{makeupLimit.limit === 0 ? '∞' : makeupLimit.limit}
                      </span>
                      {makeupLimit.limit > 0 && (
                        <Progress
                          value={(makeupLimit.currentCount / makeupLimit.limit) * 100}
                          className="h-2 flex-1"
                        />
                      )}
                    </div>
                    {!makeupLimit.allowed && canBypassLimit && (
                      <p className="text-xs text-amber-700 mt-1">Admin สามารถสร้างเพิ่มได้</p>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            {/* Schedule Selection */}
            {isEditMode && existingMakeup ? (
              <div className="space-y-2">
                <Label>วันที่ขาด</Label>
                <div className="px-3 py-2 bg-gray-50 border rounded-md text-base">
                  {existingMakeup.originalSessionNumber
                    ? `ครั้งที่ ${existingMakeup.originalSessionNumber} - ${existingMakeup.originalSessionDate ? formatDate(existingMakeup.originalSessionDate, 'long') : ''}`
                    : '-'
                  }
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>วันที่จะขาด *</Label>
                <Select
                  value={formData.scheduleId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, scheduleId: value }))}
                  disabled={!formData.classId || loadingSchedules}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !formData.classId ? "เลือกคลาสก่อน" :
                        loadingSchedules ? "กำลังโหลด..." :
                          "เลือกวันที่"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {schedules.length === 0 ? (
                      <div className="p-2 text-center text-base text-gray-500">
                        ไม่มีตารางเรียนที่สามารถขอ Makeup ได้
                      </div>
                    ) : (
                      (() => {
                        const schedulesByMonth = schedules.reduce((acc, schedule) => {
                          const date = new Date(schedule.sessionDate);
                          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                          const monthLabel = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
                          if (!acc[monthKey]) {
                            acc[monthKey] = { label: monthLabel, schedules: [] };
                          }
                          acc[monthKey].schedules.push(schedule);
                          return acc;
                        }, {} as Record<string, { label: string; schedules: typeof schedules }>);

                        return Object.entries(schedulesByMonth).map(([monthKey, { label, schedules: monthSchedules }]) => (
                          <div key={monthKey}>
                            <div className="sticky top-0 bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-700 border-b">
                              {label} ({monthSchedules.length} วัน)
                            </div>
                            {monthSchedules.map(schedule => {
                              const existingMakeup = existingMakeups[schedule.id];
                              const isDisabled = !!existingMakeup;
                              return (
                                <SelectItem
                                  key={schedule.id}
                                  value={schedule.id}
                                  disabled={isDisabled}
                                  className="pl-4"
                                >
                                  <div className="flex items-center justify-between w-full gap-2">
                                    <span className={isDisabled ? 'text-gray-400' : ''}>
                                      {getScheduleInfo(schedule.id)}
                                    </span>
                                    {existingMakeup && getMakeupStatusBadge(existingMakeup)}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </div>
                        ));
                      })()
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Request Type and Reason Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ประเภทการขอ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'scheduled' | 'ad-hoc') =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                  disabled={isReasonDisabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">ขอล่วงหน้า</SelectItem>
                    <SelectItem value="ad-hoc">ขอหลังขาด</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>สถานะการลา</Label>
                <Select
                  value={formData.reasonCategory}
                  onValueChange={handleReasonCategoryChange}
                  disabled={isReasonDisabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">ป่วย</SelectItem>
                    <SelectItem value="leave">ลากิจ</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                {formData.reasonCategory === 'sick' && 'รายละเอียดอาการป่วย *'}
                {formData.reasonCategory === 'leave' && 'รายละเอียดการลา *'}
                {formData.reasonCategory === 'other' && 'เหตุผลที่ขาด *'}
              </Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={
                  formData.reasonCategory === 'sick' ? 'เช่น ป่วย - ไข้หวัด, ป่วย - ท้องเสีย' :
                    formData.reasonCategory === 'leave' ? 'เช่น ลากิจ - ไปต่างจังหวัด' :
                      'เช่น ติดสอบโรงเรียน, รถติด, ฝนตกหนัก'
                }
                rows={2}
                required
                disabled={isReasonDisabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Schedule Makeup */}
        <Card className={isRightColumnDisabled ? 'opacity-60' : ''}>
          <CardHeader>
            <CardTitle>นัด Makeup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Makeup Date */}
            <div className="space-y-2">
              <Label htmlFor="makeup-date">วันที่นัด Makeup</Label>
              <DateRangePicker
                mode="single"
                value={formData.makeupDate}
                onChange={(date) => setFormData(prev => ({ ...prev, makeupDate: date || '' }))}
                minDate={new Date()}
                placeholder="เลือกวันที่"
                disabled={isRightColumnDisabled}
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>เวลา</Label>
              <TimeRangePicker
                startTime={formData.makeupStartTime}
                endTime={formData.makeupEndTime}
                onStartTimeChange={(v) => setFormData(prev => ({ ...prev, makeupStartTime: v }))}
                onEndTimeChange={(v) => setFormData(prev => ({ ...prev, makeupEndTime: v }))}
                disabled={isRightColumnDisabled}
              />
            </div>

            {/* Teacher */}
            <div className="space-y-2">
              <Label>ครูผู้สอน</Label>
              <Select
                value={formData.makeupTeacherId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, makeupTeacherId: value }))}
                disabled={teachers.length === 0 || isRightColumnDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder={teachers.length === 0 ? "เลือกคลาสก่อน" : "เลือกครู"} />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.nickname || teacher.name}
                      {teacher.id === enrolledClasses.find(ec => ec.class.id === formData.classId)?.class.teacherId &&
                        ' (ครูประจำคลาส)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room */}
            <div className="space-y-2">
              <Label>ห้องเรียน</Label>
              <Select
                value={formData.makeupRoomId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, makeupRoomId: value }))}
                disabled={rooms.length === 0 || isRightColumnDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder={rooms.length === 0 ? "เลือกคลาสก่อน" : "เลือกห้อง"} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} (จุ {room.capacity} คน)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Availability Status */}
            {checkingAvailability ? (
              <Alert>
                <AlertCircle className="h-4 w-4 animate-spin" />
                <AlertDescription>กำลังตรวจสอบตารางเวลา...</AlertDescription>
              </Alert>
            ) : availabilityIssues.length > 0 && availabilityIssues.some(issue => issue.type === 'holiday') ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {availabilityIssues.find(issue => issue.type === 'holiday')?.message}
                </AlertDescription>
              </Alert>
            ) : availabilityWarnings.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const { roomWarnings, teacherWarnings } = getGroupedWarnings();
                  return (
                    <>
                      {roomWarnings.length > 0 && (
                        <Alert className="border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-medium text-amber-800">ห้องเรียนมีการใช้งานแล้ว:</p>
                              {roomWarnings.map((warning, index) => {
                                const room = rooms.find(r => r.id === formData.makeupRoomId);
                                const displayMessage = warning.message.replace(
                                  /ห้อง [^\s]+ /,
                                  `ห้อง ${room?.name || formData.makeupRoomId} `
                                );
                                return (
                                  <div key={index} className="flex items-start gap-2 text-base text-amber-700">
                                    {warning.details.conflictType === 'makeup' &&
                                      warning.message.includes('คน') ? (
                                      <Users className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    )}
                                    <span>{displayMessage}</span>
                                  </div>
                                );
                              })}
                              <p className="text-xs text-amber-600 mt-2">* สามารถจัด Makeup Class ร่วมกันได้</p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                      {teacherWarnings.length > 0 && (
                        <Alert className="border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-medium text-amber-800">ครูมีคลาสอื่นในเวลานี้:</p>
                              {teacherWarnings.map((warning, index) => (
                                <div key={index} className="flex items-start gap-2 text-base text-amber-700">
                                  <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>{warning.message}</span>
                                </div>
                              ))}
                              <p className="text-xs text-amber-600 mt-2">* กรุณาพิจารณาเลือกครูท่านอื่น</p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              formData.makeupDate && formData.makeupStartTime && formData.makeupEndTime &&
              formData.makeupTeacherId && formData.makeupRoomId && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    เวลานี้สามารถจัด Makeup Class ได้
                  </AlertDescription>
                </Alert>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {!isCompleteOrCancelled && (
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => router.push('/makeup')}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !formData.studentId ||
              !formData.classId ||
              !formData.scheduleId ||
              !formData.reason.trim() ||
              (mode === 'create' && formData.scheduleId && !!existingMakeups[formData.scheduleId]) ||
              (hasScheduleData && availabilityIssues.some(issue => issue.type === 'holiday')) ||
              (makeupLimit && !makeupLimit.allowed && !canBypassLimit)
            }
            className="bg-red-500 hover:bg-red-600"
          >
            {loading ? (
              <>กำลังบันทึก...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {hasScheduleData ? 'สร้างและนัด' : 'สร้าง Request'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

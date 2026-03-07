'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Student, Class, ClassSchedule, Enrollment } from '@/types/models';
import {
  createMakeupRequest,
  scheduleMakeupClass,
  getMakeupRequestsBySchedules,
  canCreateMakeup,
} from '@/lib/services/makeup';
import { getClassSchedules } from '@/lib/services/classes';
import { getEnrollmentsByStudent } from '@/lib/services/enrollments';
import { getAllStudentsWithParents } from '@/lib/services/parents';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save, Clock, CalendarPlus, CheckCircle, Info, Loader2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import StudentSearchSelect from '@/components/ui/student-search-select';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';
import MakeupScheduleFields, { ScheduleFormData } from './makeup-schedule-fields';

interface CreateMakeupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateMakeupDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateMakeupDialogProps) {
  const queryClient = useQueryClient();
  const { selectedBranchId, isAllBranches } = useBranch();
  const { user, adminUser, canAccessBranch, isSuperAdmin, isBranchAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<{ enrollment: Enrollment; class: Class }[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [existingMakeups, setExistingMakeups] = useState<Record<string, any>>({});
  const [makeupLimit, setMakeupLimit] = useState<{ currentCount: number; limit: number; allowed: boolean } | null>(null);

  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    scheduleId: '',
    type: 'scheduled' as 'scheduled' | 'ad-hoc',
    reason: '',
    reasonCategory: 'other' as 'sick' | 'leave' | 'other',
  });

  const [scheduleData, setScheduleData] = useState<ScheduleFormData>({
    date: '',
    startTime: '',
    endTime: '',
    teacherId: '',
    roomId: '',
  });

  const canBypassLimit = isSuperAdmin() || isBranchAdmin();

  // Load students
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students', 'all'],
    queryFn: getAllStudentsWithParents,
    staleTime: 300000,
    enabled: open,
  });

  // Filter active students
  const activeStudents = useMemo(() => {
    return allStudents.filter(s => s.isActive);
  }, [allStudents]);

  // Selected class branch
  const selectedClassBranchId = useMemo(() => {
    return enrolledClasses.find(ec => ec.class.id === formData.classId)?.class.branchId || '';
  }, [enrolledClasses, formData.classId]);

  const selectedClassTeacherId = useMemo(() => {
    return enrolledClasses.find(ec => ec.class.id === formData.classId)?.class.teacherId || '';
  }, [enrolledClasses, formData.classId]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        studentId: '', classId: '', scheduleId: '',
        type: 'scheduled', reason: '', reasonCategory: 'other',
      });
      setScheduleData({ date: '', startTime: '', endTime: '', teacherId: '', roomId: '' });
      setActiveTab('info');
      setEnrolledClasses([]);
      setSchedules([]);
      setExistingMakeups({});
      setMakeupLimit(null);
    }
  }, [open]);

  // When student is selected, load their enrolled classes
  useEffect(() => {
    if (formData.studentId) {
      loadStudentEnrollments();
    } else {
      setEnrolledClasses([]);
      setFormData(prev => ({ ...prev, classId: '', scheduleId: '' }));
      setMakeupLimit(null);
    }
  }, [formData.studentId]);

  // When class is selected, load schedules and set default schedule data
  useEffect(() => {
    if (formData.classId && formData.studentId) {
      loadClassSchedules();
      checkMakeupLimit();
      const selectedClass = enrolledClasses.find(ec => ec.class.id === formData.classId)?.class;
      if (selectedClass) {
        setScheduleData(prev => ({
          ...prev,
          startTime: selectedClass.startTime?.substring(0, 5) || '',
          endTime: selectedClass.endTime?.substring(0, 5) || '',
          teacherId: selectedClass.teacherId,
        }));
      }
    } else {
      setSchedules([]);
      setFormData(prev => ({ ...prev, scheduleId: '' }));
      setMakeupLimit(null);
    }
  }, [formData.classId, formData.studentId]);

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
        formData.studentId, formData.classId, scheduleIds
      );
      setExistingMakeups(makeupRequests);
    } catch (error) {
      console.error('Error loading schedules:', error);
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

  const handleReasonCategoryChange = (category: 'sick' | 'leave' | 'other') => {
    let reason = '';
    if (category === 'sick') reason = 'ป่วย - ';
    else if (category === 'leave') reason = 'ลากิจ - ';
    setFormData(prev => ({ ...prev, reasonCategory: category, reason }));
  };

  const getScheduleInfo = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return '';
    return `ครั้งที่ ${schedule.sessionNumber} - ${formatDate(schedule.sessionDate, 'long')}`;
  };

  const getMakeupStatusBadge = (makeup: any) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'scheduled': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
    };
    const labels: Record<string, string> = {
      'pending': 'รอจัดตาราง',
      'scheduled': 'นัดแล้ว',
      'completed': 'เรียนแล้ว',
    };
    const icons: Record<string, any> = {
      'pending': Clock,
      'scheduled': CalendarPlus,
      'completed': CheckCircle,
    };
    const Icon = icons[makeup.status] || Clock;
    return (
      <Badge className={colors[makeup.status] || ''}>
        <Icon className="h-3 w-3 mr-1" />
        {labels[makeup.status] || makeup.status}
      </Badge>
    );
  };

  const hasScheduleData = scheduleData.date && scheduleData.teacherId && scheduleData.roomId;

  const isInfoComplete = formData.studentId && formData.classId &&
    formData.scheduleId && formData.reason.trim() &&
    !existingMakeups[formData.scheduleId] &&
    (makeupLimit?.allowed || canBypassLimit);

  const handleSubmit = async () => {
    if (!formData.studentId || !formData.classId || !formData.scheduleId || !formData.reason.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (existingMakeups[formData.scheduleId]) {
      toast.error('มีการขอ Makeup สำหรับวันนี้แล้ว');
      return;
    }
    if (makeupLimit && !makeupLimit.allowed && !canBypassLimit) {
      toast.error(`เกินจำนวนครั้งที่ชดเชยได้ (${makeupLimit.currentCount}/${makeupLimit.limit})`);
      return;
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
        status: 'pending',
      });

      if (hasScheduleData && makeupId) {
        await scheduleMakeupClass(makeupId, {
          date: new Date(scheduleData.date),
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          teacherId: scheduleData.teacherId,
          branchId: selectedClassBranchId,
          roomId: scheduleData.roomId,
          confirmedBy: user.uid,
        });
        toast.success('สร้างและนัด Makeup Class เรียบร้อยแล้ว');
      } else {
        toast.success('สร้าง Makeup Request เรียบร้อยแล้ว');
      }

      await queryClient.invalidateQueries({ queryKey: ['makeupClasses'] });
      window.dispatchEvent(new CustomEvent('makeup-changed'));
      onSuccess?.();
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>สร้าง Makeup Request</DialogTitle>
          <DialogDescription>
            บันทึกการลาและนัดเรียนชดเชย
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">ข้อมูลการขาด</TabsTrigger>
            <TabsTrigger value="schedule" disabled={!isInfoComplete}>
              นัด Makeup
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Absence Info */}
          <TabsContent value="info" className="space-y-4 mt-4">
            {/* Student Selection */}
            <StudentSearchSelect
              students={activeStudents}
              value={formData.studentId}
              onValueChange={(value) => setFormData(prev => ({
                ...prev, studentId: value, classId: '', scheduleId: ''
              }))}
              label="นักเรียน"
              required
              placeholder="ค้นหาด้วยชื่อนักเรียน, ชื่อผู้ปกครอง, LINE, เบอร์โทร..."
            />

            {/* Class Selection */}
            <div className="space-y-2">
              <Label>คลาสที่ลงทะเบียน *</Label>
              <Select
                value={formData.classId}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev, classId: value, scheduleId: ''
                }))}
                disabled={!formData.studentId || loadingEnrollments}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    !formData.studentId ? 'เลือกนักเรียนก่อน' :
                      loadingEnrollments ? 'กำลังโหลด...' : 'เลือกคลาส'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {enrolledClasses.length === 0 ? (
                    <div className="p-2 text-center text-sm text-gray-500">
                      {!formData.studentId ? 'กรุณาเลือกนักเรียนก่อน' :
                        'นักเรียนยังไม่ได้ลงทะเบียนคลาสใดในสาขาที่คุณมีสิทธิ์'}
                    </div>
                  ) : (
                    enrolledClasses.map(({ class: cls }) => (
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

            {/* Makeup Limit */}
            {makeupLimit && formData.classId && (
              <Alert className={`py-2 ${makeupLimit.allowed || canBypassLimit ? 'border-blue-200' : 'border-amber-200'}`}>
                <div className="flex items-start gap-2">
                  <Info className={`h-4 w-4 mt-0.5 ${makeupLimit.allowed || canBypassLimit ? 'text-blue-600' : 'text-amber-600'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
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
            <div className="space-y-2">
              <Label>วันที่จะขาด *</Label>
              <Select
                value={formData.scheduleId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, scheduleId: value }))}
                disabled={!formData.classId || loadingSchedules}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    !formData.classId ? 'เลือกคลาสก่อน' :
                      loadingSchedules ? 'กำลังโหลด...' : 'เลือกวันที่'
                  } />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {schedules.length === 0 ? (
                    <div className="p-2 text-center text-sm text-gray-500">
                      ไม่มีตารางเรียนที่สามารถขอ Makeup ได้
                    </div>
                  ) : (
                    (() => {
                      const schedulesByMonth = schedules.reduce((acc, schedule) => {
                        const date = new Date(schedule.sessionDate);
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        const monthLabel = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
                        if (!acc[monthKey]) acc[monthKey] = { label: monthLabel, schedules: [] };
                        acc[monthKey].schedules.push(schedule);
                        return acc;
                      }, {} as Record<string, { label: string; schedules: typeof schedules }>);

                      return Object.entries(schedulesByMonth).map(([monthKey, { label, schedules: monthSchedules }]) => (
                        <div key={monthKey}>
                          <div className="sticky top-0 bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-700 border-b">
                            {label} ({monthSchedules.length} วัน)
                          </div>
                          {monthSchedules.map(schedule => {
                            const existing = existingMakeups[schedule.id];
                            const isDisabled = !!existing;
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
                                  {existing && getMakeupStatusBadge(existing)}
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

            {/* Type and Reason Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ประเภทการขอ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'scheduled' | 'ad-hoc') =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>
                {formData.reasonCategory === 'sick' && 'รายละเอียดอาการป่วย *'}
                {formData.reasonCategory === 'leave' && 'รายละเอียดการลา *'}
                {formData.reasonCategory === 'other' && 'เหตุผลที่ขาด *'}
              </Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={
                  formData.reasonCategory === 'sick' ? 'เช่น ป่วย - ไข้หวัด' :
                    formData.reasonCategory === 'leave' ? 'เช่น ลากิจ - ไปต่างจังหวัด' :
                      'เช่น ติดสอบโรงเรียน, รถติด'
                }
                rows={2}
                required
              />
            </div>
          </TabsContent>

          {/* Tab 2: Schedule Makeup */}
          <TabsContent value="schedule" className="mt-4">
            {selectedClassBranchId ? (
              <MakeupScheduleFields
                branchId={selectedClassBranchId}
                value={scheduleData}
                onChange={setScheduleData}
                originalTeacherId={selectedClassTeacherId}
                popoverDirection="up"
              />
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                กรุณาเลือกคลาสก่อนเพื่อโหลดข้อมูลสาขา
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isInfoComplete}
            className="bg-red-500 hover:bg-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {hasScheduleData ? 'สร้างและนัด' : 'สร้าง Request'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Student, Class, ClassSchedule, Teacher, Room, Enrollment } from '@/types/models';
import { 
  createMakeupRequest, 
  scheduleMakeupClass, 
  getMakeupRequestsBySchedules,
  canCreateMakeup 
} from '@/lib/services/makeup';
import { getClassSchedules } from '@/lib/services/classes';
import { getEnrollmentsByStudent } from '@/lib/services/enrollments';
import { getActiveTeachers } from '@/lib/services/teachers';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import { getAllStudentsWithParents } from '@/lib/services/parents';
import { checkAvailability, AvailabilityWarning } from '@/lib/utils/availability';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Save, X, User, AlertCircle, CalendarPlus, CheckCircle, Clock, XCircle, Info, ChevronRight, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import StudentSearchSelect from '@/components/ui/student-search-select';
import { Badge } from "@/components/ui/badge";
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface CreateMakeupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes?: Class[]; // ไม่จำเป็นต้องส่ง
  students?: (Student & { parentName: string; parentPhone: string })[]; // ไม่จำเป็นต้องส่ง
  onCreated: () => void;
}

export default function CreateMakeupDialog({
  open,
  onOpenChange,
  classes = [], // default empty array
  students = [], // default empty array
  onCreated
}: CreateMakeupDialogProps) {
  const { selectedBranchId, isAllBranches } = useBranch();
  const { user, adminUser, canAccessBranch, isSuperAdmin, isBranchAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<{enrollment: Enrollment; class: Class}[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [scheduleNow, setScheduleNow] = useState(false);
  const [existingMakeups, setExistingMakeups] = useState<Record<string, any>>({});
  const [makeupLimit, setMakeupLimit] = useState<{ currentCount: number; limit: number; allowed: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityWarnings, setAvailabilityWarnings] = useState<AvailabilityWarning[]>([]);
  const [availabilityIssues, setAvailabilityIssues] = useState<{ type: string; message: string }[]>([]);
  
  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    scheduleId: '',
    type: 'scheduled' as 'scheduled' | 'ad-hoc',
    reason: '',
    reasonCategory: 'other' as 'sick' | 'leave' | 'other',
    // Makeup schedule fields
    makeupDate: '',
    makeupStartTime: '',
    makeupEndTime: '',
    makeupTeacherId: '',
    makeupRoomId: ''
  });

  // Check if admin can bypass limit
  const canBypassLimit = isSuperAdmin() || isBranchAdmin();

  // ✅ โหลดข้อมูลนักเรียนเมื่อเปิด dialog
  const { data: allStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', 'all'],
    queryFn: getAllStudentsWithParents,
    staleTime: 300000, // Cache 5 minutes
    enabled: open, // โหลดเฉพาะเมื่อเปิด dialog
  });

  // ใช้ข้อมูลจาก query ถ้าไม่มีใน props
  const studentsToUse = students.length > 0 ? students : allStudents;

  // Active students only - filter by branch if needed
  const activeStudents = useMemo(() => {
    return studentsToUse.filter(s => {
      if (!s.isActive) return false;
      
      // If viewing all branches or is super admin, show all
      if (isAllBranches || adminUser?.role === 'super_admin') return true;
      
      // For branch admin/teacher, only show students from enrolled classes in their branch
      if (selectedBranchId) {
        // This would require checking enrollments, for now show all active
        return true;
      }
      
      return true;
    });
  }, [studentsToUse, isAllBranches, adminUser, selectedBranchId]);

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

  // When class is selected, load schedules and check makeup limit
  useEffect(() => {
    if (formData.classId && formData.studentId) {
      loadClassSchedules();
      checkMakeupLimit();
      // Set default teacher and times from selected class
      const selectedClass = enrolledClasses.find(ec => ec.class.id === formData.classId)?.class;
      if (selectedClass) {
        setFormData(prev => ({
          ...prev,
          makeupStartTime: selectedClass.startTime,
          makeupEndTime: selectedClass.endTime,
          makeupTeacherId: selectedClass.teacherId
        }));
        // Load teachers and rooms for the branch
        loadBranchData(selectedClass.branchId);
      }
    } else {
      setSchedules([]);
      setFormData(prev => ({ ...prev, scheduleId: '' }));
      setMakeupLimit(null);
    }
  }, [formData.classId, formData.studentId]);

  // Auto switch to schedule tab when toggle is turned on
  useEffect(() => {
    if (scheduleNow) {
      setActiveTab('schedule');
    }
  }, [scheduleNow]);

  // Check availability when schedule form changes
  useEffect(() => {
    if (scheduleNow && formData.makeupDate && formData.makeupStartTime && 
        formData.makeupEndTime && formData.makeupTeacherId && formData.makeupRoomId) {
      checkScheduleAvailability();
    } else {
      setAvailabilityWarnings([]);
      setAvailabilityIssues([]);
    }
  }, [scheduleNow, formData.makeupDate, formData.makeupStartTime, formData.makeupEndTime, 
      formData.makeupTeacherId, formData.makeupRoomId]);

  const loadStudentEnrollments = async () => {
    if (!formData.studentId) return;
    
    setLoadingEnrollments(true);
    try {
      const enrollments = await getEnrollmentsByStudent(formData.studentId);
      // Filter active enrollments only
      const activeEnrollments = enrollments.filter(e => e.status === 'active');
      
      // ✅ โหลดข้อมูล class จาก Firestore โดยตรง
      const { getClass } = await import('@/lib/services/classes');
      
      const enrollmentWithClasses = await Promise.all(
        activeEnrollments.map(async (enrollment) => {
          try {
            // โหลดข้อมูล class จาก Firestore
            const cls = await getClass(enrollment.classId);
            
            if (cls && ['published', 'started'].includes(cls.status)) {
              // Check if user has access to this class's branch
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
      
      setEnrolledClasses(enrollmentWithClasses.filter(Boolean) as {enrollment: Enrollment; class: Class}[]);
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
      console.log('📅 Loaded schedules:', {
        total: schedulesData.length,
        statuses: schedulesData.map(s => ({ id: s.id, date: s.sessionDate, status: s.status }))
      });

      // Filter future or today schedules
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const availableSchedules = schedulesData.filter(s => {
        const scheduleDate = new Date(s.sessionDate);
        scheduleDate.setHours(0, 0, 0, 0);
        return scheduleDate >= today && s.status === 'scheduled';
      });

      console.log('✅ Available schedules after filter:', {
        count: availableSchedules.length,
        dates: availableSchedules.map(s => s.sessionDate)
      });

      setSchedules(availableSchedules);

      // Load existing makeup requests for these schedules
      const scheduleIds = availableSchedules.map(s => s.id);
      const makeupRequests = await getMakeupRequestsBySchedules(
        formData.studentId,
        formData.classId,
        scheduleIds
      );
      console.log('📋 Existing makeup requests:', {
        count: Object.keys(makeupRequests).length,
        scheduleIds: Object.keys(makeupRequests)
      });
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
      // Check if user has access to this branch
      if (!canAccessBranch(branchId)) {
        toast.error('คุณไม่มีสิทธิ์จัดการ Makeup ในสาขานี้');
        return;
      }

      const [teachersData, roomsData] = await Promise.all([
        getActiveTeachers(),
        getActiveRoomsByBranch(branchId)
      ]);
      
      // Filter teachers who can teach at this branch
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

    const selectedClass = enrolledClasses.find(ec => ec.class.id === formData.classId)?.class;
    if (!selectedClass) return;

    setCheckingAvailability(true);
    try {
      const result = await checkAvailability({
        date: new Date(formData.makeupDate),
        startTime: formData.makeupStartTime,
        endTime: formData.makeupEndTime,
        branchId: selectedClass.branchId,
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

  const handleSubmit = async () => {
    // Validate
    if (!formData.studentId || !formData.classId || !formData.scheduleId || !formData.reason.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Check if already has makeup for this schedule
    if (existingMakeups[formData.scheduleId]) {
      toast.error('มีการขอ Makeup สำหรับวันนี้แล้ว');
      return;
    }

    // Check makeup limit (if not admin)
    if (makeupLimit && !makeupLimit.allowed && !canBypassLimit) {
      toast.error(`เกินจำนวนครั้งที่ชดเชยได้ (${makeupLimit.currentCount}/${makeupLimit.limit})`);
      return;
    }

    // If schedule now, validate makeup fields
    if (scheduleNow) {
      if (!formData.makeupDate || !formData.makeupTeacherId || !formData.makeupRoomId) {
        toast.error('กรุณากรอกข้อมูลการนัด Makeup ให้ครบถ้วน');
        return;
      }

      // Check for holiday issue
      const holidayIssue = availabilityIssues.find(issue => issue.type === 'holiday');
      if (holidayIssue) {
        toast.error('ไม่สามารถจัด Makeup Class ในวันหยุดได้');
        return;
      }

      // ถ้ามี warnings ให้แสดงข้อความยืนยัน
      if (availabilityWarnings.length > 0) {
        const confirmMessage = `มีคลาส/กิจกรรมอื่นในช่วงเวลานี้:\n${availabilityWarnings.map(w => `- ${w.message}`).join('\n')}\n\nคุณต้องการจัด Makeup Class ในเวลานี้หรือไม่?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
      }
    }

    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }

    // Get selected student
    const selectedStudent = studentsToUse.find(s => s.id === formData.studentId);
    if (!selectedStudent) {
      toast.error('ไม่พบข้อมูลนักเรียน');
      return;
    }

    setLoading(true);
    try {
      // Create makeup request
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

      // If schedule now is checked, schedule the makeup
      if (scheduleNow && makeupId) {
        const selectedClass = enrolledClasses.find(ec => ec.class.id === formData.classId)?.class;
        
        await scheduleMakeupClass(makeupId, {
          date: new Date(formData.makeupDate),
          startTime: formData.makeupStartTime,
          endTime: formData.makeupEndTime,
          teacherId: formData.makeupTeacherId,
          branchId: selectedClass?.branchId || '',
          roomId: formData.makeupRoomId,
          confirmedBy: user.uid
        });
        
        toast.success('สร้างและนัด Makeup Class เรียบร้อยแล้ว');
      } else {
        toast.success('สร้าง Makeup Request เรียบร้อยแล้ว');
      }

      onCreated();
      
      // Reset form
      setFormData({
        studentId: '',
        classId: '',
        scheduleId: '',
        type: 'scheduled',
        reason: '',
        reasonCategory: 'other',
        makeupDate: '',
        makeupStartTime: '',
        makeupEndTime: '',
        makeupTeacherId: '',
        makeupRoomId: ''
      });
      setScheduleNow(false);
      setExistingMakeups({});
      setMakeupLimit(null);
      setActiveTab('basic');
      setAvailabilityWarnings([]);
      setAvailabilityIssues([]);
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
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'scheduled': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
    };

    const statusLabels = {
      'pending': 'รอจัดตาราง',
      'scheduled': 'นัดแล้ว',
      'completed': 'เรียนแล้ว',
    };

    const statusIcons = {
      'pending': Clock,
      'scheduled': CalendarPlus,
      'completed': CheckCircle,
    };

    const Icon = statusIcons[makeup.status as keyof typeof statusIcons];

    return (
      <Badge className={statusColors[makeup.status as keyof typeof statusColors]}>
        <Icon className="h-3 w-3 mr-1" />
        {statusLabels[makeup.status as keyof typeof statusLabels]}
      </Badge>
    );
  };

  // Update reason when category changes
  const handleReasonCategoryChange = (category: 'sick' | 'leave' | 'other') => {
    setFormData(prev => {
      let reason = '';
      if (category === 'other') {
        reason = '';
      } else if (category === 'sick') {
        reason = 'ป่วย - ';
      } else if (category === 'leave') {
        reason = 'ลากิจ - ';
      }
      return {
        ...prev,
        reasonCategory: category,
        reason: reason
      };
    });
  };

  // Helper function to group warnings by type
  const getGroupedWarnings = () => {
    const roomWarnings = availabilityWarnings.filter(w => w.type === 'room_conflict');
    const teacherWarnings = availabilityWarnings.filter(w => w.type === 'teacher_conflict');
    
    return { roomWarnings, teacherWarnings };
  };

  // Show loading skeleton while loading students
  if (loadingStudents && studentsToUse.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>สร้าง Makeup Request</DialogTitle>
            <DialogDescription>กำลังโหลดข้อมูล...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>สร้าง Makeup Request</DialogTitle>
          <DialogDescription>
            บันทึกการขอเรียนชดเชยสำหรับนักเรียนที่จะขาดเรียน
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">ข้อมูลการขาด</TabsTrigger>
            <TabsTrigger value="schedule" disabled={!scheduleNow}>นัด Makeup</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="basic" className="px-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Student Selection with Search - Full width */}
                <div className="col-span-2">
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
                </div>

              {/* Class Selection - Show enrolled classes - Full width */}
              <div className="space-y-2 col-span-2">
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
                      <div className="p-2 text-center text-sm text-gray-500">
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

              {/* Makeup Limit Info */}
              {makeupLimit && formData.classId && (
                <Alert className={`py-2 col-span-2 ${makeupLimit.allowed || canBypassLimit ? "border-blue-200" : "border-amber-200"}`}>
                  <div className="flex items-start gap-2">
                    <Info className={`h-4 w-4 mt-0.5 ${makeupLimit.allowed || canBypassLimit ? "text-blue-600" : "text-amber-600"}`} />
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
                        <p className="text-xs text-amber-700 mt-1">
                          Admin สามารถสร้างเพิ่มได้
                        </p>
                      )}
                    </div>
                  </div>
                </Alert>
              )}

              {/* Schedule Selection with Makeup Status - Full width */}
              <div className="space-y-2 col-span-2">
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
                      <div className="p-2 text-center text-sm text-gray-500">
                        ไม่มีตารางเรียนที่สามารถขอ Makeup ได้
                      </div>
                    ) : (
                      (() => {
                        // จัดกลุ่มตามเดือน
                        const schedulesByMonth = schedules.reduce((acc, schedule) => {
                          const date = new Date(schedule.sessionDate);
                          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                          const monthLabel = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
                          
                          if (!acc[monthKey]) {
                            acc[monthKey] = {
                              label: monthLabel,
                              schedules: []
                            };
                          }
                          acc[monthKey].schedules.push(schedule);
                          return acc;
                        }, {} as Record<string, { label: string; schedules: typeof schedules }>);

                        return Object.entries(schedulesByMonth).map(([monthKey, { label, schedules: monthSchedules }]) => (
                          <div key={monthKey}>
                            {/* Month Header */}
                            <div className="sticky top-0 bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-700 border-b">
                              {label} ({monthSchedules.length} วัน)
                            </div>
                            
                            {/* Schedule Items */}
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
                {schedules.length > 10 && (
                  <p className="text-xs text-gray-500">
                    💡 มีตารางเรียน {schedules.length} วัน - scroll เพื่อดูเพิ่มเติม
                  </p>
                )}
              </div>

              {/* Request Type and Reason Category - Side by side */}
              <div className="space-y-2">
                <Label>ประเภทการขอ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'scheduled' | 'ad-hoc') => 
                    setFormData(prev => ({ ...prev, type: value }))
                  }
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

              {/* Reason */}
              <div className="space-y-2 col-span-2">
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
                    formData.reasonCategory === 'sick' ? 'เช่น ป่วย - ไข้หวัด, ป่วย - ท้องเสีย, ป่วย - ปวดหัว' :
                    formData.reasonCategory === 'leave' ? 'เช่น ลากิจ - ไปต่างจังหวัด, ลากิจ - ติดธุระครอบครัว' :
                    'เช่น ติดสอบโรงเรียน, รถติด, ฝนตกหนัก'
                  }
                  rows={2}
                  required
                />
              </div>

              {/* Schedule Now Option - Full width */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg col-span-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="schedule-now"
                    checked={scheduleNow}
                    onCheckedChange={setScheduleNow}
                  />
                  <Label htmlFor="schedule-now" className="flex items-center gap-2 cursor-pointer">
                    <CalendarPlus className="h-4 w-4 text-blue-600" />
                    นัดวัน Makeup เลย
                  </Label>
                </div>
                {scheduleNow && (
                  <ChevronRight className="h-4 w-4 text-blue-600 animate-pulse" />
                )}
              </div>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 px-1">
              {scheduleNow && formData.classId && (
                <>
                  {/* Makeup Date */}
                  <div className="space-y-2">
                    <Label htmlFor="makeup-date">วันที่นัด Makeup *</Label>
                    <Input
                      id="makeup-date"
                      type="date"
                      value={formData.makeupDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, makeupDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="makeup-start-time">เวลาเริ่ม *</Label>
                      <Input
                        id="makeup-start-time"
                        type="time"
                        value={formData.makeupStartTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, makeupStartTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="makeup-end-time">เวลาจบ *</Label>
                      <Input
                        id="makeup-end-time"
                        type="time"
                        value={formData.makeupEndTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, makeupEndTime: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Teacher */}
                  <div className="space-y-2">
                    <Label>ครูผู้สอน *</Label>
                    <Select
                      value={formData.makeupTeacherId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, makeupTeacherId: value }))}
                      disabled={teachers.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={teachers.length === 0 ? "ไม่มีครูในสาขานี้" : "เลือกครู"} />
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
                    <Label>ห้องเรียน *</Label>
                    <Select
                      value={formData.makeupRoomId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, makeupRoomId: value }))}
                      disabled={rooms.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={rooms.length === 0 ? "ไม่มีห้องในสาขานี้" : "เลือกห้อง"} />
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
                      <AlertDescription>
                        กำลังตรวจสอบตารางเวลา...
                      </AlertDescription>
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
                                      const roomId = formData.makeupRoomId;
                                      const room = rooms.find(r => r.id === roomId);
                                      const roomName = room?.name || roomId;
                                      
                                      const displayMessage = warning.message.replace(
                                        /ห้อง [^\s]+ /,
                                        `ห้อง ${roomName} `
                                      );
                                      
                                      return (
                                        <div key={index} className="flex items-start gap-2 text-sm text-amber-700">
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
                                    <p className="text-xs text-amber-600 mt-2">
                                      * สามารถจัด Makeup Class ร่วมกันได้
                                    </p>
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
                                      <div key={index} className="flex items-start gap-2 text-sm text-amber-700">
                                        <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                        <span>{warning.message}</span>
                                      </div>
                                    ))}
                                    <p className="text-xs text-amber-600 mt-2">
                                      * กรุณาพิจารณาเลือกครูท่านอื่น หรือยืนยันการจัดตาราง
                                    </p>
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
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-auto">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
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
              (formData.scheduleId && !!existingMakeups[formData.scheduleId]) ||
              (scheduleNow && (!formData.makeupDate || !formData.makeupTeacherId || !formData.makeupRoomId)) ||
              (scheduleNow && availabilityIssues.some(issue => issue.type === 'holiday')) ||
              (makeupLimit && !makeupLimit.allowed && !canBypassLimit)
            }
            className="bg-red-500 hover:bg-red-600"
          >
            {loading ? (
              <>กำลังบันทึก...</>
            ) : scheduleNow && availabilityWarnings.length > 0 ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                ยืนยันสร้างและนัด
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {scheduleNow ? 'สร้างและนัด' : 'สร้าง Request'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
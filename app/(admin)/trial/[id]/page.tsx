// app/(admin)/trial/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TestTube,
  ArrowLeft,
  Phone,
  Mail,
  User,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  PhoneCall,
  CalendarCheck,
  UserPlus,
  MoreVertical,
  History,
  Save,
  X as XIcon,
  Building2,
  Baby,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { TrialBooking, TrialSession, Subject, Teacher, Branch, Room } from '@/types/models';
import {
  getTrialBooking,
  getTrialSessionsByBooking,
  updateBookingStatus,
  updateTrialSession,
  cancelTrialSession,
  updateTrialBooking,
  updateBookingBranch,
  cancelTrialBooking,
  deduplicateBookingStudents,
  deleteBookingStudent
} from '@/lib/services/trial-bookings';
import { getSubjects } from '@/lib/services/subjects';
import { getTeachers } from '@/lib/services/teachers';
import { getBranches } from '@/lib/services/branches';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { formatDate, calculateAge } from '@/lib/utils';
import TrialSessionDialog from '@/components/trial/trial-session-dialog';
import ContactHistorySection from '@/components/trial/contact-history-section';
import ConvertToStudentDialog from '@/components/trial/convert-to-student-dialog';
import RescheduleTrialDialog from '@/components/trial/reschedule-trial-dialog';
import { CancelBookingDialog } from '@/components/trial/cancel-booking-dialog';
import { GradeLevelCombobox } from '@/components/ui/grade-level-combobox';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoading } from '@/components/ui/loading';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


const statusConfig = {
  new: { label: 'ใหม่', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  contacted: { label: 'ติดต่อแล้ว', color: 'bg-yellow-100 text-yellow-700', icon: PhoneCall },
  scheduled: { label: 'นัดหมายแล้ว', color: 'bg-purple-100 text-purple-700', icon: CalendarCheck },
  completed: { label: 'เรียนแล้ว', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  converted: { label: 'ลงทะเบียนแล้ว', color: 'bg-emerald-100 text-emerald-700', icon: UserPlus },
  cancelled: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-700', icon: XCircle }
};

const sourceConfig = {
  online: { label: 'Online', color: 'bg-blue-100 text-blue-700' },
  walkin: { label: 'Walk-in', color: 'bg-green-100 text-green-700' },
  phone: { label: 'โทรศัพท์', color: 'bg-purple-100 text-purple-700' }
};

export default function TrialBookingDetailPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { adminUser } = useAuth();
  const isSuperAdmin = adminUser?.role === 'super_admin';
  const [booking, setBooking] = useState<TrialBooking | null>(null);
  const [sessions, setSessions] = useState<TrialSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rooms, setRooms] = useState<Record<string, Room[]>>({});
  const [loading, setLoading] = useState(true);
  
  // Edit states
  const [editingParent, setEditingParent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<number | null>(null);
  const [editingBranch, setEditingBranch] = useState(false);
  const [tempParentData, setTempParentData] = useState({ name: '', phone: '' });
  const [tempStudentData, setTempStudentData] = useState<any>({});
  const [tempBranchId, setTempBranchId] = useState<string>('');
  
  // Modal states
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TrialSession | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
  const [deleteStudentIndex, setDeleteStudentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (params.id) {
      loadData();
    }
  }, [params.id]);

  useEffect(() => {
    const action = searchParams.get('action');
    const sessionId = searchParams.get('sessionId');
    
    if (action === 'reschedule' && sessionId && sessions.length > 0) {
      const sessionToReschedule = sessions.find(s => s.id === sessionId);
      if (sessionToReschedule) {
        setSelectedSession(sessionToReschedule);
        setRescheduleModalOpen(true);
        
        router.replace(`/trial/${params.id}`, { scroll: false });
      }
    }
  }, [searchParams, sessions, router, params.id]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      // Auto-fix duplicate students from earlier bug
      await deduplicateBookingStudents(params.id).catch(() => {});

      const [bookingData, subjectsData, teachersData, branchesData] = await Promise.all([
        getTrialBooking(params.id),
        getSubjects(),
        getTeachers(),
        getBranches()
      ]);

      if (!bookingData) {
        toast.error('ไม่พบข้อมูลการจอง');
        router.push('/trial');
        return;
      }

      setBooking(bookingData);
      setSubjects(subjectsData.filter(s => s.isActive));
      setTeachers(teachersData.filter(t => t.isActive));
      setBranches(branchesData.filter(b => b.isActive));
      
      const sessionsData = await getTrialSessionsByBooking(params.id);
      setSessions(sessionsData);
      
      const roomsData: Record<string, Room[]> = {};
      for (const branch of branchesData) {
        const branchRooms = await getRoomsByBranch(branch.id);
        roomsData[branch.id] = branchRooms;
      }
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: TrialBooking['status'], note?: string) => {
    if (!booking) return;
    
    try {
      await updateBookingStatus(booking.id, newStatus, note);
      setBooking({ ...booking, status: newStatus });
      toast.success('อัพเดทสถานะเรียบร้อย');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('ไม่สามารถอัพเดทสถานะได้');
    }
  };

  const handleParentEdit = () => {
    if (!booking) return;
    setTempParentData({ name: booking.parentName, phone: booking.parentPhone });
    setEditingParent(true);
  };

  const handleParentSave = async () => {
    if (!booking) return;
    
    try {
      await updateTrialBooking(booking.id, {
        parentName: tempParentData.name,
        parentPhone: tempParentData.phone
      });
      
      setBooking({ ...booking, parentName: tempParentData.name, parentPhone: tempParentData.phone });
      setEditingParent(false);
      toast.success('บันทึกข้อมูลผู้ปกครองเรียบร้อย');
    } catch (error) {
      console.error('Error updating parent:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const handleStudentEdit = (idx: number) => {
    if (!booking) return;
    const student = booking.students[idx];
    setTempStudentData({
      name: student.name,
      birthdate: student.birthdate
        ? new Date(student.birthdate).toISOString().split('T')[0]
        : '',
      schoolName: student.schoolName || '',
      gradeLevel: student.gradeLevel || ''
    });
    setEditingStudent(idx);
  };

  const handleStudentSave = async () => {
    if (!booking || editingStudent === null) return;
    
    // Validate student data
    if (!tempStudentData.name.trim()) {
      toast.error('กรุณากรอกชื่อนักเรียน');
      return;
    }
    
    // Validate birthdate if provided
    if (tempStudentData.birthdate) {
      const age = calculateAge(new Date(tempStudentData.birthdate));
      if (age < 3 || age > 22) {
        toast.error('อายุนักเรียนต้องอยู่ระหว่าง 3-22 ปี');
        return;
      }
    }
    
    try {
      const updatedStudents = [...booking.students];
      updatedStudents[editingStudent] = {
        ...updatedStudents[editingStudent],
        name: tempStudentData.name,
        schoolName: tempStudentData.schoolName,
        gradeLevel: tempStudentData.gradeLevel,
        ...(tempStudentData.birthdate && { birthdate: new Date(tempStudentData.birthdate) })
      };
      
      await updateTrialBooking(booking.id, { students: updatedStudents });
      
      setBooking({ ...booking, students: updatedStudents });
      setEditingStudent(null);
      toast.success('บันทึกข้อมูลนักเรียนเรียบร้อย');
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const handleDeleteStudent = async () => {
    if (!booking || deleteStudentIndex === null) return;
    try {
      await deleteBookingStudent(params.id, deleteStudentIndex);
      const updatedStudents = booking.students.filter((_, i) => i !== deleteStudentIndex);
      setBooking({ ...booking, students: updatedStudents });
      toast.success('ลบนักเรียนเรียบร้อย');
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error(error?.message || 'ไม่สามารถลบนักเรียนได้');
    } finally {
      setDeleteStudentIndex(null);
    }
  };

  const handleBranchEdit = () => {
    if (!booking) return;
    setTempBranchId(booking.branchId || '');
    setEditingBranch(true);
  };

  const handleBranchSave = async () => {
    if (!booking || !tempBranchId) return;
    
    try {
      await updateBookingBranch(booking.id, tempBranchId);
      setBooking({ ...booking, branchId: tempBranchId });
      setEditingBranch(false);
      toast.success('บันทึกข้อมูลสาขาเรียบร้อย');
    } catch (error) {
      console.error('Error updating branch:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const handleCancelBooking = async (reason: string) => {
    if (!booking) return;
    
    await cancelTrialBooking(booking.id, reason);
    
    setBooking({ ...booking, status: 'cancelled' });
    toast.success('ยกเลิกทดลองเรียนเรียบร้อย');
    
    loadData();
  };

  const handleSessionCreated = () => {
    loadData();
    setSessionModalOpen(false);
    setSelectedStudent('');
  };

  const handleSessionUpdated = () => {
    loadData();
  };

  const handleConversionSuccess = () => {
    loadData();
    setConvertModalOpen(false);
    setSelectedSession(null);
  };

  const handleRescheduleSuccess = () => {
    loadData();
    setRescheduleModalOpen(false);
    setSelectedSession(null);
    
    router.replace(`/trial/${params.id}`, { scroll: false });
  };

  const getStatusBadge = (status: TrialBooking['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getSourceBadge = (source: TrialBooking['source']) => {
    const config = sourceConfig[source];
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <PageLoading />;
  }

  if (!booking) return null;

  const unscheduledStudents = booking.students.filter(student => 
    !sessions.some(session => session.studentName === student.name)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/trial')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับ
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
              <TestTube className="h-8 w-8 text-red-500" />
              รายละเอียดการจองทดลองเรียน
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-600">
                จองเมื่อ {formatDate(booking.createdAt, 'full')}
              </p>
              {getSourceBadge(booking.source)}
              {getStatusBadge(booking.status)}
            </div>
          </div>
          {/* Action buttons - changes by status */}
          <div className="flex items-center gap-2 shrink-0">
            {booking.status === 'new' && (
              <Button
                onClick={() => handleStatusUpdate('contacted')}
                variant="outline"
                size="sm"
              >
                <PhoneCall className="h-4 w-4 mr-1" />
                บันทึกว่าติดต่อแล้ว
              </Button>
            )}
            {booking.status === 'contacted' && sessions.length > 0 && (
              <Button
                onClick={() => handleStatusUpdate('scheduled')}
                variant="outline"
                size="sm"
              >
                <CalendarCheck className="h-4 w-4 mr-1" />
                เปลี่ยนเป็นนัดหมายแล้ว
              </Button>
            )}
            {booking.status === 'contacted' && (
              <Button
                onClick={() => handleStatusUpdate('new')}
                variant="ghost"
                size="sm"
                className="text-gray-500"
              >
                กลับเป็นใหม่
              </Button>
            )}
            {(booking.status === 'new' || booking.status === 'contacted' || booking.status === 'scheduled') && (
              <Button
                onClick={() => setCancelDialogOpen(true)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <XCircle className="h-4 w-4 mr-1" />
                ยกเลิก
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Booking Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Parent Info */}
          <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-400" />
                    ผู้ปกครอง
                  </CardTitle>
                  {!editingParent && (
                    <Button variant="ghost" size="icon" onClick={handleParentEdit}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingParent ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">ชื่อ-นามสกุล</Label>
                      <Input
                        value={tempParentData.name}
                        onChange={(e) => setTempParentData(prev => ({ ...prev, name: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">เบอร์โทรศัพท์</Label>
                      <Input
                        value={tempParentData.phone}
                        onChange={(e) => setTempParentData(prev => ({ ...prev, phone: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleParentSave} className="flex-1">
                        <Save className="h-3 w-3 mr-1" />
                        บันทึก
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingParent(false)}
                        className="flex-1"
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    <div>
                      <p className="text-xs text-gray-500">ชื่อ-นามสกุล</p>
                      <p className="font-medium">{booking.parentName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">เบอร์โทรศัพท์</p>
                      <p className="font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        {booking.parentPhone}
                      </p>
                    </div>
                    {booking.parentEmail && (
                      <div>
                        <p className="text-xs text-gray-500">อีเมล</p>
                        <p className="font-medium flex items-center gap-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          {booking.parentEmail}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">สาขา</p>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        {booking.branchId ? (branches.find(b => b.id === booking.branchId)?.name || booking.branchId) : <span className="text-amber-600">ยังไม่ได้เลือกสาขา</span>}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>


          {/* Trial Sessions - Grouped by Student */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">การทดลองเรียน</CardTitle>
                  <CardDescription className="text-xs">
                    จัดการนัดหมายทดลองเรียนสำหรับแต่ละนักเรียน
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!booking.branchId ? (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    กรุณาเลือกสาขาก่อนจึงจะสามารถนัดหมายทดลองเรียนได้
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {booking.students.map((student, studentIdx) => {
                    const studentSessions = sessions.filter(s => s.studentName === student.name);
                    const hasSession = studentSessions.length > 0;

                    return (
                      <div key={studentIdx} className="border rounded-lg overflow-hidden">
                        {/* Student header */}
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <GraduationCap className="h-4 w-4 text-gray-500" />
                            <span className="font-semibold text-base">{student.name}</span>
                            {student.birthdate && (
                              <span className="text-sm text-gray-500">({calculateAge(student.birthdate)} ปี)</span>
                            )}
                            {(student.schoolName || student.gradeLevel) && (
                              <span className="text-sm text-gray-500">
                                {[student.schoolName, student.gradeLevel].filter(Boolean).join(' / ')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {student.subjectInterests.map(subjectId => {
                              const subject = subjects.find(s => s.id === subjectId);
                              return subject ? (
                                <Badge
                                  key={subjectId}
                                  className="text-xs h-5 px-2"
                                  style={{
                                    backgroundColor: `${subject.color}20`,
                                    color: subject.color,
                                    borderColor: subject.color
                                  }}
                                >
                                  {subject.name}
                                </Badge>
                              ) : null;
                            })}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleStudentEdit(studentIdx)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {isSuperAdmin && booking.students.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteStudentIndex(studentIdx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Student edit form */}
                        {editingStudent === studentIdx && (
                          <div className="px-4 py-3 border-b bg-white space-y-3">
                            {/* Row 1: ชื่อ + วันเกิด */}
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                placeholder="ชื่อ-นามสกุล"
                                value={tempStudentData.name}
                                onChange={(e) => setTempStudentData(prev => ({ ...prev, name: e.target.value }))}
                                className="text-base"
                              />
                              <div>
                                <DateRangePicker
                                  mode="single"
                                  value={tempStudentData.birthdate}
                                  onChange={(date) => setTempStudentData(prev => ({ ...prev, birthdate: date || '' }))}
                                  maxDate={new Date()}
                                  placeholder="วันเกิด"
                                />
                                {tempStudentData.birthdate && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    อายุ: {calculateAge(new Date(tempStudentData.birthdate))} ปี
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Row 2: โรงเรียน + ระดับชั้น */}
                            <div className="grid grid-cols-2 gap-3">
                              <SchoolNameCombobox
                                placeholder="โรงเรียน"
                                value={tempStudentData.schoolName}
                                onChange={(value) => setTempStudentData(prev => ({ ...prev, schoolName: value }))}
                                className="text-base"
                              />
                              <GradeLevelCombobox
                                value={tempStudentData.gradeLevel}
                                onChange={(value) => setTempStudentData(prev => ({ ...prev, gradeLevel: value }))}
                                placeholder="ระดับชั้น..."
                                className="text-base"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleStudentSave} className="text-base">บันทึก</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingStudent(null)} className="text-base">ยกเลิก</Button>
                            </div>
                          </div>
                        )}

                        {/* Student sessions or schedule prompt */}
                        <div className="p-4">
                          {hasSession ? (
                            <div className="space-y-3">
                              {studentSessions.map((session) => {
                                const subject = subjects.find(s => s.id === session.subjectId);
                                const teacher = teachers.find(t => t.id === session.teacherId);
                                const branch = branches.find(b => b.id === session.branchId);
                                const room = rooms[session.branchId]?.find(r => r.id === session.roomId);
                                const isPast = new Date(session.scheduledDate) < new Date();

                                return (
                                  <div
                                    key={session.id}
                                    className={`border rounded-lg p-3 ${session.status === 'cancelled' ? 'opacity-60 bg-gray-50' : 'hover:shadow-sm'}`}
                                  >
                                    {/* Subject + status + menu */}
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <Badge
                                          className="text-xs"
                                          style={{ backgroundColor: `${subject?.color || '#EF4444'}20`, color: subject?.color || '#EF4444', borderColor: `${subject?.color || '#EF4444'}40` }}
                                        >
                                          {subject?.name}
                                        </Badge>
                                        {session.converted && (
                                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                            <UserPlus className="h-3 w-3 mr-1" />
                                            ลงทะเบียนแล้ว
                                          </Badge>
                                        )}
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 z-50">
                                          {session.converted ? (
                                            <DropdownMenuItem disabled className="text-gray-400">
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              ลงทะเบียนเรียบร้อยแล้ว
                                            </DropdownMenuItem>
                                          ) : (
                                            <>
                                              {(session.status === 'scheduled' || session.status === 'cancelled' || session.status === 'absent') && (
                                                <DropdownMenuItem onSelect={() => { setSelectedSession(session); setRescheduleModalOpen(true); }}>
                                                  <Edit className="h-4 w-4 mr-2" />
                                                  {session.status === 'cancelled' ? 'นัดวันใหม่' : 'เลื่อนนัด'}
                                                </DropdownMenuItem>
                                              )}
                                              {!session.converted && (
                                                <>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem
                                                    onSelect={() => router.push(`/enrollments/new?from=trial&bookingId=${booking.id}&sessionId=${session.id}`)}
                                                    className="text-green-600 focus:text-green-600"
                                                  >
                                                    <UserPlus className="h-4 w-4 mr-2" />
                                                    ลงทะเบียนเรียน
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                              {session.status === 'scheduled' && !isPast && (
                                                <>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => setCancelSessionId(session.id)}>
                                                    <XCircle className="h-4 w-4 mr-2" />
                                                    ยกเลิกนัดหมาย
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    {/* Date/Time + Branch/Teacher/Room */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        <span>{formatDate(session.scheduledDate)}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        <span>{session.startTime?.slice(0, 5)} - {session.endTime?.slice(0, 5)}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        <span>{branch?.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        <span>ครู{teacher?.nickname || teacher?.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        <span>ห้อง {session.roomName || room?.name || '-'}</span>
                                      </div>
                                    </div>

                                    {/* Attendance + Reschedule history */}
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div>
                                        {session.converted ? (
                                          <Badge className="bg-emerald-100 text-emerald-700">
                                            <UserPlus className="h-3 w-3 mr-1" />
                                            ลงทะเบียนแล้ว
                                          </Badge>
                                        ) : session.status === 'scheduled' && isPast ? (
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300 h-8"
                                              disabled={savingSessionId === session.id}
                                              onClick={async () => {
                                                setSavingSessionId(session.id);
                                                try {
                                                  await updateTrialSession(session.id, { status: 'attended', attended: true });
                                                  const updated = sessions.map(s => s.id === session.id ? { ...s, status: 'attended' as const } : s);
                                                  if (updated.every(s => s.status === 'attended' || s.status === 'absent' || s.status === 'cancelled' || s.converted)) {
                                                    await updateBookingStatus(booking.id, 'completed');
                                                  }
                                                  toast.success('บันทึกการเข้าเรียนสำเร็จ');
                                                  loadData();
                                                } catch { toast.error('เกิดข้อผิดพลาด'); } finally { setSavingSessionId(null); }
                                              }}
                                            >
                                              {savingSessionId === session.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                              มาเรียน
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300 h-8"
                                              disabled={savingSessionId === session.id}
                                              onClick={async () => {
                                                setSavingSessionId(session.id);
                                                try {
                                                  await updateTrialSession(session.id, { status: 'absent', attended: false });
                                                  const updated = sessions.map(s => s.id === session.id ? { ...s, status: 'absent' as const } : s);
                                                  if (updated.every(s => s.status === 'attended' || s.status === 'absent' || s.status === 'cancelled' || s.converted)) {
                                                    await updateBookingStatus(booking.id, 'completed');
                                                  }
                                                  toast.success('บันทึกว่าไม่มาเรียน');
                                                  loadData();
                                                } catch { toast.error('เกิดข้อผิดพลาด'); } finally { setSavingSessionId(null); }
                                              }}
                                            >
                                              {savingSessionId === session.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                                              ไม่มา
                                            </Button>
                                          </div>
                                        ) : session.status === 'scheduled' && !isPast ? (
                                          <Badge className="bg-purple-100 text-purple-700">รอถึงวัน</Badge>
                                        ) : session.status === 'cancelled' ? (
                                          <Badge className="bg-gray-100 text-gray-700">ยกเลิก</Badge>
                                        ) : (
                                          <Badge className={
                                            session.status === 'attended' ? 'bg-green-100 text-green-700' :
                                            session.status === 'absent' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                          }>
                                            {session.status === 'attended' ? 'เข้าเรียนแล้ว' : session.status === 'absent' ? 'ไม่มาเรียน' : 'ยกเลิก'}
                                          </Badge>
                                        )}
                                      </div>
                                      {session.rescheduleHistory && session.rescheduleHistory.length > 0 && (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                                              <History className="h-3 w-3 mr-1" />
                                              เลื่อน {session.rescheduleHistory.length} ครั้ง
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80">
                                            <div className="space-y-3">
                                              <h4 className="font-medium text-sm flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                ประวัติการเลื่อนนัด
                                              </h4>
                                              <div className="space-y-3 max-h-64 overflow-y-auto">
                                                {session.rescheduleHistory.map((history, idx) => {
                                                  const originalDate = history.originalDate instanceof Date ? history.originalDate : new Date((history.originalDate as any).seconds * 1000);
                                                  const newDate = history.newDate instanceof Date ? history.newDate : new Date((history.newDate as any).seconds * 1000);
                                                  const rescheduledAt = history.rescheduledAt instanceof Date ? history.rescheduledAt : new Date((history.rescheduledAt as any).seconds * 1000);
                                                  return (
                                                    <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3">
                                                      <div className="font-medium mb-1">ครั้งที่ {idx + 1}</div>
                                                      <div className="text-gray-600 space-y-0.5 text-xs">
                                                        <div><span className="text-gray-500">จาก:</span> {formatDate(originalDate)} {history.originalTime}</div>
                                                        <div><span className="text-gray-500">เป็น:</span> {formatDate(newDate)} {history.newTime}</div>
                                                        <div><span className="text-gray-500">เหตุผล:</span> {history.reason}</div>
                                                        <div><span className="text-gray-500">เมื่อ:</span> {formatDate(rescheduledAt, 'full')}</div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Add more sessions button for this student */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => {
                                  setSelectedStudent(student.name);
                                  setSessionModalOpen(true);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                เพิ่มนัดหมาย
                              </Button>
                            </div>
                          ) : (
                            /* No session yet - prompt to schedule */
                            <div className="flex items-center justify-between py-2">
                              <p className="text-gray-500 text-sm">ยังไม่มีนัดหมายทดลองเรียน</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedStudent(student.name);
                                  setSessionModalOpen(true);
                                }}
                              >
                                <CalendarCheck className="h-4 w-4 mr-1" />
                                นัดเลยมั้ย?
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & History */}
        <div className="space-y-6">
          {/* Contact History */}
          <ContactHistorySection booking={booking} onUpdate={loadData} />
        </div>
      </div>

      {/* Modals */}
      {sessionModalOpen && booking.branchId && (
        <TrialSessionDialog
          isOpen={sessionModalOpen}
          onClose={() => {
            setSessionModalOpen(false);
            setSelectedStudent('');
          }}
          bookingId={booking.id}
          bookingBranchId={booking.branchId}
          students={booking.students}
          defaultStudent={selectedStudent}
          subjects={subjects}
          teachers={teachers}
          branches={branches}
          onSuccess={handleSessionCreated}
        />
      )}

      {convertModalOpen && selectedSession && (
        <ConvertToStudentDialog
          isOpen={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false);
            setSelectedSession(null);
          }}
          booking={booking}
          session={selectedSession}
          onSuccess={handleConversionSuccess}
        />
      )}

      {rescheduleModalOpen && selectedSession && (
        <RescheduleTrialDialog
          isOpen={rescheduleModalOpen}
          onClose={() => {
            setRescheduleModalOpen(false);
            setSelectedSession(null);
          }}
          session={selectedSession}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      <CancelBookingDialog
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelBooking}
        bookingName={booking?.parentName}
      />

      <AlertDialog open={!!cancelSessionId} onOpenChange={(open) => !open && setCancelSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการยกเลิกนัดหมาย</AlertDialogTitle>
            <AlertDialogDescription>
              การยกเลิกนัดหมายทดลองเรียนนี้ไม่สามารถย้อนกลับได้ ต้องการดำเนินการต่อหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={async () => {
                if (!cancelSessionId) return;
                try {
                  await cancelTrialSession(cancelSessionId, 'ยกเลิกโดย Admin');
                  toast.success('ยกเลิกนัดหมายสำเร็จ');
                  loadData();
                } catch (error) {
                  toast.error('เกิดข้อผิดพลาดในการยกเลิก');
                } finally {
                  setCancelSessionId(null);
                }
              }}
            >
              ยืนยันยกเลิก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Student Confirmation */}
      <AlertDialog open={deleteStudentIndex !== null} onOpenChange={(open) => !open && setDeleteStudentIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบนักเรียน</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบ &quot;{deleteStudentIndex !== null ? booking?.students[deleteStudentIndex]?.name : ''}&quot; ออกจากการจองนี้หรือไม่? การลบไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDeleteStudent}
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
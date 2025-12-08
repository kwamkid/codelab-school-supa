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
  School,
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
  Baby
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
  cancelTrialBooking
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
      birthdate: student.birthdate ? new Date(student.birthdate).toISOString().split('T')[0] : '',
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
    toast.success('ยกเลิกการจองเรียบร้อย');
    
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
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TestTube className="h-8 w-8 text-red-500" />
              รายละเอียดการจองทดลองเรียน
            </h1>
            <p className="text-gray-600 mt-2">
              จองเมื่อ {formatDate(booking.createdAt, 'full')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getSourceBadge(booking.source)}
            {getStatusBadge(booking.status)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Booking Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Parent & Students Info - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="space-y-3">
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
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Students Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-gray-400" />
                  นักเรียน ({booking.students.length} คน)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {booking.students.map((student, idx) => (
                    <div key={idx} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                      {editingStudent === idx ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="ชื่อ-นามสกุล"
                            value={tempStudentData.name}
                            onChange={(e) => setTempStudentData(prev => ({ ...prev, name: e.target.value }))}
                            className="h-8 text-sm"
                          />
                          <div>
                            <Input
                              type="date"
                              placeholder="วันเกิด"
                              value={tempStudentData.birthdate}
                              onChange={(e) => setTempStudentData(prev => ({ ...prev, birthdate: e.target.value }))}
                              max={new Date().toISOString().split('T')[0]}
                              className="h-8 text-sm"
                            />
                            {tempStudentData.birthdate && (
                              <p className="text-xs text-gray-500 mt-1">
                                อายุ: {calculateAge(new Date(tempStudentData.birthdate))} ปี
                              </p>
                            )}
                          </div>
                          <Input
                            placeholder="โรงเรียน"
                            value={tempStudentData.schoolName}
                            onChange={(e) => setTempStudentData(prev => ({ ...prev, schoolName: e.target.value }))}
                            className="h-8 text-sm"
                          />
                          <GradeLevelCombobox
                            value={tempStudentData.gradeLevel}
                            onChange={(value) => setTempStudentData(prev => ({ ...prev, gradeLevel: value }))}
                            placeholder="ระดับชั้น..."
                          />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={handleStudentSave} className="text-xs h-7">บันทึก</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingStudent(null)} className="text-xs h-7">ยกเลิก</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{student.name}</h4>
                              <div className="space-y-0.5 mt-1">
                                {student.birthdate && (
                                  <p className="text-xs text-gray-600 flex items-center gap-1">
                                    <Baby className="h-3 w-3" />
                                    {formatDate(student.birthdate)} (อายุ {calculateAge(student.birthdate)} ปี)
                                  </p>
                                )}
                                {student.schoolName && (
                                  <p className="text-xs text-gray-600 flex items-center gap-1">
                                    <School className="h-3 w-3" />
                                    {student.schoolName}
                                  </p>
                                )}
                                {student.gradeLevel && (
                                  <p className="text-xs text-gray-600">
                                    ระดับชั้น: {student.gradeLevel}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleStudentEdit(idx)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">วิชาที่สนใจ:</p>
                            <div className="flex flex-wrap gap-1">
                              {student.subjectInterests.map(subjectId => {
                                const subject = subjects.find(s => s.id === subjectId);
                                return subject ? (
                                  <Badge 
                                    key={subjectId} 
                                    className="text-xs h-5 px-1.5"
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
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trial Sessions */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">การทดลองเรียน</CardTitle>
                  <CardDescription className="text-xs">
                    จัดการนัดหมายทดลองเรียนสำหรับแต่ละนักเรียน
                  </CardDescription>
                </div>
                {unscheduledStudents.length > 0 && booking.branchId && (
                  <Button
                    onClick={() => setSessionModalOpen(true)}
                    size="sm"
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    นัดหมาย
                  </Button>
                )}
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
              ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">ยังไม่มีการนัดหมายทดลองเรียน</p>
                  {booking.status === 'new' && (
                    <p className="text-sm text-gray-400 mt-2">
                      กรุณาติดต่อผู้ปกครองก่อนนัดหมาย
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>นักเรียน</TableHead>
                        <TableHead>วิชา</TableHead>
                        <TableHead>วันที่และเวลา</TableHead>
                        <TableHead>สาขา/ครู/ห้อง</TableHead>
                        <TableHead className="text-center">การเข้าเรียน</TableHead>
                        <TableHead>ประวัติ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => {
                        const subject = subjects.find(s => s.id === session.subjectId);
                        const teacher = teachers.find(t => t.id === session.teacherId);
                        const branch = branches.find(b => b.id === session.branchId);
                        const room = rooms[session.branchId]?.find(r => r.id === session.roomId);
                        const isPast = new Date(session.scheduledDate) < new Date();
                        
                        return (
                          <TableRow key={session.id} className={session.status === 'cancelled' ? 'opacity-60' : ''}>
                            <TableCell>
                              <div className="font-medium">{session.studentName}</div>
                              {session.converted && (
                                <Badge className="mt-1 bg-emerald-100 text-emerald-700" variant="outline">
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  ลงทะเบียนแล้ว
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge style={{ backgroundColor: subject?.color || '#EF4444' }}>
                                {subject?.name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{formatDate(session.scheduledDate)}</div>
                                <div className="text-sm text-gray-600">
                                  {session.startTime} - {session.endTime}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{branch?.name}</div>
                                <div className="text-sm text-gray-600">
                                  ครู{teacher?.nickname || teacher?.name}
                                </div>
                                <div className="text-sm text-gray-600">
                                  ห้อง {session.roomName || room?.name || session.roomId}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {session.converted ? (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  ลงทะเบียนแล้ว
                                </Badge>
                              ) : (
                                <>
                                  {session.status === 'scheduled' && isPast ? (
                                    <div className="flex gap-2 justify-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                        onClick={async () => {
                                          try {
                                            await updateTrialSession(session.id, {
                                              status: 'attended',
                                              attended: true
                                            });
                                            
                                            const updatedSessions = sessions.map(s => 
                                              s.id === session.id ? { ...s, status: 'attended' as const } : s
                                            );
                                            const allCompleted = updatedSessions.every(s => 
                                              s.status === 'attended' || s.status === 'absent' || s.status === 'cancelled' || s.converted
                                            );
                                            
                                            if (allCompleted) {
                                              await updateBookingStatus(booking.id, 'completed');
                                            }
                                            
                                            toast.success('บันทึกการเข้าเรียนสำเร็จ');
                                            loadData();
                                          } catch (error) {
                                            toast.error('เกิดข้อผิดพลาดในการบันทึก');
                                          }
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        มาเรียน
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                                        onClick={async () => {
                                          try {
                                            await updateTrialSession(session.id, {
                                              status: 'absent',
                                              attended: false
                                            });
                                            
                                            const updatedSessions = sessions.map(s => 
                                              s.id === session.id ? { ...s, status: 'absent' as const } : s
                                            );
                                            const allCompleted = updatedSessions.every(s => 
                                              s.status === 'attended' || s.status === 'absent' || s.status === 'cancelled' || s.converted
                                            );
                                            
                                            if (allCompleted) {
                                              await updateBookingStatus(booking.id, 'completed');
                                            }
                                            
                                            toast.success('บันทึกว่าไม่มาเรียน');
                                            loadData();
                                          } catch (error) {
                                            toast.error('เกิดข้อผิดพลาดในการบันทึก');
                                          }
                                        }}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        ไม่มา
                                      </Button>
                                    </div>
                                  ) : session.status === 'scheduled' && !isPast ? (
                                    <Badge className="bg-purple-100 text-purple-700">
                                      รอถึงวัน
                                    </Badge>
                                  ) : session.status === 'cancelled' ? (
                                    <Badge className="bg-gray-100 text-gray-700">
                                      ยกเลิก
                                    </Badge>
                                  ) : (
                                    <Badge className={
                                      session.status === 'attended' ? 'bg-green-100 text-green-700' :
                                      session.status === 'absent' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }>
                                      {session.status === 'attended' ? 'เข้าเรียนแล้ว' :
                                       session.status === 'absent' ? 'ไม่มาเรียน' :
                                       'ยกเลิก'}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell>
                              {session.rescheduleHistory && session.rescheduleHistory.length > 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-auto py-1 px-2"
                                    >
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
                                          const originalDate = history.originalDate instanceof Date 
                                            ? history.originalDate 
                                            : new Date((history.originalDate as any).seconds * 1000);
                                          const newDate = history.newDate instanceof Date 
                                            ? history.newDate 
                                            : new Date((history.newDate as any).seconds * 1000);
                                          const rescheduledAt = history.rescheduledAt instanceof Date 
                                            ? history.rescheduledAt 
                                            : new Date((history.rescheduledAt as any).seconds * 1000);
                                          
                                          return (
                                            <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3">
                                              <div className="font-medium mb-1">ครั้งที่ {idx + 1}</div>
                                              <div className="text-gray-600 space-y-0.5 text-xs">
                                                <div className="flex items-start gap-1">
                                                  <span className="text-gray-500">จาก:</span>
                                                  <span>{formatDate(originalDate)} {history.originalTime}</span>
                                                </div>
                                                <div className="flex items-start gap-1">
                                                  <span className="text-gray-500">เป็น:</span>
                                                  <span>{formatDate(newDate)} {history.newTime}</span>
                                                </div>
                                                <div className="flex items-start gap-1">
                                                  <span className="text-gray-500">เหตุผล:</span>
                                                  <span>{history.reason}</span>
                                                </div>
                                                <div className="flex items-start gap-1">
                                                  <span className="text-gray-500">เมื่อ:</span>
                                                  <span>{formatDate(rescheduledAt, 'full')}</span>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <span className="sr-only">Open menu</span>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 z-50">
                                  <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  {session.converted ? (
                                    <DropdownMenuItem disabled className="text-gray-400">
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      ลงทะเบียนเรียบร้อยแล้ว
                                    </DropdownMenuItem>
                                  ) : (
                                    <>
                                      {session.status === 'scheduled' && isPast && (
                                        <DropdownMenuItem
                                          onSelect={async () => {
                                            try {
                                              await updateTrialSession(session.id, {
                                                status: 'attended',
                                                attended: true
                                              });
                                              
                                              const allSessions = sessions.filter(s => s.id !== session.id);
                                              const allAttended = allSessions.every(s => 
                                                s.status === 'attended' || s.status === 'absent' || s.status === 'cancelled' || s.converted
                                              );
                                              
                                              if (allAttended) {
                                                await updateBookingStatus(booking.id, 'completed');
                                              }
                                              
                                              toast.success('บันทึกการเข้าเรียนสำเร็จ');
                                              loadData();
                                            } catch (error) {
                                              console.error('Error updating attendance:', error);
                                              toast.error('เกิดข้อผิดพลาดในการบันทึก');
                                            }
                                          }}
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          บันทึกว่าเข้าเรียนแล้ว
                                        </DropdownMenuItem>
                                      )}
                                      
                                      {!session.converted && (
                                        <DropdownMenuItem 
                                          onSelect={() => {
                                            setSelectedSession(session);
                                            setConvertModalOpen(true);
                                          }}
                                          className="text-green-600 focus:text-green-600"
                                        >
                                          <UserPlus className="h-4 w-4 mr-2" />
                                          แปลงเป็นนักเรียน
                                        </DropdownMenuItem>
                                      )}
                                      
                                      {((session.status === 'scheduled' && !isPast) || 
                                       session.status === 'cancelled' || 
                                       session.status === 'absent') && (
                                        <>
                                          <DropdownMenuItem
                                            onSelect={() => {
                                              setSelectedSession(session);
                                              setRescheduleModalOpen(true);
                                            }}
                                          >
                                            <Edit className="h-4 w-4 mr-2" />
                                            {session.status === 'cancelled' ? 'นัดวันใหม่' : 'เปลี่ยนวันนัดหมาย'}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      
                                      {session.status === 'scheduled' && !isPast && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            className="text-red-600 focus:text-red-600"
                                            onSelect={async () => {
                                              if (confirm('ยืนยันการยกเลิกนัดหมาย?')) {
                                                try {
                                                  await cancelTrialSession(session.id, 'ยกเลิกโดย Admin');
                                                  toast.success('ยกเลิกนัดหมายสำเร็จ');
                                                  loadData();
                                                } catch (error) {
                                                  toast.error('เกิดข้อผิดพลาดในการยกเลิก');
                                                }
                                              }
                                            }}
                                          >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            ยกเลิกนัดหมาย
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & History */}
        <div className="space-y-6">
          {/* Branch Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  สาขา
                </CardTitle>
                {!editingBranch && (
                  <Button variant="ghost" size="icon" onClick={handleBranchEdit}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingBranch ? (
                <div className="space-y-4">
                  <Select value={tempBranchId} onValueChange={setTempBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขา" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleBranchSave} disabled={!tempBranchId} className="flex-1">
                      <Save className="h-4 w-4 mr-1" />
                      บันทึก
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setEditingBranch(false)}
                      className="flex-1"
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {booking.branchId ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">
                        {branches.find(b => b.id === booking.branchId)?.name || booking.branchId}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-amber-600 font-medium text-sm">ยังไม่ได้เลือกสาขา</p>
                      <p className="text-xs text-gray-600 mt-1">คลิกปุ่มแก้ไขเพื่อเลือกสาขา</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">การดำเนินการ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.status === 'new' && (
                <Button
                  onClick={() => handleStatusUpdate('contacted')}
                  className="w-full"
                  variant="outline"
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  บันทึกว่าติดต่อแล้ว
                </Button>
              )}
              
              {booking.status === 'contacted' && (
                <>
                  {sessions.length === 0 && (
                    <Alert className="mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        กรุณานัดหมายทดลองเรียนให้กับนักเรียน
                      </AlertDescription>
                    </Alert>
                  )}
                  {sessions.length > 0 && (
                    <Button
                      onClick={() => handleStatusUpdate('scheduled')}
                      className="w-full mb-2"
                      variant="outline"
                    >
                      <CalendarCheck className="h-4 w-4 mr-2" />
                      เปลี่ยนสถานะเป็นนัดหมายแล้ว
                    </Button>
                  )}
                  <button
                    onClick={() => handleStatusUpdate('new')}
                    className="text-xs text-gray-500 hover:text-gray-700 underline w-full text-center"
                  >
                    กลับสถานะเป็นยังไม่ได้ติดต่อ
                  </button>
                </>
              )}
              
              {sessions.some(s => s.status === 'attended' && !s.converted) && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    มีนักเรียนที่ทดลองเรียนแล้ว สามารถแปลงเป็นนักเรียนจริงได้
                  </AlertDescription>
                </Alert>
              )}
              
              {(booking.status === 'new' || booking.status === 'contacted' || booking.status === 'scheduled') && (
                <>
                 <div className="pt-2 mt-2 border-t">
                    <Button
                      onClick={() => setCancelDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      ยกเลิกการจอง
                    </Button>
                  </div>
                </>
              )}
              
              {booking.status === 'cancelled' && (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    การจองนี้ถูกยกเลิกแล้ว
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

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
          students={unscheduledStudents}
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
    </div>
  );
}
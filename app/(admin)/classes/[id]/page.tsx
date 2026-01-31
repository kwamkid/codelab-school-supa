'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Class, Branch, Subject, Teacher, Room, ClassSchedule } from '@/types/models';
import { getClass, getClassSchedules, updateClass, deleteClass, fixEnrolledCount, getEndClassPreview, endClassNow } from '@/lib/services/classes';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { getStudentWithParent } from '@/lib/services/parents';
import { useAuth } from '@/hooks/useAuth';
import { getBranch } from '@/lib/services/branches';
import { getSubject } from '@/lib/services/subjects';
import { getTeacher } from '@/lib/services/teachers';
import { getRoom } from '@/lib/services/rooms';
import { Student } from '@/types/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft,
  Edit,
  Trash2,
  Calendar,
  Users,
  AlertCircle,
  History,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDate, formatCurrency, getDayName } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RescheduleHistoryDialog from '@/components/classes/reschedule-history-dialog';

const statusColors = {
  'draft': 'bg-gray-100 text-gray-700',
  'published': 'bg-blue-100 text-blue-700',
  'started': 'bg-green-100 text-green-700',
  'completed': 'bg-gray-100 text-gray-700',
  'cancelled': 'bg-red-100 text-red-700',
};

const statusLabels = {
  'draft': 'ร่าง',
  'published': 'เปิดรับสมัคร',
  'started': 'กำลังเรียน',
  'completed': 'จบแล้ว',
  'cancelled': 'ยกเลิก',
};

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isSuperAdmin } = useAuth();
  const classId = params.id as string;

  const [classData, setClassData] = useState<Class | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false);
  const [endClassDialogOpen, setEndClassDialogOpen] = useState(false);
  const [endClassPreview, setEndClassPreview] = useState<{
    lastSessionDate: string | null;
    completedSessions: number;
    futureSessions: number;
    totalSessions: number;
  } | null>(null);
  const [endingClass, setEndingClass] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<(Student & {
    parentName: string;
    parentPhone: string;
    paymentStatus: 'pending' | 'partial' | 'paid';
    paidAmount: number;
    finalPrice: number;
  })[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (classId) {
      loadClassDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const loadClassDetails = async () => {
    try {
      const classInfo = await getClass(classId);
      if (!classInfo) {
        toast.error('ไม่พบข้อมูลคลาส');
        router.push('/classes');
        return;
      }
      
      setClassData(classInfo);
      
      // Load related data
      const [branchData, subjectData, teacherData, roomData, schedulesData] = await Promise.all([
        getBranch(classInfo.branchId),
        getSubject(classInfo.subjectId),
        getTeacher(classInfo.teacherId),
        getRoom(classInfo.branchId, classInfo.roomId),
        getClassSchedules(classId)
      ]);
      
      setBranch(branchData);
      setSubject(subjectData);
      setTeacher(teacherData);
      setRoom(roomData);
      setSchedules(schedulesData);

      // Load enrolled students (non-blocking)
      loadEnrolledStudents();
    } catch (error) {
      console.error('Error loading class details:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const loadEnrolledStudents = async () => {
    setLoadingStudents(true);
    try {
      const enrollments = await getEnrollmentsByClass(classId);
      const studentsWithPayment = await Promise.all(
        enrollments.map(async (enrollment) => {
          const student = await getStudentWithParent(enrollment.studentId);
          if (!student) return null;
          return {
            ...student,
            paymentStatus: enrollment.payment.status,
            paidAmount: enrollment.payment.paidAmount,
            finalPrice: enrollment.pricing.finalPrice,
          };
        })
      );
      setEnrolledStudents(studentsWithPayment.filter(Boolean) as (Student & { parentName: string; parentPhone: string; paymentStatus: 'pending' | 'partial' | 'paid'; paidAmount: number; finalPrice: number })[]);
    } catch (error) {
      console.error('Error loading enrolled students:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleDelete = async () => {
    if (!classData) return;
    
    setDeleting(true);
    try {
      await deleteClass(classId);
      toast.success('ลบคลาสเรียบร้อยแล้ว');
      router.push('/classes');
    } catch (error: any) {
      console.error('Error deleting class:', error);
      if (error.message === 'Cannot delete class with enrolled students') {
        toast.error('ไม่สามารถลบคลาสที่มีนักเรียนลงทะเบียนแล้ว');
      } else {
        toast.error('ไม่สามารถลบคลาสได้');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = async () => {
    if (!classData) return;

    setDeleting(true);
    try {
      await updateClass(classId, { status: 'cancelled' });
      toast.success('ยกเลิกคลาสเรียบร้อยแล้ว');
      router.push('/classes');
    } catch (error) {
      console.error('Error cancelling class:', error);
      toast.error('ไม่สามารถยกเลิกคลาสได้');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEndClassDialog = async () => {
    try {
      const preview = await getEndClassPreview(classId);
      setEndClassPreview(preview);
      setEndClassDialogOpen(true);
    } catch (error) {
      console.error('Error loading end class preview:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
  };

  const handleEndClass = async () => {
    setEndingClass(true);
    try {
      const result = await endClassNow(classId);
      toast.success(`จบคลาสเรียบร้อย! วันจบใหม่: ${formatDate(new Date(result.newEndDate), 'long')}`);
      setEndClassDialogOpen(false);
      await loadClassDetails();
    } catch (error) {
      console.error('Error ending class:', error);
      toast.error('ไม่สามารถจบคลาสได้');
    } finally {
      setEndingClass(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!classData || !branch || !subject || !teacher || !room) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลคลาส</p>
        <Link href="/classes" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการคลาส
        </Link>
      </div>
    );
  }

  const isEditable = classData.status === 'draft' || classData.status === 'published';
  // Allow deletion for cancelled classes and classes with 0 or negative enrolled count
  const isDeletable = classData.enrolledCount <= 0 || classData.status === 'cancelled';

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <Link 
          href="/classes" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการคลาส
        </Link>
        
        <div className="flex gap-2">
          {isEditable && (
            <Link href={`/classes/${classId}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                แก้ไข
              </Button>
            </Link>
          )}
          
          {isDeletable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  ลบคลาส
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการลบคลาส</AlertDialogTitle>
                  <AlertDialogDescription>
                    คุณแน่ใจหรือไม่ที่จะลบคลาส &quot;{classData.name}&quot;? 
                    การกระทำนี้ไม่สามารถยกเลิกได้
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                    ลบคลาส
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {!isDeletable && classData.status !== 'cancelled' && classData.enrolledCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  ยกเลิกคลาส
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการยกเลิกคลาส</AlertDialogTitle>
                  <AlertDialogDescription>
                    คุณแน่ใจหรือไม่ที่จะยกเลิกคลาส &quot;{classData.name}&quot;?
                    {classData.enrolledCount > 0 && (
                      <span className="block mt-2 text-red-600">
                        คลาสนี้มีนักเรียน {classData.enrolledCount} คน
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-red-500 hover:bg-red-600">
                    ยืนยันยกเลิกคลาส
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* End Class Now - Super Admin only */}
          {isSuperAdmin && (classData.status === 'started' || classData.status === 'published') && (
            <Button
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={handleOpenEndClassDialog}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              จบคลาสเลย
            </Button>
          )}
        </div>
      </div>

      {/* End Class Dialog */}
      <AlertDialog open={endClassDialogOpen} onOpenChange={setEndClassDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-orange-500" />
              จบคลาสเลย
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>ระบบจะดำเนินการดังนี้:</p>
                {endClassPreview && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">วันเรียนล่าสุด:</span>
                      <span className="font-medium">
                        {endClassPreview.lastSessionDate
                          ? formatDate(new Date(endClassPreview.lastSessionDate), 'long')
                          : 'ไม่มี (ใช้วันนี้)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Session ที่เรียนแล้ว:</span>
                      <span className="font-medium text-green-600">{endClassPreview.completedSessions} ครั้ง</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Session ที่จะถูกยกเลิก:</span>
                      <span className="font-medium text-red-600">{endClassPreview.futureSessions} ครั้ง</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Session ทั้งหมด:</span>
                      <span className="font-medium">{endClassPreview.totalSessions} ครั้ง</span>
                    </div>
                  </div>
                )}
                <p className="text-orange-600 text-sm">
                  * สถานะคลาสจะเปลี่ยนเป็น &quot;จบแล้ว&quot; และ end_date จะถูกอัพเดทเป็นวันเรียนล่าสุด
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={endingClass}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndClass}
              disabled={endingClass}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {endingClass ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  ยืนยันจบคลาส
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Class Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: subject.color }}
              />
              {classData.name}
            </h1>
            <p className="text-gray-600 mt-2">รหัสคลาส: {classData.code}</p>
          </div>
          <Badge className={statusColors[classData.status as keyof typeof statusColors]}>
            {statusLabels[classData.status as keyof typeof statusLabels]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลทั่วไป</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">วิชา</p>
                  <p className="font-medium">{subject.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ระดับ</p>
                  <p className="font-medium">{subject.level}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">สาขา</p>
                  <p className="font-medium">{branch.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ห้องเรียน</p>
                  <p className="font-medium">{room.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ครูผู้สอน</p>
                  <p className="font-medium">{teacher.nickname || teacher.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">จำนวนนักเรียน</p>
                  <p className="font-medium">
                    {classData.enrolledCount}/{classData.maxStudents} คน
                    {classData.enrolledCount >= classData.maxStudents && (
                      <span className="text-red-600 text-sm ml-2">(เต็ม)</span>
                    )}
                    {classData.enrolledCount < 0 && (
                      <span className="text-red-600 text-sm ml-2">(ข้อมูลผิดพลาด)</span>
                    )}
                  </p>
                  {classData.enrolledCount < 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={async () => {
                        try {
                          await fixEnrolledCount(classId, 0);
                          toast.success('แก้ไขจำนวนนักเรียนเรียบร้อยแล้ว');
                          loadClassDetails();
                        } catch (error) {
                          toast.error('ไม่สามารถแก้ไขจำนวนนักเรียนได้');
                        }
                      }}
                    >
                      รีเซ็ตจำนวนนักเรียนเป็น 0
                    </Button>
                  )}
                </div>
              </div>

              {classData.description && (
                <div>
                  <p className="text-sm text-gray-500">คำอธิบาย</p>
                  <p className="mt-1">{classData.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enrolled Students - moved up */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  นักเรียนที่ลงทะเบียน ({enrolledStudents.length})
                </CardTitle>
                <Link href={`/enrollments/by-class/${classId}`}>
                  <Button variant="outline" size="sm">
                    จัดการนักเรียน
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : enrolledStudents.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  ยังไม่มีนักเรียนลงทะเบียน
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชื่อเล่น</TableHead>
                        <TableHead>อายุ</TableHead>
                        <TableHead>ผู้ปกครอง</TableHead>
                        <TableHead>เบอร์โทร</TableHead>
                        <TableHead>การชำระเงิน</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrolledStudents.map((student, index) => {
                        const age = Math.floor(
                          (Date.now() - student.birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                        );
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="text-center text-gray-500">{index + 1}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.nickname || '-'}</TableCell>
                            <TableCell>{age} ปี</TableCell>
                            <TableCell>{student.parentName}</TableCell>
                            <TableCell>
                              {student.parentPhone ? (
                                <a href={`tel:${student.parentPhone}`} className="text-blue-600 hover:underline">
                                  {student.parentPhone}
                                </a>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {student.paymentStatus === 'paid' && (
                                <Badge className="bg-green-100 text-green-700">ชำระแล้ว</Badge>
                              )}
                              {student.paymentStatus === 'partial' && (
                                <Badge className="bg-yellow-100 text-yellow-700">
                                  ชำระบางส่วน ({formatCurrency(student.paidAmount)})
                                </Badge>
                              )}
                              {student.paymentStatus === 'pending' && (
                                <Badge className="bg-red-100 text-red-700">ยังไม่ชำระ</Badge>
                              )}
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

        {/* Side Info */}
        <div className="space-y-6">
          {/* Attendance - Prominent Button */}
          <Link href={`/classes/${classId}/attendance`} className="block">
            <Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white">
              <Calendar className="h-5 w-5 mr-2" />
              เช็คชื่อเข้าเรียน
            </Button>
          </Link>

          {/* Schedule Information - moved to sidebar */}
          <Card>
            <CardHeader>
              <CardTitle>ตารางเรียน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">วันที่เรียน</p>
                  <p className="font-medium">
                    {classData.daysOfWeek.map(d => getDayName(d)).join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">เวลาเรียน</p>
                  <p className="font-medium">{classData.startTime.slice(0, 5)} - {classData.endTime.slice(0, 5)} น.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">วันเริ่ม</p>
                    <p className="font-medium text-sm">{formatDate(classData.startDate, 'short')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">วันจบ</p>
                    <p className="font-medium text-sm">{formatDate(classData.endDate, 'short')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">จำนวนครั้ง</p>
                  <p className="font-medium">{classData.totalSessions} ครั้ง</p>
                </div>
              </div>

              {/* Sessions List */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">รายละเอียดแต่ละครั้ง</h4>
                  {schedules.some(s => s.status === 'rescheduled') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRescheduleHistory(true)}
                    >
                      <History className="h-3 w-3 mr-1" />
                      ประวัติเลื่อน
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-xs">#</TableHead>
                        <TableHead className="text-xs">วันที่</TableHead>
                        <TableHead className="text-xs">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules
                        .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
                        .map((schedule, index) => {
                          const isPast = new Date(schedule.sessionDate) < new Date();
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const scheduleDate = new Date(schedule.sessionDate);
                          scheduleDate.setHours(0, 0, 0, 0);
                          const isToday = scheduleDate.getTime() === today.getTime();

                          return (
                            <TableRow key={schedule.id}>
                              <TableCell className="text-center text-xs">{index + 1}</TableCell>
                              <TableCell className="text-xs">
                                {formatDate(schedule.sessionDate, 'short')}
                                {schedule.originalDate && (
                                  <span className="block text-xs text-gray-400">
                                    (จาก {formatDate(schedule.originalDate, 'short')})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {schedule.status === 'completed' && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">เรียนแล้ว</Badge>
                                )}
                                {schedule.status === 'cancelled' && (
                                  <Badge variant="destructive" className="text-xs">ยกเลิก</Badge>
                                )}
                                {schedule.status === 'rescheduled' && (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">เลื่อน</Badge>
                                )}
                                {schedule.status === 'scheduled' && (
                                  <>
                                    {isToday && (
                                      <Badge className="bg-blue-100 text-blue-700 text-xs">วันนี้</Badge>
                                    )}
                                    {!isToday && isPast && (
                                      <Badge className="bg-gray-100 text-gray-700 text-xs">รอบันทึก</Badge>
                                    )}
                                    {!isToday && !isPast && (
                                      <Badge variant="outline" className="text-xs">รอเรียน</Badge>
                                    )}
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลราคา</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">ราคาคลาส</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(classData.pricing.totalPrice)}
                </p>
                <p className="text-sm text-gray-500">
                  ({formatCurrency(classData.pricing.pricePerSession)}/ครั้ง)
                </p>
              </div>

              {classData.pricing.materialFee != null && classData.pricing.materialFee > 0 && (
                <div>
                  <p className="text-sm text-gray-500">ค่าอุปกรณ์</p>
                  <p className="font-medium">{formatCurrency(classData.pricing.materialFee)}</p>
                </div>
              )}

              {classData.pricing.registrationFee != null && classData.pricing.registrationFee > 0 && (
                <div>
                  <p className="text-sm text-gray-500">ค่าลงทะเบียน</p>
                  <p className="font-medium">{formatCurrency(classData.pricing.registrationFee)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อกำหนด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">นักเรียนขั้นต่ำ</span>
                <span className="font-medium">{classData.minStudents} คน</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">นักเรียนสูงสุด</span>
                <span className="font-medium">{classData.maxStudents} คน</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ช่วงอายุ</span>
                <span className="font-medium">{subject.ageRange.min}-{subject.ageRange.max} ปี</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reschedule History Dialog */}
      {classData && (
        <RescheduleHistoryDialog
          open={showRescheduleHistory}
          onOpenChange={setShowRescheduleHistory}
          classId={classId}
          className={classData.name}
        />
      )}
    </div>
  );
}
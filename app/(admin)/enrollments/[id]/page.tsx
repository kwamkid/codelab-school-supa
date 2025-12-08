'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Enrollment, Class, Student, Parent, Branch, Subject, Teacher } from '@/types/models';
import { getEnrollment, cancelEnrollment, updateEnrollment, deleteEnrollment } from '@/lib/services/enrollments';
import { getClass } from '@/lib/services/classes';
import { getParent, getStudent } from '@/lib/services/parents';
import { getBranch } from '@/lib/services/branches';
import { getSubject } from '@/lib/services/subjects';
import { getTeacher } from '@/lib/services/teachers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Edit, 
  Printer,
  DollarSign,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  School,
  Phone,
  Mail,
  AlertCircle,
  History,
  XCircle,
  Trash2,
  MoreVertical,
  CreditCard,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDate, formatCurrency, getDayName, calculateAge } from '@/lib/utils';
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
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMakeupClassesByStudent } from '@/lib/services/makeup';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';

const statusColors = {
  'active': 'bg-green-100 text-green-700',
  'completed': 'bg-gray-100 text-gray-700',
  'dropped': 'bg-red-100 text-red-700',
  'transferred': 'bg-blue-100 text-blue-700',
};

const statusLabels = {
  'active': 'กำลังเรียน',
  'completed': 'จบแล้ว',
  'dropped': 'ยกเลิก',
  'transferred': 'ย้ายคลาส',
};

const paymentStatusColors = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'partial': 'bg-orange-100 text-orange-700',
  'paid': 'bg-green-100 text-green-700',
};

const paymentStatusLabels = {
  'pending': 'รอชำระ',
  'partial': 'ชำระบางส่วน',
  'paid': 'ชำระแล้ว',
};

const paymentMethodLabels = {
  'cash': 'เงินสด',
  'transfer': 'โอนเงิน',
  'credit': 'บัตรเครดิต',
};

export default function EnrollmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.id as string;
  const { canViewBranch } = useBranch();
  const { adminUser } = useAuth();
  
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [makeupClasses, setMakeupClasses] = useState<any[]>([]);

  
  // Quick payment update states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentUpdating, setPaymentUpdating] = useState(false);
  const [quickPayment, setQuickPayment] = useState({
    status: 'pending' as 'pending' | 'partial' | 'paid',
    paidAmount: 0,
    receiptNumber: ''
  });

  useEffect(() => {
    loadEnrollmentDetails();
  }, [enrollmentId]);

  const loadEnrollmentDetails = async () => {
    if (!enrollmentId) {
      setLoading(false);
      return;
    }

    console.log('Loading enrollment details for:', enrollmentId);
    
    try {
      const enrollmentData = await getEnrollment(enrollmentId);
      console.log('Enrollment data:', enrollmentData);
      
      if (!enrollmentData) {
        toast.error('ไม่พบข้อมูลการลงทะเบียน');
        router.push('/enrollments');
        return;
      }
      
      // Check if user can view this enrollment's branch
      if (!canViewBranch(enrollmentData.branchId)) {
        toast.error('คุณไม่มีสิทธิ์ดูข้อมูลการลงทะเบียนนี้');
        router.push('/enrollments');
        return;
      }
      
      setEnrollment(enrollmentData);
      
      // Load all related data
      const [classInfo, parentInfo, studentInfo] = await Promise.all([
        getClass(enrollmentData.classId),
        getParent(enrollmentData.parentId),
        getStudent(enrollmentData.parentId, enrollmentData.studentId)
      ]);
      
      console.log('Related data:', { classInfo, parentInfo, studentInfo });
      
      if (!classInfo || !parentInfo || !studentInfo) {
        toast.error('ไม่สามารถโหลดข้อมูลที่เกี่ยวข้องได้');
        setLoading(false);
        return;
      }
      
      setClassData(classInfo);
      setParent(parentInfo);
      setStudent(studentInfo);
      
      // Load additional data
      const [branchInfo, subjectInfo, teacherInfo, makeupData] = await Promise.all([
        getBranch(classInfo.branchId),
        getSubject(classInfo.subjectId),
        getTeacher(classInfo.teacherId),
        getMakeupClassesByStudent(enrollmentData.studentId)
      ]);
      
      setBranch(branchInfo);
      setSubject(subjectInfo);
      setTeacher(teacherInfo);
      setMakeupClasses(makeupData.filter(m => m.originalClassId === enrollmentData.classId));
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading enrollment details:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
      setLoading(false);
    }
  };

  const handleCancelEnrollment = async () => {
    if (!cancelReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }
    
    setCancelling(true);
    try {
      await cancelEnrollment(enrollmentId, cancelReason);
      toast.success('ยกเลิกการลงทะเบียนเรียบร้อยแล้ว');
      loadEnrollmentDetails(); // Reload data
    } catch (error) {
      console.error('Error cancelling enrollment:', error);
      toast.error('ไม่สามารถยกเลิกการลงทะเบียนได้');
    } finally {
      setCancelling(false);
      setCancelReason('');
    }
  };

  const handleDeleteEnrollment = async () => {
    setDeleting(true);
    try {
      await deleteEnrollment(enrollmentId);
      toast.success('ลบการลงทะเบียนเรียบร้อยแล้ว');
      router.push('/enrollments');
    } catch (error) {
      console.error('Error deleting enrollment:', error);
      toast.error('ไม่สามารถลบการลงทะเบียนได้');
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickPaymentUpdate = async () => {
    setPaymentUpdating(true);
    try {
      const updateData: Partial<Enrollment> = {
        payment: {
          ...enrollment!.payment,
          status: quickPayment.status,
          paidAmount: quickPayment.paidAmount,
          method: enrollment!.payment.method
        }
      };

      // Add receipt number if provided
      if (quickPayment.receiptNumber) {
        updateData.payment!.receiptNumber = quickPayment.receiptNumber;
      }

      // Set paid date if status is paid
      if (quickPayment.status === 'paid' && enrollment!.payment.status !== 'paid') {
        updateData.payment!.paidDate = new Date();
      }

      await updateEnrollment(enrollmentId, updateData);
      toast.success('อัพเดทการชำระเงินเรียบร้อยแล้ว');
      setShowPaymentDialog(false);
      loadEnrollmentDetails(); // Reload data
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('ไม่สามารถอัพเดทการชำระเงินได้');
    } finally {
      setPaymentUpdating(false);
    }
  };

  const handlePrintReceipt = () => {
    // TODO: Implement print receipt
    toast.info('ฟังก์ชันพิมพ์ใบเสร็จจะเพิ่มในภายหลัง');
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

  if (!enrollment || !classData || !student || !parent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลการลงทะเบียน</p>
        <Link href="/enrollments" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการลงทะเบียน
        </Link>
      </div>
    );
  }

  const isActive = enrollment.status === 'active';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <Link 
          href="/enrollments" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการลงทะเบียน
        </Link>
        
        <div className="flex gap-2">
          {/* Quick Payment Update Button */}
          <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
            {enrollment.payment.status !== 'paid' && (
              <Button 
                variant="outline" 
                className="text-green-600"
                onClick={() => {
                  setQuickPayment({
                    status: enrollment.payment.status,
                    paidAmount: enrollment.payment.paidAmount,
                    receiptNumber: enrollment.payment.receiptNumber || ''
                  });
                  setShowPaymentDialog(true);
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                อัพเดทการชำระ
              </Button>
            )}
          </PermissionGuard>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {enrollment.payment.status === 'paid' && (
                <DropdownMenuItem onClick={handlePrintReceipt}>
                  <Printer className="h-4 w-4 mr-2" />
                  พิมพ์ใบเสร็จ
                </DropdownMenuItem>
              )}
              
              {isActive && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href={`/enrollments/${enrollmentId}/edit`}>
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      แก้ไขข้อมูล
                    </DropdownMenuItem>
                  </Link>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        className="text-orange-600"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        ยกเลิกการลงทะเบียน
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการยกเลิก</AlertDialogTitle>
                        <AlertDialogDescription>
                          คุณแน่ใจหรือไม่ที่จะยกเลิกการลงทะเบียนของ {student.nickname} ({student.name})?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="my-4">
                        <label className="text-sm font-medium">เหตุผลในการยกเลิก</label>
                        <Textarea
                          placeholder="กรุณาระบุเหตุผล..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleCancelEnrollment}
                          className="bg-red-500 hover:bg-red-600"
                          disabled={cancelling || !cancelReason.trim()}
                        >
                          {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </PermissionGuard>
              )}
              
              {/* Delete Option - Super Admin Only */}
              <PermissionGuard requiredRole={['super_admin']}>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      ลบการลงทะเบียน
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                      <AlertDialogDescription>
                        คุณแน่ใจหรือไม่ที่จะลบการลงทะเบียนของ {student.nickname} ({student.name})?
                        การกระทำนี้ไม่สามารถย้อนกลับได้
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteEnrollment}
                        className="bg-red-500 hover:bg-red-600"
                        disabled={deleting}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            กำลังลบ...
                          </>
                        ) : (
                          'ลบการลงทะเบียน'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGuard>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">รายละเอียดการลงทะเบียน</h1>
            <p className="text-gray-600 mt-2">วันที่ลงทะเบียน: {formatDate(enrollment.enrolledAt, 'long')}</p>
          </div>
          <Badge className={statusColors[enrollment.status]}>
            {statusLabels[enrollment.status]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                ข้อมูลนักเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อ-นามสกุล</p>
                  <p className="font-medium">{student.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ชื่อเล่น</p>
                  <p className="font-medium">{student.nickname}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">อายุ</p>
                  <p className="font-medium">{calculateAge(student.birthdate)} ปี</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">เพศ</p>
                  <p className="font-medium">{student.gender === 'M' ? 'ชาย' : 'หญิง'}</p>
                </div>
                {student.schoolName && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">โรงเรียน</p>
                      <p className="font-medium">{student.schoolName}</p>
                    </div>
                    {student.gradeLevel && (
                      <div>
                        <p className="text-sm text-gray-500">ระดับชั้น</p>
                        <p className="font-medium">{student.gradeLevel}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {(student.allergies || student.specialNeeds) && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {student.allergies && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-600">ประวัติการแพ้</p>
                        <p className="text-sm">{student.allergies}</p>
                      </div>
                    </div>
                  )}
                  {student.specialNeeds && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-600">ความต้องการพิเศษ</p>
                        <p className="text-sm">{student.specialNeeds}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parent Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ข้อมูลผู้ปกครอง
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อผู้ปกครอง</p>
                  <p className="font-medium">{parent.displayName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">เบอร์โทรหลัก</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">{parent.phone}</p>
                  </div>
                </div>
                {parent.emergencyPhone && (
                  <div>
                    <p className="text-sm text-gray-500">เบอร์โทรฉุกเฉิน</p>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-red-400" />
                      <p className="font-medium">{parent.emergencyPhone}</p>
                    </div>
                  </div>
                )}
                {parent.email && (
                  <div>
                    <p className="text-sm text-gray-500">อีเมล</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p className="font-medium">{parent.email}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {parent.lineUserId && (
                <div className="mt-4 pt-4 border-t">
                  <Badge className="bg-green-100 text-green-700">
                    <img src="/line-icon.svg" alt="LINE" className="w-4 h-4 mr-1" />
                    เชื่อมต่อ LINE แล้ว
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                ข้อมูลคลาสเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อคลาส</p>
                  <p className="font-medium text-lg">{classData.name}</p>
                  <p className="text-sm text-gray-500">รหัส: {classData.code}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">วิชา</p>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: subject?.color }}
                      />
                      <p className="font-medium">{subject?.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ระดับ</p>
                    <p className="font-medium">{subject?.level}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ครูผู้สอน</p>
                    <p className="font-medium">{teacher?.nickname || teacher?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">สาขา</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="font-medium">{branch?.name}</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">ตารางเรียน</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{classData.daysOfWeek.map(d => getDayName(d)).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{classData.startTime} - {classData.endTime} น.</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(classData.startDate)} ถึง {formatDate(classData.endDate)}
                      <span className="ml-2">({classData.totalSessions} ครั้ง)</span>
                    </div>
                  </div>
                </div>

                {/* Makeup Classes Summary */}
                {makeupClasses.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500 mb-2">ประวัติ Makeup Class</p>
                    <div className="text-sm">
                      <p>จำนวน Makeup ทั้งหมด: {makeupClasses.length} ครั้ง</p>
                      <p>เสร็จสิ้นแล้ว: {makeupClasses.filter(m => m.status === 'completed').length} ครั้ง</p>
                      <p>รอนัดเรียน: {makeupClasses.filter(m => m.status === 'pending').length} ครั้ง</p>
                      <p>นัดแล้ว: {makeupClasses.filter(m => m.status === 'scheduled').length} ครั้ง</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                ข้อมูลการชำระเงิน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">สถานะ</span>
                  <Badge className={paymentStatusColors[enrollment.payment.status]}>
                    {paymentStatusLabels[enrollment.payment.status]}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">ค่าเรียนปกติ</span>
                    <span>{formatCurrency(enrollment.pricing.originalPrice)}</span>
                  </div>
                  
                  {enrollment.pricing.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-sm">
                        ส่วนลด 
                        {enrollment.pricing.discountType === 'percentage' 
                          ? ` (${enrollment.pricing.discount}%)`
                          : ''
                        }
                      </span>
                      <span>-{formatCurrency(
                        enrollment.pricing.discountType === 'percentage'
                          ? enrollment.pricing.originalPrice * (enrollment.pricing.discount / 100)
                          : enrollment.pricing.discount
                      )}</span>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t flex justify-between font-semibold">
                    <span>ยอดที่ต้องชำระ</span>
                    <span className="text-lg">{formatCurrency(enrollment.pricing.finalPrice)}</span>
                  </div>
                  
                  {enrollment.payment.paidAmount > 0 && (
                    <>
                      <div className="pt-2 border-t flex justify-between">
                        <span className="text-sm text-gray-500">ชำระแล้ว</span>
                        <span className="text-green-600">
                          {formatCurrency(enrollment.payment.paidAmount)}
                        </span>
                      </div>
                      
                      {enrollment.payment.paidAmount < enrollment.pricing.finalPrice && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">คงเหลือ</span>
                          <span className="text-red-600">
                            {formatCurrency(enrollment.pricing.finalPrice - enrollment.payment.paidAmount)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="pt-4 border-t space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">วิธีการชำระเงิน</p>
                    <p className="font-medium">
                      {paymentMethodLabels[enrollment.payment.method]}
                    </p>
                  </div>
                  
                  {enrollment.payment.paidDate && (
                    <div>
                      <p className="text-sm text-gray-500">วันที่ชำระ</p>
                      <p className="font-medium">
                        {formatDate(enrollment.payment.paidDate, 'long')}
                      </p>
                    </div>
                  )}
                  
                  {enrollment.payment.receiptNumber && (
                    <div>
                      <p className="text-sm text-gray-500">เลขที่ใบเสร็จ</p>
                      <p className="font-medium">{enrollment.payment.receiptNumber}</p>
                    </div>
                  )}
                  
                  {enrollment.pricing.promotionCode && (
                    <div>
                      <p className="text-sm text-gray-500">รหัสโปรโมชั่น</p>
                      <p className="font-medium">{enrollment.pricing.promotionCode}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Information */}
          {enrollment.status === 'dropped' && enrollment.droppedReason && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">ข้อมูลการยกเลิก</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{enrollment.droppedReason}</p>
              </CardContent>
            </Card>
          )}
          
          {enrollment.status === 'transferred' && enrollment.transferHistory && enrollment.transferHistory.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-600 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  ประวัติการย้ายคลาส
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {enrollment.transferHistory.map((transfer, index) => (
                    <div key={index} className="text-sm space-y-1">
                      <p className="font-medium">ครั้งที่ {index + 1}</p>
                      <p>วันที่: {formatDate(transfer.transferredAt, 'long')}</p>
                      <p>เหตุผล: {transfer.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Payment Update Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อัพเดทการชำระเงิน</DialogTitle>
            <DialogDescription>
              อัพเดทสถานะการชำระเงินสำหรับ {student?.nickname} ({student?.name})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>สถานะการชำระ</Label>
              <Select 
                value={quickPayment.status}
                onValueChange={(value: 'pending' | 'partial' | 'paid') => 
                  setQuickPayment(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอชำระ</SelectItem>
                  <SelectItem value="partial">ชำระบางส่วน</SelectItem>
                  <SelectItem value="paid">ชำระแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>ยอดที่ชำระแล้ว</Label>
              <Input
                type="number"
                value={quickPayment.paidAmount || ''}
                onChange={(e) => setQuickPayment(prev => ({ 
                  ...prev, 
                  paidAmount: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                ยอดที่ต้องชำระทั้งหมด: {formatCurrency(enrollment?.pricing.finalPrice || 0)}
              </p>
            </div>
            
            <div>
              <Label>เลขที่ใบเสร็จ (ถ้ามี)</Label>
              <Input
                value={quickPayment.receiptNumber}
                onChange={(e) => setQuickPayment(prev => ({ 
                  ...prev, 
                  receiptNumber: e.target.value 
                }))}
                placeholder="RC2025-001"
              />
            </div>
            
            {/* Show summary */}
            {quickPayment.paidAmount > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>ยอดที่ต้องชำระ:</span>
                    <span>{formatCurrency(enrollment?.pricing.finalPrice || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ชำระแล้ว:</span>
                    <span className="text-green-600">{formatCurrency(quickPayment.paidAmount)}</span>
                  </div>
                  {quickPayment.paidAmount < (enrollment?.pricing.finalPrice || 0) && (
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>คงเหลือ:</span>
                      <span className="text-red-600">
                        {formatCurrency((enrollment?.pricing.finalPrice || 0) - quickPayment.paidAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleQuickPaymentUpdate}
              disabled={paymentUpdating || quickPayment.paidAmount < 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {paymentUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  บันทึก
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
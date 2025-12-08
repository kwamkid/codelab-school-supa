'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MakeupClass, Class } from '@/types/models';
import { getMakeupClass, recordMakeupAttendance, cancelMakeupClass, deleteMakeupClass, revertMakeupToScheduled } from '@/lib/services/makeup';
import { getClass } from '@/lib/services/classes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSearchParams } from 'next/navigation';
import { 
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  Trash2,
  ChevronLeft,
  History
} from 'lucide-react';
import { formatDate, formatDateWithDay } from '@/lib/utils';
import { toast } from 'sonner';
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
import Link from 'next/link';
import EditMakeupScheduleDialog from '@/components/makeup/edit-makeup-schedule-dialog';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';

const statusColors = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'scheduled': 'bg-blue-100 text-blue-700',
  'completed': 'bg-green-100 text-green-700',
  'cancelled': 'bg-red-100 text-red-700',
};

const statusLabels = {
  'pending': 'รอจัดตาราง',
  'scheduled': 'นัดแล้ว',
  'completed': 'เรียนแล้ว',
  'cancelled': 'ยกเลิก',
};

const statusIcons = {
  'pending': AlertCircle,
  'scheduled': CalendarCheck,
  'completed': CheckCircle,
  'cancelled': XCircle,
};

export default function MakeupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const makeupId = params.id as string;
  const searchParams = useSearchParams();
  const { selectedBranchId, isAllBranches } = useBranch();
  const { adminUser, canAccessBranch } = useAuth();

  
  const [makeup, setMakeup] = useState<MakeupClass | null>(null);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Form states
  const [attendanceNote, setAttendanceNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [revertReason, setRevertReason] = useState('');
  const [showEditSchedule, setShowEditSchedule] = useState(false);

  useEffect(() => {
    if (makeupId) {
      loadMakeupDetails();
    }
  }, [makeupId]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'reschedule' && makeup?.status === 'scheduled') {
      setShowEditSchedule(true);
    }
  }, [searchParams, makeup]);

  const loadMakeupDetails = async () => {
    try {
      const makeupData = await getMakeupClass(makeupId);
      if (!makeupData) {
        toast.error('ไม่พบข้อมูล Makeup Class');
        router.push('/makeup');
        return;
      }
      
      // Check branch access
      if (!isAllBranches && selectedBranchId && makeupData.branchId !== selectedBranchId) {
        toast.error('คุณไม่มีสิทธิ์ดูข้อมูล Makeup Class ในสาขานี้');
        router.push('/makeup');
        return;
      }
      
      if (adminUser?.role === 'branch_admin' && !canAccessBranch(makeupData.branchId)) {
        toast.error('คุณไม่มีสิทธิ์ดูข้อมูล Makeup Class ในสาขานี้');
        router.push('/makeup');
        return;
      }
      
      setMakeup(makeupData);
      
      // Load class info (for teacher info if needed)
      const classData = await getClass(makeupData.originalClassId);
      setClassInfo(classData);
    } catch (error) {
      console.error('Error loading makeup details:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAttendance = async (status: 'present' | 'absent') => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    
    setActionLoading(true);
    try {
      await recordMakeupAttendance(makeupId, {
        status,
        checkedBy: currentUser.uid,
        note: attendanceNote
      });
      
      toast.success(status === 'present' ? 'บันทึกการเข้าเรียนเรียบร้อยแล้ว' : 'บันทึกการขาดเรียนเรียบร้อยแล้ว');
      loadMakeupDetails();
    } catch (error) {
      console.error('Error recording attendance:', error);
      toast.error('ไม่สามารถบันทึกการเข้าเรียนได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    
    setActionLoading(true);
    try {
      await cancelMakeupClass(makeupId, cancelReason, currentUser.uid);
      toast.success('ยกเลิก Makeup Class เรียบร้อยแล้ว');
      loadMakeupDetails();
    } catch (error) {
      console.error('Error cancelling makeup:', error);
      toast.error('ไม่สามารถยกเลิกได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการลบ');
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    
    setActionLoading(true);
    try {
      await deleteMakeupClass(makeupId, currentUser.uid, deleteReason);
      toast.success('ลบ Makeup Class เรียบร้อยแล้ว');
      router.push('/makeup');
    } catch (error: any) {
      console.error('Error deleting makeup:', error);
      if (error.message === 'Cannot delete completed makeup class') {
        toast.error('ไม่สามารถลบ Makeup ที่เรียนเสร็จแล้วได้');
      } else {
        toast.error('ไม่สามารถลบได้');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertAttendance = async () => {
    if (!revertReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการยกเลิกการบันทึก');
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    
    setActionLoading(true);
    try {
      const userName = currentUser.displayName || currentUser.email || currentUser.uid;
      await revertMakeupToScheduled(makeupId, userName, revertReason);
      toast.success('ยกเลิกการบันทึกเข้าเรียนเรียบร้อยแล้ว');
      loadMakeupDetails();
    } catch (error) {
      console.error('Error reverting attendance:', error);
      toast.error('ไม่สามารถยกเลิกการบันทึกได้');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !makeup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const StatusIcon = statusIcons[makeup.status];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <Link 
          href="/makeup" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับ
        </Link>
        
        <Badge className={statusColors[makeup.status]}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusLabels[makeup.status]}
        </Badge>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Makeup Class - {makeup.studentNickname}
          {!isAllBranches && <span className="text-red-600 text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Class & Schedule Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">ข้อมูลการขาดเรียน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Class Info Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">คลาส</p>
                  <p className="font-medium">{makeup.className}</p>
                  <p className="text-sm text-gray-500">{makeup.classCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">วันที่ขาด</p>
                  {makeup.originalSessionNumber && makeup.originalSessionDate ? (
                    <>
                      <p className="font-medium text-red-600">
                        ครั้งที่ {makeup.originalSessionNumber} - {formatDateWithDay(makeup.originalSessionDate)}
                      </p>
                      {classInfo && (
                        <p className="text-sm text-gray-500">
                          เวลา {classInfo.startTime} - {classInfo.endTime} น.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-sm text-gray-500 mb-1">เหตุผล</p>
                <p className="font-medium">{makeup.reason}</p>
              </div>

              {/* Request Date */}
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">
                  ขอ Makeup เมื่อ {formatDate(makeup.requestDate, 'long')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Makeup Schedule */}
          {makeup.makeupSchedule && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>ตารางเรียนชดเชย</span>
                  {makeup.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowEditSchedule(true)}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      เปลี่ยนวันนัด
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">วันที่นัด</p>
                    <p className="font-medium text-blue-600">
                      {formatDateWithDay(makeup.makeupSchedule.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">เวลา</p>
                    <p className="font-medium">{makeup.makeupSchedule.startTime} - {makeup.makeupSchedule.endTime} น.</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">ครูผู้สอน</p>
                    <p className="font-medium">{makeup.makeupSchedule.teacherName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">ห้องเรียน</p>
                    <p className="font-medium">{makeup.makeupSchedule.roomName || makeup.makeupSchedule.roomId}</p>
                  </div>
                </div>
                
                {/* Notes */}
                {makeup.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-500 mb-1">หมายเหตุ</p>
                    <p className="text-sm whitespace-pre-wrap">{makeup.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attendance Result */}
          {makeup.attendance && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    ผลการเข้าเรียน
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        ยกเลิกการบันทึก
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ยกเลิกการบันทึกเข้าเรียน</AlertDialogTitle>
                        <AlertDialogDescription>
                          คุณแน่ใจหรือไม่ที่จะยกเลิกการบันทึกเข้าเรียน? 
                          สถานะจะเปลี่ยนกลับเป็น "นัดแล้ว"
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="my-4">
                        <Label htmlFor="revert-reason">เหตุผล *</Label>
                        <Textarea
                          id="revert-reason"
                          value={revertReason}
                          onChange={(e) => setRevertReason(e.target.value)}
                          placeholder="เช่น บันทึกผิด, นักเรียนยังไม่ได้มาเรียน..."
                          rows={3}
                          className="mt-2"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRevertAttendance}
                          disabled={!revertReason.trim()}
                          className="bg-orange-500 hover:bg-orange-600"
                        >
                          ยืนยันยกเลิกการบันทึก
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`rounded-lg p-4 ${
                  makeup.attendance.status === 'present' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {makeup.attendance.status === 'present' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium text-lg">
                      {makeup.attendance.status === 'present' ? 'เข้าเรียน' : 'ขาดเรียน'}
                    </span>
                  </div>
                  {makeup.attendance.note && (
                    <p className="text-sm text-gray-700 mb-2">{makeup.attendance.note}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    บันทึกเมื่อ {formatDate(makeup.attendance.checkedAt, 'long')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-4">
          {/* Student Info - ✨ ใช้ denormalized data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                ข้อมูลนักเรียน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500">ชื่อ-นามสกุล</p>
                <p className="font-medium">{makeup.studentName}</p>
                <p className="text-gray-500">({makeup.studentNickname})</p>
              </div>
              <div className="pt-2">
                <p className="text-gray-500">ผู้ปกครอง</p>
                <p className="font-medium">{makeup.parentName}</p>
              </div>
              <div>
                <p className="text-gray-500">เบอร์โทร</p>
                <p className="font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {makeup.parentPhone}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions for scheduled status */}
          {makeup.status === 'scheduled' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">บันทึกการเข้าเรียน</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="attendance-note">หมายเหตุ (ถ้ามี)</Label>
                  <Textarea
                    id="attendance-note"
                    value={attendanceNote}
                    onChange={(e) => setAttendanceNote(e.target.value)}
                    placeholder="เช่น มาสาย 10 นาที"
                    rows={2}
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={actionLoading}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        เข้าเรียน
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการบันทึกเข้าเรียน</AlertDialogTitle>
                        <AlertDialogDescription>
                          คุณแน่ใจหรือไม่ว่า <strong>{makeup.studentNickname}</strong> มาเรียน Makeup Class แล้ว?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRecordAttendance('present')}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          ยืนยันเข้าเรียน
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={actionLoading}
                        variant="destructive"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        ขาดเรียน
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการบันทึกขาดเรียน</AlertDialogTitle>
                        <AlertDialogDescription>
                          คุณแน่ใจหรือไม่ว่า <strong>{makeup.studentNickname}</strong> ไม่ได้มาเรียน Makeup Class?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRecordAttendance('absent')}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          ยืนยันขาดเรียน
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delete and Cancel Actions */}
          {(makeup.status === 'pending' || makeup.status === 'scheduled') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">การจัดการ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full text-red-600 hover:text-red-700"
                      disabled={actionLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      ลบ Makeup Class
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการลบ Makeup Class</AlertDialogTitle>
                      <AlertDialogDescription>
                        คุณแน่ใจหรือไม่ที่จะลบ Makeup Class นี้? 
                        การลบจะทำให้นักเรียนสามารถขอ Makeup ใหม่สำหรับวันนี้ได้
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="delete-reason">เหตุผลในการลบ *</Label>
                      <Textarea
                        id="delete-reason"
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="เช่น กรอกผิด, ผู้ปกครองขอยกเลิก..."
                        rows={3}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ไม่ลบ</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={!deleteReason.trim()}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        ยืนยันลบ
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Cancel button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      ยกเลิก Makeup Class
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการยกเลิก</AlertDialogTitle>
                      <AlertDialogDescription>
                        คุณแน่ใจหรือไม่ที่จะยกเลิก Makeup Class นี้?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="cancel-reason">เหตุผลในการยกเลิก *</Label>
                      <Textarea
                        id="cancel-reason"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="กรุณาระบุเหตุผล..."
                        rows={3}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        disabled={!cancelReason.trim()}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        ยืนยันยกเลิก
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Schedule Dialog */}
      {showEditSchedule && makeup && classInfo && (
        <EditMakeupScheduleDialog
          open={showEditSchedule}
          onOpenChange={setShowEditSchedule}
          makeup={makeup}
          student={{
            id: makeup.studentId,
            name: makeup.studentName,
            nickname: makeup.studentNickname,
            parentName: makeup.parentName,
            parentPhone: makeup.parentPhone,
          } as any}
          classInfo={classInfo}
          onUpdated={() => {
            setShowEditSchedule(false);
            loadMakeupDetails();
          }}
        />
      )}
    </div>
  );
}
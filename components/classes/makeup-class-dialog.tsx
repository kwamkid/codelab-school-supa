'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Info, Save, X, CheckCircle } from 'lucide-react';
import { Student } from '@/types/models';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMakeupRequest, getMakeupCount, checkMakeupExists } from '@/lib/services/makeup';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface MakeupClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student & { parentName: string; parentPhone: string };
  classInfo: {
    id: string;
    name: string;
    teacherId: string;
    branchId: string;
    roomId: string;
  };
  scheduleId: string;
  sessionDate: Date;
  sessionNumber: number;
  onMakeupCreated: () => void;
}

export default function MakeupClassDialog({
  open,
  onOpenChange,
  student,
  classInfo,
  scheduleId,
  sessionDate,
  sessionNumber,
  onMakeupCreated
}: MakeupClassDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingCount, setCheckingCount] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [makeupCount, setMakeupCount] = useState(0);
  const [existingMakeup, setExistingMakeup] = useState<any>(null);
  const [formData, setFormData] = useState({
    type: 'ad-hoc' as 'scheduled' | 'ad-hoc',
    reason: ''
  });

  useEffect(() => {
    if (open) {
      checkMakeupCount();
      checkExistingMakeup();
    }
  }, [open, student.id, classInfo.id, scheduleId]);

  const checkMakeupCount = async () => {
    setCheckingCount(true);
    try {
      const count = await getMakeupCount(student.id, classInfo.id);
      setMakeupCount(count);
    } catch (error) {
      console.error('Error checking makeup count:', error);
    } finally {
      setCheckingCount(false);
    }
  };

  const checkExistingMakeup = async () => {
    setCheckingExisting(true);
    try {
      const existing = await checkMakeupExists(student.id, classInfo.id, scheduleId);
      setExistingMakeup(existing);
    } catch (error) {
      console.error('Error checking existing makeup:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.reason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่ขาดเรียน');
      return;
    }

    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }

    setLoading(true);
    try {
      await createMakeupRequest({
        type: formData.type,
        originalClassId: classInfo.id,
        originalScheduleId: scheduleId,
        studentId: student.id,
        parentId: student.parentId,
        requestDate: new Date(),
        requestedBy: user.uid,
        reason: formData.reason,
        status: 'pending'
      });

      toast.success('บันทึกการขอ Makeup Class เรียบร้อยแล้ว');
      onMakeupCreated();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        type: 'ad-hoc',
        reason: ''
      });
    } catch (error: any) {
      console.error('Error creating makeup request:', error);
      if (error.message === 'Makeup request already exists for this schedule') {
        toast.error('มีการขอ Makeup สำหรับวันนี้แล้ว');
      } else {
        toast.error('ไม่สามารถบันทึกข้อมูลได้');
      }
    } finally {
      setLoading(false);
    }
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

    return (
      <Badge className={statusColors[makeup.status as keyof typeof statusColors]}>
        {statusLabels[makeup.status as keyof typeof statusLabels]}
      </Badge>
    );
  };

  // ถ้ามี makeup อยู่แล้ว ให้แสดงข้อมูลแทนฟอร์ม
  if (!checkingExisting && existingMakeup) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ข้อมูล Makeup Class</DialogTitle>
            <DialogDescription>
              มีการขอ Makeup Class สำหรับวันนี้แล้ว
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Student Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">ข้อมูลการขาดเรียน</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>นักเรียน: {student.name} ({student.nickname})</p>
                <p>คลาส: {classInfo.name}</p>
                <p>ครั้งที่: {sessionNumber} - {formatDate(sessionDate, 'long')}</p>
              </div>
            </div>

            {/* Existing Makeup Info */}
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-900">สถานะ Makeup</p>
                {getMakeupStatusBadge(existingMakeup)}
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <p>วันที่ขอ: {formatDate(existingMakeup.requestDate, 'long')}</p>
                <p>เหตุผล: {existingMakeup.reason}</p>
                {existingMakeup.makeupSchedule && (
                  <>
                    <p className="pt-2 font-medium">ตารางเรียนชดเชย:</p>
                    <p>วันที่: {formatDate(existingMakeup.makeupSchedule.date, 'long')}</p>
                    <p>เวลา: {existingMakeup.makeupSchedule.startTime} - {existingMakeup.makeupSchedule.endTime} น.</p>
                  </>
                )}
              </div>
            </div>

            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                มีการบันทึกการขอ Makeup Class สำหรับวันนี้เรียบร้อยแล้ว
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => onOpenChange(false)}>
              ปิด
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ขอเรียนชดเชย (Makeup Class)</DialogTitle>
          <DialogDescription>
            บันทึกการขอเรียนชดเชยสำหรับ {student.nickname}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">ข้อมูลการขาดเรียน</p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>นักเรียน: {student.name} ({student.nickname})</p>
              <p>คลาส: {classInfo.name}</p>
              <p>ครั้งที่: {sessionNumber} - {formatDate(sessionDate, 'long')}</p>
              <p>ผู้ปกครอง: {student.parentName} ({student.parentPhone})</p>
            </div>
          </div>

          {/* Makeup Count Alert */}
          {!checkingCount && (
            <Alert className={makeupCount >= 4 ? 'border-red-200' : 'border-blue-200'}>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {makeupCount >= 4 ? (
                  <>
                    <strong>หมายเหตุ:</strong> นักเรียนได้ใช้สิทธิ์ Makeup ครบ 4 ครั้งแล้ว 
                    แต่ Admin สามารถอนุมัติเพิ่มได้ตามดุลยพินิจ
                  </>
                ) : (
                  <>
                    นักเรียนใช้สิทธิ์ Makeup ไปแล้ว <strong>{makeupCount}</strong> ครั้ง 
                    (เหลืออีก {4 - makeupCount} ครั้ง)
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Request Type */}
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
                <SelectItem value="ad-hoc">ขอหลังขาดเรียน (Ad-hoc)</SelectItem>
                <SelectItem value="scheduled">ขอล่วงหน้า (Scheduled)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {formData.type === 'ad-hoc' 
                ? 'สำหรับกรณีขาดเรียนแบบกะทันหัน ไม่ได้แจ้งล่วงหน้า'
                : 'สำหรับกรณีที่รู้ล่วงหน้าว่าจะขาดเรียน'}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">เหตุผลที่ขาดเรียน *</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="เช่น ป่วย, ติดธุระสำคัญ, เดินทางต่างจังหวัด"
              rows={3}
              required
            />
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">ขั้นตอนถัดไป:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Admin จะจัดตารางเรียนชดเชยให้</li>
                  <li>ผู้ปกครองจะได้รับการแจ้งเตือนผ่าน LINE</li>
                  <li>นักเรียนต้องเข้าเรียนตามวันเวลาที่นัดหมาย</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            ยกเลิก
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || checkingExisting || !formData.reason.trim()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? (
              <>กำลังบันทึก...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                บันทึกการขอ
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
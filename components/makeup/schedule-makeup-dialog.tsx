'use client';

import { useState, useEffect } from 'react';
import { Loader2, CalendarCheck, User, BookOpen, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MakeupClass } from '@/types/models';
import { scheduleMakeupClass } from '@/lib/services/makeup';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import MakeupScheduleFields, { ScheduleFormData } from './makeup-schedule-fields';

interface ScheduleMakeupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  makeupRequest: MakeupClass;
  onSuccess?: () => void;
}

export default function ScheduleMakeupDialog({
  open,
  onOpenChange,
  makeupRequest,
  onSuccess,
}: ScheduleMakeupDialogProps) {
  const { user, canAccessBranch } = useAuth();
  const [loading, setLoading] = useState(false);

  const [scheduleData, setScheduleData] = useState<ScheduleFormData>({
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    teacherId: '',
    roomId: '',
  });

  // Pre-fill from existing schedule if rescheduling
  useEffect(() => {
    if (!open) return;

    if (!canAccessBranch(makeupRequest.branchId)) {
      toast.error('คุณไม่มีสิทธิ์จัดตาราง Makeup ในสาขานี้');
      onOpenChange(false);
      return;
    }

    if (makeupRequest.makeupSchedule) {
      const s = makeupRequest.makeupSchedule;
      setScheduleData({
        date: s.date ? new Date(s.date).toISOString().split('T')[0] : '',
        startTime: s.startTime?.substring(0, 5) || '10:00',
        endTime: s.endTime?.substring(0, 5) || '11:00',
        teacherId: s.teacherId || '',
        roomId: s.roomId || '',
      });
    } else {
      setScheduleData({
        date: '',
        startTime: '10:00',
        endTime: '11:00',
        teacherId: '',
        roomId: '',
      });
    }
  }, [open, makeupRequest, canAccessBranch, onOpenChange]);

  const handleSubmit = async () => {
    if (!scheduleData.date || !scheduleData.startTime || !scheduleData.endTime ||
        !scheduleData.teacherId || !scheduleData.roomId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      await scheduleMakeupClass(makeupRequest.id, {
        date: new Date(scheduleData.date),
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        teacherId: scheduleData.teacherId,
        branchId: makeupRequest.branchId,
        roomId: scheduleData.roomId,
        confirmedBy: user?.uid || 'admin',
      });

      toast.success('จัดตาราง Makeup Class เรียบร้อยแล้ว');
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error scheduling makeup:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการจัดตาราง');
    } finally {
      setLoading(false);
    }
  };

  const isRescheduling = makeupRequest.status === 'scheduled';

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setScheduleData({
          date: '', startTime: '10:00', endTime: '11:00',
          teacherId: '', roomId: '',
        });
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            {isRescheduling ? 'เปลี่ยนวันนัด Makeup' : 'นัด Makeup Class'}
          </DialogTitle>
          <DialogDescription>
            {isRescheduling ? 'แก้ไขวันเวลานัดเรียนชดเชย' : 'กำหนดวันเวลาเรียนชดเชย'}
          </DialogDescription>
        </DialogHeader>

        {/* Student & Class Info — compact */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="font-medium truncate">
              {makeupRequest.studentNickname
                ? `${makeupRequest.studentNickname} (${makeupRequest.studentName.split(' ')[0]})`
                : makeupRequest.studentName}
            </span>
            <Badge variant="outline" className="text-red-600 border-red-200 ml-auto shrink-0 text-xs">
              {makeupRequest.branchName}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{makeupRequest.className}</span>
            <span className="text-gray-400 shrink-0">{makeupRequest.subjectName}</span>
            {makeupRequest.originalSessionNumber && (
              <span className="text-gray-500 shrink-0">
                ครั้งที่ {makeupRequest.originalSessionNumber}
                {makeupRequest.originalSessionDate && ` (${formatDate(makeupRequest.originalSessionDate)})`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <MessageSquare className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{makeupRequest.reason}</span>
          </div>
        </div>

        {/* Schedule Fields — shared component */}
        <MakeupScheduleFields
          branchId={makeupRequest.branchId}
          value={scheduleData}
          onChange={setScheduleData}
          excludeMakeupId={makeupRequest.id}
          popoverDirection="up"
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !scheduleData.date ||
              !scheduleData.startTime ||
              !scheduleData.endTime ||
              !scheduleData.teacherId ||
              !scheduleData.roomId
            }
            className="bg-red-500 hover:bg-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : isRescheduling ? (
              'บันทึกการเปลี่ยนแปลง'
            ) : (
              'จัดตาราง'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

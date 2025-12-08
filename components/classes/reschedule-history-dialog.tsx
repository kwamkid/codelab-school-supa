'use client';

import { useEffect, useState } from 'react';
import { ClassSchedule } from '@/types/models';
import { getRescheduleHistory } from '@/lib/services/reschedule';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from '@/lib/utils';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RescheduleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
}

export default function RescheduleHistoryDialog({
  open,
  onOpenChange,
  classId,
  className
}: RescheduleHistoryDialogProps) {
  const [history, setHistory] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && classId) {
      loadHistory();
    }
  }, [open, classId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getRescheduleHistory(classId);
      setHistory(data.sort((a, b) => 
        new Date(b.rescheduledAt || 0).getTime() - new Date(a.rescheduledAt || 0).getTime()
      ));
    } catch (error) {
      console.error('Error loading reschedule history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>ประวัติการเลื่อนตารางเรียน</DialogTitle>
          <DialogDescription>
            {className}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">กำลังโหลด...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">ไม่มีประวัติการเลื่อนตารางเรียน</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((schedule) => (
                <div key={schedule.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">ครั้งที่ {schedule.sessionNumber}</Badge>
                      <Badge className="bg-orange-100 text-orange-700">เลื่อนแล้ว</Badge>
                    </div>
                    {schedule.rescheduledAt && (
                      <p className="text-xs text-gray-500">
                        เลื่อนเมื่อ {formatDate(schedule.rescheduledAt, 'long')}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{formatDate(schedule.originalDate!, 'long')}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{formatDate(schedule.sessionDate, 'long')}</span>
                    </div>
                  </div>
                  
                  {schedule.note && (
                    <p className="text-sm text-gray-600 italic">
                      หมายเหตุ: {schedule.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
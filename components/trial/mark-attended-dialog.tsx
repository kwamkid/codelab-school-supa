'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { TrialBooking, TrialSession } from '@/types/models';
import { getTrialSessionsByBooking, updateTrialSession } from '@/lib/services/trial-bookings';
import { toast } from 'sonner';

interface MarkAttendedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: TrialBooking | null;
  subjectsMap: Map<string, { id: string; name: string; color: string }>;
  onSuccess: () => void;
}

export function MarkAttendedDialog({
  isOpen,
  onClose,
  booking,
  subjectsMap,
  onSuccess,
}: MarkAttendedDialogProps) {
  const [sessions, setSessions] = useState<TrialSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // Fetch scheduled sessions when dialog opens
  useEffect(() => {
    if (!isOpen || !booking) {
      setSessions([]);
      setSelectedSessionIds(new Set());
      return;
    }

    async function fetchSessions() {
      setLoading(true);
      try {
        const allSessions = await getTrialSessionsByBooking(booking!.id);
        const scheduled = allSessions.filter(s => s.status === 'scheduled');
        setSessions(scheduled);
        // Pre-select all
        setSelectedSessionIds(new Set(scheduled.map(s => s.id)));
      } catch (error) {
        console.error('Error fetching sessions:', error);
        toast.error('ไม่สามารถโหลดข้อมูลการนัดหมายได้');
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [isOpen, booking]);

  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedSessionIds.size === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    try {
      // Mark selected sessions as attended
      await Promise.all(
        Array.from(selectedSessionIds).map(sessionId =>
          updateTrialSession(sessionId, { status: 'attended', attended: true })
        )
      );

      toast.success(`บันทึกเข้าเรียนแล้ว ${selectedSessionIds.size} รายการ`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            บันทึกเข้าเรียน
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-gray-600">
              {booking?.parentName} — เลือกรายการที่มาเรียนแล้ว
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4" />
              ไม่มีรายการนัดหมายที่รอเรียน
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => {
                const subject = subjectsMap.get(session.subjectId);
                const isSelected = selectedSessionIds.has(session.id);
                return (
                  <label
                    key={session.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSession(session.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{session.studentName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {subject && (
                          <Badge
                            className="text-[11px] h-5 px-1.5"
                            style={{
                              backgroundColor: `${subject.color}20`,
                              color: subject.color,
                              borderColor: subject.color,
                            }}
                          >
                            {subject.name}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(session.scheduledDate)} {session.startTime}-{session.endTime}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>ยกเลิก</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={submitting || selectedSessionIds.size === 0 || loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                ยืนยันเข้าเรียน ({selectedSessionIds.size})
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// components/trial/convert-to-student-dialog.tsx

'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ConvertToStudentForm from '@/components/trial/convert-to-student-form';
import { TrialBooking, TrialSession } from '@/types/models';

interface ConvertToStudentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: TrialBooking;
  session: TrialSession;
  onSuccess: () => void;
}

export default function ConvertToStudentDialog({
  isOpen,
  onClose,
  booking,
  session,
  onSuccess
}: ConvertToStudentDialogProps) {
  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แปลงเป็นนักเรียน</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลเพิ่มเติมเพื่อแปลง {session.studentName} จากผู้ทดลองเรียนเป็นนักเรียนจริง
          </DialogDescription>
        </DialogHeader>
        
        <ConvertToStudentForm
          booking={booking}
          session={session}
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
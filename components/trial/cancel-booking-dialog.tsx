// components/trial/cancel-booking-dialog.tsx

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

interface CancelBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  bookingName?: string;
}

export function CancelBookingDialog({
  isOpen,
  onClose,
  onConfirm,
  bookingName
}: CancelBookingDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfirm(reason.trim());
      // Reset form and close
      setReason('');
      onClose();
    } catch (error: any) {
      setError(error.message || 'เกิดข้อผิดพลาดในการยกเลิกการจอง');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>ยืนยันการยกเลิกการจอง</DialogTitle>
            <DialogDescription>
              {bookingName ? (
                <>คุณต้องการยกเลิกการจองของ <strong>{bookingName}</strong> ใช่หรือไม่?</>
              ) : (
                'คุณต้องการยกเลิกการจองนี้ใช่หรือไม่?'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                การยกเลิกจะทำให้นัดหมายทดลองเรียนทั้งหมดถูกยกเลิกด้วย
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="reason">
                เหตุผลในการยกเลิก <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ผู้ปกครองติดธุระ, เปลี่ยนใจ, ไม่สะดวกเวลา..."
                rows={3}
                disabled={loading}
                className={error ? 'border-red-500' : ''}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || !reason.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                'ยืนยันการยกเลิก'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
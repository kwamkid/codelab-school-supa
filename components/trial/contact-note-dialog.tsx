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
import { Loader2, Phone } from 'lucide-react';
import { TrialBooking } from '@/types/models';
import { updateBookingStatus } from '@/lib/services/trial-bookings';
import { toast } from 'sonner';

interface ContactNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: TrialBooking | null;
  onSuccess: () => void;
}

export function ContactNoteDialog({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: ContactNoteDialogProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!booking) return;

    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'contacted', note.trim() || undefined);
      toast.success('บันทึกการติดต่อเรียบร้อย');
      setNote('');
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error updating booking status:', error);
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNote('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>บันทึกการติดต่อ</DialogTitle>
            <DialogDescription>
              บันทึกผลการติดต่อ{booking?.parentName ? ` ${booking.parentName}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Phone link */}
            {booking?.parentPhone && (
              <a
                href={`tel:${booking.parentPhone}`}
                className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span className="font-medium">{booking.parentPhone}</span>
                <span className="text-sm text-blue-500 ml-auto">โทร</span>
              </a>
            )}

            <div className="space-y-2">
              <Label htmlFor="contact-note">บันทึกการติดต่อ</Label>
              <Textarea
                id="contact-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น โทรแล้ว สนใจเรียนวันเสาร์, Line แล้วรอตอบ..."
                rows={3}
                disabled={loading}
              />
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึกการติดต่อ'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

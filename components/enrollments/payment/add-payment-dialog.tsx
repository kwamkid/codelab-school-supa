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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle } from 'lucide-react';
import { PaymentMethod, BranchPaymentSettings } from '@/types/models';
import { formatCurrency } from '@/lib/utils';
import PaymentMethodSelector from './payment-method-selector';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  remaining: number;
  paymentSettings: BranchPaymentSettings;
  onSubmit: (data: {
    amount: number;
    method: PaymentMethod;
    note?: string;
  }) => Promise<void>;
}

export default function AddPaymentDialog({
  open,
  onOpenChange,
  enrollmentId,
  remaining,
  paymentSettings,
  onSubmit,
}: AddPaymentDialogProps) {
  const enabledMethods = paymentSettings.enabledMethods || ['cash', 'bank_transfer'];
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>(enabledMethods[0] || 'cash');
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        amount: numAmount,
        method,
        note: note.trim() || undefined,
      });
      // Reset form
      setAmount('');
      setNote('');
      setMethod(enabledMethods[0] || 'cash');
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const numAmount = parseFloat(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">รับชำระเพิ่ม</DialogTitle>
          <DialogDescription className="text-base">
            ยอดคงเหลือ: {formatCurrency(remaining)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-base">จำนวนเงิน (บาท)</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="text-base"
              min="0"
              step="0.01"
            />
            {remaining > 0 && (
              <Button
                variant="link"
                size="sm"
                className="text-sm p-0 h-auto mt-1"
                onClick={() => setAmount(remaining.toString())}
              >
                ชำระเต็มจำนวน ({formatCurrency(remaining)})
              </Button>
            )}
          </div>

          <PaymentMethodSelector
            selectedMethod={method}
            onMethodChange={setMethod}
            paymentSettings={paymentSettings}
            colorScheme="green"
            gridCols="grid-cols-3"
          />

          <div>
            <Label className="text-base">หมายเหตุ (ถ้ามี)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม..."
              className="text-base"
              rows={2}
            />
          </div>

          {numAmount > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-1 text-base">
                <div className="flex justify-between">
                  <span>ยอดคงเหลือ:</span>
                  <span>{formatCurrency(remaining)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>ชำระครั้งนี้:</span>
                  <span>+{formatCurrency(numAmount)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>คงเหลือหลังชำระ:</span>
                  <span className={remaining - numAmount <= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(Math.max(0, remaining - numAmount))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-base">
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || numAmount <= 0}
            className="bg-green-600 hover:bg-green-700 text-base"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            บันทึกการชำระ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

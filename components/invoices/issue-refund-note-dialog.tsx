'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createRefundNote } from '@/lib/services/credit-notes';
import { useAuth } from '@/hooks/useAuth';

interface IssueRefundNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  branchId: string;
  receipts: any[]; // list of receipts for this enrollment
  onSuccess: (refundNoteId: string) => void;
}

export default function IssueRefundNoteDialog({
  open,
  onOpenChange,
  enrollmentId,
  branchId,
  receipts,
  onSuccess,
}: IssueRefundNoteDialogProps) {
  const { adminUser } = useAuth();
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [reason, setReason] = useState('ยกเลิกการลงทะเบียนเรียน');
  const [submitting, setSubmitting] = useState(false);

  const selectedReceipt = receipts.find(r => r.id === selectedReceiptId);
  const maxRefundAmount = selectedReceipt?.paid_amount || selectedReceipt?.total_amount || 0;
  const actualRefundAmount = refundType === 'full'
    ? maxRefundAmount
    : Math.min(Number(refundAmount) || 0, maxRefundAmount);

  const handleSubmit = async () => {
    if (!selectedReceipt || actualRefundAmount <= 0 || !reason.trim()) return;

    setSubmitting(true);
    try {
      const docNumber = selectedReceipt.receipt_number || selectedReceipt.invoice_number;

      const refundNoteId = await createRefundNote({
        invoiceCompanyId: selectedReceipt.invoice_company_id,
        receiptId: selectedReceipt.id,
        enrollmentId,
        branchId,
        customerName: selectedReceipt.customer_name,
        customerPhone: selectedReceipt.customer_phone,
        customerEmail: selectedReceipt.customer_email,
        customerAddress: selectedReceipt.customer_address,
        items: [{
          description: `คืนเงิน${refundType === 'partial' ? 'บางส่วน' : ''} - ${docNumber}`,
          amount: actualRefundAmount,
        }],
        refundAmount: actualRefundAmount,
        reason: reason.trim(),
        refundType,
        createdBy: adminUser?.id,
      });

      onSuccess(refundNoteId);
      onOpenChange(false);

      setSelectedReceiptId('');
      setRefundType('full');
      setRefundAmount('');
      setReason('ยกเลิกการลงทะเบียนเรียน');
    } catch (error) {
      console.error('Error creating refund note:', error);
      alert('เกิดข้อผิดพลาดในการออกใบบันทึกคืนเงิน');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ออกใบบันทึกคืนเงิน / Issue Refund Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Select Receipt */}
          <div className="space-y-2">
            <Label>เลือกใบเสร็จรับเงินอ้างอิง</Label>
            <Select value={selectedReceiptId} onValueChange={setSelectedReceiptId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกใบเสร็จ..." />
              </SelectTrigger>
              <SelectContent>
                {receipts.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.receipt_number || r.invoice_number} — {formatCurrency(r.total_amount)} ({formatDate(r.issued_at || r.created_at, 'short')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReceipt && (
            <>
              {/* Refund Type */}
              <div className="space-y-2">
                <Label>ประเภทการคืนเงิน</Label>
                <Select value={refundType} onValueChange={(v) => setRefundType(v as 'full' | 'partial')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">
                      คืนเต็มจำนวน ({formatCurrency(maxRefundAmount)})
                    </SelectItem>
                    <SelectItem value="partial">คืนบางส่วน</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Refund Amount (partial only) */}
              {refundType === 'partial' && (
                <div className="space-y-2">
                  <Label>จำนวนเงินคืน (สูงสุด {formatCurrency(maxRefundAmount)})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={maxRefundAmount}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>เหตุผล</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุเหตุผลการคืนเงิน"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-base">
                <div className="flex justify-between">
                  <span className="text-gray-500">ใบเสร็จอ้างอิง:</span>
                  <span className="font-medium">{selectedReceipt.receipt_number || selectedReceipt.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ยอดคืน:</span>
                  <span className="font-semibold text-red-600">{formatCurrency(actualRefundAmount)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReceipt || actualRefundAmount <= 0 || !reason.trim() || submitting}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {submitting ? 'กำลังออกเอกสาร...' : 'ออกใบบันทึกคืนเงิน'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { createCreditNote } from '@/lib/services/credit-notes';
import { useAuth } from '@/hooks/useAuth';

interface IssueCreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  branchId: string;
  invoices: any[]; // list of invoices for this enrollment
  onSuccess: (creditNoteId: string) => void;
}

export default function IssueCreditNoteDialog({
  open,
  onOpenChange,
  enrollmentId,
  branchId,
  invoices,
  onSuccess,
}: IssueCreditNoteDialogProps) {
  const { adminUser } = useAuth();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [reason, setReason] = useState('ยกเลิกการลงทะเบียนเรียน');
  const [submitting, setSubmitting] = useState(false);

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
  const maxRefundAmount = selectedInvoice?.paid_amount || selectedInvoice?.total_amount || 0;
  const actualRefundAmount = refundType === 'full'
    ? maxRefundAmount
    : Math.min(Number(refundAmount) || 0, maxRefundAmount);

  const handleSubmit = async () => {
    if (!selectedInvoice || actualRefundAmount <= 0 || !reason.trim()) return;

    setSubmitting(true);
    try {
      const invoiceCompanyId = selectedInvoice.invoice_company_id;

      const creditNoteId = await createCreditNote({
        invoiceCompanyId,
        originalInvoiceId: selectedInvoice.id,
        enrollmentId,
        branchId,
        customerName: selectedInvoice.customer_name,
        customerPhone: selectedInvoice.customer_phone,
        customerEmail: selectedInvoice.customer_email,
        billingType: selectedInvoice.billing_type,
        billingName: selectedInvoice.billing_name,
        billingAddress: selectedInvoice.billing_address,
        billingTaxId: selectedInvoice.billing_tax_id,
        billingCompanyBranch: selectedInvoice.billing_company_branch,
        items: [{
          description: `คืนเงิน${refundType === 'partial' ? 'บางส่วน' : ''} - ${selectedInvoice.invoice_number}`,
          amount: actualRefundAmount,
        }],
        refundAmount: actualRefundAmount,
        reason: reason.trim(),
        refundType,
        createdBy: adminUser?.id,
      });

      onSuccess(creditNoteId);
      onOpenChange(false);

      // Reset form
      setSelectedInvoiceId('');
      setRefundType('full');
      setRefundAmount('');
      setReason('ยกเลิกการลงทะเบียนเรียน');
    } catch (error) {
      console.error('Error creating credit note:', error);
      alert('เกิดข้อผิดพลาดในการออกใบลดหนี้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ออกใบลดหนี้ / Issue Credit Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Select Invoice */}
          <div className="space-y-2">
            <Label>เลือกใบเสร็จอ้างอิง</Label>
            <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกใบเสร็จ..." />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((inv: any) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {formatCurrency(inv.total_amount)} ({formatDate(inv.issued_at || inv.created_at, 'short')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedInvoice && (
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
                  <span className="font-medium">{selectedInvoice.invoice_number}</span>
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
            disabled={!selectedInvoice || actualRefundAmount <= 0 || !reason.trim() || submitting}
            loading={submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            ออกใบลดหนี้
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

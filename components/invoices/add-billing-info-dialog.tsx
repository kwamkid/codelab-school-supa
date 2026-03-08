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
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AddBillingInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any; // The tax-invoice-receipt to void+reissue
  onSuccess: (newId: string) => void;
}

export default function AddBillingInfoDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: AddBillingInfoDialogProps) {
  const { adminUser } = useAuth();
  const [billingType, setBillingType] = useState<'personal' | 'company'>('personal');
  const [billingName, setBillingName] = useState(invoice?.customer_name || '');
  const [taxId, setTaxId] = useState('');
  const [companyBranch, setCompanyBranch] = useState('สำนักงานใหญ่');
  const [address, setAddress] = useState({
    houseNumber: '',
    street: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const updateAddress = (field: string, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }));
  };

  const isValid = billingName.trim().length > 0;

  const handleSubmit = async () => {
    if (!invoice || !isValid || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingType,
          billingName,
          billingAddress: address,
          billingTaxId: taxId || undefined,
          billingCompanyBranch: billingType === 'company' ? companyBranch : undefined,
          createdBy: adminUser?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reissue document');
      }

      const { newId } = await res.json();
      toast.success('ออกใบกำกับภาษี/ใบเสร็จใหม่เรียบร้อย');
      onSuccess(newId);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error reissuing document:', error);
      toast.error(error.message || 'ไม่สามารถออกเอกสารใหม่ได้');
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;

  // Show locked payment date
  const paymentDate = invoice.original_payment_date || invoice.payment_date || invoice.issued_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">เพิ่มข้อมูลใบกำกับภาษี</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>ระบบจะยกเลิกเอกสารเดิม ({invoice.invoice_number}) และออกใบใหม่พร้อมข้อมูลที่กรอก</p>
          </div>

          {/* Reference info */}
          <div className="bg-gray-50 rounded-lg p-3 text-base">
            <p className="text-gray-500">เอกสารเดิม</p>
            <p className="font-semibold">{invoice.invoice_number}</p>
            <p className="text-gray-500">
              วันที่รับเงิน {formatDate(paymentDate, 'long')} ·{' '}
              {formatCurrency(invoice.total_amount || invoice.paid_amount || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">วันที่รับเงินจะถูกล็อคไว้ในเอกสารใหม่</p>
          </div>

          {/* Billing type */}
          <div>
            <Label className="text-base">ประเภท</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={billingType === 'personal' ? 'default' : 'outline'}
                size="sm"
                className="text-base flex-1"
                onClick={() => {
                  setBillingType('personal');
                  setBillingName(invoice.customer_name || '');
                }}
              >
                บุคคลธรรมดา
              </Button>
              <Button
                type="button"
                variant={billingType === 'company' ? 'default' : 'outline'}
                size="sm"
                className="text-base flex-1"
                onClick={() => {
                  setBillingType('company');
                  setBillingName('');
                }}
              >
                นิติบุคคล / บริษัท
              </Button>
            </div>
          </div>

          {/* Billing name */}
          <div>
            <Label className="text-base text-gray-500">
              {billingType === 'company' ? 'ชื่อบริษัท / นิติบุคคล *' : 'ชื่อ *'}
            </Label>
            <Input
              value={billingName}
              onChange={e => setBillingName(e.target.value)}
              placeholder={billingType === 'company' ? 'บริษัท xxx จำกัด' : ''}
              className="text-base"
            />
          </div>

          {/* Tax ID + company branch */}
          <div className="grid grid-cols-2 gap-2">
            <div className={billingType === 'company' ? '' : 'col-span-2'}>
              <Label className="text-base text-gray-500">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                placeholder="13 หลัก (ถ้ามี)"
                className="text-base"
                maxLength={13}
              />
            </div>
            {billingType === 'company' && (
              <div>
                <Label className="text-base text-gray-500">สาขา</Label>
                <Input
                  value={companyBranch}
                  onChange={e => setCompanyBranch(e.target.value)}
                  placeholder="สำนักงานใหญ่"
                  className="text-base"
                />
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <Label className="text-base text-gray-500 mb-1 block">ที่อยู่</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={address.houseNumber}
                onChange={e => updateAddress('houseNumber', e.target.value)}
                placeholder="บ้านเลขที่"
                className="text-base"
              />
              <Input
                value={address.street}
                onChange={e => updateAddress('street', e.target.value)}
                placeholder="ถนน"
                className="text-base"
              />
              <Input
                value={address.subDistrict}
                onChange={e => updateAddress('subDistrict', e.target.value)}
                placeholder="แขวง/ตำบล"
                className="text-base"
              />
              <Input
                value={address.district}
                onChange={e => updateAddress('district', e.target.value)}
                placeholder="เขต/อำเภอ"
                className="text-base"
              />
              <Input
                value={address.province}
                onChange={e => updateAddress('province', e.target.value)}
                placeholder="จังหวัด"
                className="text-base"
              />
              <Input
                value={address.postalCode}
                onChange={e => updateAddress('postalCode', e.target.value)}
                placeholder="รหัสไปรษณีย์"
                className="text-base"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                กำลังออกเอกสารใหม่...
              </>
            ) : (
              'ยืนยัน — ยกเลิกใบเดิม + ออกใบใหม่'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

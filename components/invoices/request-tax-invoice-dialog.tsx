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
import { Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createTaxInvoice } from '@/lib/services/tax-invoices';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RequestTaxInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any; // Original receipt invoice
  onSuccess: (taxInvoiceId: string) => void;
}

export default function RequestTaxInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: RequestTaxInvoiceDialogProps) {
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

  const isValid = billingName.trim() && taxId.trim().length === 13 && address.houseNumber.trim();

  const handleSubmit = async () => {
    if (!invoice || !isValid || submitting) return;
    setSubmitting(true);

    try {
      const totalAmount = invoice.total_amount || 0;
      const vatAmount = Math.round((totalAmount - totalAmount / 1.07) * 100) / 100;
      const subtotal = Math.round((totalAmount / 1.07) * 100) / 100;

      const taxInvoiceId = await createTaxInvoice({
        invoiceCompanyId: invoice.invoice_company_id,
        enrollmentId: invoice.enrollment_id || undefined,
        branchId: invoice.branch_id,
        receiptId: invoice.id,
        billingType,
        billingName,
        billingAddress: address,
        billingTaxId: taxId,
        billingCompanyBranch: billingType === 'company' ? companyBranch : undefined,
        customerName: invoice.customer_name,
        customerPhone: invoice.customer_phone || undefined,
        customerEmail: invoice.customer_email || undefined,
        customerAddress: invoice.customer_address || undefined,
        customerTaxId: taxId,
        items: invoice.items || [],
        subtotal,
        vatAmount,
        discountType: invoice.discount_type || undefined,
        discountValue: invoice.discount_value || 0,
        discountAmount: invoice.discount_amount || 0,
        promotionCode: invoice.promotion_code || undefined,
        totalAmount,
        paymentMethod: invoice.payment_method || undefined,
        paymentType: invoice.payment_type || undefined,
        paidAmount: invoice.paid_amount || 0,
        createdBy: adminUser?.id,
      });

      toast.success('ออกใบกำกับภาษีสำเร็จ');
      onSuccess(taxInvoiceId);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating tax invoice:', error);
      toast.error('ไม่สามารถออกใบกำกับภาษีได้');
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">ขอใบกำกับภาษี</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reference info */}
          <div className="bg-gray-50 rounded-lg p-3 text-base">
            <p className="text-gray-500">อ้างอิงใบเสร็จ</p>
            <p className="font-semibold">{invoice.invoice_number}</p>
            <p className="text-gray-500">
              วันที่ {formatDate(invoice.issued_at || invoice.created_at, 'long')} ·{' '}
              {formatCurrency(invoice.total_amount || 0)}
            </p>
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
              {billingType === 'company' ? 'ชื่อบริษัท / นิติบุคคล *' : 'ชื่อออกบิล *'}
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
              <Label className="text-base text-gray-500">เลขประจำตัวผู้เสียภาษี *</Label>
              <Input
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                placeholder="13 หลัก"
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
            <Label className="text-base text-gray-500 mb-1 block">ที่อยู่ *</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  value={address.houseNumber}
                  onChange={e => updateAddress('houseNumber', e.target.value)}
                  placeholder="บ้านเลขที่"
                  className="text-base"
                />
              </div>
              <div>
                <Input
                  value={address.street}
                  onChange={e => updateAddress('street', e.target.value)}
                  placeholder="ถนน"
                  className="text-base"
                />
              </div>
              <div>
                <Input
                  value={address.subDistrict}
                  onChange={e => updateAddress('subDistrict', e.target.value)}
                  placeholder="แขวง/ตำบล"
                  className="text-base"
                />
              </div>
              <div>
                <Input
                  value={address.district}
                  onChange={e => updateAddress('district', e.target.value)}
                  placeholder="เขต/อำเภอ"
                  className="text-base"
                />
              </div>
              <div>
                <Input
                  value={address.province}
                  onChange={e => updateAddress('province', e.target.value)}
                  placeholder="จังหวัด"
                  className="text-base"
                />
              </div>
              <div>
                <Input
                  value={address.postalCode}
                  onChange={e => updateAddress('postalCode', e.target.value)}
                  placeholder="รหัสไปรษณีย์"
                  className="text-base"
                />
              </div>
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
                กำลังออกใบกำกับ...
              </>
            ) : (
              'ออกใบกำกับภาษี'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

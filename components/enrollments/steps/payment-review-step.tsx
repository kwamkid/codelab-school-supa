'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Loader2, CheckCircle, FileText, AlertCircle, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { StepProps } from '../enrollment-types';
import { getClass } from '@/lib/services/classes';
import { getSubject } from '@/lib/services/subjects';
import { getBranch } from '@/lib/services/branches';
import { getBranchPaymentSettings } from '@/lib/services/branch-payment-settings';
import { Class, Subject, Branch, PaymentMethod, PaymentType, BranchPaymentSettings, InvoiceCompany } from '@/types/models';
import { getInvoiceCompany } from '@/lib/services/invoice-companies';
import { formatCurrency, calculateAge, getDayName, formatDate } from '@/lib/utils';
import PaymentMethodSelector from '../payment/payment-method-selector';

const TYPE_CONFIG: Record<string, { label: string; description: string }> = {
  full: { label: 'เต็มจำนวน', description: 'ชำระครบทั้งหมด' },
  deposit: { label: 'มัดจำ', description: 'จ่ายบางส่วนก่อน' },
};

interface ClassInfo {
  classData: Class;
  subject: Subject | null;
}

export default function PaymentReviewStep({ formData, setFormData, onBack }: StepProps & {
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [classInfoMap, setClassInfoMap] = useState<Record<string, ClassInfo>>({});
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>(['cash', 'bank_transfer']);
  const [paymentSettings, setPaymentSettings] = useState<BranchPaymentSettings | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [invoiceCompany, setInvoiceCompany] = useState<InvoiceCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBankIndex, setSelectedBankIndex] = useState<number>(0);
  const [editingCustomer, setEditingCustomer] = useState(false);


  const props = arguments[0] as StepProps & { onSubmit: () => void; submitting: boolean };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-fill billing name + address from parent on mount
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      billingName: prev.billingName || prev.parentName,
      billingAddress: prev.billingAddress.houseNumber ? prev.billingAddress : { ...prev.address },
    }));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const uniqueClassIds = [...new Set(formData.students.map(s => s.classId).filter(Boolean))];
      const classInfos: Record<string, ClassInfo> = {};

      await Promise.all(
        uniqueClassIds.map(async classId => {
          const classData = await getClass(classId);
          if (classData) {
            const subject = await getSubject(classData.subjectId);
            classInfos[classId] = { classData, subject: subject || null };
          }
        })
      );
      setClassInfoMap(classInfos);

      if (formData.branchId) {
        const [settings, branchData] = await Promise.all([
          getBranchPaymentSettings(formData.branchId),
          getBranch(formData.branchId),
        ]);
        setPaymentSettings(settings);
        setEnabledMethods(settings.enabledMethods);
        setBranch(branchData);
        if (branchData?.invoiceCompanyId) {
          const company = await getInvoiceCompany(branchData.invoiceCompanyId);
          setInvoiceCompany(company);
          // If company is not VAT registered, reset tax invoice fields
          if (!company?.isVatRegistered) {
            setFormData(prev => ({ ...prev, wantTaxInvoice: false }));
          }
        }
        if (!settings.enabledMethods.includes(formData.paymentMethod)) {
          setFormData(prev => ({ ...prev, paymentMethod: settings.enabledMethods[0] || 'cash' }));
        }
      }
    } catch (error) {
      console.error('Error loading review data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let totalOriginal = 0;
    let totalFinal = 0;

    formData.students.forEach(student => {
      const info = classInfoMap[student.classId];
      if (info) {
        const originalPrice = info.classData.pricing.totalPrice;
        totalOriginal += originalPrice;
        let discountAmount = 0;
        if (formData.discountType === 'percentage') {
          discountAmount = (originalPrice * formData.discount) / 100;
        } else {
          discountAmount = formData.discount;
        }
        totalFinal += Math.max(0, originalPrice - discountAmount);
      }
    });

    return { totalOriginal, totalFinal, totalDiscount: totalOriginal - totalFinal };
  };

  const { totalOriginal, totalFinal, totalDiscount } = calculateTotals();

  const formatAddress = (addr: typeof formData.address) => {
    const parts = [addr.houseNumber, addr.street, addr.subDistrict, addr.district, addr.province, addr.postalCode].filter(Boolean);
    return parts.join(' ') || '-';
  };

  const updateBillingAddress = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      billingAddress: { ...prev.billingAddress, [field]: value },
    }));
  };

  const isReadyToSubmit = !!formData.paymentMethod && !!formData.paymentType;

  // Collect missing items for validation message
  const missingItems: string[] = [];
  if (!formData.paymentMethod) missingItems.push('วิธีชำระเงิน');
  if (!formData.paymentType) missingItems.push('ประเภทการชำระ');

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">

      {/* Invoice header */}
      <div className="bg-white border border-gray-300 shadow-lg rounded-lg overflow-hidden">
        <div className="px-8 pt-6 pb-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-bold text-gray-800">ใบเรียกเก็บเงิน</h1>
              </div>
              <p className="text-base text-gray-400 mt-1">Enrollment Invoice</p>
            </div>
            <div className="text-right text-base">
              <p className="font-semibold text-lg">{branch?.name || '-'}</p>
              {branch?.address && (
                <p className="text-gray-500 text-base max-w-xs">{branch.address}</p>
              )}
              {branch?.phone && (
                <p className="text-gray-500 text-base">โทร. {branch.phone}</p>
              )}
              <p className="text-gray-400 text-base mt-2">วันที่: {formatDate(new Date(), 'long')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 2-Column masonry: Left (customer + order) / Right (billing + payment) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* LEFT COLUMN: Customer + Order items */}
        <div className="space-y-6">

          {/* Customer info */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <h3 className="text-base font-semibold">ข้อมูลลูกค้า</h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(!editingCustomer)}
                className="text-base text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
              >
                {editingCustomer ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                <span>{editingCustomer ? 'ปิด' : 'แก้ไข'}</span>
              </button>
            </div>

            {editingCustomer ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-base text-gray-500">ชื่อผู้ปกครอง</Label>
                  <Input
                    value={formData.parentName}
                    onChange={e => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">เบอร์โทร</Label>
                  <Input
                    value={formData.parentPhone}
                    onChange={e => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">อีเมล</Label>
                  <Input
                    value={formData.parentEmail}
                    onChange={e => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                    className="text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-base text-gray-500">บ้านเลขที่</Label>
                    <Input
                      value={formData.address.houseNumber}
                      onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, houseNumber: e.target.value } }))}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">ถนน</Label>
                    <Input
                      value={formData.address.street}
                      onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">แขวง/ตำบล</Label>
                    <Input
                      value={formData.address.subDistrict}
                      onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, subDistrict: e.target.value } }))}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">เขต/อำเภอ</Label>
                    <Input
                      value={formData.address.district}
                      onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, district: e.target.value } }))}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">จังหวัด</Label>
                    <Input
                      value={formData.address.province}
                      onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, province: e.target.value } }))}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">รหัสไปรษณีย์</Label>
                    <Input
                      value={formData.address.postalCode}
                      onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
                      className="text-base"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-base">
                <p>
                  <span className="text-gray-500">ชื่อ:</span>{' '}
                  <span className="font-medium">{formData.parentName}</span>
                </p>
                <p>
                  <span className="text-gray-500">โทร:</span>{' '}
                  {formData.parentPhone}
                </p>
                {formData.parentEmail && (
                  <p>
                    <span className="text-gray-500">อีเมล:</span>{' '}
                    {formData.parentEmail}
                  </p>
                )}
                <p>
                  <span className="text-gray-500">ที่อยู่:</span>{' '}
                  {formatAddress(formData.address)}
                </p>
              </div>
            )}
          </div>

          {/* Order items + discount + summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">

            {/* Line items table */}
            <div>
              <h3 className="text-base font-semibold border-b pb-2 mb-3">รายการ</h3>
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 text-left w-8">#</th>
                    <th className="py-2 text-left">รายการ</th>
                    <th className="py-2 text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.students.map((student, index) => {
                    const info = classInfoMap[student.classId];
                    if (!info) return null;
                    return (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 text-gray-400 align-top">{index + 1}</td>
                        <td className="py-3">
                          <p className="font-medium">{info.classData.name}</p>
                          <p className="text-base text-gray-500">
                            {student.nickname || student.name}
                            {student.birthdate && ` (${calculateAge(new Date(student.birthdate))} ปี)`}
                            {info.subject && ` | ${info.subject.name}`}
                          </p>
                          <p className="text-base text-gray-500">
                            {info.classData.daysOfWeek.map(d => getDayName(d)).join(', ')} | {info.classData.startTime?.slice(0, 5)} - {info.classData.endTime?.slice(0, 5)}
                          </p>
                        </td>
                        <td className="py-3 text-right font-medium align-top">
                          {formatCurrency(info.classData.pricing.totalPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Discount & promotion */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-base font-medium mb-3">ส่วนลดและโปรโมชั่น</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-base text-gray-500">ส่วนลด</Label>
                  <div className="flex">
                    <Input
                      type="number"
                      value={formData.discount || ''}
                      onChange={e => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                      className="text-base rounded-r-none"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        discountType: prev.discountType === 'percentage' ? 'fixed' : 'percentage',
                      }))}
                      className="px-4 border border-l-0 rounded-r-md bg-gray-700 text-white text-base font-medium hover:bg-gray-600 transition-colors shrink-0"
                    >
                      {formData.discountType === 'percentage' ? '%' : '฿'}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-base text-gray-500">รหัสโปรโมชั่น</Label>
                  <Input
                    value={formData.promotionCode}
                    onChange={e => setFormData(prev => ({ ...prev, promotionCode: e.target.value }))}
                    placeholder="TRIAL5"
                    className="text-base"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-gray-500">ค่าเรียนรวม</span>
                <span>{formatCurrency(totalOriginal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-base text-green-600">
                  <span>ส่วนลด</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t-2 border-gray-800 pt-3 mt-2">
                <span>ยอดรวมสุทธิ</span>
                <span>{formatCurrency(totalFinal)}</span>
              </div>
            </div>
          </div>

        </div>{/* END LEFT COLUMN */}

        {/* RIGHT COLUMN: Billing + Payment */}
        <div className="space-y-6">

          {/* Billing / Tax invoice — only show for VAT-registered companies */}
          {invoiceCompany?.isVatRegistered && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            {/* Checkbox as header */}
            <div className="flex items-center gap-2 border-b pb-2 mb-3">
              <Checkbox
                id="wantTaxInvoice"
                checked={formData.wantTaxInvoice || formData.billingType === 'company'}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setFormData(prev => ({ ...prev, wantTaxInvoice: false, billingType: 'personal' }));
                  } else {
                    setFormData(prev => ({ ...prev, wantTaxInvoice: true }));
                  }
                }}
              />
              <Label htmlFor="wantTaxInvoice" className="text-base font-semibold cursor-pointer">
                ระบุข้อมูลออกใบกำกับภาษี
              </Label>
              <span className="text-sm text-gray-500">(ถ้าไม่ระบุ จะใช้ชื่อ-ที่อยู่ผู้ปกครอง)</span>
            </div>

            {/* Show billing form only when checked */}
            {(formData.wantTaxInvoice || formData.billingType === 'company') && (
              <div className="space-y-3">

                {/* Billing type toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.billingType === 'personal' ? 'default' : 'outline'}
                    size="sm"
                    className="text-base flex-1"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      billingType: 'personal',
                      billingName: prev.billingName || prev.parentName,
                    }))}
                  >
                    บุคคลธรรมดา
                  </Button>
                  <Button
                    type="button"
                    variant={formData.billingType === 'company' ? 'default' : 'outline'}
                    size="sm"
                    className="text-base flex-1"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      billingType: 'company',
                      wantTaxInvoice: true,
                      billingName: prev.billingType === 'personal' ? '' : prev.billingName,
                    }))}
                  >
                    นิติบุคคล / บริษัท
                  </Button>
                </div>

                {/* Billing name */}
                <div>
                  <Label className="text-base text-gray-500">
                    {formData.billingType === 'company' ? 'ชื่อบริษัท / นิติบุคคล' : 'ชื่อออกบิล'}
                  </Label>
                  <Input
                    value={formData.billingName}
                    onChange={e => setFormData(prev => ({ ...prev, billingName: e.target.value }))}
                    placeholder={formData.billingType === 'company' ? 'บริษัท xxx จำกัด' : ''}
                    className="text-base"
                  />
                </div>

                {/* Tax ID + company branch */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={formData.billingType === 'company' ? '' : 'col-span-2'}>
                    <Label className="text-base text-gray-500">เลขประจำตัวผู้เสียภาษี</Label>
                    <Input
                      value={formData.taxId}
                      onChange={e => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                      placeholder="13 หลัก"
                      className="text-base"
                      maxLength={13}
                    />
                  </div>
                  {formData.billingType === 'company' && (
                    <div>
                      <Label className="text-base text-gray-500">สาขา</Label>
                      <Input
                        value={formData.companyBranch}
                        onChange={e => setFormData(prev => ({ ...prev, companyBranch: e.target.value }))}
                        placeholder="สำนักงานใหญ่"
                        className="text-base"
                      />
                    </div>
                  )}
                </div>

                {/* Address */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-base text-gray-500">บ้านเลขที่</Label>
                    <Input
                      value={formData.billingAddress.houseNumber}
                      onChange={e => updateBillingAddress('houseNumber', e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">ถนน</Label>
                    <Input
                      value={formData.billingAddress.street}
                      onChange={e => updateBillingAddress('street', e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">แขวง/ตำบล</Label>
                    <Input
                      value={formData.billingAddress.subDistrict}
                      onChange={e => updateBillingAddress('subDistrict', e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">เขต/อำเภอ</Label>
                    <Input
                      value={formData.billingAddress.district}
                      onChange={e => updateBillingAddress('district', e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">จังหวัด</Label>
                    <Input
                      value={formData.billingAddress.province}
                      onChange={e => updateBillingAddress('province', e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-base text-gray-500">รหัสไปรษณีย์</Label>
                    <Input
                      value={formData.billingAddress.postalCode}
                      onChange={e => updateBillingAddress('postalCode', e.target.value)}
                      className="text-base"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Payment POS section */}
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 space-y-4">
            <h4 className="text-lg font-bold text-red-800">ชำระเงิน</h4>

            {paymentSettings && (
              <PaymentMethodSelector
                selectedMethod={formData.paymentMethod}
                onMethodChange={m => setFormData(prev => ({ ...prev, paymentMethod: m }))}
                paymentSettings={paymentSettings}
                colorScheme="red"
                gridCols="grid-cols-3 sm:grid-cols-5"
                label="วิธีชำระ"
                selectedBankIndex={selectedBankIndex}
                onBankIndexChange={setSelectedBankIndex}
              />
            )}

            {/* Payment type buttons */}
            <div>
              <Label className="text-base text-red-700 font-medium mb-2 block">ประเภท</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['full', 'deposit'] as const).map(t => {
                  const config = TYPE_CONFIG[t];
                  const isActive = formData.paymentType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          paymentType: t,
                          initialPaymentAmount: t === 'full' ? totalFinal : prev.initialPaymentAmount,
                        }));
                        if (t === 'deposit') {
                          setTimeout(() => {
                            const el = document.getElementById('payment-amount-input') as HTMLInputElement;
                            if (el) { el.focus(); el.select(); }
                          }, 50);
                        }
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        isActive
                          ? 'border-red-500 bg-red-600 text-white shadow-md'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <p className="text-base font-bold">{config.label}</p>
                      <p className={`text-xs ${isActive ? 'text-red-100' : 'text-gray-400'}`}>{config.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount input */}
            {formData.paymentType && (
              <div>
                <Label className="text-base text-red-700 font-medium mb-2 block">
                  {formData.paymentType === 'full' ? 'ยอดชำระ' : 'ยอดชำระครั้งแรก'}
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">฿</span>
                    <Input
                      id="payment-amount-input"
                      type="number"
                      value={formData.initialPaymentAmount || ''}
                      onChange={e => setFormData(prev => ({ ...prev, initialPaymentAmount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                      className="text-2xl font-bold pl-10 h-14 text-right"
                      min="0"
                    />
                  </div>
                  {formData.paymentType === 'full' && formData.initialPaymentAmount !== totalFinal && (
                    <Button
                      type="button"
                      className="bg-red-600 hover:bg-red-700 text-white h-14 px-4 text-base shrink-0"
                      onClick={() => setFormData(prev => ({ ...prev, initialPaymentAmount: totalFinal }))}
                    >
                      เต็มจำนวน
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Summary bar */}
            {formData.initialPaymentAmount > 0 && (
              <div className={`text-white rounded-lg p-4 space-y-1 ${
                formData.initialPaymentAmount >= totalFinal ? 'bg-green-600' : 'bg-red-700'
              }`}>
                <div className="flex justify-between text-base">
                  <span>ชำระ{formData.paymentType === 'full' ? '' : 'ครั้งแรก'}</span>
                  <span className="text-xl font-bold">{formatCurrency(formData.initialPaymentAmount)}</span>
                </div>
                {formData.initialPaymentAmount < totalFinal && (
                  <div className="flex justify-between text-red-200 text-base">
                    <span>คงเหลือ</span>
                    <span className="font-medium">{formatCurrency(totalFinal - formData.initialPaymentAmount)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>{/* END RIGHT COLUMN */}

      </div>

      {/* Invoice footer */}
      <div className="text-center text-base text-gray-400">
        เอกสารนี้ออกโดยระบบ CodeLab School | {formatDate(new Date(), 'long')}
      </div>

      {/* Validation message when not ready */}
      {!isReadyToSubmit && (
        <div className="flex items-center justify-center gap-2 text-base text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-md mx-auto">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>กรุณาเลือก{missingItems.join(' และ ')}ก่อนยืนยัน</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="text-base">
          <ChevronLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>
        {isReadyToSubmit && (
          <Button
            onClick={() => props.onSubmit()}
            disabled={props.submitting}
            className="bg-green-600 hover:bg-green-700 text-base px-8"
          >
            {props.submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                ยืนยันลงทะเบียน
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

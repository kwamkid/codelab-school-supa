'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Building2 } from 'lucide-react';
import { InvoiceCompany } from '@/types/models';
import {
  getInvoiceCompanies,
  createInvoiceCompany,
  updateInvoiceCompany,
} from '@/lib/services/invoice-companies';

interface CompanyFormData {
  name: string;
  taxId: string;
  address: {
    houseNumber: string;
    street: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };
  branchLabel: string;
  phone: string;
  email: string;
  invoicePrefix: string;
  taxInvoicePrefix: string;
  isVatRegistered: boolean;
}

const DEFAULT_FORM: CompanyFormData = {
  name: '',
  taxId: '',
  address: {
    houseNumber: '',
    street: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  },
  branchLabel: 'สำนักงานใหญ่',
  phone: '',
  email: '',
  invoicePrefix: 'INV',
  taxInvoicePrefix: 'TAX',
  isVatRegistered: false,
};

export default function InvoiceCompanySettingsPage() {
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await getInvoiceCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast.error('ไม่สามารถโหลดข้อมูลบริษัทได้');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData({ ...DEFAULT_FORM });
    setDialogOpen(true);
  };

  const openEditDialog = (company: InvoiceCompany) => {
    setEditingId(company.id);
    setFormData({
      name: company.name,
      taxId: company.taxId || '',
      address: company.address || { ...DEFAULT_FORM.address },
      branchLabel: company.branchLabel || 'สำนักงานใหญ่',
      phone: company.phone || '',
      email: company.email || '',
      invoicePrefix: company.invoicePrefix || 'INV',
      taxInvoicePrefix: company.taxInvoicePrefix || 'TAX',
      isVatRegistered: company.isVatRegistered || false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อบริษัท');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateInvoiceCompany(editingId, {
          name: formData.name,
          taxId: formData.taxId || undefined,
          address: formData.address,
          branchLabel: formData.branchLabel,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          invoicePrefix: formData.invoicePrefix,
          taxInvoicePrefix: formData.taxInvoicePrefix,
          isVatRegistered: formData.isVatRegistered,
        });
        toast.success('อัปเดตข้อมูลบริษัทเรียบร้อย');
      } else {
        await createInvoiceCompany({
          name: formData.name,
          taxId: formData.taxId || undefined,
          address: formData.address,
          branchLabel: formData.branchLabel,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          invoicePrefix: formData.invoicePrefix,
          taxInvoicePrefix: formData.taxInvoicePrefix,
          isVatRegistered: formData.isVatRegistered,
        });
        toast.success('เพิ่มบริษัทใหม่เรียบร้อย');
      }
      setDialogOpen(false);
      loadCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (company: InvoiceCompany) => {
    try {
      await updateInvoiceCompany(company.id, { isActive: !company.isActive });
      loadCompanies();
      toast.success(company.isActive ? 'ปิดการใช้งานบริษัท' : 'เปิดการใช้งานบริษัท');
    } catch (error) {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const updateAddress = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ตั้งค่าบริษัท (ออกบิล)</h2>
          <p className="text-base text-gray-500">
            จัดการบริษัทที่ใช้ออกใบเสร็จ/ใบกำกับภาษี สามารถผูกหลายสาขากับบริษัทเดียวกันได้
          </p>
        </div>
        <Button onClick={openCreateDialog} className="text-base">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มบริษัท
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500 text-base">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>ยังไม่มีบริษัทที่ลงทะเบียน</p>
            <p className="text-base mt-1">กดปุ่ม "เพิ่มบริษัท" เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {companies.map(company => (
            <Card key={company.id} className={!company.isActive ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-gray-500" />
                      <h3 className="text-base font-semibold">{company.name}</h3>
                      <span className="text-base text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {company.invoicePrefix}
                      </span>
                      {company.isVatRegistered && (
                        <>
                          <span className="text-base text-gray-400 bg-blue-50 px-2 py-0.5 rounded">
                            {company.taxInvoicePrefix}
                          </span>
                          <Badge className="bg-blue-100 text-blue-700">จด VAT</Badge>
                        </>
                      )}
                    </div>
                    {company.taxId && (
                      <p className="text-base text-gray-500">
                        เลขผู้เสียภาษี: {company.taxId}
                      </p>
                    )}
                    {company.branchLabel && (
                      <p className="text-base text-gray-500">
                        สาขา: {company.branchLabel}
                      </p>
                    )}
                    {company.phone && (
                      <p className="text-base text-gray-500">
                        โทร: {company.phone}
                      </p>
                    )}
                    <p className="text-base text-gray-400">
                      เลขบิลถัดไป: {company.invoicePrefix}-{company.nextInvoiceNumber.toString().padStart(6, '0')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={company.isActive}
                      onCheckedChange={() => handleToggleActive(company)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-base"
                      onClick={() => openEditDialog(company)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      แก้ไข
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingId ? 'แก้ไขบริษัท' : 'เพิ่มบริษัทใหม่'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-base">ชื่อบริษัท *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="บริษัท xxx จำกัด"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">เลขผู้เสียภาษี (13 หลัก)</Label>
                <Input
                  value={formData.taxId}
                  onChange={e => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                  placeholder="0000000000000"
                  className="text-base"
                  maxLength={13}
                />
              </div>
              <div>
                <Label className="text-base">สาขาบริษัท</Label>
                <Input
                  value={formData.branchLabel}
                  onChange={e => setFormData(prev => ({ ...prev, branchLabel: e.target.value }))}
                  placeholder="สำนักงานใหญ่"
                  className="text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-base">โทรศัพท์</Label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="02-xxx-xxxx"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">อีเมล</Label>
                <Input
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="info@company.com"
                  className="text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-base">Prefix ใบเสร็จ</Label>
                <Input
                  value={formData.invoicePrefix}
                  onChange={e => setFormData(prev => ({ ...prev, invoicePrefix: e.target.value.toUpperCase() }))}
                  placeholder="REC"
                  className="text-base"
                  maxLength={10}
                />
                <p className="text-sm text-gray-400 mt-1">
                  เช่น {formData.invoicePrefix || 'REC'}-2603-0001
                </p>
              </div>
              {formData.isVatRegistered && (
                <div>
                  <Label className="text-base">Prefix ใบกำกับภาษี</Label>
                  <Input
                    value={formData.taxInvoicePrefix}
                    onChange={e => setFormData(prev => ({ ...prev, taxInvoicePrefix: e.target.value.toUpperCase() }))}
                    placeholder="TAX"
                    className="text-base"
                    maxLength={10}
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    เช่น {formData.taxInvoicePrefix || 'TAX'}-2603-0001
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border rounded-lg p-3">
              <Checkbox
                id="isVatRegistered"
                checked={formData.isVatRegistered}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, isVatRegistered: !!checked }))
                }
              />
              <div>
                <Label htmlFor="isVatRegistered" className="text-base font-medium cursor-pointer">
                  จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)
                </Label>
                <p className="text-sm text-gray-500">
                  ออกใบกำกับภาษี/ใบเสร็จรับเงิน แสดง VAT 7%
                </p>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">ที่อยู่บริษัท</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-base text-gray-500">บ้านเลขที่</Label>
                  <Input
                    value={formData.address.houseNumber}
                    onChange={e => updateAddress('houseNumber', e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">ถนน</Label>
                  <Input
                    value={formData.address.street}
                    onChange={e => updateAddress('street', e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">แขวง/ตำบล</Label>
                  <Input
                    value={formData.address.subDistrict}
                    onChange={e => updateAddress('subDistrict', e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">เขต/อำเภอ</Label>
                  <Input
                    value={formData.address.district}
                    onChange={e => updateAddress('district', e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">จังหวัด</Label>
                  <Input
                    value={formData.address.province}
                    onChange={e => updateAddress('province', e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base text-gray-500">รหัสไปรษณีย์</Label>
                  <Input
                    value={formData.address.postalCode}
                    onChange={e => updateAddress('postalCode', e.target.value)}
                    className="text-base"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="text-base"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="text-base"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบริษัท'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

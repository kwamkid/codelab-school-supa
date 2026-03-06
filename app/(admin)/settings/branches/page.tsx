'use client';

import { useState, useEffect } from 'react';
import { Branch, InvoiceCompany } from '@/types/models';
import {
  getBranches,
  createBranch,
  updateBranch,
  toggleBranchStatus,
  checkBranchCodeExists,
} from '@/lib/services/branches';
import { getInvoiceCompanies } from '@/lib/services/invoice-companies';
import { getRoomCount } from '@/lib/services/rooms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Pencil,
  Building2,
  Phone,
  MapPin,
  Clock,
  School,
} from 'lucide-react';

interface BranchWithStats extends Branch {
  roomCount?: number;
}

interface BranchFormData {
  name: string;
  code: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  openDays: number[];
  isActive: boolean;
  managerName: string;
  managerPhone: string;
  lineGroupUrl: string;
  invoiceCompanyId: string;
}

const DEFAULT_FORM: BranchFormData = {
  name: '',
  code: '',
  address: '',
  phone: '',
  openTime: '09:00',
  closeTime: '18:00',
  openDays: [1, 2, 3, 4, 5, 6],
  isActive: true,
  managerName: '',
  managerPhone: '',
  lineGroupUrl: '',
  invoiceCompanyId: '',
};

const DAYS_OF_WEEK = [
  { value: 1, label: 'จันทร์' },
  { value: 2, label: 'อังคาร' },
  { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัสบดี' },
  { value: 5, label: 'ศุกร์' },
  { value: 6, label: 'เสาร์' },
  { value: 0, label: 'อาทิตย์' },
];

const DAYS_SHORT: Record<number, string> = {
  0: 'อา', 1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ', 6: 'ส',
};

export default function BranchesSettingsPage() {
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [invoiceCompanies, setInvoiceCompanies] = useState<InvoiceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [branchesData, companies] = await Promise.all([
        getBranches(),
        getInvoiceCompanies().catch(() => []),
      ]);

      const withStats = await Promise.all(
        branchesData.map(async b => {
          const roomCount = await getRoomCount(b.id);
          return { ...b, roomCount };
        })
      );

      setBranches(withStats);
      setInvoiceCompanies(companies.filter(c => c.isActive));
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสาขาได้');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData({ ...DEFAULT_FORM });
    setDialogOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      openTime: branch.openTime || '09:00',
      closeTime: branch.closeTime || '18:00',
      openDays: branch.openDays || [1, 2, 3, 4, 5, 6],
      isActive: branch.isActive,
      managerName: branch.managerName || '',
      managerPhone: branch.managerPhone || '',
      lineGroupUrl: branch.lineGroupUrl || '',
      invoiceCompanyId: branch.invoiceCompanyId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.code.trim() || !formData.address.trim() || !formData.phone.trim()) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (formData.openDays.length === 0) {
      toast.error('กรุณาเลือกวันเปิดทำการอย่างน้อย 1 วัน');
      return;
    }

    setSaving(true);
    try {
      const codeExists = await checkBranchCodeExists(
        formData.code,
        editingId || undefined
      );

      if (codeExists) {
        toast.error('รหัสสาขานี้มีอยู่แล้ว');
        setSaving(false);
        return;
      }

      if (editingId) {
        await updateBranch(editingId, {
          ...formData,
          invoiceCompanyId: formData.invoiceCompanyId || undefined,
        } as any);
        toast.success('อัปเดตข้อมูลสาขาเรียบร้อย');
      } else {
        await createBranch({
          ...formData,
          invoiceCompanyId: formData.invoiceCompanyId || undefined,
        } as any);
        toast.success('เพิ่มสาขาใหม่เรียบร้อย');
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      await toggleBranchStatus(branch.id, !branch.isActive);
      toast.success(branch.isActive ? 'ปิดการใช้งานสาขา' : 'เปิดการใช้งานสาขา');
      loadData();
    } catch (error) {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      openDays: prev.openDays.includes(day)
        ? prev.openDays.filter(d => d !== day)
        : [...prev.openDays, day].sort((a, b) => a - b),
    }));
  };

  const formatOpenDays = (days?: number[]) => {
    if (!days || days.length === 0) return 'ไม่ระบุ';
    if (days.length === 7) return 'ทุกวัน';
    return [...days].sort((a, b) => a - b).map(d => DAYS_SHORT[d]).join(', ');
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return null;
    return invoiceCompanies.find(c => c.id === companyId)?.name || null;
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
          <h2 className="text-xl font-bold">จัดการสาขา</h2>
          <p className="text-base text-gray-500">
            เพิ่ม แก้ไข และจัดการสาขาทั้งหมด
          </p>
        </div>
        <Button onClick={openCreateDialog} className="text-base">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มสาขา
        </Button>
      </div>

      {branches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500 text-base">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>ยังไม่มีสาขา</p>
            <p className="text-base mt-1">กดปุ่ม "เพิ่มสาขา" เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {branches.map(branch => (
            <Card key={branch.id} className={!branch.isActive ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      <h3 className="text-base font-semibold">{branch.name}</h3>
                      <Badge variant="outline" className="text-base">
                        {branch.code}
                      </Badge>
                      {branch.isActive ? (
                        <Badge className="bg-green-100 text-green-700 text-base">เปิด</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-base">ปิด</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-base text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{branch.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>{branch.openTime} - {branch.closeTime}</span>
                        <span className="text-gray-400">({formatOpenDays(branch.openDays)})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <School className="h-4 w-4 flex-shrink-0" />
                        <span>{branch.roomCount || 0} ห้องเรียน</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-base text-gray-500">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{branch.address}</span>
                    </div>

                    {(branch.managerName || getCompanyName(branch.invoiceCompanyId)) && (
                      <div className="flex gap-4 text-base text-gray-400">
                        {branch.managerName && (
                          <span>ผู้จัดการ: {branch.managerName}</span>
                        )}
                        {getCompanyName(branch.invoiceCompanyId) && (
                          <span>บริษัทออกบิล: {getCompanyName(branch.invoiceCompanyId)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Switch
                      checked={branch.isActive}
                      onCheckedChange={() => handleToggleActive(branch)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-base"
                      onClick={() => openEditDialog(branch)}
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
              {editingId ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-base">ชื่อสาขา *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="เช่น สาขาสุขุมวิท"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">รหัสสาขา *</Label>
                <Input
                  value={formData.code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="เช่น BKK01"
                  className="text-base"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <Label className="text-base">ที่อยู่ *</Label>
              <Input
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด"
                className="text-base"
              />
            </div>

            <div>
              <Label className="text-base">เบอร์โทรศัพท์ *</Label>
              <Input
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="02-123-4567"
                className="text-base"
              />
            </div>

            {/* Operating hours */}
            <div>
              <Label className="text-base">เวลาทำการ</Label>
              <TimeRangePicker
                startTime={formData.openTime}
                endTime={formData.closeTime}
                onStartTimeChange={v => setFormData(prev => ({ ...prev, openTime: v }))}
                onEndTimeChange={v => setFormData(prev => ({ ...prev, closeTime: v }))}
                startPlaceholder="เวลาเปิด"
                endPlaceholder="เวลาปิด"
              />
            </div>

            <div>
              <Label className="text-base">วันเปิดทำการ</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day.value} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={formData.openDays.includes(day.value)}
                      onCheckedChange={() => handleDayToggle(day.value)}
                    />
                    <Label
                      htmlFor={`day-${day.value}`}
                      className="text-base font-normal cursor-pointer"
                    >
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Manager */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-base">ชื่อผู้จัดการ</Label>
                <Input
                  value={formData.managerName}
                  onChange={e => setFormData(prev => ({ ...prev, managerName: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  className="text-base"
                />
              </div>
              <div>
                <Label className="text-base">เบอร์โทรผู้จัดการ</Label>
                <Input
                  value={formData.managerPhone}
                  onChange={e => setFormData(prev => ({ ...prev, managerPhone: e.target.value }))}
                  placeholder="08x-xxx-xxxx"
                  className="text-base"
                />
              </div>
            </div>

            <div>
              <Label className="text-base">LINE Group URL</Label>
              <Input
                value={formData.lineGroupUrl}
                onChange={e => setFormData(prev => ({ ...prev, lineGroupUrl: e.target.value }))}
                placeholder="https://line.me/R/..."
                className="text-base"
              />
            </div>

            {/* Invoice company */}
            {invoiceCompanies.length > 0 && (
              <div>
                <Label className="text-base">บริษัทออกบิล</Label>
                <Select
                  value={formData.invoiceCompanyId || 'none'}
                  onValueChange={v => setFormData(prev => ({ ...prev, invoiceCompanyId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="เลือกบริษัท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-base">-- ไม่ระบุ --</SelectItem>
                    {invoiceCompanies.map(company => (
                      <SelectItem key={company.id} value={company.id} className="text-base">
                        {company.name} ({company.invoicePrefix})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสาขา'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

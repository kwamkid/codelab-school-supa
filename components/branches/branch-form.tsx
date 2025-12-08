'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Branch } from '@/types/models';
import { createBranch, updateBranch, checkBranchCodeExists } from '@/lib/services/branches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Save, X } from 'lucide-react';
import Link from 'next/link';

interface BranchFormProps {
  branch?: Branch;
  isEdit?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'จันทร์' },
  { value: 2, label: 'อังคาร' },
  { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัสบดี' },
  { value: 5, label: 'ศุกร์' },
  { value: 6, label: 'เสาร์' },
  { value: 0, label: 'อาทิตย์' },
];

export default function BranchForm({ branch, isEdit = false }: BranchFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: branch?.name || '',
    code: branch?.code || '',
    address: branch?.address || '',
    phone: branch?.phone || '',
    openTime: branch?.openTime || '09:00',
    closeTime: branch?.closeTime || '18:00',
    openDays: branch?.openDays || [1, 2, 3, 4, 5, 6],
    isActive: branch?.isActive ?? true,
    managerName: branch?.managerName || '',
    managerPhone: branch?.managerPhone || '',
    lineGroupUrl: branch?.lineGroupUrl || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name || !formData.code || !formData.address || !formData.phone) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (formData.openDays.length === 0) {
      toast.error('กรุณาเลือกวันเปิดทำการอย่างน้อย 1 วัน');
      return;
    }

    setLoading(true);

    try {
      // Check if branch code already exists
      const codeExists = await checkBranchCodeExists(
        formData.code,
        isEdit ? branch?.id : undefined
      );

      if (codeExists) {
        toast.error('รหัสสาขานี้มีอยู่แล้ว');
        setLoading(false);
        return;
      }

      if (isEdit && branch?.id) {
        await updateBranch(branch.id, formData);
        toast.success('อัปเดตข้อมูลสาขาเรียบร้อยแล้ว');
      } else {
        await createBranch(formData);
        toast.success('เพิ่มสาขาใหม่เรียบร้อยแล้ว');
      }
      
      router.push('/branches');
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error(isEdit ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มสาขาได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      openDays: prev.openDays.includes(day)
        ? prev.openDays.filter(d => d !== day)
        : [...prev.openDays, day].sort((a, b) => a - b)
    }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? 'แก้ไขข้อมูลสาขา' : 'เพิ่มสาขาใหม่'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">ข้อมูลพื้นฐาน</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">ชื่อสาขา *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น สาขาสุขุมวิท"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="code">รหัสสาขา *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="เช่น BKK01"
                    maxLength={10}
                    required
                  />
                  <p className="text-xs text-gray-500">ใช้ตัวอักษรภาษาอังกฤษและตัวเลข</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">ที่อยู่ *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="02-123-4567"
                  required
                />
              </div>
            </div>

            {/* Operating Hours */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">เวลาทำการ</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openTime">เวลาเปิด</Label>
                  <Input
                    id="openTime"
                    type="time"
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="closeTime">เวลาปิด</Label>
                  <Input
                    id="closeTime"
                    type="time"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>วันเปิดทำการ</Label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.openDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Manager Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">ข้อมูลผู้จัดการ</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="managerName">ชื่อผู้จัดการ</Label>
                  <Input
                    id="managerName"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="managerPhone">เบอร์โทรผู้จัดการ</Label>
                  <Input
                    id="managerPhone"
                    value={formData.managerPhone}
                    onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lineGroupUrl">LINE Group URL</Label>
                <Input
                  id="lineGroupUrl"
                  value={formData.lineGroupUrl}
                  onChange={(e) => setFormData({ ...formData, lineGroupUrl: e.target.value })}
                  placeholder="https://line.me/R/..."
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive" className="font-normal">
                เปิดให้บริการ
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/branches">
            <Button type="button" variant="outline">
              <X className="h-4 w-4 mr-2" />
              ยกเลิก
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-red-500 hover:bg-red-600"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มสาขา'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
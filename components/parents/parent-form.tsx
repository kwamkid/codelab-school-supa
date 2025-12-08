'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Parent, Branch } from '@/types/models';
import { createParent, updateParent, checkParentPhoneExists } from '@/lib/services/parents';
import { getActiveBranches } from '@/lib/services/branches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { Loader2, Save, X } from 'lucide-react';
import Link from 'next/link';

interface ParentFormProps {
  parent?: Parent;
  isEdit?: boolean;
}

export default function ParentForm({ parent, isEdit = false }: ParentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [formData, setFormData] = useState({
    displayName: parent?.displayName || '',
    phone: parent?.phone || '',
    emergencyPhone: parent?.emergencyPhone || '',
    email: parent?.email || '',
    lineUserId: parent?.lineUserId || '',
    pictureUrl: parent?.pictureUrl || '',
    preferredBranchId: parent?.preferredBranchId || '',
    address: {
      houseNumber: parent?.address?.houseNumber || '',
      street: parent?.address?.street || '',
      subDistrict: parent?.address?.subDistrict || '',
      district: parent?.address?.district || '',
      province: parent?.address?.province || '',
      postalCode: parent?.address?.postalCode || '',
    }
  });

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const data = await getActiveBranches();
      setBranches(data);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.displayName || !formData.phone) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    // Validate phone format
    const phoneRegex = /^[0-9]{9,10}$/;
    const cleanPhone = formData.phone.replace(/-/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      toast.error('เบอร์โทรศัพท์ไม่ถูกต้อง');
      return;
    }

    // Validate emergency phone if provided
    if (formData.emergencyPhone) {
      const cleanEmergencyPhone = formData.emergencyPhone.replace(/-/g, '');
      if (!phoneRegex.test(cleanEmergencyPhone)) {
        toast.error('เบอร์โทรฉุกเฉินไม่ถูกต้อง');
        return;
      }
    }

    // Validate email format if provided
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('อีเมลไม่ถูกต้อง');
        return;
      }
    }

    // Validate address if any field is filled
    const hasAddressData = Object.values(formData.address).some(value => value.trim() !== '');
    if (hasAddressData) {
      if (!formData.address.houseNumber || !formData.address.subDistrict || 
          !formData.address.district || !formData.address.province) {
        toast.error('กรุณากรอกข้อมูลที่อยู่ให้ครบถ้วน (บ้านเลขที่, แขวง/ตำบล, เขต/อำเภอ, จังหวัด)');
        return;
      }
    }

    setLoading(true);

    try {
      // Check if phone already exists
      const phoneExists = await checkParentPhoneExists(
        cleanPhone,
        isEdit ? parent?.id : undefined
      );

      if (phoneExists) {
        toast.error('เบอร์โทรศัพท์นี้มีอยู่ในระบบแล้ว');
        setLoading(false);
        return;
      }

      const parentData: Omit<Parent, 'id' | 'createdAt' | 'lastLoginAt'> = {
        displayName: formData.displayName,
        phone: cleanPhone,
        ...(formData.emergencyPhone && { emergencyPhone: formData.emergencyPhone.replace(/-/g, '') }),
        ...(formData.email && { email: formData.email }),
        ...(formData.lineUserId && { lineUserId: formData.lineUserId }),
        ...(formData.pictureUrl && { pictureUrl: formData.pictureUrl }),
        ...(formData.preferredBranchId && { preferredBranchId: formData.preferredBranchId }),
        ...(hasAddressData && { address: formData.address }),
      };

      if (isEdit && parent?.id) {
        await updateParent(parent.id, parentData);
        toast.success('อัปเดตข้อมูลผู้ปกครองเรียบร้อยแล้ว');
        router.push(`/parents/${parent.id}`);
      } else {
        const newParentId = await createParent(parentData);
        toast.success('เพิ่มผู้ปกครองใหม่เรียบร้อยแล้ว');
        router.push(`/parents/${newParentId}`);
      }
    } catch (error) {
      console.error('Error saving parent:', error);
      toast.error(isEdit ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มผู้ปกครองได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลส่วนตัว</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">ชื่อ-นามสกุล *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                  required
                />
                <p className="text-xs text-gray-500">กรอกเบอร์โทร 9-10 หลัก</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">เบอร์โทรฉุกเฉิน</Label>
                <Input
                  id="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                />
                <p className="text-xs text-gray-500">กรณีติดต่อเบอร์หลักไม่ได้</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="parent@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle>ที่อยู่</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="houseNumber">บ้านเลขที่</Label>
                <Input
                  id="houseNumber"
                  value={formData.address.houseNumber}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, houseNumber: e.target.value }
                  })}
                  placeholder="123/45"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="street">ถนน</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, street: e.target.value }
                  })}
                  placeholder="ถนนสุขุมวิท"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subDistrict">แขวง/ตำบล</Label>
                <Input
                  id="subDistrict"
                  value={formData.address.subDistrict}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, subDistrict: e.target.value }
                  })}
                  placeholder="คลองเตย"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="district">เขต/อำเภอ</Label>
                <Input
                  id="district"
                  value={formData.address.district}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, district: e.target.value }
                  })}
                  placeholder="คลองเตย"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="province">จังหวัด</Label>
                <Input
                  id="province"
                  value={formData.address.province}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, province: e.target.value }
                  })}
                  placeholder="กรุงเทพมหานคร"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
                <Input
                  id="postalCode"
                  value={formData.address.postalCode}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, postalCode: e.target.value }
                  })}
                  placeholder="10110"
                  maxLength={5}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LINE Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูล LINE (ถ้ามี)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lineUserId">LINE User ID</Label>
                <Input
                  id="lineUserId"
                  value={formData.lineUserId}
                  onChange={(e) => setFormData({ ...formData, lineUserId: e.target.value })}
                  placeholder="U1234567890abcdef"
                />
                <p className="text-xs text-gray-500">จะได้มาเมื่อผู้ปกครองลงทะเบียนผ่าน LINE</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pictureUrl">รูปโปรไฟล์ URL</Label>
                <Input
                  id="pictureUrl"
                  value={formData.pictureUrl}
                  onChange={(e) => setFormData({ ...formData, pictureUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferred Branch */}
        <Card>
          <CardHeader>
            <CardTitle>สาขาที่สะดวก</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="preferredBranchId">สาขาหลัก</Label>
              <Select
                value={formData.preferredBranchId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, preferredBranchId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">สาขาที่ผู้ปกครองมาใช้บริการบ่อย</p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Link href="/parents">
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
                {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ปกครอง'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
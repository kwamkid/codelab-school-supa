'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Teacher, Branch, Subject } from '@/types/models';
import { createTeacher, updateTeacher, checkTeacherEmailExists } from '@/lib/services/teachers';
import { getActiveBranches } from '@/lib/services/branches';
import { getActiveSubjects } from '@/lib/services/subjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Save, X, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

interface TeacherFormProps {
  teacher?: Teacher;
  isEdit?: boolean;
}

export default function TeacherForm({ teacher, isEdit = false }: TeacherFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [formData, setFormData] = useState({
    name: teacher?.name || '',
    nickname: teacher?.nickname || '',
    email: teacher?.email || '',
    phone: teacher?.phone || '',
    password: '',
    lineUserId: teacher?.lineUserId || '',
    specialties: teacher?.specialties || [],
    availableBranches: teacher?.availableBranches || [],
    profileImage: teacher?.profileImage || '',
    hourlyRate: teacher?.hourlyRate || 0,
    bankAccount: teacher?.bankAccount || {
      bankName: '',
      accountNumber: '',
      accountName: '',
    },
    isActive: teacher?.isActive ?? true,
  });

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [branchesData, subjectsData] = await Promise.all([
        getActiveBranches(),
        getActiveSubjects()
      ]);
      setBranches(branchesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading options:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (!isEdit && !formData.password) {
      toast.error('กรุณากรอกรหัสผ่าน');
      return;
    }

    if (!isEdit && formData.password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (formData.specialties.length === 0) {
      toast.error('กรุณาเลือกวิชาที่สอนอย่างน้อย 1 วิชา');
      return;
    }

    if (formData.availableBranches.length === 0) {
      toast.error('กรุณาเลือกสาขาที่สอนอย่างน้อย 1 สาขา');
      return;
    }

    setLoading(true);

    try {
      // Check if email already exists
      const emailExists = await checkTeacherEmailExists(
        formData.email,
        isEdit ? teacher?.id : undefined
      );

      if (emailExists) {
        toast.error('อีเมลนี้มีอยู่ในระบบแล้ว');
        setLoading(false);
        return;
      }

      if (isEdit && teacher?.id) {
        await updateTeacher(teacher.id, formData);
        toast.success('อัปเดตข้อมูลครูเรียบร้อยแล้ว');
      } else {
        const teacherData = { ...formData };
        delete teacherData.password; // ลบ password ออกจาก teacherData
        await createTeacher(teacherData, formData.password);
        toast.success('เพิ่มครูใหม่เรียบร้อยแล้ว');
      }
      
      router.push('/teachers');
    } catch (error: any) {
      console.error('Error saving teacher:', error);
      
      // Handle specific errors
      if (error.message?.includes('already exists')) {
        toast.error('อีเมลนี้ถูกใช้งานแล้ว');
      } else if (error.message?.includes('Firebase Auth')) {
        toast.warning('อัปเดตข้อมูลเรียบร้อย แต่ยังไม่สามารถอัปเดต email สำหรับ login ได้');
        router.push('/teachers');
      } else {
        toast.error(isEdit ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มครูได้');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialtyToggle = (subjectId: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(subjectId)
        ? prev.specialties.filter(id => id !== subjectId)
        : [...prev.specialties, subjectId]
    }));
  };

  const handleBranchToggle = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      availableBranches: prev.availableBranches.includes(branchId)
        ? prev.availableBranches.filter(id => id !== branchId)
        : [...prev.availableBranches, branchId]
    }));
  };

  // Group subjects by category
  const subjectsByCategory = subjects.reduce((acc, subject) => {
    if (!acc[subject.category]) {
      acc[subject.category] = [];
    }
    acc[subject.category].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลส่วนตัว</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nickname">ชื่อเล่น</Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="ชื่อเล่น"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">อีเมล *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="teacher@example.com"
                  required
                />
                {isEdit && (
                  <p className="text-xs text-gray-500">
                    หากเปลี่ยน email ครูจะต้องใช้ email ใหม่ในการ login
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                  required
                />
              </div>
            </div>

            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  ครูจะใช้ email และ password นี้ในการ login
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="lineUserId">LINE User ID (สำหรับรับการแจ้งเตือน)</Label>
              <Input
                id="lineUserId"
                value={formData.lineUserId}
                onChange={(e) => setFormData({ ...formData, lineUserId: e.target.value })}
                placeholder="LINE User ID"
              />
            </div>
          </CardContent>
        </Card>

        {/* Teaching Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลการสอน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>วิชาที่สอน *</Label>
              <div className="space-y-4">
                {Object.entries(subjectsByCategory).map(([category, categorySubjects]) => (
                  <div key={category}>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">{category}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categorySubjects.map((subject) => (
                        <div key={subject.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`subject-${subject.id}`}
                            checked={formData.specialties.includes(subject.id)}
                            onCheckedChange={() => handleSpecialtyToggle(subject.id)}
                          />
                          <Label
                            htmlFor={`subject-${subject.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {subject.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>สาขาที่สอน *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={formData.availableBranches.includes(branch.id)}
                      onCheckedChange={() => handleBranchToggle(branch.id)}
                    />
                    <Label
                      htmlFor={`branch-${branch.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {branch.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourlyRate">ค่าสอนต่อชั่วโมง (บาท)</Label>
              <Input
                id="hourlyRate"
                type="number"
                min="0"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: parseInt(e.target.value) || 0 })}
                placeholder="500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bank Account */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลบัญชีธนาคาร</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">ธนาคาร</Label>
                <Input
                  id="bankName"
                  value={formData.bankAccount.bankName}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    bankAccount: { ...formData.bankAccount, bankName: e.target.value }
                  })}
                  placeholder="ชื่อธนาคาร"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountNumber">เลขบัญชี</Label>
                <Input
                  id="accountNumber"
                  value={formData.bankAccount.accountNumber}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    bankAccount: { ...formData.bankAccount, accountNumber: e.target.value }
                  })}
                  placeholder="xxx-x-xxxxx-x"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountName">ชื่อบัญชี</Label>
              <Input
                id="accountName"
                value={formData.bankAccount.accountName}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  bankAccount: { ...formData.bankAccount, accountName: e.target.value }
                })}
                placeholder="ชื่อ-นามสกุล ตามบัญชี"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>สถานะ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive" className="font-normal">
                พร้อมสอน
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Link href="/teachers">
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
                {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มครู'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
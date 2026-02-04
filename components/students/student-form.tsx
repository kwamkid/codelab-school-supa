'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Student } from '@/types/models';
import { createStudent, updateStudent } from '@/lib/services/parents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeLevelCombobox } from "@/components/ui/grade-level-combobox";
import { SchoolNameCombobox } from "@/components/ui/school-name-combobox";
import { toast } from 'sonner';
import { Loader2, Save, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface StudentFormProps {
  parentId: string;
  student?: Student;
  isEdit?: boolean;
}

export default function StudentForm({ parentId, student, isEdit = false }: StudentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: student?.name || '',
    nickname: student?.nickname || '',
    birthdate: student?.birthdate ? new Date(student.birthdate).toISOString().split('T')[0] : '',
    gender: student?.gender || 'M' as 'M' | 'F',
    schoolName: student?.schoolName || '',
    gradeLevel: student?.gradeLevel || '',
    profileImage: student?.profileImage || '',
    allergies: student?.allergies || '',
    specialNeeds: student?.specialNeeds || '',
    emergencyContact: student?.emergencyContact || '',
    emergencyPhone: student?.emergencyPhone || '',
    isActive: student?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name || !formData.birthdate || !formData.gender) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    // Validate age (must be between 4-18 years old)
    const birthDate = new Date(formData.birthdate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    if (age < 4 || age > 18) {
      toast.error('นักเรียนต้องมีอายุระหว่าง 4-18 ปี');
      return;
    }

    // Validate emergency phone if provided
    if (formData.emergencyPhone) {
      const phoneRegex = /^[0-9]{9,10}$/;
      const cleanPhone = formData.emergencyPhone.replace(/-/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        toast.error('เบอร์โทรฉุกเฉินไม่ถูกต้อง');
        return;
      }
    }

    setLoading(true);

    try {
      const studentData: Omit<Student, 'id' | 'parentId'> = {
        name: formData.name,
        nickname: formData.nickname,
        birthdate: new Date(formData.birthdate),
        gender: formData.gender,
        isActive: formData.isActive,
        ...(formData.schoolName && { schoolName: formData.schoolName }),
        ...(formData.gradeLevel && { gradeLevel: formData.gradeLevel }),
        ...(formData.profileImage && { profileImage: formData.profileImage }),
        ...(formData.allergies && { allergies: formData.allergies }),
        ...(formData.specialNeeds && { specialNeeds: formData.specialNeeds }),
        ...(formData.emergencyContact && { emergencyContact: formData.emergencyContact }),
        ...(formData.emergencyPhone && { emergencyPhone: formData.emergencyPhone.replace(/-/g, '') }),
      };

      if (isEdit && student?.id) {
        await updateStudent(parentId, student.id, studentData);
        toast.success('อัปเดตข้อมูลนักเรียนเรียบร้อยแล้ว');
      } else {
        await createStudent(parentId, studentData);
        toast.success('เพิ่มนักเรียนใหม่เรียบร้อยแล้ว');
      }
      
      router.push(`/parents/${parentId}`);
    } catch (error) {
      console.error('Error saving student:', error);
      toast.error(isEdit ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มนักเรียนได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลพื้นฐาน</CardTitle>
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
                <Label htmlFor="birthdate">วันเกิด *</Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500">นักเรียนต้องมีอายุ 4-18 ปี</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gender">เพศ *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value as 'M' | 'F' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">ชาย</SelectItem>
                    <SelectItem value="F">หญิง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileImage">รูปโปรไฟล์ URL</Label>
              <Input
                id="profileImage"
                value={formData.profileImage}
                onChange={(e) => setFormData({ ...formData, profileImage: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* School Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลการศึกษา</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">โรงเรียน</Label>
              <SchoolNameCombobox
                value={formData.schoolName}
                onChange={(value) => setFormData({ ...formData, schoolName: value })}
                placeholder="พิมพ์ชื่อโรงเรียน..."
              />
              <p className="text-xs text-gray-500">
                เลือกจากรายชื่อที่มี หรือพิมพ์ชื่อใหม่
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gradeLevel">ระดับชั้น</Label>
              <GradeLevelCombobox
                value={formData.gradeLevel}
                onChange={(value) => setFormData({ ...formData, gradeLevel: value })}
                placeholder="พิมพ์ระดับชั้น เช่น ป.4, Grade 3..."
              />
              <p className="text-xs text-gray-500">
                เริ่มพิมพ์เพื่อค้นหา เช่น "ป", "ประถม", "Grade", "Year"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Health & Special Needs */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลสุขภาพและความต้องการพิเศษ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allergies">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  ข้อมูลการแพ้อาหาร/ยา
                </div>
              </Label>
              <Textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="ระบุอาหารหรือยาที่แพ้ (ถ้ามี)"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="specialNeeds">ความต้องการพิเศษ</Label>
              <Textarea
                id="specialNeeds"
                value={formData.specialNeeds}
                onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                placeholder="ระบุความต้องการพิเศษ (ถ้ามี)"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle>ผู้ติดต่อฉุกเฉิน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">ชื่อผู้ติดต่อฉุกเฉิน</Label>
                <Input
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">เบอร์โทรฉุกเฉิน</Label>
                <Input
                  id="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        {isEdit && (
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
                  ใช้งาน
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Link href={`/parents/${parentId}`}>
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
                {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
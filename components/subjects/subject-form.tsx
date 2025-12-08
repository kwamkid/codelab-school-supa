'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Subject } from '@/types/models';
import { createSubject, updateSubject, checkSubjectCodeExists } from '@/lib/services/subjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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

interface SubjectFormProps {
  subject?: Subject;
  isEdit?: boolean;
}

const CATEGORIES = [
  { value: 'Coding', label: 'Coding' },
  { value: 'Robotics', label: 'Robotics' },
  { value: 'AI', label: 'AI' },
  { value: 'Other', label: 'อื่นๆ' },
];

const LEVELS = [
  { value: 'Beginner', label: 'เริ่มต้น (Beginner)' },
  { value: 'Intermediate', label: 'ปานกลาง (Intermediate)' },
  { value: 'Advanced', label: 'ขั้นสูง (Advanced)' },
];

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

export default function SubjectForm({ subject, isEdit = false }: SubjectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: subject?.name || '',
    code: subject?.code || '',
    description: subject?.description || '',
    category: subject?.category || 'Coding',
    level: subject?.level || 'Beginner',
    ageRange: {
      min: subject?.ageRange?.min || 6,
      max: subject?.ageRange?.max || 12,
    },
    color: subject?.color || '#ef4444',
    icon: subject?.icon || '',
    prerequisites: subject?.prerequisites || [],
    isActive: subject?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name || !formData.code || !formData.description) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (formData.ageRange.min > formData.ageRange.max) {
      toast.error('ช่วงอายุไม่ถูกต้อง');
      return;
    }

    setLoading(true);

    try {
      // Check if subject code already exists
      const codeExists = await checkSubjectCodeExists(
        formData.code,
        isEdit ? subject?.id : undefined
      );

      if (codeExists) {
        toast.error('รหัสวิชานี้มีอยู่แล้ว');
        setLoading(false);
        return;
      }

      if (isEdit && subject?.id) {
        await updateSubject(subject.id, formData);
        toast.success('อัปเดตข้อมูลวิชาเรียบร้อยแล้ว');
      } else {
        await createSubject(formData);
        toast.success('เพิ่มวิชาใหม่เรียบร้อยแล้ว');
      }
      
      router.push('/subjects');
    } catch (error) {
      console.error('Error saving subject:', error);
      toast.error(isEdit ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มวิชาได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? 'แก้ไขข้อมูลวิชา' : 'เพิ่มวิชาใหม่'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">ข้อมูลพื้นฐาน</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">ชื่อวิชา *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น Python Programming"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="code">รหัสวิชา *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="เช่น PY101"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">คำอธิบายวิชา *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="อธิบายรายละเอียดของวิชา เนื้อหาที่จะเรียน และสิ่งที่นักเรียนจะได้รับ"
                  rows={4}
                  required
                />
              </div>
            </div>

            {/* Category and Level */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">หมวดหมู่และระดับ</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">หมวดหมู่ *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value as Subject['category'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="level">ระดับความยาก *</Label>
                  <Select
                    value={formData.level}
                    onValueChange={(value) => setFormData({ ...formData, level: value as Subject['level'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((lvl) => (
                        <SelectItem key={lvl.value} value={lvl.value}>
                          {lvl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ageMin">อายุต่ำสุด (ปี) *</Label>
                  <Input
                    id="ageMin"
                    type="number"
                    min="4"
                    max="18"
                    value={formData.ageRange.min}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      ageRange: { ...formData.ageRange, min: parseInt(e.target.value) || 4 }
                    })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ageMax">อายุสูงสุด (ปี) *</Label>
                  <Input
                    id="ageMax"
                    type="number"
                    min="4"
                    max="18"
                    value={formData.ageRange.max}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      ageRange: { ...formData.ageRange, max: parseInt(e.target.value) || 18 }
                    })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Visual Settings */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">การแสดงผล</h3>
              
              <div className="space-y-2">
                <Label>สีประจำวิชา</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
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
                เปิดให้ลงทะเบียน
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/subjects">
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
                {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มวิชา'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
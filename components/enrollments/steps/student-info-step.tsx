'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { StepProps, StudentFormData, DEFAULT_STUDENT } from '../enrollment-types';
import { getStudentsByParent } from '@/lib/services/parents';
import { Student } from '@/types/models';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { calculateAge } from '@/lib/utils';

export default function StudentInfoStep({ formData, setFormData, onNext, onBack }: StepProps) {
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (formData.existingParentId) {
      loadExistingStudents();
    }
  }, [formData.existingParentId]);

  const loadExistingStudents = async () => {
    if (!formData.existingParentId) return;
    try {
      const students = await getStudentsByParent(formData.existingParentId);
      setExistingStudents(students);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const updateStudent = (index: number, updates: Partial<StudentFormData>) => {
    setFormData(prev => ({
      ...prev,
      students: prev.students.map((s, i) =>
        i === index ? { ...s, ...updates } : s
      ),
    }));
  };

  const selectExistingStudent = (index: number, student: Student) => {
    updateStudent(index, {
      mode: 'existing',
      existingStudentId: student.id,
      name: student.name,
      nickname: student.nickname,
      birthdate: student.birthdate instanceof Date
        ? student.birthdate.toISOString().split('T')[0]
        : new Date(student.birthdate).toISOString().split('T')[0],
      gender: student.gender,
      schoolName: student.schoolName || '',
      gradeLevel: student.gradeLevel || '',
      allergies: student.allergies || '',
      specialNeeds: student.specialNeeds || '',
    });
  };

  const addStudent = () => {
    setFormData(prev => ({
      ...prev,
      students: [...prev.students, { ...DEFAULT_STUDENT }],
    }));
  };

  const removeStudent = (index: number) => {
    if (formData.students.length <= 1) {
      toast.error('ต้องมีนักเรียนอย่างน้อย 1 คน');
      return;
    }
    setFormData(prev => ({
      ...prev,
      students: prev.students.filter((_, i) => i !== index),
    }));
  };

  const validate = (): boolean => {
    for (let i = 0; i < formData.students.length; i++) {
      const s = formData.students[i];
      if (s.mode === 'existing' && s.existingStudentId) continue;

      if (!s.name.trim()) {
        toast.error(`กรุณากรอกชื่อนักเรียนคนที่ ${i + 1}`);
        return false;
      }
      if (!s.nickname.trim()) {
        toast.error(`กรุณากรอกชื่อเล่นนักเรียนคนที่ ${i + 1}`);
        return false;
      }
      if (!s.birthdate) {
        toast.error(`กรุณาเลือกวันเกิดนักเรียนคนที่ ${i + 1}`);
        return false;
      }

      const age = calculateAge(new Date(s.birthdate));
      if (age < 3 || age > 20) {
        toast.error(`อายุนักเรียนคนที่ ${i + 1} ไม่อยู่ในช่วงที่รองรับ (3-20 ปี)`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">ข้อมูลนักเรียน</h2>
        <Button variant="outline" onClick={addStudent} className="text-base">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มนักเรียน
        </Button>
      </div>

      {formData.students.map((student, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">
                นักเรียนคนที่ {index + 1}
                {student.mode === 'existing' && (
                  <Badge variant="secondary" className="ml-2 text-sm">ข้อมูลเดิม</Badge>
                )}
              </CardTitle>
              {formData.students.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStudent(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Select existing student if parent exists */}
            {existingStudents.length > 0 && student.mode === 'new' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-base font-medium text-blue-700 mb-2">
                  <UserCheck className="h-4 w-4 inline mr-1" />
                  เลือกนักเรียนที่มีอยู่แล้ว
                </p>
                <div className="flex flex-wrap gap-2">
                  {existingStudents
                    .filter(es => !formData.students.some(
                      (s, i) => i !== index && s.existingStudentId === es.id
                    ))
                    .map(es => (
                      <Button
                        key={es.id}
                        variant="outline"
                        size="sm"
                        className="text-base"
                        onClick={() => selectExistingStudent(index, es)}
                      >
                        {es.nickname} ({es.name})
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {student.mode === 'existing' && (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-base text-green-700">
                  ใช้ข้อมูลของ <strong>{student.nickname}</strong> ({student.name})
                  {student.birthdate && ` - อายุ ${calculateAge(new Date(student.birthdate))} ปี`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateStudent(index, { mode: 'new', existingStudentId: undefined })}
                  className="text-base"
                >
                  เปลี่ยน
                </Button>
              </div>
            )}

            {student.mode === 'new' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-base">ชื่อ-นามสกุล *</Label>
                  <Input
                    value={student.name}
                    onChange={e => updateStudent(index, { name: e.target.value })}
                    placeholder="ชื่อ นามสกุล"
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base">ชื่อเล่น *</Label>
                  <Input
                    value={student.nickname}
                    onChange={e => updateStudent(index, { nickname: e.target.value })}
                    placeholder="ชื่อเล่น"
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base">วันเกิด *</Label>
                  <DateRangePicker
                    mode="single"
                    value={student.birthdate || undefined}
                    onChange={(date) => updateStudent(index, { birthdate: date || '' })}
                    maxDate={new Date()}
                    placeholder="เลือกวันเกิด"
                  />
                  {student.birthdate && (
                    <p className="text-sm text-gray-500 mt-1">
                      อายุ {calculateAge(new Date(student.birthdate))} ปี
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-base">เพศ *</Label>
                  <Select
                    value={student.gender}
                    onValueChange={v => updateStudent(index, { gender: v as 'M' | 'F' })}
                  >
                    <SelectTrigger className="text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M" className="text-base">ชาย</SelectItem>
                      <SelectItem value="F" className="text-base">หญิง</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base">โรงเรียน</Label>
                  <Input
                    value={student.schoolName}
                    onChange={e => updateStudent(index, { schoolName: e.target.value })}
                    placeholder="ชื่อโรงเรียน"
                    className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-base">ระดับชั้น</Label>
                  <Input
                    value={student.gradeLevel}
                    onChange={e => updateStudent(index, { gradeLevel: e.target.value })}
                    placeholder="ป.1, ม.1"
                    className="text-base"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-base">ประวัติการแพ้</Label>
                  <Input
                    value={student.allergies}
                    onChange={e => updateStudent(index, { allergies: e.target.value })}
                    placeholder="อาหาร ยา หรืออื่นๆ ที่แพ้"
                    className="text-base"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-base">ความต้องการพิเศษ</Label>
                  <Input
                    value={student.specialNeeds}
                    onChange={e => updateStudent(index, { specialNeeds: e.target.value })}
                    placeholder="ถ้ามี"
                    className="text-base"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="text-base">
          <ChevronLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>
        <Button onClick={handleNext} className="bg-red-500 hover:bg-red-600 text-base">
          ถัดไป
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

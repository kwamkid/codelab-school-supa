'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { GradeLevelCombobox } from '@/components/ui/grade-level-combobox';
import { LiffProvider, useLiff } from '@/components/liff/liff-provider';
import { createParent, createStudent, getParentByLineId, checkParentPhoneExists } from '@/lib/services/parents';
import { toast } from 'sonner';
import { Loader2, CheckCircle, User, GraduationCap } from 'lucide-react';

function LiffRegisterContent() {
  const router = useRouter();
  const { profile, isLoggedIn, isLoading: liffLoading } = useLiff();
  const submitGuardRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Existing parent (found by LINE ID)
  const [existingParentId, setExistingParentId] = useState<string | null>(null);

  // Parent fields
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Student fields
  const [studentName, setStudentName] = useState('');
  const [studentNickname, setStudentNickname] = useState('');
  const [studentBirthdate, setStudentBirthdate] = useState('');
  const [studentGender, setStudentGender] = useState<'M' | 'F'>('M');
  const [studentSchoolName, setStudentSchoolName] = useState('');
  const [studentGradeLevel, setStudentGradeLevel] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if parent already registered via LINE → pre-fill info
  useEffect(() => {
    if (liffLoading) return;

    if (!isLoggedIn || !profile?.userId) {
      // Not in LINE or not logged in — just show the form
      setLoading(false);
      return;
    }

    getParentByLineId(profile.userId)
      .then((parent) => {
        if (parent) {
          setExistingParentId(parent.id);
          setParentName(parent.displayName || '');
          setParentPhone(parent.phone || '');
        } else if (profile.displayName) {
          setParentName(profile.displayName);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [liffLoading, isLoggedIn, profile?.userId]);

  const clearError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const errCls = (key: string) => (errors[key] ? 'border-red-500 ring-1 ring-red-500' : '');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!existingParentId) {
      if (!parentName.trim()) newErrors.parentName = 'กรุณากรอกชื่อผู้ปกครอง';
      if (!parentPhone.trim()) newErrors.parentPhone = 'กรุณากรอกเบอร์โทรศัพท์';
    }
    if (!studentName.trim()) newErrors.studentName = 'กรุณากรอกชื่อนักเรียน';
    if (!studentNickname.trim()) newErrors.studentNickname = 'กรุณากรอกชื่อเล่น';
    if (!studentBirthdate) newErrors.studentBirthdate = 'กรุณาเลือกวันเกิด';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErr = Object.values(newErrors)[0];
      if (firstErr) toast.error(firstErr);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitGuardRef.current) return;
    if (!validate()) return;

    submitGuardRef.current = true;
    setSubmitting(true);

    try {
      let parentId = existingParentId;

      if (!parentId) {
        // New parent — check phone duplicate
        const phoneExists = await checkParentPhoneExists(parentPhone.replace(/[-\s]/g, ''));
        if (phoneExists) {
          toast.error('เบอร์โทรศัพท์นี้ถูกลงทะเบียนแล้ว กรุณาติดต่อสถาบัน');
          return;
        }

        parentId = await createParent({
          displayName: parentName.trim(),
          phone: parentPhone.replace(/[-\s]/g, ''),
          lineUserId: profile?.userId || null,
          email: null,
        });
      }

      // Create student
      await createStudent(parentId, {
        name: studentName.trim(),
        nickname: studentNickname.trim(),
        birthdate: new Date(studentBirthdate),
        gender: studentGender,
        schoolName: studentSchoolName.trim() || '',
        gradeLevel: studentGradeLevel.trim() || '',
        isActive: true,
        allergies: '',
        specialNeeds: '',
        emergencyContact: '',
        emergencyPhone: '',
        profileImage: '',
      });

      setShowSuccess(true);
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('เกิดข้อผิดพลาดในการลงทะเบียน');
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  };

  // Success screen
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">ลงทะเบียนสำเร็จ!</h2>
        <p className="text-gray-600 mb-6">ทางสถาบันจะติดต่อกลับเพื่อยืนยันรายละเอียดและจัดคลาสเรียนให้</p>
        <Button
          onClick={() => router.push('/liff/profile')}
          className="bg-green-500 hover:bg-green-600"
        >
          ไปหน้าโปรไฟล์
        </Button>
      </div>
    );
  }

  if (loading || liffLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">ลงทะเบียนนักเรียน</h1>
        <p className="text-base text-gray-500">กรอกข้อมูลเพื่อลงทะเบียน ทางสถาบันจะจัดคลาสเรียนให้ภายหลัง</p>

        {/* Parent Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              ผู้ปกครอง
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {existingParentId ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <User className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-base">{parentName}</p>
                  <p className="text-sm text-gray-500">{parentPhone}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-base">ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                  <Input
                    value={parentName}
                    onChange={(e) => { setParentName(e.target.value); clearError('parentName'); }}
                    placeholder="ชื่อ-นามสกุลผู้ปกครอง"
                    className={errCls('parentName')}
                  />
                  {errors.parentName && <p className="text-sm text-red-500">{errors.parentName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-base">เบอร์โทรศัพท์ <span className="text-red-500">*</span></Label>
                  <Input
                    value={parentPhone}
                    onChange={(e) => { setParentPhone(e.target.value); clearError('parentPhone'); }}
                    placeholder="08x-xxx-xxxx"
                    type="tel"
                    className={errCls('parentPhone')}
                  />
                  {errors.parentPhone && <p className="text-sm text-red-500">{errors.parentPhone}</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Student Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              นักเรียน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-base">ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
              <Input
                value={studentName}
                onChange={(e) => { setStudentName(e.target.value); clearError('studentName'); }}
                placeholder="ชื่อ-นามสกุลนักเรียน"
                className={errCls('studentName')}
              />
              {errors.studentName && <p className="text-sm text-red-500">{errors.studentName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-base">ชื่อเล่น <span className="text-red-500">*</span></Label>
              <Input
                value={studentNickname}
                onChange={(e) => { setStudentNickname(e.target.value); clearError('studentNickname'); }}
                placeholder="ชื่อเล่น"
                className={errCls('studentNickname')}
              />
              {errors.studentNickname && <p className="text-sm text-red-500">{errors.studentNickname}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-base">วันเกิด <span className="text-red-500">*</span></Label>
                <DateRangePicker
                  mode="single"
                  value={studentBirthdate}
                  onChange={(d) => { setStudentBirthdate(d || ''); clearError('studentBirthdate'); }}
                  maxDate={new Date()}
                  placeholder="เลือกวันที่"
                />
                {errors.studentBirthdate && <p className="text-sm text-red-500">{errors.studentBirthdate}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-base">เพศ <span className="text-red-500">*</span></Label>
                <FormSelect
                  value={studentGender}
                  onValueChange={(v) => setStudentGender(v as 'M' | 'F')}
                  options={[{ value: 'M', label: 'ชาย' }, { value: 'F', label: 'หญิง' }]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-base">โรงเรียน</Label>
              <SchoolNameCombobox
                value={studentSchoolName}
                onChange={setStudentSchoolName}
                placeholder="พิมพ์ชื่อโรงเรียน (ไม่บังคับ)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base">ระดับชั้น</Label>
              <GradeLevelCombobox
                value={studentGradeLevel}
                onChange={setStudentGradeLevel}
                placeholder="เลือกหรือพิมพ์ระดับชั้น..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-green-500 hover:bg-green-600"
          size="lg"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังลงทะเบียน...</>
          ) : (
            'ลงทะเบียน'
          )}
        </Button>
      </div>
    </div>
  );
}

export default function LiffRegisterPage() {
  return (
    <LiffProvider>
      <LiffRegisterContent />
    </LiffProvider>
  );
}

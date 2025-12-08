'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/components/liff/liff-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeLevelCombobox } from "@/components/ui/grade-level-combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Plus, 
  X,
  School,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { getActiveBranches } from '@/lib/services/branches';
import { Branch } from '@/types/models';
import { LiffProvider } from '@/components/liff/liff-provider';
import { getClient } from '@/lib/supabase/client';

interface StudentFormData {
  name: string;
  nickname: string;
  birthdate: string;
  gender: 'M' | 'F';
  schoolName: string;
  gradeLevel: string;
  allergies: string;
  specialNeeds: string;
}

function RegisterContent() {
  const router = useRouter();
  const { profile, isLoggedIn, isLoading, liff } = useLiff();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isReady, setIsReady] = useState(false);
  
  // Parent data
  const [parentData, setParentData] = useState({
    displayName: '',
    phone: '',
    emergencyPhone: '',
    email: '',
    preferredBranchId: '',
    address: {
      houseNumber: '',
      street: '',
      subDistrict: '',
      district: '',
      province: '',
      postalCode: '',
    }
  });

  // Students data
  const [students, setStudents] = useState<StudentFormData[]>([{
    name: '',
    nickname: '',
    birthdate: '',
    gender: 'M' as const,
    schoolName: '',
    gradeLevel: '',
    allergies: '',
    specialNeeds: '',
  }]);

  // Set initial display name from LINE profile
  useEffect(() => {
    if (profile?.displayName && !parentData.displayName) {
      setParentData(prev => ({
        ...prev,
        displayName: profile.displayName
      }));
    }
  }, [profile]);

  // Load branches
  useEffect(() => {
    getActiveBranches().then(setBranches).catch(console.error);
  }, []);

  // Check auth status
  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn && liff) {
        console.log('[RegisterContent] Not logged in, redirecting...');
        liff.login();
      } else if (isLoggedIn) {
        setIsReady(true);
      }
    }
  }, [isLoading, isLoggedIn, liff]);

  // Show loading while checking auth
  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  const handleParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!parentData.phone || parentData.phone.length < 9) {
      toast.error('กรุณากรอกเบอร์โทรให้ถูกต้อง');
      return;
    }

    // Go to student step
    setCurrentStep(2);
  };

  const handleAddStudent = () => {
    setStudents([...students, {
      name: '',
      nickname: '',
      birthdate: '',
      gender: 'M',
      schoolName: '',
      gradeLevel: '',
      allergies: '',
      specialNeeds: '',
    }]);
  };

  const handleRemoveStudent = (index: number) => {
    if (students.length > 1) {
      setStudents(students.filter((_, i) => i !== index));
    }
  };

  const handleStudentChange = (index: number, field: keyof StudentFormData, value: string) => {
    const updatedStudents = [...students];
    updatedStudents[index] = {
      ...updatedStudents[index],
      [field]: value
    };
    setStudents(updatedStudents);
  };

  const handleFinalSubmit = async () => {
    // Validate at least one student
    const validStudents = students.filter(s => s.name && s.birthdate);
    if (validStudents.length === 0) {
      toast.error('กรุณากรอกข้อมูลนักเรียนอย่างน้อย 1 คน');
      return;
    }

    setLoading(true);
    
    try {
      console.log('[Register] Starting registration...');
      console.log('[Register] Profile:', profile);
      console.log('[Register] Parent data:', parentData);
      console.log('[Register] Students:', validStudents);
      
      // Check if LINE ID already used
      if (profile?.userId) {
        console.log('[Register] Checking if LINE ID exists...');
        const supabase = getClient();
        const { data: existingParent } = await supabase
          .from('parents')
          .select('id')
          .eq('line_user_id', profile.userId)
          .single();

        if (existingParent) {
          console.log('[Register] LINE ID already exists');
          toast.error('LINE account นี้ถูกใช้งานแล้ว');
          setLoading(false);
          return;
        }
      }

      // Create parent with Supabase
      console.log('[Register] Creating parent...');
      const supabase = getClient();
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          display_name: parentData.displayName,
          phone: parentData.phone,
          emergency_phone: parentData.emergencyPhone || null,
          email: parentData.email || null,
          preferred_branch_id: parentData.preferredBranchId || null,
          address_house_number: parentData.address.houseNumber || null,
          address_street: parentData.address.street || null,
          address_sub_district: parentData.address.subDistrict || null,
          address_district: parentData.address.district || null,
          address_province: parentData.address.province || null,
          address_postal_code: parentData.address.postalCode || null,
          line_user_id: profile?.userId || null,
          picture_url: profile?.pictureUrl || null,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (parentError) throw parentError;
      const parentId = newParent.id;
      console.log('[Register] Parent created with ID:', parentId);

      // Create students
      console.log('[Register] Creating students...');
      const studentsToInsert = validStudents.map(student => ({
        name: student.name,
        nickname: student.nickname,
        birthdate: student.birthdate,
        gender: student.gender,
        school_name: student.schoolName || null,
        grade_level: student.gradeLevel || null,
        allergies: student.allergies || null,
        special_needs: student.specialNeeds || null,
        is_active: true,
        parent_id: parentId
      }));

      const { error: studentsError } = await supabase
        .from('students')
        .insert(studentsToInsert);

      if (studentsError) throw studentsError;

      console.log('[Register] Registration completed successfully!');
      toast.success('ลงทะเบียนสำเร็จ!');
      
      // Clear cache and redirect
      setTimeout(() => {
        router.push('/liff');
      }, 1000);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // แสดง error ที่ละเอียดขึ้น
      if (error.message) {
        toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
      } else {
        toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Progress Bar */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex">
          <div className={`flex-1 h-1 transition-all ${currentStep >= 1 ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 transition-all ${currentStep >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 transition-all ${currentStep >= 3 ? 'bg-primary' : 'bg-gray-200'}`} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white p-4 border-b flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : router.push('/liff')}
          className="p-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ลงทะเบียนผู้ปกครอง</h1>
          <p className="text-sm text-gray-600">
            ขั้นตอนที่ {currentStep} จาก 3
          </p>
        </div>
      </div>

      {/* Step 1: Parent Info */}
      {currentStep === 1 && (
        <form onSubmit={handleParentSubmit} className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                ข้อมูลผู้ปกครอง
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>ชื่อ-นามสกุล *</Label>
                <Input
                  value={parentData.displayName}
                  onChange={(e) => setParentData({...parentData, displayName: e.target.value})}
                  required
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>เบอร์โทรหลัก *</Label>
                  <Input
                    type="tel"
                    placeholder="0812345678"
                    value={parentData.phone}
                    onChange={(e) => setParentData({...parentData, phone: e.target.value})}
                    maxLength={10}
                    required
                  />
                </div>
                <div>
                  <Label>เบอร์ฉุกเฉิน</Label>
                  <Input
                    type="tel"
                    placeholder="0812345678"
                    value={parentData.emergencyPhone}
                    onChange={(e) => setParentData({...parentData, emergencyPhone: e.target.value})}
                    maxLength={10}
                  />
                </div>
              </div>
              
              <div>
                <Label>อีเมล</Label>
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={parentData.email}
                  onChange={(e) => setParentData({...parentData, email: e.target.value})}
                />
              </div>
              
              <div>
                <Label>สาขาที่สะดวก</Label>
                <Select
                  value={parentData.preferredBranchId}
                  onValueChange={(value) => setParentData({...parentData, preferredBranchId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-400" />
                ที่อยู่ (ไม่บังคับ)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>บ้านเลขที่</Label>
                  <Input
                    value={parentData.address.houseNumber}
                    onChange={(e) => setParentData({
                      ...parentData,
                      address: {...parentData.address, houseNumber: e.target.value}
                    })}
                    placeholder="123/45"
                  />
                </div>
                <div>
                  <Label>ถนน</Label>
                  <Input
                    value={parentData.address.street}
                    onChange={(e) => setParentData({
                      ...parentData,
                      address: {...parentData.address, street: e.target.value}
                    })}
                    placeholder="สุขุมวิท"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>แขวง/ตำบล</Label>
                  <Input
                    value={parentData.address.subDistrict}
                    onChange={(e) => setParentData({
                      ...parentData,
                      address: {...parentData.address, subDistrict: e.target.value}
                    })}
                    placeholder="คลองตัน"
                  />
                </div>
                <div>
                  <Label>เขต/อำเภอ</Label>
                  <Input
                    value={parentData.address.district}
                    onChange={(e) => setParentData({
                      ...parentData,
                      address: {...parentData.address, district: e.target.value}
                    })}
                    placeholder="คลองเตย"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>จังหวัด</Label>
                  <Input
                    value={parentData.address.province}
                    onChange={(e) => setParentData({
                      ...parentData,
                      address: {...parentData.address, province: e.target.value}
                    })}
                    placeholder="กรุงเทพมหานคร"
                  />
                </div>
                <div>
                  <Label>รหัสไปรษณีย์</Label>
                  <Input
                    maxLength={5}
                    value={parentData.address.postalCode}
                    onChange={(e) => setParentData({
                      ...parentData,
                      address: {...parentData.address, postalCode: e.target.value}
                    })}
                    placeholder="10110"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg">
            ถัดไป
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </form>
      )}

      {/* Step 2: Student Info */}
      {currentStep === 2 && (
        <div className="p-4 space-y-4">
          <div className="space-y-4">
            {students.map((student, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-5 w-5 text-gray-400" />
                      นักเรียนคนที่ {index + 1}
                    </CardTitle>
                    {students.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStudent(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>ชื่อ-นามสกุล *</Label>
                      <Input
                        value={student.name}
                        onChange={(e) => handleStudentChange(index, 'name', e.target.value)}
                        placeholder="ชื่อ-นามสกุลนักเรียน"
                        required
                      />
                    </div>
                    <div>
                      <Label>ชื่อเล่น *</Label>
                      <Input
                        value={student.nickname}
                        onChange={(e) => handleStudentChange(index, 'nickname', e.target.value)}
                        placeholder="ชื่อเล่น"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>วันเกิด *</Label>
                      <Input
                        type="date"
                        value={student.birthdate}
                        onChange={(e) => handleStudentChange(index, 'birthdate', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>เพศ *</Label>
                      <Select
                        value={student.gender}
                        onValueChange={(value) => handleStudentChange(index, 'gender', value as 'M' | 'F')}
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
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>โรงเรียน</Label>
                      <Input
                        value={student.schoolName}
                        onChange={(e) => handleStudentChange(index, 'schoolName', e.target.value)}
                        placeholder="ชื่อโรงเรียน"
                      />
                    </div>
                    <div>
                      <Label>ระดับชั้น</Label>
                      <GradeLevelCombobox
                        value={student.gradeLevel}
                        onChange={(value) => handleStudentChange(index, 'gradeLevel', value)}
                        placeholder="เลือกระดับชั้น..."
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>ประวัติการแพ้อาหาร/ยา</Label>
                    <Textarea
                      rows={2}
                      value={student.allergies}
                      onChange={(e) => handleStudentChange(index, 'allergies', e.target.value)}
                      placeholder="ระบุอาหารหรือยาที่แพ้ (ถ้ามี)"
                      className="resize-none"
                    />
                  </div>
                  
                  <div>
                    <Label>ความต้องการพิเศษ</Label>
                    <Textarea
                      rows={2}
                      value={student.specialNeeds}
                      onChange={(e) => handleStudentChange(index, 'specialNeeds', e.target.value)}
                      placeholder="ระบุความต้องการพิเศษ (ถ้ามี)"
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleAddStudent}
          >
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มนักเรียน
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(1)}
            >
              ย้อนกลับ
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                const validStudents = students.filter(s => s.name && s.birthdate);
                if (validStudents.length === 0) {
                  toast.error('กรุณากรอกข้อมูลนักเรียนอย่างน้อย 1 คน');
                  return;
                }
                setCurrentStep(3);
              }}
            >
              ถัดไป
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {currentStep === 3 && (
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                สรุปข้อมูลการลงทะเบียน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">ข้อมูลผู้ปกครอง</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <p><span className="text-gray-600">ชื่อ:</span> {parentData.displayName}</p>
                  <p><span className="text-gray-600">เบอร์โทร:</span> {parentData.phone}</p>
                  {parentData.email && (
                    <p><span className="text-gray-600">อีเมล:</span> {parentData.email}</p>
                  )}
                  {parentData.preferredBranchId && branches.find(b => b.id === parentData.preferredBranchId) && (
                    <p><span className="text-gray-600">สาขา:</span> {branches.find(b => b.id === parentData.preferredBranchId)?.name}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  ข้อมูลนักเรียน ({students.filter(s => s.name).length} คน)
                </h3>
                <div className="space-y-2">
                  {students.filter(s => s.name).map((student, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p className="font-medium flex items-center gap-2">
                        <School className="h-4 w-4 text-gray-400" />
                        {student.nickname || student.name}
                      </p>
                      <p className="text-gray-600 ml-6">
                        {student.name} • {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                        {student.gradeLevel && ` • ${student.gradeLevel}`}
                      </p>
                      {student.allergies && (
                        <Alert className="mt-2 py-2">
                          <AlertCircle className="h-3 w-3" />
                          <AlertDescription className="text-xs">
                            แพ้: {student.allergies}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              หลังจากลงทะเบียนเสร็จสิ้น คุณสามารถใช้งานระบบได้ทันที
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(2)}
              disabled={loading}
            >
              ย้อนกลับ
            </Button>
            <Button
              className="flex-1"
              onClick={handleFinalSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  ยืนยันการลงทะเบียน
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiffRegisterPage() {
  return (
    <LiffProvider requireLogin={true}>
      <RegisterContent />
    </LiffProvider>
  );
}
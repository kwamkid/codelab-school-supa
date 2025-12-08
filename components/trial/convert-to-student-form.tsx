// components/trial/convert-to-student-form.tsx

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  User,
  GraduationCap,
  Calendar,
  DollarSign,
  Tag,
  Info,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Baby,
  School,
  Heart,
  CheckCircle,
  Users,
  UserPlus,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { TrialBooking, TrialSession, Class, Subject, Parent, Student, Branch } from '@/types/models';
import { convertTrialToEnrollment } from '@/lib/services/trial-bookings';
import { getClasses } from '@/lib/services/classes';
import { getSubjects } from '@/lib/services/subjects';
import { getBranches } from '@/lib/services/branches';
import { getParentByPhone, getStudentsByParent } from '@/lib/services/parents';
import { formatCurrency, calculateAge } from '@/lib/utils';
import { GradeLevelCombobox } from '@/components/ui/grade-level-combobox';

interface ConvertToStudentFormProps {
  booking: TrialBooking;
  session: TrialSession;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  // Parent info
  useExistingParent: boolean;
  existingParentId?: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  emergencyPhone: string;
  address: {
    houseNumber: string;
    street: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
  };
  
  // Student selection
  studentSelection: 'existing' | 'new';
  selectedExistingStudentId?: string;
  useExistingStudent?: boolean;
  
  // New student info
  studentName: string;
  studentNickname: string;
  studentBirthdate: string;
  studentGender: 'M' | 'F';
  studentSchoolName: string;
  studentGradeLevel: string;
  studentAllergies: string;
  studentSpecialNeeds: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  
  // Class selection
  selectedClass: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  promotionCode: string;
}

const steps = [
  { id: 1, name: 'ข้อมูลผู้ปกครอง', icon: User },
  { id: 2, name: 'ข้อมูลนักเรียน', icon: Baby },
  { id: 3, name: 'เลือกคลาสและราคา', icon: DollarSign },
];

export default function ConvertToStudentForm({
  booking,
  session,
  onSuccess,
  onCancel
}: ConvertToStudentFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [existingParent, setExistingParent] = useState<Parent | null>(null);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<string[]>([]);
  
  // Filter states
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  
  // Get student data from booking
  const bookingStudent = booking.students.find(s => s.name === session.studentName);
  
  // Form state - ดึงข้อมูลจาก booking มาใส่ default value
  const [formData, setFormData] = useState<FormData>({
    // Parent
    useExistingParent: false,
    parentName: booking.parentName,
    parentPhone: booking.parentPhone,
    parentEmail: booking.parentEmail || '',
    emergencyPhone: '',
    address: {
      houseNumber: '',
      street: '',
      subDistrict: '',
      district: '',
      province: '',
      postalCode: ''
    },
    
    // Student - ใช้ข้อมูลจาก booking
    studentSelection: 'new',
    studentName: session.studentName,
    studentNickname: '',
    // ดึงวันเกิดจาก booking ถ้ามี
    studentBirthdate: bookingStudent?.birthdate 
      ? new Date(bookingStudent.birthdate).toISOString().split('T')[0]
      : '',
    studentGender: 'M',
    studentSchoolName: bookingStudent?.schoolName || '',
    studentGradeLevel: bookingStudent?.gradeLevel || '',
    studentAllergies: '',
    studentSpecialNeeds: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    
    // Class
    selectedClass: '',
    discount: 5,
    discountType: 'percentage',
    promotionCode: 'TRIAL5'
  });
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Pricing calculation
  const [pricing, setPricing] = useState({
    originalPrice: 0,
    discountAmount: 0,
    finalPrice: 0
  });

  useEffect(() => {
    loadData();
    checkExistingParent();
  }, []);

  // Check for existing parent
  const checkExistingParent = async () => {
    setCheckingPhone(true);
    try {
      const cleanPhone = booking.parentPhone.replace(/[-\s]/g, '');
      const parent = await getParentByPhone(cleanPhone);
      
      if (parent) {
        setExistingParent(parent);
        setFormData(prev => ({
          ...prev,
          useExistingParent: true,
          existingParentId: parent.id,
          parentName: parent.displayName,
          parentEmail: parent.email || '',
          emergencyPhone: parent.emergencyPhone || '',
          address: parent.address ? {
            houseNumber: parent.address.houseNumber || '',
            street: parent.address.street || '',
            subDistrict: parent.address.subDistrict || '',
            district: parent.address.district || '',
            province: parent.address.province || '',
            postalCode: parent.address.postalCode || ''
          } : prev.address
        }));
        
        // Load existing students
        const students = await getStudentsByParent(parent.id);
        setExistingStudents(students.filter(s => s.isActive));
      }
    } catch (error) {
      console.error('Error checking parent:', error);
    } finally {
      setCheckingPhone(false);
    }
  };

  useEffect(() => {
    calculatePricing();
  }, [formData.selectedClass, formData.discount, formData.discountType]);

  const loadData = async () => {
    try {
      setLoadingClasses(true);
      const [classesData, subjectsData, branchesData] = await Promise.all([
        getClasses(),
        getSubjects(),
        getBranches()
      ]);
      
      setSubjects(subjectsData);
      setBranches(branchesData);
      
      const branchClasses = classesData.filter(cls => 
        cls.branchId === session.branchId &&
        (cls.status === 'published' || cls.status === 'started') &&
        cls.enrolledCount < cls.maxStudents
      );
      
      setClasses(branchClasses);
      
      // Check enrolled classes if using existing student
      if (formData.selectedExistingStudentId) {
        await checkEnrolledClasses(formData.selectedExistingStudentId);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลคลาสได้');
    } finally {
      setLoadingClasses(false);
    }
  };
  
  const checkEnrolledClasses = async (studentId: string) => {
    try {
      const { getEnrollmentsByStudent } = await import('@/lib/services/enrollments');
      const enrollments = await getEnrollmentsByStudent(studentId);
      const enrolledClassIds = enrollments
        .filter(e => e.status === 'active' || e.status === 'completed')
        .map(e => e.classId);
      setEnrolledClasses(enrolledClassIds);
    } catch (error) {
      console.error('Error checking enrolled classes:', error);
    }
  };

  useEffect(() => {
    if (formData.studentSelection === 'existing' && formData.selectedExistingStudentId) {
      checkEnrolledClasses(formData.selectedExistingStudentId);
    } else {
      setEnrolledClasses([]);
    }
  }, [formData.selectedExistingStudentId, formData.studentSelection]);

  useEffect(() => {
    if (session.subjectId && subjects.length > 0) {
      const trialSubject = subjects.find(s => s.id === session.subjectId);
      if (trialSubject) {
        setSelectedSubjectFilter(session.subjectId);
      }
    }
  }, [session.subjectId, subjects]);

  const getFilteredClasses = () => {
    let filtered = [...classes];
    
    if (selectedSubjectFilter !== 'all') {
      filtered = filtered.filter(cls => cls.subjectId === selectedSubjectFilter);
    }
    
    if (classSearchTerm.trim()) {
      const searchLower = classSearchTerm.toLowerCase();
      filtered = filtered.filter(cls => 
        cls.name.toLowerCase().includes(searchLower) ||
        cls.code.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  };

  const calculatePricing = () => {
    if (!formData.selectedClass) {
      setPricing({ originalPrice: 0, discountAmount: 0, finalPrice: 0 });
      return;
    }

    const selectedClassData = classes.find(c => c.id === formData.selectedClass);
    if (!selectedClassData) return;

    const original = selectedClassData.pricing.totalPrice;
    let discountAmount = 0;

    if (formData.discountType === 'percentage') {
      discountAmount = (original * formData.discount) / 100;
    } else {
      discountAmount = formData.discount;
    }

    const final = Math.max(0, original - discountAmount);

    setPricing({
      originalPrice: original,
      discountAmount,
      finalPrice: final
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1: // Parent info
        if (!existingParent) {
          if (!formData.parentName.trim()) {
            newErrors.parentName = 'กรุณากรอกชื่อผู้ปกครอง';
          }
          
          if (!formData.parentPhone.trim()) {
            newErrors.parentPhone = 'กรุณากรอกเบอร์โทรศัพท์';
          } else if (!/^0[0-9]{8,9}$/.test(formData.parentPhone.replace(/-/g, ''))) {
            newErrors.parentPhone = 'เบอร์โทรไม่ถูกต้อง';
          }
          
          if (formData.emergencyPhone && !/^0[0-9]{8,9}$/.test(formData.emergencyPhone.replace(/-/g, ''))) {
            newErrors.emergencyPhone = 'เบอร์โทรฉุกเฉินไม่ถูกต้อง';
          }
          
          if (formData.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) {
            newErrors.parentEmail = 'อีเมลไม่ถูกต้อง';
          }
        }
        break;
        
      case 2: // Student info
        if (formData.studentSelection === 'new') {
          if (!formData.studentName.trim()) {
            newErrors.studentName = 'กรุณากรอกชื่อ-นามสกุลนักเรียน';
          }
          
          if (!formData.studentNickname.trim()) {
            newErrors.studentNickname = 'กรุณากรอกชื่อเล่น';
          }
          
          if (!formData.studentBirthdate) {
            newErrors.studentBirthdate = 'กรุณาเลือกวันเกิด';
          } else {
            const age = calculateAge(new Date(formData.studentBirthdate));
            if (age < 4 || age > 18) {
              newErrors.studentBirthdate = 'นักเรียนต้องมีอายุระหว่าง 4-18 ปี';
            }
          }
          
          if (!formData.studentGender) {
            newErrors.studentGender = 'กรุณาเลือกเพศ';
          }
          
          if (formData.emergencyContactPhone && 
              !/^0[0-9]{8,9}$/.test(formData.emergencyContactPhone.replace(/-/g, ''))) {
            newErrors.emergencyContactPhone = 'เบอร์โทรไม่ถูกต้อง';
          }
        } else if (formData.studentSelection === 'existing' && !formData.selectedExistingStudentId) {
          newErrors.studentSelection = 'กรุณาเลือกนักเรียน';
        }
        break;
        
      case 3: // Class selection
        if (!formData.selectedClass) {
          newErrors.selectedClass = 'กรุณาเลือกคลาส';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;

    setLoading(true);

    try {
      const conversionData: any = {
        useExistingParent: formData.useExistingParent,
        existingParentId: formData.existingParentId,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone.replace(/-/g, ''),
        parentEmail: formData.parentEmail || undefined,
        emergencyPhone: formData.emergencyPhone ? formData.emergencyPhone.replace(/-/g, '') : undefined,
        address: formData.address.houseNumber ? formData.address : undefined,
        
        classId: formData.selectedClass,
        pricing: {
          originalPrice: pricing.originalPrice,
          discount: pricing.discountAmount,
          discountType: formData.discountType,
          finalPrice: pricing.finalPrice,
          promotionCode: formData.promotionCode || undefined
        }
      };
      
      if (formData.studentSelection === 'existing' && formData.selectedExistingStudentId) {
        conversionData.useExistingStudent = true;
        conversionData.existingStudentId = formData.selectedExistingStudentId;
      } else {
        conversionData.useExistingStudent = false;
        conversionData.studentName = formData.studentName;
        conversionData.studentNickname = formData.studentNickname;
        conversionData.studentBirthdate = new Date(formData.studentBirthdate);
        conversionData.studentGender = formData.studentGender;
        conversionData.studentSchoolName = formData.studentSchoolName || undefined;
        conversionData.studentGradeLevel = formData.studentGradeLevel || undefined;
        conversionData.studentAllergies = formData.studentAllergies || undefined;
        conversionData.studentSpecialNeeds = formData.studentSpecialNeeds || undefined;
        conversionData.emergencyContact = formData.emergencyContact || undefined;
        conversionData.emergencyContactPhone = formData.emergencyContactPhone || undefined;
      }
      
      const result = await convertTrialToEnrollment(
        booking.id,
        session.id,
        conversionData
      );

      toast.success('แปลงเป็นนักเรียนสำเร็จ');
      onSuccess();
    } catch (error: any) {
      console.error('Error converting to student:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการแปลงเป็นนักเรียน');
    } finally {
      setLoading(false);
    }
  };

  const subject = subjects.find(s => s.id === session.subjectId);
  const currentBranch = branches.find(b => b.id === session.branchId);

  if (loadingClasses || checkingPhone) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:justify-between text-sm text-gray-600 gap-1">
          <span>ขั้นตอนที่ {currentStep} จาก {steps.length}</span>
          <span className="text-right">{steps[currentStep - 1].name}</span>
        </div>
        <Progress value={(currentStep / steps.length) * 100} className="h-2" />
      </div>

      {/* Step 1: Parent Information */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {existingParent ? (
            <>
              <Alert className="border-blue-200 bg-blue-50">
                <Users className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <div className="font-medium mb-1">พบข้อมูลผู้ปกครองในระบบ</div>
                  <div className="text-sm">
                    ระบบจะใช้ข้อมูลผู้ปกครองนี้ในการลงทะเบียน
                  </div>
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ข้อมูลผู้ปกครอง</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-gray-600">ชื่อ-นามสกุล</Label>
                        <p className="font-medium">{existingParent.displayName}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">เบอร์โทรศัพท์</Label>
                        <p className="font-medium">{existingParent.phone}</p>
                      </div>
                      {existingParent.email && (
                        <div>
                          <Label className="text-sm text-gray-600">อีเมล</Label>
                          <p className="font-medium">{existingParent.email}</p>
                        </div>
                      )}
                      {existingParent.emergencyPhone && (
                        <div>
                          <Label className="text-sm text-gray-600">เบอร์โทรฉุกเฉิน</Label>
                          <p className="font-medium">{existingParent.emergencyPhone}</p>
                        </div>
                      )}
                    </div>
                    {existingParent.address && (
                      <div>
                        <Label className="text-sm text-gray-600">ที่อยู่</Label>
                        <p className="font-medium">
                          {existingParent.address.houseNumber} 
                          {existingParent.address.street && ` ${existingParent.address.street}`}
                          {` ${existingParent.address.subDistrict} ${existingParent.address.district} ${existingParent.address.province} ${existingParent.address.postalCode}`}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ข้อมูลผู้ปกครอง</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentPhone">
                      <Phone className="inline h-4 w-4 mr-1" />
                      เบอร์โทร <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="parentPhone"
                      value={formData.parentPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                      placeholder="08x-xxx-xxxx"
                      className={errors.parentPhone ? 'border-red-500' : ''}
                      required
                    />
                    {errors.parentPhone && (
                      <p className="text-sm text-red-500">{errors.parentPhone}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="parentName">
                      <User className="inline h-4 w-4 mr-1" />
                      ชื่อผู้ปกครอง <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="parentName"
                      value={formData.parentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                      placeholder="ชื่อ-นามสกุล"
                      className={errors.parentName ? 'border-red-500' : ''}
                      required
                    />
                    {errors.parentName && (
                      <p className="text-sm text-red-500">{errors.parentName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail">
                      <Mail className="inline h-4 w-4 mr-1" />
                      อีเมล
                    </Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={formData.parentEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                      placeholder="parent@example.com"
                      className={errors.parentEmail ? 'border-red-500' : ''}
                    />
                    {errors.parentEmail && (
                      <p className="text-sm text-red-500">{errors.parentEmail}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">
                      <Phone className="inline h-4 w-4 mr-1" />
                      เบอร์โทรฉุกเฉิน
                    </Label>
                    <Input
                      id="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                      placeholder="08x-xxx-xxxx (ไม่บังคับ)"
                      className={errors.emergencyPhone ? 'border-red-500' : ''}
                    />
                    {errors.emergencyPhone && (
                      <p className="text-sm text-red-500">{errors.emergencyPhone}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    ที่อยู่ (ถ้ามี)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="houseNumber">บ้านเลขที่</Label>
                      <Input
                        id="houseNumber"
                        value={formData.address.houseNumber}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, houseNumber: e.target.value }
                        }))}
                        placeholder="123/45"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="street">ถนน</Label>
                      <Input
                        id="street"
                        value={formData.address.street}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, street: e.target.value }
                        }))}
                        placeholder="ถนนสุขุมวิท"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subDistrict">แขวง/ตำบล</Label>
                      <Input
                        id="subDistrict"
                        value={formData.address.subDistrict}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, subDistrict: e.target.value }
                        }))}
                        placeholder="คลองเตย"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="district">เขต/อำเภอ</Label>
                      <Input
                        id="district"
                        value={formData.address.district}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, district: e.target.value }
                        }))}
                        placeholder="คลองเตย"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="province">จังหวัด</Label>
                      <Input
                        id="province"
                        value={formData.address.province}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, province: e.target.value }
                        }))}
                        placeholder="กรุงเทพมหานคร"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
                      <Input
                        id="postalCode"
                        maxLength={5}
                        value={formData.address.postalCode}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, postalCode: e.target.value }
                        }))}
                        placeholder="10110"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Student Information */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {existingStudents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">เลือกนักเรียน</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={formData.studentSelection}
                  onValueChange={(value: 'existing' | 'new') => 
                    setFormData(prev => ({ ...prev, studentSelection: value }))
                  }
                >
                  <div className="space-y-4">
                    {existingStudents.map((student) => (
                      <label 
                        key={student.id} 
                        className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                          formData.studentSelection === 'existing' && formData.selectedExistingStudentId === student.id
                            ? 'border-red-500 bg-red-50'
                            : ''
                        }`}
                      >
                        <RadioGroupItem 
                          value="existing" 
                          checked={formData.studentSelection === 'existing' && formData.selectedExistingStudentId === student.id}
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            studentSelection: 'existing',
                            selectedExistingStudentId: student.id
                          }))}
                        />
                        <div className="flex-1 grid gap-1">
                          <div className="font-medium">{student.nickname} ({student.name})</div>
                          <div className="text-sm text-gray-600">
                            <span>อายุ {calculateAge(student.birthdate)} ปี</span>
                            {student.schoolName && <span> • {student.schoolName}</span>}
                            {student.gradeLevel && <span> ({student.gradeLevel})</span>}
                          </div>
                        </div>
                      </label>
                    ))}

                    <label className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                      formData.studentSelection === 'new' ? 'border-red-500 bg-red-50' : ''
                    }`}>
                      <RadioGroupItem value="new" />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          เพิ่มนักเรียนใหม่
                        </div>
                        <div className="text-sm text-gray-600">
                          ลงทะเบียนนักเรียนใหม่สำหรับผู้ปกครองนี้
                        </div>
                      </div>
                    </label>
                  </div>
                </RadioGroup>
                {errors.studentSelection && (
                  <p className="text-sm text-red-500 mt-2">{errors.studentSelection}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* New Student Form */}
          {(formData.studentSelection === 'new' || existingStudents.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ข้อมูลนักเรียนใหม่</CardTitle>
                {bookingStudent?.birthdate && (
                  <CardDescription className="text-xs">
                    <Baby className="inline h-3 w-3 mr-1" />
                    วันเกิดดึงมาจากข้อมูลการจอง (สามารถแก้ไขได้)
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentName">
                      ชื่อ-นามสกุล <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="studentName"
                      value={formData.studentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                      placeholder="ชื่อ-นามสกุลนักเรียน"
                      className={errors.studentName ? 'border-red-500' : ''}
                      required
                    />
                    {errors.studentName && (
                      <p className="text-sm text-red-500">{errors.studentName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="studentNickname">
                      ชื่อเล่น <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="studentNickname"
                      value={formData.studentNickname}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentNickname: e.target.value }))}
                      placeholder="ชื่อเล่น"
                      className={errors.studentNickname ? 'border-red-500' : ''}
                      required
                    />
                    {errors.studentNickname && (
                      <p className="text-sm text-red-500">{errors.studentNickname}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="studentGender">
                      เพศ <span className="text-red-500">*</span>
                    </Label>
                    <Select 
                      value={formData.studentGender}
                      onValueChange={(value: 'M' | 'F') => setFormData(prev => ({ ...prev, studentGender: value }))}
                    >
                      <SelectTrigger className={errors.studentGender ? 'border-red-500' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">ชาย</SelectItem>
                        <SelectItem value="F">หญิง</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="studentBirthdate">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      วันเกิด <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="studentBirthdate"
                      type="date"
                      value={formData.studentBirthdate}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentBirthdate: e.target.value }))}
                      className={errors.studentBirthdate ? 'border-red-500' : ''}
                      required
                    />
                    {errors.studentBirthdate && (
                      <p className="text-sm text-red-500">{errors.studentBirthdate}</p>
                    )}
                    {formData.studentBirthdate && (
                      <p className="text-xs text-gray-500">
                        อายุ: {calculateAge(new Date(formData.studentBirthdate))} ปี
                      </p>
                    )}
                  </div>
                </div>

                {/* School Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentSchoolName">
                      <School className="inline h-4 w-4 mr-1" />
                      โรงเรียน
                    </Label>
                    <Input
                      id="studentSchoolName"
                      value={formData.studentSchoolName}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentSchoolName: e.target.value }))}
                      placeholder="ชื่อโรงเรียน"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="studentGradeLevel">
                      <GraduationCap className="inline h-4 w-4 mr-1" />
                      ระดับชั้น
                    </Label>
                    <GradeLevelCombobox
                      value={formData.studentGradeLevel}
                      onChange={(value) => setFormData(prev => ({ ...prev, studentGradeLevel: value }))}
                      placeholder="พิมพ์ระดับชั้น เช่น ป.4, Grade 3..."
                    />
                  </div>
                </div>

                {/* Health & Special Needs */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    ข้อมูลสุขภาพและความต้องการพิเศษ
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="studentAllergies">
                      <AlertCircle className="inline h-4 w-4 mr-1 text-red-500" />
                      ข้อมูลการแพ้อาหาร/ยา
                    </Label>
                    <Textarea
                      id="studentAllergies"
                      value={formData.studentAllergies}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentAllergies: e.target.value }))}
                      placeholder="ระบุอาหารหรือยาที่แพ้ (ถ้ามี)"
                      rows={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="studentSpecialNeeds">ความต้องการพิเศษ</Label>
                    <Textarea
                      id="studentSpecialNeeds"
                      value={formData.studentSpecialNeeds}
                      onChange={(e) => setFormData(prev => ({ ...prev, studentSpecialNeeds: e.target.value }))}
                      placeholder="ระบุความต้องการพิเศษ (ถ้ามี)"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">ผู้ติดต่อฉุกเฉิน (นอกจากผู้ปกครอง)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact">ชื่อผู้ติดต่อฉุกเฉิน</Label>
                      <Input
                        id="emergencyContact"
                        value={formData.emergencyContact}
                        onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                        placeholder="ชื่อ-นามสกุล"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactPhone">เบอร์โทรฉุกเฉิน</Label>
                      <Input
                        id="emergencyContactPhone"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                        placeholder="08x-xxx-xxxx"
                        className={errors.emergencyContactPhone ? 'border-red-500' : ''}
                      />
                      {errors.emergencyContactPhone && (
                        <p className="text-sm text-red-500">{errors.emergencyContactPhone}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Class Selection & Pricing */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              ทดลองเรียนวิชา <strong>{subject?.name}</strong> ที่สาขา <strong>{currentBranch?.name}</strong>
              <br />
              <span className="text-sm">คุณสามารถเลือกลงทะเบียนคลาสใดก็ได้ในสาขานี้</span>
            </AlertDescription>
          </Alert>

          {/* Class Selection */}
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">เลือกคลาสที่จะลงทะเบียน</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                แสดงคลาสทั้งหมดในสาขา {currentBranch?.name} ({classes.length} คลาส)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-4">
              {/* Filters */}
              <div className="space-y-4 mb-4">
                <div className="space-y-2">
                  <Label>ค้นหาคลาส</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหาชื่อคลาส หรือรหัส..."
                      value={classSearchTerm}
                      onChange={(e) => setClassSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>กรองตามวิชา</Label>
                  <Select
                    value={selectedSubjectFilter}
                    onValueChange={setSelectedSubjectFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                          ทุกวิชา ({classes.length} คลาส)
                        </div>
                      </SelectItem>
                      {subjects.map((subject) => {
                        const subjectClassCount = classes.filter(c => c.subjectId === subject.id).length;
                        return (
                          <SelectItem key={subject.id} value={subject.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: subject.color }}
                              />
                              {subject.name} ({subjectClassCount} คลาส)
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Class List */}
              {getFilteredClasses().length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {classes.length === 0 
                      ? `ไม่พบคลาสที่เปิดรับสมัครในสาขา ${currentBranch?.name}`
                      : 'ไม่พบคลาสตามเงื่อนไขที่ค้นหา'
                    }
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {getFilteredClasses().map((cls) => {
                    const isSelected = formData.selectedClass === cls.id;
                    const availableSeats = cls.maxStudents - cls.enrolledCount;
                    const classSubject = subjects.find(s => s.id === cls.subjectId);
                    const isTrialSubject = cls.subjectId === session.subjectId;
                    const isEnrolled = enrolledClasses.includes(cls.id);
                    const isDisabled = isEnrolled || availableSeats <= 0;
                    
                    return (
                      <div
                        key={cls.id}
                        onClick={() => !isDisabled && setFormData(prev => ({ ...prev, selectedClass: cls.id }))}
                        className={`
                          p-3 sm:p-4 rounded-lg border transition-all
                          ${isDisabled 
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
                            : 'cursor-pointer hover:border-gray-300'
                          }
                          ${isSelected && !isDisabled
                            ? 'border-red-500 bg-red-50' 
                            : 'border-gray-200'
                          }
                        `}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-medium text-sm sm:text-base truncate">{cls.name}</h4>
                              {classSubject && (
                                <Badge 
                                  style={{ 
                                    backgroundColor: `${classSubject.color}20`,
                                    color: classSubject.color,
                                    borderColor: classSubject.color
                                  }}
                                  className="text-xs shrink-0"
                                >
                                  {classSubject.name}
                                </Badge>
                              )}
                              {isTrialSubject && (
                                <Badge className="text-xs bg-blue-100 text-blue-700 shrink-0">
                                  วิชาที่ทดลอง
                                </Badge>
                              )}
                              {isEnrolled && (
                                <Badge className="text-xs bg-green-100 text-green-700 shrink-0">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  เรียนอยู่แล้ว
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1">
                              {cls.code} • {cls.totalSessions} ครั้ง
                            </p>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs sm:text-sm">
                              <span className="flex items-center gap-1 shrink-0">
                                <Calendar className="h-3 w-3" />
                                {cls.daysOfWeek.map(d => ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][d]).join(', ')}
                              </span>
                              <span className="shrink-0">{cls.startTime} - {cls.endTime}</span>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-medium text-sm sm:text-base">{formatCurrency(cls.pricing.totalPrice)}</p>
                            <Badge 
                              variant={availableSeats <= 0 ? 'destructive' : availableSeats <= 3 ? 'destructive' : 'outline'}
                              className="mt-1 text-xs"
                            >
                              {availableSeats <= 0 ? 'เต็ม' : `เหลือ ${availableSeats} ที่`}
                            </Badge>
                          </div>
                        </div>
                        {isSelected && !isDisabled && (
                          <Badge className="mt-3 bg-red-100 text-red-700 text-xs">
                            เลือกแล้ว
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.selectedClass && (
                <p className="text-sm text-red-500">{errors.selectedClass}</p>
              )}
            </CardContent>
          </Card>

          {/* Pricing & Discount */}
          {formData.selectedClass && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ราคาและส่วนลด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ประเภทส่วนลด</Label>
                    <Select 
                      value={formData.discountType} 
                      onValueChange={(value: 'percentage' | 'fixed') => 
                        setFormData(prev => ({ ...prev, discountType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">เปอร์เซ็นต์ (%)</SelectItem>
                        <SelectItem value="fixed">จำนวนเงิน (บาท)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>ส่วนลด</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={formData.discount}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                        min={0}
                        max={formData.discountType === 'percentage' ? 100 : pricing.originalPrice}
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        {formData.discountType === 'percentage' ? '%' : 'บาท'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label>รหัสโปรโมชั่น (ถ้ามี)</Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={formData.promotionCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, promotionCode: e.target.value }))}
                        placeholder="เช่น TRIAL5"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Price Summary */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>ราคาเต็ม</span>
                    <span>{formatCurrency(pricing.originalPrice)}</span>
                  </div>
                  {pricing.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>ส่วนลด</span>
                      <span>-{formatCurrency(pricing.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>ราคาสุทธิ</span>
                    <span className="text-lg">{formatCurrency(pricing.finalPrice)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4 shrink-0" />
        <AlertDescription className="text-xs sm:text-sm">
          {existingParent ? (
            <>
              ระบบจะ{formData.studentSelection === 'existing' ? 'ลงทะเบียน' : 'เพิ่ม'}นักเรียน
              {formData.studentSelection === 'existing' ? 'ที่เลือก' : 'ใหม่'}
              ให้กับผู้ปกครอง {`"${existingParent.displayName}"`} และลงทะเบียนในคลาสที่เลือก
            </>
          ) : (
            <>หลังจากแปลงเป็นนักเรียนแล้ว ระบบจะสร้างข้อมูลผู้ปกครองและนักเรียนอัตโนมัติ พร้อมลงทะเบียนในคลาสที่เลือก (สถานะรอชำระเงิน)</>
          )}
        </AlertDescription>
      </Alert>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <Button 
          type="button" 
          variant="outline" 
          onClick={currentStep === 1 ? onCancel : handlePrevious}
          disabled={loading}
          className="w-full sm:w-auto order-2 sm:order-1"
        >
          {currentStep === 1 ? 'ยกเลิก' : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              ย้อนกลับ
            </>
          )}
        </Button>
        
        {currentStep < steps.length ? (
          <Button type="button" onClick={handleNext} className="bg-red-500 hover:bg-red-600 w-full sm:w-auto order-1 sm:order-2">
            ถัดไป
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            type="submit"
            disabled={loading || !formData.selectedClass}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto order-1 sm:order-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังดำเนินการ...
              </>
            ) : (
              'ยืนยันการแปลงเป็นนักเรียน'
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  School, 
  DollarSign, 
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Calendar,
  Users,
  Clock,
  MapPin,
  Search
} from 'lucide-react';
import { Parent, Student, Class, Branch, Subject, Teacher } from '@/types/models';
import { getParents, getAllStudentsWithParents } from '@/lib/services/parents';
import { getClasses } from '@/lib/services/classes';
import { getBranches } from '@/lib/services/branches';
import { getSubjects } from '@/lib/services/subjects';
import { getTeachers } from '@/lib/services/teachers';
import { createEnrollment, checkDuplicateEnrollment, checkAvailableSeats } from '@/lib/services/enrollments';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getDayName, calculateAge } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type FormData = {
  parentId: string;
  studentId: string;
  classId: string;
  branchId: string;
  promotionCode: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  paymentMethod: 'cash' | 'transfer' | 'credit';
};

type StudentWithParent = Student & { 
  parentName: string; 
  parentPhone: string;
  parentId: string;
};

const steps = [
  { id: 1, name: 'เลือกนักเรียน', icon: User },
  { id: 2, name: 'เลือกคลาสเรียน', icon: School },
  { id: 3, name: 'ตรวจสอบและชำระเงิน', icon: DollarSign },
];

export default function EnrollmentForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    parentId: '',
    studentId: '',
    classId: '',
    branchId: '',
    promotionCode: '',
    discount: 0,
    discountType: 'percentage',
    paymentMethod: 'cash',
  });
  
  // Data lists
  const [allStudents, setAllStudents] = useState<StudentWithParent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  // Search and filter states
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  
  // Selected data
  const [selectedStudent, setSelectedStudent] = useState<StudentWithParent | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [seatAvailability, setSeatAvailability] = useState<{ available: boolean; availableSeats: number } | null>(null);
  
  // Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.branchId) {
      loadClassesByBranch(formData.branchId);
    }
  }, [formData.branchId]);

  useEffect(() => {
    if (formData.classId) {
      checkClassAvailability(formData.classId);
    }
  }, [formData.classId]);

  const loadInitialData = async () => {
    try {
      const [studentsData, branchesData, subjectsData, teachersData] = await Promise.all([
        getAllStudentsWithParents(),
        getBranches(),
        getSubjects(),
        getTeachers()
      ]);
      
      setAllStudents(studentsData.filter(s => s.isActive));
      setBranches(branchesData.filter(b => b.isActive));
      setSubjects(subjectsData);
      setTeachers(teachersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const loadClassesByBranch = async (branchId: string) => {
    try {
      const allClasses = await getClasses();
      const branchClasses = allClasses.filter(
        c => c.branchId === branchId && 
        ['published', 'started'].includes(c.status) &&
        c.enrolledCount < c.maxStudents
      );
      setClasses(branchClasses);
      
      // Reset class selection if branch changed
      if (formData.classId && !branchClasses.find(c => c.id === formData.classId)) {
        setFormData(prev => ({ ...prev, classId: '' }));
        setSelectedClass(null);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const checkClassAvailability = async (classId: string) => {
    try {
      const availability = await checkAvailableSeats(classId);
      setSeatAvailability(availability);
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm) return [];
    
    const searchLower = studentSearchTerm.toLowerCase();
    return allStudents.filter(student => 
      student.name.toLowerCase().includes(searchLower) ||
      student.nickname.toLowerCase().includes(searchLower)
    ).slice(0, 10); // Limit results for performance
  }, [studentSearchTerm, allStudents]);

  // Filter classes based on search
  const filteredClasses = useMemo(() => {
    if (!formData.branchId) return [];
    
    let filtered = classes;
    
    if (classSearchTerm) {
      const searchLower = classSearchTerm.toLowerCase();
      filtered = classes.filter(cls => 
        cls.name.toLowerCase().includes(searchLower) ||
        cls.code.toLowerCase().includes(searchLower) ||
        subjects.find(s => s.id === cls.subjectId)?.name.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [classes, classSearchTerm, formData.branchId, subjects]);

  const handleStudentSelect = (student: StudentWithParent) => {
    setSelectedStudent(student);
    setFormData(prev => ({ 
      ...prev, 
      studentId: student.id,
      parentId: student.parentId 
    }));
    setStudentSearchTerm('');
  };

  const handleClassSelect = (classInfo: Class) => {
    setSelectedClass(classInfo);
    setFormData(prev => ({ ...prev, classId: classInfo.id }));
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || 'Unknown';
  };

  const getSubjectInfo = (subjectId: string) => {
    return subjects.find(s => s.id === subjectId);
  };

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher?.nickname || teacher?.name || 'Unknown';
  };

  const calculateFinalPrice = () => {
    if (!selectedClass) return 0;
    
    const basePrice = selectedClass.pricing.totalPrice;
    let discount = 0;
    
    if (formData.discount > 0) {
      if (formData.discountType === 'percentage') {
        discount = basePrice * (formData.discount / 100);
      } else {
        discount = formData.discount;
      }
    }
    
    return Math.max(0, basePrice - discount);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    switch (step) {
      case 1:
        if (!formData.studentId) newErrors.student = 'กรุณาเลือกนักเรียน';
        break;
      case 2:
        if (!formData.branchId) newErrors.branch = 'กรุณาเลือกสาขา';
        if (!formData.classId) newErrors.class = 'กรุณาเลือกคลาส';
        break;
      case 3:
        if (!formData.paymentMethod) newErrors.payment = 'กรุณาเลือกวิธีการชำระเงิน';
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

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    if (!selectedStudent || !selectedClass) return;
    
    setSubmitting(true);
    
    try {
      // Check for duplicate enrollment
      const isDuplicate = await checkDuplicateEnrollment(formData.studentId, formData.classId);
      if (isDuplicate) {
        toast.error('นักเรียนคนนี้ลงทะเบียนในคลาสนี้แล้ว');
        setSubmitting(false);
        return;
      }
      
      // Check age requirement
      const studentAge = calculateAge(selectedStudent.birthdate);
      const subject = subjects.find(s => s.id === selectedClass.subjectId);
      if (subject && (studentAge < subject.ageRange.min || studentAge > subject.ageRange.max)) {
        toast.error(`อายุนักเรียนไม่อยู่ในช่วงที่กำหนด (${subject.ageRange.min}-${subject.ageRange.max} ปี)`);
        setSubmitting(false);
        return;
      }
      
      // Create enrollment
      const enrollmentData = {
        studentId: formData.studentId,
        classId: formData.classId,
        parentId: formData.parentId,
        branchId: formData.branchId,
        status: 'active' as const,
        pricing: {
          originalPrice: selectedClass.pricing.totalPrice,
          discount: formData.discount,
          discountType: formData.discountType,
          finalPrice: calculateFinalPrice(),
          ...(formData.promotionCode && { promotionCode: formData.promotionCode })
        },
        payment: {
          method: formData.paymentMethod,
          status: 'pending' as const, // Default to pending
          paidAmount: 0,
        },
      };
      
      const enrollmentId = await createEnrollment(enrollmentData);
      toast.success('ลงทะเบียนเรียบร้อยแล้ว');
      router.push(`/enrollments/${enrollmentId}`);
    } catch (error) {
      console.error('Error creating enrollment:', error);
      toast.error('ไม่สามารถลงทะเบียนได้');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-center">
                <div className={`flex items-center ${index < steps.length - 1 ? 'w-full' : ''}`}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                        currentStep > step.id
                          ? 'bg-red-500 border-red-500 text-white'
                          : currentStep === step.id
                          ? 'border-red-500 text-red-500'
                          : 'border-gray-300 text-gray-300'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`mt-2 text-sm ${
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      currentStep > step.id ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: Select Student */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">ขั้นตอนที่ 1: เลือกนักเรียน</h2>
              
              <div className="space-y-4">
                <div>
                  <Label>ค้นหานักเรียน</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="พิมพ์ชื่อหรือชื่อเล่นนักเรียน..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className={`pl-10 ${errors.student ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.student && (
                    <p className="text-sm text-red-500 mt-1">{errors.student}</p>
                  )}
                </div>

                {/* Search Results */}
                {studentSearchTerm && filteredStudents.length > 0 && (
                  <Card>
                    <CardContent className="p-2">
                      <div className="max-h-60 overflow-y-auto">
                        {filteredStudents.map(student => (
                          <div
                            key={student.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer rounded-md transition-colors"
                            onClick={() => handleStudentSelect(student)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">
                                  {student.nickname} ({student.name})
                                </p>
                                <p className="text-sm text-gray-500">
                                  อายุ {calculateAge(student.birthdate)} ปี • 
                                  ผู้ปกครอง: {student.parentName}
                                </p>
                              </div>
                              <Badge variant={student.gender === 'M' ? 'secondary' : 'default'}>
                                {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {studentSearchTerm && filteredStudents.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      ไม่พบนักเรียนที่ค้นหา กรุณาลองใหม่อีกครั้ง
                    </AlertDescription>
                  </Alert>
                )}

                {/* Selected Student */}
                {selectedStudent && (
                  <Card className="bg-green-50 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-lg text-green-800">นักเรียนที่เลือก</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">ชื่อ:</span> {selectedStudent.name}
                        </div>
                        <div>
                          <span className="text-gray-600">ชื่อเล่น:</span> {selectedStudent.nickname}
                        </div>
                        <div>
                          <span className="text-gray-600">อายุ:</span> {calculateAge(selectedStudent.birthdate)} ปี
                        </div>
                        <div>
                          <span className="text-gray-600">เพศ:</span> {selectedStudent.gender === 'M' ? 'ชาย' : 'หญิง'}
                        </div>
                        <div className="col-span-2 pt-2 border-t">
                          <span className="text-gray-600">ผู้ปกครอง:</span> {selectedStudent.parentName} 
                          <span className="text-gray-500 ml-2">({selectedStudent.parentPhone})</span>
                        </div>
                        {selectedStudent.allergies && (
                          <div className="col-span-2 text-red-600">
                            <span className="font-medium">แพ้:</span> {selectedStudent.allergies}
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStudent(null);
                            setFormData(prev => ({ ...prev, studentId: '', parentId: '' }));
                          }}
                        >
                          เปลี่ยนนักเรียน
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select Class */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">ขั้นตอนที่ 2: เลือกคลาสเรียน</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>สาขา</Label>
                    <Select 
                      value={formData.branchId} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, branchId: value }))}
                    >
                      <SelectTrigger className={errors.branch ? 'border-red-500' : ''}>
                        <SelectValue placeholder="เลือกสาขา" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.branch && (
                      <p className="text-sm text-red-500 mt-1">{errors.branch}</p>
                    )}
                  </div>

                  <div>
                    <Label>ค้นหาคลาส</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="ค้นหาชื่อคลาส, รหัส, วิชา..."
                        value={classSearchTerm}
                        onChange={(e) => setClassSearchTerm(e.target.value)}
                        className="pl-10"
                        disabled={!formData.branchId}
                      />
                    </div>
                  </div>
                </div>

                {/* Class Table */}
                {formData.branchId && (
                  <div>
                    {filteredClasses.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          ไม่มีคลาสที่เปิดรับสมัครในสาขานี้
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ชื่อคลาส</TableHead>
                                  <TableHead>วิชา</TableHead>
                                  <TableHead>วัน/เวลา</TableHead>
                                  <TableHead>ระยะเวลา</TableHead>
                                  <TableHead className="text-center">ที่นั่ง</TableHead>
                                  <TableHead className="text-right">ราคา</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredClasses.map(cls => {
                                  const subject = getSubjectInfo(cls.subjectId);
                                  const isAgeAppropriate = selectedStudent && subject &&
                                    calculateAge(selectedStudent.birthdate) >= subject.ageRange.min &&
                                    calculateAge(selectedStudent.birthdate) <= subject.ageRange.max;
                                  const isFull = cls.enrolledCount >= cls.maxStudents;
                                  const isSelected = formData.classId === cls.id;
                                  
                                  return (
                                    <TableRow 
                                      key={cls.id}
                                      className={`cursor-pointer transition-all ${
                                        isSelected 
                                          ? 'bg-green-100 border-2 border-green-500' 
                                          : !isAgeAppropriate || isFull
                                          ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                                          : 'hover:bg-green-50 hover:border hover:border-green-300'
                                      }`}
                                      onClick={() => {
                                        if (isAgeAppropriate && !isFull) {
                                          handleClassSelect(cls);
                                        }
                                      }}
                                    >
                                      <TableCell>
                                        <div>
                                          <p className="font-medium">{cls.name}</p>
                                          <p className="text-sm text-gray-500">{cls.code}</p>
                                          {!isAgeAppropriate && selectedStudent && subject && (
                                            <p className="text-xs text-red-600 mt-1">
                                              ⚠️ เหมาะสำหรับอายุ {subject.ageRange.min}-{subject.ageRange.max} ปี
                                            </p>
                                          )}
                                          {isFull && (
                                            <p className="text-xs text-red-600 mt-1">
                                              ⚠️ คลาสเต็ม
                                            </p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: subject?.color }}
                                          />
                                          <span>{subject?.name}</span>
                                        </div>
                                        {subject && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            อายุ {subject.ageRange.min}-{subject.ageRange.max} ปี
                                          </p>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm">
                                          <p>{cls.daysOfWeek.map(d => getDayName(d)).join(', ')}</p>
                                          <p className="text-gray-500">{cls.startTime} - {cls.endTime}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm">
                                          <p>{formatDate(cls.startDate)}</p>
                                          <p className="text-gray-500">ถึง {formatDate(cls.endDate)}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge 
                                          variant={isFull ? 'destructive' : 'secondary'}
                                        >
                                          {cls.enrolledCount}/{cls.maxStudents}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div>
                                          <p className="font-medium">{formatCurrency(cls.pricing.totalPrice)}</p>
                                          <p className="text-sm text-gray-500">{cls.totalSessions} ครั้ง</p>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {errors.class && (
                      <p className="text-sm text-red-500 mt-1">{errors.class}</p>
                    )}
                  </div>
                )}

                {/* Selected Class Info */}
                {selectedClass && seatAvailability && (
                  <Alert className={seatAvailability.available ? '' : 'border-red-500'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {seatAvailability.available 
                        ? `เหลือที่นั่ง ${seatAvailability.availableSeats} ที่`
                        : 'คลาสนี้เต็มแล้ว'
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review and Payment */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">ขั้นตอนที่ 3: ตรวจสอบและชำระเงิน</h2>
              
              {selectedStudent && selectedClass && (
                <div className="space-y-4">
                  {/* Summary */}
                  <Card className="bg-gray-50">
                    <CardContent className="p-4 space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900">ข้อมูลนักเรียน</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedStudent.nickname} ({selectedStudent.name})
                        </p>
                        <p className="text-sm text-gray-600">
                          ผู้ปกครอง: {selectedStudent.parentName}
                        </p>
                      </div>
                      
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900">ข้อมูลคลาส</h4>
                        <p className="text-sm text-gray-600 mt-1">{selectedClass.name}</p>
                        <p className="text-sm text-gray-600">
                          {getDayName(selectedClass.daysOfWeek[0])} {selectedClass.startTime} - {selectedClass.endTime}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(selectedClass.startDate)} - {formatDate(selectedClass.endDate)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Promotion/Discount */}
                  <div className="space-y-4">
                    <h4 className="font-medium">ส่วนลด (ถ้ามี)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>รหัสโปรโมชั่น (ไม่บังคับ)</Label>
                        <Input
                          placeholder="ใส่รหัสโปรโมชั่น"
                          value={formData.promotionCode}
                          onChange={(e) => setFormData(prev => ({ ...prev, promotionCode: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>ส่วนลดพิเศษ</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="0"
                            value={formData.discount || ''}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              discount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                          <Select 
                            value={formData.discountType}
                            onValueChange={(value: 'percentage' | 'fixed') => 
                              setFormData(prev => ({ ...prev, discountType: value }))
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">%</SelectItem>
                              <SelectItem value="fixed">฿</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <h4 className="font-medium mb-3">วิธีการชำระเงิน</h4>
                    <Select 
                      value={formData.paymentMethod}
                      onValueChange={(value: 'cash' | 'transfer' | 'credit') => 
                        setFormData(prev => ({ ...prev, paymentMethod: value }))
                      }
                    >
                      <SelectTrigger className={errors.payment ? 'border-red-500' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">เงินสด</SelectItem>
                        <SelectItem value="transfer">โอนเงิน</SelectItem>
                        <SelectItem value="credit">บัตรเครดิต</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.payment && (
                      <p className="text-sm text-red-500 mt-1">{errors.payment}</p>
                    )}
                  </div>

                  {/* Price Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">สรุปยอดชำระ</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>ค่าเรียน ({selectedClass.totalSessions} ครั้ง)</span>
                          <span>{formatCurrency(selectedClass.pricing.totalPrice)}</span>
                        </div>
                        
                        {formData.discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>
                              ส่วนลด {formData.discountType === 'percentage' 
                                ? `${formData.discount}%` 
                                : formatCurrency(formData.discount)
                              }
                            </span>
                            <span>
                              -{formatCurrency(
                                formData.discountType === 'percentage'
                                  ? selectedClass.pricing.totalPrice * (formData.discount / 100)
                                  : formData.discount
                              )}
                            </span>
                          </div>
                        )}
                        
                        <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                          <span>ยอดรวม</span>
                          <span className="text-green-600">{formatCurrency(calculateFinalPrice())}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Warning/Notes */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>หมายเหตุ:</strong> หลังจากลงทะเบียนแล้ว ระบบจะสร้างรายการรอชำระเงิน 
                      กรุณาชำระเงินภายใน 7 วันเพื่อยืนยันการลงทะเบียน
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center p-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            ย้อนกลับ
          </Button>

          <div className="flex gap-2">
            {currentStep < steps.length ? (
              <Button
                onClick={handleNext}
                className="bg-red-500 hover:bg-red-600"
              >
                ถัดไป
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || (seatAvailability && !seatAvailability.available)}
                className="bg-red-500 hover:bg-red-600"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    กำลังลงทะเบียน...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    ยืนยันการลงทะเบียน
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { GradeLevelCombobox } from '@/components/ui/grade-level-combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatCurrency, getDayName, calculateAge, formatTime, formatDateCompact } from '@/lib/utils';
import {
  Loader2, Search, User, CheckCircle, ArrowLeft, Users,
  Clock, Calendar, ChevronDown, ChevronUp, AlertCircle, TestTube,
  School, GraduationCap, Plus, ChevronRight, ChevronLeft, Save, Building2,
  Banknote, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Class, Subject, Teacher, Branch, Student, PaymentMethod, PaymentType } from '@/types/models';
import { getClasses, getClassStatistics } from '@/lib/services/classes';
import { getSubjects } from '@/lib/services/subjects';
import { getTeachers } from '@/lib/services/teachers';
import { getBranches, getActiveBranches } from '@/lib/services/branches';
import { getParentByPhone, getStudentsByParent } from '@/lib/services/parents';
import { ParentSearchInput, ParentSearchSelection, ParentSearchInputRef } from '@/components/shared/parent-search-input';
import { checkAvailableSeats, checkDuplicateEnrollment, getEnrollmentsByStudent } from '@/lib/services/enrollments';
import { processUnifiedEnrollment, UnifiedEnrollmentResult } from '@/lib/services/unified-enrollment';
import { getTrialBooking, getTrialSessionsByBooking } from '@/lib/services/trial-bookings';
import { getBranchPaymentSettings } from '@/lib/services/branch-payment-settings';
import PaymentMethodSelector from '@/components/enrollments/payment/payment-method-selector';
import { BranchPaymentSettings } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';

// Section wrapper — defined outside the component to keep stable reference (prevents input focus loss)
function EnrollmentSection({ title, isChat, children }: { title: string; isChat: boolean; children: React.ReactNode }) {
  if (isChat) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        {children}
      </div>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface CompactEnrollmentFormProps {
  context: 'admin' | 'liff' | 'chat';
  prefill?: {
    parentId?: string;
    parentName?: string;
    parentPhone?: string;
    contactId?: string;
    conversationId?: string;
    branchId?: string;
    // Trial params
    from?: string;
    bookingId?: string;
    sessionId?: string;
  };
  onSuccess?: (result: { enrollmentId: string; invoiceId?: string }) => void;
  onCancel?: () => void;
}

export function CompactEnrollmentForm({ context, prefill, onSuccess, onCancel }: CompactEnrollmentFormProps) {
  const isAdmin = context === 'admin';
  const isLiff = context === 'liff';
  const isChat = context === 'chat';
  const isFromTrial = prefill?.from === 'trial';

  const { adminUser } = useAuth();
  const submitGuardRef = useRef(false);
  const parentSearchRef = useRef<ParentSearchInputRef>(null);

  // Loading
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reference data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // Parent section
  const [parentMode, setParentMode] = useState<'search' | 'linked' | 'new'>('search');
  const [focusSearchOnMount, setFocusSearchOnMount] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState(prefill?.parentId || '');
  const [parentName, setParentName] = useState(prefill?.parentName || '');
  const [parentPhone, setParentPhone] = useState(prefill?.parentPhone || '');
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);

  // Student section
  const [studentMode, setStudentMode] = useState<'existing' | 'new'>('new');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentNickname, setStudentNickname] = useState('');
  const [studentBirthdate, setStudentBirthdate] = useState('');
  const [studentGender, setStudentGender] = useState<'M' | 'F'>('M');
  const [studentSchoolName, setStudentSchoolName] = useState('');
  const [studentGradeLevel, setStudentGradeLevel] = useState('');

  // Class section
  const [selectedBranch, setSelectedBranch] = useState(prefill?.branchId || '');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classInfo, setClassInfo] = useState<{ cls: Class; subject: Subject | null; teacher: Teacher | null } | null>(null);
  const [classStats, setClassStats] = useState<{ completedSessions: number; totalSessions: number } | null>(null);
  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set());

  // Payment section
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('' as PaymentMethod);
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [branchPaymentSettings, setBranchPaymentSettings] = useState<BranchPaymentSettings | null>(null);

  // Billing section
  const [wantTaxInvoice, setWantTaxInvoice] = useState(false);
  const [billingCompanyName, setBillingCompanyName] = useState('');
  const [billingType, setBillingType] = useState<'personal' | 'company'>('personal');
  const [billingName, setBillingName] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingTaxId, setBillingTaxId] = useState('');
  const [billingCompanyBranch, setBillingCompanyBranch] = useState('');
  const [billingAddress, setBillingAddress] = useState({
    houseNumber: '', street: '', subDistrict: '', district: '', province: '', postalCode: '',
  });

  // Step state (admin wizard): 1=parent, 2=student, 3=class, 4=payment
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Trial data
  const [trialBookingId, setTrialBookingId] = useState<string | undefined>(prefill?.bookingId);
  const [trialSessionId, setTrialSessionId] = useState<string | undefined>(prefill?.sessionId);
  const [trialParentName, setTrialParentName] = useState('');

  // Load reference data
  useEffect(() => {
    const load = async () => {
      try {
        const [branchesData, subjectsData, teachersData] = await Promise.all([
          isLiff ? getActiveBranches() : getBranches(),
          getSubjects(),
          getTeachers(),
        ]);
        setBranches(branchesData.filter((b) => b.isActive));
        setSubjects(subjectsData.filter((s) => s.isActive));
        setTeachers(teachersData.filter((t) => t.isActive));
      } catch {
        toast.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load classes when branch changes
  useEffect(() => {
    if (!selectedBranch) { setClasses([]); return; }
    getClasses(selectedBranch)
      .then((data) => setClasses(data.filter((c) => c.status === 'published' || c.status === 'started')))
      .catch(() => setClasses([]));
  }, [selectedBranch]);

  // Load branch payment settings when branch changes
  useEffect(() => {
    if (!selectedBranch) { setBranchPaymentSettings(null); return; }
    getBranchPaymentSettings(selectedBranch)
      .then(setBranchPaymentSettings)
      .catch(() => setBranchPaymentSettings(null));
  }, [selectedBranch]);

  // Auto-load parent if prefill.parentId exists
  useEffect(() => {
    if (prefill?.parentId) {
      setParentMode('linked');
      setSelectedParentId(prefill.parentId);
      getStudentsByParent(prefill.parentId)
        .then(setExistingStudents)
        .catch(() => {});
    }
  }, [prefill?.parentId]);

  // Trial prefill
  useEffect(() => {
    if (!isFromTrial || !prefill?.bookingId) return;

    const loadTrialData = async () => {
      try {
        const booking = await getTrialBooking(prefill.bookingId!);
        if (!booking) {
          toast.error('ไม่พบข้อมูลการจองทดลองเรียน');
          return;
        }

        // Load sessions
        const sessions = await getTrialSessionsByBooking(prefill.bookingId!);
        const session = prefill.sessionId
          ? sessions.find(s => s.id === prefill.sessionId)
          : sessions.find(s => s.status === 'attended' && !s.converted) || sessions[0];

        // Auto-fill parent
        setParentName(booking.parentName);
        setParentPhone(booking.parentPhone);
        setParentMode('linked');
        setTrialParentName(booking.parentName);

        // Try to find existing parent by phone
        try {
          const parent = await getParentByPhone(booking.parentPhone);
          if (parent) {
            setSelectedParentId(parent.id);
            const students = await getStudentsByParent(parent.id);
            setExistingStudents(students);
            if (students.length > 0) setStudentMode('existing');
          }
        } catch {}

        // Auto-fill student from session or booking.students
        if (session) {
          setTrialSessionId(session.id);
          if (session.studentName) {
            setStudentName(session.studentName);
            setStudentNickname(session.studentName.split(' ')[0] || '');
          }
        } else if (booking.students && booking.students.length > 0) {
          const firstStudent = booking.students[0];
          setStudentName(firstStudent.name);
          setStudentNickname(firstStudent.name.split(' ')[0] || '');
          if (firstStudent.birthdate) {
            setStudentBirthdate(new Date(firstStudent.birthdate).toISOString().split('T')[0]);
          }
        }

        setTrialBookingId(prefill.bookingId);
      } catch (error) {
        console.error('Error loading trial data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลทดลองเรียนได้');
      }
    };

    loadTrialData();
  }, [isFromTrial, prefill?.bookingId, prefill?.sessionId]);

  // When parent selected from ParentSearchInput
  const handleParentSelect = async (selection: ParentSearchSelection) => {
    setSelectedParentId(selection.parentId);
    setParentName(selection.parentName);
    setParentPhone(selection.parentPhone);
    setParentMode('linked');
    setExistingStudents(selection.students);
    if (selection.students.length > 0) setStudentMode('existing');
    // Pre-fill billing from parent data
    setBillingName(selection.parentName);
    setBillingPhone(selection.parentPhone);
    if (selection.parentAddress) {
      setBillingAddress(selection.parentAddress);
    }
  };

  // Update class info when selected
  useEffect(() => {
    if (!selectedClassId) { setClassInfo(null); setClassStats(null); return; }
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) { setClassInfo(null); setClassStats(null); return; }
    // Load class statistics (completed sessions)
    getClassStatistics(selectedClassId)
      .then((stats) => setClassStats({ completedSessions: stats.completedSessions, totalSessions: stats.totalSessions }))
      .catch(() => setClassStats(null));
    const subject = subjects.find((s) => s.id === cls.subjectId) || null;
    const teacher = teachers.find((t) => t.id === cls.teacherId) || null;
    setClassInfo({ cls, subject, teacher });
    // Auto-set payment amount from class pricing
    const price = cls.pricing?.totalPrice || 0;
    const discountAmount = discountType === 'percent' ? Math.round(price * discount / 100) : discount;
    const finalPrice = discountAmount > 0 ? Math.max(0, price - discountAmount) : price;
    setPaymentAmount(finalPrice);
  }, [selectedClassId, classes, subjects, teachers, discount, discountType]);

  // Load enrolled class IDs when existing student is selected
  useEffect(() => {
    if (studentMode === 'existing' && selectedStudentId) {
      getEnrollmentsByStudent(selectedStudentId)
        .then((enrollments) => setEnrolledClassIds(new Set(enrollments.map((e) => e.classId))))
        .catch(() => setEnrolledClassIds(new Set()));
    } else {
      setEnrolledClassIds(new Set());
    }
  }, [studentMode, selectedStudentId]);


  // Student age for filtering
  const studentAge = useMemo(() => {
    if (studentMode === 'existing' && selectedStudentId) {
      const s = existingStudents.find((st) => st.id === selectedStudentId);
      if (s?.birthdate) return calculateAge(new Date(s.birthdate));
    } else if (studentMode === 'new' && studentBirthdate) {
      return calculateAge(new Date(studentBirthdate));
    }
    return null;
  }, [studentMode, selectedStudentId, existingStudents, studentBirthdate]);

  // Filter classes
  const filteredClasses = useMemo(() => {
    let filtered = classes;
    if (classSearchTerm) {
      const term = classSearchTerm.toLowerCase();
      filtered = filtered.filter((c) => {
        const subject = subjects.find((s) => s.id === c.subjectId);
        const teacher = teachers.find((t) => t.id === c.teacherId);
        return (
          c.name.toLowerCase().includes(term) ||
          subject?.name.toLowerCase().includes(term) ||
          teacher?.name.toLowerCase().includes(term) ||
          teacher?.nickname?.toLowerCase().includes(term)
        );
      });
    }
    // Filter by subject
    if (selectedSubjectFilter && selectedSubjectFilter !== 'all') {
      filtered = filtered.filter((c) => c.subjectId === selectedSubjectFilter);
    }
    // Filter out already-enrolled classes
    if (enrolledClassIds.size > 0) {
      filtered = filtered.filter((c) => !enrolledClassIds.has(c.id));
    }
    // Filter by age range (from subject)
    if (studentAge !== null) {
      filtered = filtered.filter((c) => {
        const subject = subjects.find((s) => s.id === c.subjectId);
        if (!subject?.ageRange) return true;
        return studentAge >= subject.ageRange.min && studentAge <= subject.ageRange.max;
      });
    }
    return filtered;
  }, [classes, classSearchTerm, selectedSubjectFilter, subjects, teachers, enrolledClassIds, studentAge]);

  // Subjects available in the current branch's classes
  const branchSubjects = useMemo(() => {
    const subjectIds = new Set(classes.map((c) => c.subjectId));
    return subjects.filter((s) => subjectIds.has(s.id));
  }, [classes, subjects]);

  // Clear selected class if it gets filtered out
  useEffect(() => {
    if (selectedClassId && filteredClasses.length > 0 && !filteredClasses.find((c) => c.id === selectedClassId)) {
      setSelectedClassId('');
    }
  }, [filteredClasses, selectedClassId]);

  // Step validation (admin wizard)
  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (s === 1) {
      if (!selectedBranch) newErrors.branch = 'กรุณาเลือกสาขา';
      if (!selectedParentId && parentMode !== 'linked') {
        if (!parentName.trim()) newErrors.parentName = 'กรุณากรอกชื่อผู้ปกครอง';
        if (!parentPhone.trim()) newErrors.parentPhone = 'กรุณากรอกเบอร์โทรศัพท์';
      }
    }

    if (s === 2) {
      if (studentMode === 'existing' && !selectedStudentId) {
        newErrors.student = 'กรุณาเลือกนักเรียน';
      }
      if (studentMode === 'new' || (existingStudents.length === 0 && studentMode !== 'new')) {
        if (!studentName.trim()) newErrors.studentName = 'กรุณากรอกชื่อนักเรียน';
        if (!studentNickname.trim()) newErrors.studentNickname = 'กรุณากรอกชื่อเล่น';
        if (!studentBirthdate) newErrors.studentBirthdate = 'กรุณาเลือกวันเกิด';
      }
    }

    if (s === 3) {
      if (!selectedClassId) newErrors.classId = 'กรุณาเลือกคลาส';
    }

    if (s === 4) {
      if (!paymentMethod) newErrors.paymentMethod = 'กรุณาเลือกวิธีชำระเงิน';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      // Show first error as toast
      const firstErr = Object.values(newErrors)[0];
      if (firstErr) toast.error(firstErr);
      return false;
    }
    return true;
  };

  const clearError = (key: string) => {
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const goNext = () => { if (validateStep(step)) setStep(step + 1); };
  const goPrev = () => setStep(step - 1);
  const errCls = (key: string) => errors[key] ? 'border-red-500 ring-1 ring-red-500' : '';

  // Validate and submit
  const handleSubmit = async () => {
    if (submitGuardRef.current) return;

    // Validation
    if (!selectedParentId && parentMode !== 'new') {
      if (!parentName.trim() || !parentPhone.trim()) {
        toast.error('กรุณาเลือกหรือกรอกข้อมูลผู้ปกครอง');
        return;
      }
    }

    const isNewParent = !selectedParentId;
    if (isNewParent) {
      if (!parentName.trim()) { toast.error('กรุณากรอกชื่อผู้ปกครอง'); return; }
      if (!parentPhone.trim()) { toast.error('กรุณากรอกเบอร์โทรศัพท์'); return; }
    }

    if (studentMode === 'existing' && !selectedStudentId) {
      toast.error('กรุณาเลือกนักเรียน');
      return;
    }
    if (studentMode === 'new') {
      if (!studentName.trim()) { toast.error('กรุณากรอกชื่อนักเรียน'); return; }
      if (!studentNickname.trim()) { toast.error('กรุณากรอกชื่อเล่นนักเรียน'); return; }
      if (!studentBirthdate) { toast.error('กรุณาเลือกวันเกิด'); return; }
    }

    if (!selectedClassId) { toast.error('กรุณาเลือกคลาส'); return; }
    if (!selectedBranch) { toast.error('กรุณาเลือกสาขา'); return; }
    if (!paymentMethod) { toast.error('กรุณาเลือกวิธีชำระเงิน'); return; }

    submitGuardRef.current = true;
    setSubmitting(true);

    try {
      // Check seats
      const seats = await checkAvailableSeats(selectedClassId);
      if (!seats.available) {
        toast.error('คลาสนี้เต็มแล้ว');
        return;
      }

      // Check duplicate
      if (studentMode === 'existing' && selectedStudentId) {
        const isDuplicate = await checkDuplicateEnrollment(selectedStudentId, selectedClassId);
        if (isDuplicate) {
          toast.error('นักเรียนคนนี้ลงทะเบียนคลาสนี้แล้ว');
          return;
        }
      }

      const existingStudent = existingStudents.find((s) => s.id === selectedStudentId);

      const result = await processUnifiedEnrollment(
        {
          source: isFromTrial ? 'trial' : 'new',
          bookingId: trialBookingId,
          sessionId: trialSessionId,
          parentMode: isNewParent ? 'new' : 'existing',
          existingParentId: selectedParentId || undefined,
          parentName: parentName.trim(),
          parentPhone: parentPhone.replace(/[-\s]/g, ''),
          branchId: selectedBranch,
          students: [
            {
              mode: studentMode === 'existing' ? 'existing' : 'new',
              existingStudentId: studentMode === 'existing' ? selectedStudentId : undefined,
              name: studentMode === 'existing' ? (existingStudent?.name || '') : studentName.trim(),
              nickname: studentMode === 'existing' ? (existingStudent?.nickname || '') : studentNickname.trim(),
              birthdate: studentMode === 'existing'
                ? (existingStudent?.birthdate ? new Date(existingStudent.birthdate).toISOString().split('T')[0] : '')
                : studentBirthdate,
              gender: studentMode === 'existing' ? ((existingStudent as any)?.gender || 'M') : studentGender,
              schoolName: studentMode === 'existing' ? (existingStudent?.schoolName || undefined) : (studentSchoolName.trim() || undefined),
              gradeLevel: studentMode === 'existing' ? (existingStudent?.gradeLevel || undefined) : (studentGradeLevel.trim() || undefined),
              classId: selectedClassId,
            },
          ],
          discount: discountType === 'percent' ? Math.round((classInfo?.cls.pricing?.totalPrice || 0) * discount / 100) : discount,
          discountType: 'fixed',
          paymentMethod,
          paymentType,
          initialPaymentAmount: paymentAmount,
          // Billing (always send name/phone for receipt)
          billingName: billingName || parentName || undefined,
          billingPhone: billingPhone || parentPhone || undefined,
          billingAddress,
          wantTaxInvoice,
          billingType: wantTaxInvoice ? billingType : undefined,
          billingTaxId: wantTaxInvoice ? billingTaxId : undefined,
          billingCompanyName: wantTaxInvoice && billingType === 'company' ? billingCompanyName : undefined,
          billingCompanyBranch: wantTaxInvoice && billingType === 'company' ? billingCompanyBranch : undefined,
        },
        adminUser?.id
      );

      const enrollmentId = result.enrollments[0]?.enrollmentId || '';

      if (isLiff) {
        setShowSuccess(true);
      } else {
        toast.success('ลงทะเบียนสำเร็จ');
        onSuccess?.({ enrollmentId, invoiceId: result.invoiceId });
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      toast.error('เกิดข้อผิดพลาดในการลงทะเบียน');
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  };

  // Success screen (LIFF)
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">ลงทะเบียนสำเร็จ!</h2>
        <p className="text-gray-600">ทางสถาบันจะติดต่อกลับเพื่อยืนยันรายละเอียด</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // --- Shared UI blocks ---
  const parentSection = (
    <EnrollmentSection isChat={isChat} title="ผู้ปกครอง">
      {parentMode === 'linked' ? (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <User className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-base dark:text-white">{parentName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{parentPhone}</p>
          </div>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 shrink-0">เชื่อมแล้ว</Badge>
          <Button variant="ghost" size="sm" onClick={() => { setParentMode('search'); setSelectedParentId(''); setParentName(''); setParentPhone(''); setExistingStudents([]); setStudentMode('new'); setFocusSearchOnMount(true); }}>
            เปลี่ยน
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <ParentSearchInput ref={parentSearchRef} onSelect={handleParentSelect} autoFocus={focusSearchOnMount} />
          {!selectedParentId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">ชื่อผู้ปกครอง *</Label>
                <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">เบอร์โทร *</Label>
                <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
              </div>
            </div>
          )}
        </div>
      )}
    </EnrollmentSection>
  );

  const studentSection = isChat ? (
    <EnrollmentSection isChat title="นักเรียน">
      {existingStudents.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="flex flex-wrap gap-2">
            {existingStudents.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setStudentMode('existing'); setSelectedStudentId(s.id); }}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  studentMode === 'existing' && selectedStudentId === s.id
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                )}
              >
                {s.nickname || s.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setStudentMode('new'); setSelectedStudentId(''); }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                studentMode === 'new'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}
            >
              + เพิ่มนักเรียนใหม่
            </button>
          </div>
        </div>
      )}
      {studentMode === 'new' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">ชื่อ-นามสกุล *</Label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">ชื่อเล่น *</Label>
            <Input value={studentNickname} onChange={(e) => setStudentNickname(e.target.value)} placeholder="ชื่อเล่น" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">วันเกิด *</Label>
            <DateRangePicker mode="single" value={studentBirthdate} onChange={(d) => setStudentBirthdate(d || '')} maxDate={new Date()} placeholder="เลือกวันที่" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">เพศ *</Label>
            <FormSelect
              value={studentGender}
              onValueChange={(v) => setStudentGender(v as 'M' | 'F')}
              options={[{ value: 'M', label: 'ชาย' }, { value: 'F', label: 'หญิง' }]}
            />
          </div>
        </div>
      )}
    </EnrollmentSection>
  ) : (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">นักเรียน</CardTitle>
          {existingStudents.length > 0 && (
            <Button
              variant={studentMode === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStudentMode('new'); setSelectedStudentId(''); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              เพิ่มนักเรียนใหม่
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Existing students list */}
        {existingStudents.length > 0 && studentMode !== 'new' && (
          <div className="border rounded-lg dark:border-slate-700 divide-y dark:divide-slate-700">
            {existingStudents.map((s, idx) => {
              const isSelected = studentMode === 'existing' && selectedStudentId === s.id;
              const onlyOne = existingStudents.length === 1;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setStudentMode('existing'); setSelectedStudentId(s.id); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg',
                    isSelected
                      ? 'bg-green-100 dark:bg-green-900/40'
                      : idx % 2 === 1
                        ? 'bg-gray-50/50 dark:bg-slate-800/50 hover:bg-green-50/60 dark:hover:bg-green-900/10'
                        : 'hover:bg-green-50/60 dark:hover:bg-green-900/10'
                  )}
                >
                  {isSelected && !onlyOne ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                  <span className="font-semibold text-base dark:text-white min-w-[60px]">
                    {s.nickname || '-'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {s.name}
                  </span>
                  {s.schoolName && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      <School className="h-3 w-3 shrink-0" />
                      {s.schoolName}
                    </span>
                  )}
                  {s.gradeLevel && (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <GraduationCap className="h-3 w-3 shrink-0" />
                      {s.gradeLevel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* New student form */}
        {studentMode === 'new' && (
          <div className="space-y-3">
          {existingStudents.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500"
              onClick={() => { setStudentMode('existing'); setSelectedStudentId(existingStudents[0]?.id || ''); }}
            >
              ← เลือกนักเรียนที่มีอยู่
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">ชื่อ-นามสกุล *</Label>
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">ชื่อเล่น *</Label>
              <Input value={studentNickname} onChange={(e) => setStudentNickname(e.target.value)} placeholder="ชื่อเล่น" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">วันเกิด *</Label>
              <DateRangePicker mode="single" value={studentBirthdate} onChange={(d) => setStudentBirthdate(d || '')} maxDate={new Date()} placeholder="เลือกวันที่" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">เพศ *</Label>
              <FormSelect
                value={studentGender}
                onValueChange={(v) => setStudentGender(v as 'M' | 'F')}
                options={[{ value: 'M', label: 'ชาย' }, { value: 'F', label: 'หญิง' }]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">โรงเรียน</Label>
              <SchoolNameCombobox value={studentSchoolName} onChange={setStudentSchoolName} placeholder="พิมพ์ชื่อโรงเรียน..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">ระดับชั้น</Label>
              <GradeLevelCombobox value={studentGradeLevel} onChange={setStudentGradeLevel} placeholder="เลือกหรือพิมพ์ระดับชั้น..." />
            </div>
          </div>
          </div>
        )}

        {/* No students yet */}
        {existingStudents.length === 0 && studentMode !== 'new' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">ชื่อ-นามสกุล *</Label>
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">ชื่อเล่น *</Label>
              <Input value={studentNickname} onChange={(e) => setStudentNickname(e.target.value)} placeholder="ชื่อเล่น" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">วันเกิด *</Label>
              <DateRangePicker mode="single" value={studentBirthdate} onChange={(d) => setStudentBirthdate(d || '')} maxDate={new Date()} placeholder="เลือกวันที่" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">เพศ *</Label>
              <FormSelect
                value={studentGender}
                onValueChange={(v) => setStudentGender(v as 'M' | 'F')}
                options={[{ value: 'M', label: 'ชาย' }, { value: 'F', label: 'หญิง' }]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">โรงเรียน</Label>
              <SchoolNameCombobox value={studentSchoolName} onChange={setStudentSchoolName} placeholder="พิมพ์ชื่อโรงเรียน..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">ระดับชั้น</Label>
              <GradeLevelCombobox value={studentGradeLevel} onChange={setStudentGradeLevel} placeholder="เลือกหรือพิมพ์ระดับชั้น..." />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const classListContent = (
    <>
      {selectedBranch && (
        <div className="border rounded-lg dark:border-slate-700 max-h-60 overflow-y-auto">
          {filteredClasses.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">ไม่พบคลาส</div>
          ) : (
            filteredClasses.map((cls, idx) => {
              const subject = subjects.find((s) => s.id === cls.subjectId);
              const teacher = teachers.find((t) => t.id === cls.teacherId);
              const isSelected = selectedClassId === cls.id;
              const availableSeats = cls.maxStudents - cls.enrolledCount;
              const isFull = availableSeats <= 0;

              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => !isFull && setSelectedClassId(cls.id)}
                  disabled={isFull}
                  className={cn(
                    'w-full px-4 py-3 text-left border-b last:border-b-0 dark:border-slate-700 transition-colors',
                    isFull
                      ? 'bg-red-50 dark:bg-red-900/10 cursor-not-allowed'
                      : isSelected
                        ? 'bg-green-100 dark:bg-green-900/40'
                        : idx % 2 === 1
                          ? 'bg-gray-50/50 dark:bg-slate-800/50 hover:bg-green-50/60 dark:hover:bg-green-900/10'
                          : 'hover:bg-green-50/60 dark:hover:bg-green-900/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm dark:text-white">{cls.name}</span>
                        {subject && (
                          <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${subject.color}15`, color: subject.color, borderColor: `${subject.color}40` }}>
                            {subject.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {teacher && <span>{teacher.nickname || teacher.name}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {cls.daysOfWeek?.map((d: number) => getDayName(d)).join(', ')} {formatTime(cls.startTime)}-{formatTime(cls.endTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {cls.enrolledCount}/{cls.maxStudents}
                          {isFull && <span className="text-red-500 font-medium">(เต็ม)</span>}
                        </span>
                      </div>
                      {/* Date range */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateCompact(cls.startDate)} - {formatDateCompact(cls.endDate)}
                        </span>
                        <span>{cls.totalSessions} ครั้ง</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-sm font-semibold dark:text-white">{formatCurrency(cls.pricing?.totalPrice || 0)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
      {/* Selected class session info */}
      {classInfo && classStats && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            <CheckCircle className="h-4 w-4" />
            {classInfo.cls.name}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDateCompact(classInfo.cls.startDate)} - {formatDateCompact(classInfo.cls.endDate)}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              เรียนไปแล้ว <span className="font-semibold text-green-600 dark:text-green-400">{classStats.completedSessions}</span>/{classStats.totalSessions} ครั้ง
            </span>
            {classStats.completedSessions > 0 && (
              <span className="text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                ต้องชดเชย {classStats.completedSessions} ครั้ง
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );

  const classSection = isChat ? (
    <EnrollmentSection isChat title="เลือกคลาส">
      <div className="space-y-3">
        <FormSelect
          value={selectedBranch}
          onValueChange={(v) => { setSelectedBranch(v); setSelectedClassId(''); setSelectedSubjectFilter('all'); }}
          placeholder="เลือกสาขา"
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={classSearchTerm}
            onChange={(e) => setClassSearchTerm(e.target.value)}
            placeholder="ค้นหาคลาส..."
            className="pl-10"
            disabled={!selectedBranch}
          />
        </div>
        {classListContent}
      </div>
    </EnrollmentSection>
  ) : (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">เลือกคลาส</CardTitle>
          <div className="w-40">
            <FormSelect
              value={selectedBranch}
              onValueChange={(v) => { setSelectedBranch(v); setSelectedClassId(''); setSelectedSubjectFilter('all'); }}
              placeholder="เลือกสาขา"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={classSearchTerm}
                onChange={(e) => setClassSearchTerm(e.target.value)}
                placeholder="ค้นหาคลาส..."
                className="pl-10"
                disabled={!selectedBranch}
              />
            </div>
            <FormSelect
              value={selectedSubjectFilter}
              onValueChange={setSelectedSubjectFilter}
              placeholder="ทุกวิชา"
              disabled={!selectedBranch}
              options={[
                { value: 'all', label: 'ทุกวิชา' },
                ...branchSubjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          {classListContent}
        </div>
      </CardContent>
    </Card>
  );

  const actualDiscountAmount = discountType === 'percent'
    ? Math.round((classInfo?.cls.pricing?.totalPrice || 0) * discount / 100)
    : discount;

  const priceSummary = classInfo && (
    <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-2">
      {/* Class info: dates + session progress */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDateCompact(classInfo.cls.startDate)} - {formatDateCompact(classInfo.cls.endDate)}</span>
        </div>
        {classStats && (
          <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              เรียนไปแล้ว {classStats.completedSessions}/{classStats.totalSessions} ครั้ง
            </span>
            {classStats.completedSessions > 0 && (
              <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                <AlertCircle className="h-3.5 w-3.5" />
                ต้องชดเชย {classStats.completedSessions} ครั้ง
              </span>
            )}
          </div>
        )}
      </div>
      <div className="border-t dark:border-slate-700" />
      {/* Price breakdown */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">ราคาคลาส ({classInfo.cls.name})</span>
        <span className="dark:text-white">{formatCurrency(classInfo.cls.pricing?.totalPrice || 0)}</span>
      </div>
      {actualDiscountAmount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>ส่วนลด{discountType === 'percent' ? ` (${discount}%)` : ''}</span>
          <span>-{formatCurrency(actualDiscountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t dark:border-slate-700 pt-1">
        <span className="dark:text-white">รวมทั้งสิ้น</span>
        <span className="text-blue-600">{formatCurrency(paymentAmount)}</span>
      </div>
    </div>
  );

  const defaultPaymentSettings: BranchPaymentSettings = {
    id: '', branchId: selectedBranch, enabledMethods: ['cash', 'bank_transfer', 'promptpay', 'credit_card'],
    bankAccounts: [], onlinePaymentEnabled: false,
  };

  const paymentSection = (
    <div className="space-y-4">
      {/* Payment Method - from branch settings */}
      <PaymentMethodSelector
        selectedMethod={paymentMethod}
        onMethodChange={setPaymentMethod}
        paymentSettings={branchPaymentSettings || defaultPaymentSettings}
        colorScheme="green"
        gridCols="grid-cols-4"
        label="วิธีชำระ *"
      />

      {/* Payment Type - Inline button group with icons */}
      <div className="space-y-1.5">
        <Label className="text-sm">ประเภท</Label>
        <div className="inline-flex gap-2">
          {[
            { value: 'full' as PaymentType, label: 'เต็มจำนวน', icon: <Banknote className="h-4 w-4" /> },
            { value: 'deposit' as PaymentType, label: 'มัดจำ', icon: <Wallet className="h-4 w-4" /> },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setPaymentType(t.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border-2 py-2 px-4 text-sm font-medium transition-all',
                paymentType === t.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-400'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-400 dark:hover:border-slate-600'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discount - inline input with toggle appended */}
      <div className="space-y-1.5">
        <Label className="text-sm">ส่วนลด</Label>
        <div className="flex items-center gap-0 max-w-xs">
          <Input
            type="number"
            value={discount || ''}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            placeholder="0"
            min={0}
            max={discountType === 'percent' ? 100 : undefined}
            className="rounded-r-none border-r-0"
          />
          <div className="inline-flex h-9 shrink-0 rounded-r-md border border-gray-300 dark:border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => { setDiscountType('fixed'); setDiscount(0); }}
              className={cn(
                'px-3 h-full text-sm font-medium transition-colors',
                discountType === 'fixed'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-400'
              )}
            >
              ฿
            </button>
            <button
              type="button"
              onClick={() => { setDiscountType('percent'); setDiscount(0); }}
              className={cn(
                'px-3 h-full text-sm font-medium transition-colors border-l border-gray-300 dark:border-slate-600',
                discountType === 'percent'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-400'
              )}
            >
              %
            </button>
          </div>
        </div>
      </div>

      {paymentType === 'deposit' && (
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-sm">จำนวนเงินมัดจำ (บาท)</Label>
          <Input
            type="number"
            value={paymentAmount || ''}
            onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
            placeholder="0"
            min={0}
          />
        </div>
      )}
    </div>
  );

  const addressFields = (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-sm">บ้านเลขที่</Label>
        <Input value={billingAddress.houseNumber} onChange={(e) => setBillingAddress(prev => ({ ...prev, houseNumber: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">ถนน</Label>
        <Input value={billingAddress.street} onChange={(e) => setBillingAddress(prev => ({ ...prev, street: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">แขวง/ตำบล</Label>
        <Input value={billingAddress.subDistrict} onChange={(e) => setBillingAddress(prev => ({ ...prev, subDistrict: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">เขต/อำเภอ</Label>
        <Input value={billingAddress.district} onChange={(e) => setBillingAddress(prev => ({ ...prev, district: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">จังหวัด</Label>
        <Input value={billingAddress.province} onChange={(e) => setBillingAddress(prev => ({ ...prev, province: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">รหัสไปรษณีย์</Label>
        <Input value={billingAddress.postalCode} onChange={(e) => setBillingAddress(prev => ({ ...prev, postalCode: e.target.value }))} />
      </div>
    </div>
  );

  const billingSection = (
    <div className="space-y-3">
      {/* Tax invoice toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="wantTaxInvoice"
          checked={wantTaxInvoice}
          onCheckedChange={(checked) => setWantTaxInvoice(!!checked)}
        />
        <Label htmlFor="wantTaxInvoice" className="text-sm font-medium cursor-pointer">
          ต้องการใบกำกับภาษี
        </Label>
      </div>

      {/* Tax invoice fields (inline) */}
      {wantTaxInvoice && (
        <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          {/* Billing type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={billingType === 'personal' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setBillingType('personal')}
            >
              บุคคลธรรมดา
            </Button>
            <Button
              type="button"
              variant={billingType === 'company' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setBillingType('company')}
            >
              นิติบุคคล
            </Button>
          </div>

          {/* Personal: pre-filled from parent, just add tax ID */}
          {billingType === 'personal' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">ชื่อ-นามสกุล</Label>
                  <Input
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">เบอร์โทร</Label>
                  <Input
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
              </div>
              {addressFields}
              <div className="space-y-1.5">
                <Label className="text-sm">เลขประจำตัวผู้เสียภาษี</Label>
                <Input
                  value={billingTaxId}
                  onChange={(e) => setBillingTaxId(e.target.value)}
                  placeholder="เลข 13 หลัก"
                  maxLength={13}
                />
              </div>
            </>
          )}

          {/* Company: all fresh fields */}
          {billingType === 'company' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm">ชื่อบริษัท / นิติบุคคล</Label>
                <Input
                  value={billingCompanyName}
                  onChange={(e) => setBillingCompanyName(e.target.value)}
                  placeholder="บริษัท xxx จำกัด"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">เลขประจำตัวผู้เสียภาษี</Label>
                  <Input
                    value={billingTaxId}
                    onChange={(e) => setBillingTaxId(e.target.value)}
                    placeholder="เลข 13 หลัก"
                    maxLength={13}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">สาขา</Label>
                  <Input
                    value={billingCompanyBranch}
                    onChange={(e) => setBillingCompanyBranch(e.target.value)}
                    placeholder="สำนักงานใหญ่"
                  />
                </div>
              </div>
              {addressFields}
            </>
          )}
        </div>
      )}
    </div>
  );

  const submitButton = (
    <div className={cn('flex gap-3 pt-2', isAdmin ? 'flex-col' : 'justify-end')}>
      <Button
        onClick={handleSubmit}
        disabled={submitting || !selectedClassId || (!selectedParentId && !parentName.trim())}
        className={cn(
          isLiff ? 'w-full bg-green-500 hover:bg-green-600' : 'w-full bg-red-500 hover:bg-red-600'
        )}
        size="lg"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังลงทะเบียน...</>
        ) : (
          'ลงทะเบียน'
        )}
      </Button>
      {onCancel && !isAdmin && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          ยกเลิก
        </Button>
      )}
    </div>
  );

  // ===================== ADMIN LAYOUT: Step wizard (like trial booking) =====================
  if (isAdmin) {
    const stepLabels = ['ผู้ปกครอง', 'นักเรียน', 'เลือกคลาส', 'ชำระเงิน'];
    const totalSteps = stepLabels.length;

    const stepIndicator = (
      <div className="flex items-center gap-1.5">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <div className={cn('h-px w-4 sm:w-6', isDone ? 'bg-green-400' : 'bg-gray-200')} />}
              <button
                type="button"
                onClick={() => { if (isDone) setStep(stepNum); }}
                disabled={!isDone}
                className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                  isActive && 'bg-gray-900 text-white',
                  isDone && 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200',
                  !isActive && !isDone && 'bg-gray-100 text-gray-400',
                )}
              >
                {stepNum}. {label}
              </button>
            </div>
          );
        })}
      </div>
    );

    const stepActions = (
      <div className="flex justify-between gap-3 pt-4">
        <div>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
          )}
          {step === 1 && onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step === totalSteps ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedClassId || (!selectedParentId && !parentName.trim())}
              className="bg-red-500 hover:bg-red-600"
            >
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังลงทะเบียน...</> : <><Save className="h-4 w-4 mr-2" />ลงทะเบียน</>}
            </Button>
          ) : (
            <Button onClick={goNext} className="bg-gray-900 hover:bg-gray-800">
              ถัดไป <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-5 max-w-4xl">
        {/* Page header */}
        <div className="mb-2">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">ลงทะเบียนเรียน</h1>
          {isFromTrial && trialParentName && (
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-cyan-100 text-cyan-700 gap-1">
                <TestTube className="h-3 w-3" />
                จากทดลองเรียน: {trialParentName}
              </Badge>
            </div>
          )}
        </div>

        {stepIndicator}

        {/* Step 1: Branch + Parent */}
        {step === 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ข้อมูลผู้ปกครอง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Branch */}
                <div className="space-y-1.5">
                  <Label>
                    <Building2 className="inline h-4 w-4 mr-1" />
                    สาขา <span className="text-red-500">*</span>
                  </Label>
                  <FormSelect
                    value={selectedBranch}
                    onValueChange={(v) => { setSelectedBranch(v); setSelectedClassId(''); setSelectedSubjectFilter('all'); clearError('branch'); }}
                    placeholder="เลือกสาขา"
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    className={errCls('branch')}
                  />
                </div>

                {/* Parent: linked or search+manual */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    <User className="inline h-4 w-4 mr-1" />
                    ผู้ปกครอง
                  </Label>
                  {parentMode === 'linked' ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <User className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-base">{parentName}</p>
                        <p className="text-sm text-gray-500">{parentPhone}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 shrink-0">เชื่อมแล้ว</Badge>
                      <Button variant="ghost" size="sm" onClick={() => { setParentMode('search'); setSelectedParentId(''); setParentName(''); setParentPhone(''); setExistingStudents([]); setStudentMode('new'); setFocusSearchOnMount(true); }}>
                        เปลี่ยน
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ParentSearchInput ref={parentSearchRef} onSelect={handleParentSelect} autoFocus={focusSearchOnMount} />
                      {!selectedParentId && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>ชื่อผู้ปกครอง <span className="text-red-500">*</span></Label>
                            <Input value={parentName} onChange={(e) => { setParentName(e.target.value); clearError('parentName'); }} placeholder="ชื่อ-นามสกุล" className={errCls('parentName')} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>เบอร์โทร <span className="text-red-500">*</span></Label>
                            <Input value={parentPhone} onChange={(e) => { setParentPhone(e.target.value); clearError('parentPhone'); }} placeholder="08x-xxx-xxxx" className={errCls('parentPhone')} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Student */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">นักเรียน</CardTitle>
                {existingStudents.length > 0 && (
                  <Button
                    variant={studentMode === 'new' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setStudentMode('new'); setSelectedStudentId(''); }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    เพิ่มนักเรียนใหม่
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Existing students list */}
              {existingStudents.length > 0 && studentMode !== 'new' && (
                <div className="border rounded-lg divide-y">
                  {existingStudents.map((s, idx) => {
                    const isSelected = studentMode === 'existing' && selectedStudentId === s.id;
                    const onlyOne = existingStudents.length === 1;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setStudentMode('existing'); setSelectedStudentId(s.id); clearError('student'); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg',
                          isSelected
                            ? 'bg-green-100'
                            : idx % 2 === 1
                              ? 'bg-gray-50/50 hover:bg-green-50/60'
                              : 'hover:bg-green-50/60'
                        )}
                      >
                        {isSelected && !onlyOne ? (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <User className="h-4 w-4 text-gray-400 shrink-0" />
                        )}
                        <span className="font-semibold text-base min-w-[60px]">{s.nickname || '-'}</span>
                        <span className="text-sm text-gray-500">{s.name}</span>
                        {s.schoolName && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                            <School className="h-3 w-3 shrink-0" />
                            {s.schoolName}
                          </span>
                        )}
                        {s.gradeLevel && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <GraduationCap className="h-3 w-3 shrink-0" />
                            {s.gradeLevel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* New student form */}
              {studentMode === 'new' && (
                <div className="space-y-3">
                  {existingStudents.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500"
                      onClick={() => { setStudentMode('existing'); setSelectedStudentId(existingStudents[0]?.id || ''); }}
                    >
                      ← เลือกนักเรียนที่มีอยู่
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                      <Input value={studentName} onChange={(e) => { setStudentName(e.target.value); clearError('studentName'); }} placeholder="ชื่อ-นามสกุล" className={errCls('studentName')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>ชื่อเล่น <span className="text-red-500">*</span></Label>
                      <Input value={studentNickname} onChange={(e) => { setStudentNickname(e.target.value); clearError('studentNickname'); }} placeholder="ชื่อเล่น" className={errCls('studentNickname')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>วันเกิด <span className="text-red-500">*</span></Label>
                      <DateRangePicker mode="single" value={studentBirthdate} onChange={(d) => { setStudentBirthdate(d || ''); clearError('studentBirthdate'); }} maxDate={new Date()} placeholder="เลือกวันที่" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>เพศ <span className="text-red-500">*</span></Label>
                      <FormSelect
                        value={studentGender}
                        onValueChange={(v) => setStudentGender(v as 'M' | 'F')}
                        options={[{ value: 'M', label: 'ชาย' }, { value: 'F', label: 'หญิง' }]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>โรงเรียน</Label>
                      <SchoolNameCombobox value={studentSchoolName} onChange={setStudentSchoolName} placeholder="พิมพ์ชื่อโรงเรียน..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>ระดับชั้น</Label>
                      <GradeLevelCombobox value={studentGradeLevel} onChange={setStudentGradeLevel} placeholder="เลือกหรือพิมพ์ระดับชั้น..." />
                    </div>
                  </div>
                </div>
              )}

              {/* No students yet — show new student form */}
              {existingStudents.length === 0 && studentMode !== 'new' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>ชื่อ-นามสกุล <span className="text-red-500">*</span></Label>
                    <Input value={studentName} onChange={(e) => { setStudentName(e.target.value); clearError('studentName'); }} placeholder="ชื่อ-นามสกุล" className={errCls('studentName')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ชื่อเล่น <span className="text-red-500">*</span></Label>
                    <Input value={studentNickname} onChange={(e) => { setStudentNickname(e.target.value); clearError('studentNickname'); }} placeholder="ชื่อเล่น" className={errCls('studentNickname')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>วันเกิด <span className="text-red-500">*</span></Label>
                    <DateRangePicker mode="single" value={studentBirthdate} onChange={(d) => { setStudentBirthdate(d || ''); clearError('studentBirthdate'); }} maxDate={new Date()} placeholder="เลือกวันที่" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>เพศ <span className="text-red-500">*</span></Label>
                    <FormSelect
                      value={studentGender}
                      onValueChange={(v) => setStudentGender(v as 'M' | 'F')}
                      options={[{ value: 'M', label: 'ชาย' }, { value: 'F', label: 'หญิง' }]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>โรงเรียน</Label>
                    <SchoolNameCombobox value={studentSchoolName} onChange={setStudentSchoolName} placeholder="พิมพ์ชื่อโรงเรียน..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ระดับชั้น</Label>
                    <GradeLevelCombobox value={studentGradeLevel} onChange={setStudentGradeLevel} placeholder="เลือกหรือพิมพ์ระดับชั้น..." />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Class Selection */}
        {step === 3 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">เลือกคลาส</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={classSearchTerm}
                      onChange={(e) => setClassSearchTerm(e.target.value)}
                      placeholder="ค้นหาคลาส..."
                      className="pl-10"
                      disabled={!selectedBranch}
                    />
                  </div>
                  <FormSelect
                    value={selectedSubjectFilter}
                    onValueChange={setSelectedSubjectFilter}
                    placeholder="ทุกวิชา"
                    disabled={!selectedBranch}
                    options={[
                      { value: 'all', label: 'ทุกวิชา' },
                      ...branchSubjects.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>

                {!selectedBranch ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                    กรุณาเลือกสาขาก่อน (กลับไป Step 1)
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-80 overflow-y-auto">
                    {filteredClasses.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-sm">ไม่พบคลาส</div>
                    ) : (
                      filteredClasses.map((cls, idx) => {
                        const subject = subjects.find((s) => s.id === cls.subjectId);
                        const teacher = teachers.find((t) => t.id === cls.teacherId);
                        const isSelected = selectedClassId === cls.id;
                        const availableSeats = cls.maxStudents - cls.enrolledCount;
                        const isFull = availableSeats <= 0;

                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => { if (!isFull) { setSelectedClassId(cls.id); clearError('classId'); } }}
                            disabled={isFull}
                            className={cn(
                              'w-full px-4 py-3 text-left border-b last:border-b-0 transition-colors',
                              isFull
                                ? 'bg-red-50 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-green-100'
                                  : idx % 2 === 1
                                    ? 'bg-gray-50/50 hover:bg-green-50/60'
                                    : 'hover:bg-green-50/60'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{cls.name}</span>
                                  {subject && (
                                    <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${subject.color}15`, color: subject.color, borderColor: `${subject.color}40` }}>
                                      {subject.name}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  {teacher && <span>{teacher.nickname || teacher.name}</span>}
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {cls.daysOfWeek?.map((d: number) => getDayName(d)).join(', ')} {formatTime(cls.startTime)}-{formatTime(cls.endTime)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {cls.enrolledCount}/{cls.maxStudents}
                                    {isFull && <span className="text-red-500 font-medium">(เต็ม)</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateCompact(cls.startDate)} - {formatDateCompact(cls.endDate)}
                                  </span>
                                  <span>{cls.totalSessions} ครั้ง</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className="text-sm font-semibold">{formatCurrency(cls.pricing?.totalPrice || 0)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Selected class detail - session progress */}
                {classInfo && classStats && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      {classInfo.cls.name}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDateCompact(classInfo.cls.startDate)} - {formatDateCompact(classInfo.cls.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm">
                      <span className="text-gray-600">
                        เรียนไปแล้ว <span className="font-semibold text-green-600">{classStats.completedSessions}</span>/{classStats.totalSessions} ครั้ง
                      </span>
                      {classStats.completedSessions > 0 && (
                        <span className="text-orange-600 font-medium flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          ต้องชดเชย {classStats.completedSessions} ครั้ง
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Payment + Billing + Summary */}
        {step === 4 && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">สรุปราคา</CardTitle>
              </CardHeader>
              <CardContent>
                {classInfo ? priceSummary : (
                  <p className="text-sm text-gray-400 text-center py-4">ไม่พบข้อมูลคลาส</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">การชำระเงิน</CardTitle>
              </CardHeader>
              <CardContent>{paymentSection}</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ใบกำกับภาษี</CardTitle>
              </CardHeader>
              <CardContent>{billingSection}</CardContent>
            </Card>
          </div>
        )}

        {stepActions}
      </div>
    );
  }

  // ===================== CHAT / LIFF LAYOUT: single column compact =====================
  return (
    <div className={cn(isChat ? 'space-y-5' : 'space-y-6')}>
      {parentSection}
      {studentSection}
      {classSection}

      {classInfo && (
        <EnrollmentSection isChat={isChat} title="การชำระเงิน">
          <div className="space-y-3">
            {priceSummary}
            {paymentSection}
            {billingSection}
          </div>
        </EnrollmentSection>
      )}

      {submitButton}
    </div>
  );
}

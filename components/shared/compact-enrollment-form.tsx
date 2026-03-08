'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatCurrency, getDayName, calculateAge, formatTime } from '@/lib/utils';
import {
  Loader2, Search, User, CheckCircle, ArrowLeft, Users,
  Clock, Calendar, ChevronDown, ChevronUp, AlertCircle, TestTube,
  School, GraduationCap, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Class, Subject, Teacher, Branch, Student, PaymentMethod, PaymentType } from '@/types/models';
import { getClasses } from '@/lib/services/classes';
import { getSubjects } from '@/lib/services/subjects';
import { getTeachers } from '@/lib/services/teachers';
import { getBranches, getActiveBranches } from '@/lib/services/branches';
import { getParentByPhone, getStudentsByParent } from '@/lib/services/parents';
import { ParentSearchInput, ParentSearchSelection, ParentSearchInputRef } from '@/components/shared/parent-search-input';
import { checkAvailableSeats, checkDuplicateEnrollment, getEnrollmentsByStudent } from '@/lib/services/enrollments';
import { processUnifiedEnrollment, UnifiedEnrollmentResult } from '@/lib/services/unified-enrollment';
import { getTrialBooking, getTrialSessionsByBooking } from '@/lib/services/trial-bookings';
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

  // Class section
  const [selectedBranch, setSelectedBranch] = useState(prefill?.branchId || '');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classInfo, setClassInfo] = useState<{ cls: Class; subject: Subject | null; teacher: Teacher | null } | null>(null);
  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set());

  // Payment section
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('' as PaymentMethod);
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [discount, setDiscount] = useState(0);

  // Billing section
  const [wantTaxInvoice, setWantTaxInvoice] = useState(false);
  const [billingType, setBillingType] = useState<'personal' | 'company'>('personal');
  const [billingName, setBillingName] = useState('');
  const [billingTaxId, setBillingTaxId] = useState('');
  const [billingCompanyBranch, setBillingCompanyBranch] = useState('');
  const [billingAddress, setBillingAddress] = useState({
    houseNumber: '', street: '', subDistrict: '', district: '', province: '', postalCode: '',
  });

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
  };

  // Update class info when selected
  useEffect(() => {
    if (!selectedClassId) { setClassInfo(null); return; }
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) { setClassInfo(null); return; }
    const subject = subjects.find((s) => s.id === cls.subjectId) || null;
    const teacher = teachers.find((t) => t.id === cls.teacherId) || null;
    setClassInfo({ cls, subject, teacher });
    // Auto-set payment amount from class pricing
    const price = cls.pricing?.totalPrice || 0;
    const finalPrice = discount > 0 ? Math.max(0, price - discount) : price;
    setPaymentAmount(finalPrice);
  }, [selectedClassId, classes, subjects, teachers, discount]);

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

  // Auto-fill billing name when parent name changes
  useEffect(() => {
    if (!billingName && parentName) {
      setBillingName(parentName);
    }
  }, [parentName]);

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
    if (selectedSubjectFilter) {
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
              classId: selectedClassId,
            },
          ],
          discount,
          discountType: 'fixed',
          paymentMethod,
          paymentType,
          initialPaymentAmount: paymentAmount,
          // Billing
          wantTaxInvoice,
          billingType: wantTaxInvoice ? billingType : undefined,
          billingName: wantTaxInvoice ? billingName : undefined,
          billingAddress: wantTaxInvoice ? billingAddress : undefined,
          billingTaxId: wantTaxInvoice ? billingTaxId : undefined,
          billingCompanyBranch: wantTaxInvoice ? billingCompanyBranch : undefined,
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
          <Button variant="ghost" size="sm" onClick={() => { setParentMode('search'); setSelectedParentId(''); setParentName(''); setParentPhone(''); setExistingStudents([]); setStudentMode('new'); setTimeout(() => parentSearchRef.current?.focus(), 100); }}>
            เปลี่ยน
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <ParentSearchInput ref={parentSearchRef} onSelect={handleParentSelect} />
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
    </>
  );

  const classSection = isChat ? (
    <EnrollmentSection isChat title="เลือกคลาส">
      <div className="space-y-3">
        <FormSelect
          value={selectedBranch}
          onValueChange={(v) => { setSelectedBranch(v); setSelectedClassId(''); setSelectedSubjectFilter(''); }}
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
              onValueChange={(v) => { setSelectedBranch(v); setSelectedClassId(''); setSelectedSubjectFilter(''); }}
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
                { value: '', label: 'ทุกวิชา' },
                ...branchSubjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          {classListContent}
        </div>
      </CardContent>
    </Card>
  );

  const priceSummary = classInfo && (
    <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">ราคาคลาส ({classInfo.cls.name})</span>
        <span className="dark:text-white">{formatCurrency(classInfo.cls.pricing?.totalPrice || 0)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>ส่วนลด</span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t dark:border-slate-700 pt-1">
        <span className="dark:text-white">รวมทั้งสิ้น</span>
        <span className="text-blue-600">{formatCurrency(paymentAmount)}</span>
      </div>
    </div>
  );

  const paymentSection = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">วิธีชำระ *</Label>
          <FormSelect
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            placeholder="เลือกวิธี"
            options={[
              { value: 'cash', label: 'เงินสด' },
              { value: 'bank_transfer', label: 'โอนเงิน' },
              { value: 'promptpay', label: 'PromptPay' },
              { value: 'credit_card', label: 'บัตรเครดิต' },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">ประเภท</Label>
          <FormSelect
            value={paymentType}
            onValueChange={(v) => setPaymentType(v as PaymentType)}
            options={[
              { value: 'full', label: 'เต็มจำนวน' },
              { value: 'deposit', label: 'มัดจำ' },
            ]}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">ส่วนลด (บาท)</Label>
        <Input
          type="number"
          value={discount || ''}
          onChange={(e) => setDiscount(Number(e.target.value) || 0)}
          placeholder="0"
          min={0}
        />
      </div>
      {paymentType === 'deposit' && (
        <div className="space-y-1.5">
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

  const billingSection = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="wantTaxInvoice"
          checked={wantTaxInvoice}
          onCheckedChange={(checked) => {
            setWantTaxInvoice(!!checked);
            if (checked && !billingName) setBillingName(parentName);
          }}
        />
        <Label htmlFor="wantTaxInvoice" className="text-sm font-medium cursor-pointer">
          ต้องการใบกำกับภาษี
        </Label>
      </div>

      {wantTaxInvoice && (
        <div className="space-y-3 pt-1">
          {/* Billing type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={billingType === 'personal' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => {
                setBillingType('personal');
                if (!billingName) setBillingName(parentName);
              }}
            >
              บุคคลธรรมดา
            </Button>
            <Button
              type="button"
              variant={billingType === 'company' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => {
                setBillingType('company');
                if (billingType === 'personal') setBillingName('');
              }}
            >
              นิติบุคคล
            </Button>
          </div>

          {/* Billing name */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              {billingType === 'company' ? 'ชื่อบริษัท / นิติบุคคล' : 'ชื่อออกบิล'}
            </Label>
            <Input
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              placeholder={billingType === 'company' ? 'บริษัท xxx จำกัด' : ''}
            />
          </div>

          {/* Tax ID + company branch */}
          <div className={cn('grid gap-3', billingType === 'company' ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-1.5">
              <Label className="text-sm">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                value={billingTaxId}
                onChange={(e) => setBillingTaxId(e.target.value)}
                placeholder="เลข 13 หลัก"
                maxLength={13}
              />
            </div>
            {billingType === 'company' && (
              <div className="space-y-1.5">
                <Label className="text-sm">สาขา</Label>
                <Input
                  value={billingCompanyBranch}
                  onChange={(e) => setBillingCompanyBranch(e.target.value)}
                  placeholder="สำนักงานใหญ่"
                />
              </div>
            )}
          </div>

          {/* Address */}
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

  // ===================== ADMIN LAYOUT: 2-column full-width =====================
  if (isAdmin) {
    return (
      <div>
        {/* Page header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={onCancel} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> กลับ
          </Button>
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

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Left column: Parent + Student + Class */}
          <div className="lg:col-span-3 space-y-6">
            {parentSection}
            {studentSection}
            {classSection}
          </div>

          {/* Right column: Summary + Payment + Billing + Submit (sticky) */}
          <div className="lg:col-span-2 lg:sticky lg:top-4 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">สรุปราคา</CardTitle>
              </CardHeader>
              <CardContent>
                {classInfo ? priceSummary : (
                  <p className="text-sm text-gray-400 text-center py-4">เลือกคลาสเพื่อดูราคา</p>
                )}
              </CardContent>
            </Card>

            {classInfo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">การชำระเงิน</CardTitle>
                </CardHeader>
                <CardContent>{paymentSection}</CardContent>
              </Card>
            )}

            {classInfo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">ใบกำกับภาษี</CardTitle>
                </CardHeader>
                <CardContent>{billingSection}</CardContent>
              </Card>
            )}

            {submitButton}
          </div>
        </div>
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

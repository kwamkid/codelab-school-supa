'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { cn } from '@/lib/utils';
import { formatCurrency, getDayName, calculateAge } from '@/lib/utils';
import {
  Loader2, Search, User, Phone, CheckCircle, ArrowLeft, Users,
  Clock, Calendar, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Class, Subject, Teacher, Branch, Student, PaymentMethod, PaymentType } from '@/types/models';
import { getClasses } from '@/lib/services/classes';
import { getSubjects } from '@/lib/services/subjects';
import { getTeachers } from '@/lib/services/teachers';
import { getBranches, getActiveBranches } from '@/lib/services/branches';
import { getParentByPhone, getStudentsByParent, searchParentsUnified } from '@/lib/services/parents';
import { checkAvailableSeats, checkDuplicateEnrollment } from '@/lib/services/enrollments';
import { processUnifiedEnrollment, UnifiedEnrollmentResult } from '@/lib/services/unified-enrollment';
import { useAuth } from '@/hooks/useAuth';

export interface CompactEnrollmentFormProps {
  context: 'admin' | 'liff' | 'chat';
  prefill?: {
    parentId?: string;
    parentName?: string;
    parentPhone?: string;
    contactId?: string;
    conversationId?: string;
    branchId?: string;
  };
  onSuccess?: (result: { enrollmentId: string; invoiceId?: string }) => void;
  onCancel?: () => void;
}

export function CompactEnrollmentForm({ context, prefill, onSuccess, onCancel }: CompactEnrollmentFormProps) {
  const isAdmin = context === 'admin';
  const isLiff = context === 'liff';
  const isChat = context === 'chat';

  const { adminUser } = useAuth();
  const submitGuardRef = useRef(false);

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
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
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
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classInfo, setClassInfo] = useState<{ cls: Class; subject: Subject | null; teacher: Teacher | null } | null>(null);

  // Payment section
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('' as PaymentMethod);
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [showPayment, setShowPayment] = useState(true);

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

  // Parent search
  useEffect(() => {
    if (!parentSearchTerm || parentSearchTerm.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchParentsUnified(parentSearchTerm);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [parentSearchTerm]);

  // When parent selected, load students
  const selectParent = async (parentId: string, name: string, phone: string) => {
    setSelectedParentId(parentId);
    setParentName(name);
    setParentPhone(phone);
    setParentMode('linked');
    setSearchResults([]);
    setParentSearchTerm('');
    try {
      const students = await getStudentsByParent(parentId);
      setExistingStudents(students);
      if (students.length > 0) setStudentMode('existing');
    } catch {}
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
    return filtered;
  }, [classes, classSearchTerm, subjects, teachers]);

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
          source: 'new',
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

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
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
  };

  return (
    <div className={cn(isChat ? 'space-y-5' : 'space-y-6', isAdmin && 'max-w-3xl')}>
      {/* Header (admin) */}
      {isAdmin && (
        <div className="mb-4">
          <Button variant="ghost" onClick={onCancel} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> กลับ
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">ลงทะเบียนเรียน (แบบย่อ)</h1>
        </div>
      )}

      {/* Section 1: Parent */}
      <Section title="ผู้ปกครอง">
        {parentMode === 'linked' ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <User className="h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-base dark:text-white">{parentName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{parentPhone}</p>
            </div>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 shrink-0">เชื่อมแล้ว</Badge>
            <Button variant="ghost" size="sm" onClick={() => { setParentMode('search'); setSelectedParentId(''); setExistingStudents([]); setStudentMode('new'); }}>
              เปลี่ยน
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search existing parent */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={parentSearchTerm}
                onChange={(e) => { setParentSearchTerm(e.target.value); setParentMode('search'); }}
                placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
                className="pl-10"
              />
            </div>

            {/* Search results */}
            {searching && <div className="text-sm text-gray-500 text-center py-2"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />กำลังค้นหา...</div>}
            {searchResults.length > 0 && (
              <div className="border rounded-lg dark:border-slate-700 max-h-40 overflow-y-auto">
                {searchResults.map((r: any) => (
                  <button
                    key={r.parent.id}
                    type="button"
                    onClick={() => selectParent(r.parent.id, r.parent.displayName || r.parent.phone, r.parent.phone)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 border-b last:border-b-0 dark:border-slate-700"
                  >
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium dark:text-white">{r.parent.displayName || 'ไม่ระบุชื่อ'}</span>
                      <span className="text-xs text-gray-500 ml-2">{r.parent.phone}</span>
                    </div>
                    {r.students?.length > 0 && (
                      <span className="text-xs text-gray-400">{r.students.length} นักเรียน</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* New parent form */}
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
      </Section>

      {/* Section 2: Student */}
      <Section title="นักเรียน">
        {/* Quick-select existing students */}
        {existingStudents.length > 0 && (
          <div className="space-y-2 mb-3">
            <Label className="text-xs text-gray-500">เลือกนักเรียนที่มีอยู่</Label>
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

        {/* New student form */}
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

        {/* Selected existing student info */}
        {studentMode === 'existing' && selectedStudentId && (() => {
          const s = existingStudents.find((st) => st.id === selectedStudentId);
          return s ? (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              <span className="font-medium dark:text-white">{s.name}</span>
              {s.nickname && <span className="text-gray-500 dark:text-gray-400"> ({s.nickname})</span>}
            </div>
          ) : null;
        })()}
      </Section>

      {/* Section 3: Class */}
      <Section title="เลือกคลาส">
        <div className="space-y-3">
          {/* Branch + Search */}
          <div className="grid grid-cols-2 gap-3">
            <FormSelect
              value={selectedBranch}
              onValueChange={(v) => { setSelectedBranch(v); setSelectedClassId(''); }}
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
          </div>

          {/* Class list */}
          {selectedBranch && (
            <div className="border rounded-lg dark:border-slate-700 max-h-60 overflow-y-auto">
              {filteredClasses.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">ไม่พบคลาส</div>
              ) : (
                filteredClasses.map((cls) => {
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
                        'w-full px-3 py-2.5 text-left border-b last:border-b-0 dark:border-slate-700 transition-colors',
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-slate-800',
                        isFull && 'opacity-50 cursor-not-allowed'
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
                              {cls.daysOfWeek?.map((d: number) => getDayName(d)).join(', ')} {cls.startTime}-{cls.endTime}
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
        </div>
      </Section>

      {/* Section 4: Payment */}
      {classInfo && (
        <Section title="การชำระเงิน">
          <div className="space-y-3">
            {/* Price summary */}
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

            {/* Payment options */}
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

            {/* Discount */}
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
        </Section>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            ยกเลิก
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !selectedClassId || (!selectedParentId && !parentName.trim())}
          className={cn(isLiff ? 'w-full bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600')}
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

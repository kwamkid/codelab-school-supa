'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { GradeLevelCombobox } from '@/components/ui/grade-level-combobox';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { SubjectSelector } from './subject-selector';
import { ParentSearchInput, ParentSearchSelection } from './parent-search-input';
import { cn } from '@/lib/utils';
import { calculateAge } from '@/lib/utils';
import {
  ArrowLeft, Save, Plus, Trash2, User, Phone, Building2, Calendar,
  Loader2, AlertCircle, CheckCircle2, XCircle, Info, ChevronRight, ChevronLeft, CheckCircle, School, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Subject, Teacher, Branch, Room, Student } from '@/types/models';
import { getSubjects } from '@/lib/services/subjects';
import { getBranches, getActiveBranches } from '@/lib/services/branches';
import { getTeachers } from '@/lib/services/teachers';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { createTrialBooking, createTrialSession } from '@/lib/services/trial-bookings';
import { AvailabilityIssue } from '@/lib/utils/availability';

interface StudentForm {
  id: string; // stable key
  name: string;
  birthdate: string;
  schoolName: string;
  gradeLevel: string;
  subjectInterests: string[];
}

export interface TrialBookingFormProps {
  context: 'admin' | 'liff' | 'chat';
  prefill?: {
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    branchId?: string;
    contactId?: string;
    conversationId?: string;
    parentId?: string;
  };
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

let nextStudentId = Date.now();
function makeStudent(): StudentForm {
  return { id: `s-${nextStudentId++}`, name: '', birthdate: '', schoolName: '', gradeLevel: '', subjectInterests: [] };
}

// Section wrapper — must be outside the main component to avoid re-mount on every render
function Section({ children, title, headerRight, isChat }: { children: React.ReactNode; title?: string; headerRight?: React.ReactNode; isChat?: boolean }) {
  if (isChat) return <div className="space-y-3">{children}</div>;
  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{title}</CardTitle>
            {headerRight}
          </div>
        </CardHeader>
      )}
      <CardContent className={title ? undefined : 'pt-6'}>{children}</CardContent>
    </Card>
  );
}

export function TrialBookingForm({ context, prefill, onSuccess, onCancel }: TrialBookingFormProps) {
  const isAdmin = context === 'admin';
  const isLiff = context === 'liff';
  const isChat = context === 'chat';
  const showSessionStep = !isLiff;

  // Loading & data
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Step state: 1=parent, 2=students, 3=session
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Inline validation errors: key = field name, value = error message
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: Parent
  const [parentMode, setParentMode] = useState<'search' | 'linked'>('search');
  const [selectedParentId, setSelectedParentId] = useState(prefill?.parentId || '');
  const [parentName, setParentName] = useState(prefill?.parentName || '');
  const [parentPhone, setParentPhone] = useState(prefill?.parentPhone || '');
  const [selectedBranch, setSelectedBranch] = useState(prefill?.branchId || '');
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);

  // Step 2: Students (with sub-steps)
  const [students, setStudents] = useState<StudentForm[]>([makeStudent()]);
  const [activeStudentIdx, setActiveStudentIdx] = useState(0);
  const [contactNote, setContactNote] = useState('');

  // Step 3: Session scheduling
  const [sessionData, setSessionData] = useState({
    studentIndex: 0,
    subjectId: '',
    scheduledDate: '',
    startTime: '10:00',
    endTime: '11:00',
    teacherId: '',
    roomId: '',
  });
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityIssues, setAvailabilityIssues] = useState<AvailabilityIssue[]>([]);

  // Total steps
  const totalSteps = showSessionStep ? 3 : 2;

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [subjectsData, branchesData] = await Promise.all([
          getSubjects(),
          isLiff ? getActiveBranches() : getBranches(),
        ]);
        setSubjects(subjectsData.filter((s) => s.isActive));
        setBranches(branchesData.filter((b) => b.isActive));
        if (showSessionStep) {
          const teachersData = await getTeachers();
          setTeachers(teachersData.filter((t) => t.isActive));
        }
      } catch {
        toast.error('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Set default branch from prefill
  useEffect(() => {
    if (prefill?.branchId && !selectedBranch && branches.length > 0) {
      if (branches.find((b) => b.id === prefill.branchId)) {
        setSelectedBranch(prefill.branchId!);
      }
    }
  }, [prefill?.branchId, branches, selectedBranch]);


  // Load rooms when branch changes
  useEffect(() => {
    if (!selectedBranch || !showSessionStep) return;
    getRoomsByBranch(selectedBranch)
      .then((data) => setRooms(data.filter((r) => r.isActive)))
      .catch(() => setRooms([]));
  }, [selectedBranch, showSessionStep]);

  // Auto-calculate end time
  useEffect(() => {
    if (sessionData.startTime) {
      const [h, m] = sessionData.startTime.split(':').map(Number);
      const endH = h + 1;
      if (endH < 24) {
        setSessionData((prev) => ({
          ...prev,
          endTime: `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        }));
      }
    }
  }, [sessionData.startTime]);

  // Availability check (debounced)
  useEffect(() => {
    if (!showSessionStep) return;
    const { scheduledDate, startTime, endTime, teacherId, roomId } = sessionData;
    if (!scheduledDate || !startTime || !endTime || !selectedBranch || !roomId || !teacherId) {
      setAvailabilityIssues([]);
      return;
    }
    setCheckingAvailability(true);
    const timer = setTimeout(async () => {
      try {
        const { checkAvailability } = await import('@/lib/utils/availability');
        const result = await checkAvailability({
          date: new Date(scheduledDate), startTime, endTime,
          branchId: selectedBranch, roomId, teacherId, excludeType: 'trial',
        });
        setAvailabilityIssues(result.available ? [] : result.reasons);
      } catch { /* ignore */ } finally { setCheckingAvailability(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [sessionData, selectedBranch, showSessionStep]);

  // Filter teachers by subject + branch
  const availableTeachers = useMemo(
    () => teachers.filter((t) =>
      (!sessionData.subjectId || t.specialties.includes(sessionData.subjectId)) &&
      (!selectedBranch || t.availableBranches.includes(selectedBranch))
    ),
    [teachers, sessionData.subjectId, selectedBranch]
  );

  // ─── Student helpers (stable callbacks) ───
  const updateStudent = useCallback((idx: number, field: keyof StudentForm, value: any) => {
    setStudents(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const toggleSubject = useCallback((studentIdx: number, subjectId: string) => {
    setStudents(prev => {
      const updated = [...prev];
      const interests = updated[studentIdx].subjectInterests;
      updated[studentIdx] = {
        ...updated[studentIdx],
        subjectInterests: interests.includes(subjectId)
          ? interests.filter((id) => id !== subjectId)
          : [...interests, subjectId],
      };
      return updated;
    });
  }, []);

  const addStudent = useCallback(() => {
    setStudents(prev => {
      const newStudents = [...prev, makeStudent()];
      setActiveStudentIdx(newStudents.length - 1);
      return newStudents;
    });
  }, []);

  const removeStudent = useCallback((idx: number) => {
    setStudents(prev => {
      if (prev.length <= 1) return prev;
      const newStudents = prev.filter((_, i) => i !== idx);
      setActiveStudentIdx(Math.min(idx, newStudents.length - 1));
      return newStudents;
    });
  }, []);

  // ─── Parent search handler ───
  const handleParentSelect = useCallback((selection: ParentSearchSelection) => {
    setSelectedParentId(selection.parentId);
    setParentName(selection.parentName);
    setParentPhone(selection.parentPhone);
    setParentMode('linked');
    setExistingStudents(selection.students || []);
    // Pre-fill students from existing data
    if (selection.students && selection.students.length > 0) {
      const prefilled: StudentForm[] = selection.students.map((s) => ({
        id: `s-${nextStudentId++}`,
        name: s.name || '',
        birthdate: s.birthdate ? new Date(s.birthdate).toISOString().split('T')[0] : '',
        schoolName: s.schoolName || '',
        gradeLevel: s.gradeLevel || '',
        subjectInterests: [],
      }));
      setStudents(prefilled);
      setActiveStudentIdx(0);
    }
  }, []);

  const handleChangeParent = useCallback(() => {
    setSelectedParentId('');
    setParentName('');
    setParentPhone('');
    setParentMode('search');
    setExistingStudents([]);
    setStudents([makeStudent()]);
    setActiveStudentIdx(0);
  }, []);

  // ─── Clear single error on change ───
  const clearError = useCallback((key: string) => {
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // ─── Validation per step ───
  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (s === 1) {
      if (!selectedBranch) newErrors.branch = 'กรุณาเลือกสาขา';
      if (!parentName.trim()) newErrors.parentName = 'กรุณากรอกชื่อผู้ปกครอง';
      if (!parentPhone.trim()) {
        newErrors.parentPhone = 'กรุณากรอกเบอร์โทรศัพท์';
      } else {
        const cleanPhone = parentPhone.replace(/[-\s]/g, '');
        if (!/^0[0-9]{8,9}$/.test(cleanPhone)) newErrors.parentPhone = 'เบอร์โทรศัพท์ไม่ถูกต้อง';
      }
    }

    if (s === 2) {
      for (let i = 0; i < students.length; i++) {
        const st = students[i];
        if (!st.name.trim()) newErrors[`student_${i}_name`] = 'กรุณากรอกชื่อนักเรียน';
        if (st.subjectInterests.length === 0) newErrors[`student_${i}_subjects`] = 'กรุณาเลือกวิชาที่สนใจ';
      }
      // Navigate to the first student with an error
      const firstErrIdx = students.findIndex((_, i) => newErrors[`student_${i}_name`] || newErrors[`student_${i}_subjects`]);
      if (firstErrIdx >= 0) setActiveStudentIdx(firstErrIdx);
    }

    if (s === 3) {
      if (!sessionData.subjectId) newErrors.sessionSubject = 'กรุณาเลือกวิชา';
      if (!sessionData.scheduledDate) newErrors.sessionDate = 'กรุณาเลือกวันที่';
      if (!sessionData.teacherId) newErrors.sessionTeacher = 'กรุณาเลือกครูผู้สอน';
      if (!sessionData.roomId) newErrors.sessionRoom = 'กรุณาเลือกห้องเรียน';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      return false;
    }
    return true;
  };

  const goNext = () => { if (validateStep(step)) setStep(step + 1); };
  const goPrev = () => setStep(step - 1);

  // Error display helpers
  const errCls = (key: string) => errors[key] ? 'border-red-500 ring-1 ring-red-500' : '';
  const FieldError = ({ name }: { name: string }) => errors[name] ? <p className="text-red-500 text-xs mt-1">{errors[name]}</p> : null;

  // ─── Submit ───
  const handleSubmit = async (withSession: boolean) => {
    if (submitGuardRef.current) return;
    // Validate all prior steps
    for (let s = 1; s <= Math.min(step, 2); s++) {
      if (!validateStep(s)) return;
    }

    if (withSession) {
      if (!validateStep(3)) return;
      if (availabilityIssues.length > 0) { toast.error('ไม่สามารถจองเวลานี้ได้'); return; }
    }

    submitGuardRef.current = true;
    setSubmitting(true);

    try {
      const source = isLiff ? 'online' : isChat ? ('online' as const) : ('walkin' as const);
      const status = isAdmin ? 'contacted' : 'new';

      const bookingData: any = {
        source,
        parentName: parentName.trim(),
        parentPhone: parentPhone.replace(/[-\s]/g, ''),
        branchId: selectedBranch,
        students: students.map((s) => {
          const sd: any = { name: s.name.trim(), subjectInterests: s.subjectInterests };
          if (s.birthdate) sd.birthdate = new Date(s.birthdate);
          if (s.schoolName.trim()) sd.schoolName = s.schoolName.trim();
          if (s.gradeLevel.trim()) sd.gradeLevel = s.gradeLevel.trim();
          return sd;
        }),
        status,
        ...(isAdmin ? { contactedAt: new Date(), contactNote: contactNote.trim() || 'Walk-in - ติดต่อโดยตรง' } : {}),
        ...(contactNote.trim() && !isAdmin ? { contactNote: contactNote.trim() } : {}),
      };
      if (selectedParentId) bookingData.parentId = selectedParentId;

      const bookingId = await createTrialBooking(bookingData);

      if (!isChat) {
        try {
          await fetch('/api/fb/send-conversion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'trial',
              phone: parentPhone.replace(/[-\s]/g, ''),
              entity_id: bookingId,
              branch_id: selectedBranch,
            }),
          });
        } catch {}
      }

      if (withSession) {
        const selectedRoom = rooms.find((r) => r.id === sessionData.roomId);
        const studentForSession = students[sessionData.studentIndex] || students[0];
        await createTrialSession({
          bookingId,
          studentName: studentForSession.name.trim(),
          subjectId: sessionData.subjectId,
          scheduledDate: new Date(sessionData.scheduledDate),
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          teacherId: sessionData.teacherId,
          branchId: selectedBranch,
          roomId: sessionData.roomId,
          roomName: selectedRoom?.name,
          status: 'scheduled',
        });
      }

      if (isLiff) {
        setShowSuccess(true);
      } else {
        toast.success('บันทึกการจองทดลองเรียนสำเร็จ');
        onSuccess?.(bookingId);
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  };

  // ─── LIFF success screen ───
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">ลงทะเบียนทดลองเรียนสำเร็จ!</h2>
        <p className="text-gray-600 mb-6">ทางสถาบันจะติดต่อกลับเพื่อนัดหมายเวลาเรียนทดลอง</p>
        {isLiff && (
          <Button onClick={() => { setShowSuccess(false); setStep(1); setStudents([makeStudent()]); setParentName(''); setParentPhone(''); setContactNote(''); setParentMode('search'); setSelectedParentId(''); setErrors({}); }}>
            ลงทะเบียนอีกครั้ง
          </Button>
        )}
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

  // ─── Step labels ───
  const stepLabels = showSessionStep
    ? ['ผู้ปกครอง', 'นักเรียน', 'นัดหมาย']
    : ['ผู้ปกครอง', 'นักเรียน'];

  // ─── Step indicator ───
  const stepIndicator = (
    <div className="flex items-center gap-1.5">
      {stepLabels.map((label, i) => {
        const stepNum = i + 1;
        const isActive = step === stepNum;
        const isDone = step > stepNum;
        return (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <div className={cn('h-px w-4 sm:w-6', isDone ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-700')} />}
            <button
              type="button"
              onClick={() => { if (isDone) setStep(stepNum); }}
              disabled={!isDone}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                isActive && 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
                isDone && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer hover:bg-green-200',
                !isActive && !isDone && 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-gray-500',
              )}
            >
              {stepNum}. {label}
            </button>
          </div>
        );
      })}
    </div>
  );

  // ─── Sub-step indicator for students ───
  const studentSubStepIndicator = students.length > 1 ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      {students.map((s, idx) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setActiveStudentIdx(idx)}
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
            activeStudentIdx === idx
              ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50',
          )}
        >
          {s.name || `คนที่ ${idx + 1}`}
        </button>
      ))}
    </div>
  ) : null;

  // ─── Navigation buttons ───
  const stepActions = (
    <div className="flex justify-between gap-3 pt-4">
      <div>
        {step > 1 && (
          <Button type="button" variant="outline" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
        )}
        {step === 1 && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {isAdmin ? <><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</> : 'ยกเลิก'}
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        {step === totalSteps ? (
          <>
            {showSessionStep && (
              <Button type="button" variant="outline" onClick={() => handleSubmit(false)} disabled={submitting}>
                บันทึกโดยไม่นัดเวลา
              </Button>
            )}
            <Button
              onClick={() => {
                if (showSessionStep) {
                  const hasSession = !!(sessionData.subjectId && sessionData.scheduledDate && sessionData.teacherId && sessionData.roomId);
                  if (hasSession && availabilityIssues.length > 0) { toast.error('ไม่สามารถจองเวลานี้ได้'); return; }
                  handleSubmit(hasSession);
                } else {
                  handleSubmit(false);
                }
              }}
              disabled={submitting || (showSessionStep && checkingAvailability)}
              className={cn(isLiff ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}
            >
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4 mr-2" />บันทึก</>}
            </Button>
          </>
        ) : (
          <Button onClick={goNext} className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
            ถัดไป <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );


  // ─── Active student for step 2 ───
  const activeStudent = students[activeStudentIdx];

  return (
    <div className={cn('space-y-5', isAdmin && 'max-w-4xl')}>
      {/* Admin header */}
      {isAdmin && (
        <div className="mb-2">
          <h1 className="text-xl sm:text-3xl font-bold">เพิ่มการจองทดลองเรียน</h1>
        </div>
      )}

      {stepIndicator}

      {/* ══════════ STEP 1: Branch + Parent ══════════ */}
      {step === 1 && (
        <Section isChat={isChat} title={isChat ? undefined : 'ข้อมูลผู้ปกครอง'}>
          <div className="space-y-4">
            {/* Branch */}
            <div className="space-y-1.5">
              <Label>
                <Building2 className="inline h-4 w-4 mr-1" />
                สาขา <span className="text-red-500">*</span>
              </Label>
              <FormSelect
                value={selectedBranch}
                onValueChange={(v) => { setSelectedBranch(v); clearError('branch'); }}
                placeholder="เลือกสาขา"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                className={errCls('branch')}
              />
              <FieldError name="branch" />
            </div>

            {/* Parent: linked or search+manual */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                <User className="inline h-4 w-4 mr-1" />
                ผู้ปกครอง
              </Label>
              {parentMode === 'linked' ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <User className="h-5 w-5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-base dark:text-white">{parentName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{parentPhone}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 shrink-0">เชื่อมแล้ว</Badge>
                  <Button type="button" variant="ghost" size="sm" onClick={handleChangeParent}>เปลี่ยน</Button>
                </div>
              ) : (
                <>
                  <ParentSearchInput onSelect={handleParentSelect} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>ชื่อผู้ปกครอง <span className="text-red-500">*</span></Label>
                      <Input value={parentName} onChange={(e) => { setParentName(e.target.value); clearError('parentName'); }} placeholder="ชื่อ-นามสกุล" className={errCls('parentName')} />
                      <FieldError name="parentName" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>เบอร์โทร <span className="text-red-500">*</span></Label>
                      <Input value={parentPhone} onChange={(e) => { setParentPhone(e.target.value); clearError('parentPhone'); }} placeholder="08x-xxx-xxxx" className={errCls('parentPhone')} />
                      <FieldError name="parentPhone" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ══════════ STEP 2: Students (sub-steps) ══════════ */}
      {step === 2 && (
        <Section
          isChat={isChat}
          title={isChat ? undefined : `ข้อมูลนักเรียน${students.length > 1 ? ` (${activeStudentIdx + 1}/${students.length})` : ''}`}
          headerRight={
            <Button type="button" onClick={addStudent} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มนักเรียน
            </Button>
          }
        >
          {isChat && (
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                ข้อมูลนักเรียน{students.length > 1 ? ` (${activeStudentIdx + 1}/${students.length})` : ''}
              </Label>
              <Button type="button" onClick={addStudent} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" /> เพิ่ม
              </Button>
            </div>
          )}

          {/* Sub-step tabs (when >1 student) */}
          {studentSubStepIndicator}

          {/* Active student form — 2 columns: info left, subjects right */}
          {activeStudent && (
            <div className="space-y-3">
              {students.length > 1 && (
                <div className="flex justify-end">
                  <Button type="button" onClick={() => removeStudent(activeStudentIdx)} variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-7 text-xs">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบนักเรียนคนนี้
                  </Button>
                </div>
              )}
              <div className={cn('grid gap-4', !isChat && 'md:grid-cols-2')}>
                {/* Left: Student info */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>ชื่อนักเรียน <span className="text-red-500">*</span></Label>
                    <Input
                      value={activeStudent.name}
                      onChange={(e) => { updateStudent(activeStudentIdx, 'name', e.target.value); clearError(`student_${activeStudentIdx}_name`); }}
                      placeholder="ชื่อ-นามสกุล"
                      className={errCls(`student_${activeStudentIdx}_name`)}
                    />
                    <FieldError name={`student_${activeStudentIdx}_name`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>วันเกิด</Label>
                    <DateRangePicker
                      mode="single"
                      value={activeStudent.birthdate}
                      onChange={(d) => updateStudent(activeStudentIdx, 'birthdate', d || '')}
                      maxDate={new Date()}
                      placeholder="เลือกวันที่"
                    />
                    {activeStudent.birthdate && (
                      <p className="text-xs text-gray-500">อายุ: {calculateAge(new Date(activeStudent.birthdate))} ปี</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>โรงเรียน</Label>
                    <SchoolNameCombobox
                      value={activeStudent.schoolName}
                      onChange={(v) => updateStudent(activeStudentIdx, 'schoolName', v)}
                      placeholder="พิมพ์ชื่อโรงเรียน..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ระดับชั้น</Label>
                    <GradeLevelCombobox
                      value={activeStudent.gradeLevel}
                      onChange={(v) => updateStudent(activeStudentIdx, 'gradeLevel', v)}
                      placeholder="เลือกหรือพิมพ์ระดับชั้น..."
                    />
                  </div>
                </div>

                {/* Right: Subjects */}
                <div className="space-y-1.5">
                  <Label>วิชาที่สนใจ <span className="text-red-500">*</span></Label>
                  <div className={errors[`student_${activeStudentIdx}_subjects`] ? 'rounded-lg border border-red-500 ring-1 ring-red-500 p-2' : ''}>
                    <SubjectSelector
                      key={`subjects-${activeStudent.id}`}
                      subjects={subjects}
                      selectedSubjects={students[activeStudentIdx]?.subjectInterests ?? []}
                      onToggle={(id) => {
                        const idx = activeStudentIdx;
                        setStudents(prev => {
                          const updated = [...prev];
                          const interests = updated[idx].subjectInterests;
                          updated[idx] = {
                            ...updated[idx],
                            subjectInterests: interests.includes(id)
                              ? interests.filter((sid) => sid !== id)
                              : [...interests, id],
                          };
                          return updated;
                        });
                        clearError(`student_${idx}_subjects`);
                      }}
                      compact={isChat}
                    />
                  </div>
                  <FieldError name={`student_${activeStudentIdx}_subjects`} />
                </div>
              </div>
            </div>
          )}

          {/* Notes (for LIFF — no session step) */}
          {!showSessionStep && (
            <div className="pt-3 space-y-1.5">
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Textarea value={contactNote} onChange={(e) => setContactNote(e.target.value)} placeholder="เช่น ต้องการเรียนช่วงเย็นวันธรรมดา" rows={2} />
            </div>
          )}
        </Section>
      )}

      {/* ══════════ STEP 3: Session scheduling ══════════ */}
      {step === 3 && showSessionStep && (
        <Section isChat={isChat} title={isChat ? undefined : 'นัดหมายทดลองเรียน'}>
          {/* Student picker (if multiple) */}
          {students.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {students.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSessionData((prev) => ({ ...prev, studentIndex: idx, subjectId: '' }))}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    sessionData.studentIndex === idx
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600'
                  )}
                >
                  {s.name || `นักเรียนคนที่ ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Student info summary */}
          {students[sessionData.studentIndex] && (
            <div className="pb-3 mb-3 border-b dark:border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base dark:text-white">{students[sessionData.studentIndex].name}</span>
                {students[sessionData.studentIndex].schoolName && (
                  <><span className="text-gray-300 dark:text-gray-600">|</span><span className="text-gray-500 dark:text-gray-400">{students[sessionData.studentIndex].schoolName}</span></>
                )}
              </div>
              {students[sessionData.studentIndex].subjectInterests.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-sm text-amber-600 font-medium">สนใจ:</span>
                  {students[sessionData.studentIndex].subjectInterests.map((sid) => {
                    const subject = subjects.find((s) => s.id === sid);
                    return subject ? (
                      <Badge key={sid} variant="outline" className="text-sm" style={{ backgroundColor: `${subject.color}15`, color: subject.color, borderColor: `${subject.color}40` }}>
                        {subject.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Session form */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>วิชา <span className="text-red-500">*</span></Label>
                <FormSelect
                  value={sessionData.subjectId}
                  onValueChange={(v) => { setSessionData((prev) => ({ ...prev, subjectId: v })); clearError('sessionSubject'); }}
                  placeholder="เลือกวิชา"
                  options={subjects.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                  className={errCls('sessionSubject')}
                />
                <FieldError name="sessionSubject" />
              </div>
              <div className="space-y-1.5">
                <Label>วันที่ <span className="text-red-500">*</span></Label>
                <DateRangePicker
                  mode="single"
                  value={sessionData.scheduledDate}
                  onChange={(d) => { setSessionData((prev) => ({ ...prev, scheduledDate: d || '' })); clearError('sessionDate'); }}
                  minDate={new Date()}
                  placeholder="เลือกวันที่"
                />
                <FieldError name="sessionDate" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>เวลา *</Label>
              <TimeRangePicker
                startTime={sessionData.startTime}
                endTime={sessionData.endTime}
                onStartTimeChange={(v) => setSessionData((prev) => ({ ...prev, startTime: v }))}
                onEndTimeChange={(v) => setSessionData((prev) => ({ ...prev, endTime: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ครูผู้สอน <span className="text-red-500">*</span></Label>
                <FormSelect
                  value={sessionData.teacherId}
                  onValueChange={(v) => { setSessionData((prev) => ({ ...prev, teacherId: v })); clearError('sessionTeacher'); }}
                  placeholder="เลือกครู"
                  options={availableTeachers.map((t) => ({ value: t.id, label: t.nickname || t.name }))}
                  className={errCls('sessionTeacher')}
                />
                <FieldError name="sessionTeacher" />
              </div>
              <div className="space-y-1.5">
                <Label>ห้องเรียน <span className="text-red-500">*</span></Label>
                <FormSelect
                  value={sessionData.roomId}
                  onValueChange={(v) => { setSessionData((prev) => ({ ...prev, roomId: v })); clearError('sessionRoom'); }}
                  placeholder={rooms.length ? 'เลือกห้อง' : 'เลือกสาขาก่อน'}
                  options={rooms.map((r) => ({ value: r.id, label: `${r.name} (จุ ${r.capacity} คน)` }))}
                  className={errCls('sessionRoom')}
                />
                <FieldError name="sessionRoom" />
              </div>
            </div>

            {/* Availability status */}
            {checkingAvailability ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>กำลังตรวจสอบห้องว่าง...</AlertDescription>
              </Alert>
            ) : availabilityIssues.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">ไม่สามารถจองเวลานี้ได้:</p>
                  {availabilityIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm mt-1">
                      <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            ) : (
              sessionData.scheduledDate && sessionData.startTime && sessionData.endTime && sessionData.teacherId && sessionData.roomId && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-300">เวลานี้สามารถจองได้</AlertDescription>
                </Alert>
              )
            )}
          </div>

          {/* Notes */}
          <div className="pt-3 space-y-1.5">
            <Label>หมายเหตุ (ถ้ามี)</Label>
            <Textarea value={contactNote} onChange={(e) => setContactNote(e.target.value)} placeholder="เช่น ต้องการเรียนช่วงเย็นวันธรรมดา" rows={2} />
          </div>
        </Section>
      )}

      {stepActions}
    </div>
  );
}

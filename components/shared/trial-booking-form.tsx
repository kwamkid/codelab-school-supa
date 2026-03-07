'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { cn } from '@/lib/utils';
import { calculateAge } from '@/lib/utils';
import {
  ArrowLeft, Save, Plus, Trash2, User, Phone, Mail, Building2, Calendar,
  Loader2, AlertCircle, CheckCircle2, XCircle, Info, ChevronRight, ChevronLeft, CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Subject, Teacher, Branch, Room } from '@/types/models';
import { getSubjects } from '@/lib/services/subjects';
import { getBranches, getActiveBranches } from '@/lib/services/branches';
import { getTeachers } from '@/lib/services/teachers';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { createTrialBooking, createTrialSession } from '@/lib/services/trial-bookings';
import { AvailabilityIssue } from '@/lib/utils/availability';

interface StudentForm {
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

const DEFAULT_STUDENT: StudentForm = {
  name: '',
  birthdate: '',
  schoolName: '',
  gradeLevel: '',
  subjectInterests: [],
};

export function TrialBookingForm({ context, prefill, onSuccess, onCancel }: TrialBookingFormProps) {
  const isAdmin = context === 'admin';
  const isLiff = context === 'liff';
  const isChat = context === 'chat';
  const showSessionStep = !isLiff; // LIFF users don't schedule sessions

  // Loading & data
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Step state
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Step 1: Parent + Students
  const [parentName, setParentName] = useState(prefill?.parentName || '');
  const [parentPhone, setParentPhone] = useState(prefill?.parentPhone || '');
  const [parentEmail, setParentEmail] = useState(prefill?.parentEmail || '');
  const [selectedBranch, setSelectedBranch] = useState(prefill?.branchId || '');
  const [students, setStudents] = useState<StudentForm[]>([{ ...DEFAULT_STUDENT }]);
  const [contactNote, setContactNote] = useState('');

  // Step 2: Session scheduling
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

  // Load rooms when branch changes (step 2)
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
          date: new Date(scheduledDate),
          startTime,
          endTime,
          branchId: selectedBranch,
          roomId,
          teacherId,
          excludeType: 'trial',
        });
        setAvailabilityIssues(result.available ? [] : result.reasons);
      } catch {
        // ignore
      } finally {
        setCheckingAvailability(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [sessionData, selectedBranch, showSessionStep]);

  // Filter teachers by subject + branch
  const availableTeachers = useMemo(
    () =>
      teachers.filter(
        (t) =>
          (!sessionData.subjectId || t.specialties.includes(sessionData.subjectId)) &&
          (!selectedBranch || t.availableBranches.includes(selectedBranch))
      ),
    [teachers, sessionData.subjectId, selectedBranch]
  );

  // Student helpers
  const addStudent = () => setStudents([...students, { ...DEFAULT_STUDENT }]);
  const removeStudent = (idx: number) => {
    if (students.length > 1) setStudents(students.filter((_, i) => i !== idx));
  };
  const updateStudent = (idx: number, field: keyof StudentForm, value: any) => {
    const updated = [...students];
    updated[idx] = { ...updated[idx], [field]: value };
    setStudents(updated);
  };
  const toggleSubject = (studentIdx: number, subjectId: string) => {
    const updated = [...students];
    const interests = updated[studentIdx].subjectInterests;
    updated[studentIdx].subjectInterests = interests.includes(subjectId)
      ? interests.filter((id) => id !== subjectId)
      : [...interests, subjectId];
    setStudents(updated);
  };

  // Validation
  const validateStep1 = (): boolean => {
    if (!parentName.trim()) { toast.error('กรุณากรอกชื่อผู้ปกครอง'); return false; }
    if (!parentPhone.trim()) { toast.error('กรุณากรอกเบอร์โทรศัพท์'); return false; }
    const cleanPhone = parentPhone.replace(/[-\s]/g, '');
    if (!/^0[0-9]{8,9}$/.test(cleanPhone)) { toast.error('เบอร์โทรศัพท์ไม่ถูกต้อง'); return false; }
    if (!selectedBranch) { toast.error('กรุณาเลือกสาขา'); return false; }
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) { toast.error('อีเมลไม่ถูกต้อง'); return false; }

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name.trim()) { toast.error(`กรุณากรอกชื่อนักเรียนคนที่ ${i + 1}`); return false; }
      if (s.birthdate) {
        const age = calculateAge(new Date(s.birthdate));
        if (age < 3 || age > 22) { toast.error(`อายุนักเรียนคนที่ ${i + 1} ต้องอยู่ระหว่าง 3-22 ปี`); return false; }
      }
      if (s.subjectInterests.length === 0) { toast.error(`กรุณาเลือกวิชาที่สนใจสำหรับนักเรียนคนที่ ${i + 1}`); return false; }
    }
    return true;
  };

  // Submit — create booking (+ optionally session)
  const handleSubmit = async (withSession: boolean) => {
    if (submitGuardRef.current) return;
    if (step === 1 && !validateStep1()) return;

    if (withSession) {
      const { subjectId, scheduledDate, startTime, endTime, teacherId, roomId } = sessionData;
      if (!subjectId || !scheduledDate || !startTime || !endTime || !teacherId || !roomId) {
        toast.error('กรุณากรอกข้อมูลนัดหมายให้ครบ');
        return;
      }
      if (availabilityIssues.length > 0) {
        toast.error('ไม่สามารถจองเวลานี้ได้');
        return;
      }
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
      if (parentEmail.trim()) bookingData.parentEmail = parentEmail.trim();

      const bookingId = await createTrialBooking(bookingData);

      // Fire FB conversion (admin + liff)
      if (!isChat) {
        try {
          await fetch('/api/fb/send-conversion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'trial',
              phone: parentPhone.replace(/[-\s]/g, ''),
              email: parentEmail.trim() || undefined,
              entity_id: bookingId,
              branch_id: selectedBranch,
            }),
          });
        } catch {}
      }

      // Create session if requested
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

  // LIFF success screen
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">ลงทะเบียนทดลองเรียนสำเร็จ!</h2>
        <p className="text-gray-600 mb-6">ทางสถาบันจะติดต่อกลับเพื่อนัดหมายเวลาเรียนทดลอง</p>
        {isLiff && (
          <Button onClick={() => { setShowSuccess(false); setStep(1); setStudents([{ ...DEFAULT_STUDENT }]); setParentName(''); setParentPhone(''); setParentEmail(''); setContactNote(''); }}>
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

  const Wrapper = ({ children, title, desc }: { children: React.ReactNode; title?: string; desc?: string }) => {
    if (isChat) return <div className="space-y-4">{children}</div>;
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {desc && <CardDescription>{desc}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className={title ? undefined : 'pt-6'}>{children}</CardContent>
      </Card>
    );
  };

  return (
    <div className={cn(isChat ? 'space-y-4' : 'space-y-6', isAdmin && 'max-w-4xl')}>
      {/* Header (admin only) */}
      {isAdmin && (
        <div className="mb-6">
          <Button variant="ghost" onClick={onCancel} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            เพิ่มการจองทดลองเรียน
          </h1>
          <p className="text-gray-600 mt-1">บันทึกข้อมูลผู้ปกครองที่มา Walk-in เพื่อทดลองเรียน</p>
        </div>
      )}

      {/* Step indicator (non-admin, multi-step) */}
      {!isAdmin && showSessionStep && (
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('px-3 py-1 rounded-full', step === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400')}>
            1. ข้อมูล
          </span>
          <ChevronRight className="h-4 w-4 text-gray-300" />
          <span className={cn('px-3 py-1 rounded-full', step === 2 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400')}>
            2. นัดเวลา
          </span>
        </div>
      )}

      {/* STEP 1: Parent + Students */}
      {(step === 1 || isAdmin) && (
        <>
          {/* Branch */}
          <Wrapper title={isAdmin ? 'สาขา' : undefined} desc={isAdmin ? 'เลือกสาขาที่ผู้ปกครองติดต่อ' : undefined}>
            <div className="space-y-2">
              <Label>
                <Building2 className="inline h-4 w-4 mr-1" />
                สาขา <span className="text-red-500">*</span>
              </Label>
              <FormSelect
                value={selectedBranch}
                onValueChange={setSelectedBranch}
                placeholder="เลือกสาขา"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          </Wrapper>

          {/* Parent info */}
          <Wrapper title={isAdmin ? 'ข้อมูลผู้ปกครอง' : undefined} desc={isAdmin ? 'กรอกข้อมูลติดต่อผู้ปกครอง' : undefined}>
            {!isAdmin && <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 block">ข้อมูลผู้ปกครอง</Label>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ชื่อผู้ปกครอง <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทรศัพท์ <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="08x-xxx-xxxx" className="pl-10" />
                </div>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>อีเมล (ถ้ามี)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="email@example.com" className="pl-10" type="email" />
                </div>
              </div>
            </div>
          </Wrapper>

          {/* Students */}
          <Wrapper title={isAdmin ? 'ข้อมูลนักเรียน' : undefined} desc={isAdmin ? 'กรอกข้อมูลนักเรียนที่ต้องการทดลองเรียน' : undefined}>
            {!isAdmin && (
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">ข้อมูลนักเรียน</Label>
                <Button type="button" onClick={addStudent} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> เพิ่ม
                </Button>
              </div>
            )}
            {isAdmin && (
              <div className="flex justify-end mb-4">
                <Button type="button" onClick={addStudent} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" /> เพิ่มนักเรียน
                </Button>
              </div>
            )}

            <div className="space-y-4">
              {students.map((student, idx) => (
                <div key={idx} className={cn('relative space-y-4', isChat ? 'p-3 border rounded-lg dark:border-slate-700' : 'p-4 border rounded-lg')}>
                  {students.length > 1 && (
                    <Button type="button" onClick={() => removeStudent(idx)} variant="ghost" size="sm" className="absolute top-2 right-2">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {students.length > 1 && (
                    <div className="font-medium text-sm text-gray-600 dark:text-gray-400">นักเรียนคนที่ {idx + 1}</div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ชื่อนักเรียน <span className="text-red-500">*</span></Label>
                      <Input value={student.name} onChange={(e) => updateStudent(idx, 'name', e.target.value)} placeholder="ชื่อ-นามสกุล" />
                    </div>
                    <div className="space-y-2">
                      <Label><Calendar className="inline h-4 w-4 mr-1" />วันเกิด</Label>
                      <DateRangePicker mode="single" value={student.birthdate} onChange={(d) => updateStudent(idx, 'birthdate', d || '')} maxDate={new Date()} placeholder="เลือกวันที่" />
                      {student.birthdate && <p className="text-xs text-gray-500">อายุ: {calculateAge(new Date(student.birthdate))} ปี</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>โรงเรียน</Label>
                      <SchoolNameCombobox value={student.schoolName} onChange={(v) => updateStudent(idx, 'schoolName', v)} placeholder="พิมพ์ชื่อโรงเรียน..." />
                    </div>
                    <div className="space-y-2">
                      <Label>ระดับชั้น</Label>
                      <GradeLevelCombobox value={student.gradeLevel} onChange={(v) => updateStudent(idx, 'gradeLevel', v)} placeholder="เลือกหรือพิมพ์ระดับชั้น..." />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>วิชาที่สนใจ <span className="text-red-500">*</span></Label>
                    <SubjectSelector
                      subjects={subjects}
                      selectedSubjects={student.subjectInterests}
                      onToggle={(id) => toggleSubject(idx, id)}
                      compact={isChat}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Wrapper>

          {/* Notes */}
          <Wrapper title={isAdmin ? 'หมายเหตุ' : undefined}>
            {!isAdmin && <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">หมายเหตุ (ถ้ามี)</Label>}
            <Textarea value={contactNote} onChange={(e) => setContactNote(e.target.value)} placeholder="เช่น ต้องการเรียนช่วงเย็นวันธรรมดา" rows={2} />
          </Wrapper>

          {/* Step 1 actions */}
          <div className="flex justify-end gap-3 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                ยกเลิก
              </Button>
            )}
            {isAdmin ? (
              /* Admin: single step → submit directly */
              <Button onClick={() => handleSubmit(false)} disabled={submitting} className="bg-red-500 hover:bg-red-600">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4 mr-2" />บันทึกข้อมูล</>}
              </Button>
            ) : showSessionStep ? (
              /* Chat: go to step 2, or save without session */
              <>
                <Button type="button" variant="outline" onClick={() => { if (validateStep1()) handleSubmit(false); }} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  บันทึกโดยไม่นัดเวลา
                </Button>
                <Button onClick={() => { if (validateStep1()) setStep(2); }} className="bg-blue-500 hover:bg-blue-600">
                  ถัดไป: นัดเวลา <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              /* LIFF: submit directly */
              <Button onClick={() => handleSubmit(false)} disabled={submitting} className="w-full bg-green-500 hover:bg-green-600">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : 'ลงทะเบียนทดลองเรียน'}
              </Button>
            )}
          </div>
        </>
      )}

      {/* STEP 2: Session scheduling */}
      {step === 2 && showSessionStep && (
        <>
          {/* Student picker (if multiple) */}
          {students.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {students.map((s, idx) => (
                <button
                  key={idx}
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
            <div className="pb-3 border-b dark:border-slate-700">
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

          {/* Session form fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>วิชา *</Label>
                <FormSelect
                  value={sessionData.subjectId}
                  onValueChange={(v) => setSessionData((prev) => ({ ...prev, subjectId: v }))}
                  placeholder="เลือกวิชา"
                  options={subjects.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>วันที่ *</Label>
                <DateRangePicker
                  mode="single"
                  value={sessionData.scheduledDate}
                  onChange={(d) => setSessionData((prev) => ({ ...prev, scheduledDate: d || '' }))}
                  minDate={new Date()}
                  placeholder="เลือกวันที่"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>เวลา *</Label>
                <TimeRangePicker
                  startTime={sessionData.startTime}
                  endTime={sessionData.endTime}
                  onStartTimeChange={(v) => setSessionData((prev) => ({ ...prev, startTime: v }))}
                  onEndTimeChange={(v) => setSessionData((prev) => ({ ...prev, endTime: v }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ครูผู้สอน *</Label>
                <FormSelect
                  value={sessionData.teacherId}
                  onValueChange={(v) => setSessionData((prev) => ({ ...prev, teacherId: v }))}
                  placeholder="เลือกครู"
                  options={availableTeachers.map((t) => ({ value: t.id, label: t.nickname || t.name }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ห้องเรียน *</Label>
                <FormSelect
                  value={sessionData.roomId}
                  onValueChange={(v) => setSessionData((prev) => ({ ...prev, roomId: v }))}
                  placeholder={rooms.length ? 'เลือกห้อง' : 'เลือกสาขาก่อน'}
                  options={rooms.map((r) => ({ value: r.id, label: `${r.name} (จุ ${r.capacity} คน)` }))}
                />
              </div>
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

          {/* Step 2 actions */}
          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={
                submitting || checkingAvailability || availabilityIssues.length > 0 ||
                !sessionData.subjectId || !sessionData.scheduledDate || !sessionData.teacherId || !sessionData.roomId
              }
              className="bg-red-500 hover:bg-red-600"
            >
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : 'บันทึกและนัดเวลา'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

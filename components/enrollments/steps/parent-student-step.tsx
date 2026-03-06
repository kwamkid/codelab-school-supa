'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Search, UserCheck, UserPlus, ChevronRight, ChevronLeft, Loader2, BookOpen, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StepProps, StudentFormData, DEFAULT_STUDENT } from '../enrollment-types';
import { searchParentsUnified, ParentSearchResult, getStudentsByParent } from '@/lib/services/parents';
import { searchTrialBookings, TrialBookingSearchResult } from '@/lib/services/trial-bookings';
import { Parent, Student, TrialBooking } from '@/types/models';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { calculateAge } from '@/lib/utils';

type SearchResult =
  | { type: 'parent'; data: ParentSearchResult }
  | { type: 'trial'; data: TrialBookingSearchResult };

export default function ParentStudentStep({ formData, setFormData, onNext, onBack }: StepProps) {
  // --- Parent search state ---
  const [searchTerm, setSearchTerm] = useState(
    formData.source === 'trial' ? (formData.parentPhone || formData.parentName || '') : ''
  );
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedTrialBooking, setSelectedTrialBooking] = useState<TrialBooking | null>(null);
  const [manualMode, setManualMode] = useState(formData.source === 'new');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const autoSearchedRef = useRef(false);

  // --- Search ---
  const doSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearchDone(false);
      return;
    }

    setSearching(true);
    setSearchDone(false);
    try {
      const combined: SearchResult[] = [];

      if (formData.source === 'trial') {
        const trialResults = await searchTrialBookings(term);
        for (const t of trialResults) {
          combined.push({ type: 'trial', data: t });
        }
      } else {
        const [parentResults, trialResults] = await Promise.all([
          searchParentsUnified(term),
          searchTrialBookings(term),
        ]);
        for (const p of parentResults) {
          combined.push({ type: 'parent', data: p });
        }
        const parentPhones = new Set(parentResults.map(p => p.parent.phone));
        for (const t of trialResults) {
          if (!parentPhones.has(t.booking.parentPhone)) {
            combined.push({ type: 'trial', data: t });
          }
        }
      }

      setResults(combined);
      setSearchDone(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [formData.source]);

  // Auto-search on mount ONLY when coming from trial (phone is pre-filled)
  useEffect(() => {
    if (autoSearchedRef.current) return;
    if (formData.source !== 'trial') return; // Only auto-search for trial source
    const term = formData.parentPhone || formData.parentName;
    if (!term || term.trim().length < 2) return;
    autoSearchedRef.current = true;

    (async () => {
      setSearching(true);
      try {
        const parentResults = await searchParentsUnified(term);

        if (parentResults.length > 0) {
          const best = parentResults[0];
          setSelectedParent(best.parent);
          setSelectedStudents(best.students);
          setResults(parentResults.map(p => ({ type: 'parent' as const, data: p })));
          setSearchDone(true);

          setFormData(prev => {
            let updatedStudents = [...prev.students];

            if (best.students.length === 1) {
              // Auto-select the only student
              const s = best.students[0];
              updatedStudents[0] = {
                ...updatedStudents[0],
                mode: 'existing' as const,
                existingStudentId: s.id,
                name: s.name,
                nickname: s.nickname,
                birthdate: s.birthdate instanceof Date
                  ? s.birthdate.toISOString().split('T')[0]
                  : new Date(s.birthdate).toISOString().split('T')[0],
                gender: s.gender,
                schoolName: s.schoolName || '',
                gradeLevel: s.gradeLevel || '',
                allergies: s.allergies || '',
                specialNeeds: s.specialNeeds || '',
              };
            } else {
              // Multiple students — try to match by name from trial data
              updatedStudents = prev.students.map(st => {
                if (st.mode === 'existing' && st.existingStudentId) return st;
                const match = best.students.find(es =>
                  es.name === st.name ||
                  (es.nickname && st.nickname && es.nickname === st.nickname)
                );
                if (match) {
                  return {
                    ...st,
                    mode: 'existing' as const,
                    existingStudentId: match.id,
                    name: match.name,
                    nickname: match.nickname,
                    birthdate: match.birthdate instanceof Date
                      ? match.birthdate.toISOString().split('T')[0]
                      : new Date(match.birthdate).toISOString().split('T')[0],
                    gender: match.gender,
                    schoolName: match.schoolName || st.schoolName,
                    gradeLevel: match.gradeLevel || st.gradeLevel,
                    allergies: match.allergies || '',
                    specialNeeds: match.specialNeeds || '',
                  };
                }
                return st;
              });
            }

            return {
              ...prev,
              parentMode: 'existing',
              existingParentId: best.parent.id,
              parentName: best.parent.displayName,
              parentPhone: best.parent.phone,
              parentEmail: best.parent.email || '',
              students: updatedStudents,
            };
          });
        } else {
          // No existing parent found — show new parent form with pre-filled data
          setManualMode(true);
          setSearchDone(true);
        }
      } catch (error) {
        console.error('Auto-search error:', error);
        setManualMode(true);
        setSearchDone(true);
      } finally {
        setSearching(false);
      }
    })();
  }, [formData.parentPhone, formData.parentName]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedParent(null);
    setSelectedTrialBooking(null);
    setManualMode(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const handleSelectParent = (result: ParentSearchResult) => {
    setSelectedParent(result.parent);
    setSelectedTrialBooking(null);
    setSelectedStudents(result.students);
    setManualMode(false);

    setFormData(prev => {
      let students = [...prev.students];

      // Auto-select student if parent has exactly 1 student
      if (result.students.length === 1) {
        const s = result.students[0];
        students[0] = {
          ...students[0],
          mode: 'existing' as const,
          existingStudentId: s.id,
          name: s.name,
          nickname: s.nickname,
          birthdate: s.birthdate instanceof Date
            ? s.birthdate.toISOString().split('T')[0]
            : new Date(s.birthdate).toISOString().split('T')[0],
          gender: s.gender,
          schoolName: s.schoolName || '',
          gradeLevel: s.gradeLevel || '',
          allergies: s.allergies || '',
          specialNeeds: s.specialNeeds || '',
        };
      }

      return {
        ...prev,
        parentMode: 'existing',
        existingParentId: result.parent.id,
        parentName: result.parent.displayName,
        parentPhone: result.parent.phone,
        parentEmail: result.parent.email || '',
        students,
      };
    });
  };

  const handleSelectTrialBooking = (result: TrialBookingSearchResult) => {
    setSelectedTrialBooking(result.booking);
    setSelectedParent(null);
    setSelectedStudents([]);
    setManualMode(false);

    // Auto-fill student data from trial booking
    const trialStudents = result.booking.students || [];

    setFormData(prev => ({
      ...prev,
      parentMode: 'new',
      existingParentId: undefined,
      parentName: result.booking.parentName,
      parentPhone: result.booking.parentPhone,
      parentEmail: result.booking.parentEmail || '',
      students: trialStudents.length > 0
        ? trialStudents.map(s => ({
            ...DEFAULT_STUDENT,
            name: s.name || '',
            birthdate: s.birthdate ? new Date(s.birthdate).toISOString().split('T')[0] : '',
            schoolName: s.schoolName || '',
            gradeLevel: s.gradeLevel || '',
          }))
        : prev.students,
    }));
  };

  const handleNewParent = () => {
    setSelectedParent(null);
    setSelectedTrialBooking(null);
    setSelectedStudents([]);
    setManualMode(true);

    const cleanTerm = searchTerm.replace(/[-\s]/g, '');
    const isPhone = /^0[0-9]{7,9}$/.test(cleanTerm);

    setFormData(prev => ({
      ...prev,
      parentMode: 'new',
      existingParentId: undefined,
      parentPhone: isPhone ? cleanTerm : prev.parentPhone,
      parentName: !isPhone ? searchTerm : prev.parentName,
    }));
  };

  const handleClearSelection = () => {
    setSelectedParent(null);
    setSelectedTrialBooking(null);
    setSelectedStudents([]);
    setManualMode(false);
    setFormData(prev => ({
      ...prev,
      parentMode: 'new',
      existingParentId: undefined,
      parentName: '',
      parentEmail: '',
      emergencyPhone: '',
    }));
  };

  // --- Student helpers ---
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

  // --- Validation ---
  const validate = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    let firstError = '';

    // Parent validation
    if (formData.parentMode !== 'existing' || !formData.existingParentId) {
      if (!formData.parentName.trim()) {
        newErrors['parentName'] = true;
        if (!firstError) firstError = 'กรุณากรอกชื่อผู้ปกครอง';
      }
      const phone = formData.parentPhone.replace(/[-\s]/g, '');
      if (!/^0[0-9]{8,9}$/.test(phone)) {
        newErrors['parentPhone'] = true;
        if (!firstError) firstError = 'เบอร์โทรไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)';
      }
    }

    // Picker mode — must select a student
    if (selectedStudents.length > 1) {
      if (formData.students[0]?.mode !== 'existing' || !formData.students[0]?.existingStudentId) {
        if (!firstError) firstError = 'กรุณาเลือกนักเรียนที่จะลงทะเบียน';
      }
    }

    // Student validation
    for (let i = 0; i < formData.students.length; i++) {
      const s = formData.students[i];
      if (s.mode === 'existing' && s.existingStudentId) continue;
      if (!s.name.trim()) {
        newErrors[`student_${i}_name`] = true;
        if (!firstError) firstError = `กรุณากรอกชื่อนักเรียนคนที่ ${i + 1}`;
      }
      if (!s.nickname.trim()) {
        newErrors[`student_${i}_nickname`] = true;
        if (!firstError) firstError = `กรุณากรอกชื่อเล่นนักเรียนคนที่ ${i + 1}`;
      }
      if (!s.birthdate) {
        newErrors[`student_${i}_birthdate`] = true;
        if (!firstError) firstError = `กรุณาเลือกวันเกิดนักเรียนคนที่ ${i + 1}`;
      } else {
        const age = calculateAge(new Date(s.birthdate));
        if (age < 3 || age > 20) {
          newErrors[`student_${i}_birthdate`] = true;
          if (!firstError) firstError = `อายุนักเรียนคนที่ ${i + 1} ไม่อยู่ในช่วงที่รองรับ (3-20 ปี)`;
        }
      }
    }

    setErrors(newErrors);
    if (firstError) {
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const matchLabel = (matchedVia: string) => {
    switch (matchedVia) {
      case 'parent_name': return 'ชื่อผู้ปกครอง';
      case 'parent_phone': return 'เบอร์โทร';
      case 'student_name': return 'ชื่อนักเรียน';
      default: return '';
    }
  };

  const hasSelection = selectedParent || selectedTrialBooking || manualMode;

  // --- Parent form fields (reusable) ---
  const renderParentForm = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label className={`text-base ${errors['parentName'] ? 'text-red-500' : ''}`}>ชื่อ-นามสกุล *</Label>
        <Input
          value={formData.parentName}
          onChange={e => {
            setFormData(prev => ({ ...prev, parentName: e.target.value }));
            if (errors['parentName']) setErrors(prev => ({ ...prev, parentName: false }));
          }}
          placeholder="ชื่อผู้ปกครอง"
          className={`text-base ${errors['parentName'] ? 'border-red-500' : ''}`}
        />
      </div>
      <div>
        <Label className={`text-base ${errors['parentPhone'] ? 'text-red-500' : ''}`}>เบอร์โทร *</Label>
        <Input
          value={formData.parentPhone}
          onChange={e => {
            setFormData(prev => ({ ...prev, parentPhone: e.target.value }));
            if (errors['parentPhone']) setErrors(prev => ({ ...prev, parentPhone: false }));
          }}
          placeholder="0812345678"
          className={`text-base ${errors['parentPhone'] ? 'border-red-500' : ''}`}
        />
      </div>
      <div>
        <Label className="text-base">อีเมล</Label>
        <Input
          value={formData.parentEmail}
          onChange={e => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
          placeholder="email@example.com"
          className="text-base"
          type="email"
        />
      </div>
      <div>
        <Label className="text-base">เบอร์โทรฉุกเฉิน</Label>
        <Input
          value={formData.emergencyPhone}
          onChange={e => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
          placeholder="0812345678"
          className="text-base"
        />
      </div>

      {/* Address */}
      <div className="sm:col-span-2 pt-2">
        <Label className="text-base font-medium">ที่อยู่</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div>
            <Label className="text-base text-gray-500">บ้านเลขที่</Label>
            <Input
              value={formData.address.houseNumber}
              onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, houseNumber: e.target.value } }))}
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-base text-gray-500">ถนน</Label>
            <Input
              value={formData.address.street}
              onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-base text-gray-500">แขวง/ตำบล</Label>
            <Input
              value={formData.address.subDistrict}
              onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, subDistrict: e.target.value } }))}
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-base text-gray-500">เขต/อำเภอ</Label>
            <Input
              value={formData.address.district}
              onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, district: e.target.value } }))}
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-base text-gray-500">จังหวัด</Label>
            <Input
              value={formData.address.province}
              onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, province: e.target.value } }))}
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-base text-gray-500">รหัสไปรษณีย์</Label>
            <Input
              value={formData.address.postalCode}
              onChange={e => setFormData(prev => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
              className="text-base"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // --- Student form for one student ---
  const renderStudentForm = (student: StudentFormData, index: number) => (
    <div className="space-y-3">
      {/* Select existing student if parent has students */}
      {selectedStudents.length > 0 && student.mode === 'new' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-base font-medium text-blue-700 mb-2">
            <UserCheck className="h-4 w-4 inline mr-1" />
            เลือกนักเรียนที่มีอยู่แล้ว
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedStudents
              .filter(es => !formData.students.some(
                (s, i) => i !== index && s.existingStudentId === es.id
              ))
              .map(es => (
                <Button
                  key={es.id}
                  variant="outline"
                  size="sm"
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
            <strong>{student.nickname}</strong> ({student.name})
            {student.birthdate && ` - อายุ ${calculateAge(new Date(student.birthdate))} ปี`}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateStudent(index, { mode: 'new', existingStudentId: undefined })}
          >
            เปลี่ยน
          </Button>
        </div>
      )}

      {student.mode === 'new' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className={`text-base ${errors[`student_${index}_name`] ? 'text-red-500' : ''}`}>ชื่อ-นามสกุล *</Label>
            <Input
              value={student.name}
              onChange={e => {
                updateStudent(index, { name: e.target.value });
                if (errors[`student_${index}_name`]) setErrors(prev => ({ ...prev, [`student_${index}_name`]: false }));
              }}
              placeholder="ชื่อ นามสกุล"
              className={`text-base ${errors[`student_${index}_name`] ? 'border-red-500' : ''}`}
            />
          </div>
          <div>
            <Label className={`text-base ${errors[`student_${index}_nickname`] ? 'text-red-500' : ''}`}>ชื่อเล่น *</Label>
            <Input
              value={student.nickname}
              onChange={e => {
                updateStudent(index, { nickname: e.target.value });
                if (errors[`student_${index}_nickname`]) setErrors(prev => ({ ...prev, [`student_${index}_nickname`]: false }));
              }}
              placeholder="ชื่อเล่น"
              className={`text-base ${errors[`student_${index}_nickname`] ? 'border-red-500' : ''}`}
            />
          </div>
          <div>
            <Label className={`text-base ${errors[`student_${index}_birthdate`] ? 'text-red-500' : ''}`}>วันเกิด *</Label>
            <DateRangePicker
              mode="single"
              value={student.birthdate || undefined}
              onChange={(date) => {
                updateStudent(index, { birthdate: date || '' });
                if (errors[`student_${index}_birthdate`]) setErrors(prev => ({ ...prev, [`student_${index}_birthdate`]: false }));
              }}
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
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search bar - hide for new customer */}
      {formData.source !== 'new' && <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ค้นหาผู้ปกครอง</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="ค้นหาด้วย ชื่อผู้ปกครอง, เบอร์โทร, หรือชื่อเด็ก"
                className="text-base pl-10"
              />
            </div>
            {searching && <Loader2 className="h-5 w-5 animate-spin text-gray-400 self-center" />}
          </div>
          <p className="text-sm text-gray-500 mt-1">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</p>

          {/* Search Results */}
          {searchDone && results.length > 0 && !hasSelection && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-600">ผลการค้นหา ({results.length} รายการ)</p>
              {results.map((result) => (
                result.type === 'parent' ? (
                  <button
                    key={`p-${result.data.parent.id}`}
                    type="button"
                    onClick={() => handleSelectParent(result.data)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-medium">{result.data.parent.displayName}</span>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">ผู้ปกครองเดิม</Badge>
                          <Badge variant="outline" className="text-xs">ค้นจาก: {matchLabel(result.data.matchedVia)}</Badge>
                        </div>
                        <p className="text-sm text-gray-500">{result.data.parent.phone}</p>
                        {result.data.students.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.data.students.map(s => (
                              <Badge key={s.id} variant="secondary" className="text-xs">{s.nickname} ({s.name})</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    key={`t-${result.data.booking.id}`}
                    type="button"
                    onClick={() => handleSelectTrialBooking(result.data)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-medium">{result.data.booking.parentName}</span>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">จากทดลองเรียน</Badge>
                          <Badge variant="outline" className="text-xs">ค้นจาก: {matchLabel(result.data.matchedVia)}</Badge>
                        </div>
                        <p className="text-sm text-gray-500">{result.data.booking.parentPhone}</p>
                        {result.data.booking.students.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.data.booking.students.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s.name}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              ))}
              <button
                type="button"
                onClick={handleNewParent}
                className="w-full text-left p-3 border border-dashed rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <span className="text-base text-yellow-700 font-medium">สร้างผู้ปกครองใหม่</span>
                </div>
              </button>
            </div>
          )}

          {searchDone && results.length === 0 && !hasSelection && (
            <div className="mt-4 space-y-2">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-base text-yellow-700">ไม่พบข้อมูลในระบบ</p>
              </div>
              <button
                type="button"
                onClick={handleNewParent}
                className="w-full text-left p-3 border border-dashed rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <span className="text-base text-yellow-700 font-medium">สร้างผู้ปกครองใหม่</span>
                </div>
              </button>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* 2-column layout: Parent (left) + Student (right) */}
      {hasSelection && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Parent info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedParent && <UserCheck className="h-5 w-5 text-green-600" />}
                  {selectedTrialBooking && <BookOpen className="h-5 w-5 text-blue-600" />}
                  {manualMode && <UserPlus className="h-5 w-5 text-yellow-600" />}
                  ผู้ปกครอง
                  {selectedParent && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">เดิม</Badge>
                  )}
                  {selectedTrialBooking && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">ทดลองเรียน</Badge>
                  )}
                  {manualMode && (
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">ใหม่</Badge>
                  )}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedParent ? (
                <div className="text-base text-gray-700 space-y-1">
                  <p>ชื่อ: <strong>{selectedParent.displayName}</strong></p>
                  <p>เบอร์โทร: {selectedParent.phone}</p>
                  {selectedParent.email && <p>อีเมล: {selectedParent.email}</p>}
                </div>
              ) : (
                renderParentForm()
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Student info */}
          <div className="space-y-4">
            {/* Multiple parent students — show student picker */}
            {selectedParent && selectedStudents.length > 1 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">เลือกนักเรียนที่จะลงทะเบียน</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedStudents.map(student => {
                    const isSelected = formData.students[0]?.mode === 'existing' && formData.students[0]?.existingStudentId === student.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => selectExistingStudent(0, student)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-green-200 ring-2 ring-green-500'
                            : 'bg-green-50 hover:bg-green-100 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-base font-medium">
                              {student.nickname} ({student.name})
                            </p>
                            <div className="flex gap-2 text-sm text-gray-500">
                              {student.birthdate && (
                                <span>อายุ {calculateAge(student.birthdate instanceof Date ? student.birthdate : new Date(student.birthdate))} ปี</span>
                              )}
                              {student.schoolName && <span>• {student.schoolName}</span>}
                              {student.gradeLevel && <span>• {student.gradeLevel}</span>}
                            </div>
                          </div>
                          {isSelected && <UserCheck className="h-5 w-5 text-green-600" />}
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            ) : (
              <>
                {formData.students.map((student, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">
                          นักเรียนคนที่ {index + 1}
                          {student.mode === 'existing' && (
                            <Badge variant="secondary" className="ml-2 text-xs">ข้อมูลเดิม</Badge>
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
                    <CardContent>
                      {renderStudentForm(student, index)}
                    </CardContent>
                  </Card>
                ))}

                {formData.source !== 'trial' && (
                  <Button variant="outline" onClick={addStudent} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มนักเรียน
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>
        <Button onClick={handleNext} className="bg-red-500 hover:bg-red-600" disabled={!hasSelection}>
          ถัดไป
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

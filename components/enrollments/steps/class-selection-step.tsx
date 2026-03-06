'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Clock, Calendar, Users, AlertTriangle, Check, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { StepProps } from '../enrollment-types';
import { getClasses } from '@/lib/services/classes';
import { getBranches } from '@/lib/services/branches';
import { getSubjects } from '@/lib/services/subjects';
import { getTeachers } from '@/lib/services/teachers';
import { getEnrollmentsByStudent } from '@/lib/services/enrollments';
import { Branch, Class, Subject, Teacher } from '@/types/models';
import { calculateAge, getDayName, formatCurrency, formatDateCompact } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';

const PAGE_SIZE_OPTIONS = [5, 10, 20];
const DEFAULT_PAGE_SIZE = 10;

export default function ClassSelectionStep({ formData, setFormData, onNext, onBack }: StepProps) {
  const { selectedBranchId } = useBranch();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [hideFull, setHideFull] = useState(false);
  const [hideStarted, setHideStarted] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchList, subjectList, teacherList] = await Promise.all([
        getBranches(),
        getSubjects(),
        getTeachers(),
      ]);
      setBranches(branchList);
      setSubjects(subjectList);
      setTeachers(teacherList);

      // Load enrolled class IDs for existing students
      const existingStudentIds = formData.students
        .filter(s => s.mode === 'existing' && s.existingStudentId)
        .map(s => s.existingStudentId!);
      if (existingStudentIds.length > 0) {
        const allEnrollments = await Promise.all(
          existingStudentIds.map(id => getEnrollmentsByStudent(id))
        );
        const classIds = new Set(
          allEnrollments.flat()
            .filter(e => e.status === 'active')
            .map(e => e.classId)
        );
        setEnrolledClassIds(classIds);
      }

      // Default to BranchContext's selected branch if not set
      const branchToUse = formData.branchId || selectedBranchId;
      if (branchToUse) {
        if (!formData.branchId) {
          setFormData(prev => ({ ...prev, branchId: branchToUse }));
        }
        await loadClasses(branchToUse);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async (branchId: string) => {
    try {
      const allClasses = await getClasses();
      const filtered = allClasses.filter(
        c => c.branchId === branchId && ['published', 'started'].includes(c.status)
      );
      setClasses(filtered);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const handleBranchChange = async (branchId: string) => {
    setFormData(prev => ({ ...prev, branchId }));
    await loadClasses(branchId);
    setFormData(prev => ({
      ...prev,
      branchId,
      students: prev.students.map(s => ({ ...s, classId: '' })),
    }));
    setPage(1);
  };

  const getSubjectForClass = (cls: Class) => subjects.find(s => s.id === cls.subjectId);
  const getTeacherForClass = (cls: Class) => teachers.find(t => t.id === cls.teacherId);

  const getAgeWarning = (cls: Class, studentIndex: number): string | null => {
    const student = formData.students[studentIndex];
    if (!student.birthdate) return null;
    const age = calculateAge(new Date(student.birthdate));
    const subject = getSubjectForClass(cls);
    if (subject && (age < subject.ageRange.min || age > subject.ageRange.max)) {
      return `อายุ ${age} ปี ไม่อยู่ในช่วง ${subject.ageRange.min}-${subject.ageRange.max} ปี`;
    }
    return null;
  };

  const getCompletedSessions = (cls: Class): number => {
    const start = new Date(cls.startDate);
    const today = new Date();
    if (today < start) return 0;
    const end = today < new Date(cls.endDate) ? today : new Date(cls.endDate);
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      if (cls.daysOfWeek.includes(d.getDay())) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  // Unique subjects from loaded classes
  const availableSubjects = useMemo(() => {
    const ids = [...new Set(classes.map(c => c.subjectId))];
    return ids.map(id => subjects.find(s => s.id === id)).filter(Boolean) as Subject[];
  }, [classes, subjects]);

  const selectedSubjectLabel = subjectFilter === 'all'
    ? 'ทุกวิชา'
    : availableSubjects.find(s => s.id === subjectFilter)?.name || 'ทุกวิชา';

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (subjectFilter !== 'all' && c.subjectId !== subjectFilter) return false;
      if (hideFull && c.maxStudents - c.enrolledCount <= 0) return false;
      if (hideStarted && new Date(c.startDate) < new Date()) return false;
      if (searchTerm) {
        const subject = getSubjectForClass(c);
        const teacher = getTeacherForClass(c);
        const term = searchTerm.toLowerCase();
        return (
          c.name.toLowerCase().includes(term) ||
          c.code.toLowerCase().includes(term) ||
          subject?.name.toLowerCase().includes(term) ||
          teacher?.name?.toLowerCase().includes(term) ||
          teacher?.nickname?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [classes, searchTerm, subjectFilter, hideFull, hideStarted]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, subjectFilter, hideFull, hideStarted, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / pageSize));
  const paginatedClasses = filteredClasses.slice((page - 1) * pageSize, page * pageSize);

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const selectClass = (studentIndex: number, classId: string) => {
    setFormData(prev => ({
      ...prev,
      students: prev.students.map((s, i) =>
        i === studentIndex ? { ...s, classId } : s
      ),
    }));
  };

  const validate = (): boolean => {
    if (!formData.branchId) {
      toast.error('กรุณาเลือกสาขา');
      return false;
    }
    for (let i = 0; i < formData.students.length; i++) {
      if (!formData.students[i].classId) {
        toast.error(`กรุณาเลือกคลาสสำหรับนักเรียนคนที่ ${i + 1}`);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
        <span className="text-base text-gray-500">กำลังโหลดข้อมูลคลาส...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header: branch selector */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xl font-semibold whitespace-nowrap">เลือกคลาสเรียนของ</h2>
        <Select value={formData.branchId} onValueChange={handleBranchChange}>
          <SelectTrigger className="w-48 text-base">
            <SelectValue placeholder="เลือกสาขา" />
          </SelectTrigger>
          <SelectContent>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id} className="text-base">
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.branchId && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ค้นหาคลาส... (ชื่อ, รหัส, วิชา, ครู)"
                className="pl-10 text-base h-9"
              />
            </div>

            {/* Searchable subject filter */}
            <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-44 justify-start text-base font-normal">
                  <Filter className="h-3.5 w-3.5 mr-2 shrink-0" />
                  <span className="truncate">{selectedSubjectLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  {availableSubjects.length > 7 && (
                    <CommandInput placeholder="ค้นหาวิชา..." className="text-base" />
                  )}
                  <CommandList>
                    <CommandEmpty>ไม่พบวิชา</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="ทุกวิชา"
                        onSelect={() => { setSubjectFilter('all'); setSubjectPopoverOpen(false); }}
                        className="text-base"
                      >
                        <Check className={cn('mr-2 h-4 w-4', subjectFilter === 'all' ? 'opacity-100' : 'opacity-0')} />
                        ทุกวิชา
                      </CommandItem>
                      {availableSubjects.map(s => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => { setSubjectFilter(s.id); setSubjectPopoverOpen(false); }}
                          className="text-base"
                        >
                          <Check className={cn('mr-2 h-4 w-4', subjectFilter === s.id ? 'opacity-100' : 'opacity-0')} />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button
              variant={hideFull ? 'default' : 'outline'}
              size="sm"
              className="text-base h-9"
              onClick={() => setHideFull(!hideFull)}
            >
              ซ่อนคลาสเต็ม
            </Button>
            <Button
              variant={hideStarted ? 'default' : 'outline'}
              size="sm"
              className="text-base h-9"
              onClick={() => setHideStarted(!hideStarted)}
            >
              เฉพาะยังไม่เริ่ม
            </Button>
          </div>

          {/* Class list */}
          <div>
            {formData.students.map((student, studentIndex) => (
              <div key={studentIndex} className="flex flex-col">
                <h3 className="text-base font-medium mb-2">
                  เลือกคลาสสำหรับ {student.nickname || student.name || `นักเรียนคนที่ ${studentIndex + 1}`}
                  <span className="text-base text-gray-400 ml-2">
                    ({filteredClasses.length} คลาส)
                  </span>
                </h3>

                <Card className="flex flex-col">
                  <div className="space-y-2 p-3">
                    {paginatedClasses.length === 0 ? (
                      <p className="text-base text-gray-500 text-center py-8">
                        ไม่พบคลาสที่ตรงกับเงื่อนไข
                      </p>
                    ) : (
                      paginatedClasses.map(cls => {
                        const subject = getSubjectForClass(cls);
                        const teacher = getTeacherForClass(cls);
                        const ageWarning = getAgeWarning(cls, studentIndex);
                        const availableSeats = cls.maxStudents - cls.enrolledCount;
                        const completedSessions = getCompletedSessions(cls);
                        const isSelected = student.classId === cls.id;
                        const isFull = availableSeats <= 0;
                        const isAlreadyEnrolled = enrolledClassIds.has(cls.id);
                        const isDisabled = isFull || isAlreadyEnrolled;

                        return (
                          <div
                            key={cls.id}
                            className={cn(
                              'p-3 rounded-lg transition-all',
                              isSelected
                                ? 'border border-transparent bg-green-200 ring-2 ring-green-500'
                                : isDisabled
                                ? 'border border-dashed border-gray-300 bg-gray-50 opacity-35 cursor-not-allowed'
                                : 'border border-transparent bg-green-50 hover:bg-green-100 cursor-pointer'
                            )}
                            onClick={() => !isDisabled && selectClass(studentIndex, cls.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {isSelected && <Check className="h-5 w-5 text-green-600" />}
                                  <span className={cn('text-base font-medium', isDisabled && 'line-through')}>{cls.name}</span>
                                  <Badge
                                    variant="outline"
                                    style={{ borderColor: subject?.color, color: subject?.color }}
                                    className="text-xs"
                                  >
                                    {subject?.name}
                                  </Badge>
                                  {isAlreadyEnrolled && (
                                    <Badge className="bg-gray-500 text-white text-xs">
                                      ลงทะเบียนแล้ว
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                                  <span>
                                    <Calendar className="h-3.5 w-3.5 inline mr-1" />
                                    {cls.daysOfWeek.map(d => getDayName(d)).join(', ')}
                                  </span>
                                  <span>
                                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                                    {cls.startTime?.slice(0, 5)} - {cls.endTime?.slice(0, 5)}
                                  </span>
                                  <span>ครู: {teacher?.nickname || teacher?.name}</span>
                                  <span>{formatDateCompact(cls.startDate)} - {formatDateCompact(cls.endDate)}</span>
                                  <span>เรียนไปแล้ว {completedSessions}/{cls.totalSessions} ครั้ง</span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-base font-medium">{formatCurrency(cls.pricing.totalPrice)}</p>
                                <p className={cn(
                                  'text-sm font-medium',
                                  isFull ? 'text-red-600' : availableSeats <= 2 ? 'text-orange-500' : 'text-gray-500'
                                )}>
                                  <Users className="h-3.5 w-3.5 inline mr-1" />
                                  {isFull ? 'เต็ม' : `${cls.enrolledCount}/${cls.maxStudents} ที่นั่ง`}
                                </p>
                              </div>
                            </div>
                            {ageWarning && (
                              <div className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {ageWarning}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Pagination footer inside card */}
                  {filteredClasses.length > 0 && (
                    <div className="flex items-center justify-between border-t px-4 py-2 bg-gray-50/50">
                      {/* Left: rows per page */}
                      <div className="flex items-center gap-2">
                        <span className="text-base text-gray-600">แสดง</span>
                        <Select
                          value={String(pageSize)}
                          onValueChange={(v) => setPageSize(Number(v))}
                        >
                          <SelectTrigger className="w-[70px] h-8 text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(size => (
                              <SelectItem key={size} value={String(size)} className="text-base">
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-base text-gray-600">/ หน้า</span>
                      </div>

                      {/* Right: page numbers */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={page <= 1}
                          onClick={() => setPage(1)}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={page <= 1}
                          onClick={() => setPage(p => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {getPageNumbers().map((p, idx) =>
                          p === '...' ? (
                            <span key={`dots-${idx}`} className="px-1 text-base text-gray-400">...</span>
                          ) : (
                            <Button
                              key={p}
                              variant={page === p ? 'default' : 'ghost'}
                              size="icon"
                              className={cn(
                                'h-8 w-8 text-base',
                                page === p && 'bg-red-500 hover:bg-red-600 text-white'
                              )}
                              onClick={() => setPage(p as number)}
                            >
                              {p}
                            </Button>
                          )
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={page >= totalPages}
                          onClick={() => setPage(p => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={page >= totalPages}
                          onClick={() => setPage(totalPages)}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sticky navigation footer */}
      <div className="flex justify-between pt-3 border-t">
        <Button variant="outline" onClick={onBack} className="text-base">
          <ChevronLeft className="h-4 w-4 mr-2" />
          ย้อนกลับ
        </Button>
        <Button onClick={handleNext} className="bg-red-500 hover:bg-red-600 text-base">
          ถัดไป
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

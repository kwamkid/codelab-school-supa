'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Class } from '@/types/models';
import { getClasses, deleteClass, batchUpdateClassStatuses } from '@/lib/services/classes';
import { getClassLookupData } from '@/lib/services/lookup';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Calendar,
  Trash2,
  Edit,
  Eye,
  MoreHorizontal,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { TeacherBadge } from "@/components/ui/teacher-badge";
import { formatDate, formatCurrency, getDayName } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchInput } from '@/components/ui/search-input';
import { FormSelect } from '@/components/ui/form-select';
import { StatusFilterTabs } from '@/components/ui/status-filter-tabs';
import { SortableTableHead, useSortableTable } from '@/components/ui/sortable-table-head';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLoading, InlineLoading } from '@/components/ui/loading';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranch } from '@/contexts/BranchContext';
import { ActionButton } from '@/components/ui/action-button';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { useAuth } from '@/hooks/useAuth';
import { Pagination, usePagination } from '@/components/ui/pagination';

const statusColors = {
  'draft': 'bg-gray-100 text-gray-700',
  'published': 'bg-blue-100 text-blue-700',
  'started': 'bg-green-100 text-green-700',
  'completed': 'bg-gray-100 text-gray-700',
  'cancelled': 'bg-red-100 text-red-700',
};

const statusLabels = {
  'draft': 'ร่าง',
  'published': 'เปิดรับสมัคร',
  'started': 'กำลังเรียน',
  'completed': 'จบแล้ว',
  'cancelled': 'ยกเลิก',
};

export default function ClassesPage() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const { isSuperAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    updated: number;
    errors: string[];
  } | null>(null);
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  // extra: 'all' | 'notFull' (ยังไม่เต็ม) | 'openingSoon' (ใกล้เปิด)
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');

  // Column sorting (shared)
  const { sort, toggle: toggleSort, sortRows } = useSortableTable();

  // ============================================
  // 🎯 Pagination Hook
  // ============================================
  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginatedData,
    totalPages: calculateTotalPages
  } = usePagination(20);

  // ============================================
  // 🎯 Query 1: Classes (Load First)
  // ============================================
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes', selectedBranchId],
    queryFn: () => getClasses(selectedBranchId),
    staleTime: Infinity,
  });

  // ============================================
  // 🎯 Query 2: Lookup Data (single RPC replaces 3 queries)
  // ============================================
  const { data: lookupData, isLoading: loadingLookup } = useQuery({
    queryKey: ['classLookupData', selectedBranchId],
    queryFn: () => getClassLookupData(selectedBranchId),
    staleTime: 5 * 60 * 1000, // 5 min — so teacher avatar/name changes show up without a hard reload
  });

  const branches = lookupData?.branches || [];
  const subjects = lookupData?.subjects || [];
  const teachers = lookupData?.teachers || [];
  const classStats = lookupData?.classStats || {};

  // Create lookup maps for better performance
  const branchesMap = useMemo(() => 
    new Map(branches.map(b => [b.id, b])), 
    [branches]
  );
  
  const subjectsMap = useMemo(() => 
    new Map(subjects.map(s => [s.id, s])), 
    [subjects]
  );
  
  const teachersMap = useMemo(() => 
    new Map(teachers.map(t => [t.id, t])), 
    [teachers]
  );

  // Helper functions using maps
  const getBranchName = (branchId: string) => branchesMap.get(branchId)?.name || 'Unknown';
  const getSubjectName = (subjectId: string) => subjectsMap.get(subjectId)?.name || 'Unknown';
  const getSubjectColor = (subjectId: string) => subjectsMap.get(subjectId)?.color || '#gray';
  const getTeacher = (teacherId: string) => teachersMap.get(teacherId);
  const getTeacherName = (teacherId: string) => {
    const teacher = teachersMap.get(teacherId);
    return teacher?.nickname || teacher?.name || 'Unknown';
  };

  // Filter classes with memoization
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      // Branch safety filter: never show a class from another branch when a
      // specific branch is selected (guards against the query returning
      // cross-branch rows, e.g. before the branch id has hydrated).
      if (selectedBranchId && cls.branchId !== selectedBranchId) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          cls.name.toLowerCase().includes(search) ||
          cls.code.toLowerCase().includes(search);

        if (!matchesSearch) return false;
      }

      // Status filter
      if (selectedStatus === 'active') {
        if (cls.status !== 'published' && cls.status !== 'started') return false;
      } else if (selectedStatus !== 'all' && cls.status !== selectedStatus) return false;
      if (selectedSubject !== 'all' && cls.subjectId !== selectedSubject) return false;
      if (selectedTeacher !== 'all' && cls.teacherId !== selectedTeacher) return false;

      // Availability filter
      if (selectedAvailability === 'notFull') {
        if (cls.enrolledCount >= cls.maxStudents) return false;
      } else if (selectedAvailability === 'openingSoon') {
        // เปิดรับสมัคร + วันเริ่มเรียนภายใน 30 วันข้างหน้า (และยังไม่เริ่ม)
        if (cls.status !== 'published') return false;
        const start = new Date(cls.startDate).getTime();
        const now = Date.now();
        const in30Days = now + 30 * 24 * 60 * 60 * 1000;
        if (!(start >= now && start <= in30Days)) return false;
      }
      return true;
    });
  }, [classes, selectedBranchId, searchTerm, selectedStatus, selectedSubject, selectedTeacher, selectedAvailability]);

  // ============================================
  // 🎯 Paginated Classes
  // ============================================
  // Apply column sort, then paginate
  const sortedClasses = useMemo(() => {
    return sortRows(filteredClasses, (cls, key) => {
      switch (key) {
        case 'subject': return getSubjectName(cls.subjectId);
        case 'teacher': return getTeacherName(cls.teacherId);
        case 'seats': return cls.maxStudents > 0 ? cls.enrolledCount / cls.maxStudents : 0;
        case 'progress': return cls.totalSessions > 0 ? (classStats[cls.id] || 0) / cls.totalSessions : 0;
        case 'price': return cls.pricing.totalPrice;
        default: return null;
      }
    });
  }, [filteredClasses, sortRows, getSubjectName, getTeacherName, classStats]);

  const paginatedClasses = useMemo(() => {
    return getPaginatedData(sortedClasses);
  }, [sortedClasses, getPaginatedData]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return calculateTotalPages(filteredClasses.length);
  }, [filteredClasses.length, calculateTotalPages]);

  // Classes scoped to the selected branch — basis for stats so the status-tab
  // counts match the rows actually shown (not inflated by other branches).
  const branchClasses = useMemo(
    () => (selectedBranchId ? classes.filter(c => c.branchId === selectedBranchId) : classes),
    [classes, selectedBranchId]
  );

  // Calculate statistics with memoization
  const stats = useMemo(() => ({
    total: branchClasses.length,
    draft: branchClasses.filter(c => c.status === 'draft').length,
    published: branchClasses.filter(c => c.status === 'published').length,
    started: branchClasses.filter(c => c.status === 'started').length,
    completed: branchClasses.filter(c => c.status === 'completed').length,
    cancelled: branchClasses.filter(c => c.status === 'cancelled').length,
    totalSeats: branchClasses.reduce((sum, c) => sum + c.maxStudents, 0),
    enrolledSeats: branchClasses.reduce((sum, c) => sum + c.enrolledCount, 0),
  }), [branchClasses]);

  // Get unique subjects used in current classes (for subject chips)
  const usedSubjects = useMemo(() => {
    const subjectIds = [...new Set(classes.map(c => c.subjectId))];
    return subjectIds
      .map(id => subjects.find(s => s.id === id))
      .filter(Boolean) as typeof subjects;
  }, [classes, subjects]);

  // Get unique teachers used in current classes (for teacher filter), sorted by name
  const usedTeachers = useMemo(() => {
    const teacherIds = [...new Set(classes.map(c => c.teacherId).filter(Boolean))];
    return teacherIds
      .map(id => teachersMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (a!.nickname || a!.name).localeCompare(b!.nickname || b!.name, 'th')) as NonNullable<ReturnType<typeof teachersMap.get>>[];
  }, [classes, teachersMap]);

  // ============================================
  // 🎯 Reset Pagination on Filter Change
  // ============================================
  useEffect(() => {
    resetPagination();
  }, [selectedBranchId, selectedStatus, selectedSubject, selectedTeacher, selectedAvailability, searchTerm, sort, resetPagination]);

  const handleDeleteClass = async (classId: string, className: string) => {
    setDeletingId(classId);
    try {
      await deleteClass(classId);
      toast.success(`ลบคลาส ${className} เรียบร้อยแล้ว`);
      queryClient.invalidateQueries({ queryKey: ['classes', selectedBranchId] });
    } catch (error: any) {
      console.error('Error deleting class:', error);
      if (error.message === 'Cannot delete class with enrolled students') {
        toast.error('ไม่สามารถลบคลาสที่มีนักเรียนลงทะเบียนแล้ว');
      } else {
        toast.error('ไม่สามารถลบคลาสได้');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateClassStatuses = async () => {
    setUpdatingStatus(true);
    setUpdateResult(null);
    
    try {
      const result = await batchUpdateClassStatuses();
      setUpdateResult(result);
      
      if (result.updated > 0) {
        toast.success(`อัปเดตสถานะคลาสสำเร็จ ${result.updated} คลาส`);
        queryClient.invalidateQueries({ queryKey: ['classes', selectedBranchId] });
      } else {
        toast.info('ไม่มีคลาสที่ต้องอัปเดตสถานะ');
      }
      
      if (result.errors.length > 0) {
        toast.error(`พบข้อผิดพลาด ${result.errors.length} รายการ`);
      }
    } catch (error) {
      console.error('Error updating class statuses:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ============================================
  // 🎨 Loading States (Progressive)
  // ============================================
  
  // Phase 1: Classes Loading (Show skeleton)
  if (loadingClasses) {
    return <SectionLoading />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            คลาสเรียน
            {!isAllBranches && (
              <span className="text-red-600 text-base sm:text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>
            )}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            จัดการตารางเรียนและคลาสทั้งหมด
            {(loadingLookup || loadingLookup || loadingLookup) && (
              <span className="text-orange-500 ml-2">(กำลังโหลดข้อมูลเพิ่มเติม...)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin() && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleUpdateClassStatuses}
              disabled={updatingStatus}
              title="อัปเดตสถานะคลาส"
              className="h-9 w-9"
            >
              <RefreshCw className={`h-4 w-4 ${updatingStatus ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
            <Link href="/classes/new">
              <ActionButton action="create" size="sm" className="bg-red-500 hover:bg-red-600">
                <Plus className="h-4 w-4 mr-2" />
                สร้างคลาสใหม่
              </ActionButton>
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* Show update result */}
      {updateResult && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">อัปเดตสถานะสำเร็จ: {updateResult.updated} คลาส</span>
              </div>
              {updateResult.errors.length > 0 && (
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <span className="font-medium text-red-600">พบข้อผิดพลาด: {updateResult.errors.length} รายการ</span>
                    <ul className="text-sm text-red-600 mt-1">
                      {updateResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Filter Cards */}
      <StatusFilterTabs
        value={selectedStatus}
        onChange={setSelectedStatus}
        className="mb-6"
        tabs={[
          { value: 'active', label: 'กำลังดำเนินการ', count: stats.published + stats.started, activeBg: 'bg-gray-900', inactiveBg: 'bg-gray-100', inactiveLabel: 'text-gray-600', inactiveCount: 'text-gray-800', always: true },
          { value: 'all', label: 'ทั้งหมด', count: stats.total, activeBg: 'bg-indigo-500', inactiveBg: 'bg-indigo-50', inactiveLabel: 'text-indigo-600', inactiveCount: 'text-indigo-700', always: true },
          { value: 'started', label: 'กำลังเรียน', count: stats.started, activeBg: 'bg-green-600', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-600', inactiveCount: 'text-green-700' },
          { value: 'published', label: 'เปิดรับสมัคร', count: stats.published, activeBg: 'bg-blue-600', inactiveBg: 'bg-blue-50', inactiveLabel: 'text-blue-600', inactiveCount: 'text-blue-700' },
          { value: 'completed', label: 'จบแล้ว', count: stats.completed, activeBg: 'bg-gray-600', inactiveBg: 'bg-gray-50', inactiveLabel: 'text-gray-500', inactiveCount: 'text-gray-700' },
          { value: 'draft', label: 'ร่าง', count: stats.draft, activeBg: 'bg-gray-500', inactiveBg: 'bg-gray-50', inactiveLabel: 'text-gray-500', inactiveCount: 'text-gray-700' },
          { value: 'cancelled', label: 'ยกเลิก', count: stats.cancelled, activeBg: 'bg-red-500', inactiveBg: 'bg-red-50', inactiveLabel: 'text-red-600', inactiveCount: 'text-red-700' },
        ]}
      />

      {/* Filters — all on one row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SearchInput
          placeholder="ค้นหาชื่อคลาส, รหัสคลาส..."
          value={searchTerm}
          onChange={setSearchTerm}
        />

        <FormSelect
          value={selectedSubject}
          onValueChange={setSelectedSubject}
          className="h-11"
          placeholder="ทุกวิชา"
          searchPlaceholder="ค้นหาวิชา..."
          options={[
            { value: 'all', label: 'ทุกวิชา' },
            ...usedSubjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
          ]}
        />

        <FormSelect
          value={selectedTeacher}
          onValueChange={setSelectedTeacher}
          className="h-11"
          placeholder="ครูทั้งหมด"
          searchPlaceholder="ค้นหาครู..."
          options={[
            { value: 'all', label: 'ครูทั้งหมด' },
            ...usedTeachers.map((t) => ({ value: t.id, label: t.nickname || t.name })),
          ]}
        />

        <FormSelect
          value={selectedAvailability}
          onValueChange={setSelectedAvailability}
          className="h-11"
          placeholder="ทุกคลาส"
          options={[
            { value: 'all', label: 'ทุกคลาส' },
            { value: 'notFull', label: 'คลาสที่ยังไม่เต็ม' },
            { value: 'openingSoon', label: 'คลาสที่ใกล้เปิด (ภายใน 30 วัน)' },
          ]}
        />
      </div>

      {/* Classes Table */}
      <Card>
        <CardContent className="p-0">
          {filteredClasses.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={classes.length === 0 ? 'ยังไม่มีคลาสเรียน' : 'ไม่พบคลาสที่ตรงกับเงื่อนไข'}
              description={classes.length === 0 ? 'เริ่มต้นด้วยการสร้างคลาสแรก' : 'ลองปรับเงื่อนไขการค้นหาใหม่'}
              action={classes.length === 0 ? (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href="/classes/new">
                    <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      สร้างคลาสใหม่
                    </ActionButton>
                  </Link>
                </PermissionGuard>
              ) : undefined}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="subject" currentSort={sort} onSort={toggleSort} className="w-[220px]">คลาส</SortableTableHead>
                      {isAllBranches && <TableHead className="w-[80px]">สาขา</TableHead>}
                      <SortableTableHead sortKey="teacher" currentSort={sort} onSort={toggleSort} className="w-[130px]">ครูผู้สอน</SortableTableHead>
                      <TableHead className="w-[110px]">วัน/เวลา</TableHead>
                      <SortableTableHead sortKey="seats" currentSort={sort} onSort={toggleSort} className="w-[120px]">ที่นั่ง</SortableTableHead>
                      <SortableTableHead sortKey="progress" currentSort={sort} onSort={toggleSort} className="w-[140px]">ความคืบหน้า</SortableTableHead>
                      <SortableTableHead sortKey="price" currentSort={sort} onSort={toggleSort} className="text-right w-[90px]">ราคา</SortableTableHead>
                      <TableHead className="text-center w-[100px]">สถานะ</TableHead>
                      <TableHead className="text-center w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClasses.map((cls) => {
                      const isDeletable = cls.enrolledCount <= 0 || cls.status === 'cancelled';
                      const teacher = getTeacher(cls.teacherId);
                      const teacherName = getTeacherName(cls.teacherId);

                      // Seat fill: green < 80%, amber 80–99%, red full
                      const seatRatio = cls.maxStudents > 0 ? cls.enrolledCount / cls.maxStudents : 0;
                      const seatFull = cls.enrolledCount >= cls.maxStudents;
                      const seatColor = seatFull
                        ? 'bg-red-500'
                        : seatRatio >= 0.8
                        ? 'bg-amber-500'
                        : 'bg-green-500';
                      const seatText = seatFull
                        ? 'text-red-600'
                        : seatRatio >= 0.8
                        ? 'text-amber-600'
                        : 'text-gray-900';

                      // Progress: completed sessions / total
                      const done = classStats[cls.id] || 0;
                      const total = cls.totalSessions || 0;
                      const progressPct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

                      return (
                        <TableRow
                          key={cls.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/classes/${cls.id}`)}
                        >
                          {/* คลาส: ชื่อวิชา (title) + รหัสคลาส (subtitle) */}
                          <TableCell className="align-middle">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getSubjectColor(cls.subjectId) }}
                              />
                              <div className="min-w-0">
                                <div className="font-medium truncate" title={loadingLookup ? cls.code : getSubjectName(cls.subjectId)}>
                                  {loadingLookup ? '...' : getSubjectName(cls.subjectId)}
                                </div>
                                <div className="text-xs text-gray-500 truncate" title={cls.code}>{cls.code}</div>
                              </div>
                            </div>
                          </TableCell>
                          {isAllBranches && (
                            <TableCell className="align-middle">
                              {loadingLookup ? <InlineLoading /> : <div className="text-xs">{getBranchName(cls.branchId)}</div>}
                            </TableCell>
                          )}
                          {/* ครูผู้สอน */}
                          <TableCell className="align-middle">
                            {loadingLookup ? (
                              <InlineLoading />
                            ) : (
                              <TeacherBadge name={teacherName} imageUrl={teacher?.profileImage} size="md" />
                            )}
                          </TableCell>
                          {/* วัน/เวลา */}
                          <TableCell className="align-middle">
                            <div className="leading-tight">{cls.daysOfWeek.map(d => getDayName(d)).join(', ')}</div>
                            <div className="text-xs text-gray-500">{cls.startTime?.substring(0, 5)}-{cls.endTime?.substring(0, 5)}</div>
                          </TableCell>
                          {/* ที่นั่ง: progress bar + เต็ม/ว่าง */}
                          <TableCell className="align-middle">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`font-medium ${seatText}`}>{cls.enrolledCount}/{cls.maxStudents}</span>
                              {seatFull ? (
                                <span className="text-red-600 font-medium">เต็ม</span>
                              ) : (
                                <span className="text-gray-400">ว่าง {cls.maxStudents - cls.enrolledCount}</span>
                              )}
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${seatColor}`}
                                style={{ width: `${Math.min(100, Math.round(seatRatio * 100))}%` }}
                              />
                            </div>
                          </TableCell>
                          {/* ความคืบหน้า: sessions progress */}
                          <TableCell className="align-middle">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-700">
                                {done > 0 ? <span className="text-blue-600 font-medium">{done}/{total}</span> : <span>{total}</span>} ครั้ง
                              </span>
                              <span className="text-gray-400">{formatDate(cls.endDate, 'short')}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </TableCell>
                          {/* ราคา */}
                          <TableCell className="text-right font-medium text-green-600 align-middle">
                            {formatCurrency(cls.pricing.totalPrice)}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <Badge
                              className={`${statusColors[cls.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}
                              variant={!cls.status ? 'destructive' : 'default'}
                            >
                              {statusLabels[cls.status as keyof typeof statusLabels] || 'ไม่ระบุ'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">เปิดเมนู</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/classes/${cls.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    ดูรายละเอียด
                                  </Link>
                                </DropdownMenuItem>
                                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/classes/${cls.id}/edit`}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      แก้ไข
                                    </Link>
                                  </DropdownMenuItem>
                                </PermissionGuard>
                                {isDeletable && (
                                  <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem 
                                          onSelect={(e) => e.preventDefault()}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          ลบคลาส
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>ยืนยันการลบคลาส</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            คุณแน่ใจหรือไม่ที่จะลบคลาส &quot;{cls.name}&quot;? 
                                            การกระทำนี้ไม่สามารถยกเลิกได้
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                                            disabled={deletingId === cls.id}
                                            className="bg-red-500 hover:bg-red-600"
                                          >
                                            {deletingId === cls.id ? 'กำลังลบ...' : 'ลบคลาส'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </PermissionGuard>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Component */}
              {filteredClasses.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredClasses.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={[10, 20, 50, 100]}
                  showFirstLastButtons={false}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Enrollment } from '@/types/models';
import {
  getEnrollmentsPaginated,
  getEnrollmentStats,
  getEnrollments,
  deleteEnrollment,
  cancelEnrollment,
  PaginatedEnrollments,
  EnrollmentStats
} from '@/lib/services/enrollments';
import { getClasses } from '@/lib/services/classes';
import { getActiveBranches } from '@/lib/services/branches';
import { getAllStudentsWithParents } from '@/lib/services/parents';
import { getSubjects } from '@/lib/services/subjects';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Users,
  Edit,
  XCircle,
  Trash2,
  MoreVertical,
  CreditCard,
  Loader2,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateCompact, formatCurrency } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { SectionLoading, InlineLoading } from '@/components/ui/loading';
import { Pagination, usePagination } from '@/components/ui/pagination';

const statusColors = {
  'active': 'bg-green-100 text-green-700',
  'completed': 'bg-gray-100 text-gray-700',
  'dropped': 'bg-red-100 text-red-700',
  'transferred': 'bg-blue-100 text-blue-700',
};

const statusLabels = {
  'active': 'กำลังเรียน',
  'completed': 'จบแล้ว',
  'dropped': 'ยกเลิก',
  'transferred': 'ย้ายคลาส',
};

const paymentStatusColors = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'partial': 'bg-orange-100 text-orange-700',
  'paid': 'bg-green-100 text-green-700',
};

const paymentStatusLabels = {
  'pending': 'รอชำระ',
  'partial': 'ชำระบางส่วน',
  'paid': 'ชำระแล้ว',
};

const dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function EnrollmentsPage() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const { adminUser, isSuperAdmin, isBranchAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Permission check - redirect if not super_admin or branch_admin
  useEffect(() => {
    if (!authLoading && adminUser) {
      if (!isSuperAdmin() && !isBranchAdmin()) {
        router.push('/dashboard');
      }
    }
  }, [authLoading, adminUser, isSuperAdmin, isBranchAdmin, router]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');

  // Date range filter
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(undefined);
  
  // Pagination using hook
  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginatedData,
    totalPages: calculateTotalPages
  } = usePagination(20);

  const isSearchMode = debouncedSearchTerm.length > 0;
  const hasActiveFilters = isSearchMode || !!dateRange;
  
  // Other states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // ============================================
  // 🎯 Query 1: Stats (Load First - Fast)
  // ============================================
  const { data: stats, isLoading: loadingStats } = useQuery<EnrollmentStats>({
    queryKey: ['enrollment-stats', selectedBranchId],
    queryFn: () => getEnrollmentStats(selectedBranchId),
    staleTime: 2 * 60 * 1000,
  });

  // ============================================
  // 🎯 Query 2: Paginated Enrollments (Normal Mode)
  // ============================================
  const offset = (currentPage - 1) * pageSize;

  const {
    data: paginatedData,
    isLoading: loadingEnrollments,
    isFetching: fetchingEnrollments
  } = useQuery<PaginatedEnrollments>({
    queryKey: [
      'enrollments-paginated',
      selectedBranchId,
      selectedStatus,
      selectedPaymentStatus,
      pageSize,
      currentPage
    ],
    queryFn: async () => {
      return await getEnrollmentsPaginated({
        branchId: selectedBranchId,
        status: selectedStatus,
        paymentStatus: selectedPaymentStatus,
        limit: pageSize,
        offset: offset,
      });
    },
    enabled: !isSearchMode,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // ============================================
  // 🎯 Query 3: All Enrollments (Search Mode Fallback)
  // ============================================
  const { 
    data: allEnrollments = [], 
    isLoading: loadingAllEnrollments 
  } = useQuery<Enrollment[]>({
    queryKey: ['enrollments-all', selectedBranchId],
    queryFn: () => getEnrollments(selectedBranchId),
    enabled: hasActiveFilters,
    staleTime: 2 * 60 * 1000,
  });

  // ============================================
  // 🎯 Query 4: Supporting Data (Cached Longer)
  // ============================================
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', 'withParents', selectedBranchId],
    queryFn: () => getAllStudentsWithParents(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes', selectedBranchId],
    queryFn: () => getClasses(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: getActiveBranches,
    staleTime: 10 * 60 * 1000,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: getSubjects,
    staleTime: 10 * 60 * 1000,
  });

  // Create lookup maps
  const studentsMap = useMemo(() => 
    new Map(students.map(s => [s.id, s])), 
    [students]
  );
  
  const classesMap = useMemo(() => 
    new Map(classes.map(c => [c.id, c])), 
    [classes]
  );
  
  const branchesMap = useMemo(() =>
    new Map(branches.map(b => [b.id, b])),
    [branches]
  );

  const subjectsMap = useMemo(() =>
    new Map(subjects.map(s => [s.id, s])),
    [subjects]
  );

  const getStudentInfo = (studentId: string) => studentsMap.get(studentId);
  const getClassInfo = (classId: string) => classesMap.get(classId);
  const getBranchName = (branchId: string) => branchesMap.get(branchId)?.name || 'Unknown';

  // ============================================
  // 🎯 Enrollment Data
  // ============================================
  // Date filter helper
  const isInDateRange = (enrolledAt: Date) => {
    if (!dateRange) return true;
    const enrolled = enrolledAt.toISOString().split('T')[0];
    if (dateRange.from && enrolled < dateRange.from) return false;
    if (dateRange.to && enrolled > dateRange.to) return false;
    return true;
  };

  const enrollmentsToDisplay = useMemo(() => {
    if (hasActiveFilters) {
      return allEnrollments.filter(enrollment => {
        if (selectedStatus !== 'all' && enrollment.status !== selectedStatus) return false;
        if (selectedPaymentStatus !== 'all' && enrollment.payment.status !== selectedPaymentStatus) return false;
        if (!isInDateRange(enrollment.enrolledAt)) return false;

        if (isSearchMode) {
          const student = getStudentInfo(enrollment.studentId);
          const classInfo = getClassInfo(enrollment.classId);
          const searchLower = debouncedSearchTerm.toLowerCase();

          return (
            student?.name.toLowerCase().includes(searchLower) ||
            student?.nickname.toLowerCase().includes(searchLower) ||
            student?.parentName.toLowerCase().includes(searchLower) ||
            classInfo?.name.toLowerCase().includes(searchLower) ||
            classInfo?.code.toLowerCase().includes(searchLower)
          );
        }
        return true;
      });
    } else {
      return paginatedData?.enrollments || [];
    }
  }, [
    hasActiveFilters,
    isSearchMode,
    allEnrollments,
    paginatedData,
    selectedStatus,
    selectedPaymentStatus,
    debouncedSearchTerm,
    dateRange,
    getStudentInfo,
    getClassInfo
  ]);

  // Filtered stats for tabs — count by payment status from filtered data
  const filteredStats = useMemo(() => {
    if (!hasActiveFilters) return null;
    // Count from allEnrollments with search + date filters (but NOT payment status filter)
    const baseFiltered = allEnrollments.filter(enrollment => {
      if (selectedStatus !== 'all' && enrollment.status !== selectedStatus) return false;
      if (!isInDateRange(enrollment.enrolledAt)) return false;
      if (isSearchMode) {
        const student = getStudentInfo(enrollment.studentId);
        const classInfo = getClassInfo(enrollment.classId);
        const searchLower = debouncedSearchTerm.toLowerCase();
        return (
          student?.name.toLowerCase().includes(searchLower) ||
          student?.nickname.toLowerCase().includes(searchLower) ||
          student?.parentName.toLowerCase().includes(searchLower) ||
          classInfo?.name.toLowerCase().includes(searchLower) ||
          classInfo?.code.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
    return {
      total: baseFiltered.length,
      paidCount: baseFiltered.filter(e => e.payment.status === 'paid').length,
      pendingCount: baseFiltered.filter(e => e.payment.status === 'pending').length,
      partialCount: baseFiltered.filter(e => e.payment.status === 'partial').length,
      droppedCount: baseFiltered.filter(e => e.status === 'dropped').length,
    };
  }, [hasActiveFilters, allEnrollments, selectedStatus, dateRange, isSearchMode, debouncedSearchTerm, getStudentInfo, getClassInfo]);

  const paginatedSearchResults = useMemo(() => {
    if (!hasActiveFilters) return enrollmentsToDisplay;
    return getPaginatedData(enrollmentsToDisplay);
  }, [hasActiveFilters, enrollmentsToDisplay, getPaginatedData]);

  const displayedEnrollments = hasActiveFilters ? paginatedSearchResults : enrollmentsToDisplay;

  const totalPages = useMemo(() => {
    if (hasActiveFilters) {
      return calculateTotalPages(enrollmentsToDisplay.length);
    } else {
      // Use paginatedData.total which is already filtered
      if (paginatedData?.total !== undefined) {
        return Math.ceil(paginatedData.total / pageSize);
      }
      return paginatedData?.hasMore ? currentPage + 1 : currentPage;
    }
  }, [hasActiveFilters, enrollmentsToDisplay.length, calculateTotalPages, paginatedData?.total, pageSize, paginatedData?.hasMore, currentPage]);

  // ============================================
  // 🎯 Reset pagination on filter change
  // ============================================
  useEffect(() => {
    resetPagination();
  }, [selectedBranchId, selectedStatus, selectedPaymentStatus, debouncedSearchTerm, dateRange, resetPagination]);

  // ============================================
  // 🎯 Action Handlers
  // ============================================
  const handleDeleteEnrollment = async (enrollmentId: string) => {
    setDeletingId(enrollmentId);
    try {
      await deleteEnrollment(enrollmentId);
      toast.success('ลบการลงทะเบียนเรียบร้อยแล้ว');
      queryClient.invalidateQueries({ queryKey: ['enrollments-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-all'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-stats'] });
    } catch (error) {
      console.error('Error deleting enrollment:', error);
      toast.error('ไม่สามารถลบการลงทะเบียนได้');
    } finally {
      setDeletingId(null);
    }
  };


  const handleCancelEnrollment = async () => {
    if (!selectedEnrollment || !cancelReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }
    
    setCancelling(true);
    try {
      await cancelEnrollment(selectedEnrollment.id, cancelReason);
      toast.success('ยกเลิกการลงทะเบียนเรียบร้อยแล้ว');
      setShowCancelDialog(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['enrollments-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-all'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-stats'] });
    } catch (error) {
      console.error('Error cancelling enrollment:', error);
      toast.error('ไม่สามารถยกเลิกการลงทะเบียนได้');
    } finally {
      setCancelling(false);
    }
  };

  const handlePrintReceipt = () => {
    toast.info('ฟังก์ชันพิมพ์ใบเสร็จจะเพิ่มในภายหลัง');
  };

  // ============================================
  // 🎨 Loading States
  // ============================================
  
  // Phase 1: Stats Loading
  if (loadingStats) {
    return <SectionLoading />;
  }

  const isLoadingTable = isSearchMode ? loadingAllEnrollments : loadingEnrollments;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            ลงทะเบียน
            {!isAllBranches && <span className="text-red-600 text-base sm:text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            จัดการข้อมูลการลงทะเบียนเรียนทั้งหมด
            {isSearchMode && <span className="text-orange-500 ml-2">(โหมดค้นหา)</span>}
          </p>
        </div>
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <Link href="/enrollments/new">
            <ActionButton action="create" size="sm" className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />
              ลงทะเบียนใหม่
            </ActionButton>
          </Link>
        </PermissionGuard>
      </div>

      {/* Payment Status Tabs */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { value: 'all', label: 'ทั้งหมด', count: filteredStats?.total ?? stats?.total ?? 0, activeBg: 'bg-indigo-500', inactiveBg: 'bg-indigo-50', inactiveLabel: 'text-indigo-600', inactiveCount: 'text-indigo-700' },
          { value: 'paid', label: 'ชำระแล้ว', count: filteredStats?.paidCount ?? stats?.paidCount ?? 0, activeBg: 'bg-green-500', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-600', inactiveCount: 'text-green-700' },
          { value: 'pending', label: 'รอชำระ', count: filteredStats?.pendingCount ?? stats?.pendingCount ?? 0, activeBg: 'bg-yellow-400', inactiveBg: 'bg-yellow-50', inactiveLabel: 'text-yellow-600', inactiveCount: 'text-yellow-700' },
          { value: 'partial', label: 'ชำระบางส่วน', count: filteredStats?.partialCount ?? stats?.partialCount ?? 0, activeBg: 'bg-orange-500', inactiveBg: 'bg-orange-50', inactiveLabel: 'text-orange-600', inactiveCount: 'text-orange-700' },
          { value: 'dropped', label: 'ยกเลิก', count: filteredStats?.droppedCount ?? stats?.dropped ?? 0, activeBg: 'bg-red-500', inactiveBg: 'bg-red-50', inactiveLabel: 'text-red-600', inactiveCount: 'text-red-700', isStatusFilter: true },
        ].map((tab) => {
          const isDroppedTab = (tab as any).isStatusFilter;
          const isActive = isDroppedTab
            ? selectedStatus === 'dropped'
            : selectedPaymentStatus === tab.value && selectedStatus !== 'dropped';
          return (
            <button
              key={tab.value}
              onClick={() => {
                if (isDroppedTab) {
                  setSelectedStatus('dropped');
                  setSelectedPaymentStatus('all');
                } else {
                  setSelectedStatus('all');
                  setSelectedPaymentStatus(tab.value);
                }
              }}
              className={cn(
                'flex flex-col items-center justify-center w-24 h-[72px] rounded-xl transition-all',
                isActive
                  ? `${tab.activeBg} shadow-md`
                  : `${tab.inactiveBg} hover:shadow-sm`
              )}
            >
              <span className={cn(
                'text-sm font-medium',
                isActive ? 'text-white' : tab.inactiveLabel
              )}>
                {tab.label}
              </span>
              <span className={cn(
                'text-2xl font-bold mt-0.5',
                isActive ? 'text-white' : tab.inactiveCount
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Date Range */}
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="กรองตามวันที่ลงทะเบียน"
        />

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหาชื่อนักเรียน, ผู้ปกครอง, ชื่อคลาส..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status filter */}
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full md:w-[150px]">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Enrollments Table */}
      <Card>
        <CardContent className="p-0">
          {isLoadingTable ? (
            <SectionLoading />
          ) : displayedEnrollments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ไม่พบข้อมูลการลงทะเบียน
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedStatus !== 'all' || selectedPaymentStatus !== 'all'
                  ? 'ลองปรับเงื่อนไขการค้นหา'
                  : 'เริ่มต้นด้วยการลงทะเบียนนักเรียนคนแรก'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Card List */}
              <div className="divide-y md:hidden">
                {displayedEnrollments.map((enrollment) => {
                  const student = getStudentInfo(enrollment.studentId);
                  const classInfo = getClassInfo(enrollment.classId);
                  const subject = classInfo ? subjectsMap.get(classInfo.subjectId) : undefined;
                  const isUpcoming = enrollment.status === 'active' && classInfo?.startDate && new Date(classInfo.startDate) > new Date();

                  return (
                    <Link key={enrollment.id} href={`/enrollments/${enrollment.id}`} className="block px-4 py-3 hover:bg-gray-50 active:bg-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base truncate">
                            {student?.nickname || student?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {subject?.name || ''} {classInfo ? `${classInfo.daysOfWeek.map(d => dayLabels[d]).join(',')} ${classInfo.startTime?.substring(0, 5)}-${classInfo.endTime?.substring(0, 5)}` : ''}
                          </p>
                          {student && (student.schoolName || student.gradeLevel) && (
                            <p className="text-xs text-gray-400 truncate">
                              {[student.schoolName, student.gradeLevel].filter(Boolean).join(' / ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{formatCurrency(enrollment.pricing.finalPrice)}</p>
                          <p className="text-xs text-gray-400">{formatDate(enrollment.enrolledAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={`text-[11px] ${paymentStatusColors[enrollment.payment.status]}`}>
                          {paymentStatusLabels[enrollment.payment.status]}
                        </Badge>
                        <Badge className={`text-[11px] ${isUpcoming ? 'bg-yellow-100 text-yellow-700' : statusColors[enrollment.status]}`}>
                          {isUpcoming ? 'รอเริ่มเรียน' : statusLabels[enrollment.status]}
                        </Badge>
                        {isAllBranches && (
                          <span className="text-xs text-gray-400">{getBranchName(enrollment.branchId)}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[20%]">นักเรียน</TableHead>
                      <TableHead className="w-[30%]">คลาส</TableHead>
                      {isAllBranches && <TableHead className="w-[7%]">สาขา</TableHead>}
                      <TableHead className="w-[11%]">ลงทะเบียน</TableHead>
                      <TableHead className="w-[9%] text-right">ค่าเรียน</TableHead>
                      <TableHead className="w-[7%] text-center">ชำระเงิน</TableHead>
                      <TableHead className="w-[7%] text-center">สถานะ</TableHead>
                      <TableHead className="w-[36px] text-right">
                        <span className="sr-only">จัดการ</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedEnrollments.map((enrollment) => {
                      const student = getStudentInfo(enrollment.studentId);
                      const classInfo = getClassInfo(enrollment.classId);
                      const subject = classInfo ? subjectsMap.get(classInfo.subjectId) : undefined;

                      return (
                        <TableRow key={enrollment.id} className="cursor-pointer" onClick={() => router.push(`/enrollments/${enrollment.id}`)}>
                          <TableCell className="py-2">
                            {loadingStudents ? (
                              <InlineLoading />
                            ) : student ? (
                              <div className="min-w-0">
                                <p className="font-medium text-base truncate">{student.nickname || student.name}</p>
                                <p className="text-sm text-gray-500 truncate">ผปค. {student.parentName}</p>
                                {(student.schoolName || student.gradeLevel) && (
                                  <p className="text-xs text-gray-400 line-clamp-2">
                                    {[student.schoolName, student.gradeLevel].filter(Boolean).join(' / ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium text-gray-400">Unknown</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            {loadingClasses ? (
                              <InlineLoading />
                            ) : classInfo ? (
                              <div className="min-w-0">
                                <p className="text-sm text-gray-700 truncate" title={classInfo.name}>{classInfo.name}</p>
                                <p className="text-sm text-gray-500">
                                  {subject?.name || ''}{' '}
                                  <span className="text-gray-400">
                                    {classInfo.daysOfWeek.map(d => dayLabels[d]).join(',')}{' '}
                                    {classInfo.startTime?.substring(0, 5)}-{classInfo.endTime?.substring(0, 5)}
                                  </span>
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatDateCompact(classInfo.startDate)} - {formatDateCompact(classInfo.endDate)}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-gray-400">Unknown</p>
                              </div>
                            )}
                          </TableCell>
                          {isAllBranches && (
                            <TableCell className="py-2">
                              {loadingBranches ? (
                                <InlineLoading />
                              ) : (
                                <span className="text-sm">{getBranchName(enrollment.branchId)}</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="py-2">
                            <div>
                              <p className="text-sm whitespace-nowrap">{formatDate(enrollment.enrolledAt)}</p>
                              {classInfo && (
                                <p className="text-xs text-gray-400 whitespace-nowrap">
                                  เริ่ม: {formatDateCompact(classInfo.startDate)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div>
                              <p className="font-medium text-sm whitespace-nowrap">{formatCurrency(enrollment.pricing.finalPrice)}</p>
                              {enrollment.pricing.discount > 0 && (
                                <p className="text-xs text-green-600 whitespace-nowrap">
                                  -{formatCurrency(enrollment.pricing.discount)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Badge className={`text-[11px] whitespace-nowrap ${paymentStatusColors[enrollment.payment.status]}`}>
                              {paymentStatusLabels[enrollment.payment.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            {(() => {
                              const isUpcoming = enrollment.status === 'active' && classInfo?.startDate && new Date(classInfo.startDate) > new Date();
                              return (
                                <Badge className={`text-[11px] whitespace-nowrap ${isUpcoming ? 'bg-yellow-100 text-yellow-700' : statusColors[enrollment.status]}`}>
                                  {isUpcoming ? 'รอเริ่มเรียน' : statusLabels[enrollment.status]}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {enrollment.payment.status === 'paid' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePrintReceipt(); }}>
                                    <Printer className="h-4 w-4 mr-2" />
                                    พิมพ์ใบเสร็จ
                                  </DropdownMenuItem>
                                )}

                                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                  {enrollment.status !== 'dropped' && enrollment.payment.status !== 'paid' && (
                                    <Link href={`/enrollments/${enrollment.id}`} onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem className="text-green-600">
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        ชำระเพิ่ม
                                      </DropdownMenuItem>
                                    </Link>
                                  )}

                                  {enrollment.status !== 'dropped' && (
                                    <Link href={`/enrollments/${enrollment.id}/edit`} onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem>
                                        <Edit className="h-4 w-4 mr-2" />
                                        แก้ไข
                                      </DropdownMenuItem>
                                    </Link>
                                  )}

                                  {enrollment.status === 'active' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedEnrollment(enrollment);
                                          setCancelReason('');
                                          setShowCancelDialog(true);
                                        }}
                                        className="text-orange-600"
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        ยกเลิกการลงทะเบียน
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  <DropdownMenuSeparator />

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        ลบ
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          คุณแน่ใจหรือไม่ที่จะลบการลงทะเบียนของ {student?.nickname}?
                                          การกระทำนี้ไม่สามารถย้อนกลับได้
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteEnrollment(enrollment.id)}
                                          className="bg-red-500 hover:bg-red-600"
                                          disabled={deletingId === enrollment.id}
                                        >
                                          {deletingId === enrollment.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              กำลังลบ...
                                            </>
                                          ) : (
                                            'ลบ'
                                          )}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </PermissionGuard>
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
              {displayedEnrollments.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={isSearchMode ? enrollmentsToDisplay.length : paginatedData?.total || 0}
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


      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยกเลิกการลงทะเบียน</DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ที่จะยกเลิกการลงทะเบียนของ {selectedEnrollment && getStudentInfo(selectedEnrollment.studentId)?.nickname}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>เหตุผลในการยกเลิก *</Label>
              <Textarea
                placeholder="กรุณาระบุเหตุผล..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCancelDialog(false);
                setCancelReason('');
              }}
            >
              ไม่ยกเลิก
            </Button>
            <Button 
              onClick={handleCancelEnrollment}
              disabled={cancelling || !cancelReason.trim()}
              className="bg-red-500 hover:bg-red-600"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังยกเลิก...
                </>
              ) : (
                'ยืนยันการยกเลิก'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
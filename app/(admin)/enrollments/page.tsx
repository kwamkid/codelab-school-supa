'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Enrollment } from '@/types/models';
import {
  getEnrollmentsPaginated,
  getEnrollmentStats,
  getEnrollments,
  deleteEnrollment,
  updateEnrollment,
  cancelEnrollment,
  PaginatedEnrollments,
  EnrollmentStats
} from '@/lib/services/enrollments';
import { getClasses } from '@/lib/services/classes';
import { getActiveBranches } from '@/lib/services/branches';
import { getAllStudentsWithParents } from '@/lib/services/parents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Users,
  Eye,
  Edit,
  XCircle,
  Trash2,
  MoreVertical,
  CreditCard,
  CheckCircle,
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
import { Skeleton } from '@/components/ui/skeleton';
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

// ============================================
// 🎨 Mini Skeleton Components
// ============================================
const TableCellSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-3 w-32" />
  </div>
);

const InlineTextSkeleton = ({ width = "w-20" }: { width?: string }) => (
  <Skeleton className={`h-4 ${width}`} />
);

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
  
  // Other states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [paymentUpdating, setPaymentUpdating] = useState(false);
  const [quickPayment, setQuickPayment] = useState({
    status: 'pending' as 'pending' | 'partial' | 'paid',
    paidAmount: 0,
    receiptNumber: ''
  });
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
    enabled: isSearchMode,
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
    if (isSearchMode) {
      return allEnrollments.filter(enrollment => {
        if (selectedStatus !== 'all' && enrollment.status !== selectedStatus) return false;
        if (selectedPaymentStatus !== 'all' && enrollment.payment.status !== selectedPaymentStatus) return false;
        if (!isInDateRange(enrollment.enrolledAt)) return false;

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
      });
    } else {
      const enrollments = paginatedData?.enrollments || [];
      // Apply date filter client-side for paginated data
      if (dateRange) {
        return enrollments.filter(e => isInDateRange(e.enrolledAt));
      }
      return enrollments;
    }
  }, [
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

  const paginatedSearchResults = useMemo(() => {
    if (!isSearchMode) return enrollmentsToDisplay;
    return getPaginatedData(enrollmentsToDisplay);
  }, [isSearchMode, enrollmentsToDisplay, getPaginatedData]);

  const displayedEnrollments = isSearchMode ? paginatedSearchResults : enrollmentsToDisplay;

  const totalPages = useMemo(() => {
    if (isSearchMode) {
      return calculateTotalPages(enrollmentsToDisplay.length);
    } else {
      // Use paginatedData.total which is already filtered
      if (paginatedData?.total !== undefined) {
        return Math.ceil(paginatedData.total / pageSize);
      }
      return paginatedData?.hasMore ? currentPage + 1 : currentPage;
    }
  }, [isSearchMode, enrollmentsToDisplay.length, calculateTotalPages, paginatedData?.total, pageSize, paginatedData?.hasMore, currentPage]);

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

  const handleQuickPaymentUpdate = async () => {
    if (!selectedEnrollment) return;
    
    setPaymentUpdating(true);
    try {
      const updateData: Partial<Enrollment> = {
        payment: {
          ...selectedEnrollment.payment,
          status: quickPayment.status,
          paidAmount: quickPayment.paidAmount,
          method: selectedEnrollment.payment.method
        }
      };

      if (quickPayment.receiptNumber) {
        updateData.payment!.receiptNumber = quickPayment.receiptNumber;
      }

      if (quickPayment.status === 'paid' && selectedEnrollment.payment.status !== 'paid') {
        updateData.payment!.paidDate = new Date();
      }

      await updateEnrollment(selectedEnrollment.id, updateData);
      toast.success('อัพเดทการชำระเงินเรียบร้อยแล้ว');
      setShowPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ['enrollments-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-all'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-stats'] });
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('ไม่สามารถอัพเดทการชำระเงินได้');
    } finally {
      setPaymentUpdating(false);
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
  
  // Phase 1: Stats Loading (Show skeleton cards)
  if (loadingStats) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-32 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">กำลังเรียน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.active || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ชำระแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.paidCount || 0}</div>
            <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats?.totalRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">รอชำระ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingCount || 0}</div>
            <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats?.pendingAmount || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ชำระบางส่วน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.partialCount || 0}</div>
            <p className="text-xs text-gray-500 mt-1">ค้าง {formatCurrency(stats?.partialRemainingAmount || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status Tabs */}
      <Tabs value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus} className="mb-4">
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
          >
            ทั้งหมด ({stats?.total || 0})
          </TabsTrigger>
          <TabsTrigger
            value="paid"
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
          >
            ชำระแล้ว ({stats?.paidCount || 0})
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
          >
            รอชำระ ({stats?.pendingCount || 0})
          </TabsTrigger>
          <TabsTrigger
            value="partial"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
          >
            ชำระบางส่วน ({stats?.partialCount || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>รายการลงทะเบียน</span>
            {fetchingEnrollments && !isLoadingTable && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
            {(loadingStudents || loadingClasses || loadingBranches) && (
              <span className="text-xs text-gray-400 font-normal ml-2">
                (กำลังโหลดข้อมูลเพิ่มเติม...)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingTable ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>นักเรียน</TableHead>
                      <TableHead>คลาส</TableHead>
                      {isAllBranches && <TableHead>สาขา</TableHead>}
                      <TableHead>วันที่ลงทะเบียน</TableHead>
                      <TableHead className="text-right">ค่าเรียน</TableHead>
                      <TableHead className="text-center">การชำระเงิน</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedEnrollments.map((enrollment) => {
                      const student = getStudentInfo(enrollment.studentId);
                      const classInfo = getClassInfo(enrollment.classId);
                      
                      return (
                        <TableRow key={enrollment.id}>
                          <TableCell>
                            {loadingStudents ? (
                              <TableCellSkeleton />
                            ) : student ? (
                              <div>
                                <p className="font-medium">{student.nickname || student.name}</p>
                                <p className="text-sm text-gray-500">ผู้ปกครอง: {student.parentName}</p>
                                {(student.schoolName || student.gradeLevel) && (
                                  <p className="text-xs text-gray-400">
                                    {[student.schoolName, student.gradeLevel].filter(Boolean).join(' / ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium text-gray-400">Unknown</p>
                                <p className="text-sm text-gray-400">ID: {enrollment.studentId}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {loadingClasses ? (
                              <TableCellSkeleton />
                            ) : classInfo ? (
                              <div>
                                <p className="font-medium">{classInfo.name}</p>
                                <p className="text-sm text-gray-500">
                                  {formatDateCompact(classInfo.startDate)} - {formatDateCompact(classInfo.endDate)}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium text-gray-400">Unknown</p>
                                <p className="text-sm text-gray-400">ID: {enrollment.classId}</p>
                              </div>
                            )}
                          </TableCell>
                          {isAllBranches && (
                            <TableCell>
                              {loadingBranches ? (
                                <InlineTextSkeleton width="w-24" />
                              ) : (
                                getBranchName(enrollment.branchId)
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <p>{formatDate(enrollment.enrolledAt)}</p>
                              {classInfo && (
                                <p className="text-xs text-gray-400">
                                  เริ่มเรียน: {formatDateCompact(classInfo.startDate)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="font-medium">{formatCurrency(enrollment.pricing.finalPrice)}</p>
                              {enrollment.pricing.discount > 0 && (
                                <p className="text-sm text-green-600">
                                  -ส่วนลด {formatCurrency(enrollment.pricing.discount)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={paymentStatusColors[enrollment.payment.status]}>
                              {paymentStatusLabels[enrollment.payment.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              <Badge className={statusColors[enrollment.status]}>
                                {statusLabels[enrollment.status]}
                              </Badge>
                              {enrollment.status === 'dropped' && enrollment.droppedReason && (
                                <p className="text-xs text-red-500 mt-1">
                                  {enrollment.droppedReason}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                <Link href={`/enrollments/${enrollment.id}`}>
                                  <DropdownMenuItem>
                                    <Eye className="h-4 w-4 mr-2" />
                                    ดูรายละเอียด
                                  </DropdownMenuItem>
                                </Link>
                                
                                {enrollment.payment.status === 'paid' && (
                                  <DropdownMenuItem onClick={handlePrintReceipt}>
                                    <Printer className="h-4 w-4 mr-2" />
                                    พิมพ์ใบเสร็จ
                                  </DropdownMenuItem>
                                )}
                                
                                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                  {enrollment.payment.status !== 'paid' && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedEnrollment(enrollment);
                                        setQuickPayment({
                                          status: enrollment.payment.status,
                                          paidAmount: enrollment.payment.paidAmount,
                                          receiptNumber: enrollment.payment.receiptNumber || ''
                                        });
                                        setShowPaymentDialog(true);
                                      }}
                                      className="text-green-600"
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />
                                      อัพเดทการชำระ
                                    </DropdownMenuItem>
                                  )}
                                  
                                  <Link href={`/enrollments/${enrollment.id}/edit`}>
                                    <DropdownMenuItem>
                                      <Edit className="h-4 w-4 mr-2" />
                                      แก้ไข
                                    </DropdownMenuItem>
                                  </Link>
                                  
                                  {enrollment.status === 'active' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => {
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

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อัพเดทการชำระเงิน</DialogTitle>
            <DialogDescription>
              อัพเดทสถานะการชำระเงินสำหรับ {selectedEnrollment && getStudentInfo(selectedEnrollment.studentId)?.nickname}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>สถานะการชำระ</Label>
              <Select 
                value={quickPayment.status}
                onValueChange={(value: 'pending' | 'partial' | 'paid') => 
                  setQuickPayment(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอชำระ</SelectItem>
                  <SelectItem value="partial">ชำระบางส่วน</SelectItem>
                  <SelectItem value="paid">ชำระแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>ยอดที่ชำระแล้ว</Label>
              <Input
                type="number"
                value={quickPayment.paidAmount || ''}
                onChange={(e) => setQuickPayment(prev => ({ 
                  ...prev, 
                  paidAmount: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                ยอดที่ต้องชำระทั้งหมด: {formatCurrency(selectedEnrollment?.pricing.finalPrice || 0)}
              </p>
            </div>
            
            <div>
              <Label>เลขที่ใบเสร็จ (ถ้ามี)</Label>
              <Input
                value={quickPayment.receiptNumber}
                onChange={(e) => setQuickPayment(prev => ({ 
                  ...prev, 
                  receiptNumber: e.target.value 
                }))}
                placeholder="RC2025-001"
              />
            </div>
            
            {quickPayment.paidAmount > 0 && selectedEnrollment && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>ยอดที่ต้องชำระ:</span>
                    <span>{formatCurrency(selectedEnrollment.pricing.finalPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ชำระแล้ว:</span>
                    <span className="text-green-600">{formatCurrency(quickPayment.paidAmount)}</span>
                  </div>
                  {quickPayment.paidAmount < selectedEnrollment.pricing.finalPrice && (
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>คงเหลือ:</span>
                      <span className="text-red-600">
                        {formatCurrency(selectedEnrollment.pricing.finalPrice - quickPayment.paidAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleQuickPaymentUpdate}
              disabled={paymentUpdating || quickPayment.paidAmount < 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {paymentUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  บันทึก
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
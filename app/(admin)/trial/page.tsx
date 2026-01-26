// app/(admin)/trial/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { 
  TestTube, 
  Plus, 
  Phone,
  Mail,
  Calendar,
  Search,
  AlertCircle,
  Check,
  X,
  UserPlus,
  PhoneCall,
  CalendarCheck,
  Trash2,
  Eye,
  Building2,
  Clock,
  XCircle,
  Baby
} from 'lucide-react';
import { CancelBookingDialog } from '@/components/trial/cancel-booking-dialog';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrialBooking, Branch } from '@/types/models';
import { 
  getTrialBookings, 
  getTrialBookingStats, 
  deleteTrialBooking, 
  cancelTrialBooking 
} from '@/lib/services/trial-bookings';
import { getActiveBranches } from '@/lib/services/branches';
import { getSubjects } from '@/lib/services/subjects';
import { formatDate, calculateAge } from '@/lib/utils';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig = {
  new: { label: 'ใหม่', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  contacted: { label: 'ติดต่อแล้ว', color: 'bg-yellow-100 text-yellow-700', icon: PhoneCall },
  scheduled: { label: 'นัดหมายแล้ว', color: 'bg-purple-100 text-purple-700', icon: CalendarCheck },
  completed: { label: 'เรียนแล้ว', color: 'bg-green-100 text-green-700', icon: Check },
  converted: { label: 'ลงทะเบียนแล้ว', color: 'bg-emerald-100 text-emerald-700', icon: UserPlus },
  cancelled: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-700', icon: X }
};

const sourceConfig = {
  online: { label: 'Online', color: 'bg-blue-100 text-blue-700' },
  walkin: { label: 'Walk-in', color: 'bg-green-100 text-green-700' },
  phone: { label: 'โทรศัพท์', color: 'bg-purple-100 text-purple-700' }
};

// Cache key constants
const QUERY_KEYS = {
  trialBookings: (branchId?: string | null) => ['trialBookings', branchId],
  trialStats: (branchId?: string | null) => ['trialStats', branchId],
  branches: ['branches', 'active'],
  subjects: ['subjects', 'active'],
};

export default function TrialBookingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedBranchId, isAllBranches } = useBranch();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<TrialBooking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<TrialBooking | null>(null);
  
  // ใช้ usePagination hook
  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginatedData,
    totalPages,
  } = usePagination(20);

  // Optimized queries with React Query
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: QUERY_KEYS.trialBookings(selectedBranchId),
    queryFn: () => getTrialBookings(selectedBranchId),
    staleTime: 60000, // 1 minute
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: QUERY_KEYS.trialStats(selectedBranchId),
    queryFn: () => getTrialBookingStats(selectedBranchId),
    staleTime: 60000, // 1 minute
  });

  const { data: branches = [] } = useQuery({
    queryKey: QUERY_KEYS.branches,
    queryFn: getActiveBranches,
    staleTime: 300000, // 5 minutes
  });

  const { data: subjects = [] } = useQuery({
    queryKey: QUERY_KEYS.subjects,
    queryFn: async () => {
      const allSubjects = await getSubjects();
      return allSubjects.filter(s => s.isActive);
    },
    staleTime: 300000, // 5 minutes
  });

  // Create lookup map for branches
  const branchesMap = useMemo(() => 
    new Map(branches.map(b => [b.id, b])), 
    [branches]
  );

  // Create lookup map for subjects
  const subjectsMap = useMemo(() => 
    new Map(subjects.map(s => [s.id, s])), 
    [subjects]
  );

  // Filter bookings with memoization
  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(b => b.status === selectedStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.parentName.toLowerCase().includes(term) ||
        b.parentPhone.includes(term) ||
        b.students.some(s => s.name.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [bookings, searchTerm, selectedStatus]);

  // Get paginated data
  const paginatedBookings = getPaginatedData(filteredBookings);
  const calculatedTotalPages = totalPages(filteredBookings.length);

  // Reset pagination when filters change
  useMemo(() => {
    resetPagination();
  }, [searchTerm, selectedStatus, selectedBranchId, resetPagination]);

  // Status counts with memoization
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: bookings.length,
      new: 0,
      contacted: 0,
      scheduled: 0,
      completed: 0,
      converted: 0,
      cancelled: 0
    };

    bookings.forEach(booking => {
      if (booking.status in counts) {
        counts[booking.status]++;
      }
    });

    return counts;
  }, [bookings]);

  const getStatusBadge = (status: TrialBooking['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getSourceBadge = (source: TrialBooking['source']) => {
    const config = sourceConfig[source];
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getBranchBadge = (branchId?: string) => {
    if (!branchId) {
      return <Badge variant="outline" className="text-gray-500">ไม่ระบุสาขา</Badge>;
    }
    
    const branch = branchesMap.get(branchId);
    return (
      <Badge variant="outline" className="bg-gray-50">
        <Building2 className="h-3 w-3 mr-1" />
        {branch?.name || branchId}
      </Badge>
    );
  };

  const handleDeleteClick = (booking: TrialBooking) => {
    setBookingToDelete(booking);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookingToDelete) return;

    setDeleting(true);
    try {
      await deleteTrialBooking(bookingToDelete.id);
      toast.success('ลบข้อมูลการจองเรียบร้อย');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialBookings(selectedBranchId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialStats(selectedBranchId) });

      // Dispatch event to update sidebar badge
      window.dispatchEvent(new CustomEvent('trial-booking-changed'));
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('ไม่สามารถลบข้อมูลได้');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setBookingToDelete(null);
    }
  };

  const handleCancelClick = (booking: TrialBooking) => {
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!bookingToCancel) return;

    try {
      await cancelTrialBooking(bookingToCancel.id, reason);
      toast.success('ยกเลิกการจองเรียบร้อย');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialBookings(selectedBranchId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialStats(selectedBranchId) });

      // Dispatch event to update sidebar badge
      window.dispatchEvent(new CustomEvent('trial-booking-changed'));
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('ไม่สามารถยกเลิกการจองได้');
    } finally {
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    }
  };

  // Loading state
  const isLoading = loadingBookings || loadingStats;

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters Skeleton */}
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Tabs Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-2xl" />
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TestTube className="h-8 w-8 text-red-500" />
            จองทดลองเรียน
            {!isAllBranches && (
              <span className="text-lg font-normal text-gray-500">(เฉพาะสาขาที่เลือก)</span>
            )}
          </h1>
          <p className="text-gray-600 mt-2">จัดการการจองทดลองเรียนทั้งหมด</p>
        </div>
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <Button 
            onClick={() => router.push('/trial/new')}
            className="bg-red-500 hover:bg-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มการจอง (Walk-in)
          </Button>
        </PermissionGuard>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-gray-600">ทั้งหมด</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {stats.byStatus.new || 0}
              </div>
              <p className="text-sm text-gray-600">รอติดต่อ</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {stats.byStatus.scheduled || 0}
              </div>
              <p className="text-sm text-gray-600">นัดหมายแล้ว</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.byStatus.converted || 0}
              </div>
              <p className="text-sm text-gray-600">ลงทะเบียนแล้ว</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-600">
                {stats.conversionRate.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600">อัตราการแปลง</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="ค้นหาชื่อผู้ปกครอง, นักเรียน หรือเบอร์โทร..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">ทั้งหมด ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="new">
            ใหม่ ({statusCounts.new})
          </TabsTrigger>
          <TabsTrigger value="contacted">
            ติดต่อแล้ว ({statusCounts.contacted})
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            นัดหมายแล้ว ({statusCounts.scheduled})
          </TabsTrigger>
          <TabsTrigger value="completed">
            เรียนแล้ว ({statusCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="converted">
            ลงทะเบียน ({statusCounts.converted})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="mt-6">
          <Card>
            <CardContent className="p-0">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <TestTube className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีการจองทดลองเรียน'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">วันที่/เวลา</TableHead>
                          <TableHead className="w-[80px]">ช่องทาง</TableHead>
                          {isAllBranches && <TableHead className="w-[120px]">สาขา</TableHead>}
                          <TableHead className="w-[180px]">ผู้ปกครอง</TableHead>
                          <TableHead className="w-[200px]">นักเรียน</TableHead>
                          <TableHead className="w-[180px]">วิชาที่สนใจ</TableHead>
                          <TableHead className="w-[100px]">สถานะ</TableHead>
                          <TableHead className="w-[100px] text-center">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 font-medium text-sm">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {formatDate(booking.createdAt)}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(booking.createdAt, 'time')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getSourceBadge(booking.source)}
                            </TableCell>
                            {isAllBranches && (
                              <TableCell>
                                {getBranchBadge(booking.branchId)}
                              </TableCell>
                            )}
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm">{booking.parentName}</div>
                                <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                                  <Phone className="h-3 w-3" />
                                  {booking.parentPhone}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                {booking.students.map((student, idx) => (
                                  <div key={idx} className="text-sm">
                                    <div className="font-medium">{student.name}</div>
                                    <div className="space-y-0.5">
                                      {student.birthdate && (
                                        <div className="text-xs text-gray-600 flex items-center gap-1">
                                          <Baby className="h-3 w-3" />
                                          {formatDate(student.birthdate)} ({calculateAge(student.birthdate)} ปี)
                                        </div>
                                      )}
                                      {student.schoolName && (
                                        <div className="text-xs text-gray-600">
                                          {student.schoolName}
                                          {student.gradeLevel && ` (${student.gradeLevel})`}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                {booking.students.map((student, idx) => (
                                  <div key={idx} className="flex flex-wrap gap-1">
                                    {student.subjectInterests.map(subjectId => {
                                      const subject = subjectsMap.get(subjectId);
                                      return subject ? (
                                        <Badge 
                                          key={subjectId} 
                                          className="text-xs h-5 px-1.5"
                                          style={{ 
                                            backgroundColor: `${subject.color}20`,
                                            color: subject.color,
                                            borderColor: subject.color
                                          }}
                                        >
                                          {subject.name}
                                        </Badge>
                                      ) : null;
                                    })}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(booking.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Link href={`/trial/${booking.id}`}>
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                
                                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                  {/* แสดงปุ่มยกเลิกสำหรับสถานะ new, contacted, scheduled */}
                                  {(booking.status === 'new' || booking.status === 'contacted' || booking.status === 'scheduled') && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCancelClick(booking)}
                                      className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                  
                                  {/* แสดงปุ่มลบสำหรับสถานะ new และ cancelled เท่านั้น */}
                                  {(booking.status === 'new' || booking.status === 'cancelled') && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteClick(booking)}
                                      className="text-gray-600 hover:text-gray-700 h-8 w-8 p-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </PermissionGuard>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Component */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={calculatedTotalPages}
                    pageSize={pageSize}
                    totalItems={filteredBookings.length}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบข้อมูล</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบข้อมูลการจองของ {bookingToDelete?.parentName} ใช่หรือไม่?
              <br />
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'กำลังลบ...' : 'ลบข้อมูล'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Booking Dialog */}
      <CancelBookingDialog
        isOpen={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setBookingToCancel(null);
        }}
        onConfirm={handleCancelConfirm}
        bookingName={bookingToCancel?.parentName}
      />
    </div>
  );
}
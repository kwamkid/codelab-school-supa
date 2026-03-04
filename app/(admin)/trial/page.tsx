// app/(admin)/trial/page.tsx

'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Calendar,
  AlertCircle,
  Check,
  X,
  UserPlus,
  PhoneCall,
  CalendarCheck,
  Building2,
  Clock,
  Baby
} from 'lucide-react';
import { CancelBookingDialog } from '@/components/trial/cancel-booking-dialog';
import { ContactNoteDialog } from '@/components/trial/contact-note-dialog';
import { TrialFunnelPipeline } from '@/components/trial/trial-funnel-pipeline';
import { BookingActionButtons } from '@/components/trial/booking-action-buttons';
import { useRouter } from 'next/navigation';
import { TrialBooking } from '@/types/models';
import { 
  getTrialBookings, 
  getTrialBookingStats, 
  deleteTrialBooking, 
  cancelTrialBooking 
} from '@/lib/services/trial-bookings';
import { getActiveBranches } from '@/lib/services/branches';
import { getSubjects } from '@/lib/services/subjects';
import { formatDate, calculateAge, getShortDayName } from '@/lib/utils';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';

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
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [bookingToContact, setBookingToContact] = useState<TrialBooking | null>(null);
  
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

  const handleContactClick = (booking: TrialBooking) => {
    setBookingToContact(booking);
    setContactDialogOpen(true);
  };

  const handleContactSuccess = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialBookings(selectedBranchId) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialStats(selectedBranchId) });
    window.dispatchEvent(new CustomEvent('trial-booking-changed'));
  };

  const handleCancelClick = (booking: TrialBooking) => {
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!bookingToCancel) return;

    try {
      await cancelTrialBooking(bookingToCancel.id, reason);
      toast.success('ยกเลิกทดลองเรียนเรียบร้อย');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialBookings(selectedBranchId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trialStats(selectedBranchId) });

      // Dispatch event to update sidebar badge
      window.dispatchEvent(new CustomEvent('trial-booking-changed'));
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('ไม่สามารถยกเลิกทดลองเรียนได้');
    } finally {
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    }
  };

  // Loading state
  const isLoading = loadingBookings || loadingStats;

  if (isLoading) {
    return <PageSkeleton statsCount={5} rowCount={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            {/* <TestTube className="h-8 w-8 text-red-500" /> */}
            ทดลองเรียน
            {/* {!isAllBranches && (
              <span className="text-lg font-normal text-gray-500">(เฉพาะสาขาที่เลือก)</span>
            )} */}
          </h1>
          <p className="text-gray-600 mt-2">จัดการการจองทดลองเรียนทั้งหมด</p>
        </div>
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <Button 
            onClick={() => router.push('/trial/new')}
            className="bg-red-500 hover:bg-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            จองทดลองเรียน
          </Button>
        </PermissionGuard>
      </div>

      {/* Funnel Pipeline */}
      <Card>
        <CardContent className="p-4">
          <TrialFunnelPipeline
            statusCounts={statusCounts}
            selectedStatus={selectedStatus}
            onStatusClick={setSelectedStatus}
          />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <SearchInput
            placeholder="ค้นหาชื่อผู้ปกครอง, นักเรียน หรือเบอร์โทร..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredBookings.length === 0 ? (
            <EmptyState
              icon={TestTube}
              title={searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีการจองทดลองเรียน'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">วันที่</TableHead>
                      <TableHead className="w-[68px]">ช่องทาง</TableHead>
                      {isAllBranches && <TableHead className="w-[90px] pl-3">สาขา</TableHead>}
                      <TableHead className="w-[14%] pl-3">ผู้ปกครอง</TableHead>
                      <TableHead className="w-[16%]">นักเรียน</TableHead>
                      <TableHead className="w-[13%]">วิชา</TableHead>
                      <TableHead className="w-[95px]">สถานะ</TableHead>
                      <TableHead className="w-[150px] text-right pr-4">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBookings.map((booking) => (
                      <TableRow key={booking.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/trial/${booking.id}`)}>
                        <TableCell className="text-sm text-gray-600">
                          <div className="whitespace-nowrap">
                            <div>{(() => {
                              const d = booking.createdAt instanceof Date ? booking.createdAt
                                : typeof booking.createdAt === 'string' ? new Date(booking.createdAt)
                                : booking.createdAt?.toDate ? booking.createdAt.toDate()
                                : booking.createdAt?.seconds ? new Date(booking.createdAt.seconds * 1000)
                                : null;
                              return d ? `${getShortDayName(d.getDay())} ${formatDate(booking.createdAt)}` : formatDate(booking.createdAt);
                            })()}</div>
                            <div className="text-xs text-gray-400">{formatDate(booking.createdAt, 'time')}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getSourceBadge(booking.source)}
                        </TableCell>
                        {isAllBranches && (
                          <TableCell className="pl-3">
                            {getBranchBadge(booking.branchId)}
                          </TableCell>
                        )}
                        <TableCell className="pl-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{booking.parentName}</div>
                            <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{booking.parentPhone}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-0">
                            {booking.students.map((student, idx) => (
                              <div key={idx} className="min-w-0">
                                <div className="font-medium truncate">{student.name}</div>
                                <div className="space-y-0.5">
                                  {student.birthdate && (
                                    <div className="text-xs text-gray-600 flex items-center gap-1">
                                      <Baby className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{calculateAge(student.birthdate)} ปี</span>
                                    </div>
                                  )}
                                  {student.schoolName && (
                                    <div className="text-xs text-gray-600 truncate" title={`${student.schoolName}${student.gradeLevel ? ` (${student.gradeLevel})` : ''}`}>
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
                          <div className="space-y-1 min-w-0">
                            {booking.students.map((student, idx) => (
                              <div key={idx} className="flex flex-wrap gap-1">
                                {student.subjectInterests.map(subjectId => {
                                  const subject = subjectsMap.get(subjectId);
                                  return subject ? (
                                    <Badge
                                      key={subjectId}
                                      className="text-[11px] h-5 px-1.5 truncate max-w-full"
                                      style={{
                                        backgroundColor: `${subject.color}20`,
                                        color: subject.color,
                                        borderColor: subject.color
                                      }}
                                      title={subject.name}
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
                        <TableCell className="text-right pr-4">
                          <BookingActionButtons
                            booking={booking}
                            onContact={handleContactClick}
                            onCancel={handleCancelClick}
                            onDelete={handleDeleteClick}
                          />
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

      {/* Contact Note Dialog */}
      <ContactNoteDialog
        isOpen={contactDialogOpen}
        onClose={() => {
          setContactDialogOpen(false);
          setBookingToContact(null);
        }}
        booking={bookingToContact}
        onSuccess={handleContactSuccess}
      />

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
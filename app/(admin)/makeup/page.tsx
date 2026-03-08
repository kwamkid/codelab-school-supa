'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MakeupClass } from '@/types/models';
import { getMakeupClasses, deleteMakeupClass, recordMakeupAttendance } from '@/lib/services/makeup';
import { getActiveBranches } from '@/lib/services/branches';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Pagination, usePagination } from '@/components/ui/pagination';
import {
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  CalendarCheck,
  MoreVertical,
  Trash2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatDateShort } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMakeup } from '@/contexts/MakeupContext';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLoading } from '@/components/ui/loading';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import ScheduleMakeupDialog from '@/components/makeup/schedule-makeup-dialog';
import CreateMakeupDialog from '@/components/makeup/create-makeup-dialog';

const statusColors = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'scheduled': 'bg-blue-100 text-blue-700',
  'completed': 'bg-green-100 text-green-700',
  'cancelled': 'bg-red-100 text-red-700',
};

const statusLabels = {
  'pending': 'รอจัดตาราง',
  'scheduled': 'นัดแล้ว',
  'completed': 'เรียนแล้ว',
  'cancelled': 'ยกเลิก',
};

const statusIcons = {
  'pending': AlertCircle,
  'scheduled': CalendarCheck,
  'completed': CheckCircle,
  'cancelled': XCircle,
};

// Cache key constants
const QUERY_KEYS = {
  makeupClasses: (branchId?: string | null) => ['makeupClasses', branchId],
  branches: ['branches', 'active'],
};

export default function MakeupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshMakeupCount } = useMakeup();
  const { selectedBranchId, isAllBranches } = useBranch();
  const { user } = useSupabaseAuth();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  
  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Schedule dialog
  const [scheduleMakeup, setScheduleMakeup] = useState<MakeupClass | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  // Attendance dialog
  const [attendanceMakeup, setAttendanceMakeup] = useState<MakeupClass | null>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);

  // Delete dialog
  const [selectedMakeup, setSelectedMakeup] = useState<MakeupClass | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination
  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginatedData,
    totalPages,
  } = usePagination(20);

  // Query: Makeup Classes
  const { data: makeupClasses = [], isLoading: loadingMakeup } = useQuery({
    queryKey: QUERY_KEYS.makeupClasses(selectedBranchId),
    queryFn: () => getMakeupClasses(selectedBranchId),
    staleTime: 30000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: QUERY_KEYS.branches,
    queryFn: getActiveBranches,
    staleTime: 300000,
  });

  // Get unique classes from makeup data (for filter dropdown)
  const uniqueClasses = useMemo(() => {
    const classMap = new Map();
    makeupClasses.forEach(makeup => {
      if (!classMap.has(makeup.originalClassId)) {
        classMap.set(makeup.originalClassId, {
          id: makeup.originalClassId,
          name: makeup.className,
          code: makeup.classCode
        });
      }
    });
    return Array.from(classMap.values());
  }, [makeupClasses]);

  // Filter makeup classes
  const filteredMakeupClasses = useMemo(() => {
    return makeupClasses.filter(makeup => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          makeup.reason.toLowerCase().includes(searchLower) ||
          makeup.studentName.toLowerCase().includes(searchLower) ||
          makeup.studentNickname.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      if (filterStatus !== 'all' && makeup.status !== filterStatus) return false;
      if (filterClass !== 'all' && makeup.originalClassId !== filterClass) return false;
      
      if (filterType !== 'all') {
        const isAutoGenerated = makeup.requestedBy === 'system';
        if (filterType === 'auto' && !isAutoGenerated) return false;
        if (filterType === 'manual' && isAutoGenerated) return false;
      }
      
      return true;
    });
  }, [makeupClasses, searchTerm, filterStatus, filterClass, filterType]);

  // Get paginated data
  const paginatedMakeupClasses = getPaginatedData(filteredMakeupClasses);
  const calculatedTotalPages = totalPages(filteredMakeupClasses.length);

  // Reset pagination when filters change
  useMemo(() => {
    resetPagination();
  }, [searchTerm, filterStatus, filterClass, filterType, selectedBranchId, resetPagination]);

  // Calculate statistics
  const stats = useMemo(() => {
    const autoGeneratedMakeups = makeupClasses.filter(m => m.requestedBy === 'system');
    const pendingAutoGenerated = autoGeneratedMakeups.filter(m => m.status === 'pending');
    
    return {
      total: makeupClasses.length,
      pending: makeupClasses.filter(m => m.status === 'pending').length,
      scheduled: makeupClasses.filter(m => m.status === 'scheduled').length,
      completed: makeupClasses.filter(m => m.status === 'completed').length,
      cancelled: makeupClasses.filter(m => m.status === 'cancelled').length,
      autoGenerated: autoGeneratedMakeups.length,
      pendingAutoGenerated: pendingAutoGenerated.length,
    };
  }, [makeupClasses]);

  useEffect(() => {
    if (!loadingMakeup) {
      refreshMakeupCount();
    }
  }, [makeupClasses, loadingMakeup, refreshMakeupCount]);

  const handleViewDetail = (makeup: MakeupClass) => {
    router.push(`/makeup/${makeup.id}/edit`);
  };

  const handleSchedule = (makeup: MakeupClass) => {
    setScheduleMakeup(makeup);
    setShowScheduleDialog(true);
  };

  const handleMarkAttendance = (makeup: MakeupClass) => {
    setAttendanceMakeup(makeup);
    setShowAttendanceDialog(true);
  };

  const confirmMarkAttendance = async () => {
    if (!attendanceMakeup || !user?.uid) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }
    setMarkingAttendance(true);
    try {
      await recordMakeupAttendance(attendanceMakeup.id, {
        status: 'present',
        checkedBy: user.uid,
      });
      toast.success('บันทึกการเข้าเรียนเรียบร้อยแล้ว');
      setShowAttendanceDialog(false);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.makeupClasses(selectedBranchId) });
      window.dispatchEvent(new CustomEvent('makeup-changed'));
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setMarkingAttendance(false);
    }
  };

  const handleQuickDelete = (makeup: MakeupClass) => {
    setSelectedMakeup(makeup);
    setDeleteReason('');
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedMakeup || !deleteReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการลบ');
      return;
    }

    if (!user?.uid) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }

    setDeletingId(selectedMakeup.id);
    try {
      await deleteMakeupClass(selectedMakeup.id, user.uid, deleteReason);
      toast.success('ลบ Makeup Class เรียบร้อยแล้ว');
      setShowDeleteDialog(false);

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.makeupClasses(selectedBranchId) });

      // Dispatch event to update sidebar badge
      window.dispatchEvent(new CustomEvent('makeup-changed'));
    } catch (error: any) {
      console.error('Error deleting makeup:', error);
      if (error.message === 'Cannot delete completed makeup class') {
        toast.error('ไม่สามารถลบ Makeup ที่เรียนเสร็จแล้วได้');
      } else {
        toast.error('ไม่สามารถลบได้');
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Initial loading
  if (loadingMakeup) {
    return <SectionLoading />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            การลา และชดเชย
            {/* {!isAllBranches && <span className="text-red-600 text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>} */}
          </h1>
          <p className="text-gray-600 mt-1">การลา เรียนชดเชย Makeup Class</p>
        </div>
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-red-500 hover:bg-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            สร้าง Makeup
          </Button>
        </PermissionGuard>
      </div>

      {stats.pendingAutoGenerated > 0 && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <Sparkles className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <strong className="text-orange-800">มี {stats.pendingAutoGenerated} Makeup Class ที่สร้างอัตโนมัติ</strong>
            <span className="text-orange-700 ml-1">
              จากการสมัครเรียนหลังคลาสเริ่มแล้ว รอจัดตารางเรียนชดเชย
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { value: 'all', label: 'ทั้งหมด', count: stats.total, labelColor: 'text-white', countColor: 'text-white', activeBg: 'bg-indigo-500', inactiveBg: 'bg-indigo-50', inactiveLabel: 'text-indigo-600', inactiveCount: 'text-indigo-700' },
          { value: 'pending', label: 'รอจัดตาราง', count: stats.pending, labelColor: 'text-white', countColor: 'text-white', activeBg: 'bg-yellow-400', inactiveBg: 'bg-yellow-50', inactiveLabel: 'text-yellow-600', inactiveCount: 'text-yellow-700' },
          { value: 'scheduled', label: 'นัดแล้ว', count: stats.scheduled, labelColor: 'text-white', countColor: 'text-white', activeBg: 'bg-blue-500', inactiveBg: 'bg-blue-50', inactiveLabel: 'text-blue-600', inactiveCount: 'text-blue-700' },
          { value: 'completed', label: 'เรียนแล้ว', count: stats.completed, labelColor: 'text-white', countColor: 'text-white', activeBg: 'bg-green-500', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-600', inactiveCount: 'text-green-700' },
          { value: 'cancelled', label: 'ยกเลิก', count: stats.cancelled, labelColor: 'text-white', countColor: 'text-white', activeBg: 'bg-gray-500', inactiveBg: 'bg-gray-50', inactiveLabel: 'text-gray-500', inactiveCount: 'text-gray-600' },
        ].map((tab) => {
          const isActive = filterStatus === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={cn(
                'flex flex-col items-center justify-center w-24 h-[72px] rounded-xl transition-all',
                isActive
                  ? `${tab.activeBg} shadow-md`
                  : `${tab.inactiveBg} hover:shadow-sm`
              )}
            >
              <span className={cn(
                'text-sm font-medium',
                isActive ? tab.labelColor : tab.inactiveLabel
              )}>
                {tab.label}
              </span>
              <span className={cn(
                'text-2xl font-bold mt-0.5',
                isActive ? tab.countColor : tab.inactiveCount
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <SearchInput
          placeholder="ค้นหานักเรียน หรือ เหตุผล..."
          value={searchTerm}
          onChange={setSearchTerm}
          className="flex-1"
        />
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            <SelectItem value="manual">สร้างโดย Admin</SelectItem>
            <SelectItem value="auto">Auto-generated</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกคลาส</SelectItem>
            {uniqueClasses.map(cls => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredMakeupClasses.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Calendar}
                title="ไม่พบข้อมูล Makeup Class"
                description={
                  searchTerm || filterClass !== 'all' || filterType !== 'all'
                    ? 'ลองปรับเงื่อนไขการค้นหา'
                    : 'ยังไม่มีการขอ Makeup Class'
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {paginatedMakeupClasses.map((makeup) => {
              const StatusIcon = statusIcons[makeup.status];
              const isAutoGenerated = makeup.requestedBy === 'system';

              return (
                <Link key={makeup.id} href={`/makeup/${makeup.id}/edit`}>
                  <div className={cn(
                    'border rounded-xl p-4 space-y-2 transition-colors',
                    isAutoGenerated ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200',
                    'active:bg-gray-50'
                  )}>
                    {/* Top row: Student name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-gray-900 truncate">
                          {makeup.studentNickname
                            ? `${makeup.studentNickname} (${makeup.studentName.split(' ')[0]})`
                            : makeup.studentName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAutoGenerated && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            Auto
                          </Badge>
                        )}
                        <Badge className={`${statusColors[makeup.status]} text-xs`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusLabels[makeup.status]}
                        </Badge>
                      </div>
                    </div>

                    {/* Class info */}
                    <p className="text-base text-gray-700">
                      {makeup.className}
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{makeup.subjectName}</span>
                    </p>

                    {/* Session + Dates row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-gray-500">
                      {makeup.originalSessionNumber && (
                        <span className="text-red-600 font-medium">
                          ครั้งที่ {makeup.originalSessionNumber}
                          {makeup.originalSessionDate && (
                            <span className="font-normal text-gray-500 ml-1">
                              ({formatDateShort(makeup.originalSessionDate)})
                            </span>
                          )}
                        </span>
                      )}
                      {makeup.makeupSchedule && (
                        <span className="text-blue-600">
                          นัด: {formatDate(makeup.makeupSchedule.date)} {makeup.makeupSchedule.startTime?.substring(0, 5)}-{makeup.makeupSchedule.endTime?.substring(0, 5)}
                        </span>
                      )}
                    </div>

                    {/* Branch (when viewing all branches) */}
                    {isAllBranches && (
                      <p className="text-base text-gray-400">{makeup.branchName}</p>
                    )}
                  </div>
                </Link>
              );
            })}

            <Pagination
              currentPage={currentPage}
              totalPages={calculatedTotalPages}
              pageSize={pageSize}
              totalItems={filteredMakeupClasses.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </div>

      {/* Table (Desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {filteredMakeupClasses.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="ไม่พบข้อมูล Makeup Class"
              description={
                searchTerm || filterClass !== 'all' || filterType !== 'all'
                  ? 'ลองปรับเงื่อนไขการค้นหา'
                  : 'ยังไม่มีการขอ Makeup Class'
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[130px]">นักเรียน</TableHead>
                      <TableHead className="w-[110px]">ครั้งที่ขาด</TableHead>
                      <TableHead className="min-w-[130px]">คลาส</TableHead>
                      {isAllBranches && <TableHead className="w-[90px]">สาขา</TableHead>}
                      <TableHead className="max-w-[180px]">เหตุผล</TableHead>
                      <TableHead className="w-[110px]">วันที่นัด</TableHead>
                      <TableHead className="text-center w-[90px]">สถานะ</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMakeupClasses.map((makeup) => {
                      const StatusIcon = statusIcons[makeup.status];
                      const isAutoGenerated = makeup.requestedBy === 'system';

                      return (
                        <TableRow key={makeup.id} className={isAutoGenerated ? 'bg-orange-50' : ''}>
                          <TableCell className="align-top">
                            <div>
                              <p className="font-medium">
                                {makeup.studentNickname ? `${makeup.studentNickname} (${makeup.studentName.split(' ')[0]})` : makeup.studentName}
                                {isAutoGenerated && (
                                  <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-orange-300 text-orange-600">
                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                    Auto
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">{makeup.studentSchoolName || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">
                            {makeup.originalSessionNumber ? (
                              <div>
                                <p className="font-medium text-red-600">
                                  ครั้งที่ {makeup.originalSessionNumber}
                                </p>
                                {makeup.originalSessionDate && (
                                  <p className="text-xs text-gray-500">
                                    {formatDateShort(makeup.originalSessionDate)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <div>
                              <p className="font-medium text-sm">{makeup.className}</p>
                              <p className="text-xs text-gray-500">{makeup.subjectName}</p>
                            </div>
                          </TableCell>
                          {isAllBranches && (
                            <TableCell className="align-top text-sm">
                              {makeup.branchName}
                            </TableCell>
                          )}
                          <TableCell className="align-top">
                            <div className="max-w-[180px]">
                              <p className="text-sm line-clamp-2" title={makeup.reason}>
                                {makeup.reason}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top">
                            {makeup.makeupSchedule ? (
                              <div>
                                <p className="text-sm">{formatDate(makeup.makeupSchedule.date)}</p>
                                <p className="text-xs text-gray-500">
                                  {makeup.makeupSchedule.startTime?.substring(0, 5)} - {makeup.makeupSchedule.endTime?.substring(0, 5)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center align-top">
                            <Badge className={`${statusColors[makeup.status]} text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusLabels[makeup.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <span className="sr-only">เปิดเมนู</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem onClick={() => handleViewDetail(makeup)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  ดูรายละเอียด
                                </DropdownMenuItem>

                                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                  {makeup.status === 'pending' && (
                                    <DropdownMenuItem
                                      onClick={() => handleSchedule(makeup)}
                                      className="text-blue-600"
                                    >
                                      <CalendarCheck className="h-4 w-4 mr-2" />
                                      นัด Makeup
                                    </DropdownMenuItem>
                                  )}

                                  {makeup.status === 'scheduled' && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => handleSchedule(makeup)}
                                        className="text-blue-600"
                                      >
                                        <CalendarCheck className="h-4 w-4 mr-2" />
                                        เปลี่ยนวันนัด
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleMarkAttendance(makeup)}
                                        className="text-green-600"
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        บันทึกการเข้าเรียน
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {(makeup.status === 'pending' || makeup.status === 'scheduled') && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleQuickDelete(makeup)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        ลบ
                                      </DropdownMenuItem>
                                    </>
                                  )}
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

                  <Pagination
                    currentPage={currentPage}
                    totalPages={calculatedTotalPages}
                    pageSize={pageSize}
                    totalItems={filteredMakeupClasses.length}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </>
              )}
          </CardContent>
        </Card>

      {/* Dialogs */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ Makeup Class</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบ Makeup Class นี้? 
              การลบจะทำให้นักเรียนสามารถขอ Makeup ใหม่สำหรับวันนี้ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedMakeup && (
            <div className="my-4 space-y-3">
              <div className="bg-gray-50 rounded p-3 text-sm">
                <p><strong>นักเรียน:</strong> {selectedMakeup.studentName}</p>
                <p><strong>คลาส:</strong> {selectedMakeup.className}</p>
                <p><strong>สถานะ:</strong> {statusLabels[selectedMakeup.status]}</p>
                {selectedMakeup.requestedBy === 'system' && (
                  <p className="text-orange-600 mt-1">
                    <strong>หมายเหตุ:</strong> นี่คือ Makeup ที่สร้างอัตโนมัติ
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="delete-reason">เหตุผลในการลบ *</Label>
                <Textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="เช่น กรอกผิด, ผู้ปกครองขอยกเลิก..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>ไม่ลบ</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={!deleteReason.trim() || deletingId === selectedMakeup?.id}
              className="bg-red-500 hover:bg-red-600"
            >
              {deletingId === selectedMakeup?.id ? 'กำลังลบ...' : 'ยืนยันลบ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendance Confirm Dialog */}
      <AlertDialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการบันทึกเข้าเรียน</AlertDialogTitle>
            <AlertDialogDescription>
              ยืนยันว่านักเรียนมาเรียนชดเชยแล้ว?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {attendanceMakeup && (
            <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
              <p><strong>นักเรียน:</strong> {attendanceMakeup.studentNickname ? `${attendanceMakeup.studentNickname} (${attendanceMakeup.studentName.split(' ')[0]})` : attendanceMakeup.studentName}</p>
              <p><strong>คลาส:</strong> {attendanceMakeup.className}</p>
              {attendanceMakeup.makeupSchedule && (
                <p><strong>วันที่นัด:</strong> {formatDate(attendanceMakeup.makeupSchedule.date)} {attendanceMakeup.makeupSchedule.startTime?.substring(0, 5)} - {attendanceMakeup.makeupSchedule.endTime?.substring(0, 5)}</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingAttendance}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmMarkAttendance}
              disabled={markingAttendance}
              className="bg-green-600 hover:bg-green-700"
            >
              {markingAttendance ? 'กำลังบันทึก...' : 'ยืนยัน มาเรียนแล้ว'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Makeup Dialog */}
      <CreateMakeupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.makeupClasses(selectedBranchId) });
          window.dispatchEvent(new CustomEvent('makeup-changed'));
        }}
      />

      {/* Schedule Makeup Dialog */}
      {scheduleMakeup && (
        <ScheduleMakeupDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          makeupRequest={scheduleMakeup}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.makeupClasses(selectedBranchId) });
            window.dispatchEvent(new CustomEvent('makeup-changed'));
          }}
        />
      )}

    </div>
  );
}
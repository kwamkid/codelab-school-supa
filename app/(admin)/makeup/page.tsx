'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MakeupClass } from '@/types/models';
import { getMakeupClasses, deleteMakeupClass } from '@/lib/services/makeup';
import { getActiveBranches } from '@/lib/services/branches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { 
  Calendar,
  Search,
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
import ScheduleMakeupDialog from '@/components/makeup/schedule-makeup-dialog';
import CreateMakeupDialog from '@/components/makeup/create-makeup-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMakeup } from '@/contexts/MakeupContext';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

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
  
  // Dialogs
  const [selectedMakeup, setSelectedMakeup] = useState<MakeupClass | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Delete dialog
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

  const handleSchedule = (makeup: MakeupClass) => {
    setSelectedMakeup(makeup);
    setShowScheduleDialog(true);
  };

  const handleViewDetail = (makeup: MakeupClass) => {
    router.push(`/makeup/${makeup.id}`);
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
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            การลา และชดเชย
            {/* {!isAllBranches && <span className="text-red-600 text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>} */}
          </h1>
          <p className="text-gray-600 mt-2">การลา เรียนชดเชย Makeup Class</p>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">รอจัดตาราง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นัดแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">เรียนแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ยกเลิก</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Auto-generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.autoGenerated}</div>
            {stats.pendingAutoGenerated > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                {stats.pendingAutoGenerated} รอจัดตาราง
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหานักเรียน หรือ เหตุผล..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
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

      {/* Tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all">ทั้งหมด ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">รอจัดตาราง ({stats.pending})</TabsTrigger>
          <TabsTrigger value="scheduled">นัดแล้ว ({stats.scheduled})</TabsTrigger>
          <TabsTrigger value="completed">เรียนแล้ว ({stats.completed})</TabsTrigger>
          <TabsTrigger value="cancelled">ยกเลิก ({stats.cancelled})</TabsTrigger>
        </TabsList>

        <TabsContent value={filterStatus} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>รายการ Makeup Class ({filteredMakeupClasses.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredMakeupClasses.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    ไม่พบข้อมูล Makeup Class
                  </h3>
                  <p className="text-gray-600">
                    {searchTerm || filterClass !== 'all' || filterType !== 'all'
                      ? 'ลองปรับเงื่อนไขการค้นหา'
                      : 'ยังไม่มีการขอ Makeup Class'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">วันที่ขอ</TableHead>
                          <TableHead className="min-w-[120px]">นักเรียน</TableHead>
                          <TableHead className="min-w-[140px]">คลาสเดิม</TableHead>
                          <TableHead className="w-[90px]">วันที่ขาด</TableHead>
                          {isAllBranches && <TableHead className="w-[100px]">สาขา</TableHead>}
                          <TableHead className="max-w-[200px]">เหตุผล</TableHead>
                          <TableHead className="w-[110px]">วันที่นัด</TableHead>
                          <TableHead className="text-center w-[100px]">สถานะ</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedMakeupClasses.map((makeup) => {
                          const StatusIcon = statusIcons[makeup.status];
                          const isAutoGenerated = makeup.requestedBy === 'system';
                          
                          return (
                            <TableRow key={makeup.id} className={isAutoGenerated ? 'bg-orange-50' : ''}>
                              <TableCell className="whitespace-nowrap align-top">
                                <div className="text-sm">
                                  {formatDate(makeup.requestDate)}
                                </div>
                                {isAutoGenerated && (
                                  <Badge variant="outline" className="mt-1 text-xs border-orange-300 text-orange-700">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Auto
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="min-w-[120px]">
                                  <p className="font-medium text-sm">{makeup.studentNickname || makeup.studentName}</p>
                                  <p className="text-xs text-gray-500">{makeup.parentName}</p>
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="min-w-[140px]">
                                  <p className="font-medium text-sm">{makeup.className}</p>
                                  <p className="text-xs text-gray-500">{makeup.classCode}</p>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-top">
                                {makeup.originalSessionNumber ? (
                                  <div className="text-sm">
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
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                              {isAllBranches && (
                                <TableCell className="align-top text-sm">
                                  {makeup.branchName}
                                </TableCell>
                              )}
                              <TableCell className="align-top">
                                <div className="text-sm truncate max-w-[200px]" title={makeup.reason}>
                                  {makeup.reason}
                                </div>
                                {isAutoGenerated && (
                                  <p className="text-xs text-orange-600 mt-1">
                                    (สร้างอัตโนมัติ)
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-top">
                                {makeup.makeupSchedule ? (
                                  <div className="text-sm">
                                    <p>{formatDate(makeup.makeupSchedule.date)}</p>
                                    <p className="text-xs text-gray-500">
                                      {makeup.makeupSchedule.startTime} - {makeup.makeupSchedule.endTime}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
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
                                          จัดตาราง
                                        </DropdownMenuItem>
                                      )}
                                      
                                      {makeup.status === 'scheduled' && (
                                        <DropdownMenuItem 
                                          onClick={() => handleViewDetail(makeup)}
                                          className="text-green-600"
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          บันทึกการเข้าเรียน
                                        </DropdownMenuItem>
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
        </TabsContent>
      </Tabs>

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

      {selectedMakeup && (
        <ScheduleMakeupDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          makeupRequest={selectedMakeup}
          onSuccess={async () => {
            setShowScheduleDialog(false);
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.makeupClasses(selectedBranchId) });
            // Dispatch event to update sidebar badge
            window.dispatchEvent(new CustomEvent('makeup-changed'));
          }}
        />
      )}

      {/* ✅ ไม่ต้องส่ง students และ classes prop - ให้ dialog โหลดเอง */}
      <CreateMakeupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={async () => {
          setShowCreateDialog(false);
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.makeupClasses(selectedBranchId) });
          // Dispatch event to update sidebar badge
          window.dispatchEvent(new CustomEvent('makeup-changed'));
          toast.success('สร้าง Makeup Request เรียบร้อยแล้ว');
        }}
      />
    </div>
  );
}
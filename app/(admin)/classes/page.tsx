'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Class } from '@/types/models';
import { getClasses, deleteClass, batchUpdateClassStatuses } from '@/lib/services/classes';
import { getActiveBranches } from '@/lib/services/branches';
import { getActiveSubjects } from '@/lib/services/subjects';
import { getActiveTeachers } from '@/lib/services/teachers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Calendar, 
  Trash2, 
  Edit, 
  Eye,
  Search,
  MoreHorizontal,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency, getDayName } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
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
import { Skeleton } from '@/components/ui/skeleton';
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

// ============================================
// 🎨 Mini Skeleton Components
// ============================================
const InlineTextSkeleton = ({ width = "w-20" }: { width?: string }) => (
  <Skeleton className={`h-4 ${width}`} />
);

export default function ClassesPage() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    updated: number;
    errors: string[];
  } | null>(null);
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

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
    staleTime: 60000, // 1 minute
  });

  // ============================================
  // 🎯 Query 2-4: Supporting Data (Load After)
  // ============================================
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: getActiveBranches,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects', 'active'],
    queryFn: getActiveSubjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers', 'active', selectedBranchId],
    queryFn: () => getActiveTeachers(selectedBranchId),
    staleTime: 60000, // 1 minute
  });

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
  const getTeacherName = (teacherId: string) => {
    const teacher = teachersMap.get(teacherId);
    return teacher?.nickname || teacher?.name || 'Unknown';
  };

  // Filter classes with memoization
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          cls.name.toLowerCase().includes(search) ||
          cls.code.toLowerCase().includes(search) ||
          getSubjectName(cls.subjectId).toLowerCase().includes(search) ||
          getTeacherName(cls.teacherId).toLowerCase().includes(search) ||
          getBranchName(cls.branchId).toLowerCase().includes(search);
        
        if (!matchesSearch) return false;
      }

      // Other filters
      if (selectedStatus !== 'all' && cls.status !== selectedStatus) return false;
      if (selectedSubject !== 'all' && cls.subjectId !== selectedSubject) return false;
      return true;
    });
  }, [classes, searchTerm, selectedStatus, selectedSubject, getSubjectName, getTeacherName, getBranchName]);

  // ============================================
  // 🎯 Paginated Classes
  // ============================================
  const paginatedClasses = useMemo(() => {
    return getPaginatedData(filteredClasses);
  }, [filteredClasses, getPaginatedData]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return calculateTotalPages(filteredClasses.length);
  }, [filteredClasses.length, calculateTotalPages]);

  // Calculate statistics with memoization
  const stats = useMemo(() => ({
    total: classes.length,
    draft: classes.filter(c => c.status === 'draft').length,
    published: classes.filter(c => c.status === 'published').length,
    started: classes.filter(c => c.status === 'started').length,
    completed: classes.filter(c => c.status === 'completed').length,
    cancelled: classes.filter(c => c.status === 'cancelled').length,
    totalSeats: classes.reduce((sum, c) => sum + c.maxStudents, 0),
    enrolledSeats: classes.reduce((sum, c) => sum + c.enrolledCount, 0),
  }), [classes]);

  // Get unique subjects used in current classes (for subject chips)
  const usedSubjects = useMemo(() => {
    const subjectIds = [...new Set(classes.map(c => c.subjectId))];
    return subjectIds
      .map(id => subjects.find(s => s.id === id))
      .filter(Boolean) as typeof subjects;
  }, [classes, subjects]);

  // ============================================
  // 🎯 Reset Pagination on Filter Change
  // ============================================
  useEffect(() => {
    resetPagination();
  }, [selectedBranchId, selectedStatus, selectedSubject, searchTerm, resetPagination]);

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
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>

        {/* Search + Chips Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-80" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
            {(loadingSubjects || loadingTeachers || loadingBranches) && (
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

      {/* Status Filter Tabs */}
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus} className="mb-4">
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
          >
            ทั้งหมด ({stats.total})
          </TabsTrigger>
          {stats.started > 0 && (
            <TabsTrigger
              value="started"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
            >
              กำลังเรียน ({stats.started})
            </TabsTrigger>
          )}
          {stats.published > 0 && (
            <TabsTrigger
              value="published"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
            >
              เปิดรับสมัคร ({stats.published})
            </TabsTrigger>
          )}
          {stats.completed > 0 && (
            <TabsTrigger
              value="completed"
              className="data-[state=active]:bg-gray-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
            >
              จบแล้ว ({stats.completed})
            </TabsTrigger>
          )}
          {stats.draft > 0 && (
            <TabsTrigger
              value="draft"
              className="data-[state=active]:bg-gray-500 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
            >
              ร่าง ({stats.draft})
            </TabsTrigger>
          )}
          {stats.cancelled > 0 && (
            <TabsTrigger
              value="cancelled"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-full px-4 py-1.5 text-sm"
            >
              ยกเลิก ({stats.cancelled})
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Search + Subject Chips */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="ค้นหาชื่อคลาส, รหัส, ครู, สาขา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Subject Chips */}
        {usedSubjects.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedSubject === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ทุกวิชา
            </button>
            {usedSubjects.map(subject => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(selectedSubject === subject.id ? 'all' : subject.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  selectedSubject === subject.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: subject.color }}
                />
                {subject.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Classes Table */}
      <Card>
        <CardContent className="p-0">
          {filteredClasses.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {classes.length === 0 ? 'ยังไม่มีคลาสเรียน' : 'ไม่พบคลาสที่ตรงกับเงื่อนไข'}
              </h3>
              <p className="text-gray-600 mb-4">
                {classes.length === 0 ? 'เริ่มต้นด้วยการสร้างคลาสแรก' : 'ลองปรับเงื่อนไขการค้นหาใหม่'}
              </p>
              {classes.length === 0 && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href="/classes/new">
                    <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      สร้างคลาสใหม่
                    </ActionButton>
                  </Link>
                </PermissionGuard>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">คลาส</TableHead>
                      <TableHead className="w-[100px]">วิชา</TableHead>
                      {isAllBranches && <TableHead className="w-[100px]">สาขา</TableHead>}
                      <TableHead className="w-[80px]">ครู</TableHead>
                      <TableHead className="w-[100px]">วัน/เวลา</TableHead>
                      <TableHead className="text-center w-[120px]">ระยะเวลา</TableHead>
                      <TableHead className="text-center w-[70px]">นักเรียน</TableHead>
                      <TableHead className="text-right w-[90px]">ราคา</TableHead>
                      <TableHead className="text-center w-[90px]">สถานะ</TableHead>
                      <TableHead className="text-center w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClasses.map((cls) => {
                      const isDeletable = cls.enrolledCount <= 0 || cls.status === 'cancelled';
                      
                      return (
                        <TableRow key={cls.id}>
                          <TableCell className="align-top">
                            <Link href={`/classes/${cls.id}`} className="flex items-start gap-2 group">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                                style={{ backgroundColor: getSubjectColor(cls.subjectId) }}
                              />
                              <div className="min-w-0">
                                <div className="font-medium truncate group-hover:text-red-600 transition-colors" title={cls.name}>{cls.name}</div>
                                <div className="text-xs text-gray-500">{cls.code}</div>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="align-top">
                            {loadingSubjects ? (
                              <InlineTextSkeleton width="w-16" />
                            ) : (
                              <div className="break-words">{getSubjectName(cls.subjectId)}</div>
                            )}
                          </TableCell>
                          {isAllBranches && (
                            <TableCell className="align-top">
                              {loadingBranches ? (
                                <InlineTextSkeleton width="w-20" />
                              ) : (
                                <div className="break-words">{getBranchName(cls.branchId)}</div>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="align-top">
                            {loadingTeachers ? (
                              <InlineTextSkeleton width="w-16" />
                            ) : (
                              getTeacherName(cls.teacherId)
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <div>
                              <div className="leading-tight break-words">
                                {cls.daysOfWeek.map(d => getDayName(d)).join(', ')}
                              </div>
                              <div className="text-xs text-gray-500">{cls.startTime}-{cls.endTime}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center align-top">
                            <div>
                              <div className="text-sm">{formatDate(cls.startDate, 'short')}</div>
                              <div className="text-xs text-gray-500">-{formatDate(cls.endDate, 'short')}</div>
                              <div className="font-medium">{cls.totalSessions} ครั้ง</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center align-top">
                            <span className={cls.enrolledCount >= cls.maxStudents ? 'text-red-600 font-medium' : ''}>
                              {cls.enrolledCount}/{cls.maxStudents}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600 align-top">
                            {formatCurrency(cls.pricing.totalPrice)}
                          </TableCell>
                          <TableCell className="text-center align-top">
                            <Badge 
                              className={`${statusColors[cls.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}
                              variant={!cls.status ? 'destructive' : 'default'}
                            >
                              {statusLabels[cls.status as keyof typeof statusLabels] || 'ไม่ระบุ'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center align-top">
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
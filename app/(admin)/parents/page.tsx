'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Parent, Student, Enrollment } from '@/types/models';
import { getParentsWithStudentsAndEnrollments, deleteParent, deleteStudent } from '@/lib/services/parents';
import { getActiveBranches } from '@/lib/services/branches';
import { getClasses } from '@/lib/services/classes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ParentViewDialog } from '@/components/parents/parent-view-dialog';
import { SearchInput } from '@/components/ui/search-input';
import { FormSelect } from '@/components/ui/form-select';
import { SortableTableHead, useSortableTable } from '@/components/ui/sortable-table-head';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import {
  Plus,
  Users,
  Phone,
  Mail,
  Eye,
  Edit,
  ChevronDown,
  ChevronUp,
  User,
  Cake,
  School,
  GraduationCap,
  Globe,
  Trash2,
  Loader2,
  CornerDownRight
} from 'lucide-react';
import { LineIcon } from '@/components/ui/line-icon';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, calculateAge } from '@/lib/utils';
import { PermissionGuard, usePermissions } from '@/components/auth/permission-guard';
import { useAuth } from '@/hooks/useAuth';
import { ActionButton } from '@/components/ui/action-button';
import { ParentBadge } from '@/components/ui/parent-badge';
import { SectionLoading, InlineLoading } from '@/components/ui/loading';
import { toast } from 'sonner';
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

interface StudentEnrollment {
  id: string;
  classId: string;
  branchId: string;
  status: string;
}

interface StudentWithEnrollment extends Student {
  enrollments: StudentEnrollment[];
  hasActiveClass?: boolean;
  enrollmentStatus?: 'active' | 'completed' | 'never';
}

interface ParentWithInfo extends Parent {
  students: StudentWithEnrollment[];
  activeStudentCount?: number;
  enrollmentStatus?: 'active' | 'completed' | 'never' | 'mixed';
}


export default function ParentsPage() {
  const { isSuperAdmin } = usePermissions();
  const { adminUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewParentId, setViewParentId] = useState<string | null>(null);
  const { sort, toggle: toggleSort, sortRows } = useSortableTable();
  const [deletingParentId, setDeletingParentId] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
    totalPages,
  } = usePagination(20);

  // ============================================
  // 🎯 Query 1: Parents with Students & Enrollments (Single Query)
  // ============================================
  const { data: parentsRaw = [], isLoading: loadingParents } = useQuery({
    queryKey: ['parents-with-students-enrollments'],
    queryFn: getParentsWithStudentsAndEnrollments,
    staleTime: Infinity,
  });

  // ============================================
  // 🎯 Query 2-3: Supporting Data
  // ============================================
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: getActiveBranches,
    staleTime: Infinity,
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => getClasses(),
    staleTime: Infinity,
  });

  // Create lookup maps
  const branchesMap = useMemo(() => 
    new Map(branches.map(b => [b.id, b])), 
    [branches]
  );
  
  const classesMap = useMemo(() => 
    new Map(classes.map(c => [c.id, c])), 
    [classes]
  );

  const getBranchName = (branchId: string) => branchesMap.get(branchId)?.name || 'Unknown';
  const getClassInfo = (classId: string) => classesMap.get(classId);

  // Process parents data with enrollment status (computed from already-loaded data)
  const allParentsData = useMemo(() => {
    if (!parentsRaw.length) return [];

    return parentsRaw.map((parent) => {
      const studentsWithStatus = parent.students.map((student) => {
        let hasActiveClass = false;
        let enrollmentStatus: 'active' | 'completed' | 'never' = 'never';

        if (student.enrollments.length > 0) {
          const activeEnrollments = student.enrollments.filter(e => {
            const cls = classesMap.get(e.classId);
            return e.status === 'active' && cls && cls.status !== 'completed';
          });

          hasActiveClass = activeEnrollments.length > 0;
          enrollmentStatus = hasActiveClass ? 'active' : 'completed';
        }

        return {
          ...student,
          hasActiveClass,
          enrollmentStatus
        };
      });

      const activeCount = studentsWithStatus.filter(s => s.isActive).length;
      const statuses = studentsWithStatus.map(s => s.enrollmentStatus);

      let parentStatus: 'active' | 'completed' | 'never' | 'mixed' = 'never';
      if (statuses.includes('active')) {
        parentStatus = 'active';
      } else if (statuses.includes('completed')) {
        parentStatus = 'completed';
      } else if (statuses.length > 1 && new Set(statuses).size > 1) {
        parentStatus = 'mixed';
      }

      return {
        ...parent,
        students: studentsWithStatus,
        activeStudentCount: activeCount,
        enrollmentStatus: parentStatus
      };
    });
  }, [parentsRaw, classesMap]);

  // Reset page when filters change
  useEffect(() => {
    resetPagination();
  }, [searchTerm, filterBranch, filterStatus, sort, resetPagination]);

  // Filter parents
  const filteredParents = useMemo(() => {
    let filtered = [...allParentsData];

    if (filterBranch !== 'all') {
      filtered = filtered.filter(parent => {
        const hasStudentInBranch = parent.students?.some(student =>
          student.enrollments?.some(e => e.branchId === filterBranch)
        );
        const interestedInBranch = parent.preferredBranchId === filterBranch;
        return hasStudentInBranch || interestedInBranch;
      });
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(parent =>
        parent.displayName.toLowerCase().includes(term) ||
        parent.phone?.toLowerCase().includes(term) ||
        parent.email?.toLowerCase().includes(term) ||
        parent.students?.some(s =>
          s.name.toLowerCase().includes(term) ||
          s.nickname?.toLowerCase().includes(term)
        )
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(parent => {
        if (filterStatus === 'active') return parent.enrollmentStatus === 'active';
        if (filterStatus === 'completed') return parent.enrollmentStatus === 'completed' || parent.enrollmentStatus === 'mixed';
        if (filterStatus === 'never') return parent.enrollmentStatus === 'never';
        return true;
      });
    }

    return filtered;
  }, [allParentsData, searchTerm, filterBranch, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const activeCount = filteredParents.filter(p => p.enrollmentStatus === 'active').length;
    const completedCount = filteredParents.filter(p => p.enrollmentStatus === 'completed' || p.enrollmentStatus === 'mixed').length;
    const neverCount = filteredParents.filter(p => p.enrollmentStatus === 'never').length;
    
    return {
      totalParents: filteredParents.length,
      totalStudents: filteredParents.reduce((sum, p) => sum + (p.activeStudentCount || 0), 0),
      withLineId: filteredParents.filter(p => p.lineUserId).length,
      activeEnrollment: activeCount,
      completedEnrollment: completedCount,
      neverEnrolled: neverCount
    };
  }, [filteredParents]);

  // Apply column sort, then paginate
  const sortedParents = useMemo(() => {
    return sortRows(filteredParents, (parent, key) => {
      switch (key) {
        case 'name': return parent.displayName;
        case 'children': return parent.activeStudentCount || 0;
        case 'created': return parent.createdAt ? new Date(parent.createdAt).getTime() : null;
        default: return null;
      }
    });
  }, [filteredParents, sortRows]);

  // Paginated data
  const paginatedParents = getPaginatedData(sortedParents);
  const calculatedTotalPages = totalPages(filteredParents.length);

  // Toggle row expansion
  const toggleRow = (parentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedRows(newExpanded);
  };

  // Delete parent handler
  const handleDeleteParent = async (parent: ParentWithInfo) => {
    setDeletingParentId(parent.id);
    try {
      await deleteParent(parent.id);
      toast.success(`ลบผู้ปกครอง "${parent.displayName}" เรียบร้อยแล้ว`);
      queryClient.invalidateQueries({ queryKey: ['parents-with-students-enrollments'] });
    } catch (error: any) {
      console.error('Error deleting parent:', error);
      toast.error(error.message || 'ไม่สามารถลบผู้ปกครองได้');
    } finally {
      setDeletingParentId(null);
    }
  };

  // Delete student handler
  const handleDeleteStudent = async (parentId: string, student: StudentWithEnrollment) => {
    setDeletingStudentId(student.id);
    try {
      await deleteStudent(parentId, student.id,
        isSuperAdmin ? { force: true, adminId: adminUser?.id } : undefined
      );
      toast.success(`ลบนักเรียน "${student.nickname || student.name}" เรียบร้อยแล้ว`);
      queryClient.invalidateQueries({ queryKey: ['parents-with-students-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error(error.message || 'ไม่สามารถลบนักเรียนได้');
    } finally {
      setDeletingStudentId(null);
    }
  };

  // ============================================
  // 🎨 Loading States (Progressive)
  // ============================================
  
  // Phase 1: Parents Loading
  if (loadingParents) {
    return <SectionLoading />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Globe className="h-8 w-8 text-blue-500" />
            ผู้ปกครอง
          </h1>
          <p className="text-gray-600 mt-1">
            ข้อมูลผู้ปกครองและนักเรียนทั้งหมด
            {(loadingBranches || loadingClasses) && (
              <span className="text-orange-500 ml-2">(กำลังโหลดข้อมูลเพิ่มเติม...)</span>
            )}
          </p>
        </div>
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <Link href="/parents/new">
            <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มผู้ปกครองใหม่
            </ActionButton>
          </Link>
        </PermissionGuard>
      </div>

      {/* Summary Cards — full-colour */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        {[
          { label: filterBranch !== 'all' ? 'ผู้ปกครองในสาขา' : 'ผู้ปกครองทั้งหมด', value: stats.totalParents, Icon: Users, bg: 'bg-gradient-to-br from-gray-700 to-gray-900' },
          { label: 'นักเรียนทั้งหมด', value: stats.totalStudents, Icon: GraduationCap, bg: 'bg-gradient-to-br from-blue-500 to-blue-600' },
          { label: 'เชื่อมต่อ LINE', value: stats.withLineId, Icon: Globe, bg: 'bg-gradient-to-br from-emerald-500 to-green-600' },
          { label: 'มีลูกกำลังเรียน', value: stats.activeEnrollment, Icon: GraduationCap, bg: 'bg-gradient-to-br from-teal-500 to-teal-600' },
          { label: 'จบคอร์สแล้ว', value: stats.completedEnrollment, Icon: School, bg: 'bg-gradient-to-br from-orange-500 to-orange-600' },
          { label: 'ยังไม่ลงคอร์ส', value: stats.neverEnrolled, Icon: User, bg: 'bg-gradient-to-br from-slate-400 to-slate-500' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl p-4 text-white shadow-sm', stat.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90 leading-tight">{stat.label}</span>
              <stat.Icon className="h-4 w-4 text-white/80 shrink-0" />
            </div>
            <div className="text-2xl font-bold mt-2">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <SearchInput
          placeholder="ค้นหาชื่อผู้ปกครอง, นักเรียน, เบอร์โทร, อีเมล..."
          value={searchTerm}
          onChange={setSearchTerm}
        />

        <FormSelect
          value={filterBranch}
          onValueChange={setFilterBranch}
          className="h-11"
          placeholder="ทุกสาขา"
          searchPlaceholder="ค้นหาสาขา..."
          options={[
            { value: 'all', label: 'ทุกสาขา' },
            ...branches.map((b) => ({ value: b.id, label: `${b.name} (เรียน+สนใจ)` })),
          ]}
        />

        <FormSelect
          value={filterStatus}
          onValueChange={setFilterStatus}
          className="h-11"
          placeholder="สถานะเรียนทั้งหมด"
          options={[
            { value: 'all', label: 'สถานะเรียนทั้งหมด' },
            { value: 'active', label: 'มีลูกกำลังเรียน' },
            { value: 'completed', label: 'จบคอร์สแล้ว' },
            { value: 'never', label: 'ยังไม่ลงคอร์ส' },
          ]}
        />
      </div>

      {/* Parents Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              รายชื่อผู้ปกครอง ({filteredParents.length} คน)
              {filterBranch !== 'all' && !loadingBranches && (
                <span className="text-blue-600 text-base ml-2">
                  • กรองสาขา: {getBranchName(filterBranch)} (เรียน+สนใจ)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {paginatedParents.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' :
                filterBranch !== 'all' ? 'ไม่มีผู้ปกครองในสาขานี้' : 'ยังไม่มีผู้ปกครอง'}
              description={searchTerm ? 'ลองค้นหาด้วยคำค้นอื่น' :
                filterBranch !== 'all' ? 'ไม่มีผู้ปกครองที่เรียนหรือสนใจสาขานี้' : 'เริ่มต้นด้วยการเพิ่มผู้ปกครองคนแรก'}
              action={!searchTerm && filterBranch === 'all' ? (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href="/parents/new">
                    <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่มผู้ปกครองใหม่
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
                      <TableHead className="w-[40px]"></TableHead>
                      <SortableTableHead sortKey="name" currentSort={sort} onSort={toggleSort}>ชื่อผู้ปกครอง</SortableTableHead>
                      <TableHead>ติดต่อ</TableHead>
                      <SortableTableHead sortKey="children" currentSort={sort} onSort={toggleSort} className="text-center">จำนวนลูก</SortableTableHead>
                      <TableHead className="text-center">LINE</TableHead>
                      <TableHead>สาขาที่สะดวก</TableHead>
                      <TableHead>สาขาที่เรียน</TableHead>
                      <SortableTableHead sortKey="created" currentSort={sort} onSort={toggleSort}>วันที่ลงทะเบียน</SortableTableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedParents.map((parent) => (
                      <Fragment key={parent.id}>
                        <TableRow className="cursor-pointer hover:bg-gray-50 h-16" onClick={() => toggleRow(parent.id)}>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              {expandedRows.has(parent.id) ? 
                                <ChevronUp className="h-4 w-4" /> : 
                                <ChevronDown className="h-4 w-4" />
                              }
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ParentBadge
                                name={parent.displayName}
                                imageUrl={parent.pictureUrl}
                                size="lg"
                              />
                              <div>
                                {parent.enrollmentStatus === 'active' ? (
                                  <Badge className="bg-green-100 text-green-700 text-xs">กำลังเรียน</Badge>
                                ) : parent.enrollmentStatus === 'completed' || parent.enrollmentStatus === 'mixed' ? (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">จบคอร์สแล้ว</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">ยังไม่ลงคอร์ส</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {parent.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {parent.phone}
                                </div>
                              )}
                              {parent.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]" title={parent.email}>
                                    {parent.email}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <Badge variant="secondary">
                                {parent.activeStudentCount || 0} คน
                              </Badge>
                              {parent.students && parent.students.length !== parent.activeStudentCount && (
                                <div className="text-gray-500">
                                  (ทั้งหมด {parent.students.length})
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <LineIcon
                              connected={!!parent.lineUserId}
                              className="h-5 w-5 mx-auto"
                              aria-label={parent.lineUserId ? 'เชื่อมต่อ LINE แล้ว' : 'ยังไม่เชื่อมต่อ LINE'}
                            />
                          </TableCell>
                          <TableCell>
                            {loadingBranches ? (
                              <InlineLoading />
                            ) : parent.preferredBranchId ? (
                              <Badge variant="outline">
                                {getBranchName(parent.preferredBranchId)}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {loadingBranches ? (
                                <InlineLoading />
                              ) : (() => {
                                const enrolledBranches = new Set<string>();
                                parent.students?.forEach(student => {
                                  student.enrollments?.forEach(enrollment => {
                                    enrolledBranches.add(enrollment.branchId);
                                  });
                                });

                                return enrolledBranches.size > 0 ? (
                                  Array.from(enrolledBranches).map(branchId => (
                                    <Badge
                                      key={branchId}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {getBranchName(branchId)}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-400">ยังไม่ลงคอร์ส</span>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(parent.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setViewParentId(parent.id); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                <Link href={`/parents/${parent.id}`} onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </PermissionGuard>
                              {isSuperAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>ยืนยันการลบผู้ปกครอง</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        คุณต้องการลบ <strong>{parent.displayName}</strong> ใช่หรือไม่?
                                        <br /><br />
                                        <span className="text-red-500">
                                          หมายเหตุ: ต้องลบข้อมูลนักเรียนทั้งหมดก่อนจึงจะลบผู้ปกครองได้
                                        </span>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteParent(parent)}
                                        className="bg-red-500 hover:bg-red-600"
                                        disabled={deletingParentId === parent.id}
                                      >
                                        {deletingParentId === parent.id ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            กำลังลบ...
                                          </>
                                        ) : (
                                          'ลบผู้ปกครอง'
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expandable row for students */}
                        {expandedRows.has(parent.id) && parent.students && parent.students.length > 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={9} className="bg-orange-50/70 dark:bg-orange-950/20 border-l-4 border-l-primary/60 p-0">
                              <div className="pl-12 pr-4 py-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-sm text-gray-700 flex items-center gap-1.5">
                                    <CornerDownRight className="h-4 w-4 text-gray-400" />
                                    ลูกของ {parent.displayName} ({parent.students.length} คน)
                                  </h4>
                                  <Link href={`/parents/${parent.id}/students/new?returnTo=/parents`}>
                                    <Button size="sm" variant="outline">
                                      <Plus className="h-4 w-4 mr-2" />
                                      เพิ่มนักเรียน
                                    </Button>
                                  </Link>
                                </div>
                                <div className="space-y-2">
                                  {parent.students.map((student) => (
                                    <div key={student.id} className="flex items-start gap-4 p-3 bg-white rounded-lg border">
                                      {/* ซ้าย: ข้อมูลนักเรียน (ความกว้างคงที่) */}
                                      <div className="w-80 shrink-0">
                                        <p className="font-medium">{student.name}</p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
                                          <span>{student.nickname || '-'}</span>
                                          <Badge
                                            className={student.gender === 'M'
                                              ? 'bg-blue-100 text-blue-700 text-xs'
                                              : 'bg-pink-100 text-pink-700 text-xs'
                                            }
                                          >
                                            {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                                          </Badge>
                                          <span className="flex items-center gap-1">
                                            <Cake className="h-3 w-3" />
                                            {calculateAge(student.birthdate)} ปี
                                          </span>
                                          {student.schoolName && (
                                            <span className="flex items-center gap-1">
                                              <School className="h-3 w-3" />
                                              {student.schoolName}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* กลาง: สถานะ + สาขา + ชื่อคลาส — ใช้พื้นที่ที่เหลือทั้งหมด ตัดบรรทัดได้ */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {student.enrollmentStatus === 'active' ? (
                                            <Badge className="bg-green-100 text-green-700 text-xs">
                                              <GraduationCap className="h-3 w-3 mr-1" />
                                              กำลังเรียน
                                            </Badge>
                                          ) : student.enrollmentStatus === 'completed' ? (
                                            <Badge className="bg-orange-100 text-orange-700 text-xs">
                                              จบคอร์สแล้ว
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="text-xs">
                                              ยังไม่ลงคอร์ส
                                            </Badge>
                                          )}
                                          {loadingBranches ? (
                                            <InlineLoading />
                                          ) : (() => {
                                            const studentBranches = new Set<string>();
                                            student.enrollments?.forEach(enrollment => {
                                              studentBranches.add(enrollment.branchId);
                                            });

                                            return studentBranches.size > 0 ? (
                                              Array.from(studentBranches).map(branchId => (
                                                <Badge
                                                  key={branchId}
                                                  variant="outline"
                                                  className="text-xs"
                                                >
                                                  {getBranchName(branchId)}
                                                </Badge>
                                              ))
                                            ) : null;
                                          })()}
                                          {!student.isActive && (
                                            <Badge variant="destructive" className="text-xs">ไม่ใช้งาน</Badge>
                                          )}
                                        </div>
                                        {student.enrollmentStatus === 'active' &&
                                          student.enrollments && student.enrollments.length > 0 && !loadingClasses && (
                                          <div className="text-gray-600 mt-1 break-words">
                                            {student.enrollments
                                              .filter(e => e.status === 'active')
                                              .map(e => getClassInfo(e.classId)?.name || e.classId)
                                              .join(', ')}
                                          </div>
                                        )}
                                      </div>

                                      {/* ขวา: ปุ่มแก้ไข/ลบ */}
                                      <div className="flex items-center shrink-0">
                                        <Link href={`/parents/${parent.id}/students/${student.id}/edit`}>
                                          <Button size="sm" variant="ghost">
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </Link>
                                        {isSuperAdmin && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>ยืนยันการลบนักเรียน</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  คุณต้องการลบ <strong>{student.nickname || student.name}</strong> ใช่หรือไม่?
                                                  <br /><br />
                                                  <span className="text-red-500">
                                                    หมายเหตุ: ไม่สามารถลบนักเรียนที่มีประวัติการลงทะเบียนเรียนได้
                                                  </span>
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => handleDeleteStudent(parent.id, student)}
                                                  className="bg-red-500 hover:bg-red-600"
                                                  disabled={deletingStudentId === student.id}
                                                >
                                                  {deletingStudentId === student.id ? (
                                                    <>
                                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                      กำลังลบ...
                                                    </>
                                                  ) : (
                                                    'ลบนักเรียน'
                                                  )}
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {filteredParents.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={calculatedTotalPages}
                  pageSize={pageSize}
                  totalItems={filteredParents.length}
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

      <ParentViewDialog
        parentId={viewParentId}
        open={!!viewParentId}
        onOpenChange={(o) => { if (!o) setViewParentId(null); }}
      />
    </div>
  );
}
'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Parent, Student, Enrollment } from '@/types/models';
import { getParentsWithStudentsAndEnrollments } from '@/lib/services/parents';
import { getActiveBranches } from '@/lib/services/branches';
import { getClasses } from '@/lib/services/classes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { 
  Plus, 
  Search, 
  Users, 
  Phone, 
  Mail, 
  Eye, 
  Edit, 
  Building2,
  ChevronDown,
  ChevronUp,
  User,
  Cake,
  School,
  GraduationCap,
  Globe
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
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
import { formatDate, calculateAge } from '@/lib/utils';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { Skeleton } from '@/components/ui/skeleton';

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

// ============================================
// 🎨 Mini Skeleton Components
// ============================================
const InlineTextSkeleton = ({ width = "w-20" }: { width?: string }) => (
  <Skeleton className={`h-4 ${width}`} />
);

const BadgeSkeleton = () => (
  <Skeleton className="h-5 w-16" />
);

export default function ParentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
    staleTime: 60000, // 1 minute
  });

  // ============================================
  // 🎯 Query 2-3: Supporting Data
  // ============================================
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: getActiveBranches,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: () => getClasses(),
    staleTime: 2 * 60 * 1000, // 2 minutes
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
  }, [searchTerm, filterBranch, filterStatus, resetPagination]);

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

  // Paginated data
  const paginatedParents = getPaginatedData(filteredParents);
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

  // ============================================
  // 🎨 Loading States (Progressive)
  // ============================================
  
  // Phase 1: Parents Loading
  if (loadingParents) {
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
            <Card key={`skeleton-card-${i}`}>
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
                <Skeleton key={`skeleton-row-${i}`} className="h-12 w-full" />
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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Globe className="h-8 w-8 text-blue-500" />
            จัดการผู้ปกครอง (ทุกสาขา)
          </h1>
          <p className="text-gray-600 mt-2">
            ข้อมูลผู้ปกครองและนักเรียนทั้งหมดในระบบ - สามารถกรองตามสาขาได้
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card key="card-total">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {filterBranch !== 'all' ? 'ผู้ปกครองในสาขา' : 'ผู้ปกครองทั้งหมด'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalParents}</div>
          </CardContent>
        </Card>
        
        <Card key="card-students">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalStudents}</div>
          </CardContent>
        </Card>
        
        <Card key="card-line">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">เชื่อมต่อ LINE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withLineId}</div>
          </CardContent>
        </Card>
        
        <Card key="card-active">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">มีลูกกำลังเรียน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.activeEnrollment}
            </div>
          </CardContent>
        </Card>

        <Card key="card-completed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">จบคอร์สแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.completedEnrollment}
            </div>
          </CardContent>
        </Card>

        <Card key="card-never">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ยังไม่ลงคอร์ส</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {stats.neverEnrolled}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหาชื่อผู้ปกครอง, นักเรียน, เบอร์โทร, อีเมล..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                ทุกสาขา
              </div>
            </SelectItem>
            {loadingBranches ? (
              <SelectItem value="loading" disabled>กำลังโหลด...</SelectItem>
            ) : (
              branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {branch.name}
                    <span className="text-xs text-gray-500 ml-1">(เรียน+สนใจ)</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">สถานะเรียนทั้งหมด</SelectItem>
            <SelectItem value="active">มีลูกกำลังเรียน</SelectItem>
            <SelectItem value="completed">จบคอร์สแล้ว</SelectItem>
            <SelectItem value="never">ยังไม่ลงคอร์ส</SelectItem>
          </SelectContent>
        </Select>
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
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 
                 filterBranch !== 'all' ? 'ไม่มีผู้ปกครองในสาขานี้' : 'ยังไม่มีผู้ปกครอง'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'ลองค้นหาด้วยคำค้นอื่น' : 
                 filterBranch !== 'all' ? 'ไม่มีผู้ปกครองที่เรียนหรือสนใจสาขานี้' : 'เริ่มต้นด้วยการเพิ่มผู้ปกครองคนแรก'}
              </p>
              {!searchTerm && filterBranch === 'all' && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href="/parents/new">
                    <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่มผู้ปกครองใหม่
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
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>ชื่อผู้ปกครอง</TableHead>
                      <TableHead>ติดต่อ</TableHead>
                      <TableHead className="text-center">จำนวนลูก</TableHead>
                      <TableHead className="text-center">LINE</TableHead>
                      <TableHead>สาขาที่สะดวก</TableHead>
                      <TableHead>สาขาที่เรียน</TableHead>
                      <TableHead>วันที่ลงทะเบียน</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedParents.map((parent) => (
                      <Fragment key={parent.id}>
                        <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(parent.id)}>
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
                              {parent.pictureUrl ? (
                                <img
                                  src={parent.pictureUrl}
                                  alt={parent.displayName}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{parent.displayName}</p>
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
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3" />
                                  {parent.phone}
                                </div>
                              )}
                              {parent.email && (
                                <div className="flex items-center gap-1 text-sm">
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
                                <div className="text-xs text-gray-500">
                                  (ทั้งหมด {parent.students.length})
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {parent.lineUserId ? (
                              <Badge className="bg-green-100 text-green-700">
                                เชื่อมต่อแล้ว
                              </Badge>
                            ) : (
                              <Badge variant="outline">ยังไม่เชื่อมต่อ</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {loadingBranches ? (
                              <InlineTextSkeleton width="w-24" />
                            ) : parent.preferredBranchId ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline">
                                  {getBranchName(parent.preferredBranchId)}
                                </Badge>
                                <span className="text-xs text-blue-600">สนใจ</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {loadingBranches ? (
                                <BadgeSkeleton />
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
                                  <span className="text-gray-400 text-sm">ยังไม่ลงคอร์ส</span>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(parent.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link href={`/parents/${parent.id}`} onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                                <Link href={`/parents/${parent.id}/edit`} onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </PermissionGuard>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expandable row for students */}
                        {expandedRows.has(parent.id) && parent.students && parent.students.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-gray-50 p-0">
                              <div className="p-4">
                                <h4 className="font-medium text-sm mb-3">ข้อมูลนักเรียน</h4>
                                <div className="space-y-2">
                                  {parent.students.map((student) => (
                                    <div key={student.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                      <div className="flex items-center gap-3">
                                        {student.profileImage ? (
                                          <img
                                            src={student.profileImage}
                                            alt={student.name}
                                            className="w-10 h-10 rounded-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                            <User className="h-5 w-5 text-gray-500" />
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-medium">{student.name}</p>
                                          <div className="flex items-center gap-4 text-sm text-gray-600">
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
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex flex-wrap gap-1">
                                          {loadingBranches ? (
                                            <BadgeSkeleton />
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
                                        </div>
                                        
                                        {student.enrollmentStatus === 'active' ? (
                                          <div className="space-y-1">
                                            <Badge className="bg-green-100 text-green-700 text-xs">
                                              <GraduationCap className="h-3 w-3 mr-1" />
                                              กำลังเรียน
                                            </Badge>
                                            {student.enrollments && student.enrollments.length > 0 && !loadingClasses && (
                                              <div className="text-xs text-gray-600 max-w-[300px]">
                                                {student.enrollments
                                                  .filter(e => e.status === 'active')
                                                  .map(e => getClassInfo(e.classId)?.name || e.classId)
                                                  .join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        ) : student.enrollmentStatus === 'completed' ? (
                                          <Badge className="bg-orange-100 text-orange-700 text-xs">
                                            จบคอร์สแล้ว
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">
                                            ยังไม่ลงคอร์ส
                                          </Badge>
                                        )}
                                        {!student.isActive && (
                                          <Badge variant="destructive" className="text-xs">ไม่ใช้งาน</Badge>
                                        )}
                                        <Link href={`/parents/${parent.id}/students/${student.id}/edit`}>
                                          <Button size="sm" variant="ghost">
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </Link>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="text-right mt-2">
                                    <Link href={`/parents/${parent.id}/students/new`}>
                                      <Button size="sm" variant="outline">
                                        <Plus className="h-4 w-4 mr-2" />
                                        เพิ่มนักเรียน
                                      </Button>
                                    </Link>
                                  </div>
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
    </div>
  );
}
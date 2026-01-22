'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Student, Branch } from '@/types/models';
import { getAllStudentsWithParents, deleteStudent } from '@/lib/services/parents';
import { getActiveBranches } from '@/lib/services/branches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import {
  Search,
  User,
  Cake,
  School,
  Phone,
  AlertCircle,
  Edit,
  Users,
  Globe,
  Loader2,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { calculateAge } from '@/lib/utils';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/permission-guard';
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
import { Skeleton } from '@/components/ui/skeleton';

type StudentWithInfo = Student & { 
  parentName: string; 
  parentPhone: string;
};

// ============================================
// 🎨 Mini Skeleton Components
// ============================================
const TableRowSkeleton = () => (
  <TableRow>
    <TableCell>
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </TableCell>
    <TableCell>
      <div className="space-y-2">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </TableCell>
    <TableCell>
      <Skeleton className="h-4 w-28" />
    </TableCell>
    <TableCell>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </TableCell>
    <TableCell>
      <Skeleton className="h-5 w-12 mx-auto" />
    </TableCell>
    <TableCell>
      <Skeleton className="h-8 w-8 ml-auto" />
    </TableCell>
  </TableRow>
);

// Cache keys
const QUERY_KEYS = {
  students: ['students'],
  branches: ['branches', 'active'],
};

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterAllergy, setFilterAllergy] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  // 🎯 Query 1: Students (Load First - Priority)
  // ============================================
  const { 
    data: students = [], 
    isLoading: loadingStudents,
    isFetching: fetchingStudents
  } = useQuery<StudentWithInfo[]>({
    queryKey: QUERY_KEYS.students,
    queryFn: getAllStudentsWithParents,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // ============================================
  // 🎯 Query 2: Branches (Load After - Optional)
  // ============================================
  const { data: branches = [], isLoading: loadingBranches } = useQuery<Branch[]>({
    queryKey: QUERY_KEYS.branches,
    queryFn: getActiveBranches,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // ============================================
  // 🔍 LOG 2: Students Page - รายละเอียดการนับ
  // ============================================
  useEffect(() => {
    // Debug logs removed
  }, [students, loadingStudents]);

  // Reset page when filters change
  useEffect(() => {
    resetPagination();
  }, [searchTerm, filterGender, filterStatus, filterAllergy, resetPagination]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let filtered = [...students];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchLower) ||
        student.nickname.toLowerCase().includes(searchLower) ||
        student.parentName.toLowerCase().includes(searchLower) ||
        student.schoolName?.toLowerCase().includes(searchLower) ||
        false
      );
    }
    
    if (filterGender !== 'all') {
      filtered = filtered.filter(student => student.gender === filterGender);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(student => 
        filterStatus === 'active' ? student.isActive : !student.isActive
      );
    }
    
    if (filterAllergy !== 'all') {
      filtered = filtered.filter(student => 
        filterAllergy === 'yes' ? !!student.allergies : !student.allergies
      );
    }
    
    return filtered;
  }, [students, searchTerm, filterGender, filterStatus, filterAllergy]);

  // Paginated data
  const paginatedStudents = useMemo(() => {
    return getPaginatedData(filteredStudents);
  }, [filteredStudents, getPaginatedData]);

  // Statistics - นับจากข้อมูลจริง ไม่ขึ้นกับ filter
  const stats = useMemo(() => {
    return {
      total: students.length,
      active: students.filter(s => s.isActive).length,
      inactive: students.filter(s => !s.isActive).length,
      male: students.filter(s => s.gender === 'M').length,
      female: students.filter(s => s.gender === 'F').length,
      withAllergies: students.filter(s => s.allergies).length,
    };
  }, [students]);

  // Delete student handler
  const handleDeleteStudent = async (student: StudentWithInfo) => {
    setDeletingId(student.id);
    try {
      await deleteStudent(student.parentId, student.id);
      toast.success(`ลบนักเรียน "${student.nickname || student.name}" เรียบร้อยแล้ว`);
      // Invalidate all student-related queries
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['parents-with-students-enrollments'] });
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error(error.message || 'ไม่สามารถลบนักเรียนได้');
    } finally {
      setDeletingId(null);
    }
  };

  const calculatedTotalPages = totalPages(filteredStudents.length);

  // ============================================
  // 🎨 Loading States (Progressive - แสดงทีละส่วน)
  // ============================================
  
  // Phase 1: แสดง Header + Cards ก่อนเสมอ
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Globe className="h-8 w-8 text-blue-500" />
          นักเรียนทั้งหมด
        </h1>
        <p className="text-gray-600 mt-2">
          รายชื่อนักเรียนทั้งหมดในระบบ
          {(loadingStudents || fetchingStudents) && (
            <span className="text-orange-500 ml-2">
              (กำลังโหลดข้อมูล...)
            </span>
          )}
        </p>
      </div>

      {/* Summary Cards - แสดงข้อมูลจริงทั้งหมด */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-gray-500 mt-1">
                  ใช้งาน {stats.active} คน • ไม่ใช้งาน {stats.inactive} คน
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักเรียนชาย</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-600">{stats.male}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total > 0 ? ((stats.male / stats.total) * 100).toFixed(0) : 0}%
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักเรียนหญิง</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-pink-600">{stats.female}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total > 0 ? ((stats.female / stats.total) * 100).toFixed(0) : 0}%
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">มีประวัติแพ้</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">{stats.withAllergies}</div>
                <p className="text-xs text-gray-500 mt-1">ต้องระวัง</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters - แสดงทันที */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหาชื่อ, ชื่อเล่น, ผู้ปกครอง, โรงเรียน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={loadingStudents}
          />
        </div>
        
        <Select value={filterGender} onValueChange={setFilterGender} disabled={loadingStudents}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกเพศ</SelectItem>
            <SelectItem value="M">ชาย</SelectItem>
            <SelectItem value="F">หญิง</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterStatus} onValueChange={setFilterStatus} disabled={loadingStudents}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">ใช้งาน</SelectItem>
            <SelectItem value="inactive">ไม่ใช้งาน</SelectItem>
            <SelectItem value="all">ทั้งหมด</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAllergy} onValueChange={setFilterAllergy} disabled={loadingStudents}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกคน</SelectItem>
            <SelectItem value="yes">มีประวัติแพ้</SelectItem>
            <SelectItem value="no">ไม่มีประวัติแพ้</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Students Table - แสดง skeleton หรือข้อมูล */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <span>
                รายชื่อนักเรียน 
                {!loadingStudents && ` (${filteredStudents.length} คน)`}
              </span>
              {fetchingStudents && !loadingStudents && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingStudents ? (
            // แสดง skeleton แค่ใน table เท่านั้น
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">ข้อมูลนักเรียน</TableHead>
                    <TableHead className="w-[120px]">เพศ / อายุ</TableHead>
                    <TableHead className="w-[180px]">โรงเรียน</TableHead>
                    <TableHead className="w-[180px]">ผู้ปกครอง</TableHead>
                    <TableHead className="text-center w-[100px]">ประวัติแพ้</TableHead>
                    <TableHead className="text-right w-[80px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : paginatedStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ไม่พบข้อมูลนักเรียน
              </h3>
              <p className="text-gray-600">
                {searchTerm || filterGender !== 'all' || filterStatus !== 'active' || filterAllergy !== 'all'
                  ? 'ลองปรับเงื่อนไขการค้นหา' 
                  : 'ยังไม่มีนักเรียนในระบบ'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">ข้อมูลนักเรียน</TableHead>
                      <TableHead className="w-[120px]">เพศ / อายุ</TableHead>
                      <TableHead className="w-[180px]">โรงเรียน</TableHead>
                      <TableHead className="w-[180px]">ผู้ปกครอง</TableHead>
                      <TableHead className="text-center w-[100px]">ประวัติแพ้</TableHead>
                      <TableHead className="text-right w-[80px]">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((student) => (
                      <TableRow key={student.id} className={!student.isActive ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            {student.profileImage ? (
                              <img
                                src={student.profileImage}
                                alt={student.name}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <User className="h-6 w-6 text-gray-500" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{student.name}</p>
                              <p className="text-sm text-gray-600 truncate">{student.nickname || '-'}</p>
                              {!student.isActive && (
                                <Badge variant="destructive" className="text-xs mt-1">ไม่ใช้งาน</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge 
                              className={student.gender === 'M' 
                                ? 'bg-blue-100 text-blue-700 text-xs' 
                                : 'bg-pink-100 text-pink-700 text-xs'
                              }
                            >
                              {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                            </Badge>
                            <p className="text-sm flex items-center gap-1">
                              <Cake className="h-3 w-3 text-gray-400" />
                              {calculateAge(student.birthdate)} ปี
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.schoolName ? (
                            <div>
                              <p className="text-sm font-medium flex items-center gap-1" title={student.schoolName}>
                                <School className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{student.schoolName}</span>
                              </p>
                              {student.gradeLevel && (
                                <p className="text-xs text-gray-500 truncate">{student.gradeLevel}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <Link 
                              href={`/parents/${student.parentId}`}
                              className="text-sm font-medium text-blue-600 hover:underline block truncate"
                              title={student.parentName}
                            >
                              {student.parentName}
                            </Link>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{student.parentPhone}</span>
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {student.allergies ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              มี
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/parents/${student.parentId}/students/${student.id}/edit`}>
                              <Button size="sm" variant="ghost">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            {isSuperAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50">
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
                                      onClick={() => handleDeleteStudent(student)}
                                      className="bg-red-500 hover:bg-red-600"
                                      disabled={deletingId === student.id}
                                    >
                                      {deletingId === student.id ? (
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Component */}
              {filteredStudents.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={calculatedTotalPages}
                  pageSize={pageSize}
                  totalItems={filteredStudents.length}
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

      {/* Allergies Details - แสดงเฉพาะเมื่อมีข้อมูลแล้ว */}
      {!loadingStudents && paginatedStudents.some(s => s.allergies) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              รายละเอียดการแพ้อาหาร/ยา (หน้านี้)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paginatedStudents
                .filter(s => s.allergies)
                .map(student => (
                  <div key={student.id} className="flex items-start gap-4 p-3 bg-red-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{student.nickname || student.name}</p>
                      <p className="text-sm text-red-600">แพ้: {student.allergies}</p>
                    </div>
                    {student.specialNeeds && (
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        มีความต้องการพิเศษ
                      </Badge>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
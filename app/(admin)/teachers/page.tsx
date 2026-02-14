'use client';

import { useEffect, useState, useMemo } from 'react';
import { Teacher, Branch, Subject } from '@/types/models';
import { getTeachers } from '@/lib/services/teachers';
import { getActiveBranches } from '@/lib/services/branches';
import { getActiveSubjects } from '@/lib/services/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Phone, Mail, MapPin, BookOpen, Users, Key, Trash2, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { getClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Pagination, usePagination } from '@/components/ui/pagination';

export default function TeachersPage() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const { adminUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginatedData,
    totalPages: calculateTotalPages
  } = usePagination(20);

  useEffect(() => {
    loadData();
  }, [selectedBranchId]); // Reload when branch changes

  const loadData = async () => {
    try {
      const [teachersData, branchesData, subjectsData] = await Promise.all([
        getTeachers(selectedBranchId), // Pass branch filter
        getActiveBranches(),
        getActiveSubjects()
      ]);
      
      setTeachers(teachersData);
      setBranches(branchesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  const getSubject = (subjectId: string) => {
    return subjects.find(s => s.id === subjectId);
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || subjectId;
  };

  // Filter teachers by search term
  const filteredTeachers = useMemo(() => {
    if (!searchTerm) return teachers;
    const search = searchTerm.toLowerCase();
    return teachers.filter(t =>
      t.name.toLowerCase().includes(search) ||
      (t.nickname && t.nickname.toLowerCase().includes(search)) ||
      (t.phone && t.phone.includes(search)) ||
      (t.email && t.email.toLowerCase().includes(search)) ||
      t.specialties.some(id => getSubjectName(id).toLowerCase().includes(search)) ||
      t.availableBranches.some(id => getBranchName(id).toLowerCase().includes(search))
    );
  }, [teachers, searchTerm, getSubjectName, getBranchName]);

  // Paginate filtered data
  const paginatedTeachers = useMemo(() => {
    return getPaginatedData(filteredTeachers);
  }, [filteredTeachers, getPaginatedData]);

  const totalPages = useMemo(() => {
    return calculateTotalPages(filteredTeachers.length);
  }, [filteredTeachers.length, calculateTotalPages]);

  // Reset pagination on search/branch change
  useEffect(() => {
    resetPagination();
  }, [searchTerm, selectedBranchId, resetPagination]);

  const handleResetPassword = async (teacher: Teacher) => {
    if (!confirm(`ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${teacher.email}?`)) return;

    try {
      const supabase = getClient();
      const { error } = await supabase.auth.resetPasswordForEmail(teacher.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      toast.success('ส่งลิงก์รีเซ็ตรหัสผ่านเรียบร้อย');
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งลิงก์');
    }
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (!confirm(
      `คุณแน่ใจหรือไม่ว่าต้องการลบครูผู้สอน "${teacher.name}"?\n\n` +
      `การกระทำนี้จะทำให้ครูไม่สามารถเข้าสู่ระบบได้ แต่ข้อมูลการสอนจะยังคงอยู่ในระบบ\n\n` +
      `(เฉพาะ Super Admin เท่านั้นที่สามารถลบครูได้)`
    )) {
      return;
    }

    setDeletingTeacherId(teacher.id);
    try {
      const response = await fetch(`/api/admin/teachers/${teacher.id}/soft-delete`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        // Reload data to update the list
        await loadData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast.error('เกิดข้อผิดพลาดในการลบครูผู้สอน');
    } finally {
      setDeletingTeacherId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const activeTeachers = teachers.filter(t => t.isActive);
  const totalHourlyRate = activeTeachers.reduce((sum, t) => sum + (t.hourlyRate || 0), 0);
  const avgHourlyRate = activeTeachers.length > 0 ? totalHourlyRate / activeTeachers.length : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            จัดการครูผู้สอน
            {!isAllBranches && (
              <span className="text-red-600 text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>
            )}
          </h1>
          <p className="text-gray-600 mt-2">
            {isAllBranches 
              ? 'จัดการข้อมูลครูผู้สอนทั้งหมด'
              : 'แสดงเฉพาะครูที่สอนในสาขานี้'
            }
          </p>
        </div>
        <PermissionGuard action="create">
          <Link href="/teachers/new">
            <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มครูใหม่
            </ActionButton>
          </Link>
        </PermissionGuard>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ครูทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ครูที่พร้อมสอน</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTeachers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">วิชาที่เปิดสอน</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...new Set(teachers.flatMap(t => t.specialties))].length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ค่าสอนเฉลี่ย/ชม.</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgHourlyRate)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="ค้นหาชื่อ, ชื่อเล่น, เบอร์โทร, อีเมล, วิชา..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            รายชื่อครูผู้สอน
            {searchTerm && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (พบ {filteredTeachers.length} คน)
              </span>
            )}
            {!searchTerm && !isAllBranches && teachers.length > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (ที่สอนในสาขานี้)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTeachers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'ไม่พบครูที่ตรงกับคำค้นหา' : !isAllBranches ? 'ไม่มีครูที่สอนในสาขานี้' : 'ยังไม่มีครูผู้สอน'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'ลองเปลี่ยนคำค้นหาใหม่' : !isAllBranches ? 'ครูจะแสดงเมื่อกำหนดให้สอนในสาขานี้' : 'เริ่มต้นด้วยการเพิ่มครูคนแรก'}
              </p>
              {!searchTerm && isAllBranches && (
                <PermissionGuard action="create">
                  <Link href="/teachers/new">
                    <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่มครูใหม่
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
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>ติดต่อ</TableHead>
                    <TableHead>วิชาที่สอน</TableHead>
                    <TableHead>สาขาที่สอน</TableHead>
                    <TableHead className="text-center">ค่าสอน/ชม.</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTeachers.map((teacher) => (
                    <TableRow key={teacher.id} className={!teacher.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{teacher.name}</p>
                          {teacher.nickname && (
                            <p className="text-sm text-gray-500">({teacher.nickname})</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {teacher.phone}
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {teacher.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacher.specialties.slice(0, 3).map((subjectId) => {
                            const subject = getSubject(subjectId);
                            return (
                              <Badge
                                key={subjectId}
                                className="text-xs border-0"
                                style={{
                                  backgroundColor: subject?.color ? `${subject.color}15` : '#f3f4f6',
                                  color: subject?.color || '#6b7280',
                                  borderLeft: `3px solid ${subject?.color || '#9ca3af'}`
                                }}
                              >
                                {getSubjectName(subjectId)}
                              </Badge>
                            );
                          })}
                          {teacher.specialties.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{teacher.specialties.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {!isAllBranches ? (
                            // ถ้าเลือกสาขาเฉพาะ แสดงแค่ badge ของสาขานั้น
                            <Badge variant="outline" className="text-xs">
                              {getBranchName(selectedBranchId!)}
                            </Badge>
                          ) : (
                            // ถ้าดูทุกสาขา แสดงทุกสาขาที่ครูสอน
                            <>
                              {teacher.availableBranches.slice(0, 2).map((branchId) => (
                                <Badge key={branchId} variant="outline" className="text-xs">
                                  {getBranchName(branchId)}
                                </Badge>
                              ))}
                              {teacher.availableBranches.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{teacher.availableBranches.length - 2}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {teacher.hourlyRate ? formatCurrency(teacher.hourlyRate) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {teacher.isActive ? (
                          <Badge className="bg-green-100 text-green-700">พร้อมสอน</Badge>
                        ) : (
                          <Badge variant="destructive">ไม่พร้อม</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PermissionGuard action="update">
                            <Link href={`/teachers/${teacher.id}/edit`}>
                              <Button variant="ghost" size="sm" title="แก้ไขข้อมูล">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </PermissionGuard>

                          <PermissionGuard action="update">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(teacher)}
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </PermissionGuard>

                          {adminUser?.role === 'super_admin' && teacher.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTeacher(teacher)}
                              disabled={deletingTeacherId === teacher.id}
                              title="ลบครูผู้สอน (Soft Delete)"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {deletingTeacherId === teacher.id ? (
                                <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

              {/* Pagination */}
              {filteredTeachers.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredTeachers.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={[10, 20, 50]}
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
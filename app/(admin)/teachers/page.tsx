'use client';

import { useEffect, useState } from 'react';
import { Teacher, Branch, Subject } from '@/types/models';
import { getTeachers } from '@/lib/services/teachers';
import { getActiveBranches } from '@/lib/services/branches';
import { getActiveSubjects } from '@/lib/services/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Phone, Mail, MapPin, BookOpen, Users, Key } from 'lucide-react';
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

export default function TeachersPage() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || subjectId;
  };

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
          <h1 className="text-3xl font-bold text-gray-900">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            รายชื่อครูผู้สอน
            {!isAllBranches && teachers.length > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (ที่สอนในสาขานี้)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {!isAllBranches ? 'ไม่มีครูที่สอนในสาขานี้' : 'ยังไม่มีครูผู้สอน'}
              </h3>
              <p className="text-gray-600 mb-4">
                {!isAllBranches ? 'ครูจะแสดงเมื่อกำหนดให้สอนในสาขานี้' : 'เริ่มต้นด้วยการเพิ่มครูคนแรก'}
              </p>
              {isAllBranches && (
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
                  {teachers.map((teacher) => (
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
                          {teacher.specialties.slice(0, 3).map((subjectId) => (
                            <Badge key={subjectId} variant="secondary" className="text-xs">
                              {getSubjectName(subjectId)}
                            </Badge>
                          ))}
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
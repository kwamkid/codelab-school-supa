// app/(admin)/data-cleaning/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrphanedStudents,
  getDataCleaningStats,
  deleteOrphanedStudent,
  type OrphanedStudent
} from '@/lib/services/data-cleaning';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertTriangle,
  Trash2,
  User,
  Cake,
  School,
  AlertCircle,
  Database,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { calculateAge } from '@/lib/utils';
import { SectionLoading } from '@/components/ui/loading';
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
} from "@/components/ui/alert-dialog";

export default function DataCleaningPage() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<OrphanedStudent | null>(null);

  // ============================================
  // 🎯 Queries
  // ============================================
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['data-cleaning-stats'],
    queryFn: getDataCleaningStats,
    staleTime: 60000, // 1 minute
  });

  const { data: orphanedStudents = [], isLoading: loadingOrphaned, refetch } = useQuery({
    queryKey: ['orphaned-students'],
    queryFn: getOrphanedStudents,
    staleTime: 60000, // 1 minute
  });

  // ============================================
  // 🗑️ Delete Mutation
  // ============================================
  const deleteMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      deleteOrphanedStudent(parentId, studentId),
    onSuccess: () => {
      toast.success('ลบนักเรียนสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['orphaned-students'] });
      queryClient.invalidateQueries({ queryKey: ['data-cleaning-stats'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    },
    onError: (error: any) => {
      toast.error('เกิดข้อผิดพลาด', {
        description: error.message || 'ไม่สามารถลบนักเรียนได้'
      });
    },
  });

  // ============================================
  // 🎨 Handlers
  // ============================================
  const handleDeleteClick = (student: OrphanedStudent) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (studentToDelete) {
      deleteMutation.mutate({
        parentId: studentToDelete.parentId,
        studentId: studentToDelete.id
      });
    }
  };

  // ============================================
  // 🎨 Loading State
  // ============================================
  if (loadingStats) {
    return <SectionLoading />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Database className="h-8 w-8 text-orange-500" />
          Data Cleaning
        </h1>
        <p className="text-gray-600 mt-1">
          ตรวจสอบและจัดการข้อมูลที่มีปัญหาในระบบ
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              ผู้ปกครองทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalParents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              นักเรียนทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              ข้อมูลปกติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {stats?.validStudents || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Orphaned Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.orphanedStudents || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              Orphaned Makeups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.orphanedMakeups || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orphaned Students Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Orphaned Students ({orphanedStudents.length} รายการ)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loadingOrphaned}
            >
              {loadingOrphaned ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'รีเฟรช'
              )}
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            นักเรียนที่ไม่มีผู้ปกครองในระบบ (อาจเกิดจาก bug หรือการลบผู้ปกครองโดยไม่ตั้งใจ)
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOrphaned ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">กำลังโหลดข้อมูล...</p>
            </div>
          ) : orphanedStudents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ไม่พบข้อมูลที่มีปัญหา
              </h3>
              <p className="text-gray-600">
                ข้อมูลในระบบสะอาดดี ไม่มี orphaned students
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">ข้อมูลนักเรียน</TableHead>
                    <TableHead className="w-[120px]">เพศ / อายุ</TableHead>
                    <TableHead className="w-[180px]">โรงเรียน</TableHead>
                    <TableHead className="w-[150px]">Parent ID</TableHead>
                    <TableHead className="text-center w-[120px]">สถานะ</TableHead>
                    <TableHead className="text-center w-[120px]">ประวัติแพ้</TableHead>
                    <TableHead className="text-right w-[100px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphanedStudents.map((student) => (
                    <TableRow key={student.id} className="bg-orange-50">
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
                            <p className="text-sm text-gray-600 truncate">
                              {student.nickname || '-'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            className={
                              student.gender === 'M'
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
                            <p className="text-sm font-medium flex items-center gap-1">
                              <School className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{student.schoolName}</span>
                            </p>
                            {student.gradeLevel && (
                              <p className="text-xs text-gray-500 truncate">
                                {student.gradeLevel}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {student.parentId.substring(0, 12)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-center">
                        {student.hasEnrollments ? (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            มี Enrollment
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            ลบได้
                          </Badge>
                        )}
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick(student)}
                          disabled={!student.canDelete || deleteMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning Card */}
      {orphanedStudents.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-orange-900">
                  คำเตือน: การลบข้อมูล Orphaned Students
                </p>
                <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                  <li>ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้</li>
                  <li>
                    ระบบจะ<strong>ไม่อนุญาต</strong>ให้ลบนักเรียนที่มีประวัติ Enrollment
                  </li>
                  <li>ควรตรวจสอบข้อมูลให้แน่ใจก่อนลบ</li>
                  <li>
                    แนะนำให้ backup ข้อมูลก่อนทำ Data Cleaning ครั้งใหญ่
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              ยืนยันการลบนักเรียน
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>คุณแน่ใจหรือไม่ที่จะลบนักเรียนคนนี้?</p>
              {studentToDelete && (
                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                  <p className="font-medium">{studentToDelete.name}</p>
                  <p className="text-sm text-gray-600">
                    ชื่อเล่น: {studentToDelete.nickname || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    อายุ: {calculateAge(studentToDelete.birthdate)} ปี
                  </p>
                  {studentToDelete.schoolName && (
                    <p className="text-sm text-gray-600">
                      โรงเรียน: {studentToDelete.schoolName}
                    </p>
                  )}
                </div>
              )}
              <p className="text-red-600 font-medium">
                ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  กำลังลบ...
                </>
              ) : (
                'ยืนยันลบ'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
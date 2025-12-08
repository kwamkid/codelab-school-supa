'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Enrollment, Class, Student, Parent } from '@/types/models';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { getClass } from '@/lib/services/classes';
import { getParent, getStudent } from '@/lib/services/parents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  Users, 
  Search,
  Phone,
  Mail,
  Download,
  Printer,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, calculateAge } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';

interface StudentWithParent extends Student {
  parent?: Parent;
  enrollment?: Enrollment;
}

export default function EnrollmentsByClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { canViewBranch } = useBranch();
  
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<StudentWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    try {
      // Load class data
      const cls = await getClass(classId);
      if (!cls) {
        toast.error('ไม่พบข้อมูลคลาส');
        router.push('/classes');
        return;
      }
      
      // Check if user can view this class's branch
      if (!canViewBranch(cls.branchId)) {
        toast.error('คุณไม่มีสิทธิ์ดูข้อมูลคลาสนี้');
        router.push('/classes');
        return;
      }
      
      setClassData(cls);

      // Load enrollments
      const enrollments = await getEnrollmentsByClass(classId);
      
      // Load student and parent data for each enrollment
      const studentsData: StudentWithParent[] = await Promise.all(
        enrollments.map(async (enrollment) => {
          const [student, parent] = await Promise.all([
            getStudent(enrollment.parentId, enrollment.studentId),
            getParent(enrollment.parentId)
          ]);
          
          return {
            ...student!,
            parent,
            enrollment
          };
        })
      );
      
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(searchLower) ||
      student.nickname.toLowerCase().includes(searchLower) ||
      student.parent?.displayName.toLowerCase().includes(searchLower) ||
      student.parent?.phone?.includes(searchTerm)
    );
  });

  const handlePrintList = () => {
    // TODO: Implement print functionality
    toast.info('ฟังก์ชันพิมพ์รายชื่อจะเพิ่มในภายหลัง');
  };

  const handleExportList = () => {
    // TODO: Implement export functionality
    toast.info('ฟังก์ชันส่งออกรายชื่อจะเพิ่มในภายหลัง');
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

  if (!classData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลคลาส</p>
        <Link href="/classes" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการคลาส
        </Link>
      </div>
    );
  }

  const availableSeats = classData.maxStudents - classData.enrolledCount;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <Link 
          href="/classes" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการคลาส
        </Link>
        
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintList}>
              <Printer className="h-4 w-4 mr-2" />
              พิมพ์รายชื่อ
            </Button>
            <Button variant="outline" onClick={handleExportList}>
              <Download className="h-4 w-4 mr-2" />
              ส่งออก Excel
            </Button>
          </div>
        </PermissionGuard>
      </div>

      {/* Class Info */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{classData.name}</h1>
        <p className="text-gray-600 mt-2">รหัสคลาส: {classData.code}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classData.enrolledCount}</div>
            <p className="text-xs text-gray-500 mt-1">จาก {classData.maxStudents} ที่นั่ง</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ที่นั่งคงเหลือ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${availableSeats === 0 ? 'text-red-600' : 'text-green-600'}`}>
              {availableSeats}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {availableSeats === 0 ? 'เต็มแล้ว' : 'ยังรับได้'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">อัตราการเข้าเรียน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-gray-500 mt-1">จะคำนวณเมื่อเริ่มเรียน</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ช่วงอายุ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.length > 0 
                ? `${Math.min(...students.map(s => calculateAge(s.birthdate)))}-${Math.max(...students.map(s => calculateAge(s.birthdate)))}`
                : '-'
              }
            </div>
            <p className="text-xs text-gray-500 mt-1">ปี</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {classData.enrolledCount < classData.minStudents && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <strong className="text-yellow-800">คำเตือน:</strong> จำนวนนักเรียนยังไม่ถึงขั้นต่ำ 
            (ต้องการอย่างน้อย {classData.minStudents} คน)
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหาชื่อนักเรียน, ผู้ปกครอง, เบอร์โทร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            รายชื่อนักเรียน ({filteredStudents.length} คน)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {students.length === 0 ? 'ยังไม่มีนักเรียนในคลาสนี้' : 'ไม่พบข้อมูลที่ค้นหา'}
              </h3>
              <p className="text-gray-600 mb-4">
                {students.length === 0 
                  ? 'เริ่มต้นด้วยการลงทะเบียนนักเรียน'
                  : 'ลองค้นหาด้วยคำค้นอื่น'
                }
              </p>
              {students.length === 0 && (
                <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                  <Link href="/enrollments/new">
                    <Button className="bg-red-500 hover:bg-red-600">
                      ลงทะเบียนนักเรียน
                    </Button>
                  </Link>
                </PermissionGuard>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ลำดับ</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>ชื่อเล่น</TableHead>
                    <TableHead className="text-center">อายุ</TableHead>
                    <TableHead className="text-center">เพศ</TableHead>
                    <TableHead>ผู้ปกครอง</TableHead>
                    <TableHead>ติดต่อ</TableHead>
                    <TableHead className="text-center">การชำระเงิน</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.nickname}</TableCell>
                      <TableCell className="text-center">{calculateAge(student.birthdate)} ปี</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={student.gender === 'M' ? 'secondary' : 'default'}>
                          {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                        </Badge>
                      </TableCell>
                      <TableCell>{student.parent?.displayName || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {student.parent?.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {student.parent.phone}
                            </div>
                          )}
                          {student.parent?.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {student.parent.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {student.enrollment && (
                          <Badge className={
                            student.enrollment.payment.status === 'paid' 
                              ? 'bg-green-100 text-green-700'
                              : student.enrollment.payment.status === 'partial'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }>
                            {student.enrollment.payment.status === 'paid' 
                              ? 'ชำระแล้ว'
                              : student.enrollment.payment.status === 'partial'
                              ? 'ชำระบางส่วน'
                              : 'รอชำระ'
                            }
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.allergies && (
                          <span className="text-sm text-red-600">แพ้: {student.allergies}</span>
                        )}
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
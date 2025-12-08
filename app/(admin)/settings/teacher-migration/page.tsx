'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Shield, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  UserPlus,
  ChevronLeft,
  Info,
  Play
} from 'lucide-react';
import { getTeachers, syncTeachersToAdminUsers } from '@/lib/services/teachers';
import { getAdminUsers } from '@/lib/services/admin-users';
import { Teacher, AdminUser, MigrationResult } from '@/types/models';
import { toast } from 'sonner';
import Link from 'next/link';

export default function TeacherMigrationPage() {
  const { adminUser, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Check permission
  useEffect(() => {
    if (!isSuperAdmin()) {
      router.push('/dashboard');
    }
  }, [isSuperAdmin, router]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teachersData, adminUsersData] = await Promise.all([
        getTeachers(),
        getAdminUsers()
      ]);
      
      setTeachers(teachersData);
      setAdminUsers(adminUsersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // Check which teachers already have login
  const getTeacherStatus = (teacher: Teacher) => {
    const hasAdminUser = adminUsers.some(
      admin => admin.id === teacher.id && admin.role === 'teacher'
    );
    return {
      hasLogin: hasAdminUser,
      adminUser: adminUsers.find(admin => admin.id === teacher.id)
    };
  };

  // Force create auth users for already migrated teachers
  const forceCreateAuthUsers = async () => {
    if (!confirm('ต้องการสร้าง Firebase Auth account ให้ครูทั้งหมดใช่หรือไม่?\n\nครูจะได้รับ email เพื่อ reset password')) {
      return;
    }

    try {
      setMigrating(true);
      setProgress(0);
      
      // Get all teacher IDs
      const teacherIds = teachers.map(t => t.id);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Get current user token
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No auth token available');
      }
      
      // Call API to create auth users
      const response = await fetch('/api/admin/migrate-teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teacherIds: teacherIds
        })
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create auth users');
      }
      
      const result = await response.json();
      console.log('Auth creation result:', result);
      
      // Show results
      if (result.results.success > 0) {
        toast.success(`สร้าง Auth account สำเร็จ ${result.results.success} คน`);
      }
      
      if (result.results.skipped > 0) {
        toast.info(`มี Auth account อยู่แล้ว ${result.results.skipped} คน`);
      }
      
      if (result.results.failed > 0) {
        toast.error(`ล้มเหลว ${result.results.failed} คน`);
        console.error('Failed teachers:', result.results.details.failed);
      }
      
      // Reload data
      await loadData();
      
    } catch (error) {
      console.error('Force create auth error:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้าง Auth accounts');
    } finally {
      setMigrating(false);
      setProgress(0);
    }
  };

  // Count statistics
  const stats = {
    total: teachers.length,
    withLogin: teachers.filter(t => getTeacherStatus(t).hasLogin).length,
    withoutLogin: teachers.filter(t => !getTeacherStatus(t).hasLogin).length,
    inactive: teachers.filter(t => !t.isActive).length
  };

  // Run migration
  const runMigration = async () => {
    if (!confirm('ต้องการสร้างสิทธิ์การเข้าสู่ระบบให้ครูทั้งหมดที่ยังไม่มีใช่หรือไม่?')) {
      return;
    }

    try {
      setMigrating(true);
      setProgress(0);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await syncTeachersToAdminUsers();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setMigrationResult(result);
      
      if (result.success > 0) {
        toast.success(`สร้างสิทธิ์เข้าสู่ระบบสำเร็จ ${result.success} คน`);
      }
      
      if (result.failed > 0) {
        toast.error(`มีข้อผิดพลาด ${result.failed} คน`);
      }
      
      // Reload data
      await loadData();
      
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('เกิดข้อผิดพลาดในการ migration');
    } finally {
      setMigrating(false);
      setProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            href="/settings" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            กลับหน้าตั้งค่า
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-500" />
            Teacher Login Migration
          </h1>
          <p className="text-gray-600 mt-1">
            สร้างสิทธิ์เข้าสู่ระบบให้ครูที่มีอยู่ในระบบ (Super Admin Only)
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>วิธีการทำงาน</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p>1. ระบบจะตรวจสอบครูทั้งหมดใน Teachers Collection</p>
          <p>2. สร้าง Admin User (role: teacher) ให้ครูที่ยังไม่มีสิทธิ์ login</p>
          <p>3. ใช้ email เดียวกับที่มีในข้อมูลครู (ครูต้อง reset password ครั้งแรก)</p>
          <p>4. หลังจากนี้ครูสามารถ login เข้าระบบได้</p>
        </AlertDescription>
      </Alert>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ครูทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">ในระบบ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">มีสิทธิ์ Login แล้ว</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withLogin}</div>
            <p className="text-xs text-muted-foreground">สามารถเข้าระบบได้</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยังไม่มีสิทธิ์ Login</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.withoutLogin}</div>
            <p className="text-xs text-muted-foreground">ต้องสร้างสิทธิ์</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ไม่ใช้งาน</CardTitle>
            <XCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">ปิดการใช้งาน</p>
          </CardContent>
        </Card>
      </div>

      {/* Migration Button */}
      {stats.withoutLogin > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>เริ่มการ Migration</CardTitle>
            <CardDescription>
              พบครูที่ยังไม่มีสิทธิ์เข้าสู่ระบบ {stats.withoutLogin} คน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {migrating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>กำลังดำเนินการ...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            
            <Button 
              onClick={runMigration}
              disabled={migrating}
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600"
            >
              {migrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  เริ่ม Migration ({stats.withoutLogin} คน)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Force Create Auth Users Button (for already migrated) */}
      {stats.withLogin > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-orange-700">สร้าง Firebase Auth Users</CardTitle>
            <CardDescription>
              สำหรับครูที่มี adminUser แล้วแต่ยังไม่มี Firebase Auth account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                ใช้ในกรณีที่ migrate ไปแล้วแต่ยังไม่มี Firebase Auth User
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={forceCreateAuthUsers}
              disabled={migrating}
              variant="outline"
              className="w-full sm:w-auto border-orange-500 text-orange-700 hover:bg-orange-50"
            >
              {migrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังสร้าง Auth Users...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  สร้าง Auth Users ให้ครูทั้งหมด
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Migration Result */}
      {migrationResult && (
        <Alert className={migrationResult.failed > 0 ? 'border-orange-200' : 'border-green-200'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ผลการ Migration</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>✅ สำเร็จ: {migrationResult.success} คน</p>
            {migrationResult.failed > 0 && (
              <>
                <p>❌ ล้มเหลว: {migrationResult.failed} คน</p>
                {migrationResult.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-600">- {error}</p>
                ))}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายชื่อครูทั้งหมด</CardTitle>
          <CardDescription>
            แสดงสถานะการมีสิทธิ์เข้าสู่ระบบของครูแต่ละคน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อครู</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>สาขา</TableHead>
                <TableHead>สถานะครู</TableHead>
                <TableHead>สิทธิ์ Login</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => {
                const status = getTeacherStatus(teacher);
                return (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{teacher.name}</div>
                        {teacher.nickname && (
                          <div className="text-sm text-gray-500">({teacher.nickname})</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{teacher.email}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {teacher.availableBranches.length} สาขา
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={teacher.isActive ? 'default' : 'secondary'}>
                        {teacher.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {status.hasLogin ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          มีสิทธิ์แล้ว
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          ยังไม่มีสิทธิ์
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {status.hasLogin && (
                        <Link href="/users">
                          <Button variant="ghost" size="sm">
                            จัดการ
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {teachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    ไม่พบข้อมูลครู
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>หลังจาก Migration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="font-medium">ครูจะสามารถ login ได้ด้วย:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
              <li>Email: ใช้ email ที่มีในระบบ</li>
              <li>Password: ต้องทำการ reset password ก่อนใช้งานครั้งแรก</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <p className="font-medium">ขั้นตอนสำหรับครู:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 ml-4">
              <li>ไปที่หน้า Login</li>
              <li>คลิก "ลืมรหัสผ่าน"</li>
              <li>กรอก email และรับลิงก์ reset password</li>
              <li>ตั้งรหัสผ่านใหม่</li>
              <li>Login ด้วย email และรหัสผ่านใหม่</li>
            </ol>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              หมายเหตุ: ครูที่ถูกสร้างใหม่หลังจากนี้จะมีสิทธิ์ login อัตโนมัติ (ใช้ Dual Creation System)
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
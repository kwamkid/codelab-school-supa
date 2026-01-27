'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  Building2,
  BookOpen,
  DollarSign,
  CreditCard,
  Key,
  Edit,
  Loader2,
  Shield,
  UserCog
} from 'lucide-react';
import { getTeacher } from '@/lib/services/teachers';
import { getBranches } from '@/lib/services/branches';
import { getSubjects } from '@/lib/services/subjects';
import { Teacher, Branch, Subject } from '@/types/models';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const { user, adminUser } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && adminUser) {
      loadData();
    }
  }, [user, adminUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // ถ้าเป็น teacher โหลดข้อมูล teacher
      if (adminUser?.role === 'teacher') {
        const teacherData = await getTeacher(user!.uid);
        if (teacherData) {
          setTeacher(teacherData);
        }
      }

      // Load branches and subjects for display
      const [branchesData, subjectsData] = await Promise.all([
        getBranches(),
        getSubjects()
      ]);
      
      setBranches(branchesData);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBranchNames = (branchIds: string[]) => {
    return branchIds
      .map(id => branches.find(b => b.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const getSubjectNames = (subjectIds: string[]) => {
    return subjectIds
      .map(id => subjects.find(s => s.id === id)?.name)
      .filter(Boolean);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-3 w-3" />;
      case 'branch_admin':
        return <Building2 className="h-3 w-3" />;
      case 'teacher':
        return <UserCog className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'branch_admin':
        return 'Branch Admin';
      case 'teacher':
        return 'ครูผู้สอน';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-500" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // ถ้าไม่ใช่ teacher แสดงข้อมูล admin
  if (!teacher && adminUser?.role !== 'teacher') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">โปรไฟล์ของฉัน</h1>
            <p className="text-gray-600 mt-1">ข้อมูลส่วนตัวและการตั้งค่า</p>
          </div>
        </div>

        {/* Admin Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.photoURL || ''} />
                  <AvatarFallback className="text-2xl">
                    {adminUser?.displayName?.charAt(0) || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{adminUser?.displayName}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {getRoleIcon(adminUser?.role || '')}
                      <span className="ml-1">{getRoleDisplay(adminUser?.role || '')}</span>
                    </Badge>
                    {adminUser?.isActive ? (
                      <Badge className="bg-green-100 text-green-700">
                        ใช้งานอยู่
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        ระงับการใช้งาน
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลติดต่อ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">อีเมล</p>
                <p className="font-medium">{adminUser?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลการทำงาน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminUser?.branchIds && adminUser.branchIds.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <p className="text-sm text-gray-500">สาขาที่ดูแล</p>
                </div>
                <p className="font-medium">
                  {adminUser.branchIds.length === 0 ? 'ทุกสาขา' : getBranchNames(adminUser.branchIds)}
                </p>
              </div>
            )}

            {adminUser?.permissions && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-gray-400" />
                  <p className="text-sm text-gray-500">สิทธิ์พิเศษ</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {adminUser.permissions.canManageUsers && (
                    <Badge variant="outline">จัดการผู้ใช้</Badge>
                  )}
                  {adminUser.permissions.canManageSettings && (
                    <Badge variant="outline">จัดการตั้งค่า</Badge>
                  )}
                  {adminUser.permissions.canViewReports && (
                    <Badge variant="outline">ดูรายงาน</Badge>
                  )}
                  {adminUser.permissions.canManageAllBranches && (
                    <Badge variant="outline">จัดการทุกสาขา</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle>การตั้งค่าบัญชี</CardTitle>
            <CardDescription>จัดการความปลอดภัยและการเข้าถึงบัญชีของคุณ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">รหัสผ่าน</p>
                    <p className="text-sm text-gray-500">เปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบ</p>
                  </div>
                </div>
                <Link href="/profile/change-password">
                  <Button variant="outline" size="sm">
                    เปลี่ยนรหัสผ่าน
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">เข้าร่วมเมื่อ</p>
                    <p className="text-sm text-gray-500">
                      {adminUser?.createdAt ? formatDate(adminUser.createdAt, 'long') : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ถ้าเป็น teacher และไม่มีข้อมูล
  if (!teacher && adminUser?.role === 'teacher') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลครู</p>
      </div>
    );
  }

  // แสดงข้อมูล Teacher
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold">โปรไฟล์ของฉัน</h1>
          <p className="text-gray-600 mt-1">ข้อมูลส่วนตัวและการตั้งค่า</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={teacher!.profileImage} />
                <AvatarFallback className="text-2xl">
                  {teacher!.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{teacher!.name}</CardTitle>
                {teacher!.nickname && (
                  <p className="text-gray-600">({teacher!.nickname})</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">
                    <User className="h-3 w-3 mr-1" />
                    ครูผู้สอน
                  </Badge>
                  {teacher!.isActive ? (
                    <Badge className="bg-green-100 text-green-700">
                      พร้อมสอน
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      ไม่พร้อมสอน
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลติดต่อ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">อีเมล</p>
              <p className="font-medium">{teacher!.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">เบอร์โทรศัพท์</p>
              <p className="font-medium">{teacher!.phone}</p>
            </div>
          </div>

          {teacher!.lineUserId && (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">
                L
              </div>
              <div>
                <p className="text-sm text-gray-500">LINE ID</p>
                <p className="font-medium">{teacher!.lineUserId}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teaching Information */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการสอน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-gray-400" />
              <p className="text-sm text-gray-500">วิชาที่สอน</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {getSubjectNames(teacher!.specialties).map((subject, index) => (
                <Badge key={index} variant="secondary">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <p className="text-sm text-gray-500">สาขาที่สอน</p>
            </div>
            <p className="font-medium">{getBranchNames(teacher!.availableBranches)}</p>
          </div>

          {teacher!.hourlyRate && teacher!.hourlyRate > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <p className="text-sm text-gray-500">ค่าสอนต่อชั่วโมง</p>
              </div>
              <p className="font-medium">{formatCurrency(teacher!.hourlyRate)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank Account */}
      {teacher!.bankAccount && (teacher!.bankAccount.bankName || teacher!.bankAccount.accountNumber) && (
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลบัญชีธนาคาร</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                {teacher!.bankAccount.bankName && (
                  <p className="font-medium">{teacher!.bankAccount.bankName}</p>
                )}
                {teacher!.bankAccount.accountNumber && (
                  <p className="text-sm text-gray-600">
                    เลขบัญชี: {teacher!.bankAccount.accountNumber}
                  </p>
                )}
                {teacher!.bankAccount.accountName && (
                  <p className="text-sm text-gray-600">
                    ชื่อบัญชี: {teacher!.bankAccount.accountName}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>การตั้งค่าบัญชี</CardTitle>
          <CardDescription>จัดการความปลอดภัยและการเข้าถึงบัญชีของคุณ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium">รหัสผ่าน</p>
                  <p className="text-sm text-gray-500">เปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบ</p>
                </div>
              </div>
              <Link href="/profile/change-password">
                <Button variant="outline" size="sm">
                  เปลี่ยนรหัสผ่าน
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium">เข้าร่วมเมื่อ</p>
                  <p className="text-sm text-gray-500">
                    {teacher!.createdAt ? formatDate(teacher!.createdAt, 'long') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note for Edit */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-800">
            <span className="font-medium">หมายเหตุ:</span> หากต้องการแก้ไขข้อมูลส่วนตัวหรือข้อมูลการสอน 
            กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
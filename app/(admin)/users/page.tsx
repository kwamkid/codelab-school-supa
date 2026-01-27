'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  Plus, 
  Search, 
  MoreHorizontal,
  Edit,
  Key,
  Ban,
  CheckCircle,
  Loader2,
  Users,
  Building2,
  Trash2,
  ShieldAlert,
  UserCog,
  ChevronLeft
} from 'lucide-react';
import { AdminUser } from '@/types/models';
import { getAdminUsers, updateAdminUser, sendPasswordReset, deleteAdminUser } from '@/lib/services/admin-users';
import { getBranches } from '@/lib/services/branches';
import { Branch } from '@/types/models';
import { toast } from 'sonner';
import UserFormDialog from '@/components/users/user-form-dialog';
import AddRightsDialog from '@/components/users/add-rights-dialog';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UsersPage() {
  const { adminUser, isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddRightsDialog, setShowAddRightsDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Check permission - redirect หลังจาก auth loading เสร็จ
  useEffect(() => {
    if (!authLoading && !isSuperAdmin()) {
      // Delay เล็กน้อยเพื่อให้ user เห็นหน้าก่อน redirect
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isSuperAdmin, router]);

  // Load data only if has permission
  useEffect(() => {
    if (!authLoading && isSuperAdmin()) {
      loadData();
    }
  }, [authLoading, isSuperAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, branchesData] = await Promise.all([
        getAdminUsers(),
        getBranches()
      ]);
      setUsers(usersData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await updateAdminUser(
        user.id,
        { isActive: !user.isActive },
        adminUser?.id || ''
      );
      
      toast.success(user.isActive ? 'ระงับการใช้งานเรียบร้อย' : 'เปิดใช้งานเรียบร้อย');
      await loadData();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    if (!confirm(`ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${user.email}?`)) return;
    
    try {
      await sendPasswordReset(user.email);
      toast.success('ส่งลิงก์รีเซ็ตรหัสผ่านเรียบร้อย');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งลิงก์');
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (user.id === adminUser?.id) {
      toast.error('ไม่สามารถลบตัวเองได้');
      return;
    }

    if (!confirm(`ต้องการลบผู้ใช้ ${user.displayName} (${user.email}) ใช่หรือไม่?\n\nการลบจะไม่สามารถยกเลิกได้`)) {
      return;
    }
    
    try {
      await deleteAdminUser(user.id, adminUser?.id || '');
      toast.success('ลบผู้ใช้งานเรียบร้อย');
      await loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('เกิดข้อผิดพลาดในการลบผู้ใช้');
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    // ไม่แสดง user ที่ถูกลบ
    if ((user as any).isDeleted) return false;
    
    // Filter by status
    if (statusFilter === 'active' && !user.isActive) return false;
    if (statusFilter === 'inactive' && user.isActive) return false;
    
    // Filter by search term
    const search = searchTerm.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
  });

  // Get role display
  const getRoleDisplay = (role: string) => {
    const roleMap = {
      'super_admin': 'Super Admin',
      'branch_admin': 'Branch Admin',
      'teacher': 'Teacher'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  // Get role color
  const getRoleColor = (role: string) => {
    const colorMap = {
      'super_admin': 'destructive',
      'branch_admin': 'default',
      'teacher': 'secondary'
    };
    return colorMap[role as keyof typeof colorMap] as any || 'default';
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-3 w-3" />;
      case 'branch_admin':
        return <Building2 className="h-3 w-3" />;
      case 'teacher':
        return <UserCog className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Get branch names
  const getBranchNames = (branchIds: string[]) => {
    if (!branchIds || branchIds.length === 0) return 'ทุกสาขา';
    
    const branchNames = branchIds
      .map(id => branches.find(b => b.id === id)?.name)
      .filter(Boolean);
    
    if (branchNames.length === 0) return 'ทุกสาขา';
    if (branchNames.length === branches.length) return 'ทุกสาขา';
    
    return branchNames.join(', ');
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mx-auto" />
          <p className="mt-4 text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not super admin
  if (!isSuperAdmin()) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เข้าถึง</AlertTitle>
          <AlertDescription className="mt-2">
            เฉพาะ Super Admin เท่านั้นที่สามารถจัดการผู้ใช้งานได้
          </AlertDescription>
        </Alert>

        <div className="text-center space-y-4">
          <p className="text-gray-600">
            หากคุณต้องการจัดการผู้ใช้งาน กรุณาติดต่อ Super Admin
          </p>
          
          <Link href="/dashboard">
            <Button variant="outline">
              <ChevronLeft className="h-4 w-4 mr-2" />
              กลับหน้า Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show loading data
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-500" />
            จัดการผู้ใช้งาน
          </h1>
          <p className="text-gray-600 mt-1">จัดการผู้ใช้งานและสิทธิ์การเข้าถึง (Super Admin Only)</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-red-500 hover:bg-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มผู้ใช้งาน
          </Button>
          
       
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              ใช้งาน {users.filter(u => u.isActive).length} คน
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ระงับการใช้งาน</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {users.filter(u => !u.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              ไม่สามารถเข้าใช้งานได้
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admin</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.role === 'super_admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              มีสิทธิ์สูงสุดในระบบ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branch Admin</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(u => u.role === 'branch_admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              จัดการเฉพาะสาขา
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="ค้นหาชื่อหรืออีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="active">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    ใช้งานอยู่
                  </span>
                </SelectItem>
                <SelectItem value="inactive">
                  <span className="flex items-center gap-2">
                    <Ban className="h-3 w-3 text-orange-600" />
                    ถูกระงับ
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Show count */}
            <div className="text-sm text-gray-500">
              แสดง {filteredUsers.length} จาก {users.length} คน
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ใช้งาน</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>สาขา</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>เข้าใช้งานล่าสุด</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? 'bg-gray-50' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleColor(user.role)}>
                      <span className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {getRoleDisplay(user.role)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {getBranchNames(user.branchIds)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          ใช้งาน
                        </>
                      ) : (
                        <>
                          <Ban className="h-3 w-3 mr-1" />
                          ระงับ
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {user.updatedAt ? formatDate(user.updatedAt, 'short') : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setEditingUser(user);
                            setShowCreateDialog(true);
                          }}
                          disabled={user.id === adminUser?.id}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          แก้ไขข้อมูล
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleResetPassword(user)}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          รีเซ็ตรหัสผ่าน
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleToggleActive(user)}
                          disabled={user.id === adminUser?.id}
                          className={user.isActive ? 'text-orange-600' : ''}
                        >
                          {user.isActive ? (
                            <>
                              <Ban className="h-4 w-4 mr-2" />
                              ระงับการใช้งาน
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              เปิดใช้งาน
                            </>
                          )}
                        </DropdownMenuItem>
                        
                        {/* Delete button - ไม่สามารถลบ super admin */}
                        <DropdownMenuItem 
                          onClick={() => handleDelete(user)}
                          disabled={user.id === adminUser?.id || user.role === 'super_admin'}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          ลบผู้ใช้งาน
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'ไม่พบผู้ใช้งานที่ค้นหา' : 'ยังไม่มีผู้ใช้งาน'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <UserFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setEditingUser(null);
        }}
        user={editingUser}
        branches={branches}
        onSuccess={loadData}
      />

      {/* Add Rights Dialog */}
      <AddRightsDialog
        open={showAddRightsDialog}
        onOpenChange={setShowAddRightsDialog}
        branches={branches}
        onSuccess={loadData}
      />
    </div>
  );
}
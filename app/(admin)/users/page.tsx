'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead, useSortableTable } from '@/components/ui/sortable-table-head';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  Plus,
  MoreHorizontal,
  Edit,
  Key,
  Ban,
  CheckCircle,
  Users,
  Building2,
  Trash2,
  ShieldAlert,
  UserCog,
  ChevronLeft,
  ChevronDown
} from 'lucide-react';
import { SectionLoading } from '@/components/ui/loading';
import { AdminUser } from '@/types/models';
import { getAllAdminUsers, updateAdminUser, sendPasswordReset, deleteAdminUser } from '@/lib/services/admin-users';
import { getBranches } from '@/lib/services/branches';
import { Branch } from '@/types/models';
import { toast } from 'sonner';
import UserFormDialog from '@/components/users/user-form-dialog';
import CreateInviteDialog from '@/components/users/create-invite-dialog';
import { formatDate, cn } from '@/lib/utils';
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
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'branch_admin' | 'teacher'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteRole, setInviteRole] = useState<'super_admin' | 'branch_admin' | 'teacher'>('branch_admin');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null);
  const [toggleUserTarget, setToggleUserTarget] = useState<AdminUser | null>(null);

  // Check permission - redirect หลังจาก auth loading เสร็จ และ adminUser โหลดแล้ว
  useEffect(() => {
    if (!authLoading && adminUser && !isSuperAdmin()) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, adminUser, isSuperAdmin, router]);

  // Load data only if has permission
  useEffect(() => {
    if (!authLoading && adminUser && isSuperAdmin()) {
      loadData();
    }
  }, [authLoading, adminUser, isSuperAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, branchesData] = await Promise.all([
        getAllAdminUsers(),
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

  const handleResetPasswordConfirm = async (user: AdminUser) => {
    try {
      await sendPasswordReset(user.email);
      toast.success('ส่งลิงก์รีเซ็ตรหัสผ่านเรียบร้อย');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งลิงก์');
    }
  };

  const handleDelete = (user: AdminUser) => {
    if (user.id === adminUser?.id) {
      toast.error('ไม่สามารถลบตัวเองได้');
      return;
    }
    setDeleteUserTarget(user);
  };

  const handleDeleteConfirm = async (user: AdminUser) => {
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
  // Only count/show users who have actually completed Google sign-in at least
  // once. An invited-but-not-yet-registered account has a row but no login, and
  // shouldn't appear in the list or the stat cards.
  const registeredUsers = users.filter(
    (user) => !(user as any).isDeleted && !!user.lastLoginAt
  );

  const filteredUsers = registeredUsers.filter(user => {
    // Filter by status
    if (statusFilter === 'active' && !user.isActive) return false;
    if (statusFilter === 'inactive' && user.isActive) return false;

    // Filter by role
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;

    // Filter by branch (empty branchIds = all branches → always matches)
    if (branchFilter !== 'all') {
      const coversAll = user.branchIds.length === 0;
      if (!coversAll && !user.branchIds.includes(branchFilter)) return false;
    }

    // Filter by search term
    const search = searchTerm.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(search) ||
      (user.nickname || '').toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
  });

  // Column sorting (shared)
  const { sort, toggle: toggleSort, sortRows } = useSortableTable();
  const roleRank: Record<string, number> = { super_admin: 0, branch_admin: 1, teacher: 2 };
  const sortedUsers = sortRows(filteredUsers, (user, key) => {
    switch (key) {
      case 'role': return roleRank[user.role] ?? 99;
      case 'lastLogin': return user.lastLoginAt ? user.lastLoginAt.getTime() : null; // null → ยังไม่เคยเข้าใช้ ไปท้ายสุด
      default: return null;
    }
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

  // Get role badge color classes (distinct color per role)
  const getRoleBadgeClass = (role: string) => {
    const map: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
      branch_admin: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
      teacher: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
    };
    return map[role] || 'bg-gray-100 text-gray-700 border-gray-200';
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
    return <SectionLoading text="กำลังตรวจสอบสิทธิ์..." />;
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
    return <SectionLoading />;
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-red-500 hover:bg-red-600">
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มผู้ใช้งาน
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>สร้างลิงก์เชิญสำหรับ</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setInviteRole('super_admin'); setShowInviteDialog(true); }}>
                <Shield className="h-4 w-4 mr-2 text-red-500" />
                Super Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setInviteRole('branch_admin'); setShowInviteDialog(true); }}>
                <Building2 className="h-4 w-4 mr-2 text-blue-500" />
                Branch Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setInviteRole('teacher'); setShowInviteDialog(true); }}>
                <UserCog className="h-4 w-4 mr-2 text-green-500" />
                ครูผู้สอน
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards — full-colour */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'ผู้ใช้ทั้งหมด', value: registeredUsers.length, sub: `ใช้งาน ${registeredUsers.filter(u => u.isActive).length} คน`, Icon: Users, bg: 'bg-gradient-to-br from-gray-700 to-gray-900' },
          { label: 'Super Admin', value: registeredUsers.filter(u => u.role === 'super_admin').length, sub: 'มีสิทธิ์สูงสุดในระบบ', Icon: Shield, bg: 'bg-gradient-to-br from-red-500 to-red-600' },
          { label: 'Branch Admin', value: registeredUsers.filter(u => u.role === 'branch_admin').length, sub: 'จัดการเฉพาะสาขา', Icon: Building2, bg: 'bg-gradient-to-br from-blue-500 to-blue-600' },
          { label: 'ครูผู้สอน', value: registeredUsers.filter(u => u.role === 'teacher').length, sub: 'เข้าถึงเมนูฝั่งครู', Icon: UserCog, bg: 'bg-gradient-to-br from-green-500 to-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl p-4 text-white shadow-sm', stat.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">{stat.label}</span>
              <stat.Icon className="h-5 w-5 text-white/80" />
            </div>
            <div className="text-3xl font-bold mt-2">{stat.value}</div>
            <p className="text-xs text-white/80 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <SearchInput
              placeholder="ค้นหาชื่อหรืออีเมล..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="flex-1 max-w-sm"
            />
            
            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="บทบาท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกบทบาท</SelectItem>
                <SelectItem value="super_admin">
                  <span className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-red-500" />
                    Super Admin
                  </span>
                </SelectItem>
                <SelectItem value="branch_admin">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-blue-500" />
                    Branch Admin
                  </span>
                </SelectItem>
                <SelectItem value="teacher">
                  <span className="flex items-center gap-2">
                    <UserCog className="h-3 w-3 text-green-500" />
                    ครูผู้สอน
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Branch Filter */}
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="สาขา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสาขา</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
              แสดง {filteredUsers.length} จาก {registeredUsers.length} คน
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ใช้งาน</TableHead>
                <SortableTableHead sortKey="role" currentSort={sort} onSort={toggleSort}>Role</SortableTableHead>
                <TableHead>สาขา</TableHead>
                <TableHead>สถานะ</TableHead>
                <SortableTableHead sortKey="lastLogin" currentSort={sort} onSort={toggleSort}>เข้าใช้งานล่าสุด</SortableTableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? 'bg-gray-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-gray-200">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                        ) : null}
                        <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-semibold">
                          {(user.displayName || user.email).trim().slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {user.displayName}
                          {user.nickname && (
                            <span className="text-gray-500 font-normal"> ({user.nickname})</span>
                          )}
                        </div>
                        <div className="text-gray-500 truncate">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getRoleBadgeClass(user.role)}>
                      <span className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {getRoleDisplay(user.role)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
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
                    <div className="text-gray-500">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt, 'short') : 'ยังไม่เคยเข้าใช้'}
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
                          onClick={() => setResetPasswordUser(user)}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          รีเซ็ตรหัสผ่าน
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setToggleUserTarget(user)}
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

      {/* Create Invite Dialog (replaces email/password creation) */}
      <CreateInviteDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        branches={branches}
        initialRole={inviteRole}
      />

      {/* Edit Dialog */}
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

      {/* Reset Password Confirmation Dialog */}
      <AlertDialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>รีเซ็ตรหัสผ่าน</AlertDialogTitle>
            <AlertDialogDescription>
              ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ {resetPasswordUser?.email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetPasswordUser) {
                  handleResetPasswordConfirm(resetPasswordUser);
                }
              }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle (ระงับ/เปิดใช้งาน) Confirmation Dialog */}
      <AlertDialog open={!!toggleUserTarget} onOpenChange={(open) => !open && setToggleUserTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleUserTarget?.isActive ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUserTarget?.isActive
                ? `ต้องการระงับการใช้งานของ ${toggleUserTarget?.displayName} (${toggleUserTarget?.email}) ใช่หรือไม่? ผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง`
                : `ต้องการเปิดใช้งานของ ${toggleUserTarget?.displayName} (${toggleUserTarget?.email}) ใช่หรือไม่?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className={toggleUserTarget?.isActive ? 'bg-orange-600 hover:bg-orange-700' : ''}
              onClick={() => {
                if (toggleUserTarget) {
                  const target = toggleUserTarget;
                  setToggleUserTarget(null);
                  handleToggleActive(target);
                }
              }}
            >
              {toggleUserTarget?.isActive ? 'ระงับ' : 'เปิดใช้งาน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUserTarget} onOpenChange={(open) => !open && setDeleteUserTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบผู้ใช้งาน</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบผู้ใช้ {deleteUserTarget?.displayName} ({deleteUserTarget?.email}) ใช่หรือไม่?
              <br /><br />
              การลบจะไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteUserTarget) {
                  handleDeleteConfirm(deleteUserTarget);
                }
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
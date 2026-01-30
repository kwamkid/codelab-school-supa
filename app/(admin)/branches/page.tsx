'use client';

import { useEffect, useState } from 'react';
import { Branch } from '@/types/models';
import { getBranches, toggleBranchStatus } from '@/lib/services/branches';
import { getRoomCount } from '@/lib/services/rooms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Building2, 
  Phone, 
  MapPin, 
  Clock, 
  Edit, 
  UserCog,
  Calendar,
  School,
  ToggleLeft,
  ToggleRight,
  Search,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
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
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { useAuth } from '@/hooks/useAuth';

interface BranchWithStats extends Branch {
  roomCount?: number;
}

const DAYS_MAP: { [key: number]: string } = {
  0: 'อา',
  1: 'จ',
  2: 'อ',
  3: 'พ',
  4: 'พฤ',
  5: 'ศ',
  6: 'ส',
};

export default function BranchesPage() {
  const { adminUser, isSuperAdmin, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load first and adminUser to be available
    if (authLoading || !adminUser) return;

    // Check if user is super admin
    if (!isSuperAdmin()) {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      window.location.href = '/dashboard';
      return;
    }

    loadBranches();
  }, [isSuperAdmin, authLoading, adminUser]);

  const loadBranches = async () => {
    try {
      const branchesData = await getBranches();
      
      // Load room counts for each branch
      const branchesWithStats = await Promise.all(
        branchesData.map(async (branch) => {
          const roomCount = await getRoomCount(branch.id);
          return { ...branch, roomCount };
        })
      );
      
      setBranches(branchesWithStats);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (branchId: string, currentStatus: boolean) => {
    setTogglingId(branchId);
    try {
      await toggleBranchStatus(branchId, !currentStatus);
      toast.success(`${currentStatus ? 'ปิด' : 'เปิด'}การใช้งานสาขาเรียบร้อยแล้ว`);
      loadBranches();
    } catch (error) {
      console.error('Error toggling branch status:', error);
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.phone.includes(searchTerm)
  );

  const formatOpenDays = (days?: number[]) => {
    if (!days || days.length === 0) return 'ไม่ระบุ';
    if (days.length === 7) return 'ทุกวัน';

    const sortedDays = [...days].sort((a, b) => a - b);
    return sortedDays.map(day => DAYS_MAP[day]).join(', ');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // Statistics
  const activeBranches = branches.filter(b => b.isActive).length;
  const totalRooms = branches.reduce((sum, b) => sum + (b.roomCount || 0), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">จัดการสาขา</h1>
          <p className="text-gray-600 mt-2">จัดการข้อมูลสาขาและห้องเรียน</p>
        </div>
        <PermissionGuard requiredRole={['super_admin']}>
          <Link href="/branches/new">
            <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มสาขาใหม่
            </ActionButton>
          </Link>
        </PermissionGuard>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">สาขาทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branches.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">สาขาที่เปิด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeBranches}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">สาขาที่ปิด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{branches.length - activeBranches}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ห้องเรียนทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRooms}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="ค้นหาสาขา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branches Grid */}
      {filteredBranches.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {branches.length === 0 ? 'ยังไม่มีสาขา' : 'ไม่พบสาขาที่ค้นหา'}
            </h3>
            <p className="text-gray-600 mb-4">
              {branches.length === 0 ? 'เริ่มต้นด้วยการเพิ่มสาขาแรก' : 'ลองค้นหาด้วยคำค้นอื่น'}
            </p>
            {branches.length === 0 && (
              <PermissionGuard requiredRole={['super_admin']}>
                <Link href="/branches/new">
                  <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มสาขาใหม่
                  </ActionButton>
                </Link>
              </PermissionGuard>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((branch) => (
            <Card key={branch.id} className={!branch.isActive ? 'opacity-75' : ''}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{branch.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">รหัส: {branch.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PermissionGuard requiredRole={['super_admin']}>
                      <Link href={`/branches/${branch.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    </PermissionGuard>
                    
                    <PermissionGuard requiredRole={['super_admin']}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            disabled={togglingId === branch.id}
                          >
                            {branch.isActive ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {branch.isActive ? 'ปิดการใช้งานสาขา' : 'เปิดการใช้งานสาขา'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              คุณแน่ใจหรือไม่ที่จะ{branch.isActive ? 'ปิด' : 'เปิด'}การใช้งานสาขา {branch.name}?
                              {branch.isActive && ' การปิดสาขาจะทำให้ไม่สามารถสร้างคลาสใหม่ในสาขานี้ได้'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleToggleStatus(branch.id, branch.isActive)}
                              className={branch.isActive ? 'bg-red-500 hover:bg-red-600' : ''}
                            >
                              {branch.isActive ? 'ปิดสาขา' : 'เปิดสาขา'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </PermissionGuard>
                    
                    {branch.isActive ? (
                      <Badge className="bg-green-100 text-green-700">เปิด</Badge>
                    ) : (
                      <Badge variant="secondary">ปิด</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Room count with warning */}
                {branch.roomCount === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium">ยังไม่มีห้องเรียน</span>
                    </div>
                    <Link href={`/rooms?branch=${branch.id}`}>
                      <Button size="sm" variant="outline" className="w-full">
                        <Plus className="h-3 w-3 mr-1" />
                        เพิ่มห้องเรียน
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Link href={`/branches/${branch.id}/rooms`}>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <School className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium">ห้องเรียน</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{branch.roomCount} ห้อง</span>
                    </div>
                  </Link>
                )}

                {/* Contact Info */}
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    {branch.phone}
                  </div>
                  <div className="flex items-start text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                    <span className="text-gray-600 line-clamp-2">{branch.address}</span>
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center text-sm">
                    <Clock className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-gray-600">{branch.openTime || '09:00'} - {branch.closeTime || '18:00'}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-gray-600">{formatOpenDays(branch.openDays)}</span>
                  </div>
                </div>

                {/* Manager Info */}
                {branch.managerName && (
                  <div className="border-t pt-3">
                    <div className="flex items-start text-sm">
                      <UserCog className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-gray-900 font-medium">{branch.managerName}</p>
                        {branch.managerPhone && (
                          <p className="text-gray-600">{branch.managerPhone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
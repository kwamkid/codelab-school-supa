'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Room, Branch, Class } from '@/types/models';
import { getRoomsByBranch, getActiveRoomsByBranch, updateRoom } from '@/lib/services/rooms';
import { getBranches, getActiveBranches } from '@/lib/services/branches';
import { getClasses, updateClass } from '@/lib/services/classes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Edit,
  DoorOpen,
  MapPin,
  Search,
  Trash2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { SectionLoading } from '@/components/ui/loading';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import RoomDialog from '@/components/rooms/room-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSelect } from '@/components/ui/form-select';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';

interface RoomWithBranch extends Room {
  branchName: string;
  branchCode: string;
}

export default function RoomsPage() {
  const searchParams = useSearchParams();
  const initialBranchId = searchParams.get('branch');
  const { selectedBranchId, isAllBranches } = useBranch();
  const { isSuperAdmin, canAccessBranch, adminUser } = useAuth();
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allRooms, setAllRooms] = useState<RoomWithBranch[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<RoomWithBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithBranch | null>(null);
  const [dialogBranchId, setDialogBranchId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [activeClasses, setActiveClasses] = useState<Class[]>([]);
  // Deactivate dialog state
  const [deactivateRoom, setDeactivateRoom] = useState<RoomWithBranch | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedBranchId]); // Reload when selected branch changes

  useEffect(() => {
    // Set initial filter based on context or URL param
    if (selectedBranchId) {
      setFilterBranch(selectedBranchId);
    } else if (initialBranchId && branches.length > 0) {
      setFilterBranch(initialBranchId);
    } else {
      // Reset to 'all' when viewing all branches
      setFilterBranch('all');
    }
  }, [selectedBranchId, initialBranchId, branches]);

  useEffect(() => {
    filterData();
  }, [allRooms, filterBranch, searchTerm]);

  const loadData = async () => {
    try {
      // Get branches based on user permissions
      let branchesData: Branch[] = [];
      
      if (isSuperAdmin() && isAllBranches) {
        // Super admin viewing all branches
        branchesData = await getActiveBranches();
      } else if (selectedBranchId) {
        // Specific branch selected
        branchesData = await getBranches();
        branchesData = branchesData.filter(b => b.id === selectedBranchId);
      } else if (adminUser?.branchIds && adminUser.branchIds.length > 0) {
        // Branch admin with specific branches
        branchesData = await getBranches();
        branchesData = branchesData.filter(b => adminUser.branchIds.includes(b.id));
      }
      
      setBranches(branchesData);

      // Load rooms from accessible branches only
      const roomsPromises = branchesData.map(async (branch) => {
        const rooms = await getRoomsByBranch(branch.id);
        return rooms.map(room => ({
          ...room,
          branchName: branch.name,
          branchCode: branch.code
        }));
      });

      const roomsArrays = await Promise.all(roomsPromises);
      const allRoomsData = roomsArrays.flat();
      setAllRooms(allRoomsData);
      setFilteredRooms(allRoomsData);

      // Load active classes to count per room
      const classesData = await getClasses();
      setActiveClasses(classesData.filter(c => c.status === 'published' || c.status === 'started'));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...allRooms];

    // Filter by branch (only if not viewing a specific branch already)
    if (!selectedBranchId && filterBranch !== 'all') {
      filtered = filtered.filter(room => room.branchId === filterBranch);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(room => 
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.floor?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRooms(filtered);
  };

  const handleAddRoom = () => {
    if (branches.length === 0) {
      toast.error('กรุณาสร้างสาขาก่อน');
      return;
    }
    setSelectedRoom(null);
    // Set default branch ID
    const defaultBranchId = selectedBranchId || 
                          (filterBranch !== 'all' ? filterBranch : branches[0].id);
    setDialogBranchId(defaultBranchId);
    setDialogOpen(true);
  };

  const handleEditRoom = (room: RoomWithBranch) => {
    // Check if user can edit this room
    if (!canAccessBranch(room.branchId)) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขห้องในสาขานี้');
      return;
    }
    
    setSelectedRoom(room);
    setDialogBranchId(room.branchId);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedRoom(null);
    setDialogBranchId('');
  };

  const handleRoomSaved = () => {
    loadData();
    handleDialogClose();
  };

  // Count active classes per room
  const classCountByRoom = useMemo(() => {
    const map = new Map<string, Class[]>();
    for (const cls of activeClasses) {
      if (!cls.roomId) continue;
      if (!map.has(cls.roomId)) map.set(cls.roomId, []);
      map.get(cls.roomId)!.push(cls);
    }
    return map;
  }, [activeClasses]);

  // Get other active rooms in same branch (for reassignment)
  const getOtherRooms = (room: RoomWithBranch) => {
    return allRooms.filter(r => r.branchId === room.branchId && r.id !== room.id && r.isActive);
  };

  // Deactivate room (soft delete)
  const handleDeactivateRoom = async (room: RoomWithBranch) => {
    const roomClasses = classCountByRoom.get(room.id) || [];
    if (roomClasses.length > 0) {
      // Has active classes — show reassignment dialog
      setDeactivateRoom(room);
    } else {
      // No active classes — deactivate directly
      if (!confirm(`ปิดห้อง "${room.name}" ใช่มั้ย?`)) return;
      try {
        await updateRoom(room.branchId, room.id, { isActive: false });
        toast.success(`ปิดห้อง "${room.name}" เรียบร้อยแล้ว`);
        loadData();
      } catch {
        toast.error('ไม่สามารถปิดห้องได้');
      }
    }
  };

  // Move a single class to a new room
  const handleMoveClass = async (cls: Class, newRoomId: string) => {
    try {
      await updateClass(cls.id, { roomId: newRoomId } as any);
      const newRoom = allRooms.find(r => r.id === newRoomId);
      toast.success(`ย้าย "${cls.name}" ไปห้อง "${newRoom?.name}" แล้ว`);
      // Reload
      const classesData = await getClasses();
      setActiveClasses(classesData.filter(c => c.status === 'published' || c.status === 'started'));
    } catch {
      toast.error('ไม่สามารถย้ายคลาสได้');
    }
  };

  // Deactivate after all classes moved
  const handleDeactivateAfterMove = async () => {
    if (!deactivateRoom) return;
    const remaining = classCountByRoom.get(deactivateRoom.id) || [];
    if (remaining.length > 0) {
      toast.error(`ยังมี ${remaining.length} คลาสใช้ห้องนี้อยู่ กรุณาย้ายให้หมดก่อน`);
      return;
    }
    setDeactivateLoading(true);
    try {
      await updateRoom(deactivateRoom.branchId, deactivateRoom.id, { isActive: false });
      toast.success(`ปิดห้อง "${deactivateRoom.name}" เรียบร้อยแล้ว`);
      setDeactivateRoom(null);
      loadData();
    } catch {
      toast.error('ไม่สามารถปิดห้องได้');
    } finally {
      setDeactivateLoading(false);
    }
  };

  // Count branches without rooms
  const branchesWithoutRooms = branches.filter(branch =>
    !allRooms.some(room => room.branchId === branch.id && room.isActive)
  ).length;

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            จัดการห้องเรียน
            {!isAllBranches && (
              <span className="text-red-600 text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            {isAllBranches ? 'จัดการห้องเรียนทุกสาขา' : 'จัดการห้องเรียนในสาขา'}
          </p>
        </div>
        <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
          <ActionButton 
            action="create"
            onClick={handleAddRoom}
            className="bg-red-500 hover:bg-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มห้องเรียน
          </ActionButton>
        </PermissionGuard>
      </div>

      {/* Warning if branches without rooms */}
      {branchesWithoutRooms > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            <span className="font-medium">⚠️ มี {branchesWithoutRooms} สาขาที่ยังไม่มีห้องเรียน</span>
            {' - '}คลิกปุ่ม "เพิ่มห้องเรียน" เพื่อสร้างห้องให้สาขาเหล่านั้น
          </p>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="ค้นหาชื่อห้อง, สาขา, ชั้น..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>
            {/* Show branch filter only if not viewing a specific branch */}
            {!selectedBranchId && branches.length > 1 && (
              <div className="w-full md:w-[200px]">
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสาขา</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการห้องเรียน ({filteredRooms.length} ห้อง)</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRooms.length === 0 ? (
            allRooms.length === 0 ? (
              <EmptyState
                icon={DoorOpen}
                title="ยังไม่มีห้องเรียน"
                description="เริ่มต้นด้วยการเพิ่มห้องเรียนแรก"
                action={
                  <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                    <ActionButton
                      action="create"
                      onClick={handleAddRoom}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่มห้องเรียน
                    </ActionButton>
                  </PermissionGuard>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title="ไม่พบข้อมูลที่ค้นหา"
                description="ลองปรับเงื่อนไขการค้นหาใหม่"
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAllBranches && <TableHead>สาขา</TableHead>}
                  <TableHead>ชื่อห้อง</TableHead>
                  <TableHead>ชั้น</TableHead>
                  <TableHead className="text-center">ความจุ</TableHead>
                  <TableHead className="text-center">อุปกรณ์</TableHead>
                  <TableHead className="text-center">คลาส active</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow key={`${room.branchId}-${room.id}`} className={!room.isActive ? 'opacity-60' : ''}>
                    {isAllBranches && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{room.branchName}</div>
                            <div className="text-gray-500">{room.branchCode}</div>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>{room.floor || '-'}</TableCell>
                    <TableCell className="text-center">{room.capacity} คน</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        {room.hasProjector && (
                          <Badge variant="secondary" className="text-xs">
                            Projector
                          </Badge>
                        )}
                        {room.hasWhiteboard && (
                          <Badge variant="secondary" className="text-xs">
                            Whiteboard
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const count = (classCountByRoom.get(room.id) || []).length;
                        if (count === 0) return <span className="text-gray-400">-</span>;
                        return <Badge variant="secondary">{count} คลาส</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      {room.isActive ? (
                        <Badge className="bg-green-100 text-green-700">ใช้งานได้</Badge>
                      ) : (
                        <Badge variant="destructive">ปิดใช้งาน</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                        {canAccessBranch(room.branchId) && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRoom(room)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {room.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeactivateRoom(room)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </PermissionGuard>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Room Dialog */}
      <RoomDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        branchId={dialogBranchId}
        room={selectedRoom}
        onSaved={handleRoomSaved}
        branches={branches}
        onBranchChange={(branchId: string) => setDialogBranchId(branchId)}
      />

      {/* Deactivate Room Dialog */}
      <Dialog open={!!deactivateRoom} onOpenChange={(open) => !open && setDeactivateRoom(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              ปิดห้อง "{deactivateRoom?.name}"
            </DialogTitle>
            <DialogDescription>
              ห้องนี้มีคลาสที่ active อยู่ กรุณาย้ายคลาสไปห้องอื่นก่อนปิด
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[400px] overflow-auto">
            {deactivateRoom && (classCountByRoom.get(deactivateRoom.id) || []).map((cls) => (
              <div key={cls.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{cls.name}</p>
                  <p className="text-xs text-gray-500">{cls.code}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="w-[160px] flex-shrink-0">
                  <FormSelect
                    value=""
                    onValueChange={(newRoomId) => handleMoveClass(cls, newRoomId)}
                    placeholder="ย้ายไปห้อง..."
                    options={getOtherRooms(deactivateRoom).map(r => ({
                      value: r.id,
                      label: `${r.name} (${r.capacity} คน)`,
                    }))}
                  />
                </div>
              </div>
            ))}

            {deactivateRoom && (classCountByRoom.get(deactivateRoom.id) || []).length === 0 && (
              <div className="text-center py-4 text-green-600 font-medium">
                ย้ายคลาสหมดแล้ว พร้อมปิดห้อง
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateRoom(null)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateAfterMove}
              disabled={deactivateLoading || (deactivateRoom ? (classCountByRoom.get(deactivateRoom.id) || []).length > 0 : true)}
            >
              {deactivateLoading ? 'กำลังปิด...' : 'ปิดห้อง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
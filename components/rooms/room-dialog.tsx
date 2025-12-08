'use client';

import { useState, useEffect } from 'react';
import { Room, Branch } from '@/types/models';
import { createRoom, updateRoom, checkRoomNameExists } from '@/lib/services/rooms';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, MapPin } from 'lucide-react';

interface RoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  room?: Room | null;
  onSaved: () => void;
  branches: Branch[];
  onBranchChange: (branchId: string) => void;
}

export default function RoomDialog({
  open,
  onOpenChange,
  branchId,
  room,
  onSaved,
  branches,
  onBranchChange
}: RoomDialogProps) {
  const [loading, setLoading] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState(branchId || '');
  const [formData, setFormData] = useState({
    name: '',
    capacity: 20,
    floor: '',
    hasProjector: false,
    hasWhiteboard: true,
    isActive: true,
  });

  // Update when branchId prop changes
  useEffect(() => {
    if (branchId && !room) {
      setCurrentBranchId(branchId);
    }
  }, [branchId, room]);

  // Reset form when dialog opens/closes or room changes
  useEffect(() => {
    if (open) {
      if (room) {
        // Edit mode
        setFormData({
          name: room.name,
          capacity: room.capacity,
          floor: room.floor || '',
          hasProjector: room.hasProjector,
          hasWhiteboard: room.hasWhiteboard,
          isActive: room.isActive,
        });
        setCurrentBranchId(room.branchId);
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          capacity: 20,
          floor: '',
          hasProjector: false,
          hasWhiteboard: true,
          isActive: true,
        });
        // Use branchId from props or first branch
        if (branchId) {
          setCurrentBranchId(branchId);
        } else if (branches.length > 0 && !currentBranchId) {
          setCurrentBranchId(branches[0].id);
        }
      }
    }
  }, [open, room, branchId, branches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อห้อง');
      return;
    }

    if (formData.capacity < 1) {
      toast.error('ความจุต้องมากกว่า 0');
      return;
    }

    if (!currentBranchId) {
      toast.error('กรุณาเลือกสาขา');
      return;
    }

    setLoading(true);

    try {
      // Check if room name exists
      const nameExists = await checkRoomNameExists(
        currentBranchId,
        formData.name.trim(),
        room?.id
      );

      if (nameExists) {
        toast.error('ชื่อห้องนี้มีอยู่แล้วในสาขานี้');
        setLoading(false);
        return;
      }

      if (room) {
        // Update existing room
        await updateRoom(currentBranchId, room.id, {
          ...formData,
          name: formData.name.trim(),
        });
        toast.success('อัปเดตข้อมูลห้องเรียนเรียบร้อยแล้ว');
      } else {
        // Create new room
        await createRoom(currentBranchId, {
          ...formData,
          name: formData.name.trim(),
        });
        toast.success('เพิ่มห้องเรียนใหม่เรียบร้อยแล้ว');
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error(room ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มห้องเรียนได้');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchChange = (value: string) => {
    setCurrentBranchId(value);
    onBranchChange(value);
  };

  // Find selected branch info
  const selectedBranch = branches.find(b => b.id === currentBranchId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{room ? 'แก้ไขข้อมูลห้องเรียน' : 'เพิ่มห้องเรียนใหม่'}</DialogTitle>
            <DialogDescription>
              {room ? 'แก้ไขข้อมูลห้องเรียน' : 'กรอกข้อมูลเพื่อเพิ่มห้องเรียนใหม่'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Branch Selection */}
            <div className="grid gap-2">
              <Label htmlFor="branch" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                สาขา *
              </Label>
              {room ? (
                // Show branch name when editing (read-only)
                <div className="px-3 py-2 bg-gray-100 rounded-md text-sm">
                  {selectedBranch?.name || 'Loading...'} {selectedBranch?.code ? `(${selectedBranch.code})` : ''}
                </div>
              ) : (
                // Show dropdown when creating new room
                <>
                  {branches.length > 0 ? (
                    <Select 
                      value={currentBranchId} 
                      onValueChange={handleBranchChange}
                      required
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="เลือกสาขาที่จะเพิ่มห้อง" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name} ({branch.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="px-3 py-2 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                      ไม่พบข้อมูลสาขา กรุณาสร้างสาขาก่อน
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">ชื่อห้อง *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น A101, Lab 1"
                disabled={loading}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capacity">ความจุ (คน) *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                  disabled={loading}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="floor">ชั้น</Label>
                <Input
                  id="floor"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  placeholder="เช่น 1, 2, G"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>อุปกรณ์ในห้อง</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasProjector"
                  checked={formData.hasProjector}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, hasProjector: checked as boolean })
                  }
                  disabled={loading}
                />
                <Label htmlFor="hasProjector" className="font-normal cursor-pointer">
                  มีโปรเจคเตอร์
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasWhiteboard"
                  checked={formData.hasWhiteboard}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, hasWhiteboard: checked as boolean })
                  }
                  disabled={loading}
                />
                <Label htmlFor="hasWhiteboard" className="font-normal cursor-pointer">
                  มีกระดานไวท์บอร์ด
                </Label>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, isActive: checked as boolean })
                }
                disabled={loading}
              />
              <Label htmlFor="isActive" className="font-normal cursor-pointer">
                เปิดใช้งาน
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600"
              disabled={loading || (!room && !currentBranchId)}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {room ? 'บันทึกการแก้ไข' : 'เพิ่มห้องเรียน'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
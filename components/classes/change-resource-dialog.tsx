'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormSelect } from '@/components/ui/form-select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Class, Teacher, Room, ClassSchedule } from '@/types/models';
import { getTeachersByBranch } from '@/lib/services/teachers';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import { getClassSchedules, changeClassResources } from '@/lib/services/classes';
import { toast } from 'sonner';

interface ChangeResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class;
  currentTeacher: Teacher;
  currentRoom: Room;
  onSuccess: () => void;
}

export function ChangeResourceDialog({
  open,
  onOpenChange,
  classData,
  currentTeacher,
  currentRoom,
  onSuccess,
}: ChangeResourceDialogProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [newTeacherId, setNewTeacherId] = useState(classData.teacherId);
  const [newRoomId, setNewRoomId] = useState(classData.roomId);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNewTeacherId(classData.teacherId);
      setNewRoomId(classData.roomId);
      setReason('');
      loadData();
    }
  }, [open, classData]);

  const loadData = async () => {
    try {
      const [t, r, s] = await Promise.all([
        getTeachersByBranch(classData.branchId),
        getActiveRoomsByBranch(classData.branchId),
        getClassSchedules(classData.id),
      ]);
      setTeachers(t);
      setRooms(r);
      setSchedules(s);

      // Default effective date = next scheduled session
      const today = new Date().toISOString().split('T')[0];
      const nextSession = s
        .filter(sc => sc.status === 'scheduled')
        .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
        .find(sc => {
          const d = sc.sessionDate instanceof Date
            ? sc.sessionDate.toISOString().split('T')[0]
            : String(sc.sessionDate).split('T')[0];
          return d >= today;
        });

      if (nextSession) {
        const d = nextSession.sessionDate instanceof Date
          ? nextSession.sessionDate.toISOString().split('T')[0]
          : String(nextSession.sessionDate).split('T')[0];
        setEffectiveDate(d);
      } else {
        setEffectiveDate(today);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Count affected future sessions
  const affectedCount = schedules.filter(s => {
    if (s.status !== 'scheduled') return false;
    const d = s.sessionDate instanceof Date
      ? s.sessionDate.toISOString().split('T')[0]
      : String(s.sessionDate).split('T')[0];
    return d >= effectiveDate;
  }).length;

  const hasChanges = newTeacherId !== classData.teacherId || newRoomId !== classData.roomId;

  const handleSave = async () => {
    if (!hasChanges) {
      toast.error('ไม่มีการเปลี่ยนแปลง');
      return;
    }

    setSaving(true);
    try {
      const result = await changeClassResources(classData.id, {
        newTeacherId: newTeacherId !== classData.teacherId ? newTeacherId : undefined,
        newRoomId: newRoomId !== classData.roomId ? newRoomId : undefined,
        effectiveDate,
        reason: reason.trim() || undefined,
        changedBy: 'admin',
      });

      toast.success(`เปลี่ยนเรียบร้อย (อัพเดต ${result.updatedSchedules} คาบ)`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถเปลี่ยนได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-500" />
            เปลี่ยนครู/ห้องเรียน
          </DialogTitle>
          <DialogDescription>
            {classData.name} ({classData.code})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Teacher */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">ครูผู้สอน</Label>
            <FormSelect
              value={newTeacherId}
              onValueChange={setNewTeacherId}
              options={teachers.map(t => ({ value: t.id, label: t.nickname || t.name }))}
              placeholder="เลือกครู"
            />
            {newTeacherId !== classData.teacherId && (
              <p className="text-xs text-blue-600">
                เปลี่ยนจาก {currentTeacher.nickname || currentTeacher.name} → {teachers.find(t => t.id === newTeacherId)?.nickname || teachers.find(t => t.id === newTeacherId)?.name}
              </p>
            )}
          </div>

          {/* Room */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">ห้องเรียน</Label>
            <FormSelect
              value={newRoomId}
              onValueChange={setNewRoomId}
              options={rooms.map(r => ({ value: r.id, label: r.name }))}
              placeholder="เลือกห้อง"
            />
            {newRoomId !== classData.roomId && (
              <p className="text-xs text-blue-600">
                เปลี่ยนจาก {currentRoom.name} → {rooms.find(r => r.id === newRoomId)?.name}
              </p>
            )}
          </div>

          {/* Effective date */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">มีผลตั้งแต่วันที่</Label>
            <DateRangePicker
              mode="single"
              value={effectiveDate}
              onChange={(d) => setEffectiveDate(d || '')}
              minDate={new Date()}
              placeholder="เลือกวันที่"
            />
            {affectedCount > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  มีผล {affectedCount} คาบที่เหลือ
                </Badge>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">เหตุผล (ไม่บังคับ)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ครูลาออก, ย้ายห้อง"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges || !effectiveDate}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { UserCog, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormSelect } from '@/components/ui/form-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CalendarEvent } from '@/lib/services/dashboard';
import { Teacher } from '@/types/models';
import { getTeachersByBranch } from '@/lib/services/teachers';
import { updateClassSchedule, changeClassResources } from '@/lib/services/classes';
import { updateTrialSession } from '@/lib/services/trial-bookings';
import { adminMutation } from '@/lib/admin-mutation';
import { checkAvailability } from '@/lib/utils/availability';
import { useAuth } from '@/hooks/useSupabaseAuth';

interface ChangeTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  scheduleId: string;
  onChanged?: () => void;
}

type Scope = 'session' | 'class';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ChangeTeacherDialog({
  open,
  onOpenChange,
  event,
  scheduleId,
  onChanged,
}: ChangeTeacherDialogProps) {
  const { adminUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [scope, setScope] = useState<Scope>('session');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const type = event?.extendedProps.type;
  const isClass = type === 'class';
  const branchId = event?.extendedProps.branchId;
  const currentTeacherName = event?.extendedProps.teacherName;

  // Load teachers for the branch + reset form when opened
  useEffect(() => {
    if (!open || !branchId) return;
    setScope('session');
    setTeacherId('');
    setConflicts([]);
    setLoading(true);
    getTeachersByBranch(branchId)
      .then(setTeachers)
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false));
  }, [open, branchId]);

  // Warn (don't block) if the new teacher is busy at this session's slot
  useEffect(() => {
    if (!open || !teacherId || !event) { setConflicts([]); return; }
    const ep = event.extendedProps;
    if (!ep.startTime || !ep.endTime || !ep.roomId) { setConflicts([]); return; }

    let cancelled = false;
    setChecking(true);
    checkAvailability({
      date: event.start as Date,
      startTime: ep.startTime,
      endTime: ep.endTime,
      branchId: ep.branchId,
      roomId: ep.roomId,
      teacherId,
      excludeId: scheduleId,
      excludeType: type === 'holiday' ? undefined : type,
      allowConflicts: true, // surface as warnings, never block
    })
      .then((res) => {
        if (cancelled) return;
        const msgs = [
          ...(res.reasons || []),
          ...(res.warnings || []),
        ]
          .filter((x) => x.type === 'teacher_conflict')
          .map((x) => x.message);
        setConflicts(msgs);
      })
      .catch(() => { if (!cancelled) setConflicts([]); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [open, teacherId, event, scheduleId, type]);

  const teacherLabel = (t: Teacher) => t.nickname || t.name;

  const handleSave = async () => {
    if (!teacherId || !event) return;
    setSaving(true);
    try {
      if (isClass) {
        if (scope === 'class') {
          const res = await changeClassResources(event.classId, {
            newTeacherId: teacherId,
            effectiveDate: toDateStr(event.start as Date),
            reason: 'เปลี่ยนครูผู้สอนจากหน้า Dashboard',
            changedBy: adminUser?.id || 'system',
          });
          toast.success(`เปลี่ยนครูทั้งคลาสแล้ว (อัปเดต ${res.updatedSchedules} คาบ)`);
        } else {
          await updateClassSchedule(event.classId, scheduleId, { actualTeacherId: teacherId });
          toast.success('เปลี่ยนครูเฉพาะคาบนี้แล้ว');
        }
      } else if (type === 'makeup') {
        const t = teachers.find((x) => x.id === teacherId);
        await adminMutation({
          table: 'makeup_classes',
          operation: 'update',
          data: {
            makeup_teacher_id: teacherId,
            makeup_teacher_name: t ? teacherLabel(t) : null,
          },
          match: { id: scheduleId },
        });
        toast.success('เปลี่ยนครู Makeup แล้ว');
      } else if (type === 'trial') {
        await updateTrialSession(scheduleId, { teacherId });
        toast.success('เปลี่ยนครูทดลองเรียนแล้ว');
      }
      onChanged?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error changing teacher:', error);
      toast.error(error?.message || 'เปลี่ยนครูไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const newTeacher = teachers.find((t) => t.id === teacherId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-blue-500" />
            เปลี่ยนครูผู้สอน
          </DialogTitle>
          <DialogDescription>
            ครูปัจจุบัน: <span className="font-medium">{currentTeacherName || '-'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Teacher picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">ครูคนใหม่</Label>
            <FormSelect
              value={teacherId}
              onValueChange={setTeacherId}
              options={teachers.map((t) => ({ value: t.id, label: teacherLabel(t) }))}
              placeholder={loading ? 'กำลังโหลดรายชื่อครู...' : 'เลือกครู'}
              disabled={loading}
            />
          </div>

          {/* Scope — only regular classes can change the whole class */}
          {isClass && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">ขอบเขตการเปลี่ยน</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="gap-2">
                <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="session" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">เฉพาะคาบนี้</p>
                    <p className="text-xs text-gray-500">ครูแทนเฉพาะวันนี้ คาบอื่นคงเดิม</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="class" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">ทั้งคลาส (ตั้งแต่คาบนี้เป็นต้นไป)</p>
                    <p className="text-xs text-gray-500">เช่น กรณีครูลาออก — เปลี่ยนครูประจำคลาส + คาบที่เหลือ</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {/* Conflict warning (non-blocking) */}
          {checking && (
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" /> กำลังตรวจสอบเวลาครู...
            </p>
          )}
          {!checking && conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> ครูคนนี้มีคิวชนเวลา
              </p>
              <ul className="mt-1 ml-5 list-disc text-xs text-amber-700">
                {conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-amber-600">ยังบันทึกได้ แต่โปรดตรวจสอบก่อน</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving || !teacherId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก{newTeacher ? ` (${teacherLabel(newTeacher)})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

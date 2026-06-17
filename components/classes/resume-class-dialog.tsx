'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlayCircle, Loader2, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { FormSelect } from '@/components/ui/form-select';
import { Tooltip } from '@/components/ui/tooltip';
import { Class, Teacher, Room } from '@/types/models';
import { getTeachersByBranch } from '@/lib/services/teachers';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import {
  buildResumeDraft,
  resumeClass,
  checkSessionAvailability,
  type ResumeDraftSession,
} from '@/lib/services/classes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ResumeClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class;
  onSuccess: () => void;
}

type RowStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok' }
  | { state: 'conflict'; messages: string[] }
  | { state: 'warn'; messages: string[] };

export function ResumeClassDialog({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: ResumeClassDialogProps) {
  const { adminUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [resumeDate, setResumeDate] = useState<string>('');
  const [rows, setRows] = useState<ResumeDraftSession[]>([]);
  const [rowStatus, setRowStatus] = useState<Record<number, RowStatus>>({});
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset to a clean state — admin picks the resume date first, then presses
    // "สร้างตารางอัตโนมัติ" to generate rows. Nothing is auto-filled or saved.
    setRows([]);
    setRowStatus({});
    setResumeDate('');
    (async () => {
      try {
        const [t, r] = await Promise.all([
          getTeachersByBranch(classData.branchId),
          getActiveRoomsByBranch(classData.branchId),
        ]);
        setTeachers(t);
        setRooms(r);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classData.id, classData.branchId]);

  const checkRow = useCallback(
    async (index: number, row: ResumeDraftSession) => {
      if (!row.date || !row.startTime || !row.endTime || !row.roomId || !row.teacherId) {
        setRowStatus((p) => ({ ...p, [index]: { state: 'idle' } }));
        return;
      }
      setRowStatus((p) => ({ ...p, [index]: { state: 'checking' } }));
      try {
        const { reasons, warnings } = await checkSessionAvailability({
          classId: classData.id,
          branchId: classData.branchId,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          roomId: row.roomId,
          teacherId: row.teacherId,
        });
        if (reasons.length > 0) {
          setRowStatus((p) => ({ ...p, [index]: { state: 'conflict', messages: reasons.map((r) => r.message) } }));
        } else if (warnings.length > 0) {
          setRowStatus((p) => ({ ...p, [index]: { state: 'warn', messages: warnings.map((w) => w.message) } }));
        } else {
          setRowStatus((p) => ({ ...p, [index]: { state: 'ok' } }));
        }
      } catch {
        setRowStatus((p) => ({ ...p, [index]: { state: 'idle' } }));
      }
    },
    [classData.id, classData.branchId]
  );

  // Check all rows (debounced lightly via sequential await)
  const checkAllRows = useCallback(
    (list: ResumeDraftSession[]) => {
      list.forEach((row, i) => checkRow(i, row));
    },
    [checkRow]
  );

  const handleAutoFill = async () => {
    if (!resumeDate) {
      toast.error('เลือกวันที่กลับมาเรียน');
      return;
    }
    setBuilding(true);
    try {
      const { rows: draft } = await buildResumeDraft(classData.id, resumeDate);
      setRows(draft);
      setRowStatus({});
      checkAllRows(draft);
      if (draft.length === 0) toast.info('ไม่มีคาบที่ต้องจัดเพิ่ม (เรียนครบแล้ว)');
    } catch (error: any) {
      toast.error(error.message || 'สร้างตารางอัตโนมัติไม่สำเร็จ');
    } finally {
      setBuilding(false);
    }
  };

  const updateRow = (index: number, patch: Partial<ResumeDraftSession>) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r));
      // re-check this row after the state update
      checkRow(index, next[index]);
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const lastDate = prev.length ? prev[prev.length - 1].date : resumeDate;
      const nextNum = prev.length ? prev[prev.length - 1].sessionNumber + 1 : 1;
      return [
        ...prev,
        {
          sessionNumber: nextNum,
          date: lastDate,
          startTime: classData.startTime?.slice(0, 5) || '09:00',
          endTime: classData.endTime?.slice(0, 5) || '10:00',
          roomId: classData.roomId,
          teacherId: classData.teacherId,
        },
      ];
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) =>
      prev
        .filter((_, i) => i !== index)
        // renumber sequentially from the first row's number
        .map((r, i, arr) => ({ ...r, sessionNumber: (arr[0]?.sessionNumber ?? 1) + i }))
    );
    setRowStatus({});
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      toast.error('ยังไม่มีคาบเรียน — กดสร้างตารางอัตโนมัติ หรือเพิ่มคาบเอง');
      return;
    }
    if (rows.some((r) => !r.date || !r.startTime || !r.endTime || !r.roomId || !r.teacherId)) {
      toast.error('กรอกข้อมูลให้ครบทุกคาบ');
      return;
    }
    setSaving(true);
    try {
      const result = await resumeClass(classData.id, resumeDate, rows, adminUser?.id || '');
      toast.success(`กลับมาเรียนเรียบร้อย (จัด ${result.created} คาบ, สิ้นสุด ${result.newEndDate})`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถกลับมาเรียนได้');
    } finally {
      setSaving(false);
    }
  };

  const teacherOptions = teachers.map((t) => ({ value: t.id, label: t.nickname || t.name }));
  const roomOptions = rooms.map((r) => ({ value: r.id, label: r.name }));
  const conflictCount = Object.values(rowStatus).filter((s) => s.state === 'conflict').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-green-600" />
            กลับมาเรียน (จัดคาบที่เหลือ)
          </DialogTitle>
          <DialogDescription>{classData.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">เริ่มเรียนอีกครั้งวันที่</Label>
              <DateRangePicker
                mode="single"
                value={resumeDate}
                onChange={(d) => setResumeDate(d || '')}
                minDate={new Date()}
                placeholder="เลือกวันที่"
              />
            </div>
            <Button variant="outline" onClick={handleAutoFill} disabled={building || !resumeDate}>
              {building ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              สร้างตารางอัตโนมัติ
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            เลือกวันเริ่มเรียน แล้วกด “สร้างตารางอัตโนมัติ” — ระบบจะเติมวันให้ตามตารางเดิม
            แก้วัน/เวลา/ห้อง/ครู รายคาบได้ (เตือนถ้าชนแต่ไม่บล็อก) · บันทึกเมื่อกด “ยืนยันกลับมาเรียน”
          </p>

          {/* Empty state before generating */}
          {rows.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
              เลือกวันเริ่มเรียนด้านบน แล้วกด “สร้างตารางอัตโนมัติ”
            </div>
          )}

          {/* Editable session rows */}
          {rows.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-[40px_150px_1fr_1fr_1fr_90px_40px] gap-2 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
                <div>คาบ</div>
                <div>วันที่</div>
                <div>เวลา</div>
                <div>ห้อง</div>
                <div>ครู</div>
                <div className="text-center">ว่าง</div>
                <div></div>
              </div>
              <div className="divide-y">
                {rows.map((row, i) => {
                  const st = rowStatus[i] ?? { state: 'idle' };
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[40px_150px_1fr_1fr_1fr_90px_40px] gap-2 px-3 py-2 items-center"
                    >
                      <div className="text-sm font-medium text-gray-500">{row.sessionNumber}</div>
                      <DateRangePicker
                        mode="single"
                        value={row.date}
                        onChange={(d) => updateRow(i, { date: d || '' })}
                        placeholder="วันที่"
                      />
                      <TimeRangePicker
                        startTime={row.startTime}
                        endTime={row.endTime}
                        onStartTimeChange={(v) => updateRow(i, { startTime: v })}
                        onEndTimeChange={(v) => updateRow(i, { endTime: v })}
                      />
                      <FormSelect
                        value={row.roomId}
                        onValueChange={(v) => updateRow(i, { roomId: v })}
                        options={roomOptions}
                        placeholder="ห้อง"
                      />
                      <FormSelect
                        value={row.teacherId}
                        onValueChange={(v) => updateRow(i, { teacherId: v })}
                        options={teacherOptions}
                        placeholder="ครู"
                      />
                      <div className="flex justify-center">
                        {st.state === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                        {st.state === 'ok' && (
                          <Tooltip label="ว่าง">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Tooltip>
                        )}
                        {(st.state === 'conflict' || st.state === 'warn') && (
                          <Tooltip label={st.messages.join(' • ')}>
                            <AlertTriangle
                              className={st.state === 'conflict' ? 'h-4 w-4 text-red-500' : 'h-4 w-4 text-amber-500'}
                            />
                          </Tooltip>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-500"
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่มคาบ
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                รวม {rows.length} คาบ
              </Badge>
              {conflictCount > 0 && (
                <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                  ชน {conflictCount} คาบ
                </Badge>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving || rows.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              ยืนยันกลับมาเรียน
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { PauseCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Class, ClassSchedule } from '@/types/models';
import { getClassSchedules, pauseClass } from '@/lib/services/classes';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PauseResult {
  cancelled: number;
  created?: number;
  newEndDate?: string;
  mode?: 'known' | 'open';
}

interface PauseClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class;
  // Called after a successful pause. For mode 'known' the result carries
  // created/conflicts so the page can auto-open the editor when sessions clash.
  onSuccess: (result?: PauseResult) => void;
}

function toDateStr(d: Date | string): string {
  return d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];
}

export function PauseClassDialog({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: PauseClassDialogProps) {
  const { adminUser } = useAuth();
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [mode, setMode] = useState<'known' | 'open'>('known');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [openFrom, setOpenFrom] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('known');
      setRange({ from: '', to: '' });
      setOpenFrom('');
      setReason('');
      getClassSchedules(classData.id).then(setSchedules).catch(() => {});
    }
  }, [open, classData.id]);

  // Sessions that will be cancelled (depends on mode).
  const affectedCount = schedules.filter((s) => {
    if (s.status !== 'scheduled') return false;
    const d = toDateStr(s.sessionDate);
    if (mode === 'open') return openFrom ? d >= openFrom : false;
    if (!range.from || !range.to) return false;
    return d >= range.from && d <= range.to;
  }).length;

  const canSubmit =
    mode === 'known' ? !!range.from && !!range.to && affectedCount > 0 : !!openFrom && affectedCount > 0;

  const handleSave = async () => {
    if (!canSubmit) {
      toast.error(mode === 'open' ? 'เลือกวันเริ่มพัก' : 'เลือกช่วงวันที่พัก');
      return;
    }

    setSaving(true);
    try {
      const by = adminUser?.id || '';
      const result =
        mode === 'known'
          ? await pauseClass(classData.id, range.from, range.to, reason.trim(), by, 'known')
          : await pauseClass(classData.id, openFrom, null, reason.trim(), by, 'open');

      if (mode === 'known') {
        toast.success(`พักคลาสเรียบร้อย — เลื่อนเรียนต่อ ${result.created} คาบ (จบ ${result.newEndDate})`);
      } else {
        toast.success(`พักคลาสเรียบร้อย (ยกเลิก ${result.cancelled} คาบ) — กด “กลับมาเรียน” เพื่อจัดคาบใหม่ภายหลัง`);
      }

      onOpenChange(false);
      onSuccess({ ...result, mode });
    } catch (error: any) {
      toast.error(error.message || 'ไม่สามารถพักคลาสได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-500" />
            พักทั้งคลาส
          </DialogTitle>
          <DialogDescription>{classData.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            คาบในช่วงที่พักจะถูกยกเลิก <strong>โดยไม่สร้างคาบชดเชย</strong> —
            ถือว่าเลื่อนวันเรียนออกไป (เลื่อนตารางของนักเรียนทั้งห้องตามด้วย)
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('known')}
              className={cn(
                'rounded-md border p-3 text-left text-sm transition',
                mode === 'known' ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <div className="font-medium">รู้วันกลับ</div>
              <div className="text-xs text-gray-500 mt-0.5">เลือกช่วง แล้วเลื่อนเรียนต่อให้อัตโนมัติ</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('open')}
              className={cn(
                'rounded-md border p-3 text-left text-sm transition',
                mode === 'open' ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <div className="font-medium">ยังไม่รู้วันกลับ</div>
              <div className="text-xs text-gray-500 mt-0.5">พักไว้ก่อน ค่อยกด “กลับมาเรียน” ทีหลัง</div>
            </button>
          </div>

          {mode === 'known' ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">ช่วงวันที่พัก (จาก – ถึง)</Label>
              <DateRangePicker
                mode="range"
                value={range}
                onChange={(r) => setRange(r ?? { from: '', to: '' })}
                placeholder="เลือกช่วงวันที่"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">พักตั้งแต่วันที่</Label>
              <DateRangePicker
                mode="single"
                value={openFrom}
                onChange={(d) => setOpenFrom(d || '')}
                placeholder="เลือกวันที่"
              />
            </div>
          )}

          {((mode === 'known' && range.from && range.to) || (mode === 'open' && openFrom)) && (
            <div className="flex items-center gap-2">
              <Badge variant={affectedCount > 0 ? 'secondary' : 'outline'} className="text-xs">
                จะยกเลิก {affectedCount} คาบ
              </Badge>
              {mode === 'known' && affectedCount > 0 && (
                <span className="text-xs text-gray-500">แล้วเลื่อนไปต่อท้ายให้อัตโนมัติ</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">เหตุผล (ไม่บังคับ)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ครูลายาว, ปิดปรับปรุงสถานที่"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSubmit}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              พักคลาส
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

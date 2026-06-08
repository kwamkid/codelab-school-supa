'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronRight, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { getClassSchedules } from '@/lib/services/classes';
import { ClassSchedule } from '@/types/models';
import { formatDateWithDay } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { AttendanceChecker } from './attendance-checker';

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  classCode?: string;
  /** The session for the selected date (opened first) */
  scheduleId: string;
  onSaved?: () => void;
}

type View = 'check' | 'sessions';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function AttendanceDialog({
  open,
  onOpenChange,
  classId,
  className,
  classCode,
  scheduleId,
  onSaved,
}: AttendanceDialogProps) {
  const [view, setView] = useState<View>('check');
  const [activeScheduleId, setActiveScheduleId] = useState(scheduleId);
  const [sessions, setSessions] = useState<ClassSchedule[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Reset to the date's session whenever the dialog (re)opens for a class
  useEffect(() => {
    if (open) {
      setView('check');
      setActiveScheduleId(scheduleId);
    }
  }, [open, scheduleId, classId]);

  // Load all sessions when switching to the picker
  useEffect(() => {
    if (view !== 'sessions') return;
    let cancelled = false;
    setLoadingSessions(true);
    getClassSchedules(classId)
      .then((s) => { if (!cancelled) setSessions(s); })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setLoadingSessions(false); });
    return () => { cancelled = true; };
  }, [view, classId]);

  const today = startOfDay(new Date());

  const sessionStatusLabel = (s: ClassSchedule) => {
    const att = s.attendance || [];
    if (att.length > 0) {
      const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
      return { text: `เช็คแล้ว ${present}/${att.length}`, cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' };
    }
    const d = startOfDay(new Date(s.sessionDate));
    if (d.getTime() === today.getTime()) return { text: 'วันนี้ - รอเช็คชื่อ', cls: 'bg-slate-800 text-white' };
    if (d < today) return { text: 'ยังไม่เช็คชื่อ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' };
    return { text: 'ยังไม่ถึงเวลา', cls: 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-gray-400' };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {view === 'check' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{className}</DialogTitle>
              <button
                onClick={() => setView('sessions')}
                className="self-start mt-1 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                เลือกคาบอื่น / เช็คย้อนหลัง
              </button>
            </DialogHeader>
            <AttendanceChecker
              key={activeScheduleId}
              classId={classId}
              scheduleId={activeScheduleId}
              showHeader={false}
              onSaved={() => { onSaved?.(); onOpenChange(false); }}
              onCancel={() => onOpenChange(false)}
              cancelLabel="ปิด"
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Tooltip label="กลับ">
                  <button onClick={() => setView('check')} className="text-gray-400 hover:text-gray-600" aria-label="กลับ">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </Tooltip>
                เลือกคาบเรียน
              </DialogTitle>
              <p className="text-sm text-gray-500">{className}{classCode ? ` · ${classCode}` : ''}</p>
            </DialogHeader>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> กำลังโหลดคาบเรียน...
              </div>
            ) : (
              <div className="space-y-1.5 py-1">
                {sessions.map((s) => {
                  const d = startOfDay(new Date(s.sessionDate));
                  const canCheck = d <= today;
                  const status = sessionStatusLabel(s);
                  return (
                    <button
                      key={s.id}
                      disabled={!canCheck}
                      onClick={() => { setActiveScheduleId(s.id); setView('check'); }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 p-3 rounded-lg border text-left transition-colors dark:border-slate-700',
                        canCheck ? 'hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {!canCheck && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                          ครั้งที่ {s.sessionNumber}
                        </p>
                        <p className="text-xs text-gray-500">{formatDateWithDay(s.sessionDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn('border-0 text-xs', status.cls)}>{status.text}</Badge>
                        {canCheck && <ChevronRight className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

// Report print dialog: pick a student to print one teacher-feedback report, or
// print the whole class at once. No data entry — reports are built from the DB.

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { printStudentReport, printClassReports } from '@/lib/reports/print-student-report';
import { StudentBadge } from '@/components/ui/student-badge';

export interface PrintStudent {
  id: string;
  name: string;
  nickname?: string;
  parentName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  students: PrintStudent[];
}

export function ReportPrintDialog({ open, onOpenChange, classId, students }: Props) {
  const [busy, setBusy] = useState(false);

  const printOne = async (studentId: string) => {
    setBusy(true);
    try {
      await printStudentReport('/api/admin/reports/student-report', { studentId, classId });
    } catch (e: any) {
      toast.error(e?.message || 'พิมพ์รายงานไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const printAll = async () => {
    setBusy(true);
    try {
      await printClassReports(classId, students.map((s) => s.id));
    } catch (e: any) {
      toast.error(e?.message || 'พิมพ์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            พิมพ์รายงานความเห็นครู
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
          {students.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">คลาสนี้ยังไม่มีนักเรียน</p>
          )}
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => printOne(s.id)}
              disabled={busy}
              className="w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-2 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <StudentBadge name={s.nickname ? `${s.name} (${s.nickname})` : s.name} />
              {s.parentName && (
                <span className="text-xs text-muted-foreground truncate">{s.parentName}</span>
              )}
            </button>
          ))}
        </div>

        {students.length > 0 && (
          <div className="pt-3 border-t flex justify-end">
            <Button onClick={printAll} disabled={busy}>
              <Printer className="h-4 w-4 mr-2" />
              พิมพ์ทั้งหมด ({students.length} คน)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

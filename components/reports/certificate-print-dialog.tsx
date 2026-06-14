'use client';

// Certificate print dialog with three views:
//  1. list  — pick a student (→ single) or "พิมพ์ทั้งหมด" (→ batch table)
//  2. single — the full cert editor (preview + edit EN + auto-save) for one student
//  3. batch  — a table to fill EN names for everyone at once, save all, print all
//              (no preview, one multi-page file)

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Printer, Award, ChevronLeft, Users } from 'lucide-react';
import { toast } from 'sonner';
import { StudentBadge } from '@/components/ui/student-badge';
import { ParentBadge } from '@/components/ui/parent-badge';
import { CertificateEditor } from '@/components/reports/certificate-editor';
import { loadCertFields, printCertificatesFields } from '@/lib/reports/print-student-report';
import type { CertificateFields } from '@/components/reports/certificate-template';
import { adminMutation } from '@/lib/admin-mutation';
import type { PrintStudent } from '@/components/reports/report-print-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  teacherId?: string;
  students: PrintStudent[];
}

type View = 'list' | 'single' | 'batch';

// One editable row in the batch table.
interface BatchRow {
  studentId: string;
  thaiName: string;       // for reference (the Thai name)
  studentName: string;    // EN (editable, prefilled from name_en or Thai)
  subjectName: string;
  teacherName: string;
  date: string;
}

const REPORT_ENDPOINT = '/api/admin/reports/student-report';

export function CertificatePrintDialog({ open, onOpenChange, classId, teacherId, students }: Props) {
  const [view, setView] = useState<View>('list');
  const [busy, setBusy] = useState(false);

  // single-student editor state
  const [single, setSingle] = useState<{ studentId: string; fields: CertificateFields } | null>(null);

  // batch state
  const [rows, setRows] = useState<BatchRow[]>([]);
  // shared fields for the whole class (same on every certificate) — only the
  // student's EN name differs per row.
  const [shared, setShared] = useState<{ subjectName: string; teacherName: string; date: string }>(
    { subjectName: '', teacherName: '', date: '' }
  );

  const reset = () => { setView('list'); setSingle(null); setRows([]); setShared({ subjectName: '', teacherName: '', date: '' }); };

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  // ── single ────────────────────────────────────────────────────────────────
  const openSingle = async (studentId: string) => {
    setBusy(true);
    try {
      const fields = await loadCertFields(REPORT_ENDPOINT, { studentId, classId });
      setSingle({ studentId, fields });
      setView('single');
    } catch (e: any) {
      toast.error(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const saveSingleNames = async (f: CertificateFields) => {
    if (!single) return;
    try {
      await adminMutation({
        table: 'students', operation: 'update',
        data: { name_en: f.studentName.trim() || null }, match: { id: single.studentId },
      });
      if (teacherId) {
        await adminMutation({
          table: 'teachers', operation: 'update',
          data: { name_en: f.teacherName.trim() || null }, match: { id: teacherId },
        });
      }
    } catch (e: any) {
      toast.error(e?.message || 'บันทึกชื่อไม่สำเร็จ (แต่พิมพ์ต่อให้)');
    }
  };

  // ── batch ─────────────────────────────────────────────────────────────────
  const openBatch = async () => {
    setBusy(true);
    try {
      const reports = await Promise.all(
        students.map((s) => loadCertFields(REPORT_ENDPOINT, { studentId: s.id, classId })
          .then((fields) => ({ s, fields }))
          .catch(() => null))
      );
      const ok = reports.filter(Boolean) as { s: PrintStudent; fields: CertificateFields }[];
      if (ok.length === 0) {
        toast.error('ไม่สามารถโหลดข้อมูลประกาศนียบัตรได้');
        return;
      }
      setRows(ok.map(({ s, fields }) => ({
        studentId: s.id,
        thaiName: s.name,
        studentName: fields.studentName,
        subjectName: fields.subjectName,
        teacherName: fields.teacherName,
        date: fields.date,
      })));
      // Subject / teacher / date are the same across the class → seed shared from the first.
      const first = ok[0].fields;
      setShared({ subjectName: first.subjectName, teacherName: first.teacherName, date: first.date });
      setView('batch');
    } finally {
      setBusy(false);
    }
  };

  const setRow = (i: number, key: keyof BatchRow, val: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const printBatch = async () => {
    setBusy(true);
    try {
      // Save each student's EN name (+ teacher once) then print all in one file.
      await Promise.all(
        rows.map((r) => adminMutation({
          table: 'students', operation: 'update',
          data: { name_en: r.studentName.trim() || null }, match: { id: r.studentId },
        }))
      );
      if (teacherId) {
        await adminMutation({
          table: 'teachers', operation: 'update',
          data: { name_en: shared.teacherName.trim() || null }, match: { id: teacherId },
        });
      }
      // Shared subject / teacher / date on every cert; only the EN student name varies.
      const list: CertificateFields[] = rows.map((r) => ({
        subjectName: shared.subjectName,
        studentName: r.studentName,
        teacherName: shared.teacherName,
        date: shared.date,
      }));
      printCertificatesFields(list);
    } catch (e: any) {
      toast.error(e?.message || 'พิมพ์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={view === 'single' ? 'max-w-4xl max-h-[92vh] overflow-y-auto'
        : view === 'batch' ? 'max-w-4xl max-h-[88vh] flex flex-col'
        : 'max-w-md max-h-[85vh] flex flex-col'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view !== 'list' && (
              <button onClick={() => setView('list')} className="hover:opacity-70">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <Award className="h-5 w-5" />
            {view === 'batch' ? 'ประกาศนียบัตร — กรอกชื่อทั้งคลาส' : 'พิมพ์ประกาศนียบัตร'}
          </DialogTitle>
        </DialogHeader>

        {/* LIST */}
        {view === 'list' && (
          <>
            <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
              {students.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">คลาสนี้ยังไม่มีนักเรียน</p>
              )}
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSingle(s.id)}
                  disabled={busy}
                  className="w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-2 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  <StudentBadge name={s.nickname ? `${s.name} (${s.nickname})` : s.name} />
                  {s.parentName && (
                    <ParentBadge name={s.parentName} size="sm" />
                  )}
                </button>
              ))}
            </div>
            {students.length > 0 && (
              <div className="pt-3 border-t flex justify-end">
                <Button onClick={openBatch} disabled={busy}>
                  <Users className="h-4 w-4 mr-2" />
                  พิมพ์ทั้งหมด ({students.length} คน)
                </Button>
              </div>
            )}
          </>
        )}

        {/* SINGLE */}
        {view === 'single' && single && (
          <CertificateEditor
            value={single.fields}
            onChange={(f) => setSingle({ ...single, fields: f })}
            onBeforePrint={saveSingleNames}
          />
        )}

        {/* BATCH */}
        {view === 'batch' && (
          <>
            <p className="text-sm text-muted-foreground">
              วิชา / วันที่ / ชื่อครู ใช้ร่วมกันทุกใบ — กรอกชื่อภาษาอังกฤษของนักเรียนแต่ละคนด้านล่าง (ระบบจะบันทึกให้อัตโนมัติเมื่อพิมพ์)
            </p>

            {/* Shared fields — same on every certificate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b">
              <div>
                <label className="text-xs font-medium text-muted-foreground">วิชา (บนใบ)</label>
                <Input
                  value={shared.subjectName}
                  onChange={(e) => setShared((s) => ({ ...s, subjectName: e.target.value }))}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">ชื่อครู (บนใบ)</label>
                <Input
                  value={shared.teacherName}
                  onChange={(e) => setShared((s) => ({ ...s, teacherName: e.target.value }))}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">วันที่ (บนใบ)</label>
                <Input
                  value={shared.date}
                  onChange={(e) => setShared((s) => ({ ...s, date: e.target.value }))}
                  className="h-9 mt-1"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2 font-medium">นักเรียน (ไทย)</th>
                    <th className="py-2 font-medium">ชื่อบนใบ (อังกฤษ)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.studentId} className="border-b last:border-0">
                      <td className="py-2 pr-2 align-middle whitespace-nowrap text-muted-foreground">{r.thaiName}</td>
                      <td className="py-1.5">
                        <Input
                          value={r.studentName}
                          onChange={(e) => setRow(i, 'studentName', e.target.value)}
                          placeholder="เช่น Somchai Jaidee"
                          className="h-8"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pt-3 border-t flex justify-end">
              <Button onClick={printBatch} disabled={busy}>
                <Printer className="h-4 w-4 mr-2" />
                {busy ? 'กำลังพิมพ์...' : `พิมพ์ทั้งหมด (${rows.length} ใบ)`}
              </Button>
            </div>
          </>
        )}

        {busy && view === 'list' && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
            <Loading text="กำลังโหลด..." />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

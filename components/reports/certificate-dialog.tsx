'use client';

// Certificate dialog for the auto path (from a completed class). Loads the
// report, prefills the editor (English name preferred, Thai fallback), lets the
// admin tweak the fields, and on demand saves the edited English names back to
// students.name_en / teachers.name_en so future prints are correct.

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CertificateEditor } from '@/components/reports/certificate-editor';
import { loadCertFields } from '@/lib/reports/print-student-report';
import type { CertificateFields } from '@/components/reports/certificate-template';
import { adminMutation } from '@/lib/admin-mutation';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  classId: string;
  /** Teacher id of the class default teacher — needed to save teacher.name_en. */
  teacherId?: string;
}

export function CertificateDialog({ open, onOpenChange, studentId, classId, teacherId }: Props) {
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<CertificateFields | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFields(null);
    setLoading(true);
    loadCertFields('/api/admin/reports/student-report', { studentId, classId })
      .then(setFields)
      .catch((e: any) => {
        toast.error(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, studentId, classId, onOpenChange]);

  // Save the edited English names back to the DB (student + class teacher).
  const handleSaveNames = async () => {
    if (!fields) return;
    setSaving(true);
    try {
      await adminMutation({
        table: 'students',
        operation: 'update',
        data: { name_en: fields.studentName.trim() || null },
        match: { id: studentId },
      });
      if (teacherId) {
        await adminMutation({
          table: 'teachers',
          operation: 'update',
          data: { name_en: fields.teacherName.trim() || null },
          match: { id: teacherId },
        });
      }
      toast.success('บันทึกชื่อภาษาอังกฤษเรียบร้อย');
    } catch (e: any) {
      toast.error(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ใบประกาศนียบัตร</DialogTitle>
        </DialogHeader>

        {loading || !fields ? (
          <div className="py-16 flex justify-center">
            <Loading text="กำลังโหลดข้อมูล..." />
          </div>
        ) : (
          <CertificateEditor
            value={fields}
            onChange={setFields}
            actions={
              <Button variant="outline" onClick={handleSaveNames} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'กำลังบันทึก...' : 'บันทึกชื่อ EN'}
              </Button>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

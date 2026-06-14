'use client';

// Print buttons for the class detail header. Two documents, each opening its own
// dialog (pick a student or print the whole class):
//   - Teacher-feedback report → ReportPrintDialog
//   - Certificate → CertificatePrintDialog (no completion gate — printable anytime)

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Award } from 'lucide-react';
import { ReportPrintDialog, type PrintStudent } from '@/components/reports/report-print-dialog';
import { CertificatePrintDialog } from '@/components/reports/certificate-print-dialog';

interface Props {
  classId: string;
  teacherId?: string;
  isCompleted: boolean;
  students: PrintStudent[];
}

export function ClassPrintMenu({ classId, teacherId, isCompleted, students }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setReportOpen(true)}>
        <FileText className="h-4 w-4 mr-2" />
        รายงาน
      </Button>
      <Button variant="outline" onClick={() => setCertOpen(true)}>
        <Award className="h-4 w-4 mr-2" />
        ประกาศนียบัตร
      </Button>

      <ReportPrintDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        classId={classId}
        students={students}
      />
      <CertificatePrintDialog
        open={certOpen}
        onOpenChange={setCertOpen}
        classId={classId}
        teacherId={teacherId}
        students={students}
      />
    </>
  );
}

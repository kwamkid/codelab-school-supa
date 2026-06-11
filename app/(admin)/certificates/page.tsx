'use client';

// Manual certificate page — admin types in the four fields and prints.
// Useful for older / back-dated courses that aren't tracked as enrollments.
// (The auto path lives on the enrollment detail page.)

import { useState } from 'react';
import { Award, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { CertificateEditor, printCertificate } from '@/components/reports/certificate-editor';
import { certDate } from '@/components/reports/certificate-template';
import type { CertificateFields } from '@/components/reports/certificate-template';

export default function CertificatesPage() {
  const [fields, setFields] = useState<CertificateFields>({
    subjectName: '',
    studentName: '',
    teacherName: '',
    date: certDate(new Date().toISOString()), // today, DD/MM/YYYY
  });

  return (
    <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
      <div className="space-y-6">
        <PageHeader
          title="พิมพ์ใบประกาศนียบัตร"
          description="กรอกข้อมูลเพื่อออกใบประกาศนียบัตร (สำหรับคอร์สย้อนหลังหรือกรณีพิเศษ)"
          icon={Award}
          iconColor="text-orange-500"
          action={
            <Button onClick={() => printCertificate(fields)}>
              <Printer className="h-4 w-4 mr-2" />
              พิมพ์ใบประกาศนียบัตร
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลใบประกาศนียบัตร</CardTitle>
          </CardHeader>
          <CardContent>
            <CertificateEditor value={fields} onChange={setFields} hidePrintButton />
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}

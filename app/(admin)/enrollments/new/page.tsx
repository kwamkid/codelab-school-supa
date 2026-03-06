'use client';

import { Suspense } from 'react';
import UnifiedEnrollmentForm from '@/components/enrollments/unified-enrollment-form';
import { SectionLoading } from '@/components/ui/loading';

export default function NewEnrollmentPage() {
  return (
    <div>
      <Suspense fallback={<SectionLoading text="กำลังโหลด..." />}>
        <UnifiedEnrollmentForm />
      </Suspense>
    </div>
  );
}

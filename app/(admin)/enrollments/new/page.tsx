'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CompactEnrollmentForm } from '@/components/shared/compact-enrollment-form';
import { SectionLoading } from '@/components/ui/loading';
import { useBranch } from '@/contexts/BranchContext';

function EnrollmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranchId } = useBranch();

  const prefill = {
    parentId: searchParams.get('parentId') || undefined,
    parentName: searchParams.get('name') || undefined,
    parentPhone: searchParams.get('phone') || undefined,
    contactId: searchParams.get('contactId') || undefined,
    conversationId: searchParams.get('conversationId') || undefined,
    branchId: selectedBranchId || undefined,
    // Trial params
    from: searchParams.get('from') || undefined,
    bookingId: searchParams.get('bookingId') || undefined,
    sessionId: searchParams.get('sessionId') || undefined,
  };

  return (
    <div className="p-6">
      <CompactEnrollmentForm
        context="admin"
        prefill={prefill}
        onSuccess={({ enrollmentId }) => router.push(`/enrollments/${enrollmentId}`)}
        onCancel={() => router.back()}
      />
    </div>
  );
}

export default function NewEnrollmentPage() {
  return (
    <Suspense fallback={<SectionLoading text="กำลังโหลด..." />}>
      <EnrollmentPageContent />
    </Suspense>
  );
}

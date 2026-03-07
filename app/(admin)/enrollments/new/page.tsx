'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import UnifiedEnrollmentForm from '@/components/enrollments/unified-enrollment-form';
import { CompactEnrollmentForm } from '@/components/shared/compact-enrollment-form';
import { SectionLoading } from '@/components/ui/loading';
import { useBranch } from '@/contexts/BranchContext';

function EnrollmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranchId } = useBranch();
  const from = searchParams.get('from');

  // From chat → use compact form
  if (from === 'chat') {
    const prefill = {
      parentId: searchParams.get('parentId') || undefined,
      parentName: searchParams.get('name') || undefined,
      parentPhone: searchParams.get('phone') || undefined,
      contactId: searchParams.get('contactId') || undefined,
      conversationId: searchParams.get('conversationId') || undefined,
      branchId: selectedBranchId || undefined,
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

  // Default → full wizard
  return (
    <div>
      <UnifiedEnrollmentForm />
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

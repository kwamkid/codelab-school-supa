'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrialBookingForm } from '@/components/shared/trial-booking-form';
import { SectionLoading } from '@/components/ui/loading';
import { useBranch } from '@/contexts/BranchContext';

function TrialBookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranchId } = useBranch();

  const prefill = {
    parentName: searchParams.get('name') || undefined,
    parentPhone: searchParams.get('phone') || undefined,
    parentEmail: searchParams.get('email') || undefined,
    parentId: searchParams.get('parentId') || undefined,
    contactId: searchParams.get('contactId') || undefined,
    conversationId: searchParams.get('conversationId') || undefined,
    branchId: selectedBranchId || undefined,
  };

  return (
    <div className="p-6">
      <TrialBookingForm
        context="admin"
        prefill={prefill}
        onSuccess={(bookingId) => router.push(`/trial/${bookingId}`)}
        onCancel={() => router.back()}
      />
    </div>
  );
}

export default function CreateTrialBookingPage() {
  return (
    <Suspense fallback={<SectionLoading text="กำลังโหลด..." />}>
      <TrialBookingPageContent />
    </Suspense>
  );
}

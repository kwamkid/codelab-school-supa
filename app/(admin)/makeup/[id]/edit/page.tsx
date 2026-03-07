'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { SectionLoading } from '@/components/ui/loading';
import CreateMakeupForm from '@/components/makeup/create-makeup-form';

function EditMakeupPageContent() {
  const params = useParams();
  const id = params.id as string;
  return <CreateMakeupForm mode="edit" makeupId={id} />;
}

export default function EditMakeupPage() {
  return (
    <Suspense fallback={<SectionLoading text="กำลังโหลด..." />}>
      <EditMakeupPageContent />
    </Suspense>
  );
}

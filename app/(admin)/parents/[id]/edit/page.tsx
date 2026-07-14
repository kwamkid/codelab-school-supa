'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SectionLoading } from '@/components/ui/loading';

// The dedicated edit page was merged into the parent detail page (/parents/[id])
// which now edits inline. Redirect old links/bookmarks there in edit mode.
export default function EditParentRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params.id) {
      router.replace(`/parents/${params.id}`);
    }
  }, [params.id, router]);

  return <SectionLoading text="กำลังเปิดหน้าแก้ไข..." />;
}

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MakeupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/makeup/${id}/edit`);
  }, [id, router]);

  return null;
}

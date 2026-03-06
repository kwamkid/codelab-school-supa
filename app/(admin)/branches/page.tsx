'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BranchesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/branches');
  }, [router]);

  return null;
}

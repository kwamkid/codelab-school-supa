'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SectionLoading } from '@/components/ui/loading';

function FirebaseAuthActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    
    console.log('Firebase Action - Mode:', mode);
    console.log('Firebase Action - Code:', oobCode);
    
    if (mode === 'resetPassword' && oobCode) {
      router.push(`/reset-password?oobCode=${oobCode}`);
    } else if (mode === 'verifyEmail' && oobCode) {
      router.push(`/verify-email?oobCode=${oobCode}`);
    } else {
      console.error('Invalid action mode:', mode);
      router.push('/login');
    }
  }, [router, searchParams]);
  
  return (
    <SectionLoading text="กำลังดำเนินการ..." />
  );
}

export default function FirebaseAuthActionPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={
        <SectionLoading text="กำลังโหลด..." />
      }>
        <FirebaseAuthActionContent />
      </Suspense>
    </div>
  );
}
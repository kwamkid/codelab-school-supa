// app/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SectionLoading } from '@/components/ui/loading';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading) {
      if (user) {
        // ถ้า login แล้ว ไปหน้า dashboard
        router.push('/dashboard');
      } else {
        // ถ้ายังไม่ login ไปหน้า login
        router.push('/login');
      }
    }
  }, [user, loading, router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SectionLoading text="กำลังโหลด..." />
    </div>
  );
}
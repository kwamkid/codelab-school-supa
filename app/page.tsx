// app/page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

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
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-red-500" />
        <p className="text-gray-600">กำลังโหลด...</p>
      </div>
    </div>
  );
}
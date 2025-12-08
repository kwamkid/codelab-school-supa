'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/components/liff/liff-provider';
import { Loader2 } from 'lucide-react';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function AuthWrapper({ children, requireAuth = true }: AuthWrapperProps) {
  const router = useRouter();
  const { isLoggedIn, isLoading, liff } = useLiff();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for LIFF to finish loading
      if (isLoading) {
        return;
      }

      // If require auth and not logged in
      if (requireAuth && !isLoggedIn && liff) {
        console.log('[AuthWrapper] Not logged in, redirecting to login...');
        // Redirect to login
        liff.login();
        return;
      }

      // Auth check complete
      setIsChecking(false);
    };

    checkAuth();
  }, [isLoading, isLoggedIn, requireAuth, liff]);

  // Show loading while checking
  if (isLoading || (requireAuth && isChecking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // If auth is required but not logged in, show nothing (will redirect)
  if (requireAuth && !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังนำไปหน้าเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
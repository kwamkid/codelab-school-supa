'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/components/liff/liff-provider';
import { SectionLoading } from '@/components/ui/loading';

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
        <SectionLoading text="กำลังตรวจสอบสิทธิ์..." />
      </div>
    );
  }

  // If auth is required but not logged in, show nothing (will redirect)
  if (requireAuth && !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <SectionLoading text="กำลังนำไปหน้าเข้าสู่ระบบ..." />
      </div>
    );
  }

  return <>{children}</>;
}
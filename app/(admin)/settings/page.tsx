'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SettingsPage from '@/components/settings/settings-page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function Page() {
  const { adminUser, canManageSettings, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // ถ้าโหลดเสร็จแล้วและไม่มีสิทธิ์ ให้ redirect
    if (!loading && !canManageSettings()) {
      // ไม่ redirect ทันที เพื่อให้ user เห็นข้อความก่อน
      console.log('User does not have permission to manage settings');
    }
  }, [loading, canManageSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // ถ้าไม่มีสิทธิ์ แสดงหน้า Access Denied
  if (!canManageSettings()) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เข้าถึง</AlertTitle>
          <AlertDescription className="mt-2">
            คุณไม่มีสิทธิ์ในการจัดการการตั้งค่าระบบ
            {adminUser?.role === 'teacher' && (
              <span className="block mt-2">
                เฉพาะ Admin เท่านั้นที่สามารถเข้าถึงหน้านี้ได้
              </span>
            )}
            {adminUser?.role === 'branch_admin' && !adminUser?.permissions?.canManageSettings && (
              <span className="block mt-2">
                Branch Admin ของคุณไม่ได้รับอนุญาตให้จัดการการตั้งค่า กรุณาติดต่อ Super Admin
              </span>
            )}
          </AlertDescription>
        </Alert>

        <div className="text-center space-y-4">
          <p className="text-gray-600">
            หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button variant="outline">
                <ChevronLeft className="h-4 w-4 mr-2" />
                กลับหน้า Dashboard
              </Button>
            </Link>
            
            <Button 
              onClick={() => router.back()}
              variant="default"
              className="bg-red-500 hover:bg-red-600"
            >
              กลับหน้าก่อนหน้า
            </Button>
          </div>
        </div>

        {/* แสดงข้อมูล Debug สำหรับ Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm font-mono text-gray-600">
              Debug Info:
              <br />
              Role: {adminUser?.role}
              <br />
              Can Manage Settings: {adminUser?.permissions?.canManageSettings ? 'true' : 'false'}
              <br />
              Is Super Admin: {adminUser?.role === 'super_admin' ? 'true' : 'false'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ถ้ามีสิทธิ์ แสดงหน้า Settings ปกติ
  return <SettingsPage />;
}
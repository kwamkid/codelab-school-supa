'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ChevronLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { SectionLoading } from '@/components/ui/loading';
import { useRouter } from 'next/navigation';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { adminUser, canManageSettings, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <SectionLoading text="กำลังตรวจสอบสิทธิ์..." />;
  }

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
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8 text-red-500" />
          ตั้งค่าระบบ
        </h1>
        <p className="text-gray-600 mt-2">จัดการการตั้งค่าต่างๆ ของระบบ</p>
      </div>
      {children}
    </div>
  );
}

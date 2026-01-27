import ParentForm from '@/components/parents/parent-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewParentPage() {
  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/parents" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการผู้ปกครอง
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">เพิ่มผู้ปกครองใหม่</h1>
        <p className="text-gray-600 mt-2">กรอกข้อมูลผู้ปกครอง</p>
      </div>

      <ParentForm />
    </div>
  );
}
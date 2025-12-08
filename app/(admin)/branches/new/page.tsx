import BranchForm from '@/components/branches/branch-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewBranchPage() {
  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/branches" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการสาขา
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">เพิ่มสาขาใหม่</h1>
        <p className="text-gray-600 mt-2">กรอกข้อมูลเพื่อเพิ่มสาขาใหม่ในระบบ</p>
      </div>

      <BranchForm />
    </div>
  );
}
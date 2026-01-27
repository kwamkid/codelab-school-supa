import ClassForm from '@/components/classes/class-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewClassPage() {
  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/classes" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการคลาส
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">สร้างคลาสใหม่</h1>
        <p className="text-gray-600 mt-2">กรอกข้อมูลเพื่อสร้างคลาสเรียนใหม่</p>
      </div>

      <ClassForm />
    </div>
  );
}
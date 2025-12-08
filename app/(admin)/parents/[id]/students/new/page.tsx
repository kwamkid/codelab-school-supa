'use client';

import { useParams } from 'next/navigation';
import StudentForm from '@/components/students/student-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewStudentPage() {
  const params = useParams();
  const parentId = params.id as string;

  return (
    <div>
      <div className="mb-6">
        <Link 
          href={`/parents/${parentId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้าข้อมูลผู้ปกครอง
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">เพิ่มข้อมูลนักเรียน</h1>
        <p className="text-gray-600 mt-2">กรอกข้อมูลนักเรียนใหม่</p>
      </div>

      <StudentForm parentId={parentId} />
    </div>
  );
}
'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import StudentForm from '@/components/students/student-form';
import { SectionLoading } from '@/components/ui/loading';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

function NewStudentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const parentId = params.id as string;
  // Where we came from (list vs detail). Falls back to the parent detail page.
  const returnTo = searchParams.get('returnTo') || `/parents/${parentId}`;
  const backLabel = returnTo.includes(`/parents/${parentId}`)
    ? 'กลับไปหน้าข้อมูลผู้ปกครอง'
    : 'กลับ';

  return (
    <div>
      <div className="mb-6">
        <Link
          href={returnTo}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {backLabel}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">เพิ่มข้อมูลนักเรียน</h1>
        <p className="text-gray-600 mt-1">กรอกข้อมูลนักเรียนใหม่</p>
      </div>

      <StudentForm parentId={parentId} returnTo={returnTo} />
    </div>
  );
}

export default function NewStudentPage() {
  return (
    <Suspense fallback={<SectionLoading />}>
      <NewStudentContent />
    </Suspense>
  );
}
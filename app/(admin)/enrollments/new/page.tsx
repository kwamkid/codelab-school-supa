'use client';

import { useState } from 'react';
import EnrollmentForm from '@/components/enrollments/enrollment-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useBranch } from '@/contexts/BranchContext';

export default function NewEnrollmentPage() {
  const { selectedBranchId, isAllBranches } = useBranch();

  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/enrollments" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการลงทะเบียน
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          ลงทะเบียนเรียน
          {!isAllBranches && <span className="text-red-600 text-lg ml-2">(สาขาที่เลือก)</span>}
        </h1>
        <p className="text-gray-600 mt-2">
          ลงทะเบียนนักเรียนเข้าเรียนในคลาส
          {!isAllBranches && selectedBranchId && (
            <span className="text-red-600"> - เฉพาะคลาสในสาขาที่เลือกเท่านั้น</span>
          )}
        </p>
      </div>

      <EnrollmentForm />
    </div>
  );
}
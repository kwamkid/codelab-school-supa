'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Subject } from '@/types/models';
import { getSubject } from '@/lib/services/subjects';
import SubjectForm from '@/components/subjects/subject-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditSubjectPage() {
  const params = useParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadSubject(params.id as string);
    }
  }, [params.id]);

  const loadSubject = async (id: string) => {
    try {
      const data = await getSubject(id);
      setSubject(data);
    } catch (error) {
      console.error('Error loading subject:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลวิชา</p>
        <Link href="/subjects" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการวิชา
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/subjects" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการวิชา
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">แก้ไขข้อมูลวิชา</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูลวิชา {subject.name}</p>
      </div>

      <SubjectForm subject={subject} isEdit />
    </div>
  );
}
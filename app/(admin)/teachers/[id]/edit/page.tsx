'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Teacher } from '@/types/models';
import { getTeacher } from '@/lib/services/teachers';
import TeacherForm from '@/components/teachers/teacher-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { SectionLoading } from '@/components/ui/loading';

export default function EditTeacherPage() {
  const params = useParams();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadTeacher(params.id as string);
    }
  }, [params.id]);

  const loadTeacher = async (id: string) => {
    try {
      const data = await getTeacher(id);
      setTeacher(data);
    } catch (error) {
      console.error('Error loading teacher:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
  }

  if (!teacher) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลครู</p>
        <Link href="/teachers" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการครู
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          href="/teachers" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการครู
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">แก้ไขข้อมูลครู</h1>
        <p className="text-gray-600 mt-1">แก้ไขข้อมูล {teacher.name}</p>
      </div>

      <TeacherForm teacher={teacher} isEdit />
    </div>
  );
}
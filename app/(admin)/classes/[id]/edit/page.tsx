'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Class } from '@/types/models';
import { getClass } from '@/lib/services/classes';
import ClassForm from '@/components/classes/class-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditClassPage() {
  const params = useParams();
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadClass(params.id as string);
    }
  }, [params.id]);

  const loadClass = async (id: string) => {
    try {
      const data = await getClass(id);
      setClassData(data);
    } catch (error) {
      console.error('Error loading class:', error);
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

  if (!classData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลคลาส</p>
        <Link href="/classes" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการคลาส
        </Link>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold text-gray-900">แก้ไขข้อมูลคลาส</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูล {classData.name}</p>
      </div>

      <ClassForm classData={classData} isEdit />
    </div>
  );
}
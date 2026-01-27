'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Parent } from '@/types/models';
import { getParent } from '@/lib/services/parents';
import ParentForm from '@/components/parents/parent-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditParentPage() {
  const params = useParams();
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadParent(params.id as string);
    }
  }, [params.id]);

  const loadParent = async (id: string) => {
    try {
      const data = await getParent(id);
      setParent(data);
    } catch (error) {
      console.error('Error loading parent:', error);
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

  if (!parent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลผู้ปกครอง</p>
        <Link href="/parents" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการผู้ปกครอง
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          href={`/parents/${params.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้าข้อมูลผู้ปกครอง
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">แก้ไขข้อมูลผู้ปกครอง</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูล {parent.displayName}</p>
      </div>

      <ParentForm parent={parent} isEdit />
    </div>
  );
}
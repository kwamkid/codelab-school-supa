'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Branch } from '@/types/models';
import { getBranch } from '@/lib/services/branches';
import BranchForm from '@/components/branches/branch-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditBranchPage() {
  const params = useParams();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadBranch(params.id as string);
    }
  }, [params.id]);

  const loadBranch = async (id: string) => {
    try {
      const data = await getBranch(id);
      setBranch(data);
    } catch (error) {
      console.error('Error loading branch:', error);
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

  if (!branch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลสาขา</p>
        <Link href="/branches" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการสาขา
        </Link>
      </div>
    );
  }

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
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">แก้ไขข้อมูลสาขา</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูลสาขา {branch.name}</p>
      </div>

      <BranchForm branch={branch} isEdit />
    </div>
  );
}
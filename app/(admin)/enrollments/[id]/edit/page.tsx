'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Enrollment } from '@/types/models';
import { getEnrollment } from '@/lib/services/enrollments';
import EnrollmentEditForm from '@/components/enrollments/enrollment-edit-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

export default function EditEnrollmentPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.id as string;
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const { canViewBranch } = useBranch();

  useEffect(() => {
    if (enrollmentId) {
      loadEnrollment();
    }
  }, [enrollmentId]);

  const loadEnrollment = async () => {
    try {
      const data = await getEnrollment(enrollmentId);
      if (!data) {
        toast.error('ไม่พบข้อมูลการลงทะเบียน');
        router.push('/enrollments');
        return;
      }
      
      // Check if user can view this enrollment's branch
      if (!canViewBranch(data.branchId)) {
        toast.error('คุณไม่มีสิทธิ์แก้ไขการลงทะเบียนนี้');
        router.push('/enrollments');
        return;
      }
      
      setEnrollment(data);
    } catch (error) {
      console.error('Error loading enrollment:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
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

  if (!enrollment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลการลงทะเบียน</p>
        <Link href="/enrollments" className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้ารายการลงทะเบียน
        </Link>
      </div>
    );
  }

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
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">แก้ไขข้อมูลการลงทะเบียน</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูลการลงทะเบียนและการชำระเงิน</p>
      </div>

      <EnrollmentEditForm enrollment={enrollment} />
    </div>
  );
}
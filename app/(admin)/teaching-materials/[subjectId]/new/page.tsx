'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import TeachingMaterialForm from '@/components/teaching-materials/teaching-material-form';
import { getSubject } from '@/lib/services/subjects';
import { Subject } from '@/types/models';

export default function NewTeachingMaterialPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubject();
  }, [subjectId]);

  const loadSubject = async () => {
    try {
      const data = await getSubject(subjectId);
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
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto" />
          <p className="text-gray-600 mt-4">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/teaching-materials/${subjectId}`}>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">เพิ่มบทเรียนใหม่</h1>
        <p className="text-gray-600 mt-1">
          วิชา: {subject?.name || 'ไม่ระบุ'}
        </p>
      </div>
      
      <TeachingMaterialForm subjectId={subjectId} />
    </div>
  );
}
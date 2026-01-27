'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import TeachingMaterialForm from '@/components/teaching-materials/teaching-material-form';
import { getTeachingMaterial } from '@/lib/services/teaching-materials';
import { getSubject } from '@/lib/services/subjects';
import { TeachingMaterial, Subject } from '@/types/models';

export default function EditTeachingMaterialPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const materialId = params.materialId as string;
  
  const [material, setMaterial] = useState<TeachingMaterial | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [subjectId, materialId]);

  const loadData = async () => {
    try {
      const [materialData, subjectData] = await Promise.all([
        getTeachingMaterial(materialId),
        getSubject(subjectId)
      ]);
      setMaterial(materialData);
      setSubject(subjectData);
    } catch (error) {
      console.error('Error loading data:', error);
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

  if (!material) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลสื่อการสอน</p>
        <Link href={`/teaching-materials/${subjectId}`}>
          <Button className="mt-4">กลับ</Button>
        </Link>
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
        <h1 className="text-xl sm:text-3xl font-bold">แก้ไขบทเรียน</h1>
        <p className="text-gray-600 mt-1">
          วิชา: {subject?.name || 'ไม่ระบุ'} - {material.title}
        </p>
      </div>
      
      <TeachingMaterialForm 
        subjectId={subjectId} 
        material={material} 
        isEdit 
      />
    </div>
  );
}
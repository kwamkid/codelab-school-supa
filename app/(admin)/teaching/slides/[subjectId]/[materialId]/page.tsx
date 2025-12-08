'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSubject } from '@/lib/services/subjects';
import { getTeachingMaterial } from '@/lib/services/teaching-materials';
import { Subject, TeachingMaterial } from '@/types/models';
import SecureSlideViewer from '@/components/teaching/secure-slide-viewer';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SlideViewerPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.subjectId as string;
  const materialId = params.materialId as string;
  
  const [subject, setSubject] = useState<Subject | null>(null);
  const [material, setMaterial] = useState<TeachingMaterial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [subjectId, materialId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [subjectData, materialData] = await Promise.all([
        getSubject(subjectId),
        getTeachingMaterial(materialId)
      ]);
      
      if (!subjectData || !materialData) {
        toast.error('ไม่พบข้อมูลบทเรียน');
        router.push(`/teaching/slides/${subjectId}`);
        return;
      }
      
      // Verify material belongs to subject
      if (materialData.subjectId !== subjectId) {
        toast.error('บทเรียนไม่ตรงกับวิชา');
        router.push(`/teaching/slides/${subjectId}`);
        return;
      }
      
      setSubject(subjectData);
      setMaterial(materialData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
      router.push(`/teaching/slides/${subjectId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push(`/teaching/slides/${subjectId}`);
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

  if (!subject || !material) {
    return null;
  }

  // Create class info for slide viewer
  const classInfo = {
    id: 'teaching',
    name: subject.name,
    code: subject.code,
    subjectId: subject.id,
    teacherId: '',
    branchId: '',
    roomId: '',
    startDate: new Date(),
    endDate: new Date(),
    totalSessions: 0,
    daysOfWeek: [],
    startTime: '',
    endTime: '',
    maxStudents: 0,
    minStudents: 0,
    enrolledCount: 0,
    pricing: {
      pricePerSession: 0,
      totalPrice: 0
    },
    status: 'started' as const,
    createdAt: new Date()
  };

  return (
    <SecureSlideViewer
      material={material}
      classInfo={classInfo}
      onBack={handleBack}
    />
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Student } from '@/types/models';
import { getStudent } from '@/lib/services/parents';
import StudentForm from '@/components/students/student-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditStudentPage() {
  const params = useParams();
  const parentId = params.id as string;
  const studentId = params.studentId as string;
  
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (parentId && studentId) {
      loadStudent();
    }
  }, [parentId, studentId]);

  const loadStudent = async () => {
    try {
      const data = await getStudent(parentId, studentId);
      setStudent(data);
    } catch (error) {
      console.error('Error loading student:', error);
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

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ไม่พบข้อมูลนักเรียน</p>
        <Link href={`/parents/${parentId}`} className="text-red-500 hover:text-red-600 mt-4 inline-block">
          กลับไปหน้าข้อมูลผู้ปกครอง
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          href={`/parents/${parentId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้าข้อมูลผู้ปกครอง
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">แก้ไขข้อมูลนักเรียน</h1>
        <p className="text-gray-600 mt-2">แก้ไขข้อมูล {student.nickname || student.name}</p>
      </div>

      <StudentForm parentId={parentId} student={student} isEdit />
    </div>
  );
}
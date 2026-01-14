'use client';

import { useEffect, useState } from 'react';
import { Subject } from '@/types/models';
import { getSubjects } from '@/lib/services/subjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, BookOpen, Code, Cpu, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';

const categoryIcons = {
  'Coding': Code,
  'Robotics': Cpu,
  'AI': Sparkles,
  'Other': BookOpen,
};

const categoryColors = {
  'Coding': 'bg-blue-100 text-blue-700',
  'Robotics': 'bg-green-100 text-green-700',
  'AI': 'bg-purple-100 text-purple-700',
  'Other': 'bg-gray-100 text-gray-700',
};

const levelColors = {
  'Beginner': 'bg-emerald-100 text-emerald-700',
  'Intermediate': 'bg-amber-100 text-amber-700',
  'Advanced': 'bg-red-100 text-red-700',
};

export default function SubjectsPage() {
  const { isSuperAdmin } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast.error('ไม่สามารถโหลดข้อมูลวิชาได้');
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = selectedCategory === 'all' 
    ? subjects 
    : subjects.filter(s => s.category === selectedCategory);

  const categoryCounts = subjects.reduce((acc, subject) => {
    acc[subject.category] = (acc[subject.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">จัดการวิชาเรียน</h1>
          <p className="text-gray-600 mt-2">จัดการหลักสูตรและวิชาที่เปิดสอน</p>
        </div>
        <PermissionGuard requiredRole={['super_admin']}>
          <Link href="/subjects/new">
            <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มวิชาใหม่
            </ActionButton>
          </Link>
        </PermissionGuard>
      </div>

      {/* Alert for non-super admin */}
      {!isSuperAdmin() && (
        <Alert className="mb-6">
          <AlertDescription>
            คุณสามารถดูข้อมูลวิชาได้เท่านั้น การเพิ่มหรือแก้ไขวิชาต้องติดต่อ Super Admin
          </AlertDescription>
        </Alert>
      )}

      {/* Category Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card 
          className={`cursor-pointer transition-all ${selectedCategory === 'all' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
          onClick={() => setSelectedCategory('all')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>ทั้งหมด</span>
              <BookOpen className="h-4 w-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subjects.length}</div>
          </CardContent>
        </Card>

        {Object.entries(categoryIcons).map(([category, Icon]) => (
          <Card 
            key={category}
            className={`cursor-pointer transition-all ${selectedCategory === category ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedCategory(category)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{category}</span>
                <Icon className="h-4 w-4 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoryCounts[category] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subjects Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCategory === 'all' ? 'รายการวิชาทั้งหมด' : `วิชา ${selectedCategory}`}
            <span className="text-sm font-normal text-gray-500 ml-2">
              (ข้อมูลกลางใช้ร่วมกันทุกสาขา)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedCategory === 'all' ? 'ยังไม่มีวิชา' : `ยังไม่มีวิชา ${selectedCategory}`}
              </h3>
              <p className="text-gray-600 mb-4">เริ่มต้นด้วยการเพิ่มวิชาแรก</p>
              <PermissionGuard requiredRole={['super_admin']}>
                <Link href="/subjects/new">
                  <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มวิชาใหม่
                  </ActionButton>
                </Link>
              </PermissionGuard>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสวิชา</TableHead>
                  <TableHead>ชื่อวิชา</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>ระดับ</TableHead>
                  <TableHead className="text-center">ช่วงอายุ</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((subject) => {
                  const CategoryIcon = categoryIcons[subject.category as keyof typeof categoryIcons];
                  
                  return (
                    <TableRow key={subject.id} className={!subject.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{subject.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: subject.color }}
                          />
                          {subject.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryColors[subject.category as keyof typeof categoryColors]}>
                          <CategoryIcon className="h-3 w-3 mr-1" />
                          {subject.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={levelColors[subject.level as keyof typeof levelColors]}
                        >
                          {subject.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {subject.ageRange.min}-{subject.ageRange.max} ปี
                      </TableCell>
                      <TableCell className="text-center">
                        {subject.isActive ? (
                          <Badge className="bg-green-100 text-green-700">เปิดสอน</Badge>
                        ) : (
                          <Badge variant="destructive">ปิด</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PermissionGuard requiredRole={['super_admin']}>
                          <Link href={`/subjects/${subject.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                        </PermissionGuard>
                        {!isSuperAdmin() && (
                          <span className="text-gray-400 text-xs">ดูอย่างเดียว</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
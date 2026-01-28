'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen,
  ArrowRight,
  Layers,
  Search,
  Loader2
} from 'lucide-react';
import { getActiveSubjects } from '@/lib/services/subjects';
import { getTeachingMaterials } from '@/lib/services/teaching-materials';
import { Subject, TeachingMaterial } from '@/types/models';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';

// Cache key constants
const QUERY_KEYS = {
  subjects: ['subjects', 'active'],
  materials: (subjectId: string) => ['teaching-materials', subjectId],
  allMaterials: ['teaching-materials', 'counts'],
};

// Custom hook to fetch material counts
const useMaterialCounts = (subjects: Subject[]) => {
  return useQuery({
    queryKey: QUERY_KEYS.allMaterials,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      
      // Fetch materials for all subjects in parallel
      const promises = subjects.map(async (subject) => {
        try {
          const materials = await getTeachingMaterials(subject.id);
          counts[subject.id] = materials.filter(m => m.isActive).length;
        } catch (error) {
          counts[subject.id] = 0;
        }
      });
      
      await Promise.all(promises);
      return counts;
    },
    enabled: subjects.length > 0,
    staleTime: 300000, // 5 minutes
  });
};

export default function TeachingMaterialsPage() {
  const router = useRouter();
  const { adminUser, isSuperAdmin, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Permission check - redirect if not super_admin
  useEffect(() => {
    if (!authLoading && adminUser) {
      if (!isSuperAdmin()) {
        router.push('/dashboard');
      }
    }
  }, [authLoading, adminUser, isSuperAdmin, router]);

  // Fetch subjects using React Query
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: QUERY_KEYS.subjects,
    queryFn: getActiveSubjects,
    staleTime: 300000, // 5 minutes
  });

  // Fetch material counts
  const { data: materialCounts = {}, isLoading: loadingCounts } = useMaterialCounts(subjects);

  // Get unique categories with memoization
  const categories = useMemo(() => {
    const uniqueCategories = new Set(subjects.map(s => s.category));
    return ['all', ...Array.from(uniqueCategories)];
  }, [subjects]);

  // Filter and sort subjects with memoization
  const filteredSubjects = useMemo(() => {
    return subjects
      .filter(subject => {
        const matchSearch = 
          subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subject.description.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchCategory = selectedCategory === 'all' || subject.category === selectedCategory;
        
        return matchSearch && matchCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [subjects, searchTerm, selectedCategory]);

  // Group subjects by category with memoization
  const subjectsByCategory = useMemo(() => {
    return filteredSubjects.reduce((acc, subject) => {
      if (!acc[subject.category]) {
        acc[subject.category] = [];
      }
      acc[subject.category].push(subject);
      return acc;
    }, {} as Record<string, Subject[]>);
  }, [filteredSubjects]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Coding':
        return 'bg-blue-100 text-blue-700';
      case 'Robotics':
        return 'bg-green-100 text-green-700';
      case 'AI':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'bg-green-100 text-green-700';
      case 'Intermediate':
        return 'bg-blue-100 text-blue-700';
      case 'Advanced':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Loading state
  const isLoading = loadingSubjects || loadingCounts;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Filters Skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <Skeleton className="h-10 w-full md:w-[200px]" />
              <Skeleton className="h-10 flex-1" />
            </div>
          </CardContent>
        </Card>

        {/* Content Skeleton */}
        <div className="space-y-6">
          {[...Array(3)].map((_, categoryIndex) => (
            <div key={categoryIndex}>
              <Skeleton className="h-6 w-32 mb-3" />
              <div className="space-y-2">
                {[...Array(3)].map((_, itemIndex) => (
                  <Card key={itemIndex}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-20 w-20 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-6 w-48 mb-2" />
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-20" />
                          <Skeleton className="h-9 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold">จัดการสื่อการสอน</h1>
          <p className="text-gray-600 mt-1">เลือกวิชาเพื่อจัดการ Slides และเนื้อหาการสอน</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                {categories.filter(c => c !== 'all').map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="ค้นหาวิชา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subjects List */}
      {Object.keys(subjectsByCategory).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">ไม่พบวิชาที่ตรงกับการค้นหา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(subjectsByCategory).map(([category, categorySubjects]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-3 text-gray-700">{category}</h2>
              
              <div className="space-y-2">
                {categorySubjects.map((subject) => {
                  const materialCount = materialCounts[subject.id] || 0;
                  
                  return (
                    <Card
                      key={subject.id}
                      className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4"
                      style={{ borderLeftColor: subject.color }}
                      onClick={() => router.push(`/teaching-materials/${subject.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Material Count - Big Number */}
                          <div 
                            className="rounded-lg p-4 min-w-[80px] text-center"
                            style={{ 
                              backgroundColor: subject.color + '20',
                              color: subject.color 
                            }}
                          >
                            <div className="text-xl sm:text-3xl font-bold">
                              {materialCount}
                            </div>
                            <div className="text-xs mt-1">
                              บทเรียน
                            </div>
                          </div>
                          
                          {/* Subject Info */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-lg">
                                  {subject.name}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                  {subject.code} • อายุ {subject.ageRange.min}-{subject.ageRange.max} ปี
                                </p>
                                {subject.description && (
                                  <p className="text-sm text-gray-500 mt-2 line-clamp-1">
                                    {subject.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                <Badge 
                                  variant="secondary"
                                  style={{ 
                                    backgroundColor: subject.color + '20',
                                    color: subject.color 
                                  }}
                                >
                                  {subject.level}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="hover:text-white"
                                  style={{ 
                                    color: subject.color,
                                    borderColor: subject.color 
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = subject.color;
                                    e.currentTarget.style.color = 'white';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = subject.color;
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/teaching-materials/${subject.id}`);
                                  }}
                                >
                                  จัดการ
                                  <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
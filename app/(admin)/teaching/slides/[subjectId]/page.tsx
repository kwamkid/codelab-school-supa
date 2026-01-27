'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  Clock,
  Play,
  Search,
  Loader2,
  BookOpen
} from 'lucide-react';
import { getSubject } from '@/lib/services/subjects';
import { getTeachingMaterials } from '@/lib/services/teaching-materials';
import { Subject, TeachingMaterial } from '@/types/models';
import { toast } from 'sonner';

export default function SubjectMaterialsPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.subjectId as string;
  
  const [subject, setSubject] = useState<Subject | null>(null);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [subjectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [subjectData, materialsData] = await Promise.all([
        getSubject(subjectId),
        getTeachingMaterials(subjectId)
      ]);
      
      if (!subjectData) {
        toast.error('ไม่พบข้อมูลวิชา');
        router.push('/teaching/slides');
        return;
      }
      
      setSubject(subjectData);
      const activeMaterials = materialsData
        .filter(m => m.isActive)
        .sort((a, b) => a.sessionNumber - b.sessionNumber);
      setMaterials(activeMaterials);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // Filter materials
  const filteredMaterials = materials.filter(material => {
    const matchSearch = 
      material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.sessionNumber.toString().includes(searchTerm) ||
      material.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchSearch;
  });

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

  if (!subject) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          onClick={() => router.push('/teaching/slides')}
          variant="outline"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับไปเลือกวิชา
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">{subject.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-gray-600">{subject.code}</span>
              <Badge 
                variant="secondary"
                style={{ 
                  backgroundColor: subject.color + '20',
                  color: subject.color 
                }}
              >
                {subject.category}
              </Badge>
              <Badge variant="outline">
                {subject.level}
              </Badge>
              <span className="text-sm text-gray-500">
                {materials.length} บทเรียน
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="ค้นหาบทเรียน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Materials List */}
      {filteredMaterials.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {materials.length === 0 
                ? 'ยังไม่มีบทเรียนสำหรับวิชานี้' 
                : 'ไม่พบบทเรียนที่ตรงกับการค้นหา'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          {filteredMaterials.map((material) => (
            <Card
              key={material.id}
              className="hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => router.push(`/teaching/slides/${subjectId}/${material.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Session Number */}
                    <div 
                      className="rounded-lg px-3 py-2 text-center min-w-[50px]"
                      style={{ 
                        backgroundColor: subject.color + '20',
                        color: subject.color 
                      }}
                    >
                      <div className="text-xl font-bold">
                        {material.sessionNumber}
                      </div>
                    </div>
                    
                    {/* Material Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base line-clamp-2">
                        {material.title}
                      </h3>
                      {material.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {material.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{material.duration} นาที</span>
                        </div>
                        
                        {material.tags && material.tags.length > 0 && (
                          <div className="flex gap-1">
                            {material.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {material.tags.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{material.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Play Button */}
                  <Button
                    size="icon"
                    className="shrink-0"
                    style={{ 
                      backgroundColor: subject.color,
                      borderColor: subject.color
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
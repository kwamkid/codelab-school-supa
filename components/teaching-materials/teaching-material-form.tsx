'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TeachingMaterial } from '@/types/models';
import { 
  createTeachingMaterial, 
  updateTeachingMaterial,
  getNextSessionNumber,
  checkSessionNumberExists,
  getTeachingMaterials
} from '@/lib/services/teaching-materials';
import { isValidCanvaUrl } from '@/lib/utils/canva';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';
import { Loader2, Save, X, Plus, Trash2, Link, AlertCircle, List } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TeachingMaterialFormProps {
  subjectId: string;
  material?: TeachingMaterial;
  isEdit?: boolean;
}

export default function TeachingMaterialForm({ 
  subjectId, 
  material, 
  isEdit = false 
}: TeachingMaterialFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testingUrl, setTestingUrl] = useState(false);
  
  const [formData, setFormData] = useState({
    subjectId: subjectId,
    sessionNumber: material?.sessionNumber || 1,
    title: material?.title || '',
    description: material?.description || '',
    objectives: material?.objectives || [''],
    materials: material?.materials || [''],
    preparation: material?.preparation || [''],
    canvaUrl: material?.canvaUrl || '',
    teachingNotes: material?.teachingNotes || '',
    tags: material?.tags || [],
    isActive: material?.isActive ?? true,
  });

  // State for duplicate check
  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    isDuplicate: boolean;
    duplicateTitle?: string;
  }>({
    checking: false,
    isDuplicate: false,
  });

  // State for existing materials
  const [existingMaterials, setExistingMaterials] = useState<TeachingMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Common tags with Thai tooltips
  const commonTags = [
    { value: 'hands-on', label: 'Hands-on', tooltip: 'ลงมือปฏิบัติ' },
    { value: 'group-work', label: 'Group Work', tooltip: 'ทำงานกลุ่ม' },
    { value: 'individual', label: 'Individual', tooltip: 'ทำงานเดี่ยว' },
    { value: 'presentation', label: 'Presentation', tooltip: 'นำเสนอ' },
    { value: 'game-based', label: 'Game-based', tooltip: 'เรียนผ่านเกม' },
    { value: 'competition', label: 'Competition', tooltip: 'แข่งขัน' },
    { value: 'review', label: 'Review', tooltip: 'ทบทวน' }
  ];

  // Load next session number for new material
  useEffect(() => {
    if (!isEdit) {
      loadNextSessionNumber();
    }
    loadExistingMaterials();
  }, [isEdit, subjectId]);

  const loadExistingMaterials = async () => {
    setLoadingMaterials(true);
    try {
      const materials = await getTeachingMaterials(subjectId);
      setExistingMaterials(materials.sort((a, b) => a.sessionNumber - b.sessionNumber));
    } catch (error) {
      console.error('Error loading existing materials:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Check for duplicate session number on change
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!formData.sessionNumber) return;
      
      setDuplicateCheck(prev => ({ ...prev, checking: true }));
      
      try {
        const result = await checkSessionNumberExists(
          subjectId,
          formData.sessionNumber,
          isEdit ? material?.id : undefined
        );
        
        setDuplicateCheck({
          checking: false,
          isDuplicate: result.exists,
          duplicateTitle: result.existingTitle
        });
      } catch (error) {
        console.error('Error checking duplicate:', error);
        setDuplicateCheck({ checking: false, isDuplicate: false });
      }
    };
    
    const debounceTimer = setTimeout(checkDuplicate, 300);
    return () => clearTimeout(debounceTimer);
  }, [formData.sessionNumber, subjectId, isEdit, material?.id]);

  const loadNextSessionNumber = async () => {
    try {
      const nextNumber = await getNextSessionNumber(subjectId);
      setFormData(prev => ({ ...prev, sessionNumber: nextNumber }));
    } catch (error) {
      console.error('Error loading next session number:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.title || !formData.canvaUrl) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    // Validate Canva URL
    if (!isValidCanvaUrl(formData.canvaUrl)) {
      toast.error('URL ของ Canva ไม่ถูกต้อง');
      return;
    }

    // Check for duplicate session number
    try {
      const checkResult = await checkSessionNumberExists(
        subjectId, 
        formData.sessionNumber,
        isEdit ? material?.id : undefined
      );
      if (checkResult.exists) {
        toast.error(`ครั้งที่ ${formData.sessionNumber} มีอยู่แล้ว (${checkResult.existingTitle}) กรุณาเลือกครั้งที่อื่น`);
        return;
      }
    } catch (error) {
      console.error('Error checking session number:', error);
    }

    // Remove empty items from arrays
    const cleanedData = {
      ...formData,
      objectives: formData.objectives.filter(obj => obj.trim() !== ''),
      materials: formData.materials.filter(mat => mat.trim() !== ''),
      preparation: formData.preparation.filter(prep => prep.trim() !== ''),
    };

    if (cleanedData.objectives.length === 0) {
      toast.error('กรุณาระบุจุดประสงค์การเรียนรู้อย่างน้อย 1 ข้อ');
      return;
    }

    setLoading(true);

    try {
      if (isEdit && material?.id) {
        await updateTeachingMaterial(material.id, cleanedData, user?.uid || '');
        toast.success('อัปเดตสื่อการสอนเรียบร้อยแล้ว');
      } else {
        await createTeachingMaterial(cleanedData, user?.uid || '');
        toast.success('เพิ่มสื่อการสอนเรียบร้อยแล้ว');
      }
      
      router.push(`/teaching-materials/${subjectId}`);
    } catch (error: any) {
      console.error('Error saving teaching material:', error);
      toast.error(error.message || (isEdit ? 'ไม่สามารถอัปเดตสื่อการสอนได้' : 'ไม่สามารถเพิ่มสื่อการสอนได้'));
    } finally {
      setLoading(false);
    }
  };

  const handleArrayItemChange = (
    field: 'objectives' | 'materials' | 'preparation',
    index: number,
    value: string
  ) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  };

  const handleArrayKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'objectives' | 'materials' | 'preparation',
    index: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentArray = formData[field];
      
      // ถ้าเป็นช่องสุดท้ายและมีข้อความ ให้เพิ่มช่องใหม่
      if (index === currentArray.length - 1 && currentArray[index].trim() !== '') {
        addArrayItem(field);
        // Focus on new input after DOM update
        setTimeout(() => {
          const inputs = document.querySelectorAll(`input[data-field="${field}"]`);
          const newInput = inputs[inputs.length - 1] as HTMLInputElement;
          if (newInput) newInput.focus();
        }, 0);
      }
    }
  };

  const addArrayItem = (field: 'objectives' | 'materials' | 'preparation') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const removeArrayItem = (field: 'objectives' | 'materials' | 'preparation', index: number) => {
    const newArray = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArray });
  };

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const testCanvaUrl = () => {
    if (!formData.canvaUrl) {
      toast.error('กรุณากรอก URL ก่อน');
      return;
    }
    
    if (!isValidCanvaUrl(formData.canvaUrl)) {
      toast.error('URL ของ Canva ไม่ถูกต้อง');
      return;
    }
    
    setTestingUrl(true);
    window.open(formData.canvaUrl, '_blank');
    setTimeout(() => setTestingUrl(false), 1000);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>ข้อมูลพื้นฐาน</CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={loadingMaterials}
                  >
                    {loadingMaterials ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <List className="h-4 w-4 mr-2" />
                        ดูบทเรียนทั้งหมด
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
                  <div className="space-y-2">
                    <div className="font-semibold text-sm pb-2 border-b">
                      รายการบทเรียนทั้งหมด ({existingMaterials.length} บทเรียน)
                    </div>
                    {existingMaterials.length === 0 ? (
                      <p className="text-sm text-gray-500">ยังไม่มีบทเรียน</p>
                    ) : (
                      <div className="space-y-1">
                        {existingMaterials.map((mat) => (
                          <div
                            key={mat.id}
                            className={`text-sm p-2 rounded ${
                              mat.id === material?.id
                                ? 'bg-blue-50 border border-blue-200'
                                : mat.sessionNumber === formData.sessionNumber && mat.id !== material?.id
                                ? 'bg-amber-50 border border-amber-200'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <Badge
                                variant={mat.sessionNumber === formData.sessionNumber && mat.id !== material?.id ? "outline" : "secondary"}
                                className={mat.sessionNumber === formData.sessionNumber && mat.id !== material?.id ? "text-amber-600 border-amber-600" : "text-xs shrink-0"}
                              >
                                {mat.sessionNumber}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{mat.title}</p>
                                {mat.id === material?.id && (
                                  <p className="text-xs text-blue-600">กำลังแก้ไข</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sessionNumber">ครั้งที่ *</Label>
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      id="sessionNumber"
                      type="number"
                      min="1"
                      value={formData.sessionNumber}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        sessionNumber: parseInt(e.target.value) || 1 
                      })}
                      required
                      className={`w-full ${duplicateCheck.isDuplicate ? 'border-red-500 pr-8' : ''}`}
                    />
                    {duplicateCheck.checking && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    {duplicateCheck.isDuplicate && !duplicateCheck.checking && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                  </div>
                  {duplicateCheck.isDuplicate && (
                    <div className="bg-red-50 border border-red-200 rounded px-2 py-1">
                      <p className="text-xs text-red-600">
                        ครั้งที่ {formData.sessionNumber} มีอยู่แล้ว: 
                        <span className="font-medium ml-1">{duplicateCheck.duplicateTitle}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="title">ชื่อบทเรียน *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="เช่น Introduction to VEX Robotics"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="อธิบายภาพรวมของบทเรียน"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Canva URL */}
        <Card>
          <CardHeader>
            <CardTitle>Canva Presentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="canvaUrl">Canva Share URL *</Label>
              <div className="flex gap-2">
                <Input
                  id="canvaUrl"
                  type="url"
                  value={formData.canvaUrl}
                  onChange={(e) => setFormData({ ...formData, canvaUrl: e.target.value })}
                  placeholder="https://www.canva.com/design/..."
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={testCanvaUrl}
                  disabled={testingUrl}
                >
                  {testingUrl ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  ทดสอบ
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                วิธีการ: เปิด Canva → คลิก Share → คลิก Copy link
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Learning Objectives & Materials */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Learning Objectives */}
          <Card>
            <CardHeader>
              <CardTitle>จุดประสงค์การเรียนรู้ *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.objectives.map((objective, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-sm font-medium text-gray-600 w-6 text-right">{index + 1}.</span>
                  <Input
                    data-field="objectives"
                    value={objective}
                    onChange={(e) => handleArrayItemChange('objectives', index, e.target.value)}
                    onKeyPress={(e) => handleArrayKeyPress(e, 'objectives', index)}
                    placeholder="เช่น เข้าใจหลักการทำงานของหุ่นยนต์"
                    className="flex-1"
                  />
                  {formData.objectives.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArrayItem('objectives', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-500">กด Enter เพื่อเพิ่มรายการใหม่</p>
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader>
              <CardTitle>อุปกรณ์ที่ใช้</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.materials.map((material, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-sm font-medium text-gray-600 w-6 text-right">{index + 1}.</span>
                  <Input
                    data-field="materials"
                    value={material}
                    onChange={(e) => handleArrayItemChange('materials', index, e.target.value)}
                    onKeyPress={(e) => handleArrayKeyPress(e, 'materials', index)}
                    placeholder="เช่น VEX GO Robot Kit"
                    className="flex-1"
                  />
                  {formData.materials.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArrayItem('materials', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-500">กด Enter เพื่อเพิ่มรายการใหม่</p>
            </CardContent>
          </Card>
        </div>

        {/* Preparation & Teaching Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preparation */}
          <Card>
            <CardHeader>
              <CardTitle>การเตรียมการก่อนสอน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.preparation.map((prep, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-sm font-medium text-gray-600 w-6 text-right">{index + 1}.</span>
                  <Input
                    data-field="preparation"
                    value={prep}
                    onChange={(e) => handleArrayItemChange('preparation', index, e.target.value)}
                    onKeyPress={(e) => handleArrayKeyPress(e, 'preparation', index)}
                    placeholder="เช่น ตรวจสอบแบตเตอรี่หุ่นยนต์"
                    className="flex-1"
                  />
                  {formData.preparation.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArrayItem('preparation', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-500">กด Enter เพื่อเพิ่มรายการใหม่</p>
            </CardContent>
          </Card>

          {/* Teaching Notes */}
          <Card>
            <CardHeader>
              <CardTitle>บันทึกสำหรับครู</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.teachingNotes}
                onChange={(e) => setFormData({ ...formData, teachingNotes: e.target.value })}
                placeholder="เคล็ดลับ, ข้อควรระวัง, หรือข้อแนะนำในการสอน"
                rows={6}
              />
            </CardContent>
          </Card>
        </div>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>แท็ก</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {commonTags.map(tag => (
                <div key={tag.value} className="flex items-center space-x-2" title={tag.tooltip}>
                  <Checkbox
                    id={`tag-${tag.value}`}
                    checked={formData.tags.includes(tag.value)}
                    onCheckedChange={() => handleTagToggle(tag.value)}
                  />
                  <Label
                    htmlFor={`tag-${tag.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {tag.label}
                    <span className="text-xs text-gray-500 ml-1">({tag.tooltip})</span>
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>สถานะ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive" className="font-normal">
                พร้อมใช้งาน
              </Label>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              สื่อการสอนที่ปิดใช้งานจะไม่แสดงให้ครูเห็น
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/teaching-materials/${subjectId}`)}
          >
            <X className="h-4 w-4 mr-2" />
            ยกเลิก
          </Button>
          <Button
            type="submit"
            className="bg-red-500 hover:bg-red-600"
            disabled={loading || duplicateCheck.isDuplicate}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มบทเรียน'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
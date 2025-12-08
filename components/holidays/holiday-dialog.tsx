'use client';

import { useState, useEffect } from 'react';
import { Holiday, Branch } from '@/types/models';
import { addHoliday, updateHoliday, checkHolidayExists } from '@/lib/services/holidays';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { Loader2, CalendarDays, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HolidayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday?: Holiday | null;
  branches: Branch[];
  onSaved: () => void;
}

export default function HolidayDialog({
  open,
  onOpenChange,
  holiday,
  branches,
  onSaved
}: HolidayDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isDateRange, setIsDateRange] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    endDate: '',
    type: 'national' as Holiday['type'],
    branches: [] as string[],
    description: '',
  });

  useEffect(() => {
    if (holiday) {
      setFormData({
        name: holiday.name,
        date: new Date(holiday.date).toISOString().split('T')[0],
        endDate: '',
        type: holiday.type,
        branches: holiday.branches || [],
        description: holiday.description || '',
      });
      setIsDateRange(false);
    } else {
      // Reset form for new holiday
      setFormData({
        name: '',
        date: '',
        endDate: '',
        type: 'national',
        branches: [],
        description: '',
      });
      setIsDateRange(false);
    }
  }, [holiday]);

  const handleBranchToggle = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches.includes(branchId)
        ? prev.branches.filter(id => id !== branchId)
        : [...prev.branches, branchId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.date) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็น');
      return;
    }

    if (isDateRange && formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
      toast.error('วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น');
      return;
    }

    if (formData.type !== 'national' && formData.branches.length === 0) {
      toast.error('กรุณาเลือกสาขาที่หยุด');
      return;
    }

    setLoading(true);

    try {
      // กรณีแก้ไข
      if (holiday) {
        // ตรวจสอบวันหยุดซ้ำ
        const exists = await checkHolidayExists(
          new Date(formData.date),
          undefined,
          formData.type === 'national' ? undefined : formData.branches[0],
          holiday.id
        );
        
        if (exists) {
          toast.error('มีวันหยุดในวันนี้อยู่แล้ว');
          setLoading(false);
          return;
        }
        
        const holidayData = {
          ...formData,
          date: new Date(formData.date),
          branches: formData.type === 'national' ? [] : formData.branches,
        };
        
        await updateHoliday(holiday.id, holidayData);
        toast.success('อัปเดตข้อมูลวันหยุดเรียบร้อยแล้ว');
      } else {
        // กรณีเพิ่มใหม่
        if (isDateRange && formData.endDate) {
          // สร้างวันหยุดหลายวัน
          const startDate = new Date(formData.date);
          const endDate = new Date(formData.endDate);
          const dates: Date[] = [];
          let duplicateCount = 0;
          
          // สร้าง array ของวันที่ทั้งหมดในช่วง
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // สร้างวันหยุดสำหรับแต่ละวัน
          const promises = [];
          for (const date of dates) {
            // ตรวจสอบวันหยุดซ้ำ
            const exists = await checkHolidayExists(
              date,
              undefined,
              formData.type === 'national' ? undefined : formData.branches[0]
            );
            
            if (exists) {
              duplicateCount++;
              continue;
            }
            
            const holidayData = {
              ...formData,
              date,
              branches: formData.type === 'national' ? [] : formData.branches,
            };
            promises.push(addHoliday(holidayData));
          }
          
          if (promises.length > 0) {
            await Promise.all(promises);
            
            if (duplicateCount > 0) {
              toast.success(
                `เพิ่มวันหยุด ${promises.length} วันเรียบร้อยแล้ว (มี ${duplicateCount} วันที่ซ้ำ)`,
                { duration: 5000 }
              );
            } else {
              toast.success(`เพิ่มวันหยุด ${dates.length} วันเรียบร้อยแล้ว`);
            }
          } else {
            toast.error('วันหยุดทั้งหมดมีอยู่แล้ว');
          }
        } else {
          // สร้างวันหยุดวันเดียว
          // ตรวจสอบวันหยุดซ้ำ
          const exists = await checkHolidayExists(
            new Date(formData.date),
            undefined,
            formData.type === 'national' ? undefined : formData.branches[0]
          );
          
          if (exists) {
            toast.error('มีวันหยุดในวันนี้อยู่แล้ว');
            setLoading(false);
            return;
          }
          
          const holidayData = {
            ...formData,
            date: new Date(formData.date),
            branches: formData.type === 'national' ? [] : formData.branches,
          };
          
          const result = await addHoliday(holidayData);
          toast.success('เพิ่มวันหยุดเรียบร้อยแล้ว');
        }
      }

      onSaved();
    } catch (error) {
      console.error('Error saving holiday:', error);
      toast.error(holiday ? 'ไม่สามารถอัปเดตข้อมูลได้' : 'ไม่สามารถเพิ่มวันหยุดได้');
    } finally {
      setLoading(false);
    }
  };

  // คำนวณจำนวนวันที่จะสร้าง
  const calculateDays = () => {
    if (!isDateRange || !formData.date || !formData.endDate) return 0;
    
    const start = new Date(formData.date);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {holiday ? 'แก้ไขข้อมูลวันหยุด' : 'เพิ่มวันหยุดใหม่'}
            </DialogTitle>
            <DialogDescription>
              กำหนดวันหยุดสำหรับโรงเรียน (ทุกวันหยุดจะปิดทำการ)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">ชื่อวันหยุด *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น วันขึ้นปีใหม่, วันสงกรานต์"
                disabled={loading}
                required
              />
            </div>

            {/* Toggle สำหรับเลือกวันเดียวหรือช่วงวัน (เฉพาะตอนเพิ่มใหม่) */}
            {!holiday && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDateRange"
                  checked={isDateRange}
                  onCheckedChange={(checked) => {
                    setIsDateRange(checked as boolean);
                    if (!checked) {
                      setFormData(prev => ({ ...prev, endDate: '' }));
                    }
                  }}
                  disabled={loading}
                />
                <Label htmlFor="isDateRange" className="font-normal cursor-pointer">
                  <CalendarDays className="inline w-4 h-4 mr-1" />
                  เลือกช่วงวันที่ (สำหรับวันหยุดหลายวันติดกัน)
                </Label>
              </div>
            )}

            <div className={`grid ${isDateRange ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div className="grid gap-2">
                <Label htmlFor="date">
                  {isDateRange ? 'จากวันที่ *' : 'วันที่ *'}
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>

              {isDateRange && (
                <div className="grid gap-2">
                  <Label htmlFor="endDate">ถึงวันที่ *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.date}
                    disabled={loading}
                    required={isDateRange}
                  />
                </div>
              )}
            </div>

            {/* แสดงจำนวนวันที่จะสร้าง */}
            {isDateRange && formData.date && formData.endDate && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  จะสร้างวันหยุด {calculateDays()} วัน 
                  (วันที่ {new Date(formData.date).toLocaleDateString('th-TH')} ถึง {new Date(formData.endDate).toLocaleDateString('th-TH')})
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="type">ประเภท *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  type: value as Holiday['type'],
                  branches: value === 'national' ? [] : formData.branches
                })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">วันหยุดทุกสาขา</SelectItem>
                  <SelectItem value="branch">วันหยุดประจำสาขา</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type !== 'national' && (
              <div className="grid gap-2">
                <Label>สาขาที่หยุด *</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`branch-${branch.id}`}
                        checked={formData.branches.includes(branch.id)}
                        onCheckedChange={() => handleBranchToggle(branch.id)}
                        disabled={loading}
                      />
                      <Label
                        htmlFor={`branch-${branch.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {branch.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="description">รายละเอียด</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                rows={3}
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                holiday ? 'บันทึกการแก้ไข' : 'เพิ่มวันหยุด'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
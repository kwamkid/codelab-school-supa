'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Event, Branch, EventSchedule } from '@/types/models';
import { createEvent, updateEvent, createEventSchedule, updateEventSchedule, deleteEventSchedule, getEventSchedules } from '@/lib/services/events';
import { getActiveBranches } from '@/lib/services/branches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-range-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormSelect } from '@/components/ui/form-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { 
  Loader2, 
  Save, 
  X, 
  Calendar,
  MapPin,
  Users,
  Bell,
  Plus,
  Trash2,
  Image,
  Clock,
  Edit,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface EventFormProps {
  event?: Event;
  isEdit?: boolean;
}

interface ScheduleFormData {
  date: string;
  startTime: string;
  endTime: string;
  maxAttendees: string;
  maxAttendeesByBranch: Record<string, string>; // branchId -> count
}

interface TempSchedule extends ScheduleFormData {
  tempId: string;
  isNew: boolean;
}

export default function EventForm({ event, isEdit = false }: EventFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [locationType, setLocationType] = useState<'branch' | 'external'>(
    event?.locationUrl ? 'external' : 'branch'
  );
  const [branches, setBranches] = useState<Branch[]>([]);
  const [existingSchedules, setExistingSchedules] = useState<EventSchedule[]>([]);
  const [schedules, setSchedules] = useState<TempSchedule[]>([]);
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<string[]>([]);
  
  // Main form state
  const [formData, setFormData] = useState({
    name: event?.name || '',
    description: event?.description || '',
    fullDescription: event?.fullDescription || '',
    imageUrl: event?.imageUrl || '',
    location: event?.location || '',
    locationUrl: event?.locationUrl || '',
    branchIds: event?.branchIds || [],
    eventType: event?.eventType || 'open-house' as Event['eventType'],
    highlights: event?.highlights || [''],
    targetAudience: event?.targetAudience || '',
    whatToBring: event?.whatToBring || [''],
    registrationStartDate: event?.registrationStartDate 
      ? new Date(event.registrationStartDate).toISOString().split('T')[0] 
      : '',
    registrationEndDate: event?.registrationEndDate 
      ? new Date(event.registrationEndDate).toISOString().split('T')[0] 
      : '',
    countingMethod: event?.countingMethod || 'registrations' as Event['countingMethod'],
    enableReminder: event?.enableReminder ?? true,
    reminderDaysBefore: event?.reminderDaysBefore || 1,
    reminderTime: event?.reminderTime || '10:00',
    status: event?.status || 'draft' as Event['status'],
  });

  useEffect(() => {
    loadBranches();
    if (isEdit && event?.id) {
      loadSchedules();
    }
  }, [isEdit, event?.id]);

  const loadBranches = async () => {
    try {
      const data = await getActiveBranches();
      setBranches(data);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadSchedules = async () => {
    if (!event?.id) return;
    
    try {
      const data = await getEventSchedules(event.id);
      setExistingSchedules(data);
      // Convert to temp schedules for editing
      const tempSchedules = data.map(s => {
        const mabb = (s as any).maxAttendeesByBranch || (s as any).max_attendees_by_branch || {};
        return {
          tempId: s.id,
          date: new Date(s.date).toISOString().split('T')[0],
          startTime: s.startTime,
          endTime: s.endTime,
          maxAttendees: s.maxAttendees.toString(),
          maxAttendeesByBranch: Object.fromEntries(
            Object.entries(mabb).map(([k, v]) => [k, String(v)])
          ),
          isNew: false
        };
      });
      setSchedules(tempSchedules);
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  // Schedule management functions
  const handleAddSchedule = () => {
    const newSchedule: TempSchedule = {
      date: '',
      startTime: '',
      endTime: '',
      maxAttendees: '',
      maxAttendeesByBranch: {},
      tempId: `temp-${Date.now()}`,
      isNew: true
    };
    setSchedules([...schedules, newSchedule]);
  };

  const handleUpdateSchedule = (tempId: string, field: keyof ScheduleFormData, value: string) => {
    setSchedules(schedules.map(s => 
      s.tempId === tempId ? { ...s, [field]: value } : s
    ));
  };

  const handleDeleteSchedule = (tempId: string) => {
    const schedule = schedules.find(s => s.tempId === tempId);
    if (schedule && !schedule.isNew) {
      // Mark existing schedule for deletion
      setDeletedScheduleIds([...deletedScheduleIds, tempId]);
    }
    setSchedules(schedules.filter(s => s.tempId !== tempId));
  };

  const handleDuplicateSchedule = (schedule: TempSchedule) => {
    const newSchedule: TempSchedule = {
      ...schedule,
      maxAttendeesByBranch: { ...schedule.maxAttendeesByBranch },
      tempId: `temp-${Date.now()}`,
      isNew: true
    };
    setSchedules([...schedules, newSchedule]);
  };

  const handleUpdateScheduleBranch = (tempId: string, branchId: string, value: string) => {
    setSchedules(schedules.map(s => {
      if (s.tempId !== tempId) return s;
      const updated = { ...s.maxAttendeesByBranch, [branchId]: value };
      // Auto-calculate total
      const total = Object.values(updated).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
      return { ...s, maxAttendeesByBranch: updated, maxAttendees: total.toString() };
    }));
  };

  const validateSchedule = (schedule: TempSchedule): boolean => {
    if (!schedule.date || !schedule.startTime || !schedule.endTime) {
      return false;
    }

    // Check at least one branch has a quota
    const hasQuota = formData.branchIds.some(bid => {
      const v = parseInt(schedule.maxAttendeesByBranch[bid] || '0');
      return v > 0;
    });
    if (!hasQuota) {
      return false;
    }
    
    if (schedule.startTime >= schedule.endTime) {
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name || !formData.description) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (locationType === 'external' && !formData.location) {
      toast.error('กรุณากรอกสถานที่จัดงาน');
      return;
    }

    if (!formData.registrationStartDate || !formData.registrationEndDate) {
      toast.error('กรุณาเลือกวันเปิด-ปิดรับลงทะเบียน');
      return;
    }

    if (formData.branchIds.length === 0) {
      toast.error('กรุณาเลือกสาขาที่จัด Event อย่างน้อย 1 สาขา');
      return;
    }

    if (schedules.length === 0) {
      toast.error('กรุณาเพิ่มรอบเวลาอย่างน้อย 1 รอบ');
      return;
    }

    // Validate all schedules
    const invalidSchedules = schedules.filter(s => !validateSchedule(s));
    if (invalidSchedules.length > 0) {
      toast.error('กรุณากรอกข้อมูลรอบเวลาให้ครบถ้วนและถูกต้อง');
      return;
    }

    const startDate = new Date(formData.registrationStartDate);
    const endDate = new Date(formData.registrationEndDate);
    if (startDate > endDate) {
      toast.error('วันเปิดรับลงทะเบียนต้องมาก่อนวันปิด');
      return;
    }

    setLoading(true);

    try {
      // Upload pending image if any
      let imageUrl = formData.imageUrl || '';
      if (pendingFile) {
        setUploading(true);
        try {
          const uploaded = await uploadPendingFile();
          if (uploaded) imageUrl = uploaded;
          setPendingFile(null);
          setPreviewUrl('');
        } finally {
          setUploading(false);
        }
      }

      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        description: formData.description,
        fullDescription: formData.fullDescription || '',
        imageUrl,
        location: locationType === 'branch'
          ? 'CodeLab ' + formData.branchIds.map(id => branches.find(b => b.id === id)?.name).filter(Boolean).join(' และ ')
          : formData.location,
        locationUrl: locationType === 'external' ? (formData.locationUrl || '') : '',
        branchIds: formData.branchIds,
        eventType: formData.eventType,
        highlights: formData.highlights.filter(h => h.trim()),
        targetAudience: formData.targetAudience || '',
        whatToBring: formData.whatToBring.filter(w => w.trim()),
        registrationStartDate: startDate,
        registrationEndDate: endDate,
        countingMethod: formData.countingMethod,
        enableReminder: formData.enableReminder,
        reminderDaysBefore: formData.reminderDaysBefore,
        reminderTime: formData.reminderTime || '10:00',
        status: formData.status,
        isActive: true,
        createdBy: user!.uid
      };

      let eventId: string;

      if (isEdit && event?.id) {
        // Update event
        const updateData: Partial<Event> = {
          name: eventData.name,
          description: eventData.description,
          fullDescription: eventData.fullDescription,
          imageUrl: eventData.imageUrl,
          location: eventData.location,
          locationUrl: eventData.locationUrl,
          branchIds: eventData.branchIds,
          eventType: eventData.eventType,
          highlights: eventData.highlights,
          targetAudience: eventData.targetAudience,
          whatToBring: eventData.whatToBring,
          registrationStartDate: eventData.registrationStartDate,
          registrationEndDate: eventData.registrationEndDate,
          countingMethod: eventData.countingMethod,
          enableReminder: eventData.enableReminder,
          reminderDaysBefore: eventData.reminderDaysBefore,
          reminderTime: eventData.reminderTime,
          status: eventData.status
        };
        
        await updateEvent(event.id, updateData, user!.uid);
        eventId = event.id;
        toast.success('อัปเดต Event เรียบร้อยแล้ว');

        // Handle schedule updates
        // 1. Delete schedules
        for (const scheduleId of deletedScheduleIds) {
          try {
            await deleteEventSchedule(scheduleId);
          } catch (error) {
            console.error('Error deleting schedule:', error);
          }
        }

        // 2. Update existing schedules
        for (const schedule of schedules.filter(s => !s.isNew && !deletedScheduleIds.includes(s.tempId))) {
          const mabb = Object.fromEntries(
            Object.entries(schedule.maxAttendeesByBranch).map(([k, v]) => [k, parseInt(v) || 0])
          );
          const scheduleData = {
            eventId,
            date: new Date(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: parseInt(schedule.maxAttendees),
            maxAttendeesByBranch: mabb,
          };
          await updateEventSchedule(schedule.tempId, scheduleData);
        }

        // 3. Create new schedules
        for (const schedule of schedules.filter(s => s.isNew)) {
          const mabb = Object.fromEntries(
            Object.entries(schedule.maxAttendeesByBranch).map(([k, v]) => [k, parseInt(v) || 0])
          );
          const scheduleData = {
            eventId,
            date: new Date(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: parseInt(schedule.maxAttendees),
            maxAttendeesByBranch: mabb,
            status: 'available' as const,
            attendeesByBranch: {}
          };
          await createEventSchedule(scheduleData);
        }
      } else {
        // Create new event
        eventId = await createEvent(eventData, user!.uid);
        toast.success('สร้าง Event เรียบร้อยแล้ว');

        // Create all schedules
        for (const schedule of schedules) {
          const mabb = Object.fromEntries(
            Object.entries(schedule.maxAttendeesByBranch).map(([k, v]) => [k, parseInt(v) || 0])
          );
          const scheduleData = {
            eventId,
            date: new Date(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: parseInt(schedule.maxAttendees),
            maxAttendeesByBranch: mabb,
            status: 'available' as const,
            attendeesByBranch: {}
          };
          await createEventSchedule(scheduleData);
        }
      }

      router.push(`/events/${eventId}`);
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(isEdit ? 'ไม่สามารถอัปเดต Event ได้' : 'ไม่สามารถสร้าง Event ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('รองรับเฉพาะ JPG, PNG, WebP, GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    // Show local preview, store file for later upload
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, imageUrl: '' })); // clear old URL
  };

  const uploadPendingFile = async (): Promise<string | null> => {
    if (!pendingFile) return null;
    const form = new FormData();
    form.append('file', pendingFile);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'อัพโหลดรูปไม่สำเร็จ');
    return data.url;
  };

  const addHighlight = () => {
    setFormData({ ...formData, highlights: [...formData.highlights, ''] });
  };

  const removeHighlight = (index: number) => {
    setFormData({
      ...formData,
      highlights: formData.highlights.filter((_, i) => i !== index)
    });
  };

  const updateHighlight = (index: number, value: string) => {
    const newHighlights = [...formData.highlights];
    newHighlights[index] = value;
    setFormData({ ...formData, highlights: newHighlights });
  };

  const addWhatToBring = () => {
    setFormData({ ...formData, whatToBring: [...formData.whatToBring, ''] });
  };

  const removeWhatToBring = (index: number) => {
    setFormData({
      ...formData,
      whatToBring: formData.whatToBring.filter((_, i) => i !== index)
    });
  };

  const updateWhatToBring = (index: number, value: string) => {
    const newItems = [...formData.whatToBring];
    newItems[index] = value;
    setFormData({ ...formData, whatToBring: newItems });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลพื้นฐาน</CardTitle>
            <CardDescription>ข้อมูลทั่วไปของ Event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">ชื่อ Event *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น Open House 2024"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="eventType">ประเภท Event *</Label>
                <FormSelect
                  value={formData.eventType}
                  onValueChange={(value) => setFormData({ ...formData, eventType: value as Event['eventType'] })}
                  options={[
                    { value: 'open-house', label: 'Open House' },
                    { value: 'parent-meeting', label: 'Parent Meeting' },
                    { value: 'showcase', label: 'Showcase' },
                    { value: 'workshop', label: 'Workshop' },
                    { value: 'other', label: 'อื่นๆ' },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">คำอธิบายสั้นๆ *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="อธิบาย Event ในไม่กี่ประโยค"
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullDescription">รายละเอียดแบบเต็ม</Label>
              <Textarea
                id="fullDescription"
                value={formData.fullDescription}
                onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                placeholder="รายละเอียดเพิ่มเติม รองรับ Markdown"
                rows={6}
              />
              <p className="text-xs text-gray-500">รองรับ Markdown สำหรับจัดรูปแบบข้อความ</p>
            </div>

            <div className="space-y-3">
  <Label>รูปภาพ Event</Label>

  {/* Upload area */}
  <input
    ref={fileInputRef}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    className="hidden"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = '';
    }}
  />

  {(previewUrl || formData.imageUrl) ? (
    <div className="relative border rounded-lg overflow-hidden bg-gray-50">
      <img
        src={previewUrl || formData.imageUrl}
        alt="Preview"
        className="w-full aspect-video object-cover"
        onError={(e) => {
          e.currentTarget.src = '';
          e.currentTarget.alt = 'ไม่สามารถโหลดรูปได้';
        }}
      />
      {pendingFile && (
        <div className="absolute top-2 left-2">
          <Badge className="bg-amber-500 text-white text-xs">ยังไม่ได้บันทึก</Badge>
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 bg-black/60 hover:bg-black/80 text-white border-0 shadow-md"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="ml-1 text-xs">เปลี่ยนรูป</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setFormData({ ...formData, imageUrl: '' });
            setPendingFile(null);
            setPreviewUrl('');
          }}
          className="h-8 bg-red-600/80 hover:bg-red-600 text-white border-0 shadow-md"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 hover:bg-orange-50/50 transition-colors cursor-pointer"
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 mx-auto text-gray-400 animate-spin" />
      ) : (
        <Upload className="h-8 w-8 mx-auto text-gray-400" />
      )}
      <p className="mt-2 text-sm font-medium text-gray-600">
        {uploading ? 'กำลังอัพโหลด...' : 'คลิกเพื่ออัพโหลดรูป'}
      </p>
      <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, GIF (สูงสุด 5MB)</p>
    </button>
  )}

  {/* Or paste URL */}
  <details className="text-sm">
    <summary className="text-gray-500 cursor-pointer hover:text-gray-700">หรือวาง URL รูปภาพ</summary>
    <div className="mt-2 flex gap-2">
      <Input
        type="url"
        value={formData.imageUrl}
        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
        placeholder="https://example.com/image.jpg"
        className="flex-1"
      />
    </div>
  </details>
</div>
          </CardContent>
        </Card>

        {/* Location & Branches */}
        <Card>
          <CardHeader>
            <CardTitle>สถานที่และสาขา</CardTitle>
            <CardDescription>เลือกว่าจัดที่สาขาหรือสถานที่ภายนอก</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location type toggle */}
            <RadioGroup
              value={locationType}
              onValueChange={(v) => setLocationType(v as 'branch' | 'external')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="branch" id="loc-branch" />
                <Label htmlFor="loc-branch" className="font-normal cursor-pointer">จัดที่สาขา</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="loc-external" />
                <Label htmlFor="loc-external" className="font-normal cursor-pointer">จัดนอกสถานที่</Label>
              </div>
            </RadioGroup>

            {/* Branch: select branches */}
            {locationType === 'branch' && (
              <div className="space-y-2">
                <Label>สาขาที่จัด Event *</Label>
                <div className="space-y-2 p-4 border rounded-lg">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={branch.id}
                        checked={formData.branchIds.includes(branch.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              branchIds: [...formData.branchIds, branch.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              branchIds: formData.branchIds.filter(id => id !== branch.id)
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={branch.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {branch.name}
                      </label>
                    </div>
                  ))}
                </div>
                {formData.branchIds.length > 0 && (
                  <p className="text-xs text-gray-500">
                    สถานที่จะแสดงเป็น: CodeLab {formData.branchIds.map(id => branches.find(b => b.id === id)?.name).filter(Boolean).join(' และ ')}
                  </p>
                )}
              </div>
            )}

            {/* External: location + map + branch for quota */}
            {locationType === 'external' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">สถานที่จัดงาน *</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="เช่น ศูนย์ประชุมแห่งชาติสิริกิติ์"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationUrl">Google Maps URL</Label>
                    <Input
                      id="locationUrl"
                      type="url"
                      value={formData.locationUrl}
                      onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>สาขาที่รับลงทะเบียน *</Label>
                  <p className="text-xs text-gray-500">เลือกสาขาที่เปิดรับลงทะเบียนสำหรับ Event นี้ (ใช้แบ่งโควต้า)</p>
                  <div className="space-y-2 p-4 border rounded-lg">
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ext-${branch.id}`}
                          checked={formData.branchIds.includes(branch.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                branchIds: [...formData.branchIds, branch.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                branchIds: formData.branchIds.filter(id => id !== branch.id)
                              });
                            }
                          }}
                        />
                        <label
                          htmlFor={`ext-${branch.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {branch.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registration Settings */}
        <Card>
          <CardHeader>
            <CardTitle>การลงทะเบียน</CardTitle>
            <CardDescription>กำหนดช่วงเวลาและวิธีนับจำนวนผู้เข้าร่วม</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registrationStartDate">วันเปิดรับลงทะเบียน *</Label>
                <DateRangePicker
                  mode="single"
                  value={formData.registrationStartDate}
                  onChange={(date) => setFormData({ ...formData, registrationStartDate: date || '' })}
                  placeholder="เลือกวันที่"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registrationEndDate">วันปิดรับลงทะเบียน *</Label>
                <DateRangePicker
                  mode="single"
                  value={formData.registrationEndDate}
                  onChange={(date) => setFormData({ ...formData, registrationEndDate: date || '' })}
                  placeholder="เลือกวันที่"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countingMethod">วิธีนับจำนวน *</Label>
              <FormSelect
                value={formData.countingMethod}
                onValueChange={(value) => setFormData({ ...formData, countingMethod: value as Event['countingMethod'] })}
                options={[
                  { value: 'registrations', label: 'นับจำนวนการลงทะเบียน' },
                  { value: 'students', label: 'นับจำนวนนักเรียน' },
                  { value: 'parents', label: 'นับจำนวนผู้ปกครอง' },
                ]}
              />
              <p className="text-xs text-gray-500">
                {formData.countingMethod === 'registrations' && 'นับทุกการลงทะเบียนเป็น 1'}
                {formData.countingMethod === 'students' && 'นับจำนวนนักเรียนที่ลงทะเบียน'}
                {formData.countingMethod === 'parents' && 'นับจำนวนผู้ปกครองที่ลงทะเบียน'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Event Schedules */}
        <Card>
          <CardHeader>
            <CardTitle>รอบเวลา</CardTitle>
            <CardDescription>กำหนดวันและเวลาที่จัด Event (สามารถเพิ่มได้หลายรอบ)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Schedule Cards */}
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div key={schedule.tempId} className="border rounded-lg p-4 space-y-4 bg-gray-50/50">
                  {/* Row 1: Date, Time, Actions */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs text-gray-500 mb-1 block">วันที่</Label>
                      <DateRangePicker
                        mode="single"
                        value={schedule.date}
                        onChange={(date) => handleUpdateSchedule(schedule.tempId, 'date', date || '')}
                        minDate={new Date()}
                        placeholder="เลือกวันที่"
                      />
                    </div>
                    <div className="w-[120px]">
                      <Label className="text-xs text-gray-500 mb-1 block">เวลาเริ่ม</Label>
                      <TimePicker
                        value={schedule.startTime}
                        onChange={(v) => handleUpdateSchedule(schedule.tempId, 'startTime', v)}
                      />
                    </div>
                    <div className="w-[120px]">
                      <Label className="text-xs text-gray-500 mb-1 block">เวลาจบ</Label>
                      <TimePicker
                        value={schedule.endTime}
                        onChange={(v) => handleUpdateSchedule(schedule.tempId, 'endTime', v)}
                        min={schedule.startTime}
                      />
                    </div>
                    <div className="flex items-end gap-1 pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (validateSchedule(schedule)) {
                            handleDuplicateSchedule(schedule);
                            toast.success('คัดลอกรอบเวลาแล้ว');
                          } else {
                            toast.error('กรุณากรอกข้อมูลให้ครบก่อนคัดลอก');
                          }
                        }}
                        title="คัดลอก"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSchedule(schedule.tempId)}
                        className="text-red-600 hover:text-red-700"
                        title="ลบ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Row 2: Per-branch quota */}
                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">จำนวนที่รับแต่ละสาขา</Label>
                    {formData.branchIds.length === 0 ? (
                      <p className="text-sm text-gray-400">กรุณาเลือกสาขาก่อน</p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {formData.branchIds.map(bid => {
                          const branch = branches.find(b => b.id === bid);
                          return (
                            <div key={bid} className="flex items-center gap-2">
                              <span className="text-sm font-medium whitespace-nowrap">{branch?.name || 'สาขา'}</span>
                              <Input
                                type="number"
                                min="0"
                                value={schedule.maxAttendeesByBranch[bid] || ''}
                                onChange={(e) => handleUpdateScheduleBranch(schedule.tempId, bid, e.target.value)}
                                placeholder="0"
                                className="h-9 w-20"
                              />
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2 text-sm text-gray-500 ml-2">
                          <span>รวม:</span>
                          <Badge variant="secondary">{schedule.maxAttendees || '0'} คน</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {schedules.length === 0 && (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  ยังไม่มีรอบเวลา คลิก &quot;เพิ่มรอบเวลา&quot; เพื่อเริ่มต้น
                </div>
              )}
            </div>
            
            {/* Add Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSchedule}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มรอบเวลา
            </Button>
            
            {/* Helper text */}
            <p className="text-xs text-gray-500">
              💡 คำแนะนำ: คลิกปุ่ม "คัดลอก" 📋 เพื่อสร้างรอบใหม่ที่มีข้อมูลคล้ายกัน | กรอกข้อมูลให้ครบทุกช่องก่อนบันทึก
            </p>
          </CardContent>
        </Card>

        {/* Event Details */}
        <Card>
          <CardHeader>
            <CardTitle>รายละเอียด Event</CardTitle>
            <CardDescription>ข้อมูลเพิ่มเติมสำหรับผู้เข้าร่วม</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetAudience">กลุ่มเป้าหมาย</Label>
              <Input
                id="targetAudience"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                placeholder="เช่น ผู้ปกครองและนักเรียนอายุ 6-12 ปี"
              />
            </div>

            <div className="space-y-2">
              <Label>จุดเด่นของงาน</Label>
              <div className="space-y-2">
                {formData.highlights.map((highlight, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={highlight}
                      onChange={(e) => updateHighlight(index, e.target.value)}
                      placeholder="เช่น พบปะครูผู้สอน"
                    />
                    {formData.highlights.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHighlight(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHighlight}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มจุดเด่น
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>สิ่งที่ควรนำมา</Label>
              <div className="space-y-2">
                {formData.whatToBring.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateWhatToBring(index, e.target.value)}
                      placeholder="เช่น สมุดจดบันทึก"
                    />
                    {formData.whatToBring.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWhatToBring(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWhatToBring}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มรายการ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reminder Settings */}
        <Card>
          <CardHeader>
            <CardTitle>การแจ้งเตือน</CardTitle>
            <CardDescription>ตั้งค่าการแจ้งเตือนผู้ลงทะเบียน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>เปิดการแจ้งเตือนอัตโนมัติ</Label>
                <p className="text-sm text-gray-500">
                  ส่งการแจ้งเตือนให้ผู้ที่ลงทะเบียนผ่าน LINE
                </p>
              </div>
              <Switch
                checked={formData.enableReminder}
                onCheckedChange={(checked) => setFormData({ ...formData, enableReminder: checked })}
              />
            </div>

            {formData.enableReminder && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="reminderDaysBefore">แจ้งเตือนล่วงหน้า (วัน)</Label>
                  <Input
                    id="reminderDaysBefore"
                    type="number"
                    min="1"
                    max="7"
                    value={formData.reminderDaysBefore}
                    onChange={(e) => setFormData({ ...formData, reminderDaysBefore: parseInt(e.target.value) })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reminderTime">เวลาที่ส่ง</Label>
                  <TimePicker
                    value={formData.reminderTime}
                    onChange={(v) => setFormData({ ...formData, reminderTime: v })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>สถานะ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="status">สถานะ Event</Label>
              <FormSelect
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as Event['status'] })}
                options={[
                  { value: 'draft', label: 'ร่าง' },
                  { value: 'published', label: 'เผยแพร่' },
                  ...(isEdit ? [
                    { value: 'completed', label: 'จบแล้ว' },
                    { value: 'cancelled', label: 'ยกเลิก' },
                  ] : []),
                ]}
              />
              <p className="text-xs text-gray-500">
                {formData.status === 'draft' && 'Event จะยังไม่แสดงให้ผู้ใช้เห็น'}
                {formData.status === 'published' && 'Event จะแสดงและเปิดรับลงทะเบียน'}
                {formData.status === 'completed' && 'Event จบแล้ว ไม่รับลงทะเบียนใหม่'}
                {formData.status === 'cancelled' && 'Event ถูกยกเลิก'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Link href="/events">
            <Button type="button" variant="outline">
              <X className="h-4 w-4 mr-2" />
              ยกเลิก
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-red-500 hover:bg-red-600"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'บันทึกการแก้ไข' : 'สร้าง Event'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
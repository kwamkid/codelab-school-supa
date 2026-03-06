'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Edit
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
}

interface TempSchedule extends ScheduleFormData {
  tempId: string;
  isNew: boolean;
}

export default function EventForm({ event, isEdit = false }: EventFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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
      const tempSchedules = data.map(s => ({
        tempId: s.id,
        date: new Date(s.date).toISOString().split('T')[0],
        startTime: s.startTime,
        endTime: s.endTime,
        maxAttendees: s.maxAttendees.toString(),
        isNew: false
      }));
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
      tempId: `temp-${Date.now()}`,
      isNew: true
    };
    setSchedules([...schedules, newSchedule]);
  };

  const validateSchedule = (schedule: TempSchedule): boolean => {
    if (!schedule.date || !schedule.startTime || !schedule.endTime || !schedule.maxAttendees) {
      return false;
    }
    
    const maxAttendees = parseInt(schedule.maxAttendees);
    if (isNaN(maxAttendees) || maxAttendees <= 0) {
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
    if (!formData.name || !formData.description || !formData.location) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
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
      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name,
        description: formData.description,
        fullDescription: formData.fullDescription || '',
        imageUrl: formData.imageUrl || '',
        location: formData.location,
        locationUrl: formData.locationUrl || '',
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
          const scheduleData = {
            eventId,
            date: new Date(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: parseInt(schedule.maxAttendees)
          };
          await updateEventSchedule(schedule.tempId, scheduleData);
        }

        // 3. Create new schedules
        for (const schedule of schedules.filter(s => s.isNew)) {
          const scheduleData = {
            eventId,
            date: new Date(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: parseInt(schedule.maxAttendees),
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
          const scheduleData = {
            eventId,
            date: new Date(schedule.date),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            maxAttendees: parseInt(schedule.maxAttendees),
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

            <div className="space-y-2">
  <Label htmlFor="imageUrl">URL รูปภาพ Event</Label>
  <div className="flex gap-2">
    <Input
      id="imageUrl"
      type="url"
      value={formData.imageUrl}
      onChange={(e) => {
        let url = e.target.value;
        console.log('Original URL:', url);
        
        // Convert Google Drive share link to direct image URL
        if (url.includes('drive.google.com')) {
          // Extract file ID from various Google Drive URL formats
          let fileId = '';
          
          if (url.includes('/file/d/')) {
            // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
            const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
            if (match) fileId = match[1];
          } else if (url.includes('id=')) {
            // Format: https://drive.google.com/open?id=FILE_ID
            const match = url.match(/id=([a-zA-Z0-9-_]+)/);
            if (match) fileId = match[1];
          }
          
          if (fileId) {
            // Use thumbnail URL that works better with img tags
            url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
            console.log('Converted URL:', url);
          }
        }
        
        // Convert Dropbox share link to direct image URL
        else if (url.includes('dropbox.com')) {
          // Replace www.dropbox.com with dl.dropboxusercontent.com
          url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
          // Remove any dl parameter
          url = url.replace(/[?&]dl=\d/, '');
          console.log('Converted Dropbox URL:', url);
        }
        
        setFormData({ ...formData, imageUrl: url });
      }}
      placeholder="https://example.com/image.jpg, Google Drive หรือ Dropbox link"
      className="flex-1"
    />
    {formData.imageUrl && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.open(formData.imageUrl, '_blank')}
      >
        <Image className="h-4 w-4" />
      </Button>
    )}
  </div>
  <p className="text-xs text-gray-500">
    รองรับ: URL รูปภาพ, Google Drive, Dropbox หรือ imgbb.com • แนะนำขนาด 16:9 (1200x675px)
  </p>
  
  {/* Image Preview */}
  {formData.imageUrl && (
    <div className="mt-2 p-2 border rounded-lg bg-gray-50">
      <p className="text-xs text-gray-600 mb-1">ตัวอย่างรูปภาพ:</p>
      <img 
        src={formData.imageUrl} 
        alt="Preview" 
        className="max-h-40 mx-auto rounded"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <p className="hidden text-xs text-red-500 text-center mt-2">
        ไม่สามารถโหลดรูปได้ - ตรวจสอบ URL หรือการตั้งค่า Share
      </p>
    </div>
  )}
</div>
          </CardContent>
        </Card>

        {/* Location & Branches */}
        <Card>
          <CardHeader>
            <CardTitle>สถานที่และสาขา</CardTitle>
            <CardDescription>กำหนดสถานที่จัดงานและสาขาที่เกี่ยวข้อง</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">สถานที่จัดงาน *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="เช่น อาคาร A ชั้น 3"
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
            </div>
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
            {/* Schedules Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">วันที่</TableHead>
                    <TableHead className="w-24">เวลาเริ่ม</TableHead>
                    <TableHead className="w-24">เวลาจบ</TableHead>
                    <TableHead className="w-28">จำนวนที่รับ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.tempId}>
                      <TableCell>
                        <DateRangePicker
                          mode="single"
                          value={schedule.date}
                          onChange={(date) => handleUpdateSchedule(schedule.tempId, 'date', date || '')}
                          minDate={new Date()}
                          placeholder="เลือกวันที่"
                        />
                      </TableCell>
                      <TableCell>
                        <TimePicker
                          value={schedule.startTime}
                          onChange={(v) => handleUpdateSchedule(schedule.tempId, 'startTime', v)}
                        />
                      </TableCell>
                      <TableCell>
                        <TimePicker
                          value={schedule.endTime}
                          onChange={(v) => handleUpdateSchedule(schedule.tempId, 'endTime', v)}
                          min={schedule.startTime}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={schedule.maxAttendees}
                          onChange={(e) => handleUpdateSchedule(schedule.tempId, 'maxAttendees', e.target.value)}
                          placeholder="50"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
                      </TableCell>
                    </TableRow>
                  ))}
                  {schedules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        ยังไม่มีรอบเวลา คลิก "เพิ่มรอบเวลา" เพื่อเริ่มต้น
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
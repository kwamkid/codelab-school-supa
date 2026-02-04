'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Event, EventSchedule, Branch } from '@/types/models';
import { getEvent, getEventSchedules, createEventRegistration } from '@/lib/services/events';
import { getActiveBranches } from '@/lib/services/branches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeLevelCombobox } from '@/components/ui/grade-level-combobox';
import { SchoolNameCombobox } from '@/components/ui/school-name-combobox';
import { 
  Calendar, 
  MapPin, 
  Users, 
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  User,
  Building2,
  Sparkles,
  Loader2,
  UserCheck,
  RefreshCw,
  Clock,
  CalendarDays
} from 'lucide-react';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { toast } from 'sonner';

interface StudentFormData {
  name: string;
  nickname: string;
  birthdate: string;
  schoolName: string;
  gradeLevel: string;
  selected: boolean;
  isExisting?: boolean; // เพิ่ม flag บอกว่าเป็นนักเรียนเดิม
}

interface ParentFormData {
  name: string;
  phone: string;
  email: string;
  isMainContact: boolean;
}

export default function EventRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [schedules, setSchedules] = useState<EventSchedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Optional LINE login state
  const [lineProfile, setLineProfile] = useState<any>(null);
  const [parentData, setParentData] = useState<any>(null);
  const [existingStudents, setExistingStudents] = useState<any[]>([]);
  
  // Form states
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  
  // Contact info
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  
  // Students/Parents based on counting method
  const [studentForms, setStudentForms] = useState<StudentFormData[]>([]);
  const [parentForms, setParentForms] = useState<ParentFormData[]>([
    { name: '', phone: '', email: '', isMainContact: true }
  ]);
  
  // Additional fields
  const [specialRequest, setSpecialRequest] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    loadData();
    checkLineLogin();
  }, [eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load event
      const eventData = await getEvent(eventId);
      if (!eventData || eventData.status !== 'published') {
        toast.error('Event ไม่พร้อมให้ลงทะเบียน');
        router.push('/liff/events');
        return;
      }
      setEvent(eventData);
      
      // Load schedules
      const schedulesData = await getEventSchedules(eventId);
      const availableSchedules = schedulesData.filter(s => {
        const total = Object.values(s.attendeesByBranch || {}).reduce((sum, count) => sum + count, 0);
        return s.status === 'available' && total < s.maxAttendees;
      });
      setSchedules(availableSchedules);
      
      // Load branches
      const branchesData = await getActiveBranches();
      const eventBranches = branchesData.filter(b => eventData.branchIds.includes(b.id));
      setBranches(eventBranches);
      
      // Set default selections
      if (availableSchedules.length > 0) {
        setSelectedSchedule(availableSchedules[0].id);
      }
      if (eventBranches.length > 0) {
        setSelectedBranch(eventBranches[0].id);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const checkLineLogin = async () => {
    try {
      // ตรวจสอบว่ามี LIFF SDK และ initialized หรือไม่
      if (typeof window !== 'undefined' && window.liff) {
        const liff = window.liff;
        
        // รอให้ LIFF พร้อม
        if (!liff.isReady) {
          await liff.ready;
        }
        
        // ตรวจสอบการ login
        if (liff.isLoggedIn()) {
          try {
            const profile = await liff.getProfile();
            setLineProfile(profile);
            
            // ถ้ามี profile ให้ดึงข้อมูล parent
            const { getParentByLineId, getStudentsByParent } = await import('@/lib/services/parents');
            const parent = await getParentByLineId(profile.userId);
            
            if (parent) {
              setParentData(parent);
              const students = await getStudentsByParent(parent.id);
              setExistingStudents(students.filter(s => s.isActive));
            }
          } catch (error) {
            console.log('Error getting LINE profile:', error);
            // ไม่ต้อง throw error เพราะไม่บังคับ login
          }
        }
      }
    } catch (error) {
      console.log('LIFF not available or error:', error);
      // ไม่ต้อง throw error เพราะไม่บังคับ login
    }
  };

  const handleUseMyData = () => {
    if (!parentData) return;
    
    setContactForm({
      name: parentData.displayName,
      phone: parentData.phone,
      email: parentData.email || '',
      address: parentData.address ? 
        `${parentData.address.houseNumber} ${parentData.address.street || ''} ${parentData.address.subDistrict} ${parentData.address.district} ${parentData.address.province} ${parentData.address.postalCode}`.trim() 
        : ''
    });
    
    // Set preferred branch
    if (parentData.preferredBranchId && branches.some(b => b.id === parentData.preferredBranchId)) {
      setSelectedBranch(parentData.preferredBranchId);
    }
    
    // Pre-fill students if counting by students
    if (event?.countingMethod === 'students' && existingStudents.length > 0) {
      setStudentForms(existingStudents.map(student => ({
        name: student.name,
        nickname: student.nickname,
        birthdate: student.birthdate instanceof Date 
          ? student.birthdate.toISOString().split('T')[0]
          : new Date(student.birthdate).toISOString().split('T')[0],
        schoolName: student.schoolName || '',
        gradeLevel: student.gradeLevel || '',
        selected: true,
        isExisting: true // ทำเครื่องหมายว่าเป็นนักเรียนเดิม
      })));
    }
    
    toast.success('ใช้ข้อมูลของคุณแล้ว');
  };

  const handleResetData = () => {
    setContactForm({
      name: '',
      phone: '',
      email: '',
      address: ''
    });
    
    if (event?.countingMethod === 'students') {
      setStudentForms([]);
    }
    
    toast.success('รีเซ็ตข้อมูลแล้ว');
  };

  const handleAddStudent = () => {
    setStudentForms([...studentForms, {
      name: '',
      nickname: '',
      birthdate: '',
      schoolName: '',
      gradeLevel: '',
      selected: true,
      isExisting: false // นักเรียนใหม่
    }]);
  };

  const handleRemoveStudent = (index: number) => {
    setStudentForms(studentForms.filter((_, i) => i !== index));
  };

  const handleUpdateStudent = (index: number, field: keyof StudentFormData, value: any) => {
    const updated = [...studentForms];
    updated[index] = { ...updated[index], [field]: value };
    setStudentForms(updated);
  };

  const handleAddParent = () => {
    setParentForms([...parentForms, {
      name: '',
      phone: '',
      email: '',
      isMainContact: false
    }]);
  };

  const handleRemoveParent = (index: number) => {
    if (parentForms[index].isMainContact) return;
    setParentForms(parentForms.filter((_, i) => i !== index));
  };

  const handleUpdateParent = (index: number, field: keyof ParentFormData, value: any) => {
    const updated = [...parentForms];
    updated[index] = { ...updated[index], [field]: value };
    setParentForms(updated);
  };

  const validateForm = (): boolean => {
    if (!selectedSchedule || !selectedBranch) {
      toast.error('กรุณาเลือกรอบเวลาและสาขา');
      return false;
    }

    if (!contactForm.name || !contactForm.phone) {
      toast.error('กรุณากรอกชื่อและเบอร์โทรติดต่อ');
      return false;
    }

    if (event?.countingMethod === 'students') {
      const selectedStudents = studentForms.filter(s => s.selected);
      if (selectedStudents.length === 0) {
        toast.error('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');
        return false;
      }
      
      for (const student of selectedStudents) {
        if (!student.name || !student.nickname || !student.birthdate) {
          toast.error('กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน');
          return false;
        }
      }
    } else if (event?.countingMethod === 'parents') {
      const validParents = parentForms.filter(p => p.name && p.phone);
      if (validParents.length === 0) {
        toast.error('กรุณากรอกข้อมูลผู้ปกครองอย่างน้อย 1 คน');
        return false;
      }
    }

    if (!agreeTerms) {
      toast.error('กรุณายอมรับเงื่อนไขการลงทะเบียน');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !event) return;

    setSubmitting(true);
    
    try {
      const schedule = schedules.find(s => s.id === selectedSchedule);
      if (!schedule) throw new Error('Schedule not found');

      // Prepare registration data
      const registrationData: any = {
        eventId: event.id,
        eventName: event.name,
        scheduleId: selectedSchedule,
        scheduleDate: schedule.date,
        scheduleTime: `${schedule.startTime}-${schedule.endTime}`,
        branchId: selectedBranch,
        
        // Guest or member
        isGuest: !lineProfile || !parentData,
        parentId: parentData?.id || null,
        
        // Contact info
        parentName: contactForm.name,
        parentPhone: contactForm.phone,
        
        // Parents (for parent counting)
        parents: event.countingMethod === 'parents' ? 
          parentForms.filter(p => p.name && p.phone).map(p => ({
            name: p.name,
            phone: p.phone,
            email: p.email || null,
            isMainContact: p.isMainContact
          })) : [],
        
        // Students (for student counting)
        students: event.countingMethod === 'students' ?
          studentForms.filter(s => s.selected).map(s => ({
            name: s.name,
            nickname: s.nickname,
            birthdate: new Date(s.birthdate),
            schoolName: s.schoolName || null,
            gradeLevel: s.gradeLevel || null
          })) : [],
        
        // Count based on method
        attendeeCount: event.countingMethod === 'students' ? 
          studentForms.filter(s => s.selected).length :
          event.countingMethod === 'parents' ?
          parentForms.filter(p => p.name && p.phone).length :
          1,
        
        registeredFrom: 'liff' as const
      };
      
      // Add optional fields
      if (lineProfile) {
        registrationData.lineUserId = lineProfile.userId;
        registrationData.lineDisplayName = lineProfile.displayName;
        registrationData.linePictureUrl = lineProfile.pictureUrl;
      }
      if (contactForm.email) {
        registrationData.parentEmail = contactForm.email;
      }
      if (contactForm.address) {
        registrationData.parentAddress = contactForm.address;
      }
      if (specialRequest) {
        registrationData.specialRequest = specialRequest;
      }
      if (referralSource) {
        registrationData.referralSource = referralSource;
      }

      // Use API endpoint for registration to avoid permission issues
      const response = await fetch('/api/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to register');
      }
      
      toast.success('ลงทะเบียนสำเร็จ!');
     
      
      // Send Flex Message if user has LINE ID
      if (lineProfile?.userId) {
        try {
          // Import LINE settings service
          const { getLineSettings } = await import('@/lib/services/line-settings');
          const settings = await getLineSettings();
          
          if (settings?.messagingChannelAccessToken) {
            // Generate Google Calendar URL
            const calendarDate = new Date(schedule.date);
            const [startHours, startMinutes] = schedule.startTime.split(':');
            const [endHours, endMinutes] = schedule.endTime.split(':');
            
            const startDateTime = new Date(calendarDate);
            startDateTime.setHours(parseInt(startHours), parseInt(startMinutes));
            
            const endDateTime = new Date(calendarDate);
            endDateTime.setHours(parseInt(endHours), parseInt(endMinutes));
            
            const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${startDateTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}Z/${endDateTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}Z&details=${encodeURIComponent(`Event: ${event.name}\n${event.description || ''}\n\nจำนวนผู้เข้าร่วม: ${registrationData.attendeeCount} คน`)}&location=${encodeURIComponent(event.location)}`;
            
            // Send Flex Message
            await fetch('/api/line/send-flex-message', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: lineProfile.userId,
                template: 'eventRegistration',
                data: {
                  eventName: event.name,
                  eventDate: formatDate(schedule.date, 'long'),
                  eventTime: `${schedule.startTime} - ${schedule.endTime} น.`,
                  location: event.location,
                  attendeeCount: registrationData.attendeeCount,
                  registrationId: result.registrationId,
                  googleCalendarUrl
                },
                accessToken: settings.messagingChannelAccessToken,
                altText: `✅ ลงทะเบียน ${event.name} สำเร็จ!`
              })
            });
          }
        } catch (error) {
          console.error('Error sending flex message:', error);
          // Don't show error to user, just log it
        }
      }
      

      // ไปหน้า success ทุกกรณี เพื่อหลีกเลี่ยงปัญหา permission
      router.push(`/liff/events/register/${eventId}/success`);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'ไม่สามารถลงทะเบียนได้');
    } finally {
      setSubmitting(false);
    }
  };

  // Update parent forms when contact form changes (for parent counting)
  useEffect(() => {
    if (event?.countingMethod === 'parents' && contactForm.name && contactForm.phone) {
      const updatedParentForms = [...parentForms];
      updatedParentForms[0] = {
        name: contactForm.name,
        phone: contactForm.phone,
        email: contactForm.email || '',
        isMainContact: true
      };
      setParentForms(updatedParentForms);
    }
  }, [event?.countingMethod, contactForm, parentForms.length]);

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'open-house': 'bg-blue-100 text-blue-700',
      'parent-meeting': 'bg-green-100 text-green-700',
      'showcase': 'bg-purple-100 text-purple-700',
      'workshop': 'bg-orange-100 text-orange-700',
      'other': 'bg-gray-100 text-gray-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getEventTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'open-house': 'Open House',
      'parent-meeting': 'Parent Meeting',
      'showcase': 'Showcase',
      'workshop': 'Workshop',
      'other': 'อื่นๆ'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!event || schedules.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">ไม่สามารถลงทะเบียนได้</h3>
            <p className="text-gray-600 mb-4">Event นี้อาจปิดรับสมัครแล้วหรือเต็มแล้ว</p>
            <Button variant="outline" onClick={() => router.push('/liff/events')}>
              กลับไปหน้า Events
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedScheduleData = schedules.find(s => s.id === selectedSchedule);
  const availableSeats = selectedScheduleData ? 
    selectedScheduleData.maxAttendees - 
    Object.values(selectedScheduleData.attendeesByBranch).reduce((sum, count) => sum + count, 0) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 mb-2"
          >
            <ChevronLeft className="h-5 w-5" />
            กลับ
          </button>
          <h1 className="text-xl font-bold">ลงทะเบียน Event</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pb-4">
        {/* Event Cover Image */}
        {event.imageUrl && (
          <div className="relative w-full aspect-video bg-gray-100">
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Image load error:', event.imageUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute top-2 right-2">
              <Badge className={getEventTypeColor(event.eventType)}>
                {getEventTypeLabel(event.eventType)}
              </Badge>
            </div>
          </div>
        )}

        {/* Event Info */}
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{event.name}</CardTitle>
                {!event.imageUrl && (
                  <Badge className={getEventTypeColor(event.eventType)}>
                    {getEventTypeLabel(event.eventType)}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">{event.location}</p>
                  {event.locationUrl && (
                    <a 
                      href={event.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs"
                    >
                      ดูแผนที่
                    </a>
                  )}
                </div>
              </div>
              
              {event.targetAudience && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>{event.targetAudience}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                <span>
                  รับลงทะเบียน: {formatDate(event.registrationStartDate, 'short')} - {formatDate(event.registrationEndDate, 'short')}
                </span>
              </div>
              
              <div className="pt-2 border-t">
                <Badge variant="outline" className="text-xs">
                  {event.countingMethod === 'students' && 'นับจำนวนนักเรียน'}
                  {event.countingMethod === 'parents' && 'นับจำนวนผู้ปกครอง'}
                  {event.countingMethod === 'registrations' && 'นับจำนวนการลงทะเบียน'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Branch Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">เลือกรอบเวลาและสาขา</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Schedule */}
              <div className="space-y-2">
                <Label>รอบเวลา *</Label>
                <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือกรอบเวลา" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    {schedules.map(schedule => {
                      const available = schedule.maxAttendees - 
                        Object.values(schedule.attendeesByBranch).reduce((sum, count) => sum + count, 0);
                      
                      return (
                        <SelectItem 
                          key={schedule.id} 
                          value={schedule.id}
                          disabled={available <= 0}
                          className="w-full"
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="truncate">{formatDate(schedule.date, 'long')} • {schedule.startTime}-{schedule.endTime}</span>
                            <span className={`text-xs whitespace-nowrap ${available <= 2 && available > 0 ? 'text-red-600 font-semibold' : ''}`}>
                              {available <= 0 ? '(เต็ม)' : `(เหลือ ${available} ที่)`}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedScheduleData && availableSeats <= 5 && availableSeats > 0 && (
                  <p className={`text-xs flex items-center gap-1 ${availableSeats <= 2 ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
                    <AlertCircle className="h-3 w-3" />
                    เหลือที่ว่างน้อย รีบจองด่วน!
                  </p>
                )}
              </div>

              {/* Branch */}
              <div className="space-y-2">
                <Label>สาขา *</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {branch.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">
                  {event?.countingMethod === 'parents' ? 'ผู้ร่วมงานหลัก' : 'ข้อมูลติดต่อ'}
                </CardTitle>
                {lineProfile && parentData && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUseMyData}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      ใช้ข้อมูลของฉัน
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetData}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineProfile && !parentData && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Login แล้วแต่ยังไม่ได้ลงทะเบียนในระบบ
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">ชื่อ-นามสกุล *</Label>
                  <Input
                    id="contactName"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">เบอร์โทร *</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="0812345678"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">อีเมล</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactAddress">ที่อยู่</Label>
                  <Textarea
                    id="contactAddress"
                    value={contactForm.address}
                    onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                    placeholder="ที่อยู่สำหรับติดต่อ"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students (if counting by students) */}
          {event.countingMethod === 'students' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลนักเรียน</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentForms.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    ยังไม่มีข้อมูลนักเรียน
                  </p>
                ) : (
                  studentForms.map((student, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      {student.isExisting ? (
                        // Show as checkbox for existing students
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={student.selected}
                            onCheckedChange={(checked) => 
                              handleUpdateStudent(index, 'selected', checked)
                            }
                          />
                          <div className="flex-1">
                            <p className="font-medium">{student.name} ({student.nickname})</p>
                            <p className="text-sm text-gray-500">
                              {student.schoolName && `${student.schoolName} • `}
                              {student.gradeLevel}
                            </p>
                          </div>
                        </div>
                      ) : (
                        // Show form for new students
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">นักเรียนคนที่ {index + 1}</h4>
                            {studentForms.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveStudent(index)}
                              >
                                ลบ
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">ชื่อจริง *</Label>
                              <Input
                                value={student.name}
                                onChange={(e) => handleUpdateStudent(index, 'name', e.target.value)}
                                placeholder="ชื่อ-นามสกุล"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs">ชื่อเล่น *</Label>
                              <Input
                                value={student.nickname}
                                onChange={(e) => handleUpdateStudent(index, 'nickname', e.target.value)}
                                placeholder="ชื่อเล่น"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs">วันเกิด *</Label>
                              <Input
                                type="date"
                                value={student.birthdate}
                                onChange={(e) => handleUpdateStudent(index, 'birthdate', e.target.value)}
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs">โรงเรียน</Label>
                              <SchoolNameCombobox
                                value={student.schoolName}
                                onChange={(value) => handleUpdateStudent(index, 'schoolName', value)}
                              />
                            </div>
                            
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs">ระดับชั้น</Label>
                              <GradeLevelCombobox
                                value={student.gradeLevel}
                                onChange={(value) => handleUpdateStudent(index, 'gradeLevel', value)}
                                placeholder="เลือกหรือพิมพ์ระดับชั้น..."
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddStudent}
                  className="w-full"
                >
                  <User className="h-4 w-4 mr-2" />
                  เพิ่มนักเรียน
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Parents (if counting by parents) */}
          {event.countingMethod === 'parents' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ผู้ร่วมงานเพิ่มเติม</CardTitle>
                <p className="text-sm text-gray-500">
                  เพิ่มผู้ร่วมงานอื่นๆ นอกจากผู้ร่วมงานหลัก
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {parentForms.slice(1).map((parent, index) => (
                  <div key={index + 1} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">
                        ผู้ร่วมงานคนที่ {index + 2}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveParent(index + 1)}
                      >
                        ลบ
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">ชื่อ-นามสกุล *</Label>
                        <Input
                          value={parent.name}
                          onChange={(e) => handleUpdateParent(index + 1, 'name', e.target.value)}
                          placeholder="ชื่อ-นามสกุล"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">เบอร์โทร *</Label>
                        <Input
                          type="tel"
                          value={parent.phone}
                          onChange={(e) => handleUpdateParent(index + 1, 'phone', e.target.value)}
                          placeholder="0812345678"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">อีเมล</Label>
                        <Input
                          type="email"
                          value={parent.email}
                          onChange={(e) => handleUpdateParent(index + 1, 'email', e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddParent}
                  className="w-full"
                >
                  <User className="h-4 w-4 mr-2" />
                  เพิ่มผู้ร่วมงาน
                </Button>
                
                <p className="text-xs text-gray-500 text-center">
                  จำนวนผู้ร่วมงานทั้งหมด: {parentForms.filter(p => p.name && p.phone).length} คน
                  (รวมผู้ร่วมงานหลัก)
                </p>
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลเพิ่มเติม</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="specialRequest">ความต้องการพิเศษ</Label>
                <Textarea
                  id="specialRequest"
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                  placeholder="เช่น อาหารที่แพ้, ความต้องการพิเศษ"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="referralSource">รู้จักงานนี้จากที่ไหน</Label>
                <Select value={referralSource} onValueChange={setReferralSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกช่องทาง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="line">LINE</SelectItem>
                    <SelectItem value="website">เว็บไซต์</SelectItem>
                    <SelectItem value="friend">เพื่อน/คนรู้จัก</SelectItem>
                    <SelectItem value="school">โรงเรียน</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* What to bring */}
          {event.whatToBring && event.whatToBring.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  สิ่งที่ควรนำมา
                </h3>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  {event.whatToBring.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Terms & Conditions */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    เงื่อนไขการลงทะเบียน
                  </h3>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>การลงทะเบียนจะสมบูรณ์เมื่อได้รับการยืนยันจากเจ้าหน้าที่</li>
                    <li>กรุณามาถึงสถานที่จัดงานก่อนเวลา 15 นาที</li>
                    <li>หากไม่สามารถเข้าร่วมได้ กรุณาแจ้งล่วงหน้าอย่างน้อย 24 ชั่วโมง</li>
                  </ul>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agreeTerms"
                    checked={agreeTerms}
                    onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                  />
                  <Label 
                    htmlFor="agreeTerms" 
                    className="text-sm font-normal leading-relaxed"
                  >
                    ข้าพเจ้ายอมรับเงื่อนไขการลงทะเบียนและยินยอมให้ CodeLab School 
                    ใช้ข้อมูลเพื่อติดต่อและประชาสัมพันธ์กิจกรรมต่างๆ
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-white p-4 border-t shadow-lg -mx-4">
            <Button
              className="w-full bg-red-500 hover:bg-red-600"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !agreeTerms}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  กำลังลงทะเบียน...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  ยืนยันการลงทะเบียน
                </>
              )}
            </Button>
            
            {/* Summary */}
            <div className="mt-3 text-center text-sm text-gray-600">
              {event.countingMethod === 'students' && (
                <span>จำนวนนักเรียน: {studentForms.filter(s => s.selected).length} คน</span>
              )}
              {event.countingMethod === 'parents' && (
                <span>จำนวนผู้เข้าร่วม: {parentForms.filter(p => p.name && p.phone).length} คน</span>
              )}
              {event.countingMethod === 'registrations' && (
                <span>ลงทะเบียน 1 รายการ</span>
              )}
              {selectedScheduleData && (
                <span> • {formatDate(selectedScheduleData.date, 'short')} {selectedScheduleData.startTime}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
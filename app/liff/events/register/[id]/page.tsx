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
  CalendarDays,
  Plus,
  Trash2
} from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SectionLoading } from '@/components/ui/loading';
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
  
  // Students/Parents based on counting method — start with 1 student form
  const [studentForms, setStudentForms] = useState<StudentFormData[]>([
    { name: '', nickname: '', birthdate: '', schoolName: '', gradeLevel: '', selected: true, isExisting: false }
  ]);
  const [parentForms, setParentForms] = useState<ParentFormData[]>([
    { name: '', phone: '', email: '', isMainContact: true }
  ]);
  
  // Phone lookup
  const [phoneLookupDone, setPhoneLookupDone] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Additional fields
  const [specialRequest, setSpecialRequest] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    loadData();
    checkLineLogin();
    // Track page view
    fetch('/api/events/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    }).catch(() => {});
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
        return s.status === 'available';
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
      toast.error('ไม่พบกิจกรรมนี้');
      router.push('/liff/events');
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
    
    setPhoneLookupDone(false);
    setParentData(null);
    setExistingStudents([]);
    toast.success('รีเซ็ตข้อมูลแล้ว');
  };

  const handlePhoneLookup = async (phone: string) => {
    // Only lookup when phone is 10 digits
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10 || phoneLookupDone) return;

    setLookingUp(true);
    try {
      const { searchParentsUnified } = await import('@/lib/services/parents');
      const results = await searchParentsUnified(cleaned);

      if (results.length > 0) {
        const parent = results[0];
        setParentData(parent);

        // Auto-fill contact
        setContactForm(prev => ({
          ...prev,
          name: parent.displayName || prev.name,
          email: parent.email || prev.email,
          address: parent.address
            ? `${parent.address.houseNumber} ${parent.address.street || ''} ${parent.address.subDistrict} ${parent.address.district} ${parent.address.province} ${parent.address.postalCode}`.trim()
            : prev.address
        }));

        // Load students
        const { getStudentsByParent } = await import('@/lib/services/parents');
        const students = await getStudentsByParent(parent.id);
        const activeStudents = students.filter((s: any) => s.isActive);
        setExistingStudents(activeStudents);

        // Pre-fill students if counting by students
        if (event?.countingMethod === 'students' && activeStudents.length > 0) {
          setStudentForms(activeStudents.map((student: any) => ({
            name: student.name,
            nickname: student.nickname,
            birthdate: student.birthdate instanceof Date
              ? student.birthdate.toISOString().split('T')[0]
              : new Date(student.birthdate).toISOString().split('T')[0],
            schoolName: student.schoolName || '',
            gradeLevel: student.gradeLevel || '',
            selected: true,
            isExisting: true
          })));
        }

        // Set preferred branch
        if (parent.preferredBranchId && branches.some((b: any) => b.id === parent.preferredBranchId)) {
          setSelectedBranch(parent.preferredBranchId);
        }

        toast.success(`พบข้อมูล ${parent.displayName} ดึงข้อมูลให้แล้ว`);
      }
    } catch (error) {
      console.log('Phone lookup error:', error);
    } finally {
      setLookingUp(false);
      setPhoneLookupDone(true);
    }
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
        <SectionLoading text="กำลังโหลดข้อมูล..." />
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
  // Calculate available seats per selected branch
  const getAvailableSeats = (schedule: typeof schedules[0], branchId?: string) => {
    const mabb = (schedule as any).maxAttendeesByBranch || {};
    if (branchId && mabb[branchId]) {
      const branchMax = mabb[branchId] as number;
      const branchCurrent = (schedule.attendeesByBranch[branchId] || 0);
      return branchMax - branchCurrent;
    }
    // Fallback: total
    const total = Object.values(schedule.attendeesByBranch).reduce((sum, count) => sum + count, 0);
    return schedule.maxAttendees - total;
  };
  const availableSeats = selectedScheduleData ? getAvailableSeats(selectedScheduleData, selectedBranch) : 0;

  const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 border-b border-orange-100">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">ลงทะเบียน Event</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pb-32">
        {/* Event Cover Image */}
        {event.imageUrl && (
          <div className="relative w-full aspect-video bg-gray-100">
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <Badge className={`${getEventTypeColor(event.eventType)} shadow-sm`}>
                {getEventTypeLabel(event.eventType)}
              </Badge>
            </div>
          </div>
        )}

        {/* Event Info Card */}
        <div className="p-4 space-y-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{event.name}</h2>
                {!event.imageUrl && (
                  <Badge className={getEventTypeColor(event.eventType)}>
                    {getEventTypeLabel(event.eventType)}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{event.description}</p>

              {event.fullDescription && (
                <details className="mt-3 group">
                  <summary className="text-sm text-orange-600 font-medium cursor-pointer hover:text-orange-700 flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4 -rotate-90 group-open:rotate-0 transition-transform" />
                    ดูรายละเอียดเพิ่มเติม
                  </summary>
                  <div className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-3">
                    {event.fullDescription}
                  </div>
                </details>
              )}
            </div>
            <div className="px-4 pb-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-sm">
                <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900">{event.location}</p>
                  {(() => {
                    const selectedBranchData = branches.find(b => b.id === selectedBranch);
                    const mapUrl = event.locationUrl
                      || (selectedBranchData?.location?.lat && selectedBranchData?.location?.lng
                        ? `https://www.google.com/maps?q=${selectedBranchData.location.lat},${selectedBranchData.location.lng}`
                        : null);
                    return mapUrl ? (
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full hover:bg-orange-100 transition"
                      >
                        <MapPin className="h-3 w-3" />
                        ดูแผนที่
                      </a>
                    ) : null;
                  })()}
                </div>
              </div>
              {event.targetAudience && (
                <div className="flex items-center gap-2.5 text-sm">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <span className="text-gray-700">{event.targetAudience}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm">
                <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="h-3.5 w-3.5 text-green-600" />
                </div>
                <span className="text-gray-700">
                  รับลงทะเบียน: {formatDate(event.registrationStartDate, 'short')} - {formatDate(event.registrationEndDate, 'short')}
                </span>
              </div>
            </div>
          </div>

          {/* STEP 1: Branch → Schedule */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">1</div>
              เลือกสาขาและรอบเวลา
            </h3>

            {/* Branch first */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">สาขา *</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-orange-500" />
                        {branch.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule (after branch) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">รอบเวลา *</Label>
              <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="เลือกรอบเวลา" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map(schedule => {
                    const available = getAvailableSeats(schedule, selectedBranch);
                    return (
                      <SelectItem
                        key={schedule.id}
                        value={schedule.id}
                        disabled={available <= 0}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{formatDate(schedule.date, 'long')} {schedule.startTime?.substring(0, 5)}-{schedule.endTime?.substring(0, 5)}</span>
                          <span className={`text-xs whitespace-nowrap ${available <= 2 && available > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            {available <= 0 ? '(เต็ม)' : `(เหลือ ${available} ที่)`}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedScheduleData && availableSeats <= 5 && availableSeats > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="h-3 w-3" />
                  เหลือที่ว่างน้อย รีบจองด่วน!
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: Contact */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">2</div>
                ข้อมูลติดต่อ
              </h3>
              {lineProfile && parentData && (
                <div className="flex gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={handleUseMyData} className="text-xs h-8">
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    ใช้ข้อมูลของฉัน
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleResetData} className="h-8 w-8 p-0">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {lineProfile && !parentData && (
              <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Login แล้วแต่ยังไม่ได้ลงทะเบียนในระบบ
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">เบอร์โทร *</Label>
              <div className="relative">
                <Input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContactForm({ ...contactForm, phone: val });
                    // Reset lookup when phone changes
                    if (phoneLookupDone) setPhoneLookupDone(false);
                  }}
                  onBlur={() => handlePhoneLookup(contactForm.phone)}
                  placeholder="0812345678"
                  className="bg-gray-50 border-gray-200"
                />
                {lookingUp && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {parentData && !lineProfile && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>พบข้อมูลในระบบ: {parentData.displayName} — ดึงข้อมูลให้อัตโนมัติแล้ว</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">ชื่อ-นามสกุล *</Label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">อีเมล</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="bg-gray-50 border-gray-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">ที่อยู่</Label>
                <Input
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  placeholder="ที่อยู่สำหรับติดต่อ"
                  className="bg-gray-50 border-gray-200"
                />
              </div>
            </div>

          </div>

          {/* STEP 3: Students (if counting by students) */}
          {event.countingMethod === 'students' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">3</div>
                ข้อมูลนักเรียน
                <Badge variant="secondary" className="ml-auto text-xs">{studentForms.filter(s => s.selected).length} คน</Badge>
              </h3>

              {studentForms.map((student, index) => (
                <div key={index}>
                  {/* Divider between students */}
                  {index > 0 && (
                    <div className="flex items-center gap-3 py-2 mb-4">
                      <div className="flex-1 border-t border-dashed border-gray-300" />
                      <span className="text-xs text-gray-400 font-medium">นักเรียนคนที่ {index + 1}</span>
                      <div className="flex-1 border-t border-dashed border-gray-300" />
                    </div>
                  )}

                  {student.isExisting ? (
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                      <Checkbox
                        checked={student.selected}
                        onCheckedChange={(checked) => handleUpdateStudent(index, 'selected', checked)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{student.name} ({student.nickname})</p>
                        <p className="text-sm text-gray-500">
                          {student.schoolName && `${student.schoolName} • `}
                          {student.gradeLevel}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {index === 0 && studentForms.length === 1 ? null : (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStudent(index)}
                            className="text-red-500 hover:text-red-600 text-xs h-7"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            ลบ
                          </Button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700">ชื่อจริง *</Label>
                          <Input
                            value={student.name}
                            onChange={(e) => handleUpdateStudent(index, 'name', e.target.value)}
                            placeholder="ชื่อ-นามสกุล"
                            className="bg-gray-50 border-gray-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700">ชื่อเล่น *</Label>
                          <Input
                            value={student.nickname}
                            onChange={(e) => handleUpdateStudent(index, 'nickname', e.target.value)}
                            placeholder="ชื่อเล่น"
                            className="bg-gray-50 border-gray-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700">วันเกิด *</Label>
                          <DateRangePicker
                            mode="single"
                            value={student.birthdate}
                            onChange={(date) => handleUpdateStudent(index, 'birthdate', date || '')}
                            placeholder="เลือกวันที่"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700">โรงเรียน</Label>
                          <SchoolNameCombobox
                            value={student.schoolName}
                            onChange={(value) => handleUpdateStudent(index, 'schoolName', value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">ระดับชั้น</Label>
                        <GradeLevelCombobox
                          value={student.gradeLevel}
                          onChange={(value) => handleUpdateStudent(index, 'gradeLevel', value)}
                          placeholder="เลือกหรือพิมพ์ระดับชั้น..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddStudent}
                className="w-full border-dashed border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มนักเรียน
              </Button>
            </div>
          )}

          {/* Parents (if counting by parents) */}
          {event.countingMethod === 'parents' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">3</div>
                ผู้ร่วมงานเพิ่มเติม
                <Badge variant="secondary" className="ml-auto text-xs">{parentForms.filter(p => p.name && p.phone).length} คน</Badge>
              </h3>
              <p className="text-sm text-gray-500">เพิ่มผู้ร่วมงานอื่นๆ นอกจากผู้ร่วมงานหลัก</p>

              {parentForms.slice(1).map((parent, index) => (
                <div key={index + 1}>
                  {index > 0 && (
                    <div className="flex items-center gap-3 py-2 mb-4">
                      <div className="flex-1 border-t border-dashed border-gray-300" />
                      <span className="text-xs text-gray-400 font-medium">คนที่ {index + 2}</span>
                      <div className="flex-1 border-t border-dashed border-gray-300" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveParent(index + 1)} className="text-red-500 text-xs h-7">
                        <Trash2 className="h-3 w-3 mr-1" /> ลบ
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-gray-700">ชื่อ-นามสกุล *</Label>
                      <Input value={parent.name} onChange={(e) => handleUpdateParent(index + 1, 'name', e.target.value)} placeholder="ชื่อ-นามสกุล" className="bg-gray-50" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">เบอร์โทร *</Label>
                        <Input type="tel" value={parent.phone} onChange={(e) => handleUpdateParent(index + 1, 'phone', e.target.value)} placeholder="0812345678" className="bg-gray-50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">อีเมล</Label>
                        <Input type="email" value={parent.email} onChange={(e) => handleUpdateParent(index + 1, 'email', e.target.value)} placeholder="email@example.com" className="bg-gray-50" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={handleAddParent} className="w-full border-dashed border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-600">
                <Plus className="h-4 w-4 mr-2" /> เพิ่มผู้ร่วมงาน
              </Button>
            </div>
          )}

          {/* Additional Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center">{event.countingMethod === 'registrations' ? 3 : 4}</div>
              ข้อมูลเพิ่มเติม
            </h3>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">ความต้องการพิเศษ</Label>
              <Textarea
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                placeholder="เช่น อาหารที่แพ้, ความต้องการพิเศษ"
                rows={2}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">รู้จักงานนี้จากที่ไหน</Label>
              <Select value={referralSource} onValueChange={setReferralSource}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
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
          </div>

          {/* What to bring */}
          {event.whatToBring && event.whatToBring.length > 0 && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2 text-blue-800">
                <Sparkles className="h-4 w-4" />
                สิ่งที่ควรนำมา
              </h3>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                {event.whatToBring.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Terms */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <h3 className="font-medium flex items-center gap-2 text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4" />
                เงื่อนไขการลงทะเบียน
              </h3>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>การลงทะเบียนจะสมบูรณ์เมื่อได้รับการยืนยันจากเจ้าหน้าที่</li>
                <li>กรุณามาถึงสถานที่จัดงานก่อนเวลา 15 นาที</li>
                <li>หากไม่สามารถเข้าร่วมได้ กรุณาแจ้งล่วงหน้าอย่างน้อย 24 ชั่วโมง</li>
              </ul>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agreeTerms"
                checked={agreeTerms}
                onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                className="mt-0.5 h-5 w-5 border-2 border-gray-400 data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
              />
              <Label htmlFor="agreeTerms" className="text-sm font-normal leading-relaxed text-gray-700">
                ข้าพเจ้ายอมรับเงื่อนไขการลงทะเบียนและยินยอมให้ CodeLab School
                ใช้ข้อมูลเพื่อติดต่อและประชาสัมพันธ์กิจกรรมต่างๆ
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20">
        <Button
          className="w-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 rounded-xl h-12 text-base font-semibold"
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
        <div className="mt-2 text-center text-xs text-gray-500">
          {event.countingMethod === 'students' && (
            <span>นักเรียน {studentForms.filter(s => s.selected).length} คน</span>
          )}
          {event.countingMethod === 'parents' && (
            <span>ผู้เข้าร่วม {parentForms.filter(p => p.name && p.phone).length} คน</span>
          )}
          {event.countingMethod === 'registrations' && <span>1 รายการ</span>}
          {selectedScheduleData && (
            <span> | {formatDate(selectedScheduleData.date, 'short')} {selectedScheduleData.startTime?.substring(0, 5)}</span>
          )}
          {selectedBranchName && <span> | {selectedBranchName}</span>}
        </div>
      </div>
    </div>
  );
}
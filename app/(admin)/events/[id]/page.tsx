'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Event, EventSchedule, EventRegistration, Branch } from '@/types/models';
import { 
  getEvent, 
  getEventSchedules, 
  getEventRegistrations,
  getEventStatistics,
  createEventSchedule,
  updateEventSchedule,
  deleteEventSchedule,
  updateEventAttendance
} from '@/lib/services/events';
import { getActiveBranches } from '@/lib/services/branches';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronLeft, 
  Edit, 
  Calendar,
  MapPin,
  Users,
  Bell,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  UserCheck,
  BarChart3,
  Clock,
  AlertCircle,
  LinkIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatTime } from '@/lib/utils';
import ScheduleManager from '@/components/events/schedule-manager';
import RegistrationList from '@/components/events/registration-list';
import AttendanceChecker from '@/components/events/attendance-checker';
import EventStatistics from '@/components/events/event-statistics';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isSuperAdmin } = useAuth();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [schedules, setSchedules] = useState<EventSchedule[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [eventId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventData, schedulesData, registrationsData, statsData, branchesData] = await Promise.all([
        getEvent(eventId),
        getEventSchedules(eventId),
        getEventRegistrations(eventId),
        getEventStatistics(eventId),
        getActiveBranches()
      ]);
      
      if (!eventData) {
        toast.error('ไม่พบข้อมูล Event');
        router.push('/events');
        return;
      }
      
      setEvent(eventData);
      setSchedules(schedulesData);
      setRegistrations(registrationsData);
      setStatistics(statsData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading event data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleUpdate = async () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleAttendanceUpdate = async (attendanceData: any[]) => {
    try {
      await updateEventAttendance(attendanceData, user!.uid);
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('ไม่สามารถบันทึกการเช็คชื่อได้');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-700',
      'published': 'bg-green-100 text-green-700',
      'completed': 'bg-blue-100 text-blue-700',
      'cancelled': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'draft': 'ร่าง',
      'published': 'เผยแพร่แล้ว',
      'completed': 'จบแล้ว',
      'cancelled': 'ยกเลิก'
    };
    return texts[status] || status;
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/events" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          กลับไปหน้ารายการ Events
        </Link>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
            <Badge className={getStatusColor(event.status)}>
              {getStatusText(event.status)}
            </Badge>
            <Badge variant="outline">
              {getEventTypeLabel(event.eventType)}
            </Badge>
          </div>
          <p className="text-gray-600">{event.description}</p>
        </div>
        
        <div className="flex gap-2">
          {event.status === 'published' && (
            <Button
              variant="outline"
              onClick={() => {
                const link = `${window.location.origin}/liff/events/register/${event.id}`;
                navigator.clipboard.writeText(link);
                toast.success('คัดลอกลิงก์ลงทะเบียนแล้ว');
              }}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              คัดลอกลิงก์ลงทะเบียน
            </Button>
          )}
          
          <PermissionGuard action="update">
            <Link href={`/events/${event.id}/edit`}>
              <Button className="bg-red-500 hover:bg-red-600">
                <Edit className="h-4 w-4 mr-2" />
                แก้ไข Event
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              สถานที่
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{event.location}</p>
            {event.locationUrl && (
              <a 
                href={event.locationUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                ดูแผนที่
              </a>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              รับลงทะเบียน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatDate(event.registrationStartDate, 'short')}</p>
            <p className="text-sm text-gray-500">ถึง {formatDate(event.registrationEndDate, 'short')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              ผู้ลงทะเบียน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {registrations
                .filter(r => r.status !== 'cancelled')
                .reduce((sum, r) => sum + r.attendeeCount, 0)}
              <span className="text-lg font-normal text-gray-500">/{statistics?.totalCapacity || 0}</span>
            </p>
            <div className="mt-2 mb-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${Math.min(100, 
                      (registrations
                        .filter(r => r.status !== 'cancelled')
                        .reduce((sum, r) => sum + r.attendeeCount, 0) / (statistics?.totalCapacity || 1)) * 100
                    )}%` 
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {registrations.filter(r => r.status !== 'cancelled').length} รายการ
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              การแจ้งเตือน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {event.enableReminder ? (
              <div>
                <Badge className="bg-green-100 text-green-700">เปิด</Badge>
                <p className="text-sm text-gray-500 mt-1">
                  ล่วงหน้า {event.reminderDaysBefore} วัน
                </p>
              </div>
            ) : (
              <Badge variant="outline">ปิด</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            ภาพรวม
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            รอบเวลา ({schedules.length})
          </TabsTrigger>
           <TabsTrigger value="registrations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            ผู้ลงทะเบียน ({registrations
              .filter(r => r.status !== 'cancelled')
              .reduce((sum, r) => sum + r.attendeeCount, 0)})
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            สถิติ
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>รายละเอียด Event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.fullDescription && (
                <div>
                  <h3 className="font-medium mb-2">รายละเอียดแบบเต็ม</h3>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{event.fullDescription}</p>
                  </div>
                </div>
              )}
              
              {event.targetAudience && (
                <div>
                  <h3 className="font-medium mb-2">กลุ่มเป้าหมาย</h3>
                  <p className="text-gray-600">{event.targetAudience}</p>
                </div>
              )}
              
              {event.highlights && event.highlights.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">จุดเด่นของงาน</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {event.highlights.map((highlight, index) => (
                      <li key={index} className="text-gray-600">{highlight}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {event.whatToBring && event.whatToBring.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">สิ่งที่ควรนำมา</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {event.whatToBring.map((item, index) => (
                      <li key={index} className="text-gray-600">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Branches */}
          <Card>
            <CardHeader>
              <CardTitle>สาขาที่จัด Event</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {event.branchIds.map(branchId => (
                  <Badge key={branchId} variant="outline">
                    {getBranchName(branchId)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Registration Link */}
          {event.status === 'published' && (
            <Card>
              <CardHeader>
                <CardTitle>ลิงก์สำหรับลงทะเบียน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm break-all">
                    {window.location.origin}/liff/events/register/{event.id}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      const link = `${window.location.origin}/liff/events/register/${event.id}`;
                      navigator.clipboard.writeText(link);
                      toast.success('คัดลอกลิงก์แล้ว');
                    }}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    คัดลอกลิงก์
                  </Button>
                  <p className="text-sm text-gray-500">
                    * ผู้ใช้สามารถลงทะเบียนได้โดยตรงผ่านลิงก์นี้ โดยไม่ต้องสมัครสมาชิกก่อน
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>การตั้งค่า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">วิธีนับจำนวน</span>
                <Badge variant="secondary">
                  {event.countingMethod === 'registrations' && 'นับจำนวนการลงทะเบียน'}
                  {event.countingMethod === 'students' && 'นับจำนวนนักเรียน'}
                  {event.countingMethod === 'parents' && 'นับจำนวนผู้ปกครอง'}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">การแจ้งเตือน</span>
                <div className="text-right">
                  {event.enableReminder ? (
                    <div>
                      <Badge className="bg-green-100 text-green-700">เปิด</Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        ล่วงหน้า {event.reminderDaysBefore} วัน เวลา {event.reminderTime || '10:00'} น.
                      </p>
                    </div>
                  ) : (
                    <Badge variant="outline">ปิด</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules">
          <ScheduleManager 
            eventId={eventId}
            schedules={schedules}
            onUpdate={handleScheduleUpdate}
          />
        </TabsContent>

        {/* Registrations Tab */}
        <TabsContent value="registrations">
          <RegistrationList
            eventId={eventId}
            registrations={registrations}
            schedules={schedules}
            branches={branches}
            countingMethod={event.countingMethod}
            onUpdate={handleScheduleUpdate}
          />
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics">
          <EventStatistics
            event={event}
            schedules={schedules}
            registrations={registrations}
            branches={branches}
            statistics={statistics}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
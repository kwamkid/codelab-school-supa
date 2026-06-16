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
  updateEventAttendance,
  updateEvent
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
  Plus,
  UserCheck,
  BarChart3,
  Clock,
  AlertCircle,
  LinkIcon,
  ChevronDown,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionLoading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { formatDate, formatTime, cn } from '@/lib/utils';
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
  const [copyingLink, setCopyingLink] = useState(false);

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

  const [statusChanging, setStatusChanging] = useState(false);
  const handleStatusChange = async (newStatus: Event['status']) => {
    if (!event || newStatus === event.status) return;
    setStatusChanging(true);
    // Optimistic update
    setEvent({ ...event, status: newStatus });
    try {
      await updateEvent(event.id, { status: newStatus }, user!.uid);
      toast.success('เปลี่ยนสถานะเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
      setEvent({ ...event }); // revert
      setRefreshKey(prev => prev + 1);
    } finally {
      setStatusChanging(false);
    }
  };

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
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

  // Solid dot colors — the soft badge backgrounds are too faint for a small dot.
  const getStatusDotColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-400',
      'published': 'bg-green-500',
      'completed': 'bg-blue-500',
      'cancelled': 'bg-red-500'
    };
    return colors[status] || 'bg-gray-400';
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

  const activeRegs = registrations.filter(r => r.status !== 'cancelled');
  const totalRegistered = activeRegs.reduce((sum, r) => sum + r.attendeeCount, 0);
  const totalAttended = registrations.filter(r => r.status === 'attended').length;
  const totalCapacity = statistics?.totalCapacity || 0;
  const countUnit = event.countingMethod === 'registrations' ? 'รายการ' : 'คน';

  // Event date range from schedules (real "วันที่จัด")
  const scheduleDates = schedules
    .map(s => new Date(s.date).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);
  const firstDate = scheduleDates.length ? new Date(scheduleDates[0]) : null;
  const lastDate = scheduleDates.length ? new Date(scheduleDates[scheduleDates.length - 1]) : null;
  const eventDateLabel = firstDate
    ? (lastDate && lastDate.getTime() !== firstDate.getTime()
        ? `${formatDate(firstDate, 'short')} - ${formatDate(lastDate, 'short')}`
        : formatDate(firstDate, 'short'))
    : null;

  // Per-branch breakdown: registered + capacity (summed over schedules) + per-schedule rows.
  const branchBreakdown = event.branchIds.map((branchId) => {
    const capacity = schedules.reduce((sum, s) => {
      const mabb = (s as any).maxAttendeesByBranch || {};
      return sum + (mabb[branchId] || 0);
    }, 0);
    const registered = activeRegs
      .filter(r => r.branchId === branchId)
      .reduce((sum, r) => sum + r.attendeeCount, 0);
    const attended = registrations
      .filter(r => r.branchId === branchId && r.status === 'attended')
      .reduce((sum, r) => sum + r.attendeeCount, 0);
    const perSchedule = schedules.map((s) => {
      const mabb = (s as any).maxAttendeesByBranch || {};
      const cap = mabb[branchId] || 0;
      const reg = activeRegs
        .filter(r => r.scheduleId === s.id && r.branchId === branchId)
        .reduce((sum, r) => sum + r.attendeeCount, 0);
      return { schedule: s, cap, reg };
    }).filter(x => x.cap > 0 || x.reg > 0);
    const isFull = capacity > 0 && registered >= capacity;
    const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
    return { branchId, name: getBranchName(branchId), capacity, registered, attended, isFull, pct, perSchedule };
  });

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

      {/* Hero: cover (left) + title + actions (right) */}
      <div className={cn(
        'mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm',
        event.imageUrl && 'md:grid md:grid-cols-2'
      )}>
        {event.imageUrl && (
          <div className="flex items-center justify-center bg-gray-50 md:border-r md:border-gray-100">
            <img
              src={event.imageUrl}
              alt={event.name}
              className="max-h-[320px] w-full object-contain"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4 p-5">
          <div className="min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{event.name}</h1>
                <Badge variant="outline">{getEventTypeLabel(event.eventType)}</Badge>
              </div>
              {/* Status changer — pinned top-right */}
              <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={statusChanging}
                      className={cn(
                        'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60',
                        getStatusColor(event.status)
                      )}
                    >
                      {statusChanging ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {getStatusText(event.status)}
                          <ChevronDown className="h-4 w-4 opacity-70" />
                        </>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(['draft', 'published', 'completed', 'cancelled'] as const).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={cn('gap-2', s === event.status && 'font-semibold')}
                      >
                        <span className={cn('h-2 w-2 rounded-full', getStatusDotColor(s))} />
                        {getStatusText(s)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGuard>
            </div>
            <p className="text-gray-600">{event.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {event.status === 'published' && (
              <Button
                variant="outline"
                disabled={copyingLink}
                onClick={async () => {
                  setCopyingLink(true);
                  try {
                    const res = await fetch('/api/admin/short-links', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: event.id }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data.code) throw new Error(data.error || 'failed');
                    const link = `${window.location.origin}/e/${data.code}`;
                    await navigator.clipboard.writeText(link);
                    toast.success('คัดลอกลิงก์ลงทะเบียนแล้ว');
                  } catch {
                    // Fallback to the long link so copy still works.
                    const link = `${window.location.origin}/liff/events/register/${event.id}`;
                    await navigator.clipboard.writeText(link);
                    toast.success('คัดลอกลิงก์ลงทะเบียนแล้ว');
                  } finally {
                    setCopyingLink(false);
                  }
                }}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                คัดลอกลิงก์
              </Button>
            )}

            <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
              <Link href={`/events/${event.id}/edit`}>
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  แก้ไข Event
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>
      </div>

      {/* Per-branch breakdown (primary) */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ยอดลงทะเบียนแยกตามสาขา</CardTitle>
          <span className="text-sm font-normal text-gray-500">
            รวม {totalRegistered}{totalCapacity ? `/${totalCapacity}` : ''} {countUnit}
          </span>
        </CardHeader>
        <CardContent>
          {branchBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่ได้กำหนดสาขา</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {branchBreakdown.map((b) => (
                <div
                  key={b.branchId}
                  className={cn(
                    'rounded-xl border p-4',
                    b.isFull ? 'border-red-200 bg-red-50/40' : 'border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 shrink-0 rounded-full',
                          b.capacity === 0 ? 'bg-gray-300' : b.isFull ? 'bg-red-500' : 'bg-green-500'
                        )}
                      />
                      <span className="truncate font-medium">{b.name}</span>
                    </div>
                    {b.capacity > 0 && (
                      <Badge
                        className={cn(
                          'shrink-0',
                          b.isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        )}
                      >
                        {b.isFull ? 'เต็ม' : `ว่าง ${b.capacity - b.registered}`}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className={cn('text-2xl font-bold tabular-nums', b.isFull && 'text-red-600')}>
                      {b.registered}
                    </span>
                    <span className="text-base text-gray-400">
                      /{b.capacity || '∞'} {countUnit}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', b.isFull ? 'bg-red-500' : 'bg-green-500')}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>

                  {/* Per-schedule rows (only when there are multiple rounds) */}
                  {schedules.length > 1 && b.perSchedule.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                      {b.perSchedule.map(({ schedule, cap, reg }) => {
                        const full = cap > 0 && reg >= cap;
                        return (
                          <div key={schedule.id} className="flex items-center justify-between text-xs">
                            <span className="truncate text-gray-500">
                              {formatDate(schedule.date, 'short')} {formatTime(schedule.startTime)}
                            </span>
                            <span className={cn('font-medium tabular-nums', full && 'text-red-600')}>
                              {reg}{cap > 0 ? `/${cap}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {event.status === 'completed' && b.attended > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      มาเข้าร่วม {b.attended} {countUnit}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compact stat strip */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-1 divide-y divide-gray-100 p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {/* วันที่จัด */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <CalendarDays className="h-4 w-4 text-primary" />
              วันที่จัด
            </div>
            <p className="mt-1 text-base font-semibold leading-snug">
              {eventDateLabel || <span className="text-gray-400">ยังไม่มีรอบ</span>}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{schedules.length} รอบเวลา</p>
          </div>

          {/* รับลงทะเบียน */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Calendar className="h-4 w-4 text-primary" />
              รับลงทะเบียน
            </div>
            <p className="mt-1 text-sm font-medium leading-snug">
              {formatDate(event.registrationStartDate, 'short')}
            </p>
            <p className="text-xs text-gray-500">
              ถึง {formatDate(event.registrationEndDate, 'short')}
            </p>
          </div>

          {/* เปิดดู → ลงทะเบียน */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <BarChart3 className="h-4 w-4 text-primary" />
              เปิดดู → ลงทะเบียน
            </div>
            {(() => {
              const views = event.viewCount || 0;
              const rate = views > 0 ? Math.round((totalRegistered / views) * 100) : 0;
              return (
                <>
                  <p className="mt-1 text-2xl font-bold">
                    {views}
                    <span className="px-1 text-base font-normal text-gray-300">→</span>
                    <span className="text-blue-600">{totalRegistered}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {views > 0 ? <>Conversion <span className="font-medium text-green-600">{rate}%</span></> : 'ยังไม่มีการเปิดดู'}
                  </p>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>

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

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>สถานที่จัดงาน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
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
                </div>
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
            branches={branches}
            onUpdate={handleScheduleUpdate}
          />
        </TabsContent>

        {/* Registrations Tab */}
        <TabsContent value="registrations">
          <RegistrationList
            eventId={eventId}
            eventName={event.name}
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
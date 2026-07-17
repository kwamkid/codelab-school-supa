'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Event, Branch } from '@/types/models';
import { deleteEvent, duplicateEvent } from '@/lib/services/events';
import { getClient } from '@/lib/supabase/client';
import { getActiveBranches } from '@/lib/services/branches';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Calendar,
  MapPin,
  Users,
  Edit,
  Trash2,
  Eye,
  CalendarX,
  Link as LinkIcon,
  CheckCircle2,
  Copy,
  MoreHorizontal,
  ImageIcon
} from 'lucide-react';
import { SectionLoading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { formatDate, cn } from '@/lib/utils';
import { StatusFilterTabs } from '@/components/ui/status-filter-tabs';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import { Lightbox } from '@/components/ui/lightbox';
import { getEventRegistrationUrl } from '@/lib/short-links';

type EventWithStats = Event & {
  totalRegistrations?: number;
  totalAttendees?: number;
  registrationsByBranch?: Record<string, number>;
  capacityByBranch?: Record<string, number>;
  firstEventDate?: Date | null;
  lastEventDate?: Date | null;
};

export default function EventsPage() {
  const router = useRouter();
  const { user, isSuperAdmin } = useAuth();
  const { selectedBranchId, isAllBranches } = useBranch();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null);
  const [lightboxEvent, setLightboxEvent] = useState<EventWithStats | null>(null);
  // Events whose image failed to load -> fall back to the placeholder icon.
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadEvents();
  }, [selectedBranchId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const supabase = getClient();
      const branchParam = isAllBranches ? null : (selectedBranchId || null);

      const [{ data: rpcData, error: rpcError }, branchesData] = await Promise.all([
        (supabase.rpc as any)('get_events_with_stats', { p_branch_id: branchParam }),
        getActiveBranches()
      ]);

      if (rpcError) throw rpcError;

      const eventsData = (rpcData || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        fullDescription: row.full_description || undefined,
        imageUrl: row.image_url || undefined,
        location: row.location,
        locationUrl: row.location_url || undefined,
        branchIds: row.branch_ids || [],
        eventType: row.event_type,
        highlights: row.highlights || undefined,
        targetAudience: row.target_audience || undefined,
        whatToBring: row.what_to_bring || undefined,
        registrationStartDate: new Date(row.registration_start_date),
        registrationEndDate: new Date(row.registration_end_date),
        countingMethod: row.counting_method,
        enableReminder: row.enable_reminder,
        reminderDaysBefore: row.reminder_days_before,
        reminderTime: row.reminder_time || undefined,
        status: row.status,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by || '',
        totalRegistrations: row.total_registrations || 0,
        totalAttendees: row.total_attendees || 0,
        registrationsByBranch: row.registrations_by_branch || {},
        capacityByBranch: row.capacity_by_branch || {},
        firstEventDate: row.first_event_date ? new Date(row.first_event_date) : null,
        lastEventDate: row.last_event_date ? new Date(row.last_event_date) : null,
      }));

      setEvents(eventsData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('ไม่สามารถโหลดข้อมูล Events ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEventId || !isSuperAdmin()) return;

    try {
      await deleteEvent(deleteEventId);
      toast.success('ลบ Event เรียบร้อยแล้ว');
      setDeleteEventId(null);
      loadEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'ไม่สามารถลบ Event ได้');
    }
  };

  const handleDuplicate = async (eventId: string) => {
    if (!user?.id || duplicatingEventId) return;

    try {
      setDuplicatingEventId(eventId);
      const newId = await duplicateEvent(eventId, user.id);
      toast.success('คัดลอก Event เรียบร้อยแล้ว');
      router.push(`/events/${newId}/edit`);
    } catch (error: any) {
      console.error('Error duplicating event:', error);
      toast.error(error.message || 'ไม่สามารถคัดลอก Event ได้');
      setDuplicatingEventId(null);
    }
  };

  const copyRegistrationLink = async (eventId: string) => {
    const link = await getEventRegistrationUrl(eventId);
    await navigator.clipboard.writeText(link);
    setCopiedEventId(eventId);
    toast.success('คัดลอกลิงก์แล้ว');

    // Reset copied state after 2 seconds
    setTimeout(() => {
      setCopiedEventId(null);
    }, 2000);
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    const matchSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       event.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || event.status === statusFilter;
    const matchType = typeFilter === 'all' || event.eventType === typeFilter;
    
    return matchSearch && matchStatus && matchType;
  });

  // Stats
  const stats = {
    total: events.length,
    published: events.filter(e => e.status === 'published').length,
    draft: events.filter(e => e.status === 'draft').length,
    completed: events.filter(e => e.status === 'completed').length,
    cancelled: events.filter(e => e.status === 'cancelled').length,
  };

  const markImageBroken = (eventId: string) =>
    setBrokenImages((prev) => (prev[eventId] ? prev : { ...prev, [eventId]: true }));

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

  // Per-branch seat status: registered / capacity for each branch the event runs at.
  const getBranchSeats = (event: EventWithStats) => {
    const reg = event.registrationsByBranch || {};
    const cap = event.capacityByBranch || {};
    return event.branchIds.map((branchId) => {
      const registered = reg[branchId] || 0;
      const capacity = cap[branchId] || 0;
      const isFull = capacity > 0 && registered >= capacity;
      return {
        branchId,
        name: getBranchName(branchId),
        registered,
        capacity,
        isFull,
        hasCapacity: capacity > 0,
      };
    });
  };

  // Event date shown on two lines: start on the first, "- end" on the second.
  const formatEventDate = (event: EventWithStats) => {
    if (!event.firstEventDate) return null;
    const first = formatDate(event.firstEventDate, 'short');
    if (event.lastEventDate && event.lastEventDate.getTime() !== event.firstEventDate.getTime()) {
      return { first, last: formatDate(event.lastEventDate, 'short') };
    }
    return { first, last: null };
  };

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            จัดการ Events
          </h1>
          <p className="text-gray-600 mt-1">
            จัดการงานและกิจกรรมต่างๆ ของโรงเรียน
          </p>
        </div>
        <PermissionGuard action="create">
          <Link href="/events/new">
            <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
              <Plus className="h-4 w-4 mr-2" />
              สร้าง Event ใหม่
            </ActionButton>
          </Link>
        </PermissionGuard>
      </div>

      {/* Status filter cards (clickable) */}
      <StatusFilterTabs
        value={statusFilter}
        onChange={setStatusFilter}
        className="mb-6"
        tabs={[
          { value: 'published', label: 'เผยแพร่แล้ว', count: stats.published, activeBg: 'bg-green-600', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-600', inactiveCount: 'text-green-700' },
          { value: 'draft', label: 'ร่าง', count: stats.draft, activeBg: 'bg-gray-500', inactiveBg: 'bg-gray-50', inactiveLabel: 'text-gray-500', inactiveCount: 'text-gray-700' },
          { value: 'completed', label: 'จบแล้ว', count: stats.completed, activeBg: 'bg-blue-600', inactiveBg: 'bg-blue-50', inactiveLabel: 'text-blue-600', inactiveCount: 'text-blue-700' },
          { value: 'cancelled', label: 'ยกเลิก', count: stats.cancelled, activeBg: 'bg-red-500', inactiveBg: 'bg-red-50', inactiveLabel: 'text-red-600', inactiveCount: 'text-red-700' },
          { value: 'all', label: 'ทั้งหมด', count: stats.total, activeBg: 'bg-indigo-500', inactiveBg: 'bg-indigo-50', inactiveLabel: 'text-indigo-600', inactiveCount: 'text-indigo-700', always: true, separatorBefore: true },
        ]}
      />

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SearchInput
            placeholder="ค้นหาชื่อ Event หรือสถานที่..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="flex-1"
          />

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="ประเภททั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ประเภททั้งหมด</SelectItem>
              <SelectItem value="open-house">Open House</SelectItem>
              <SelectItem value="parent-meeting">Parent Meeting</SelectItem>
              <SelectItem value="showcase">Showcase</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
              <SelectItem value="other">อื่นๆ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title={
                searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'ไม่พบ Event ที่ค้นหา'
                  : 'ยังไม่มี Event'
              }
              description={
                searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'ลองค้นหาด้วยคำค้นอื่น'
                  : 'เริ่มต้นด้วยการสร้าง Event ใหม่'
              }
              action={
                !searchTerm && statusFilter === 'all' && typeFilter === 'all' ? (
                  <PermissionGuard action="create">
                    <Link href="/events/new">
                      <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                        <Plus className="h-4 w-4 mr-2" />
                        สร้าง Event ใหม่
                      </ActionButton>
                    </Link>
                  </PermissionGuard>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>วันที่จัด</TableHead>
                    <TableHead>ที่นั่ง (แยกสาขา)</TableHead>
                    <TableHead>รับลงทะเบียน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {event.imageUrl && !brokenImages[event.id] ? (
                            <button
                              type="button"
                              onClick={() => setLightboxEvent(event)}
                              className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                              aria-label={`ดูรูป ${event.name}`}
                            >
                              {/* Natural ratio: fixed height, width follows the image. */}
                              <img
                                src={event.imageUrl}
                                alt=""
                                className="h-12 w-auto rounded-md border border-gray-200 object-contain bg-gray-50 transition-opacity hover:opacity-80"
                                onError={() => markImageBroken(event.id)}
                                // A decode that yields 0 width is unusable even though the
                                // request resolved. The ref also catches images that finished
                                // loading before React attached the handlers.
                                ref={(node) => {
                                  if (node?.complete && node.naturalWidth === 0) {
                                    markImageBroken(event.id);
                                  }
                                }}
                                onLoad={(e) => {
                                  if (e.currentTarget.naturalWidth === 0) markImageBroken(event.id);
                                }}
                              />
                            </button>
                          ) : (
                            <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-gray-300">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/events/${event.id}`}
                              className="font-medium text-gray-900 hover:text-primary hover:underline"
                            >
                              {event.name}
                            </Link>
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {event.branchIds.length > 0 ? (
                                event.branchIds.map((branchId) => (
                                  <Badge key={branchId} variant="outline" className="text-xs font-normal">
                                    {getBranchName(branchId)}
                                  </Badge>
                                ))
                              ) : (
                                <div className="flex items-center gap-1 text-gray-500 text-sm">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[260px]">{event.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'px-2 py-0.5 text-xs font-normal',
                            getEventTypeColor(event.eventType)
                          )}
                        >
                          {getEventTypeLabel(event.eventType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const eventDate = formatEventDate(event);
                          if (!eventDate) return <span className="text-gray-400">-</span>;
                          return (
                            <div className="flex items-start gap-1 whitespace-nowrap">
                              <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <div>
                                <p>{eventDate.first}</p>
                                {eventDate.last && (
                                  <p className="text-gray-500">- {eventDate.last}</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getBranchSeats(event).map((b) => (
                            <div key={b.branchId} className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full shrink-0',
                                  !b.hasCapacity
                                    ? 'bg-gray-300'
                                    : b.isFull
                                    ? 'bg-red-500'
                                    : 'bg-green-500'
                                )}
                              />
                              <span className="text-gray-600">{b.name}</span>
                              <span
                                className={cn(
                                  'font-medium tabular-nums',
                                  b.isFull ? 'text-red-600' : 'text-gray-900'
                                )}
                              >
                                {b.registered}
                                {b.hasCapacity ? `/${b.capacity}` : ''}
                              </span>
                              {b.isFull && (
                                <span className="text-xs text-red-500">เต็ม</span>
                              )}
                            </div>
                          ))}
                          {getBranchSeats(event).length === 0 && (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm whitespace-nowrap">
                          <p>{formatDate(event.registrationStartDate, 'short')}</p>
                          <p className="text-gray-500">
                            ถึง {formatDate(event.registrationEndDate, 'short')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(event.status)}>
                          {getStatusText(event.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => router.push(`/events/${event.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              ดูรายละเอียด
                            </DropdownMenuItem>

                            <PermissionGuard action="update">
                              <DropdownMenuItem onClick={() => router.push(`/events/${event.id}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                แก้ไข
                              </DropdownMenuItem>
                            </PermissionGuard>

                            {event.status === 'published' && (
                              <DropdownMenuItem onClick={() => copyRegistrationLink(event.id)}>
                                {copiedEventId === event.id ? (
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                ) : (
                                  <LinkIcon className="h-4 w-4 mr-2" />
                                )}
                                คัดลอกลิงก์ลงทะเบียน
                              </DropdownMenuItem>
                            )}

                            <PermissionGuard action="create">
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(event.id)}
                                disabled={duplicatingEventId === event.id}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                คัดลอก Event
                              </DropdownMenuItem>
                            </PermissionGuard>

                            {isSuperAdmin() && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteEventId(event.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  ลบ
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event image lightbox */}
      {lightboxEvent?.imageUrl && (
        <Lightbox
          images={lightboxEvent.imageUrl}
          caption={lightboxEvent.name}
          onClose={() => setLightboxEvent(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEventId} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ Event</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบ Event นี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
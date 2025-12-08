'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Event, Branch } from '@/types/models';
import { getEvents, deleteEvent } from '@/lib/services/events';
import { getActiveBranches } from '@/lib/services/branches';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search, 
  Calendar,
  MapPin,
  Users,
  Edit,
  Trash2,
  Eye,
  CalendarX,
  Loader2,
  Link as LinkIcon,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';

export default function EventsPage() {
  const router = useRouter();
  const { user, isSuperAdmin } = useAuth();
  const { selectedBranchId, isAllBranches } = useBranch();
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, [selectedBranchId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const [eventsData, branchesData] = await Promise.all([
        getEvents(isAllBranches ? undefined : selectedBranchId || undefined),
        getActiveBranches()
      ]);
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

  const copyRegistrationLink = (eventId: string) => {
    const link = `${window.location.origin}/liff/events/register/${eventId}`;
    navigator.clipboard.writeText(link);
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

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            จัดการ Events
          </h1>
          <p className="text-gray-600 mt-2">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">เผยแพร่แล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ร่าง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">จบแล้ว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="ค้นหาชื่อ Event หรือสถานที่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="สถานะทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สถานะทั้งหมด</SelectItem>
              <SelectItem value="draft">ร่าง</SelectItem>
              <SelectItem value="published">เผยแพร่แล้ว</SelectItem>
              <SelectItem value="completed">จบแล้ว</SelectItem>
              <SelectItem value="cancelled">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
          
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
            <div className="text-center py-12">
              <CalendarX className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                  ? 'ไม่พบ Event ที่ค้นหา' 
                  : 'ยังไม่มี Event'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'ลองค้นหาด้วยคำค้นอื่น'
                  : 'เริ่มต้นด้วยการสร้าง Event ใหม่'}
              </p>
              {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                <PermissionGuard action="create">
                  <Link href="/events/new">
                    <ActionButton action="create" className="bg-red-500 hover:bg-red-600">
                      <Plus className="h-4 w-4 mr-2" />
                      สร้าง Event ใหม่
                    </ActionButton>
                  </Link>
                </PermissionGuard>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>วันที่จัด</TableHead>
                    <TableHead>รับลงทะเบียน</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{event.name}</p>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getEventTypeColor(event.eventType)}>
                          {getEventTypeLabel(event.eventType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(event.registrationStartDate, 'short')}</p>
                          <p className="text-gray-500">
                            ถึง {formatDate(event.registrationEndDate, 'short')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>เปิด: {formatDate(event.registrationStartDate, 'short')}</p>
                          <p className="text-gray-500">
                            ปิด: {formatDate(event.registrationEndDate, 'short')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {event.branchIds.map((branchId) => (
                            <Badge key={branchId} variant="outline" className="text-xs">
                              {getBranchName(branchId)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(event.status)}>
                          {getStatusText(event.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/events/${event.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          
                          <PermissionGuard action="update">
                            <Link href={`/events/${event.id}/edit`}>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </PermissionGuard>
                          
                          {/* Copy Registration Link Button */}
                          {event.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyRegistrationLink(event.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                              title="คัดลอกลิงก์ลงทะเบียน"
                            >
                              {copiedEventId === event.id ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <LinkIcon className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          {isSuperAdmin() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteEventId(event.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
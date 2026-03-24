'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBranch } from '@/contexts/BranchContext';
import DailyTimetable, { TimetableEvent, TimetableRoom } from '@/components/dashboard/daily-timetable';
import ClassDetailDialog from '@/components/dashboard/class-detail-dialog';
import { CalendarEvent, clearDashboardCache } from '@/lib/services/dashboard-optimized';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { getClient } from '@/lib/supabase/client';

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateThai(date: Date): string {
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `วัน${days[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}

export default function DashboardPage() {
  const { selectedBranchId, isAllBranches } = useBranch();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [rooms, setRooms] = useState<TimetableRoom[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));

  // Dialog state (reuse existing ClassDetailDialog)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');

  // Fetch data from RPC
  const loadTimetable = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const supabase = getClient();
      const { data, error } = await supabase.rpc('get_daily_timetable', {
        p_date: dateStr,
        p_branch_id: selectedBranchId || null,
      });

      if (error) throw error;

      setEvents(data?.events || []);
      setRooms(data?.rooms || []);
    } catch (error) {
      console.error('Error loading timetable:', error);
      toast.error('ไม่สามารถโหลดตารางเรียนได้');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  // Load on mount + when branch/date changes
  useEffect(() => {
    loadTimetable(selectedDate);
  }, [selectedDate, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert TimetableEvent to CalendarEvent for the existing ClassDetailDialog
  const handleEventClick = (event: TimetableEvent) => {
    const dateStr = selectedDate;
    const [sh, sm] = event.start_time.split(':').map(Number);
    const [eh, em] = event.end_time.split(':').map(Number);
    const startDate = new Date(dateStr + 'T00:00:00');
    startDate.setHours(sh, sm, 0, 0);
    const endDate = new Date(dateStr + 'T00:00:00');
    endDate.setHours(eh, em, 0, 0);

    const calEvent: CalendarEvent = {
      id: `${event.class_id}-${event.schedule_id}`,
      classId: event.class_id,
      title: event.subject_name,
      start: startDate,
      end: endDate,
      backgroundColor: '',
      borderColor: '',
      textColor: '',
      extendedProps: {
        type: event.event_type,
        className: event.class_name,
        classCode: event.class_code,
        branchId: event.branch_id,
        branchName: event.branch_name,
        roomName: event.room_name,
        teacherName: event.teacher_name,
        subjectColor: event.subject_color,
        enrolled: event.enrolled_count ?? undefined,
        maxStudents: event.max_students ?? undefined,
        sessionNumber: event.session_number ?? undefined,
        status: event.schedule_status,
        isFullyAttended: false,
        startTime: event.start_time,
        endTime: event.end_time,
        attendance: event.attendance,
        // Makeup
        studentName: event.event_type === 'makeup' ? event.student_info ?? undefined : undefined,
        studentNickname: event.event_type === 'makeup' ? event.student_info ?? undefined : undefined,
        originalClassName: event.event_type === 'makeup' ? event.extra_info ?? undefined : undefined,
        // Trial
        trialStudentName: event.event_type === 'trial' ? event.student_info ?? undefined : undefined,
        trialSubjectName: event.event_type === 'trial' ? event.extra_info ?? undefined : undefined,
      }
    };

    const scheduleId = event.schedule_id;
    setSelectedEvent(calEvent);
    setSelectedScheduleId(scheduleId);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) setDialogOpen(false);
  };

  const handleAttendanceSaved = async () => {
    setDialogOpen(false);
    clearDashboardCache();
    await loadTimetable(selectedDate);
    toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
  };

  const handleRefresh = async () => {
    clearDashboardCache();
    await loadTimetable(selectedDate);
    toast.success('รีเฟรชข้อมูลเรียบร้อยแล้ว');
  };

  const handleDateChange = (date: string | undefined) => {
    if (date) setSelectedDate(date);
  };

  const dateObj = new Date(selectedDate + 'T00:00:00');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ตารางเรียน</h1>
          <p className="text-base text-gray-600 mt-1">
            {formatDateThai(dateObj)}
            {isToday(selectedDate) && <span className="text-orange-600 font-medium ml-1">(วันนี้)</span>}
            {!isAllBranches && <span className="text-red-600 font-medium ml-2">(เฉพาะสาขาที่เลือก)</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            mode="single"
            value={selectedDate}
            onChange={handleDateChange}
            placeholder="เลือกวันที่"
            className="w-[200px]"
          />
          {!isToday(selectedDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(toDateStr(new Date()))}
            >
              วันนี้
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Timetable Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              ตาราง เวลา × ห้อง
            </CardTitle>
            <span className="text-sm text-gray-500">{events.length} คลาส</span>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-b-lg">
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
            </div>
          )}

          <DailyTimetable
            events={events}
            rooms={rooms}
            onEventClick={handleEventClick}
          />
        </CardContent>
      </Card>

      {/* Class Detail Dialog */}
      <ClassDetailDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        event={selectedEvent}
        scheduleId={selectedScheduleId}
        onAttendanceSaved={handleAttendanceSaved}
      />
    </div>
  );
}

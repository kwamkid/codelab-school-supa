'use client';

import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import { Clock, Users, MapPin, User, Calendar, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export interface ScheduleEvent {
  id: string;
  classId: string;
  title: string;
  start: Date;
  end: Date;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    type: 'class' | 'makeup' | 'trial';
    studentId: string;
    studentName: string;
    studentNickname?: string;
    branchName: string;
    roomName: string;
    teacherName: string;
    subjectName: string;
    className?: string;
    subjectColor?: string;
    sessionNumber?: number;
    status?: string;
    // For makeup
    originalClassName?: string;
    makeupStatus?: string;
    // For leave
    hasMakeupRequest?: boolean;
    makeupScheduled?: boolean;
    makeupDate?: string;
    makeupTime?: string;
  };
}

interface ScheduleCalendarProps {
  events: ScheduleEvent[];
  onDatesSet: (dateInfo: DatesSetArg) => void;
  loading?: boolean;
  selectedStudentId?: string;
  onRefreshNeeded?: () => void;
}

export default function ScheduleCalendar({ 
  events, 
  onDatesSet,
  loading = false,
  selectedStudentId,
  onRefreshNeeded
}: ScheduleCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Set calendar to today when component mounts
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
    }
  }, []);

  // Filter events by selected student
  const filteredEvents = selectedStudentId 
    ? events.filter(event => event.extendedProps.studentId === selectedStudentId)
    : events;

  // Handle leave request
  const handleLeaveRequest = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    setConfirmLeaveOpen(true);
  };

  // Submit leave request
  const submitLeaveRequest = async () => {
    if (!selectedEvent) return;

    try {
      setIsSubmitting(true);
      
      // Get the schedule ID from the event ID (format: classId-scheduleId-studentId)
      const [classId, scheduleId] = selectedEvent.id.split('-');
      
      // Call API to create makeup request
      const response = await fetch('/api/liff/leave-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: selectedEvent.extendedProps.studentId,
          classId: classId,
          scheduleId: scheduleId,
          reason: 'ลาผ่านระบบ LIFF',
          type: 'scheduled', // Since parent requests in advance
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'เกิดข้อผิดพลาด');
      }

      toast.success('บันทึกการลาเรียนเรียบร้อยแล้ว', {
        description: 'รอเจ้าหน้าที่นัดหมายวันเรียนชดเชยใหม่'
      });
      
      setDialogOpen(false);
      setConfirmLeaveOpen(false);
      
      // Force refresh to show red color
      if (onRefreshNeeded) {
        setTimeout(() => {
          onRefreshNeeded();
        }, 500); // Small delay to ensure database is updated
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถบันทึกการลาได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle event click
  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = filteredEvents.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
      setDialogOpen(true);
    }
  };

  // Custom event content renderer
  const renderEventContent = (eventInfo: EventContentArg) => {
    const props = eventInfo.event.extendedProps;
    const isListView = eventInfo.view.type.includes('list');
    const isMakeup = props.type === 'makeup';
    const isMonthView = eventInfo.view.type === 'dayGridMonth';
    const isDayView = eventInfo.view.type === 'timeGridDay';
    const isWeekView = eventInfo.view.type === 'timeGridWeek';
    
    // For list view - Improved layout
    if (isListView) {
      return (
        <div className="flex flex-col gap-1 py-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {props.studentNickname || props.studentName}
                </span>
                {isMakeup && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0">
                    Makeup
                  </Badge>
                )}
              </div>
              
              <div className="mt-1 space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-2">
                  {props.subjectColor && (
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: props.subjectColor }}
                    />
                  )}
                  <span>
                    {props.className || props.subjectName}
                    {props.sessionNumber && !isMakeup && (
                      <span className="text-muted-foreground ml-1">
                        (ครั้งที่ {props.sessionNumber})
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {/* <span>
                    {eventInfo.timeText}
                  </span> */}
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {props.branchName} - {props.roomName}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    ครู{props.teacherName}
                  </span>
                </div>
                
                {/* Show makeup info if this is rescheduled */}
                {props.hasMakeupRequest && props.makeupScheduled && (
                  <div className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded mt-1">
                    เรียนชดเชย: {new Date(props.makeupDate).toLocaleDateString('th-TH', { 
                      day: 'numeric',
                      month: 'short'
                    })} เวลา {props.makeupTime}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // For month view
    if (isMonthView) {
      return (
        <div className="px-1 py-0.5 text-xs flex items-center gap-1">
          {props.subjectColor && (
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: props.subjectColor }}
            />
          )}
          <div className="font-medium truncate flex-1">
            {eventInfo.timeText.split(' - ')[0]} {/* Start time only */}
            {' '}
            {isMakeup ? (
              <span>[M] {props.studentNickname || props.studentName}</span>
            ) : (
              <span>{props.studentNickname || props.studentName}</span>
            )}
          </div>
        </div>
      );
    }
    
    // For day/week view
    if (isDayView || isWeekView) {
      return (
        <div className="p-2 h-full overflow-hidden">
          {isMakeup ? (
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5 mb-1">
                {props.subjectColor && (
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: props.subjectColor }}
                  />
                )}
                <span className="text-purple-800">[Makeup]</span>
              </div>
              <div className="text-xs text-purple-700">
                {props.studentNickname || props.studentName}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {props.originalClassName}
                {props.sessionNumber && (
                  <span className="ml-1">(ครั้งที่ {props.sessionNumber})</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-gray-600 font-medium">
                {eventInfo.timeText}
              </div>
              <div className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                {props.subjectColor && (
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: props.subjectColor }}
                  />
                )}
                <span className="text-gray-800">
                  {props.studentNickname || props.studentName}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {props.className || props.subjectName}
                {props.sessionNumber && (
                  <span className="ml-1">ครั้งที่ {props.sessionNumber}</span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {props.roomName}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return <div className="p-1 text-xs">{eventInfo.event.title}</div>;
  };

  return (
    <>
      <div className="liff-schedule-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
          }}
          events={filteredEvents.map(event => ({
            ...event,
            title: event.extendedProps.type === 'makeup' 
              ? `[Makeup] ${event.extendedProps.studentNickname || event.extendedProps.studentName} - ${event.extendedProps.originalClassName}${event.extendedProps.sessionNumber ? ` (ครั้งที่ ${event.extendedProps.sessionNumber})` : ''}`
              : `${event.extendedProps.studentNickname || event.extendedProps.studentName} - ${event.extendedProps.className || event.extendedProps.subjectName}`,
          }))}
          eventDidMount={(info) => {
            const props = info.event.extendedProps;
            const eventDate = info.event.end as Date;
            const now = new Date();
            
            // Add class for completed events
            if (props.type === 'class' && eventDate < now) {
              info.el.classList.add('completed-event');
            } else if (props.type === 'makeup' && eventDate < now) {
              info.el.classList.add('completed-makeup-event');
            }
            
            if (props.status === 'completed') {
              info.el.classList.add('status-completed');
            }
            
            // Add class for absent/leave events
            if (props.status === 'absent') {
              info.el.classList.add('absent-event');
            } else if (props.status === 'leave-requested') {
              info.el.classList.add('leave-requested');
            }
          }}
          eventClick={handleEventClick}
          datesSet={onDatesSet}
          locale="th"
          firstDay={0}
          height="auto"
          contentHeight="auto"
          aspectRatio={1.8}
          dayMaxEvents={false}
          slotMinTime="08:00:00"
          slotMaxTime="19:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          eventMinHeight={50}
          expandRows={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          eventContent={renderEventContent}
          eventClassNames={(arg) => {
            const type = arg.event.extendedProps.type;
            return `${type}-event`;
          }}
          moreLinkContent={(args) => {
            return `อีก ${args.num} รายการ`;
          }}
          buttonText={{
            today: 'วันนี้',
            month: 'เดือน',
            week: 'สัปดาห์',
            day: 'วัน',
            list: 'รายการ'
          }}
          allDayText="ทั้งวัน"
          noEventsText="ไม่มีคลาสเรียน"
          nowIndicator={true}
          navLinks={true}
        />
        
        <style jsx global>{`
          /* Calendar styles similar to dashboard */
          .liff-schedule-calendar .fc {
            font-family: inherit;
          }
          
          .liff-schedule-calendar .fc-event {
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
            border-radius: 6px;
            overflow: hidden;
            border-width: 1px;
            border-style: solid;
          }
          
          .liff-schedule-calendar .fc-event:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
            filter: brightness(0.95);
          }
          
          /* Regular class styles */
          .liff-schedule-calendar .class-event {
            background-color: #E5E7EB !important;
            border-color: #D1D5DB !important;
            color: #374151 !important;
          }
          
          /* Completed class styles */
          .liff-schedule-calendar .class-event.completed-event,
          .liff-schedule-calendar .class-event.status-completed {
            background-color: #D1FAE5 !important;
            border-color: #A7F3D0 !important;
            color: #065F46 !important;
          }
          
          /* Absent/Leave class styles */
          .liff-schedule-calendar .class-event.absent-event,
          .liff-schedule-calendar .class-event.leave-requested {
            background-color: #FEE2E2 !important;
            border-color: #FCA5A5 !important;
            color: #991B1B !important;
          }
          
          /* Makeup event styles */
          .liff-schedule-calendar .makeup-event {
            background-color: #E9D5FF !important;
            border-color: #D8B4FE !important;
            color: #6B21A8 !important;
          }
          
          /* Completed makeup */
          .liff-schedule-calendar .makeup-event.completed-makeup-event {
            background-color: #D1FAE5 !important;
            border-color: #A7F3D0 !important;
            color: #065F46 !important;
          }
          
          /* List view button styling - Make it stand out */
          .liff-schedule-calendar .fc-listWeek-button {
            background-color: #4B5563 !important;
            color: white !important;
            border: 1px solid #374151 !important;
            margin-left: 0.5rem !important;
            font-weight: 500 !important;
          }
          
          .liff-schedule-calendar .fc-listWeek-button:hover {
            background-color: #374151 !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .liff-schedule-calendar .fc-listWeek-button.fc-button-active {
            background-color: #DC2626 !important;
            color: white !important;
            border-color: #DC2626 !important;
            box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
          }
          
          /* Separate list button from other view buttons */
          .liff-schedule-calendar .fc-button-group {
            gap: 0;
          }
          
          /* List view specific styles */
          .liff-schedule-calendar .fc-list-view .fc-list-event {
            cursor: pointer;
            transition: background-color 0.2s ease;
          }
          
          .liff-schedule-calendar .fc-list-view .fc-list-event:hover {
            background-color: #f9fafb;
          }
          
          /* Hide ALL event dots in list view - Force override */
          .liff-schedule-calendar .fc-list-view .fc-list-event-dot,
          .liff-schedule-calendar .fc-list-view .fc-event-dot,
          .liff-schedule-calendar .fc .fc-list-event-dot {
            display: none !important;
            border: none !important;
            width: 0 !important;
            height: 0 !important;
            visibility: hidden !important;
          }
          
          /* Remove any colored circles from list view */
          .liff-schedule-calendar .fc-list-view .fc-list-event-graphic {
            padding: 0 0.5rem;
            min-width: 0;
          }
          
          .liff-schedule-calendar .fc-list-view .fc-list-event-graphic::before,
          .liff-schedule-calendar .fc-list-view .fc-list-event-graphic::after {
            display: none !important;
          }
          
          .liff-schedule-calendar .fc-list-view .fc-list-event-title {
            padding: 0.5rem;
          }
          
          /* Mobile responsive */
          @media (max-width: 640px) {
            .liff-schedule-calendar .fc-toolbar {
              flex-direction: column;
              gap: 0.5rem;
            }
            
            .liff-schedule-calendar .fc-toolbar-title {
              font-size: 1.25rem;
            }
            
            .liff-schedule-calendar .fc-button {
              padding: 0.25rem 0.5rem;
              font-size: 0.875rem;
            }
            
            /* Make list view take full width on mobile */
            .liff-schedule-calendar .fc-list-view {
              font-size: 0.875rem;
            }
            
            .liff-schedule-calendar .fc-list-view .fc-list-event-title {
              padding: 0.75rem 0.5rem;
            }
          }
        `}</style>
        
        {/* Legend */}
        <div className="flex gap-4 mt-4 p-3 bg-gray-50 rounded-lg flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
            <span>คลาสปกติ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-100 border border-purple-200" />
            <span>Makeup Class</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
            <span>เรียนเสร็จแล้ว</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
            <span>ลาเรียน</span>
          </div>
        </div>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              รายละเอียดคลาสเรียน
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {/* Student Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {selectedEvent.extendedProps.studentNickname || selectedEvent.extendedProps.studentName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.extendedProps.studentName}
                  </p>
                </div>
              </div>

              {/* Class Type Badge */}
              <div>
                {selectedEvent.extendedProps.type === 'makeup' ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    Makeup Class
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    คลาสปกติ
                  </Badge>
                )}
              </div>

              {/* Class Details */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">คลาสเรียน</p>
                  <div className="font-medium flex items-center gap-2">
                    {selectedEvent.extendedProps.subjectColor && (
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: selectedEvent.extendedProps.subjectColor }}
                      />
                    )}
                    <span>
                      {selectedEvent.extendedProps.type === 'makeup' 
                        ? selectedEvent.extendedProps.originalClassName 
                        : selectedEvent.extendedProps.className || selectedEvent.extendedProps.subjectName}
                      {selectedEvent.extendedProps.sessionNumber && selectedEvent.extendedProps.type !== 'makeup' && (
                        <span className="text-muted-foreground ml-2">
                          (ครั้งที่ {selectedEvent.extendedProps.sessionNumber})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">วันที่และเวลา</p>
                  <p className="font-medium">
                    {selectedEvent.start.toLocaleDateString('th-TH', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm">
                    {selectedEvent.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - 
                    {selectedEvent.end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">สถานที่</p>
                  <p className="font-medium">{selectedEvent.extendedProps.branchName}</p>
                  <p className="text-sm">ห้อง {selectedEvent.extendedProps.roomName}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">ครูผู้สอน</p>
                  <p className="font-medium">ครู{selectedEvent.extendedProps.teacherName}</p>
                </div>
              </div>

              {/* Status */}
              {selectedEvent.extendedProps.status === 'completed' && (
                <div className="pt-3 border-t">
                  <Badge className="w-full justify-center" variant="default">
                    เรียนเสร็จแล้ว
                  </Badge>
                </div>
              )}
              
              {(selectedEvent.extendedProps.status === 'absent' || selectedEvent.extendedProps.status === 'leave-requested') && (
                <div className="pt-3 border-t">
                  <Badge className="w-full justify-center bg-red-600 hover:bg-red-700">
                    ลาเรียน
                  </Badge>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {selectedEvent.extendedProps.makeupScheduled 
                      ? `นัดเรียนชดเชย: ${new Date(selectedEvent.extendedProps.makeupDate).toLocaleDateString('th-TH')} เวลา ${selectedEvent.extendedProps.makeupTime}`
                      : 'รอเจ้าหน้าที่นัดเรียนชดเชย'}
                  </p>
                </div>
              )}
              
              {/* Leave Request Button */}
              {selectedEvent.extendedProps.type === 'class' && 
               selectedEvent.extendedProps.status !== 'completed' &&
               selectedEvent.extendedProps.status !== 'absent' &&
               selectedEvent.extendedProps.status !== 'leave-requested' &&
               new Date(selectedEvent.start) > new Date() && (
                <div className="pt-3 border-t">
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={() => handleLeaveRequest(selectedEvent)}
                  >
                    ขอลาเรียน
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Leave Dialog */}
      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ยืนยันการขอลาเรียน
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {selectedEvent && (
              <>
                <div>คุณต้องการขอลาเรียนสำหรับ:</div>
                <div className="bg-gray-50 p-3 rounded-md space-y-1 text-foreground">
                  <p className="font-medium">{selectedEvent.extendedProps.studentNickname || selectedEvent.extendedProps.studentName}</p>
                  <p className="text-sm">
                    คลาส: {selectedEvent.extendedProps.className || selectedEvent.extendedProps.subjectName}
                    {selectedEvent.extendedProps.sessionNumber && (
                      <span className="text-muted-foreground"> (ครั้งที่ {selectedEvent.extendedProps.sessionNumber})</span>
                    )}
                  </p>
                  <p className="text-sm">
                    วันที่: {selectedEvent.start.toLocaleDateString('th-TH', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm">
                    เวลา: {selectedEvent.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground mt-3">
                  หลังจากยืนยันการลา ระบบจะแจ้งให้เจ้าหน้าที่นัดหมายวันเรียนชดเชยให้
                </div>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={submitLeaveRequest}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการลา'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
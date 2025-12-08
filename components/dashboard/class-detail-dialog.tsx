'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent } from '@/lib/services/dashboard-optimized'; // เปลี่ยนจาก dashboard เป็น dashboard-optimized
import { formatDate } from '@/lib/utils';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Users,
  CheckCircle,
  UserCircle,
  School,
  ClipboardCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { getStudent } from '@/lib/services/parents';
import { Enrollment } from '@/types/models';

interface ClassDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  scheduleId: string;
  onAttendanceSaved?: () => void;
}

interface EnrolledStudent {
  id: string;
  name: string;
  nickname: string;
  parentId: string;
}

export default function ClassDetailDialog({ 
  open, 
  onOpenChange, 
  event,
  scheduleId,
  onAttendanceSaved
}: ClassDetailDialogProps) {
  const router = useRouter();
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (open && event && event.extendedProps.type === 'class') {
      console.log('=== Class Detail Dialog Debug ===');
      console.log('Event:', event);
      console.log('Event title:', event.title);
      console.log('Event extendedProps:', event.extendedProps);
      console.log('className:', (event.extendedProps as any).className);
      console.log('All props:', JSON.stringify(event.extendedProps, null, 2));
      console.log('================================');
      loadEnrolledStudents();
    }
  }, [open, event]);

  const loadEnrolledStudents = async () => {
    if (!event || event.extendedProps.type !== 'class') return;
    
    setLoadingStudents(true);
    try {
      // Get enrollments for this class
      const enrollments = await getEnrollmentsByClass(event.classId);
      
      // Get student details for each enrollment
      const studentsData: EnrolledStudent[] = [];
      for (const enrollment of enrollments) {
        const student = await getStudent(enrollment.parentId, enrollment.studentId);
        if (student) {
          studentsData.push({
            id: student.id,
            name: student.name,
            nickname: student.nickname,
            parentId: enrollment.parentId
          });
        }
      }
      
      // Sort by nickname
      studentsData.sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'));
      setEnrolledStudents(studentsData);
    } catch (error) {
      console.error('Error loading enrolled students:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  if (!event) return null;

  const isMakeup = event.extendedProps.type === 'makeup';
  const isTrial = event.extendedProps.type === 'trial';
  const isRegularClass = event.extendedProps.type === 'class';
  const eventDate = event.start as Date;
  const eventEndDate = event.end as Date | null;

  // Status color and icon
  const getStatusBadge = () => {
    const now = new Date();
    const isPast = eventEndDate ? eventEndDate < now : false;
    
    if (isMakeup) {
      if (isPast || event.extendedProps.makeupStatus === 'completed') {
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            เรียนเสร็จแล้ว
          </Badge>
        );
      }
      return (
        <Badge className="bg-purple-100 text-purple-700">
          <UserCircle className="h-3 w-3 mr-1" />
          Makeup Class
        </Badge>
      );
    } else if (isTrial) {
      if (isPast) {
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            ทดลองเรียนเสร็จแล้ว
          </Badge>
        );
      }
      return (
        <Badge className="bg-orange-100 text-orange-700">
          <School className="h-3 w-3 mr-1" />
          ทดลองเรียน
        </Badge>
      );
    } else if (isRegularClass) {
      if (isPast) {
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            สอนเสร็จแล้ว
          </Badge>
        );
      } else {
        const now = new Date();
        const isToday = eventDate.toDateString() === now.toDateString();
        const startTime = eventDate;
        
        if (isToday && now >= startTime && now <= eventEndDate!) {
          return (
            <Badge className="bg-blue-100 text-blue-700">
              <Clock className="h-3 w-3 mr-1 animate-pulse" />
              กำลังเรียน
            </Badge>
          );
        } else {
          return (
            <Badge className="bg-gray-100 text-gray-700">
              <Calendar className="h-3 w-3 mr-1" />
              รอเรียน
            </Badge>
          );
        }
      }
    }
  };

  // Get title based on event type - ใช้ event.title โดยตรง
  const getEventTitle = () => {
    if (isMakeup) {
      if (event.extendedProps.makeupCount && event.extendedProps.makeupCount > 1) {
        return `Makeup Class ${event.extendedProps.makeupCount} คน`;
      }
      return `${event.extendedProps.originalClassName} - Makeup`;
    } else if (isTrial) {
      return event.extendedProps.trialSubjectName || 'ทดลองเรียน';
    } else {
      // For regular class, use the event title (which is subject name)
      return event.title;
    }
  };

  // Format time safely
  const formatEventTime = () => {
    const startTime = eventDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (eventEndDate) {
      const endTime = eventEndDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${startTime} - ${endTime}`;
    } else {
      return startTime;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {/* Subject color dot */}
                {event.extendedProps.subjectColor && (
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: event.extendedProps.subjectColor }}
                  />
                )}
                <DialogTitle className="text-xl">
                  {getEventTitle()}
                  {event.extendedProps.sessionNumber && !isMakeup && !isTrial && (
                    <span className="ml-2 text-sm text-gray-500">(ครั้งที่ {event.extendedProps.sessionNumber})</span>
                  )}
                </DialogTitle>
              </div>
              {/* Show class name or code */}
              <p className="text-sm text-gray-500 mt-1">
                {(() => {
                  const props = event.extendedProps as any;
                  if (isRegularClass) {
                    // Try className first, then classCode, then show debug info
                    return props.className || props.classCode || `Class ID: ${event.classId}`;
                  } else if (isMakeup) {
                    if (props.makeupCount && props.makeupCount > 1) {
                      return `${props.makeupCount} นักเรียนเรียนชดเชย`;
                    }
                    return `Makeup Class - ${props.studentNickname || 'นักเรียน'}`;
                  } else if (isTrial) {
                    return 'ทดลองเรียน';
                  }
                  return '';
                })()}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{formatDate(eventDate, 'full')}</span>
                <Clock className="h-4 w-4 text-gray-400 ml-3" />
                <span className="font-medium">{formatEventTime()}</span>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location and Teacher Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                <span className="text-gray-500">ห้อง:</span>{' '}
                <span className="font-medium">{event.extendedProps.roomName}</span>
                <span className="text-gray-400 ml-1">({event.extendedProps.branchName})</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                <span className="text-gray-500">ครูผู้สอน:</span>{' '}
                <span className="font-medium">{event.extendedProps.teacherName}</span>
              </span>
            </div>
          </div>

          {/* For Trial Classes */}
          {isTrial && (
            <>
              {/* Show trial count if grouped */}
              {event.extendedProps.trialCount && event.extendedProps.trialCount > 1 && (
                <div className="p-3 bg-orange-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">มีนักเรียนทดลองเรียน {event.extendedProps.trialCount} คนในช่วงเวลานี้</span>
                  </div>
                  {event.extendedProps.trialDetails && (
                    <div className="mt-2 space-y-1">
                      {event.extendedProps.trialDetails.map((detail, index) => (
                        <div key={detail.id} className="text-xs text-orange-600 ml-6">
                          {index + 1}. {detail.studentName} - {detail.subjectName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trial Student Info */}
              <div className="p-4 bg-orange-50 rounded-lg space-y-2">
                <h3 className="font-medium text-orange-900">ข้อมูลทดลองเรียน</h3>
                <div className="text-sm text-orange-700">
                  <p>นักเรียน: {event.extendedProps.trialStudentName}</p>
                  <p>วิชา: {event.extendedProps.trialSubjectName}</p>
                </div>
              </div>
            </>
          )}

          {/* For Makeup Classes */}
          {isMakeup && (
            <div className="p-4 bg-purple-50 rounded-lg space-y-2">
              <h3 className="font-medium text-purple-900">ข้อมูล Makeup Class</h3>
              
              {/* แสดงจำนวนนักเรียนถ้ามีหลายคน */}
              {event.extendedProps.makeupCount && event.extendedProps.makeupCount > 1 && (
                <div className="flex items-center gap-2 text-purple-700 mb-3">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">มีนักเรียนเรียนชดเชย {event.extendedProps.makeupCount} คนในช่วงเวลานี้</span>
                </div>
              )}
              
              {/* แสดงรายละเอียดนักเรียน */}
              {event.extendedProps.makeupDetails && event.extendedProps.makeupDetails.length > 1 ? (
                <div className="space-y-2">
                  {event.extendedProps.makeupDetails.map((detail, index) => (
                    <div key={detail.id} className="text-sm text-purple-700 p-2 bg-purple-100 rounded">
                      <p className="font-medium">{index + 1}. {detail.studentNickname} ({detail.studentName})</p>
                      <p className="text-xs">คลาสเดิม: {detail.originalClassName}</p>
                      {detail.attendance && (
                        <p className="text-xs mt-1">
                          สถานะ: {detail.attendance.status === 'present' ? 'เข้าเรียน' : 'ขาดเรียน'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-purple-700">
                  <p>นักเรียน: {event.extendedProps.studentNickname} ({event.extendedProps.studentName})</p>
                  <p>คลาสเดิม: {event.extendedProps.originalClassName}</p>
                </div>
              )}
            </div>
          )}

          {/* For Regular Classes - Show enrolled students */}
          {isRegularClass && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium text-gray-900">รายชื่อนักเรียน</h3>
                  <Badge variant="secondary">
                    {event.extendedProps.enrolled || 0} คน
                  </Badge>
                </div>
              </div>

              {loadingStudents ? (
                <div className="text-center py-4 text-gray-500">
                  กำลังโหลดรายชื่อนักเรียน...
                </div>
              ) : enrolledStudents.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {enrolledStudents.map((student, index) => (
                    <div 
                      key={student.id} 
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{student.nickname}</p>
                        <p className="text-xs text-gray-500">{student.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  ยังไม่มีนักเรียนลงทะเบียน
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {/* Check attendance button - for future use */}
            {isRegularClass && (
              <Button 
                variant="outline"
                onClick={() => {
                  // TODO: Link to attendance module
                  console.log('Go to attendance module');
                }}
                disabled // Disable for now
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                เช็คชื่อ
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
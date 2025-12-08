// components/reports/availability/TeacherAvailability.tsx

'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Phone,
  Clock,
  Users,
  UserCheck,
  BookOpen,
  Building2
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Teacher, Subject } from '@/types/models';

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  conflicts?: Array<{
    type: 'class' | 'makeup' | 'trial';
    name: string;
  }>;
}

interface TeacherAvailabilityData {
  teacher: Teacher;
  slots: TimeSlot[];
  specialties: Subject[];
}

interface TeacherAvailabilityProps {
  teacherAvailability: TeacherAvailabilityData[];
  timeRange: { start: string; end: string };
  timeAlignment: '00' | '30';
  subjects: Subject[];
  dayInfo: {
    isHoliday: boolean;
    holidayName?: string;
    busySlots: any[];
  } | null;
}

export function TeacherAvailability({ 
  teacherAvailability, 
  timeRange, 
  timeAlignment,
  subjects,
  dayInfo
}: TeacherAvailabilityProps) {
  
  // Generate time slots for header
  const generateTimeSlots = (start: string, end: string) => {
    const slots: Array<{ startTime: string; endTime: string }> = [];
    let [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    // Adjust start time based on alignment preference
    if (timeAlignment === '30' && startMin === 0) {
      startMin = 30;
    } else if (timeAlignment === '00' && startMin === 30) {
      startHour += 1;
      startMin = 0;
    }
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      currentHour += 1;
      
      if (currentHour > endHour || (currentHour === endHour && currentMin > endMin)) {
        currentHour = endHour;
        currentMin = endMin;
      }
      
      const slotEnd = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      slots.push({
        startTime: slotStart,
        endTime: slotEnd
      });
    }
    
    return slots;
  };

  // Calculate percentage position on timeline
  const getTimePercentage = (time: string, startTime: string, endTime: string): number => {
    const [timeHour, timeMin] = time.split(':').map(Number);
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const timeInMinutes = timeHour * 60 + timeMin;
    const startInMinutes = startHour * 60 + startMin;
    const endInMinutes = endHour * 60 + endMin;
    
    const percentage = ((timeInMinutes - startInMinutes) / (endInMinutes - startInMinutes)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  // Check if color is light
  const isColorLight = (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="overflow-x-auto overflow-y-visible">
          <div className="min-w-[800px]">
            {/* Time Header */}
            <div className="flex border-b pb-2 mb-4">
              <div className="w-36 font-medium text-sm">ครู / เวลา</div>
              <div className="flex-1 relative h-10">
                {/* Time labels */}
                <div className="absolute inset-0 flex">
                  {generateTimeSlots(timeRange.start, timeRange.end).map((slot, idx) => (
                    <div 
                      key={idx} 
                      className="flex-1 text-center text-sm text-gray-600 border-l first:border-l-0"
                    >
                      {slot.startTime}
                    </div>
                  ))}
                  <div className="text-center text-sm text-gray-600 border-l px-2">
                    {timeRange.end}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Teacher Rows */}
            <div className="space-y-2">
              {teacherAvailability.map(({ teacher, slots, specialties }) => {
                // Get busy slots for this teacher
                const teacherBusySlots = dayInfo?.busySlots.filter(slot => 
                  slot.teacherId === teacher.id
                ) || [];
                
                return (
                  <div key={teacher.id} className="flex items-stretch">
                    {/* Teacher Info */}
                    <div className="w-36 py-3 pr-4 space-y-1">
                      <div className="font-medium text-sm">
                        {teacher.nickname || teacher.name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {teacher.phone}
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {specialties.slice(0, 2).map(subject => (
                          <Badge 
                            key={subject.id} 
                            variant="outline"
                            className="text-xs px-1 py-0"
                            style={{
                              backgroundColor: `${subject.color}20`,
                              borderColor: subject.color,
                              color: subject.color
                            }}
                          >
                            {subject.name.slice(0, 3)}
                          </Badge>
                        ))}
                        {specialties.length > 2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            +{specialties.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Timeline */}
                    <div className="flex-1 relative bg-gray-50 rounded-lg h-20">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {generateTimeSlots(timeRange.start, timeRange.end).map((_, idx) => (
                          <div key={idx} className="flex-1 border-l border-gray-200 first:border-l-0" />
                        ))}
                        <div className="border-l border-gray-200 w-px" />
                      </div>
                      
                      {/* Busy Slots with Popover */}
                      {teacherBusySlots.map((busySlot, idx) => {
                        const startPercent = getTimePercentage(busySlot.startTime, timeRange.start, timeRange.end);
                        const endPercent = getTimePercentage(busySlot.endTime, timeRange.start, timeRange.end);
                        const width = endPercent - startPercent;
                        
                        // Get color based on type
                        let bgColor = '';
                        let textColor = 'text-white';
                        let opacity = 1;
                        
                        // Check if class is completed
                        if (busySlot.type === 'class' && busySlot.isCompleted) {
                          bgColor = '#9CA3AF'; // gray-400
                          textColor = 'text-white';
                          opacity = 0.8;
                        } else if (busySlot.type === 'class' && busySlot.subjectId) {
                          const subject = subjects.find(s => s.id === busySlot.subjectId);
                          if (subject?.color) {
                            bgColor = subject.color;
                            const isLightColor = isColorLight(subject.color);
                            textColor = isLightColor ? 'text-gray-900' : 'text-white';
                          } else {
                            bgColor = '#DBEAFE'; // blue-100
                            textColor = 'text-blue-700';
                          }
                        } else if (busySlot.type === 'makeup') {
                          bgColor = '#E9D5FF'; // purple-100
                          textColor = 'text-purple-700';
                        } else if (busySlot.type === 'trial') {
                          bgColor = '#FED7AA'; // orange-100
                          textColor = 'text-orange-700';
                        } else {
                          bgColor = '#DBEAFE'; // blue-100
                          textColor = 'text-blue-700';
                        }
                        
                        // Get student info for makeup and trial
                        let studentInfo = '';
                        if (busySlot.type === 'makeup' || busySlot.type === 'trial') {
                          studentInfo = busySlot.studentName || busySlot.name.split(': ')[1] || 'นักเรียน';
                        }
                        
                        // Create display name with session info
                        let displayName = busySlot.name;
                        if (busySlot.type === 'class' && busySlot.sessionNumber && busySlot.totalSessions) {
                          displayName = `${busySlot.name} (${busySlot.sessionNumber}/${busySlot.totalSessions})`;
                        }
                        
                        // Create unique key
                        const uniqueKey = busySlot.classId 
                          ? `${teacher.id}-${busySlot.classId}-${idx}` 
                          : `${teacher.id}-${idx}-${busySlot.type}-${busySlot.startTime}`;
                        
                        return (
                          <Popover key={uniqueKey}>
                            <PopoverTrigger asChild>
                              <div
                                className={cn(
                                  "absolute top-2 bottom-2 rounded-md flex items-center px-2 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer",
                                  textColor
                                )}
                                style={{
                                  left: `${startPercent}%`,
                                  width: `${width}%`,
                                  backgroundColor: bgColor,
                                  border: `2px solid ${bgColor}`,
                                  filter: 'brightness(1.1)',
                                  opacity: opacity
                                }}
                              >
                                <div className="text-xs font-medium truncate">
                                  {displayName}
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-80" 
                              align="center"
                              sideOffset={5}
                            >
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900">
                                    {busySlot.name}
                                    {busySlot.type === 'class' && busySlot.sessionNumber && busySlot.totalSessions && (
                                      <span className="ml-2 text-sm font-normal text-gray-600">
                                        (ครั้งที่ {busySlot.sessionNumber}/{busySlot.totalSessions})
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {busySlot.type === 'class' ? 
                                      (busySlot.isCompleted ? 'คลาสจบแล้ว' : 'คลาสปกติ') : 
                                     busySlot.type === 'makeup' ? 'เรียนชดเชย' : 'ทดลองเรียน'}
                                  </p>
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-start gap-2">
                                    <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <span className="text-gray-700">{busySlot.startTime} - {busySlot.endTime}</span>
                                  </div>
                                  
                                  {busySlot.roomId && (
                                    <div className="flex items-start gap-2">
                                      <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                                      <span className="text-gray-700">ห้อง: {busySlot.roomName || 'ไม่ระบุ'}</span>
                                    </div>
                                  )}
                                  
                                  {busySlot.type === 'trial' && busySlot.trialDetails && busySlot.trialCount > 1 ? (
                                    <div className="flex items-start gap-2">
                                      <UserCheck className="h-4 w-4 text-gray-400 mt-0.5" />
                                      <div className="text-gray-700">
                                        <div className="font-medium mb-1">นักเรียน {busySlot.trialCount} คน:</div>
                                        <div className="space-y-1 text-sm pl-2">
                                          {busySlot.trialDetails.map((trial: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1">
                                              <span className="text-gray-500">•</span>
                                              <span>{trial.studentName}</span>
                                              <span className="text-gray-500">-</span>
                                              <span className="text-gray-600">{trial.subjectName}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {studentInfo && (
                                        <div className="flex items-start gap-2">
                                          <UserCheck className="h-4 w-4 text-gray-400 mt-0.5" />
                                          <span className="text-gray-700">นักเรียน: {studentInfo}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  {busySlot.type === 'makeup' && studentInfo && (
                                    <div className="flex items-start gap-2">
                                      <UserCheck className="h-4 w-4 text-gray-400 mt-0.5" />
                                      <span className="text-gray-700">นักเรียน: {studentInfo}</span>
                                    </div>
                                  )}
                                  
                                  {busySlot.type === 'class' && busySlot.subjectId && (
                                    <div className="flex items-start gap-2">
                                      <BookOpen className="h-4 w-4 text-gray-400 mt-0.5" />
                                      <span className="text-gray-700">
                                        วิชา: {subjects.find(s => s.id === busySlot.subjectId)?.name || 'ไม่ระบุ'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                      
                      {/* Show available slots in light green */}
                      {slots.filter(s => s.available).map((slot, idx) => {
                        const startPercent = getTimePercentage(slot.startTime, timeRange.start, timeRange.end);
                        const endPercent = getTimePercentage(slot.endTime, timeRange.start, timeRange.end);
                        const width = endPercent - startPercent;
                        
                        return (
                          <div
                            key={`available-${idx}`}
                            className="absolute top-2 bottom-2 rounded-md"
                            style={{
                              left: `${startPercent}%`,
                              width: `${width}%`,
                              backgroundColor: '#D1FAE5', // green-100
                              border: '1px dashed #10B981',
                              opacity: 0.7
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-medium mb-3">สีแสดงสถานะ:</p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#D1FAE5', border: '1px dashed #10B981' }}></div>
                  <span>ว่าง</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#DBEAFE' }}></div>
                  <span>คลาสปกติ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9CA3AF' }}></div>
                  <span>คลาสจบแล้ว</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E9D5FF' }}></div>
                  <span>เรียนชดเชย</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FED7AA' }}></div>
                  <span>ทดลองเรียน</span>
                </div>
                <div className="text-gray-500 text-xs ml-4">
                  * คลาสปกติจะแสดงสีตามวิชา (ถ้ามี)
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
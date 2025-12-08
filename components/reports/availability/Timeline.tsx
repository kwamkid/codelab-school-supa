// components/reports/availability/Timeline.tsx

'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Users, 
  UserCheck,
  BookOpen
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Room, Teacher, Subject } from '@/types/models';

interface TimelineProps {
  roomAvailability: Array<{
    room: Room;
    slots: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
      conflicts?: Array<{
        type: 'class' | 'makeup' | 'trial';
        name: string;
      }>;
    }>;
  }>;
  dayInfo: {
    isHoliday: boolean;
    holidayName?: string;
    busySlots: any[];
  } | null;
  teachers: Teacher[];
  subjects: Subject[];
  timeRange: { start: string; end: string };
  timeAlignment: '00' | '30';
}

export function Timeline({
  roomAvailability,
  dayInfo,
  teachers,
  subjects,
  timeRange,
  timeAlignment
}: TimelineProps) {
  // Generate time slots
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
      
      // Add 1 hour
      currentHour += 1;
      
      // Don't exceed end time
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

  // Group busy slots by room
  const roomBusySlots = new Map<string, typeof dayInfo.busySlots>();
  
  if (dayInfo?.busySlots) {
    dayInfo.busySlots.forEach(slot => {
      if (!roomBusySlots.has(slot.roomId)) {
        roomBusySlots.set(slot.roomId, []);
      }
      roomBusySlots.get(slot.roomId)!.push(slot);
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="overflow-x-auto overflow-y-visible">
          <div className="min-w-[800px]">
            {/* Time Header */}
            <div className="flex border-b pb-2 mb-4">
              <div className="w-28 font-medium text-sm">ห้อง / เวลา</div>
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
            
            {/* Room Rows */}
            <div className="space-y-2">
              {roomAvailability.map(({ room }) => {
                // Get busy slots for this room from the map
                const roomSlots = roomBusySlots.get(room.id) || [];
                
                return (
                  <div key={room.id} className="flex items-stretch">
                    {/* Room Name */}
                    <div className="w-28 py-3 pr-4">
                      <div className="font-medium text-sm">{room.name}</div>
                      <div className="text-xs text-gray-500">จุ {room.capacity} คน</div>
                    </div>
                    
                    {/* Timeline */}
                    <div className="flex-1 relative bg-gray-50 rounded-lg h-16">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {generateTimeSlots(timeRange.start, timeRange.end).map((_, idx) => (
                          <div key={idx} className="flex-1 border-l border-gray-200 first:border-l-0" />
                        ))}
                        <div className="border-l border-gray-200 w-px" />
                      </div>
                      
                      {/* Busy Slots with Popover - Using unique key with both room.id and index */}
                      {roomSlots.map((busySlot, idx) => {
                        const startPercent = getTimePercentage(busySlot.startTime, timeRange.start, timeRange.end);
                        const endPercent = getTimePercentage(busySlot.endTime, timeRange.start, timeRange.end);
                        const width = endPercent - startPercent;
                        
                        // Get subject color if it's a class
                        let bgColor = '';
                        let textColor = 'text-white';
                        let borderColor = '';
                        let opacity = 1;
                        
                        // Check if class is completed
                        if (busySlot.type === 'class' && busySlot.isCompleted) {
                          bgColor = '#9CA3AF'; // gray-400
                          borderColor = '#6B7280'; // gray-500
                          textColor = 'text-white';
                          opacity = 0.8;
                        } else if (busySlot.type === 'class' && busySlot.subjectId) {
                          const subject = subjects.find(s => s.id === busySlot.subjectId);
                          if (subject?.color) {
                            bgColor = subject.color;
                            const isLightColor = isColorLight(subject.color);
                            textColor = isLightColor ? 'text-gray-900' : 'text-white';
                          } else {
                            bgColor = '#E5E7EB';
                            borderColor = '#D1D5DB';
                            textColor = 'text-gray-700';
                          }
                        } else if (busySlot.type === 'makeup') {
                          bgColor = '#E9D5FF';
                          borderColor = '#D8B4FE';
                          textColor = 'text-purple-800';
                        } else if (busySlot.type === 'trial') {
                          bgColor = '#FED7AA';
                          borderColor = '#FDBA74';
                          textColor = 'text-orange-800';
                        } else {
                          bgColor = '#E5E7EB';
                          borderColor = '#D1D5DB';
                          textColor = 'text-gray-700';
                        }
                        
                        // Get teacher name for display
                        const teacher = teachers.find(t => t.id === busySlot.teacherId);
                        const teacherName = teacher?.nickname || teacher?.name || 'ไม่ระบุครู';
                        
                        // Get student info for makeup and trial
                        let studentInfo = '';
                        if (busySlot.type === 'makeup' || busySlot.type === 'trial') {
                          const studentName = busySlot.studentName || busySlot.name.split(': ')[1] || 'นักเรียน';
                          studentInfo = studentName;
                        }
                        
                        // Create unique key using room ID, class ID, slot index, and type
                        const uniqueKey = busySlot.classId 
                          ? `${room.id}-${busySlot.classId}-${idx}-${busySlot.type}` 
                          : `${room.id}-${idx}-${busySlot.type}-${busySlot.startTime}`;
                        
                        // Create display name with session number for classes
                        let displayName = busySlot.name;
                        if (busySlot.type === 'class' && busySlot.sessionNumber && busySlot.totalSessions) {
                          displayName = `${busySlot.name} (${busySlot.sessionNumber}/${busySlot.totalSessions})`;
                        }
                        
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
                                  border: borderColor ? `1px solid ${borderColor}` : `2px solid ${bgColor}`,
                                  zIndex: idx + 1, // เพิ่ม z-index เพื่อป้องกันการทับซ้อน
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
                                    {busySlot.type === 'class' ? (
                                      busySlot.isCompleted ? 'คลาสจบแล้ว' : 'คลาสปกติ'
                                    ) : 
                                     busySlot.type === 'makeup' ? 'เรียนชดเชย' : 'ทดลองเรียน'}
                                  </p>
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-start gap-2">
                                    <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <span className="text-gray-700">{busySlot.startTime} - {busySlot.endTime}</span>
                                  </div>
                                  
                                  <div className="flex items-start gap-2">
                                    <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <span className="text-gray-700">ครู: {teacherName}</span>
                                  </div>
                                  
                                  {busySlot.type === 'trial' && busySlot.trialDetails && busySlot.trialCount > 1 ? (
                                    <div className="flex items-start gap-2">
                                      <UserCheck className="h-4 w-4 text-gray-400 mt-0.5" />
                                      <div className="text-gray-700">
                                        <div className="font-medium mb-1">นักเรียน {busySlot.trialCount} คน:</div>
                                        <div className="space-y-1 text-sm pl-2">
                                          {busySlot.trialDetails.map((trial: any, trialIdx: number) => (
                                            <div key={`trial-${trialIdx}`} className="flex items-center gap-1">
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
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-medium mb-3">สีแสดงประเภท:</p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E9D5FF', border: '1px solid #D8B4FE' }}></div>
                  <span>Makeup Class</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FED7AA', border: '1px solid #FDBA74' }}></div>
                  <span>ทดลองเรียน</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9CA3AF', border: '1px solid #6B7280' }}></div>
                  <span>คลาสจบแล้ว</span>
                </div>
                <div className="text-gray-500 text-xs ml-4">
                  * คลาสปกติจะแสดงสีตามวิชา
                </div>
              </div>
              
              {/* Subject Colors */}
              {subjects.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">สีตามวิชา:</p>
                  <div className="flex flex-wrap gap-3">
                    {subjects.filter(s => s.isActive).map(subject => (
                      <div key={subject.id} className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border border-gray-300" 
                          style={{ backgroundColor: subject.color }}
                        ></div>
                        <span className="text-xs">{subject.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
// components/reports/availability/RoomAvailability.tsx

'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  Clock,
  MapPin,
  Projector,
  PenTool,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Room, Subject } from '@/types/models';

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  conflicts?: Array<{
    type: 'class' | 'makeup' | 'trial';
    name: string;
    subjectId?: string;
    subjectColor?: string;
    classId?: string;
    sessionNumber?: number;
    totalSessions?: number;
    isCompleted?: boolean;
  }>;
}

interface RoomAvailabilityData {
  room: Room;
  slots: TimeSlot[];
}

interface RoomAvailabilityProps {
  roomAvailability: RoomAvailabilityData[];
  subjects?: Subject[];
}

export function RoomAvailability({ roomAvailability, subjects = [] }: RoomAvailabilityProps) {
  // Get time range from slots
  const timeRange = roomAvailability[0]?.slots.length > 0 ? {
    start: roomAvailability[0].slots[0].startTime,
    end: roomAvailability[0].slots[roomAvailability[0].slots.length - 1].endTime
  } : { start: '08:00', end: '19:00' };

  // Generate time markers for header
  const generateTimeMarkers = () => {
    const markers = [];
    const [startHour] = timeRange.start.split(':').map(Number);
    const [endHour] = timeRange.end.split(':').map(Number);
    
    for (let hour = startHour; hour <= endHour; hour++) {
      markers.push(`${String(hour).padStart(2, '0')}:00`);
    }
    
    return markers;
  };

  const timeMarkers = generateTimeMarkers();

  // Calculate percentage position
  const getTimePercentage = (time: string): number => {
    const [timeHour, timeMin] = time.split(':').map(Number);
    const [startHour, startMin] = timeRange.start.split(':').map(Number);
    const [endHour, endMin] = timeRange.end.split(':').map(Number);
    
    const timeInMinutes = timeHour * 60 + timeMin;
    const startInMinutes = startHour * 60 + startMin;
    const endInMinutes = endHour * 60 + endMin;
    
    const percentage = ((timeInMinutes - startInMinutes) / (endInMinutes - startInMinutes)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  // Merge consecutive slots for display with unique identification
  const mergeSlots = (slots: TimeSlot[]) => {
    const merged: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
      type?: 'class' | 'makeup' | 'trial';
      name?: string;
      count: number;
      subjectId?: string;
      subjectColor?: string;
      classId?: string;
      sessionNumber?: number;
      totalSessions?: number;
      isCompleted?: boolean;
      conflicts?: Array<any>;
    }> = [];
    
    let current: any = null;
    
    slots.forEach(slot => {
      const isAvailable = slot.available;
      const conflict = slot.conflicts?.[0];
      const conflictType = conflict?.type;
      const conflictName = conflict?.name;
      const subjectId = conflict?.subjectId;
      const subjectColor = conflict?.subjectColor;
      const classId = conflict?.classId;
      const sessionNumber = conflict?.sessionNumber;
      const totalSessions = conflict?.totalSessions;
      const isCompleted = conflict?.isCompleted;
      
      // Create a unique identifier for comparison
      const identifier = !isAvailable && conflict ? 
        `${conflictType}-${conflictName}-${classId || 'no-class'}-${subjectId || 'no-subject'}` : 
        'available';
      
      if (!current || 
          current.available !== isAvailable || 
          current.identifier !== identifier) {
        // Start new segment
        if (current) merged.push(current);
        current = {
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: isAvailable,
          type: conflictType,
          name: conflictName,
          count: 1,
          subjectId,
          subjectColor,
          classId,
          sessionNumber,
          totalSessions,
          isCompleted,
          identifier,
          conflicts: slot.conflicts || []
        };
      } else {
        // Extend current segment
        current.endTime = slot.endTime;
        current.count++;
        // Merge conflicts
        if (slot.conflicts) {
          current.conflicts = [...(current.conflicts || []), ...slot.conflicts];
        }
      }
    });
    
    if (current) {
      delete current.identifier; // Remove identifier from final output
      merged.push(current);
    }
    return merged;
  };

  // Get color based on type
  const getSegmentColor = (segment: any) => {
    if (segment.available) {
      return {
        bg: 'bg-green-100',
        border: 'border-green-300',
        text: 'text-green-700'
      };
    }
    
    // Check if completed class
    if (segment.type === 'class' && segment.isCompleted) {
      return {
        bg: 'bg-gray-300',
        border: 'border-gray-400',
        text: 'text-gray-700',
        opacity: 0.8
      };
    }
    
    switch (segment.type) {
      case 'makeup':
        return {
          bg: 'bg-purple-100',
          border: 'border-purple-300',
          text: 'text-purple-700'
        };
      case 'trial':
        return {
          bg: 'bg-orange-100', 
          border: 'border-orange-300',
          text: 'text-orange-700'
        };
      default: // class
        // Use subject color if available
        if (segment.subjectId && subjects.length > 0) {
          const subject = subjects.find(s => s.id === segment.subjectId);
          if (subject?.color) {
            // Check if color is light for text contrast
            const isLight = isColorLight(subject.color);
            return {
              bgColor: subject.color,
              borderColor: subject.color,
              textColor: isLight ? 'text-gray-900' : 'text-white',
              useCustomColor: true
            };
          }
        }
        // Default blue if no subject color
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-300',
          text: 'text-blue-700'
        };
    }
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

  // Calculate stats
  const calculateRoomStats = (slots: TimeSlot[]) => {
    const totalSlots = slots.length;
    const availableSlots = slots.filter(s => s.available).length;
    const usedSlots = totalSlots - availableSlots;
    const usagePercentage = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
    
    return {
      availableHours: availableSlots,
      usedHours: usedSlots,
      totalHours: totalSlots,
      usagePercentage
    };
  };

  // Create display name with session info
  const getDisplayName = (segment: any) => {
    if (!segment.available && segment.name) {
      if (segment.type === 'class' && segment.sessionNumber && segment.totalSessions) {
        return `${segment.name} (${segment.sessionNumber}/${segment.totalSessions})`;
      }
      return segment.name;
    }
    return '';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>ห้องเรียนและตารางการใช้งาน</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span>ว่าง</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span>คลาสปกติ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-300 border border-gray-400 rounded"></div>
              <span>คลาสจบแล้ว</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
              <span>Makeup</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
              <span>ทดลอง</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Time Header */}
          <div className="relative h-8 mb-2">
            <div className="absolute inset-0 flex">
              {timeMarkers.map((time, idx) => (
                <div
                  key={idx}
                  className="text-xs text-gray-600 absolute"
                  style={{ left: `${getTimePercentage(time)}%` }}
                >
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* Room Rows */}
          <div className="space-y-3">
            {roomAvailability.map(({ room, slots }) => {
              const mergedSlots = mergeSlots(slots);
              const stats = calculateRoomStats(slots);
              
              return (
                <div key={room.id} className="bg-white border rounded-lg p-4">
                  {/* Room Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-600" />
                        {room.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          จุ {room.capacity} คน
                        </span>
                        {room.floor && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            ชั้น {room.floor}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          {room.hasProjector && (
                            <Projector className="h-3.5 w-3.5 text-green-600" title="มี Projector" />
                          )}
                          {room.hasWhiteboard && (
                            <PenTool className="h-3.5 w-3.5 text-green-600" title="มี Whiteboard" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{stats.usagePercentage}%</div>
                      <div className="text-xs text-gray-500">ใช้งาน</div>
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div className="relative h-12 bg-gray-50 rounded-lg overflow-hidden">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeMarkers.map((_, idx) => (
                        <div 
                          key={idx} 
                          className="flex-1 border-l border-gray-200 first:border-l-0"
                        />
                      ))}
                    </div>
                    
                    {/* Time segments */}
                    {mergedSlots.map((segment, idx) => {
                      const startPercent = getTimePercentage(segment.startTime);
                      const endPercent = getTimePercentage(segment.endTime);
                      const width = endPercent - startPercent;
                      const colors = getSegmentColor(segment);
                      const displayName = getDisplayName(segment);
                      
                      return (
                        <div
                          key={`${room.id}-segment-${idx}-${segment.startTime}`}
                          className={cn(
                            "absolute top-1 bottom-1 rounded border transition-all hover:z-10 hover:shadow-md",
                            colors.useCustomColor ? '' : colors.bg,
                            colors.useCustomColor ? '' : colors.border
                          )}
                          style={{
                            left: `${startPercent}%`,
                            width: `${width}%`,
                            ...(colors.useCustomColor && {
                              backgroundColor: colors.bgColor,
                              borderColor: colors.borderColor,
                            }),
                            ...(colors.opacity && {
                              opacity: colors.opacity
                            })
                          }}
                          title={segment.available 
                            ? `ว่าง: ${segment.startTime} - ${segment.endTime}` 
                            : `${displayName}: ${segment.startTime} - ${segment.endTime}`
                          }
                        >
                          <div className={cn(
                            "text-xs font-medium h-full flex items-center px-2", 
                            colors.useCustomColor ? colors.textColor : colors.text
                          )}>
                            {segment.available ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              <span className="truncate">{displayName}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Room Summary */}
                  <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-gray-500">ว่าง:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {stats.availableHours} ชม.
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">ใช้งาน:</span>
                      <span className="ml-2 font-medium text-blue-700">
                        {stats.usedHours} ชม.
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">ทั้งหมด:</span>
                      <span className="ml-2 font-medium">{stats.totalHours} ชม.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
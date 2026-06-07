'use client';

import { useMemo } from 'react';
import { User, Users, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Up to 2-character initials for the teacher avatar fallback
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

// Types matching the RPC response
export interface TimetableEvent {
  schedule_id: string;
  class_id: string;
  event_type: 'class' | 'makeup' | 'trial';
  subject_name: string;
  subject_color: string;
  class_name: string;
  class_code: string;
  start_time: string;
  end_time: string;
  enrolled_count: number | null;
  max_students: number | null;
  session_number: number | null;
  total_sessions?: number | null;
  schedule_status: string;
  attendance: any;
  room_name: string;
  room_id: string;
  teacher_name: string;
  teacher_image?: string | null;
  branch_name: string;
  branch_id: string;
  student_info: string | null;
  extra_info: string | null;
}

export interface TimetableRoom {
  room_id: string;
  room_name: string;
  branch_id: string;
  branch_name: string;
}

interface DailyTimetableProps {
  events: TimetableEvent[];
  rooms: TimetableRoom[];
  onEventClick: (event: TimetableEvent) => void;
}

function formatTimeSlot(start: string, end: string): string {
  return `${start.substring(0, 5)} - ${end.substring(0, 5)}`;
}

function getEventBg(event: TimetableEvent): string {
  const now = new Date();
  const today = new Date().toISOString().slice(0, 10);
  const [h, m] = event.end_time.split(':').map(Number);
  const endTime = new Date();
  endTime.setHours(h, m, 0, 0);

  // Completed (past time or status)
  if (endTime < now || event.schedule_status === 'completed') {
    return 'bg-green-50 border-green-200';
  }

  switch (event.event_type) {
    case 'makeup': return 'bg-purple-50 border-purple-200';
    case 'trial': return 'bg-orange-50 border-orange-200';
    default: return 'bg-white border-gray-200';
  }
}

function getTypeBadge(type: string) {
  if (type === 'makeup') return <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] px-1.5 py-0">M</Badge>;
  if (type === 'trial') return <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] px-1.5 py-0">T</Badge>;
  return null;
}

export default function DailyTimetable({ events, rooms, onEventClick }: DailyTimetableProps) {
  // Build time slots (unique start_time + end_time combos, sorted)
  const timeSlots = useMemo(() => {
    const slotMap = new Map<string, { start: string; end: string }>();
    for (const e of events) {
      const key = `${e.start_time}-${e.end_time}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, { start: e.start_time, end: e.end_time });
      }
    }
    return [...slotMap.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [events]);

  // Sort rooms by name
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.room_name.localeCompare(b.room_name));
  }, [rooms]);

  // Build lookup: timeKey-roomId -> events[]
  const grid = useMemo(() => {
    const map = new Map<string, TimetableEvent[]>();
    for (const e of events) {
      const timeKey = `${e.start_time}-${e.end_time}`;
      const cellKey = `${timeKey}|${e.room_id}`;
      if (!map.has(cellKey)) map.set(cellKey, []);
      map.get(cellKey)!.push(e);
    }
    return map;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <GraduationCap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="text-base">ไม่มีคลาสเรียนในวันนี้</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-6">
      <div className="inline-block min-w-full px-4 sm:px-6">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-600 text-left w-[96px] min-w-[96px]">
                เวลา
              </th>
              {sortedRooms.map((room) => (
                <th
                  key={room.room_id}
                  className="border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 text-center bg-gray-50 min-w-[200px]"
                >
                  {room.room_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot) => {
              const timeKey = `${slot.start}-${slot.end}`;
              return (
                <tr key={timeKey}>
                  {/* Time column */}
                  <td className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-2 py-2 text-xs font-medium text-gray-700 whitespace-nowrap align-top">
                    {slot.start.substring(0, 5)}
                    <br />
                    <span className="text-gray-400">{slot.end.substring(0, 5)}</span>
                    {(() => {
                      const count = events.filter(e => `${e.start_time}-${e.end_time}` === timeKey).length;
                      return <span className="text-gray-400 ml-0.5"> ({count})</span>;
                    })()}
                  </td>

                  {/* Room columns */}
                  {sortedRooms.map((room) => {
                    const cellKey = `${timeKey}|${room.room_id}`;
                    const cellEvents = grid.get(cellKey) || [];

                    return (
                      <td
                        key={room.room_id}
                        className="border border-gray-200 p-1.5 align-top"
                      >
                        {cellEvents.length === 0 ? (
                          <div className="h-full min-h-[84px]" />
                        ) : (
                          <div className="space-y-1.5">
                            {cellEvents.map((event) => (
                              <button
                                key={event.schedule_id}
                                onClick={() => onEventClick(event)}
                                className={cn(
                                  'w-full text-left rounded-lg border p-2.5 transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer',
                                  getEventBg(event)
                                )}
                              >
                                {/* Subject + session no. (inline) + type badge */}
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: event.subject_color }}
                                  />
                                  <span className="font-semibold text-gray-900 text-sm truncate min-w-0">
                                    {event.subject_name}
                                  </span>
                                  {event.session_number != null && (
                                    <span className="text-orange-600 font-semibold text-[11px] shrink-0 whitespace-nowrap">
                                      ({event.session_number}{event.total_sessions != null ? `/${event.total_sessions}` : ''})
                                    </span>
                                  )}
                                  <span className="ml-auto shrink-0">{getTypeBadge(event.event_type)}</span>
                                </div>

                                {/* Class code (de-emphasised) */}
                                {event.class_name && (
                                  <p className="text-[10px] text-gray-400 truncate mb-1.5">
                                    {event.class_name}
                                  </p>
                                )}

                                {/* Teacher (avatar + name) + right info */}
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  {event.teacher_name ? (
                                    <span className="flex items-center gap-1.5 min-w-0 text-xs text-gray-700">
                                      <Avatar className="h-6 w-6 shrink-0 ring-1 ring-gray-200">
                                        {event.teacher_image ? (
                                          <AvatarImage src={event.teacher_image} alt={event.teacher_name} />
                                        ) : null}
                                        <AvatarFallback className="bg-gray-200 text-gray-600 text-[10px]">
                                          {getInitials(event.teacher_name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate font-medium">{event.teacher_name}</span>
                                    </span>
                                  ) : <span />}

                                  {/* Regular class → enrolled count; makeup/trial → student name */}
                                  {event.event_type === 'class' && event.enrolled_count != null && (
                                    <span className="flex items-center gap-0.5 text-xs text-gray-500 shrink-0">
                                      <Users className="h-3.5 w-3.5" />
                                      {event.enrolled_count}/{event.max_students}
                                    </span>
                                  )}
                                  {(event.event_type === 'makeup' || event.event_type === 'trial') && event.student_info && (
                                    <span
                                      className={cn(
                                        'flex items-center gap-0.5 text-xs shrink-0 truncate max-w-[55%]',
                                        event.event_type === 'makeup' ? 'text-purple-600' : 'text-orange-600'
                                      )}
                                    >
                                      <User className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{event.student_info}</span>
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

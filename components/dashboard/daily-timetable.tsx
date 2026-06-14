'use client';

import { useMemo } from 'react';
import { User, Users, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TeacherBadge } from '@/components/ui/teacher-badge';
import { cn } from '@/lib/utils';

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

function getEventBg(event: TimetableEvent): string {
  const now = new Date();
  const today = new Date().toISOString().slice(0, 10);
  const [h, m] = event.end_time.split(':').map(Number);
  const endTime = new Date();
  endTime.setHours(h, m, 0, 0);

  // Completed (past time or status)
  if (endTime < now || event.schedule_status === 'completed') {
    return 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800';
  }

  switch (event.event_type) {
    case 'makeup': return 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800';
    case 'trial': return 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800';
    // Regular class not yet finished → light blue (distinct from green = done)
    default: return 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800';
  }
}

function getTypeBadge(type: string) {
  if (type === 'makeup') return <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] px-1.5 py-0">M</Badge>;
  if (type === 'trial') return <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] px-1.5 py-0">T</Badge>;
  return null;
}

const SLOT_MINUTES = 30;
// Fixed height (px) of one 30-min row — used both for the time cell and for
// drawing the 30-min gridline overlay across long (rowspan) class cards.
const ROW_HEIGHT = 56;

/** "HH:MM[:SS]" → minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight → "HH:MM" */
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A class card — shared by the grid cell. */
function EventCard({ event, onClick }: { event: TimetableEvent; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full h-full text-left rounded-lg border p-2.5 transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer',
        getEventBg(event)
      )}
    >
      {/* Subject + session no. (inline) + type badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: event.subject_color }}
        />
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate min-w-0">
          {event.subject_name}
        </span>
        {event.session_number != null && (
          <span className="text-orange-600 dark:text-orange-400 font-semibold text-[11px] shrink-0 whitespace-nowrap">
            ({event.session_number}{event.total_sessions != null ? `/${event.total_sessions}` : ''})
          </span>
        )}
        <span className="ml-auto shrink-0">{getTypeBadge(event.event_type)}</span>
      </div>

      {/* Class code (de-emphasised) + this class's own time range */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {event.class_name ? (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {event.class_name}
          </p>
        ) : <span />}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">
          {event.start_time.substring(0, 5)}-{event.end_time.substring(0, 5)}
        </span>
      </div>

      {/* Teacher (avatar + name) + right info */}
      <div className="flex items-center justify-between gap-2 mt-1">
        {event.teacher_name ? (
          <TeacherBadge name={event.teacher_name} imageUrl={event.teacher_image} size="sm" />
        ) : <span />}

        {/* Regular class → enrolled count; makeup/trial → student name */}
        {event.event_type === 'class' && event.enrolled_count != null && (
          <span className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
            <Users className="h-3.5 w-3.5" />
            {event.enrolled_count}/{event.max_students}
          </span>
        )}
        {(event.event_type === 'makeup' || event.event_type === 'trial') && event.student_info && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs shrink-0 truncate max-w-[55%]',
              event.event_type === 'makeup' ? 'text-purple-600 dark:text-purple-300' : 'text-orange-600 dark:text-orange-300'
            )}
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.student_info}</span>
          </span>
        )}
      </div>
    </button>
  );
}

export default function DailyTimetable({ events, rooms, onEventClick }: DailyTimetableProps) {
  // Sort rooms by name
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.room_name.localeCompare(b.room_name));
  }, [rooms]);

  // Fixed 30-min time axis spanning the day's actual classes (earliest start →
  // latest end), snapped to the 30-min grid. Each row = one 30-min slot.
  const axis = useMemo(() => {
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const e of events) {
      minStart = Math.min(minStart, toMinutes(e.start_time));
      maxEnd = Math.max(maxEnd, toMinutes(e.end_time));
    }
    if (!isFinite(minStart)) return [] as number[];
    // Snap start down, end up to the 30-min grid so no class is clipped.
    const start = Math.floor(minStart / SLOT_MINUTES) * SLOT_MINUTES;
    const end = Math.ceil(maxEnd / SLOT_MINUTES) * SLOT_MINUTES;
    const slots: number[] = [];
    for (let t = start; t <= end; t += SLOT_MINUTES) slots.push(t);
    return slots;
  }, [events]);

  // Place each event: which slot index it starts on (snapped down) and how many
  // 30-min slots it spans (rowspan). Keyed by roomId so each column is independent.
  const placement = useMemo(() => {
    const axisStart = axis[0] ?? 0;
    // roomId -> Map(slotIndex -> events starting there)
    const byRoom = new Map<string, Map<number, { event: TimetableEvent; span: number }[]>>();
    // roomId -> Set(slotIndex) covered by an ongoing (spanning) event, so we skip rendering a cell there
    const covered = new Map<string, Set<number>>();

    for (const e of events) {
      const startIdx = Math.floor((toMinutes(e.start_time) - axisStart) / SLOT_MINUTES);
      const endIdx = Math.ceil((toMinutes(e.end_time) - axisStart) / SLOT_MINUTES);
      const span = Math.max(1, endIdx - startIdx);

      if (!byRoom.has(e.room_id)) byRoom.set(e.room_id, new Map());
      const slotMap = byRoom.get(e.room_id)!;
      if (!slotMap.has(startIdx)) slotMap.set(startIdx, []);
      slotMap.get(startIdx)!.push({ event: e, span });

      if (!covered.has(e.room_id)) covered.set(e.room_id, new Set());
      const covSet = covered.get(e.room_id)!;
      // Mark the slots AFTER the start as covered (the start cell is the rendered one).
      for (let i = startIdx + 1; i < startIdx + span; i++) covSet.add(i);
    }

    // Sort co-starting events in a cell by end time for stable order.
    for (const slotMap of byRoom.values()) {
      for (const list of slotMap.values()) {
        list.sort((a, b) => a.event.end_time.localeCompare(b.event.end_time));
      }
    }
    return { byRoom, covered };
  }, [events, axis]);

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
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 text-left w-[96px] min-w-[96px]">
                เวลา
              </th>
              {sortedRooms.map((room) => (
                <th
                  key={room.room_id}
                  className="border border-gray-200 dark:border-slate-700 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 text-center bg-gray-50 dark:bg-slate-800 min-w-[150px]"
                >
                  {room.room_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axis.map((slotMins, slotIdx) => (
              <tr key={slotMins}>
                {/* Time column — one label per 30-min slot */}
                <td
                  className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2 py-2 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap align-top"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="text-sm font-semibold">{fromMinutes(slotMins)}</span>
                </td>

                {/* Room columns */}
                {sortedRooms.map((room) => {
                  // Skip cells covered by a class that started in an earlier slot (rowspan).
                  if (placement.covered.get(room.room_id)?.has(slotIdx)) return null;

                  const starting = placement.byRoom.get(room.room_id)?.get(slotIdx) || [];

                  if (starting.length === 0) {
                    return (
                      <td
                        key={room.room_id}
                        className="border border-gray-200 dark:border-slate-700 p-1.5 align-top"
                      />
                    );
                  }

                  // All co-starting classes in this room share the same span visually;
                  // use the max span so the merged cell covers the longest one.
                  const rowSpan = Math.min(
                    Math.max(...starting.map((s) => s.span)),
                    axis.length - slotIdx
                  );

                  return (
                    <td
                      key={room.room_id}
                      rowSpan={rowSpan}
                      className="border border-gray-200 dark:border-slate-700 p-1.5 align-top h-0"
                    >
                      <div className="flex flex-col gap-1.5 h-full">
                        {starting.map(({ event }) => (
                          <div
                            key={event.schedule_id}
                            className={starting.length === 1 ? 'flex-1' : ''}
                          >
                            <EventCard event={event} onClick={() => onEventClick(event)} />
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

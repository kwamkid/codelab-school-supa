'use client';

import { useState, useEffect } from 'react';
import {
  AlertCircle, CheckCircle2, AlertTriangle,
  Clock, User, Users, Loader2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { FormSelect } from '@/components/ui/form-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Teacher, Room } from '@/types/models';
import { getActiveTeachers } from '@/lib/services/teachers';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import { checkAvailability, AvailabilityWarning } from '@/lib/utils/availability';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ScheduleFormData {
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  roomId: string;
}

interface MakeupScheduleFieldsProps {
  branchId: string;
  value: ScheduleFormData;
  onChange: (value: ScheduleFormData) => void;
  disabled?: boolean;
  excludeMakeupId?: string;
  /** teacherId ของคลาสเดิม เพื่อแสดง "(ครูประจำคลาส)" */
  originalTeacherId?: string;
  /** Calendar popover direction — use "up" inside modals to prevent overflow */
  popoverDirection?: 'up' | 'down';
}

export default function MakeupScheduleFields({
  branchId,
  value,
  onChange,
  disabled = false,
  excludeMakeupId,
  originalTeacherId,
  popoverDirection,
}: MakeupScheduleFieldsProps) {
  const { canAccessBranch } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityIssues, setAvailabilityIssues] = useState<{ type: string; message: string }[]>([]);
  const [availabilityWarnings, setAvailabilityWarnings] = useState<AvailabilityWarning[]>([]);

  // Load teachers and rooms when branchId changes
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    const loadData = async () => {
      if (!canAccessBranch(branchId)) return;
      setLoadingData(true);
      try {
        const [teachersData, roomsData] = await Promise.all([
          getActiveTeachers(),
          getActiveRoomsByBranch(branchId),
        ]);
        if (cancelled) return;
        const branchTeachers = teachersData.filter(t =>
          t.availableBranches.includes(branchId)
        );
        setTeachers(branchTeachers);
        setRooms(roomsData);
      } catch (error) {
        console.error('Error loading branch data:', error);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [branchId, canAccessBranch]);

  // Auto-set end time when start time changes
  useEffect(() => {
    if (value.startTime) {
      const [hours, minutes] = value.startTime.split(':').map(Number);
      const endHour = hours + 1;
      if (endHour < 24) {
        const newEndTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        if (newEndTime !== value.endTime) {
          onChange({ ...value, endTime: newEndTime });
        }
      }
    }
  }, [value.startTime]);

  // Check availability
  useEffect(() => {
    if (!value.date || !value.startTime || !value.endTime ||
        !value.teacherId || !value.roomId || !branchId) {
      setAvailabilityIssues([]);
      setAvailabilityWarnings([]);
      return;
    }

    setCheckingAvailability(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkAvailability({
          date: new Date(value.date),
          startTime: value.startTime,
          endTime: value.endTime,
          branchId,
          roomId: value.roomId,
          teacherId: value.teacherId,
          excludeId: excludeMakeupId,
          excludeType: 'makeup',
          allowConflicts: true,
        });
        setAvailabilityIssues(result.reasons);
        setAvailabilityWarnings(result.warnings || []);
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setCheckingAvailability(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value.date, value.startTime, value.endTime, value.teacherId, value.roomId, branchId, excludeMakeupId]);

  const update = (partial: Partial<ScheduleFormData>) => {
    onChange({ ...value, ...partial });
  };

  const getGroupedWarnings = () => {
    const roomWarnings = availabilityWarnings.filter(w => w.type === 'room_conflict');
    const teacherWarnings = availabilityWarnings.filter(w => w.type === 'teacher_conflict');
    return { roomWarnings, teacherWarnings };
  };

  const allFilled = value.date && value.startTime && value.endTime && value.teacherId && value.roomId;
  const hasHoliday = availabilityIssues.some(issue => issue.type === 'holiday');

  return (
    <div className="space-y-4">
      {/* Teacher and Room — first so date picker has room above for calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>ครูผู้สอน *</Label>
          <Select
            value={value.teacherId}
            onValueChange={(v) => update({ teacherId: v })}
            disabled={disabled || loadingData || teachers.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingData ? 'กำลังโหลด...' : 'เลือกครู'} />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.nickname || teacher.name}
                  {originalTeacherId && teacher.id === originalTeacherId && ' (ครูประจำคลาส)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ห้องเรียน *</Label>
          <Select
            value={value.roomId}
            onValueChange={(v) => update({ roomId: v })}
            disabled={disabled || loadingData || rooms.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingData ? 'กำลังโหลด...' : 'เลือกห้อง'} />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name} (จุ {room.capacity} คน)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date and Time — at bottom so popoverDirection="up" stays within modal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>วันที่นัด Makeup *</Label>
          <DateRangePicker
            mode="single"
            value={value.date}
            onChange={(date) => update({ date: date || '' })}
            minDate={new Date()}
            placeholder="เลือกวันที่"
            disabled={disabled}
            popoverDirection={popoverDirection}
          />
        </div>
        <div className="space-y-2">
          <Label>ช่วงเวลา *</Label>
          <TimeRangePicker
            startTime={value.startTime}
            endTime={value.endTime}
            onStartTimeChange={(v) => update({ startTime: v })}
            onEndTimeChange={(v) => update({ endTime: v })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Availability Status */}
      {checkingAvailability ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>กำลังตรวจสอบตารางเวลา...</AlertDescription>
        </Alert>
      ) : hasHoliday ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {availabilityIssues.find(issue => issue.type === 'holiday')?.message}
          </AlertDescription>
        </Alert>
      ) : availabilityWarnings.length > 0 ? (
        <div className="space-y-3">
          {(() => {
            const { roomWarnings, teacherWarnings } = getGroupedWarnings();
            return (
              <>
                {roomWarnings.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium text-amber-800">ห้องเรียนมีการใช้งานแล้ว:</p>
                        {roomWarnings.map((warning, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm text-amber-700">
                            {warning.details.conflictType === 'makeup' &&
                              warning.message.includes('คน') ? (
                              <Users className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            )}
                            <span>{warning.message}</span>
                          </div>
                        ))}
                        <p className="text-xs text-amber-600 mt-2">* สามารถจัด Makeup Class ร่วมกันได้</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                {teacherWarnings.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium text-amber-800">ครูมีคลาสอื่นในเวลานี้:</p>
                        {teacherWarnings.map((warning, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm text-amber-700">
                            <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{warning.message}</span>
                          </div>
                        ))}
                        <p className="text-xs text-amber-600 mt-2">* กรุณาพิจารณาเลือกครูท่านอื่น</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            );
          })()}
        </div>
      ) : allFilled ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            เวลานี้สามารถจัด Makeup Class ได้
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/** Helper: check if schedule has a holiday issue */
export function hasHolidayIssue(issues: { type: string }[]) {
  return issues.some(issue => issue.type === 'holiday');
}

// components/trial/reschedule-trial-dialog.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { Label } from '@/components/ui/label';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { TrialSession, Teacher, Branch, Room, Subject } from '@/types/models';
import { updateTrialSession, checkTrialRoomAvailability, rescheduleTrialSession, getTrialSessions } from '@/lib/services/trial-bookings';
import { getTeachers } from '@/lib/services/teachers';
import { getBranches } from '@/lib/services/branches';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { getSubjects } from '@/lib/services/subjects';
import { checkAvailabilityRpc as checkRoomAvailability } from '@/lib/utils/availability';
import { getClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

interface RescheduleTrialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  session: TrialSession;
  onSuccess: () => void;
}

export default function RescheduleTrialDialog({
  isOpen,
  onClose,
  session,
  onSuccess
}: RescheduleTrialDialogProps) {
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availabilityError, setAvailabilityError] = useState('');
  
  // Master data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // State สำหรับเก็บข้อมูล trial sessions ที่นัดในเวลาเดียวกัน
  const [existingTrials, setExistingTrials] = useState<any[]>([]);
  
  // Form state - initialize with current values
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(session.scheduledDate));
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  const [selectedTeacher, setSelectedTeacher] = useState(session.teacherId);
  const [selectedBranch, setSelectedBranch] = useState(session.branchId);
  const [selectedRoom, setSelectedRoom] = useState(session.roomId);

  // Load master data
  useEffect(() => {
    loadMasterData();
  }, []);

  // Load rooms when branch changes
  useEffect(() => {
    if (selectedBranch) {
      loadRooms(selectedBranch);
    } else {
      setRooms([]);
      setSelectedRoom('');
    }
  }, [selectedBranch]);

  // Auto-set end time when start time changes
  useEffect(() => {
    if (startTime && startTime !== session.startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHour = hours + 1; // 1 hour session
      const endMinutes = minutes.toString().padStart(2, '0');
      setEndTime(`${endHour.toString().padStart(2, '0')}:${endMinutes}`);
    }
  }, [startTime, session.startTime]);

  // Track if user has changed any field from original values
  const hasChanged = React.useMemo(() => {
    const origDate = new Date(session.scheduledDate).toDateString();
    const currDate = selectedDate?.toDateString();
    return (
      currDate !== origDate ||
      startTime !== session.startTime ||
      endTime !== session.endTime ||
      selectedTeacher !== session.teacherId ||
      selectedRoom !== session.roomId
    );
  }, [selectedDate, startTime, endTime, selectedTeacher, selectedRoom, session]);

  // Check availability only after user changes something
  useEffect(() => {
    if (!hasChanged) {
      setAvailabilityError('');
      setExistingTrials([]);
      return;
    }
    if (selectedDate && startTime && endTime && selectedBranch && selectedRoom) {
      checkAvailability();
      checkExistingTrials();
    }
  }, [hasChanged, selectedDate, startTime, endTime, selectedRoom, selectedTeacher]);

  // ฟังก์ชันตรวจสอบ trial sessions ที่มีอยู่แล้ว
  const checkExistingTrials = async () => {
    try {
      const allTrials = await getTrialSessions();
      
      const matchingTrials = allTrials.filter(trial =>
        trial.status === 'scheduled' &&
        trial.branchId === selectedBranch &&
        trial.roomId === selectedRoom &&
        new Date(trial.scheduledDate).toDateString() === selectedDate.toDateString() &&
        trial.startTime === startTime &&
        trial.endTime === endTime &&
        trial.id !== session.id // ไม่นับตัวเอง
      );
      
      setExistingTrials(matchingTrials);
    } catch (error) {
      console.error('Error checking existing trials:', error);
    }
  };

  const loadMasterData = async () => {
    try {
      const [subjectsData, teachersData, branchesData] = await Promise.all([
        getSubjects(),
        getTeachers(),
        getBranches()
      ]);
      
      setSubjects(subjectsData.filter(s => s.isActive));
      setTeachers(teachersData.filter(t => t.isActive));
      setBranches(branchesData.filter(b => b.isActive));
      
      // Load initial rooms for current branch
      if (session.branchId) {
        const roomsData = await getRoomsByBranch(session.branchId);
        setRooms(roomsData.filter(r => r.isActive));
      }
    } catch (error) {
      console.error('Error loading master data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
  };

  const loadRooms = async (branchId: string) => {
    try {
      const data = await getRoomsByBranch(branchId);
      setRooms(data.filter(r => r.isActive));
      
      // If current room is not in new branch, clear selection
      if (!data.find(r => r.id === selectedRoom)) {
        setSelectedRoom('');
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('ไม่สามารถโหลดข้อมูลห้องได้');
    }
  };

  const checkAvailability = async () => {
    if (!selectedDate || !startTime || !endTime || !selectedBranch || !selectedRoom) {
      return;
    }

    setCheckingAvailability(true);
    setAvailabilityError('');

    try {
      const result = await checkRoomAvailability({
        date: selectedDate,
        startTime,
        endTime,
        branchId: selectedBranch,
        roomId: selectedRoom,
        teacherId: selectedTeacher,
        excludeId: session.id,
        excludeType: 'trial'
      });

      if (!result.available && result.reasons.length > 0) {
        // กรองเฉพาะ conflicts ที่ไม่ใช่ trial (เพราะอนุญาตให้ trial หลายคนในเวลาเดียวกันได้)
        const nonTrialConflicts = result.reasons.filter(reason => 
          reason.details?.conflictType !== 'trial'
        );
        
        if (nonTrialConflicts.length > 0) {
          const conflictMessages = nonTrialConflicts.map(reason => reason.message);
          setAvailabilityError(conflictMessages.join(', '));
        }
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Filter teachers based on selected subject and branch
  const getAvailableTeachers = () => {
    return teachers.filter(teacher => 
      teacher.specialties.includes(session.subjectId) &&
      teacher.availableBranches.includes(selectedBranch)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!selectedDate) {
      toast.error('กรุณาเลือกวันที่');
      return;
    }
    if (!startTime || !endTime) {
      toast.error('กรุณาระบุเวลา');
      return;
    }
    if (!selectedTeacher) {
      toast.error('กรุณาเลือกครู');
      return;
    }
    if (!selectedBranch || !selectedRoom) {
      toast.error('กรุณาเลือกสาขาและห้อง');
      return;
    }
    if (availabilityError) {
      toast.error('ห้องไม่ว่างในช่วงเวลาที่เลือก');
      return;
    }

    setLoading(true);

    try {
      // Get room name for storing
      const selectedRoomData = rooms.find(r => r.id === selectedRoom);

      const supabase = getClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      await rescheduleTrialSession(
        session.id,
        {
          scheduledDate: selectedDate,
          startTime,
          endTime,
          teacherId: selectedTeacher,
          branchId: selectedBranch,
          roomId: selectedRoom,
          roomName: selectedRoomData?.name || selectedRoom
        },
        'ไม่มาเรียนตามนัดเดิม', // reason
        currentUser?.id || 'admin' // rescheduledBy
      );

      toast.success('เปลี่ยนนัดหมายสำเร็จ');
      
      // Clear URL parameters before calling onSuccess
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      url.searchParams.delete('sessionId');
      window.history.replaceState({}, '', url.toString());
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนนัดหมาย');
    } finally {
      setLoading(false);
    }
  };

  // Get current subject info
  const currentSubject = subjects.find(s => s.id === session.subjectId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>เปลี่ยนนัดหมายทดลองเรียน</DialogTitle>
          <DialogDescription>เลือกวันที่ เวลา ครู และห้องเรียนใหม่สำหรับนัดหมายทดลอง</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Info */}
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span><strong>นัดหมายเดิม:</strong> {formatDate(session.scheduledDate, 'long')} เวลา {session.startTime?.slice(0, 5)} - {session.endTime?.slice(0, 5)}</span>
          </p>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>วันที่</Label>
              <DateRangePicker
                mode="single"
                value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                onChange={(date) => setSelectedDate(date ? new Date(date) : undefined)}
                minDate={new Date()}
                placeholder="เลือกวันที่"
              />
            </div>

            <div className="space-y-2">
              <Label>เวลา</Label>
              <TimeRangePicker
                startTime={startTime}
                endTime={endTime}
                onStartTimeChange={setStartTime}
                onEndTimeChange={setEndTime}
              />
            </div>
          </div>

          {/* Teacher & Room */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>เลือกครู</Label>
              <FormSelect
                value={selectedTeacher}
                onValueChange={setSelectedTeacher}
                placeholder="เลือกครู"
                options={getAvailableTeachers().map((teacher) => ({
                  value: teacher.id,
                  label: teacher.nickname || teacher.name,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>ห้องเรียน</Label>
              <FormSelect
                value={selectedRoom}
                onValueChange={setSelectedRoom}
                disabled={!selectedBranch || rooms.length === 0}
                placeholder={
                  !selectedBranch ? "เลือกสาขาก่อน" :
                  rooms.length === 0 ? "ไม่มีห้อง" :
                  "เลือกห้อง"
                }
                options={rooms.map((room) => ({
                  value: room.id,
                  label: `${room.name} (จุ ${room.capacity} คน)`,
                }))}
              />
            </div>
          </div>

          {availabilityError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{availabilityError}</AlertDescription>
            </Alert>
          )}

          {/* แสดงรายชื่อนักเรียนที่นัดในช่วงเวลาเดียวกัน */}
          {existingTrials.length > 0 && !availabilityError && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="text-blue-800">
                  <p className="font-medium mb-2">มีนักเรียน {existingTrials.length} คนนัดทดลองเรียนในช่วงเวลานี้แล้ว</p>
                  <div className="space-y-1">
                    {existingTrials.map((trial, index) => {
                      const trialSubject = subjects.find(s => s.id === trial.subjectId);
                      return (
                        <div key={trial.id} className="flex items-center gap-2 text-sm">
                          <span className="text-blue-600">{index + 1}.</span>
                          <span className="font-medium">{trial.studentName}</span>
                          <span className="text-blue-600">ทดลองวิชา</span>
                          <Badge 
                            className="text-xs"
                            style={{ 
                              backgroundColor: trialSubject?.color || '#3B82F6',
                              color: 'white',
                              border: 'none'
                            }}
                          >
                            {trialSubject?.name || 'ไม่ระบุวิชา'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            {hasChanged && selectedDate && startTime && endTime && selectedRoom && (
              <p className="text-xs mr-auto">
                {checkingAvailability ? (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    กำลังตรวจสอบ...
                  </span>
                ) : availabilityError ? (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3 w-3" />
                    ห้องไม่ว่าง
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    ห้องว่าง
                  </span>
                )}
              </p>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={loading || !!availabilityError || checkingAvailability}
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'เลื่อนนัด'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// components/trial/trial-session-dialog.tsx

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormSelect } from '@/components/ui/form-select';
import { TimeRangePicker } from '@/components/ui/time-range-picker';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Subject, Teacher, Branch, Room } from '@/types/models';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { createTrialSession } from '@/lib/services/trial-bookings';
import { AvailabilityIssue } from '@/lib/utils/availability';

interface TrialSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingBranchId?: string;
  students: Array<{
    name: string;
    schoolName?: string;
    gradeLevel?: string;
    subjectInterests: string[];
  }>;
  subjects: Subject[];
  teachers: Teacher[];
  branches: Branch[];
  onSuccess: () => void;
  defaultStudent?: string;
}

export default function TrialSessionDialog({
  isOpen,
  onClose,
  bookingId,
  bookingBranchId,
  students,
  subjects: initialSubjects,
  teachers: initialTeachers,
  branches: initialBranches,
  onSuccess,
  defaultStudent
}: TrialSessionDialogProps) {
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [teachers] = useState<Teacher[]>(initialTeachers);
  const [subjects] = useState<Subject[]>(initialSubjects);
  const [branches] = useState<Branch[]>(initialBranches);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityIssues, setAvailabilityIssues] = useState<AvailabilityIssue[]>([]);
  const [existingTrialsCount, setExistingTrialsCount] = useState<number>(0);
  const [existingTrials, setExistingTrials] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    subjectId: '',
    scheduledDate: '',
    startTime: '10:00',
    endTime: '11:00',
    teacherId: '',
    branchId: '',
    roomId: '',
  });

  const currentStudent = useMemo(
    () => students.find(s => s.name === selectedStudent),
    [students, selectedStudent]
  );

  // Auto-select student and reset form when dialog opens
  useEffect(() => {
    if (isOpen && students.length > 0) {
      setSelectedStudent(defaultStudent || students[0].name);
      setFormData({
        subjectId: '',
        scheduledDate: '',
        startTime: '10:00',
        endTime: '11:00',
        teacherId: '',
        branchId: bookingBranchId || '',
        roomId: '',
      });
      setAvailabilityIssues([]);
      setExistingTrialsCount(0);
      setExistingTrials([]);
    }
  }, [isOpen, bookingBranchId]);

  // Load rooms when branch changes
  useEffect(() => {
    const loadRooms = async () => {
      if (!formData.branchId) {
        setRooms([]);
        return;
      }

      try {
        const roomsData = await getRoomsByBranch(formData.branchId);
        setRooms(roomsData.filter(r => r.isActive));

        if (!roomsData.some(r => r.id === formData.roomId)) {
          setFormData(prev => ({ ...prev, roomId: '' }));
        }
      } catch (error) {
        console.error('Error loading rooms:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลห้อง');
      }
    };

    loadRooms();
  }, [formData.branchId]);

  // Auto-set end time when start time changes
  useEffect(() => {
    if (formData.startTime) {
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      const endHour = hours + 1;
      const endMinutes = minutes.toString().padStart(2, '0');
      const newEndTime = `${endHour.toString().padStart(2, '0')}:${endMinutes}`;

      if (endHour < 24) {
        setFormData(prev => ({ ...prev, endTime: newEndTime }));
      }
    }
  }, [formData.startTime]);

  // Check availability when relevant fields change
  useEffect(() => {
    const checkAvailabilityFn = async () => {
      if (!formData.scheduledDate || !formData.startTime || !formData.endTime ||
          !formData.branchId || !formData.roomId || !formData.teacherId) {
        setAvailabilityIssues([]);
        return;
      }

      setCheckingAvailability(true);
      try {
        const { checkAvailability } = await import('@/lib/utils/availability');

        const result = await checkAvailability({
          date: new Date(formData.scheduledDate),
          startTime: formData.startTime,
          endTime: formData.endTime,
          branchId: formData.branchId,
          roomId: formData.roomId,
          teacherId: formData.teacherId,
          excludeType: 'trial'
        });

        if (!result.available) {
          setAvailabilityIssues(result.reasons);
        } else {
          setAvailabilityIssues([]);
        }
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setCheckingAvailability(false);
      }
    };

    const debounceTimer = setTimeout(checkAvailabilityFn, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData]);

  // Check existing trials that overlap with selected time slot
  useEffect(() => {
    const checkExistingTrials = async () => {
      if (!formData.scheduledDate || !formData.startTime || !formData.endTime ||
          !formData.branchId || !formData.roomId) {
        setExistingTrialsCount(0);
        setExistingTrials([]);
        return;
      }

      try {
        const { getTrialSessions } = await import('@/lib/services/trial-bookings');
        const allTrials = await getTrialSessions(formData.branchId);

        // Check time overlap (not just exact match)
        const matchingTrials = allTrials.filter(trial => {
          if (trial.status !== 'scheduled') return false;
          if (trial.roomId !== formData.roomId) return false;
          if (new Date(trial.scheduledDate).toDateString() !== new Date(formData.scheduledDate).toDateString()) return false;
          // Time overlap: startA < endB && endA > startB
          return trial.startTime < formData.endTime && trial.endTime > formData.startTime;
        });

        setExistingTrialsCount(matchingTrials.length);
        setExistingTrials(matchingTrials);
      } catch (error) {
        console.error('Error checking existing trials:', error);
      }
    };

    checkExistingTrials();
  }, [formData.scheduledDate, formData.startTime, formData.endTime, formData.branchId, formData.roomId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ref-based guard to prevent double-submit (state update is async)
    if (submittingRef.current) return;

    if (!formData.subjectId || !formData.scheduledDate || !formData.startTime ||
        !formData.endTime || !formData.teacherId || !formData.branchId || !formData.roomId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (availabilityIssues.length > 0) {
      toast.error('ไม่สามารถจองได้ เนื่องจากมีปัญหาความพร้อมใช้งาน');
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const selectedRoom = rooms.find(r => r.id === formData.roomId);

      await createTrialSession({
        bookingId,
        studentName: selectedStudent,
        subjectId: formData.subjectId,
        scheduledDate: new Date(formData.scheduledDate),
        startTime: formData.startTime,
        endTime: formData.endTime,
        teacherId: formData.teacherId,
        branchId: formData.branchId,
        roomId: formData.roomId,
        roomName: selectedRoom?.name,
        status: 'scheduled'
      });

      toast.success('นัดหมายทดลองเรียนสำเร็จ');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating trial session:', error);
      toast.error('เกิดข้อผิดพลาดในการนัดหมาย');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // Filter teachers based on subject and branch
  const getAvailableTeachers = () => {
    return teachers.filter(teacher =>
      (!formData.subjectId || teacher.specialties.includes(formData.subjectId)) &&
      (!formData.branchId || teacher.availableBranches.includes(formData.branchId))
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>นัดหมายทดลองเรียน</DialogTitle>
        </DialogHeader>

        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            ไม่มีนักเรียนที่รอนัดหมาย
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Student pill tabs (multiple students only) */}
            {students.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {students.map((student, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(student.name);
                      setFormData({
                        subjectId: '',
                        scheduledDate: '',
                        startTime: '10:00',
                        endTime: '11:00',
                        teacherId: '',
                        branchId: bookingBranchId || '',
                        roomId: '',
                      });
                      setAvailabilityIssues([]);
                      setExistingTrialsCount(0);
                      setExistingTrials([]);
                    }}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-full border transition-colors",
                      selectedStudent === student.name
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {student.name}
                  </button>
                ))}
              </div>
            )}

            {/* Compact student info header */}
            {currentStudent && (
              <div className="pb-3 border-b">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-base">{selectedStudent}</span>
                  {currentStudent.schoolName && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">{currentStudent.schoolName}</span>
                    </>
                  )}
                  {currentStudent.gradeLevel && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">{currentStudent.gradeLevel}</span>
                    </>
                  )}
                </div>
                {currentStudent.subjectInterests.length > 0 && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-sm text-amber-600 font-medium">สนใจ:</span>
                    {currentStudent.subjectInterests.map(subjectId => {
                      const subject = subjects.find(s => s.id === subjectId);
                      return subject ? (
                        <Badge
                          key={subjectId}
                          variant="outline"
                          className="text-sm"
                          style={{
                            backgroundColor: `${subject.color}15`,
                            color: subject.color,
                            borderColor: `${subject.color}40`,
                          }}
                        >
                          {subject.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Form fields */}
            <div className="space-y-3">
              {/* Row 1: Branch and Subject */}
              <div className={bookingBranchId ? '' : 'grid grid-cols-2 gap-3'}>
                {!bookingBranchId && (
                  <div className="space-y-1.5">
                    <Label>สาขา *</Label>
                    <FormSelect
                      value={formData.branchId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, branchId: value, subjectId: '' }))}
                      placeholder="เลือกสาขา"
                      options={branches.map((branch) => ({
                        value: branch.id,
                        label: branch.name,
                      }))}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>วิชา *</Label>
                  <FormSelect
                    value={formData.subjectId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, subjectId: value }))}
                    disabled={!formData.branchId}
                    placeholder={formData.branchId ? "เลือกวิชา" : "เลือกสาขาก่อน"}
                    options={subjects.map((s) => ({
                      value: s.id,
                      label: s.name,
                      color: s.color,
                    }))}
                  />
                </div>
              </div>

              {/* Row 2: Date and Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>วันที่ *</Label>
                  <DateRangePicker
                    mode="single"
                    value={formData.scheduledDate}
                    onChange={(date) => setFormData(prev => ({ ...prev, scheduledDate: date || '' }))}
                    minDate={new Date()}
                    placeholder="เลือกวันที่"
                    disabled={!formData.branchId}
                    popoverDirection="up"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>เวลา *</Label>
                  <TimeRangePicker
                    startTime={formData.startTime}
                    endTime={formData.endTime}
                    onStartTimeChange={(v) => setFormData(prev => ({ ...prev, startTime: v }))}
                    onEndTimeChange={(v) => setFormData(prev => ({ ...prev, endTime: v }))}
                    disabled={!formData.branchId}
                  />
                </div>
              </div>

              {/* Row 3: Teacher and Room */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ครูผู้สอน *</Label>
                  <FormSelect
                    value={formData.teacherId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, teacherId: value }))}
                    disabled={!formData.branchId}
                    placeholder={formData.branchId ? "เลือกครู" : "เลือกสาขาก่อน"}
                    options={getAvailableTeachers().map((teacher) => ({
                      value: teacher.id,
                      label: teacher.nickname || teacher.name,
                    }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>ห้องเรียน *</Label>
                  <FormSelect
                    value={formData.roomId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value }))}
                    disabled={!formData.branchId}
                    placeholder={formData.branchId ? "เลือกห้อง" : "เลือกสาขาก่อน"}
                    options={rooms.map((room) => ({
                      value: room.id,
                      label: `${room.name} (จุ ${room.capacity} คน)`,
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Existing trials in same time slot */}
            {existingTrialsCount > 0 && (() => {
              const selectedRoom = rooms.find(r => r.id === formData.roomId);
              const capacity = selectedRoom?.capacity || 0;
              const isFull = capacity > 0 && existingTrialsCount >= capacity;
              return (
                <Alert className={cn(
                  isFull ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
                )}>
                  <Info className={cn('h-4 w-4', isFull ? 'text-amber-600' : 'text-blue-600')} />
                  <AlertDescription>
                    <div className={isFull ? 'text-amber-800' : 'text-blue-800'}>
                      <p className="font-medium mb-1">
                        มีนัดทดลองเรียนในช่วงเวลานี้แล้ว {existingTrialsCount} คน
                        {capacity > 0 && ` / ห้องจุ ${capacity} คน`}
                        {isFull && ' (เต็ม)'}
                      </p>
                      <div className="space-y-0.5">
                        {existingTrials.map((trial, index) => {
                          const trialSubject = subjects.find(s => s.id === trial.subjectId);
                          return (
                            <div key={trial.id} className="flex items-center gap-2 text-sm">
                              <span className={isFull ? 'text-amber-600' : 'text-blue-600'}>{index + 1}.</span>
                              <span className="font-medium">{trial.studentName}</span>
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
                              <span className="text-xs opacity-70">{trial.startTime?.slice(0, 5)}-{trial.endTime?.slice(0, 5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })()}

            {/* Availability Check */}
            {checkingAvailability ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>กำลังตรวจสอบห้องว่าง...</AlertDescription>
              </Alert>
            ) : availabilityIssues.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">ไม่สามารถจองเวลานี้ได้:</p>
                    {availabilityIssues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              formData.scheduledDate && formData.startTime && formData.endTime &&
              formData.branchId && formData.roomId && formData.teacherId && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    เวลานี้สามารถจองได้
                  </AlertDescription>
                </Alert>
              )
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={
                  loading || checkingAvailability || availabilityIssues.length > 0 ||
                  !formData.subjectId || !formData.scheduledDate || !formData.startTime ||
                  !formData.endTime || !formData.teacherId || !formData.branchId || !formData.roomId
                }
                className="bg-red-500 hover:bg-red-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  'จัดตารางเรียน'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

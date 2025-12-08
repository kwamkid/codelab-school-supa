// components/trial/trial-session-dialog.tsx

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SubjectSearchSelect from '@/components/ui/subject-search-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  User,
  School,
  GraduationCap,
  ArrowLeft,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Subject, Teacher, Branch, Room } from '@/types/models';
import { getTeachers } from '@/lib/services/teachers';
import { getSubjects } from '@/lib/services/subjects';
import { getBranches } from '@/lib/services/branches';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { createTrialSession } from '@/lib/services/trial-bookings';
import { AvailabilityIssue } from '@/lib/utils/availability';

interface TrialSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
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
}

export default function TrialSessionDialog({
  isOpen,
  onClose,
  bookingId,
  students,
  subjects: initialSubjects,
  teachers: initialTeachers,
  branches: initialBranches,
  onSuccess
}: TrialSessionDialogProps) {
  // State for student selection
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [showStudentSelect, setShowStudentSelect] = useState(true);
  
  // State for form
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityIssues, setAvailabilityIssues] = useState<AvailabilityIssue[]>([]);
  
  // เพิ่ม state สำหรับนับจำนวนนักเรียนที่นัดในช่วงเวลาเดียวกัน
  const [existingTrialsCount, setExistingTrialsCount] = useState<number>(0);
  const [existingTrials, setExistingTrials] = useState<any[]>([]);
  
  // Form data
  const [formData, setFormData] = useState({
    subjectId: '',
    scheduledDate: '',
    startTime: '10:00',
    endTime: '11:00',
    teacherId: '',
    branchId: '',
    roomId: '',
  });

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
        
        // Reset room selection if not in new branch
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
      const endHour = hours + 1; // Default 1 hour session
      const endMinutes = minutes.toString().padStart(2, '0');
      const newEndTime = `${endHour.toString().padStart(2, '0')}:${endMinutes}`;
      
      // Only update if it's a valid time
      if (endHour < 24) {
        setFormData(prev => ({ ...prev, endTime: newEndTime }));
      }
    }
  }, [formData.startTime]);

  // Check availability when relevant fields change
  useEffect(() => {
    const checkAvailability = async () => {
      if (!formData.scheduledDate || !formData.startTime || !formData.endTime || 
          !formData.branchId || !formData.roomId || !formData.teacherId) {
        setAvailabilityIssues([]);
        return;
      }

      setCheckingAvailability(true);
      try {
        // Use the centralized availability checker
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

    const debounceTimer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData]);

  // เพิ่ม useEffect สำหรับนับจำนวนนักเรียนที่นัดในช่วงเวลาเดียวกัน
  useEffect(() => {
    const checkExistingTrials = async () => {
      if (!formData.scheduledDate || !formData.startTime || !formData.endTime || 
          !formData.branchId || !formData.roomId) {
        setExistingTrialsCount(0);
        setExistingTrials([]);
        return;
      }
      
      try {
        // นับจำนวน trial sessions ในช่วงเวลาเดียวกัน
        const { getTrialSessions } = await import('@/lib/services/trial-bookings');
        const allTrials = await getTrialSessions();
        
        const matchingTrials = allTrials.filter(trial =>
          trial.status === 'scheduled' &&
          trial.branchId === formData.branchId &&
          trial.roomId === formData.roomId &&
          new Date(trial.scheduledDate).toDateString() === new Date(formData.scheduledDate).toDateString() &&
          trial.startTime === formData.startTime &&
          trial.endTime === formData.endTime
        );
        
        setExistingTrialsCount(matchingTrials.length);
        setExistingTrials(matchingTrials);
      } catch (error) {
        console.error('Error checking existing trials:', error);
      }
    };
    
    checkExistingTrials();
  }, [formData.scheduledDate, formData.startTime, formData.endTime, formData.branchId, formData.roomId]);

  const handleStudentSelect = (studentName: string) => {
    setSelectedStudent(studentName);
    setShowStudentSelect(false);
  };

  const handleBack = () => {
    setSelectedStudent('');
    setShowStudentSelect(true);
    // Reset form
    setFormData({
      subjectId: '',
      scheduledDate: '',
      startTime: '10:00',
      endTime: '11:00',
      teacherId: '',
      branchId: '',
      roomId: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.subjectId || !formData.scheduledDate || !formData.startTime || 
        !formData.endTime || !formData.teacherId || !formData.branchId || !formData.roomId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (availabilityIssues.length > 0) {
      toast.error('ไม่สามารถจองได้ เนื่องจากมีปัญหาความพร้อมใช้งาน');
      return;
    }

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
      
      // Reset state
      handleBack();
    } catch (error) {
      console.error('Error creating trial session:', error);
      toast.error('เกิดข้อผิดพลาดในการนัดหมาย');
    } finally {
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
    <Dialog open={isOpen} onOpenChange={() => {
      onClose();
      handleBack();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นัดหมายทดลองเรียน</DialogTitle>
        </DialogHeader>
        
        {showStudentSelect && students.length > 0 ? (
          // Student Selection Screen
          <div className="space-y-4">
            <p className="text-sm text-gray-600">เลือกนักเรียนที่ต้องการนัดหมาย:</p>
            <div className="grid gap-3">
              {students.map((student, idx) => (
                <button
                  key={idx}
                  onClick={() => handleStudentSelect(student.name)}
                  className="p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="font-medium">{student.name}</div>
                  {student.schoolName && (
                    <div className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <School className="h-3 w-3" />
                      {student.schoolName}
                      {student.gradeLevel && ` (${student.gradeLevel})`}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {student.subjectInterests.map(subjectId => {
                      const subject = subjects.find(s => s.id === subjectId);
                      return subject ? (
                        <Badge 
                          key={subjectId} 
                          className="text-xs"
                          style={{ 
                            backgroundColor: `${subject.color}20`,
                            color: subject.color,
                            borderColor: subject.color
                          }}
                        >
                          {subject.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : selectedStudent ? (
          // Trial Session Form
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Back button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>

            {/* Student Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">นักเรียน:</p>
              <p className="font-medium text-lg">{selectedStudent}</p>
              {/* แสดงวิชาที่สนใจ */}
              {(() => {
                const currentStudent = students.find(s => s.name === selectedStudent);
                if (currentStudent && currentStudent.subjectInterests.length > 0) {
                  return (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-1">วิชาที่สนใจ:</p>
                      <div className="flex flex-wrap gap-1">
                        {currentStudent.subjectInterests.map(subjectId => {
                          const subject = subjects.find(s => s.id === subjectId);
                          return subject ? (
                            <Badge 
                              key={subjectId} 
                              className="text-xs"
                              style={{ 
                                backgroundColor: `${subject.color}20`,
                                color: subject.color,
                                borderColor: subject.color
                              }}
                            >
                              {subject.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="space-y-4">
              {/* Row 1: Branch and Subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branch */}
                <div className="space-y-2">
                  <Label htmlFor="branch">สาขา *</Label>
                  <Select
                    value={formData.branchId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, branchId: value, subjectId: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขา" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">วิชา *</Label>
                  <SubjectSearchSelect
                    subjects={subjects}
                    value={formData.subjectId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, subjectId: value }))}
                    disabled={!formData.branchId}
                    required
                    placeholder={formData.branchId ? "ค้นหาวิชา..." : "เลือกสาขาก่อน"}
                  />
                </div>
              </div>

              {/* Row 2: Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">วันที่ทดลองเรียน *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                {/* Time Range */}
                <div className="space-y-2">
                  <Label>ช่วงเวลา *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      step="300" // 5 minute intervals
                      required
                    />
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      step="300" // 5 minute intervals
                      min={formData.startTime}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Teacher and Room */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Teacher */}
                <div className="space-y-2">
                  <Label htmlFor="teacher">ครูผู้สอน *</Label>
                  <Select
                    value={formData.teacherId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, teacherId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกครู" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTeachers().length === 0 ? (
                        <div className="p-2 text-sm text-gray-500 text-center">
                          ไม่มีครูที่สอนวิชานี้ในสาขาที่เลือก
                        </div>
                      ) : (
                        getAvailableTeachers().map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.nickname || teacher.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Room */}
                <div className="space-y-2">
                  <Label htmlFor="room">ห้องเรียน *</Label>
                  <Select
                    value={formData.roomId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value }))}
                    disabled={!formData.branchId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.branchId ? "เลือกห้อง" : "เลือกสาขาก่อน"} />
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
            </div>

            {/* แสดงจำนวนนักเรียนที่นัดในช่วงเวลาเดียวกัน */}
            {existingTrialsCount > 0 && (
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <div className="text-blue-800">
                    <p className="font-medium mb-2">มีนักเรียน {existingTrialsCount} คนนัดทดลองเรียนในช่วงเวลานี้แล้ว</p>
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

            {/* Availability Check Result */}
            {checkingAvailability ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  กำลังตรวจสอบห้องว่าง...
                </AlertDescription>
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
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  handleBack();
                }}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit" 
                disabled={loading || checkingAvailability || availabilityIssues.length > 0}
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
        ) : (
          // No students
          <div className="text-center py-8 text-gray-500">
            ไม่มีนักเรียนที่รอนัดหมาย
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
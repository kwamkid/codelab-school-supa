'use client';

import { useState, useEffect } from 'react';
import { MakeupClass, Student, Class, Teacher, Room } from '@/types/models';
import { scheduleMakeupClass } from '@/lib/services/makeup';
import { getActiveTeachers } from '@/lib/services/teachers';
import { getActiveRoomsByBranch } from '@/lib/services/rooms';
import { checkAvailability, AvailabilityWarning } from '@/lib/utils/availability';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, User, MapPin, Save, X, AlertCircle, CalendarDays, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from '@/components/ui/alert';
// Firebase auth removed - using useAuth hook instead
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';

interface EditMakeupScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  makeup: MakeupClass;
  student: Student & { parentName: string; parentPhone: string };
  classInfo: Class;
  onUpdated: () => void;
}

export default function EditMakeupScheduleDialog({
  open,
  onOpenChange,
  makeup,
  student,
  classInfo,
  onUpdated
}: EditMakeupScheduleDialogProps) {
  const { user, adminUser, canAccessBranch } = useAuth();
  const { selectedBranchId, isAllBranches } = useBranch();
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [availabilityWarnings, setAvailabilityWarnings] = useState<AvailabilityWarning[]>([]);
  
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    teacherId: '',
    roomId: '',
  });
  
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (open && makeup.makeupSchedule) {
      // Check access
      if (!canAccessBranch(classInfo.branchId)) {
        toast.error('คุณไม่มีสิทธิ์แก้ไขตาราง Makeup ในสาขานี้');
        onOpenChange(false);
        return;
      }

      // Set initial values from current schedule
      const schedule = makeup.makeupSchedule;
      setFormData({
        date: new Date(schedule.date).toISOString().split('T')[0],
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        teacherId: schedule.teacherId,
        roomId: schedule.roomId
      });
      loadData();
    }
  }, [open, makeup, classInfo.branchId, canAccessBranch]);

  useEffect(() => {
    // Check availability when form data changes
    if (formData.date && formData.startTime && formData.endTime && 
        formData.teacherId && formData.roomId && hasChanged()) {
      checkFormAvailability();
    }
  }, [formData]);

  const loadData = async () => {
    try {
      const [teachersData, roomsData] = await Promise.all([
        getActiveTeachers(),
        getActiveRoomsByBranch(classInfo.branchId)
      ]);
      
      // Filter teachers who can teach at this branch
      const branchTeachers = teachersData.filter(t => 
        t.availableBranches.includes(classInfo.branchId)
      );
      
      setTeachers(branchTeachers);
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
  };

  const checkFormAvailability = async () => {
    if (!formData.date || !formData.startTime || !formData.endTime || 
        !formData.teacherId || !formData.roomId) return;
    
    setCheckingAvailability(true);
    setAvailabilityMessage('');
    setAvailabilityWarnings([]);
    
    try {
      const date = new Date(formData.date);
      const result = await checkAvailability({
        date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        branchId: classInfo.branchId,
        roomId: formData.roomId,
        teacherId: formData.teacherId,
        excludeId: makeup.id,
        excludeType: 'makeup',
        allowConflicts: true // เพิ่ม flag นี้
      });
      
      setIsAvailable(result.available);
      setAvailabilityWarnings(result.warnings || []);
      
      // Check for holiday issue
      const holidayIssue = result.reasons.find(r => r.type === 'holiday');
      if (holidayIssue) {
        setIsAvailable(false);
        setAvailabilityMessage(holidayIssue.message);
      } else {
        setAvailabilityMessage('');
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setIsAvailable(null);
      setAvailabilityMessage('ไม่สามารถตรวจสอบได้');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.date || !formData.startTime || !formData.endTime || 
        !formData.teacherId || !formData.roomId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    
    if (!changeReason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่เปลี่ยนแปลง');
      return;
    }
    
    if (isAvailable === false && availabilityMessage.includes('วันหยุด')) {
      toast.error('ไม่สามารถจัด Makeup Class ในวันหยุดได้');
      return;
    }
    
    // ถ้ามี warnings ให้แสดงข้อความยืนยัน
    if (availabilityWarnings.length > 0) {
      const confirmMessage = `มีคลาส/กิจกรรมอื่นในช่วงเวลานี้:\n${availabilityWarnings.map(w => `- ${w.message}`).join('\n')}\n\nคุณต้องการเปลี่ยนวันนัด Makeup Class หรือไม่?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    if (!user) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }

    setLoading(true);
    try {
      // Update makeup schedule with reason in notes
      const currentNotes = makeup.notes || '';
      const updateNote = `[${formatDate(new Date(), 'short')}] เปลี่ยนวันนัด: ${changeReason}`;

      await scheduleMakeupClass(makeup.id, {
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        teacherId: formData.teacherId,
        branchId: classInfo.branchId,
        roomId: formData.roomId,
        confirmedBy: user.uid
      });
      
      // TODO: Update notes with change reason
      
      toast.success('เปลี่ยนวันนัด Makeup Class เรียบร้อยแล้ว');
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('ไม่สามารถเปลี่ยนวันนัดได้');
    } finally {
      setLoading(false);
    }
  };

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher?.nickname || teacher?.name || 'Unknown';
  };

  const getRoomName = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    return room?.name || 'Unknown';
  };

  const hasChanged = () => {
    if (!makeup.makeupSchedule) return false;
    const schedule = makeup.makeupSchedule;
    
    return formData.date !== new Date(schedule.date).toISOString().split('T')[0] ||
           formData.startTime !== schedule.startTime ||
           formData.endTime !== schedule.endTime ||
           formData.teacherId !== schedule.teacherId ||
           formData.roomId !== schedule.roomId;
  };

  // Helper function to group warnings by type
  const getGroupedWarnings = () => {
    const roomWarnings = availabilityWarnings.filter(w => w.type === 'room_conflict');
    const teacherWarnings = availabilityWarnings.filter(w => w.type === 'teacher_conflict');
    
    return { roomWarnings, teacherWarnings };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>เปลี่ยนวันนัด Makeup Class</DialogTitle>
          <DialogDescription>
            แก้ไขวันเวลานัดเรียนชดเชยสำหรับ {student.nickname}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Schedule Info */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900">ตารางเดิม</p>
            <div className="text-sm text-blue-700 space-y-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{formatDate(makeup.makeupSchedule!.date, 'long')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{makeup.makeupSchedule!.startTime} - {makeup.makeupSchedule!.endTime} น.</span>
              </div>
            </div>
          </div>

          {/* Schedule Form */}
          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">วันที่นัดใหม่ *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">เวลาเริ่ม *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">เวลาจบ *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

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
                  {teachers.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      ไม่มีครูที่สอนในสาขานี้
                    </div>
                  ) : (
                    teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.nickname || teacher.name}
                        {teacher.id === classInfo.teacherId && ' (ครูประจำคลาส)'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                แสดงเฉพาะครูที่สอนในสาขานี้
              </p>
            </div>

            {/* Room */}
            <div className="space-y-2">
              <Label htmlFor="room">ห้องเรียน *</Label>
              <Select
                value={formData.roomId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกห้อง" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      ไม่มีห้องเรียนในสาขานี้
                    </div>
                  ) : (
                    rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} (จุ {room.capacity} คน)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                แสดงเฉพาะห้องในสาขานี้
              </p>
            </div>

            {/* Change Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">เหตุผลที่เปลี่ยน *</Label>
              <Textarea
                id="reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="เช่น ครูติดธุระ, ห้องไม่ว่าง, ผู้ปกครองขอเลื่อน"
                rows={2}
                required
              />
            </div>
          </div>

          {/* Availability Status - Updated */}
          {isAvailable !== null && hasChanged() && (
            <>
              {/* Holiday Issue */}
              {isAvailable === false && availabilityMessage.includes('วันหยุด') && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {availabilityMessage}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Warnings */}
              {availabilityWarnings.length > 0 && !availabilityMessage.includes('วันหยุด') && (
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
                                <p className="font-medium text-amber-800 text-sm">ห้องเรียนมีการใช้งาน:</p>
                                {roomWarnings.map((warning, index) => (
                                  <div key={index} className="flex items-start gap-2 text-sm text-amber-700">
                                    {warning.details.conflictType === 'makeup' && 
                                     warning.message.includes('คน') ? (
                                      <Users className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    )}
                                    <span className="text-xs">{warning.message}</span>
                                  </div>
                                ))}
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {teacherWarnings.length > 0 && (
                          <Alert className="border-amber-200 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription>
                              <div className="space-y-1">
                                <p className="font-medium text-amber-800 text-sm">ครูมีคลาสอื่น:</p>
                                {teacherWarnings.map((warning, index) => (
                                  <div key={index} className="flex items-start gap-2 text-sm text-amber-700">
                                    <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs">{warning.message}</span>
                                  </div>
                                ))}
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* Success */}
              {isAvailable && availabilityWarnings.length === 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    เวลานี้สามารถจัดได้
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Show branch indicator if viewing specific branch */}
          {!isAllBranches && selectedBranchId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                กำลังแก้ไขตาราง Makeup ในสาขาที่เลือกเท่านั้น
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading || 
              !formData.date || 
              !formData.startTime ||
              !formData.endTime ||
              !formData.teacherId || 
              !formData.roomId || 
              (isAvailable === false && availabilityMessage.includes('วันหยุด')) ||
              !changeReason.trim() ||
              !hasChanged() ||
              checkingAvailability
            }
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? (
              <>กำลังบันทึก...</>
            ) : availabilityWarnings.length > 0 ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                ยืนยันการเปลี่ยนแปลง
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                บันทึกการเปลี่ยนแปลง
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
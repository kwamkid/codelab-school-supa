'use client';

import { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Clock,
  User,
  MapPin,
  Loader2,
  AlertTriangle,
  Users
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { MakeupClass, Teacher, Room } from '@/types/models';
import { scheduleMakeupClass } from '@/lib/services/makeup';
import { getActiveTeachers } from '@/lib/services/teachers';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { checkAvailability, AvailabilityWarning } from '@/lib/utils/availability';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import { useBranch } from '@/contexts/BranchContext';

interface ScheduleMakeupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  makeupRequest: MakeupClass; // ✨ Now contains all denormalized data!
  onSuccess?: () => void;
}

export default function ScheduleMakeupDialog({
  open,
  onOpenChange,
  makeupRequest,
  onSuccess,
}: ScheduleMakeupDialogProps) {
  const { user, canAccessBranch } = useAuth();
  const { selectedBranchId, isAllBranches } = useBranch();
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityIssues, setAvailabilityIssues] = useState<any[]>([]);
  const [availabilityWarnings, setAvailabilityWarnings] = useState<AvailabilityWarning[]>([]);
  
  const [formData, setFormData] = useState({
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    teacherId: '',
    branchId: '',
    roomId: '',
  });

  // Load initial data
  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      try {
        // Check branch access
        if (!canAccessBranch(makeupRequest.branchId)) {
          toast.error('คุณไม่มีสิทธิ์จัดตาราง Makeup ในสาขานี้');
          onOpenChange(false);
          return;
        }

        const [teachersData, roomsData] = await Promise.all([
          getActiveTeachers(makeupRequest.branchId),
          getRoomsByBranch(makeupRequest.branchId)
        ]);

        setTeachers(teachersData);
        setRooms(roomsData.filter(r => r.isActive));

        // Set default values from class
        setFormData(prev => ({ 
          ...prev, 
          branchId: makeupRequest.branchId,
          // We would need teacherId and times from classInfo
          // For now, use reasonable defaults
        }));
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    };

    loadData();
  }, [open, makeupRequest, canAccessBranch]);

  // Auto-set end time
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

  // Check availability
  useEffect(() => {
    const checkScheduleAvailability = async () => {
      if (!formData.date || !formData.startTime || !formData.endTime || 
          !formData.branchId || !formData.roomId || !formData.teacherId) {
        setAvailabilityIssues([]);
        setAvailabilityWarnings([]);
        return;
      }

      setCheckingAvailability(true);
      try {
        const result = await checkAvailability({
          date: new Date(formData.date),
          startTime: formData.startTime,
          endTime: formData.endTime,
          branchId: formData.branchId,
          roomId: formData.roomId,
          teacherId: formData.teacherId,
          excludeId: makeupRequest.id,
          excludeType: 'makeup',
          allowConflicts: true
        });

        setAvailabilityIssues(result.reasons);
        setAvailabilityWarnings(result.warnings || []);
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setCheckingAvailability(false);
      }
    };

    const debounceTimer = setTimeout(checkScheduleAvailability, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData, makeupRequest.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.startTime || !formData.endTime || 
        !formData.teacherId || !formData.roomId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Check for holiday
    if (availabilityIssues.length > 0) {
      const holidayIssue = availabilityIssues.find(issue => issue.type === 'holiday');
      if (holidayIssue) {
        toast.error('ไม่สามารถจัด Makeup Class ในวันหยุดได้');
        return;
      }
    }

    // Confirm if warnings exist
    if (availabilityWarnings.length > 0) {
      const confirmMessage = `มีคลาส/กิจกรรมอื่นในช่วงเวลานี้:\n${availabilityWarnings.map(w => `- ${w.message}`).join('\n')}\n\nคุณต้องการจัด Makeup Class ในเวลานี้หรือไม่?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    setLoading(true);
    try {
      await scheduleMakeupClass(makeupRequest.id, {
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        teacherId: formData.teacherId,
        branchId: formData.branchId,
        roomId: formData.roomId,
        confirmedBy: user?.uid || 'admin',
      });

      toast.success('จัดตาราง Makeup Class เรียบร้อยแล้ว');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        date: '',
        startTime: '10:00',
        endTime: '11:00',
        teacherId: '',
        branchId: '',
        roomId: '',
      });
    } catch (error: any) {
      console.error('Error scheduling makeup:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการจัดตาราง');
    } finally {
      setLoading(false);
    }
  };

  // Helper to group warnings
  const getGroupedWarnings = () => {
    const roomWarnings = availabilityWarnings.filter(w => w.type === 'room_conflict');
    const teacherWarnings = availabilityWarnings.filter(w => w.type === 'teacher_conflict');
    
    return { roomWarnings, teacherWarnings };
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setFormData({
          date: '',
          startTime: '10:00',
          endTime: '11:00',
          teacherId: '',
          branchId: '',
          roomId: '',
        });
        setAvailabilityWarnings([]);
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>จัดตาราง Makeup Class</DialogTitle>
          <DialogDescription>
            กำหนดวันเวลาและสถานที่สำหรับ Makeup Class
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student & Class Info - ✨ ใช้ denormalized data */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">นักเรียน:</span>
              <span className="font-medium">
                {makeupRequest.studentNickname || makeupRequest.studentName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">คลาสเดิม:</span>
              <div className="text-right">
                <span className="font-medium">
                  {makeupRequest.subjectName} - {makeupRequest.className}
                </span>
                {makeupRequest.originalSessionNumber && (
                  <span className="text-sm text-gray-500 ml-2">
                    (ครั้งที่ {makeupRequest.originalSessionNumber})
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">เหตุผล:</span>
              <span className="font-medium">{makeupRequest.reason}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">สาขา:</span>
              <span className="font-medium text-red-600">{makeupRequest.branchName}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">วันที่นัด Makeup *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>ช่วงเวลา *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    step="300"
                    required
                  />
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    step="300"
                    min={formData.startTime}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Teacher and Room */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.nickname || teacher.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  แสดงเฉพาะครูที่สอนในสาขา {makeupRequest.branchName}
                </p>
              </div>

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
                      rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name} (จุ {room.capacity} คน)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  แสดงเฉพาะห้องในสาขา {makeupRequest.branchName}
                </p>
              </div>
            </div>
          </div>

          {/* Availability Status */}
          {checkingAvailability ? (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                กำลังตรวจสอบตารางเวลา...
              </AlertDescription>
            </Alert>
          ) : availabilityIssues.length > 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">ไม่สามารถจัด Makeup ได้:</p>
                  {availabilityIssues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
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
                            <p className="text-xs text-amber-600 mt-2">
                              * สามารถจัด Makeup Class ร่วมกันได้
                            </p>
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
                            <p className="text-xs text-amber-600 mt-2">
                              * กรุณาพิจารณาเลือกครูท่านอื่น หรือยืนยันการจัดตาราง
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            formData.date && formData.startTime && formData.endTime && 
            formData.roomId && formData.teacherId && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  เวลานี้สามารถจัด Makeup Class ได้
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
                onOpenChange(false);
                setFormData({
                  date: '',
                  startTime: '10:00',
                  endTime: '11:00',
                  teacherId: '',
                  branchId: '',
                  roomId: '',
                });
              }}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button 
              type="submit" 
              disabled={
                loading || 
                checkingAvailability || 
                availabilityIssues.some(issue => issue.type === 'holiday')
              }
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : availabilityWarnings.length > 0 ? (
                'ยืนยันการจัดตาราง'
              ) : (
                'จัดตาราง'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
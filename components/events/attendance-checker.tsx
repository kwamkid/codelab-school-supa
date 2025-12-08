'use client';

import { useState } from 'react';
import { EventRegistration, EventSchedule, Branch } from '@/types/models';
import { updateEventAttendance } from '@/lib/services/events';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  UserCheck,
  Search,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Phone,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatPhoneNumber } from '@/lib/utils';

interface AttendanceCheckerProps {
  registrations: EventRegistration[];
  schedules: EventSchedule[];
  branches: Branch[];
  onSave: () => void;
}

interface AttendanceRecord {
  registrationId: string;
  attended: boolean;
  note?: string;
}

export default function AttendanceChecker({ 
  registrations, 
  schedules, 
  branches,
  onSave 
}: AttendanceCheckerProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize attendance records
  useState(() => {
    const initialRecords: Record<string, AttendanceRecord> = {};
    registrations.forEach(reg => {
      initialRecords[reg.id] = {
        registrationId: reg.id,
        attended: reg.attended || false,
        note: reg.attendanceNote || ''
      };
    });
    setAttendanceRecords(initialRecords);
  });

  // Filter registrations
  const filteredRegistrations = registrations.filter(reg => {
    const matchSearch = 
      reg.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.parentPhone.includes(searchTerm) ||
      reg.students.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchSchedule = scheduleFilter === 'all' || reg.scheduleId === scheduleFilter;
    const matchBranch = branchFilter === 'all' || reg.branchId === branchFilter;
    
    return matchSearch && matchSchedule && matchBranch;
  });

  const handleAttendanceChange = (registrationId: string, attended: boolean) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [registrationId]: {
        ...prev[registrationId],
        attended
      }
    }));
  };

  const handleNoteChange = (registrationId: string, note: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [registrationId]: {
        ...prev[registrationId],
        note
      }
    }));
  };

  const handleCheckAll = (checked: boolean) => {
    const newRecords = { ...attendanceRecords };
    filteredRegistrations.forEach(reg => {
      newRecords[reg.id] = {
        ...newRecords[reg.id],
        attended: checked
      };
    });
    setAttendanceRecords(newRecords);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Prepare attendance data
      const attendanceData = Object.values(attendanceRecords)
        .filter(record => {
          const reg = registrations.find(r => r.id === record.registrationId);
          return reg && (reg.attended !== record.attended || reg.attendanceNote !== record.note);
        })
        .map(record => ({
          registrationId: record.registrationId,
          attended: record.attended,
          note: record.note
        }));

      if (attendanceData.length === 0) {
        toast.info('ไม่มีการเปลี่ยนแปลง');
        setShowConfirmDialog(false);
        return;
      }

      await updateEventAttendance(attendanceData, user!.uid);
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      setShowConfirmDialog(false);
      onSave();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('ไม่สามารถบันทึกการเช็คชื่อได้');
    } finally {
      setSaving(false);
    }
  };

  const getScheduleDisplay = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return '-';
    return `${formatDate(schedule.date, 'short')} ${schedule.startTime}-${schedule.endTime}`;
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  // Calculate stats
  const stats = {
    total: filteredRegistrations.length,
    attended: Object.values(attendanceRecords).filter(r => 
      r.attended && filteredRegistrations.some(reg => reg.id === r.registrationId)
    ).length,
    absent: 0
  };
  stats.absent = stats.total - stats.attended;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">เช็คชื่อผู้เข้าร่วม</h2>
        <Button 
          onClick={() => setShowConfirmDialog(true)}
          className="bg-green-600 hover:bg-green-700"
          disabled={Object.keys(attendanceRecords).length === 0}
        >
          <Save className="h-4 w-4 mr-2" />
          บันทึกการเช็คชื่อ
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหาชื่อ, เบอร์โทร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="รอบเวลาทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">รอบเวลาทั้งหมด</SelectItem>
              {schedules.map(schedule => (
                <SelectItem key={schedule.id} value={schedule.id}>
                  {formatDate(schedule.date, 'short')} {schedule.startTime}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="สาขาทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สาขาทั้งหมด</SelectItem>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="check-all"
              onCheckedChange={handleCheckAll}
            />
            <label
              htmlFor="check-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              เลือกทั้งหมด
            </label>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              ทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              มา
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              ไม่มา
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance List */}
      <Card>
        <CardContent className="p-6">
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ไม่พบข้อมูลผู้ลงทะเบียน
              </h3>
              <p className="text-gray-600">
                ลองปรับเงื่อนไขการค้นหา
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRegistrations.map((registration) => (
                <div
                  key={registration.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    attendanceRecords[registration.id]?.attended
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={attendanceRecords[registration.id]?.attended || false}
                      onCheckedChange={(checked) => 
                        handleAttendanceChange(registration.id, checked as boolean)
                      }
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{registration.parentName}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatPhoneNumber(registration.parentPhone)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {getBranchName(registration.branchId)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <Badge variant="outline">
                            {getScheduleDisplay(registration.scheduleId)}
                          </Badge>
                          <p className="text-sm text-gray-500 mt-1">
                            {registration.attendeeCount} คน
                          </p>
                        </div>
                      </div>
                      
                      {/* Show students/parents based on counting method */}
                      {registration.students.length > 0 && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">นักเรียน:</span>{' '}
                          {registration.students.map(s => s.name).join(', ')}
                        </div>
                      )}
                      
                      {/* Note input */}
                      <div className="mt-2">
                        <Input
                          placeholder="หมายเหตุ (ถ้ามี)"
                          value={attendanceRecords[registration.id]?.note || ''}
                          onChange={(e) => 
                            handleNoteChange(registration.id, e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการบันทึกการเช็คชื่อ</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2 mt-2">
                <p>สรุปการเช็คชื่อ:</p>
                <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                  <p>• เข้าร่วม: {stats.attended} คน</p>
                  <p>• ไม่มา: {stats.absent} คน</p>
                  <p>• ทั้งหมด: {stats.total} คน</p>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  คุณแน่ใจหรือไม่ที่จะบันทึกข้อมูลการเช็คชื่อ?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? 'กำลังบันทึก...' : 'ยืนยันการบันทึก'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
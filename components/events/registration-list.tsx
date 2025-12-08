'use client';

import { useState } from 'react';
import { EventRegistration, EventSchedule, Branch } from '@/types/models';
import { cancelEventRegistration, updateEventAttendance } from '@/lib/services/events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from "@/components/ui/badge";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  Users, 
  Phone, 
  Mail,
  Calendar,
  MapPin,
  X,
  Eye,
  UserCheck,
  AlertCircle,
  Building2,
  Download,
  CheckCircle2,
  XCircle,
  Save,
  ArrowLeft,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatPhoneNumber } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface RegistrationListProps {
  eventId: string;
  registrations: EventRegistration[];
  schedules: EventSchedule[];
  branches: Branch[];
  countingMethod: 'students' | 'parents' | 'registrations';
  onUpdate: () => void;
}

interface AttendanceRecord {
  registrationId: string;
  attended: boolean;
  note?: string;
}

export default function RegistrationList({ 
  eventId,
  registrations, 
  schedules, 
  branches,
  countingMethod,
  onUpdate 
}: RegistrationListProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'list' | 'attendance'>('list');
  
  // List mode states
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRegistration, setSelectedRegistration] = useState<EventRegistration | null>(null);
  const [cancelRegistrationId, setCancelRegistrationId] = useState<string | null>(null);
  
  // Attendance mode states
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceScheduleFilter, setAttendanceScheduleFilter] = useState<string>('all');
  const [attendanceBranchFilter, setAttendanceBranchFilter] = useState<string>('all');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize attendance records when switching to attendance mode
  const initializeAttendanceRecords = () => {
    const initialRecords: Record<string, AttendanceRecord> = {};
    registrations
      .filter(r => r.status !== 'cancelled')
      .forEach(reg => {
        initialRecords[reg.id] = {
          registrationId: reg.id,
          attended: reg.attended || false,
          note: reg.attendanceNote || ''
        };
      });
    setAttendanceRecords(initialRecords);
  };

  // Filter registrations based on mode
  const getFilteredRegistrations = () => {
    const isAttendanceMode = mode === 'attendance';
    const searchValue = isAttendanceMode ? attendanceSearchTerm : searchTerm;
    const schedule = isAttendanceMode ? attendanceScheduleFilter : scheduleFilter;
    const branch = isAttendanceMode ? attendanceBranchFilter : branchFilter;
    
    let filtered = registrations.filter(reg => {
      const matchSearch = 
        reg.parentName.toLowerCase().includes(searchValue.toLowerCase()) ||
        reg.parentPhone.includes(searchValue) ||
        reg.parentEmail?.toLowerCase().includes(searchValue.toLowerCase()) ||
        reg.students.some(s => s.name.toLowerCase().includes(searchValue.toLowerCase()));
      
      const matchSchedule = schedule === 'all' || reg.scheduleId === schedule;
      const matchBranch = branch === 'all' || reg.branchId === branch;
      
      // In attendance mode, only show confirmed registrations
      if (isAttendanceMode) {
        return matchSearch && matchSchedule && matchBranch && reg.status !== 'cancelled';
      }
      
      // In list mode, apply status filter
      const matchStatus = statusFilter === 'all' || reg.status === statusFilter;
      return matchSearch && matchSchedule && matchBranch && matchStatus;
    });
    
    return filtered;
  };

  const filteredRegistrations = getFilteredRegistrations();

  // Handle mode switch
  const handleModeSwitch = (newMode: 'list' | 'attendance') => {
    if (newMode === 'attendance') {
      initializeAttendanceRecords();
    }
    setMode(newMode);
  };

  // Attendance functions
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
      if (newRecords[reg.id]) {
        newRecords[reg.id] = {
          ...newRecords[reg.id],
          attended: checked
        };
      }
    });
    setAttendanceRecords(newRecords);
  };

  const handleSaveAttendance = async () => {
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
        setShowSaveConfirm(false);
        return;
      }

      await updateEventAttendance(attendanceData, user!.uid);
      toast.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว');
      setShowSaveConfirm(false);
      onUpdate();
      setMode('list'); // กลับไปโหมด list หลังบันทึก
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('ไม่สามารถบันทึกการเช็คชื่อได้');
    } finally {
      setSaving(false);
    }
  };

  // Other existing functions
  const handleCancelRegistration = async () => {
    if (!cancelRegistrationId) return;

    try {
      await cancelEventRegistration(
        cancelRegistrationId,
        'ยกเลิกโดย Admin',
        user!.uid
      );
      toast.success('ยกเลิกการลงทะเบียนเรียบร้อยแล้ว');
      setCancelRegistrationId(null);
      onUpdate();
    } catch (error: any) {
      console.error('Error cancelling registration:', error);
      toast.error(error.message || 'ไม่สามารถยกเลิกการลงทะเบียนได้');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'confirmed': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700',
      'attended': 'bg-blue-100 text-blue-700',
      'no-show': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'confirmed': 'ลงทะเบียนแล้ว',
      'cancelled': 'ยกเลิก',
      'attended': 'มางาน',
      'no-show': 'ไม่มา'
    };
    return texts[status] || status;
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

  const exportToCSV = () => {
    // Prepare CSV data
    const headers = [
      'ลำดับ',
      'วันที่ลงทะเบียน',
      'ชื่อผู้ปกครอง',
      'เบอร์โทร',
      'อีเมล',
      'สาขา',
      'รอบเวลา',
      'จำนวน',
      'สถานะ',
      'วิธีลงทะเบียน'
    ];

    const rows = filteredRegistrations.map((reg, index) => [
      index + 1,
      formatDate(reg.registeredAt, 'short'),
      reg.parentName,
      reg.parentPhone,
      reg.parentEmail || '-',
      getBranchName(reg.branchId),
      getScheduleDisplay(reg.scheduleId),
      reg.attendeeCount,
      getStatusText(reg.status),
      reg.registeredFrom === 'liff' ? 'Online' : 'Admin'
    ]);

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `event-registrations-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate stats for attendance mode
  const attendanceStats = (() => {
    if (mode !== 'attendance') return null;
    
    const total = filteredRegistrations.length;
    const attended = filteredRegistrations.filter(reg => 
      attendanceRecords[reg.id]?.attended || false
    ).length;
    const absent = total - attended;
    
    return { total, attended, absent };
  })();

  return (
    <div className="space-y-6">
      {/* Header with Mode Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {mode === 'list' ? 'รายชื่อผู้ลงทะเบียน' : 'เช็คชื่อผู้เข้าร่วม'}
        </h2>
        <div className="flex gap-2">
          {mode === 'list' ? (
            <>
              <Button
                variant="outline"
                onClick={exportToCSV}
                disabled={filteredRegistrations.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                onClick={() => handleModeSwitch('attendance')}
                className="bg-green-600 hover:bg-green-700"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                เช็คชื่อ
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={() => setMode('list')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                กลับ
              </Button>
              <Button 
                onClick={() => setShowSaveConfirm(true)}
                className="bg-green-600 hover:bg-green-700"
                disabled={Object.keys(attendanceRecords).length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                บันทึกการเช็คชื่อ
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
            value={mode === 'list' ? searchTerm : attendanceSearchTerm}
            onChange={(e) => mode === 'list' ? setSearchTerm(e.target.value) : setAttendanceSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <Select 
            value={mode === 'list' ? scheduleFilter : attendanceScheduleFilter} 
            onValueChange={mode === 'list' ? setScheduleFilter : setAttendanceScheduleFilter}
          >
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
          
          <Select 
            value={mode === 'list' ? branchFilter : attendanceBranchFilter} 
            onValueChange={mode === 'list' ? setBranchFilter : setAttendanceBranchFilter}
          >
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
          
          {mode === 'list' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="สถานะทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="confirmed">ลงทะเบียนแล้ว</SelectItem>
                <SelectItem value="cancelled">ยกเลิก</SelectItem>
                <SelectItem value="attended">มางาน</SelectItem>
                <SelectItem value="no-show">ไม่มา</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          {mode === 'attendance' && (
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
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {mode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredRegistrations.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ลงทะเบียนแล้ว</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {filteredRegistrations.filter(r => r.status === 'confirmed').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">มางาน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {filteredRegistrations.filter(r => r.status === 'attended').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ยกเลิก</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {filteredRegistrations.filter(r => r.status === 'cancelled').length}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                ทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceStats?.total || 0}</div>
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
              <div className="text-2xl font-bold text-green-600">{attendanceStats?.attended || 0}</div>
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
              <div className="text-2xl font-bold text-red-600">{attendanceStats?.absent || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardContent className="p-0">
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ไม่พบข้อมูลผู้ลงทะเบียน
              </h3>
              <p className="text-gray-600">
                {(mode === 'list' ? searchTerm : attendanceSearchTerm) || 
                 (mode === 'list' ? scheduleFilter : attendanceScheduleFilter) !== 'all' || 
                 (mode === 'list' ? branchFilter : attendanceBranchFilter) !== 'all' || 
                 (mode === 'list' && statusFilter !== 'all')
                  ? 'ลองปรับเงื่อนไขการค้นหา'
                  : 'ยังไม่มีผู้ลงทะเบียน'}
              </p>
            </div>
          ) : mode === 'list' ? (
            // List Mode - Table View
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ผู้ลงทะเบียน</TableHead>
                    <TableHead>ติดต่อ</TableHead>
                    <TableHead>รอบเวลา</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead className="text-center">จำนวน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{registration.parentName}</p>
                          <p className="text-sm text-gray-500">
                            ลงทะเบียน: {formatDate(registration.registeredAt, 'short')}
                          </p>
                          {registration.isGuest && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Guest
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {formatPhoneNumber(registration.parentPhone)}
                          </div>
                          {registration.parentEmail && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {registration.parentEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(registration.scheduleDate, 'short')}</p>
                          <p className="text-gray-500">{registration.scheduleTime}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getBranchName(registration.branchId)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {registration.attendeeCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(registration.status)}>
                          {getStatusText(registration.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRegistration(registration)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {registration.status === 'confirmed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelRegistrationId(registration.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Attendance Mode - Card View
            <div className="p-6 space-y-4">
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

      {/* Registration Detail Dialog */}
      <Dialog open={!!selectedRegistration} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดการลงทะเบียน</DialogTitle>
            <DialogDescription>
              ข้อมูลผู้ลงทะเบียนและผู้เข้าร่วม
            </DialogDescription>
          </DialogHeader>
          
          {selectedRegistration && (
            <div className="space-y-6">
              {/* Registration Info */}
              <div className="space-y-2">
                <h3 className="font-medium">ข้อมูลการลงทะเบียน</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">วันที่ลงทะเบียน:</span>
                    <p className="font-medium">{formatDate(selectedRegistration.registeredAt, 'full')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">ช่องทาง:</span>
                    <p className="font-medium">
                      {selectedRegistration.registeredFrom === 'liff' ? 'Online' : 'Admin'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">สถานะ:</span>
                    <Badge className={getStatusColor(selectedRegistration.status)}>
                      {getStatusText(selectedRegistration.status)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">จำนวน:</span>
                    <p className="font-medium">{selectedRegistration.attendeeCount} คน</p>
                  </div>
                </div>
              </div>

              {/* Parent Info */}
              <div className="space-y-2">
                <h3 className="font-medium">ข้อมูลผู้ปกครอง</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">ชื่อ:</span> {selectedRegistration.parentName}</p>
                  <p><span className="text-gray-500">เบอร์โทร:</span> {formatPhoneNumber(selectedRegistration.parentPhone)}</p>
                  {selectedRegistration.parentEmail && (
                    <p><span className="text-gray-500">อีเมล:</span> {selectedRegistration.parentEmail}</p>
                  )}
                  {selectedRegistration.parentAddress && (
                    <p><span className="text-gray-500">ที่อยู่:</span> {selectedRegistration.parentAddress}</p>
                  )}
                </div>
              </div>

              {/* Schedule Info */}
              <div className="space-y-2">
                <h3 className="font-medium">รอบเวลาและสถานที่</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <Calendar className="h-4 w-4 inline mr-1" />
                    {formatDate(selectedRegistration.scheduleDate, 'long')} เวลา {selectedRegistration.scheduleTime}
                  </p>
                  <p>
                    <Building2 className="h-4 w-4 inline mr-1" />
                    สาขา {getBranchName(selectedRegistration.branchId)}
                  </p>
                </div>
              </div>

              {/* Students/Parents Info */}
              {countingMethod === 'students' && selectedRegistration.students.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">รายชื่อนักเรียน</h3>
                  <div className="space-y-2">
                    {selectedRegistration.students.map((student, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <p className="font-medium">{student.name} ({student.nickname})</p>
                        <p className="text-gray-500">
                          อายุ {new Date().getFullYear() - new Date(student.birthdate).getFullYear()} ปี
                          {student.schoolName && ` • ${student.schoolName}`}
                          {student.gradeLevel && ` • ${student.gradeLevel}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {countingMethod === 'parents' && selectedRegistration.parents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">รายชื่อผู้ปกครอง</h3>
                  <div className="space-y-2">
                    {selectedRegistration.parents.map((parent, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <p className="font-medium">
                          {parent.name} 
                          {parent.isMainContact && (
                            <Badge variant="outline" className="ml-2 text-xs">ผู้ติดต่อหลัก</Badge>
                          )}
                        </p>
                        <p className="text-gray-500">
                          {parent.phone}
                          {parent.email && ` • ${parent.email}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Request */}
              {selectedRegistration.specialRequest && (
                <div className="space-y-2">
                  <h3 className="font-medium">ความต้องการพิเศษ</h3>
                  <p className="text-sm text-gray-600">{selectedRegistration.specialRequest}</p>
                </div>
              )}

              {/* Referral Source */}
              {selectedRegistration.referralSource && (
                <div className="space-y-2">
                  <h3 className="font-medium">รู้จักงานนี้จาก</h3>
                  <p className="text-sm text-gray-600">{selectedRegistration.referralSource}</p>
                </div>
              )}

              {/* Cancellation Info */}
              {selectedRegistration.status === 'cancelled' && (
                <div className="space-y-2 p-3 bg-red-50 rounded-lg">
                  <h3 className="font-medium text-red-900">ข้อมูลการยกเลิก</h3>
                  <div className="text-sm text-red-700">
                    <p>ยกเลิกเมื่อ: {formatDate(selectedRegistration.cancelledAt!, 'full')}</p>
                    {selectedRegistration.cancellationReason && (
                      <p>เหตุผล: {selectedRegistration.cancellationReason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Attendance Info */}
              {(selectedRegistration.status === 'attended' || selectedRegistration.status === 'no-show') && (
                <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900">ข้อมูลการเข้าร่วม</h3>
                  <div className="text-sm text-blue-700">
                    <p>สถานะ: {selectedRegistration.status === 'attended' ? 'มางาน' : 'ไม่มา'}</p>
                    <p>เช็คชื่อเมื่อ: {formatDate(selectedRegistration.attendanceCheckedAt!, 'full')}</p>
                    {selectedRegistration.attendanceNote && (
                      <p>หมายเหตุ: {selectedRegistration.attendanceNote}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelRegistrationId} onOpenChange={() => setCancelRegistrationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการยกเลิกการลงทะเบียน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะยกเลิกการลงทะเบียนนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelRegistration}
              className="bg-red-600 hover:bg-red-700"
            >
              ยืนยันการยกเลิก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Attendance Confirmation */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการบันทึกการเช็คชื่อ</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2 mt-2">
                <p>สรุปการเช็คชื่อ:</p>
                <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                  <p>• มางาน: {attendanceStats?.attended || 0} คน</p>
                  <p>• ไม่มา: {attendanceStats?.absent || 0} คน</p>
                  <p>• ทั้งหมด: {attendanceStats?.total || 0} คน</p>
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
              onClick={handleSaveAttendance}
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
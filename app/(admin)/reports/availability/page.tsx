// app/(admin)/reports/availability/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Clock, 
  Filter,
  AlertCircle,
  Camera,
  Download,
  Copy
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { getDayConflicts } from '@/lib/utils/availability';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { getTeachersByBranch } from '@/lib/services/teachers';
import { getSubjects } from '@/lib/services/subjects';
import { Room, Teacher, Subject } from '@/types/models';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

// Import separated components
import { Timeline } from '@/components/reports/availability/Timeline';
import { RoomAvailability } from '@/components/reports/availability/RoomAvailability';
import { TeacherAvailability } from '@/components/reports/availability/TeacherAvailability';

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  conflicts?: Array<{
    type: 'class' | 'makeup' | 'trial';
    name: string;
    subjectId?: string;
    subjectColor?: string;
    classId?: string;
    sessionNumber?: number;
    totalSessions?: number;
    isCompleted?: boolean;
  }>;
}

interface RoomAvailabilityData {
  room: Room;
  slots: TimeSlot[];
}

interface TeacherAvailabilityData {
  teacher: Teacher;
  slots: TimeSlot[];
  specialties: Subject[];
}

// Generate time options (00:00, 00:30, 01:00, ...)
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    options.push(`${String(hour).padStart(2, '0')}:00`);
    options.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return options;
};

const timeOptions = generateTimeOptions();

export default function AvailabilityReportPage() {
  // Get current date in Thailand timezone with proper handling
  const getCurrentThaiDate = () => {
    // Create date in Thailand timezone
    const now = new Date();
    // Get Bangkok timezone offset
    const bangkokOffset = 7 * 60; // UTC+7 in minutes
    const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes
    const offsetDiff = bangkokOffset + localOffset;
    
    // Adjust the date
    const thailandDate = new Date(now.getTime() + offsetDiff * 60 * 1000);

    // Set to start of day
    thailandDate.setHours(0, 0, 0, 0);

    return thailandDate;
  };

  // Use Branch Context
  const { selectedBranchId, isAllBranches } = useBranch();
  
  const [selectedDate, setSelectedDate] = useState<Date>(getCurrentThaiDate());
  const [timeRange, setTimeRange] = useState({ start: '08:30', end: '17:30' });
  const [timeAlignment, setTimeAlignment] = useState<'00' | '30'>('30');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [roomAvailability, setRoomAvailability] = useState<RoomAvailabilityData[]>([]);
  const [teacherAvailability, setTeacherAvailability] = useState<TeacherAvailabilityData[]>([]);
  const [dayInfo, setDayInfo] = useState<{
    isHoliday: boolean;
    holidayName?: string;
    busySlots: any[];
  } | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeTab, setActiveTab] = useState<string>('timeline');

  // Load initial data
  useEffect(() => {
    loadSubjects();
  }, []);

  // Load availability when filters change or on mount
  useEffect(() => {
    if (selectedDate) {
      loadAvailability();
    }
  }, [selectedBranchId, selectedDate, timeRange, timeAlignment]);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadAvailability = async () => {
    setLoading(true);
    try {
      // For "all branches", we need to load data differently
      if (!selectedBranchId && isAllBranches) {
        // When viewing all branches, show empty state or aggregate view
        setRoomAvailability([]);
        setTeacherAvailability([]);
        setDayInfo(null);
        return;
      }

      if (!selectedBranchId) {
        // No branch selected
        return;
      }

      // Get day conflicts
      const conflicts = await getDayConflicts(selectedDate, selectedBranchId);
      setDayInfo(conflicts);

      // Get rooms
      const rooms = await getRoomsByBranch(selectedBranchId);
      const roomData = processRoomAvailability(rooms, conflicts.busySlots);
      setRoomAvailability(roomData);

      // Get teachers
      const teachers = await getTeachersByBranch(selectedBranchId);
      setTeachers(teachers);
      const teacherData = await processTeacherAvailability(teachers, conflicts.busySlots);
      setTeacherAvailability(teacherData);

    } catch (error) {
      console.error('Error loading availability:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const processRoomAvailability = (
    rooms: Room[], 
    busySlots: any[]
  ): RoomAvailabilityData[] => {
    return rooms.map(room => {
      const slots = generateTimeSlots(timeRange.start, timeRange.end);
      
      // Mark busy slots
      slots.forEach(slot => {
        const conflicts = busySlots.filter(busy => 
          busy.roomId === room.id &&
          isTimeOverlap(slot.startTime, slot.endTime, busy.startTime, busy.endTime)
        );
        
        if (conflicts.length > 0) {
          slot.available = false;
          slot.conflicts = conflicts.map(c => ({
            type: c.type,
            name: c.name,
            subjectId: c.subjectId,
            subjectColor: c.subjectColor,
            classId: c.classId,
            sessionNumber: c.sessionNumber,
            totalSessions: c.totalSessions,
            isCompleted: c.isCompleted
          }));
        }
      });
      
      return { room, slots };
    });
  };

  const processTeacherAvailability = async (
    teachers: Teacher[], 
    busySlots: any[]
  ): Promise<TeacherAvailabilityData[]> => {
    return Promise.all(teachers.map(async teacher => {
      const slots = generateTimeSlots(timeRange.start, timeRange.end);
      
      // Mark busy slots
      slots.forEach(slot => {
        const conflicts = busySlots.filter(busy => 
          busy.teacherId === teacher.id &&
          isTimeOverlap(slot.startTime, slot.endTime, busy.startTime, busy.endTime)
        );
        
        if (conflicts.length > 0) {
          slot.available = false;
          slot.conflicts = conflicts.map(c => ({
            type: c.type,
            name: c.name
          }));
        }
      });
      
      // Get teacher specialties
      const teacherSpecialties = subjects.filter(s => 
        teacher.specialties.includes(s.id)
      );
      
      return { teacher, slots, specialties: teacherSpecialties };
    }));
  };

  const generateTimeSlots = (start: string, end: string): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    let [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    // Adjust start time based on alignment preference
    if (timeAlignment === '30' && startMin === 0) {
      startMin = 30;
    } else if (timeAlignment === '00' && startMin === 30) {
      startHour += 1;
      startMin = 0;
    }
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Add 1 hour
      currentHour += 1;
      
      // Don't exceed end time
      if (currentHour > endHour || (currentHour === endHour && currentMin > endMin)) {
        currentHour = endHour;
        currentMin = endMin;
      }
      
      const slotEnd = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: true
      });
    }
    
    return slots;
  };

  const isTimeOverlap = (
    start1: string, end1: string, 
    start2: string, end2: string
  ): boolean => {
    return start1 < end2 && end1 > start2;
  };

  // Format date for input[type="date"]
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    
    // Parse the date properly
    const [year, month, day] = value.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    newDate.setHours(0, 0, 0, 0);

    setSelectedDate(newDate);
  };

  // Export functions
  const captureElement = async (elementId: string, filename: string) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        toast.error('ไม่พบข้อมูลที่ต้องการ Export');
        return;
      }

      // Dynamically import html2canvas only when needed
      const html2canvas = (await import('html2canvas')).default;
      
      // Add export class for styling
      element.classList.add('exporting');
      
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      // Remove export class
      element.classList.remove('exporting');
      
      return { canvas, filename };
    } catch (error) {
      console.error('Error capturing element:', error);
      toast.error('เกิดข้อผิดพลาดในการ Export');
      return null;
    }
  };

  const copyToClipboard = async (elementId: string) => {
    const result = await captureElement(elementId, '');
    if (!result) return;
    
    const { canvas } = result;
    
    try {
      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('ไม่สามารถสร้างรูปภาพได้');
          return;
        }
        
        // Copy to clipboard
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toast.success('คัดลอกรูปภาพไปยัง Clipboard แล้ว');
        } else {
          toast.error('เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพ');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('ไม่สามารถคัดลอกรูปภาพได้');
    }
  };

  const downloadAsImage = async (elementId: string, defaultFilename: string) => {
    const result = await captureElement(elementId, defaultFilename);
    if (!result) return;
    
    const { canvas, filename } = result;
    
    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('ไม่สามารถสร้างรูปภาพได้');
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${formatDate(selectedDate, 'short').replace(/\//g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('ดาวน์โหลดรูปภาพสำเร็จ');
    }, 'image/png');
  };

  const handleExport = (action: 'copy' | 'download', tabName: string) => {
    const elementId = `export-${tabName}`;
    const filename = `availability-${tabName}`;
    
    if (action === 'copy') {
      copyToClipboard(elementId);
    } else {
      downloadAsImage(elementId, filename);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">รายงานห้องและครูว่าง</h1>
          {!isAllBranches && (
            <span className="text-sm text-red-600 font-medium">(เฉพาะสาขาที่เลือก)</span>
          )}
        </div>
        <p className="text-gray-600 mt-1">
          ตรวจสอบห้องเรียนและครูที่ว่างในแต่ละช่วงเวลา
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <CardTitle className="text-lg">ตัวกรองการค้นหา</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* วันที่ */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">วันที่</label>
              <input
                type="date"
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent h-9"
              />
            </div>
            
            {/* ช่วงเวลา - รวม dropdown 2 อันเข้าด้วยกัน */}
            <div className="md:col-span-4">
              <label className="text-sm font-medium mb-2 block">ช่วงเวลา</label>
              <div className="flex items-center gap-2">
                <Select
                  value={timeRange.start}
                  onValueChange={(value) => setTimeRange(prev => ({ ...prev, start: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>
                        {time} น.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <span className="text-gray-500">ถึง</span>
                
                <Select
                  value={timeRange.end}
                  onValueChange={(value) => setTimeRange(prev => ({ ...prev, end: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {timeOptions.filter(time => time > timeRange.start).map(time => (
                      <SelectItem key={time} value={time}>
                        {time} น.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* แสดงช่วงเวลา - ใช้ column ที่เหลือ */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">แสดงช่วง</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alignment"
                    checked={timeAlignment === '00'}
                    onChange={() => setTimeAlignment('00')}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className={cn(
                    "text-sm font-medium",
                    timeAlignment === '00' ? "text-gray-900" : "text-gray-500"
                  )}>xx:00</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alignment"
                    checked={timeAlignment === '30'}
                    onChange={() => setTimeAlignment('30')}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className={cn(
                    "text-sm font-medium",
                    timeAlignment === '30' ? "text-gray-900" : "text-gray-500"
                  )}>xx:30</span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holiday Alert */}
      {dayInfo?.isHoliday && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-900">วันนี้เป็นวันหยุด</p>
            <p className="text-sm text-red-700">{dayInfo.holidayName}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {selectedBranchId && !loading && (
        <Tabs 
          defaultValue="timeline" 
          className="space-y-4"
          onValueChange={setActiveTab}
        >
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="rooms">ห้องว่าง</TabsTrigger>
              <TabsTrigger value="teachers">ครูว่าง</TabsTrigger>
            </TabsList>
            
            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Camera className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('copy', activeTab)}>
                  <Copy className="h-4 w-4 mr-2" />
                  คัดลอกรูปภาพ
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('download', activeTab)}>
                  <Download className="h-4 w-4 mr-2" />
                  ดาวน์โหลด PNG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <div id="export-timeline">
              <Timeline 
                roomAvailability={roomAvailability}
                dayInfo={dayInfo}
                teachers={teachers}
                subjects={subjects}
                timeRange={timeRange}
                timeAlignment={timeAlignment}
              />
            </div>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms">
            <div id="export-rooms">
              <RoomAvailability 
                roomAvailability={roomAvailability}
                subjects={subjects}
              />
            </div>
          </TabsContent>

          {/* Teachers Tab */}
          <TabsContent value="teachers">
            <div id="export-teachers">
              <TeacherAvailability 
                teacherAvailability={teacherAvailability}
                timeRange={timeRange}
                timeAlignment={timeAlignment}
                subjects={subjects}
                dayInfo={dayInfo}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedBranchId && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {isAllBranches ? 'กรุณาเลือกสาขาที่ต้องการดูรายงาน' : 'เลือกสาขาเพื่อดูข้อมูล'}
            </h3>
            <p className="text-gray-600">
              {isAllBranches 
                ? 'รายงานห้องและครูว่างจำเป็นต้องดูแยกตามสาขา เนื่องจากห้องและครูเป็นทรัพยากรเฉพาะของแต่ละสาขา'
                : 'กรุณาเลือกสาขาจาก dropdown ด้านบนเพื่อดูรายงานห้องและครูว่าง'
              }
            </p>
          </CardContent>
        </Card>
      )}
      
      <style jsx global>{`
        /* Export mode styles */
        .exporting {
          padding: 20px !important;
          background: white !important;
        }
        
        .exporting .overflow-x-auto {
          overflow: visible !important;
        }
        
        .exporting .min-w-[800px] {
          min-width: auto !important;
        }
      `}</style>
    </div>
  );
}
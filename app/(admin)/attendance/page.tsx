'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { getClasses, getClassSchedules } from '@/lib/services/classes';
import { getActiveSubjects } from '@/lib/services/subjects';
import { getActiveTeachers } from '@/lib/services/teachers';
import { getActiveBranches } from '@/lib/services/branches';
import { getRoomsByBranch } from '@/lib/services/rooms';
import { getEnrollmentsByClass } from '@/lib/services/enrollments';
import { Class, ClassSchedule, Subject, Teacher, Branch, Room } from '@/types/models';
import { formatTime, getDayName, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  BookOpen,
  UserCheck,
  ClipboardCheck,
  Building2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ClassWithDetails extends Class {
  subject?: Subject;
  teacher?: Teacher;
  branch?: Branch;
  room?: Room;
  todaySchedule?: ClassSchedule;
  actualEnrolledCount?: number;
}

// Cache key constants
const QUERY_KEYS = {
  subjects: ['subjects', 'active'],
  teachers: ['teachers', 'active'],
  branches: ['branches', 'active'],
  classes: (branchId?: string | null, teacherId?: string) => ['classes', branchId, teacherId],
  classSchedules: (classId: string) => ['classSchedules', classId],
  rooms: (branchId: string) => ['rooms', branchId],
  attendanceData: (date: string, branchId?: string | null) => ['attendance', date, branchId],
};

// Custom hook to fetch attendance data for a specific date
const useAttendanceData = (selectedDate: Date, selectedBranchId: string | null, isAllBranches: boolean) => {
  const { user, adminUser, isTeacher, isSuperAdmin, canAccessBranch } = useAuth();
  
  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: QUERY_KEYS.classes(selectedBranchId, isTeacher() ? adminUser?.id : undefined),
    queryFn: async () => {
      if (!user) return [];
      
      if (isAllBranches && isSuperAdmin()) {
        if (isTeacher() && adminUser) {
          return getClasses(undefined, adminUser.id);
        }
        return getClasses();
      } else if (selectedBranchId) {
        if (!canAccessBranch(selectedBranchId)) return [];
        if (isTeacher() && adminUser) {
          return getClasses(selectedBranchId, adminUser.id);
        }
        return getClasses(selectedBranchId);
      }
      return [];
    },
    enabled: !!user && (!!selectedBranchId || isAllBranches),
    staleTime: 60000, // 1 minute
  });
  
  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: QUERY_KEYS.subjects,
    queryFn: () => getActiveSubjects(),
    staleTime: 300000, // 5 minutes
  });
  
  // Fetch teachers
  const { data: teachers = [] } = useQuery({
    queryKey: QUERY_KEYS.teachers,
    queryFn: () => getActiveTeachers(),
    staleTime: 300000, // 5 minutes
  });
  
  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: QUERY_KEYS.branches,
    queryFn: () => getActiveBranches(),
    staleTime: 300000, // 5 minutes
  });
  
  // Process attendance data
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.attendanceData(selectedDate.toISOString(), selectedBranchId),
    queryFn: async () => {
      const dayOfWeek = selectedDate.getDay();
      
      // Filter active classes that have selected day in their schedule
      const activeClasses = classes.filter(cls => 
        (cls.status === 'published' || cls.status === 'started') &&
        cls.daysOfWeek.includes(dayOfWeek)
      );
      
      if (activeClasses.length === 0) return [];
      
      // Create maps for quick lookup
      const subjectMap = new Map(subjects.map(s => [s.id, s]));
      const teacherMap = new Map(teachers.map(t => [t.id, t]));
      const branchMap = new Map(branches.map(b => [b.id, b]));
      
      // Batch load schedules
      const schedulePromises = activeClasses.map(cls => 
        getClassSchedules(cls.id).then(schedules => ({
          classId: cls.id,
          schedules
        }))
      );
      
      const allSchedules = await Promise.all(schedulePromises);
      const scheduleMap = new Map(allSchedules.map(({ classId, schedules }) => [classId, schedules]));
      
      // Get unique branch IDs
      const uniqueBranchIds = [...new Set(activeClasses.map(cls => cls.branchId))];
      
      // Load rooms for branches
      const roomPromises = uniqueBranchIds.map(async (branchId) => {
        const rooms = await getRoomsByBranch(branchId);
        return { branchId, rooms };
      });
      
      const roomResults = await Promise.all(roomPromises);
      const roomsByBranch = new Map(roomResults.map(({ branchId, rooms }) => [branchId, rooms]));
      
      // Build class details
      const classesWithDetails: ClassWithDetails[] = [];

      // Batch load enrollments for all active classes
      const enrollmentPromises = activeClasses.map(cls =>
        getEnrollmentsByClass(cls.id).then(enrollments => ({
          classId: cls.id,
          enrollments
        }))
      );

      const allEnrollments = await Promise.all(enrollmentPromises);
      const enrollmentMap = new Map(allEnrollments.map(({ classId, enrollments }) => [classId, enrollments]));

      for (const cls of activeClasses) {
        if (!isSuperAdmin() && !canAccessBranch(cls.branchId)) continue;

        const schedules = scheduleMap.get(cls.id) || [];
        const selectedSchedule = schedules.find(schedule => {
          const scheduleDate = new Date(schedule.sessionDate);
          return scheduleDate.toDateString() === selectedDate.toDateString();
        });

        if (selectedSchedule) {
          const subject = subjectMap.get(cls.subjectId);
          const teacher = teacherMap.get(cls.teacherId);
          const branch = branchMap.get(cls.branchId);
          const branchRooms = roomsByBranch.get(cls.branchId) || [];
          const room = branchRooms.find(r => r.id === cls.roomId);

          // Get actual enrollment count (only active and completed enrollments)
          const enrollments = enrollmentMap.get(cls.id) || [];
          const actualEnrolledCount = enrollments.length;

          classesWithDetails.push({
            ...cls,
            subject,
            teacher,
            branch,
            room,
            todaySchedule: selectedSchedule,
            actualEnrolledCount
          });
        }
      }
      
      // Sort by branch (if showing all) and time
      classesWithDetails.sort((a, b) => {
        if (isAllBranches) {
          const branchCompare = (a.branch?.name || '').localeCompare(b.branch?.name || '');
          if (branchCompare !== 0) return branchCompare;
        }
        
        const timeA = parseInt(a.startTime.replace(':', ''));
        const timeB = parseInt(b.startTime.replace(':', ''));
        return timeA - timeB;
      });
      
      return classesWithDetails;
    },
    enabled: classes.length > 0 && subjects.length > 0 && teachers.length > 0 && branches.length > 0,
    staleTime: 30000, // 30 seconds
  });
  
  return {
    classes: attendanceData || [],
    subjects,
    teachers,
    branches,
    isLoading: isLoading || !attendanceData,
  };
};

export default function AttendancePage() {
  const router = useRouter();
  const { user, isTeacher, adminUser } = useAuth();
  const { selectedBranchId, isAllBranches } = useBranch();
  
  // Filter states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  
  // Fetch attendance data
  const { classes, subjects, teachers, isLoading } = useAttendanceData(
    selectedDate,
    selectedBranchId,
    isAllBranches
  );
  
  // Filter teachers based on selection and role
  const availableTeachers = useMemo(() => {
    let filteredTeachers = teachers;
    
    // Filter by branch if specific branch selected
    if (selectedBranchId && !isAllBranches) {
      filteredTeachers = filteredTeachers.filter(t => t.availableBranches.includes(selectedBranchId));
    }
    
    // If teacher role, only show themselves
    if (isTeacher() && adminUser) {
      filteredTeachers = filteredTeachers.filter(t => t.id === adminUser.id);
    }
    
    return filteredTeachers;
  }, [teachers, selectedBranchId, isAllBranches, isTeacher, adminUser]);
  
  // Apply filters with memoization
  const filteredClasses = useMemo(() => {
    let filtered = [...classes];
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(cls => 
        cls.name.toLowerCase().includes(searchLower) ||
        cls.code.toLowerCase().includes(searchLower) ||
        cls.subject?.name.toLowerCase().includes(searchLower) ||
        cls.teacher?.name.toLowerCase().includes(searchLower) ||
        cls.teacher?.nickname?.toLowerCase().includes(searchLower) ||
        cls.branch?.name.toLowerCase().includes(searchLower)
      );
    }
    
    // Subject filter
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(cls => cls.subjectId === selectedSubject);
    }
    
    // Teacher filter
    if (selectedTeacher !== 'all') {
      filtered = filtered.filter(cls => cls.teacherId === selectedTeacher);
    }
    
    return filtered;
  }, [classes, searchTerm, selectedSubject, selectedTeacher]);
  
  const getAttendanceStatus = (schedule?: ClassSchedule) => {
    if (!schedule) return { status: 'pending', label: 'ยังไม่เช็คชื่อ', variant: 'secondary' as const };
    
    if (schedule.status === 'completed' || (schedule.attendance && schedule.attendance.length > 0)) {
      const attendanceCount = schedule.attendance?.filter(a => a.status === 'present').length || 0;
      const totalStudents = schedule.attendance?.length || 0;
      
      if (totalStudents === 0) {
        return { 
          status: 'completed', 
          label: 'เช็คแล้ว', 
          variant: 'default' as const 
        };
      }
      
      return { 
        status: 'completed', 
        label: `มาเรียน ${attendanceCount} คน`, 
        variant: 'default' as const 
      };
    }
    
    if (schedule.status === 'cancelled') {
      return { status: 'cancelled', label: 'ยกเลิก', variant: 'destructive' as const };
    }
    
    return { status: 'pending', label: 'ยังไม่เช็คชื่อ', variant: 'secondary' as const };
  };
  
  const handleClassClick = (classId: string) => {
    router.push(`/attendance/${classId}`);
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSubject('all');
    setSelectedTeacher('all');
    setSelectedDate(new Date());
  };
  
  const hasActiveFilters = searchTerm || selectedSubject !== 'all' || selectedTeacher !== 'all';
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  
  // Format date for input
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Handle date change from input
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    
    const [year, month, day] = value.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    newDate.setHours(0, 0, 0, 0);
    
    setSelectedDate(newDate);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        
        {/* Filters Skeleton */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Table Skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show empty state if no branch selected and not super admin viewing all branches
  if (!selectedBranchId && !isAllBranches) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">เช็คชื่อนักเรียน</h1>
            <p className="text-muted-foreground">เลือกสาขาเพื่อดูคลาสเรียน</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">กรุณาเลือกสาขาเพื่อดูคลาสเรียน</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">เช็คชื่อนักเรียน</h1>
          <p className="text-muted-foreground">
            {isToday ? 'วันนี้' : ''} {getDayName(selectedDate.getDay())} {format(selectedDate, 'd MMMM yyyy', { locale: th })}
            {isAllBranches && ' - ทุกสาขา'}
          </p>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              ตัวกรอง
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Picker */}
            <div>
              <label className="text-sm font-medium mb-2 block">วันที่</label>
              <input
                type="date"
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent h-9"
              />
            </div>
            
            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">ค้นหา</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="ชื่อคลาส, รหัส..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full h-9"
                />
              </div>
            </div>
            
            {/* Subject Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">วิชา</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-full h-9">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <SelectValue placeholder="ทุกวิชา" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกวิชา</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Teacher Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">ครู</label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger className="w-full h-9">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    <SelectValue placeholder="ทุกครู" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกครู</SelectItem>
                  {availableTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.nickname || teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Results Count */}
            <div className="flex items-center justify-center">
              <span className="text-sm text-muted-foreground">พบ {filteredClasses.length} คลาส</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {filteredClasses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">
                {hasActiveFilters ? 'ไม่พบคลาสที่ตรงกับเงื่อนไข' : `ไม่มีคลาสเรียนใน${isToday ? 'วันนี้' : 'วันที่เลือก'}`}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">เวลา</TableHead>
                    <TableHead className="min-w-[250px]">คลาสเรียน</TableHead>
                    {isAllBranches && <TableHead className="min-w-[100px]">สาขา</TableHead>}
                    <TableHead className="min-w-[150px]">ครู / ห้อง</TableHead>
                    <TableHead className="text-center min-w-[100px]">นักเรียน</TableHead>
                    <TableHead className="min-w-[150px]">สถานะ</TableHead>
                    <TableHead className="text-center min-w-[80px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClasses.map((cls) => {
                    const attendanceStatus = getAttendanceStatus(cls.todaySchedule);
                    
                    return (
                      <TableRow 
                        key={cls.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleClassClick(cls.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{formatTime(cls.startTime)} - {formatTime(cls.endTime)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: cls.subject?.color || '#ccc' }}
                              />
                              <span className="font-medium">
                                {cls.subject?.name} ครั้งที่ {cls.todaySchedule?.sessionNumber}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {cls.name}
                            </div>
                          </div>
                        </TableCell>
                        {isAllBranches && (
                          <TableCell>
                            <Badge variant="outline">
                              {cls.branch?.name}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {cls.teacher?.nickname || cls.teacher?.name}
                              </span>
                              {cls.todaySchedule?.actualTeacherId && 
                               cls.todaySchedule.actualTeacherId !== cls.teacherId && (
                                <Badge variant="outline" className="text-xs">แทน</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{cls.room?.name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {cls.actualEnrolledCount ?? cls.enrolledCount} คน
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={attendanceStatus.variant}
                            className="gap-1"
                          >
                            {attendanceStatus.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                            {attendanceStatus.status === 'pending' && <AlertCircle className="h-3 w-3" />}
                            {attendanceStatus.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                            {attendanceStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClassClick(cls.id);
                            }}
                            title="เช็คชื่อ"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
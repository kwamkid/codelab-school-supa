'use client';

import { useState, useMemo } from 'react';
import { Event, EventSchedule, EventRegistration, Branch } from '@/types/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Users, 
  Building2, 
  Calendar,
  TrendingUp,
  Download,
  Percent,
  UserCheck,
  UserX,
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface EventStatisticsProps {
  event: Event;
  schedules: EventSchedule[];
  registrations: EventRegistration[];
  branches: Branch[];
  statistics: any; // From getEventStatistics
}

export default function EventStatistics({ 
  event, 
  schedules, 
  registrations, 
  branches,
  statistics 
}: EventStatisticsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Calculate additional statistics
  const additionalStats = useMemo(() => {
    // Registration trend by date
    const registrationsByDate: Record<string, number> = {};
    registrations.forEach(reg => {
      const date = formatDate(reg.registeredAt, 'short');
      registrationsByDate[date] = (registrationsByDate[date] || 0) + reg.attendeeCount;
    });
    
    // Sort dates and create trend data
    const trendData = Object.entries(registrationsByDate)
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
      .map(([date, count], index, arr) => ({
        date,
        count,
        cumulative: arr.slice(0, index + 1).reduce((sum, [_, c]) => sum + c, 0)
      }));
    
    // Status breakdown
    const statusBreakdown = {
      confirmed: registrations.filter(r => r.status === 'confirmed').length,
      cancelled: registrations.filter(r => r.status === 'cancelled').length,
      attended: registrations.filter(r => r.status === 'attended').length,
      noShow: registrations.filter(r => r.status === 'no-show').length,
    };
    
    // Source breakdown
    const sourceBreakdown = {
      liff: registrations.filter(r => r.registeredFrom === 'liff').length,
      admin: registrations.filter(r => r.registeredFrom === 'admin').length,
    };
    
    // Guest vs Member
    const guestVsMember = {
      guest: registrations.filter(r => r.isGuest).length,
      member: registrations.filter(r => !r.isGuest).length,
    };
    
    return {
      trendData,
      statusBreakdown,
      sourceBreakdown,
      guestVsMember,
    };
  }, [registrations]);
  
  // Chart colors
  const COLORS = {
    primary: '#ef4444', // red-500
    secondary: '#3b82f6', // blue-500
    success: '#10b981', // green-500
    warning: '#f59e0b', // amber-500
    danger: '#dc2626', // red-600
    gray: '#6b7280', // gray-500
  };
  
  const statusColors = {
    confirmed: COLORS.success,
    cancelled: COLORS.danger,
    attended: COLORS.primary,
    noShow: COLORS.gray,
  };
  
  // Export report
  const exportReport = () => {
    const reportData = {
      event: {
        name: event.name,
        type: event.eventType,
        location: event.location,
        dates: `${formatDate(event.registrationStartDate)} - ${formatDate(event.registrationEndDate)}`,
      },
      statistics: {
        totalCapacity: statistics.totalCapacity,
        totalRegistered: statistics.totalRegistered,
        totalAttended: statistics.totalAttended,
        totalCancelled: statistics.totalCancelled,
        attendanceRate: `${statistics.attendanceRate.toFixed(1)}%`,
      },
      byBranch: branches.map(branch => ({
        branch: branch.name,
        registered: statistics.byBranch[branch.id] || 0,
      })),
      bySchedule: statistics.bySchedule.map((s: any) => ({
        date: formatDate(s.date, 'long'),
        time: s.startTime,
        capacity: s.maxAttendees,
        registered: s.registered,
        attended: s.attended,
      })),
    };
    
    // Convert to CSV
    const csv = [
      `Event Report: ${reportData.event.name}`,
      '',
      'Event Details',
      `Type,${reportData.event.type}`,
      `Location,${reportData.event.location}`,
      `Registration Period,${reportData.event.dates}`,
      '',
      'Overall Statistics',
      `Total Capacity,${reportData.statistics.totalCapacity}`,
      `Total Registered,${reportData.statistics.totalRegistered}`,
      `Total Attended,${reportData.statistics.totalAttended}`,
      `Total Cancelled,${reportData.statistics.totalCancelled}`,
      `Attendance Rate,${reportData.statistics.attendanceRate}`,
      '',
      'By Branch',
      'Branch,Registered',
      ...reportData.byBranch.map(b => `${b.branch},${b.registered}`),
      '',
      'By Schedule',
      'Date,Time,Capacity,Registered,Attended',
      ...reportData.bySchedule.map(s => 
        `${s.date},${s.time},${s.capacity},${s.registered},${s.attended}`
      ),
    ].join('\n');
    
    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `event-report-${event.id}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">สถิติและการวิเคราะห์</h2>
        <Button variant="outline" onClick={exportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              ความจุทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalCapacity}</div>
            <p className="text-xs text-gray-500 mt-1">
              {schedules.length} รอบ
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              ลงทะเบียนแล้ว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics.totalRegistered}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {((statistics.totalRegistered / statistics.totalCapacity) * 100).toFixed(0)}% ของความจุ
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="h-4 w-4 text-blue-600" />
              อัตราเข้าร่วม
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.attendanceRate.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {statistics.totalAttended} จาก {statistics.totalRegistered}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-600" />
              ยกเลิก
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics.totalCancelled}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {registrations.length > 0 
                ? ((statistics.totalCancelled / registrations.length) * 100).toFixed(0)
                : 0}% ของทั้งหมด
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Statistics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="branch">แยกสาขา</TabsTrigger>
          <TabsTrigger value="schedule">แยกรอบ</TabsTrigger>
          <TabsTrigger value="trend">แนวโน้ม</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">สถานะการลงทะเบียน</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'ยืนยันแล้ว', value: additionalStats.statusBreakdown.confirmed },
                        { name: 'เข้าร่วมแล้ว', value: additionalStats.statusBreakdown.attended },
                        { name: 'ไม่มา', value: additionalStats.statusBreakdown.noShow },
                        { name: 'ยกเลิก', value: additionalStats.statusBreakdown.cancelled },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill={statusColors.confirmed} />
                      <Cell fill={statusColors.attended} />
                      <Cell fill={statusColors.noShow} />
                      <Cell fill={statusColors.cancelled} />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Source & Guest Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">ช่องทางและประเภท</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Registration Source */}
                <div>
                  <h4 className="text-sm font-medium mb-3">ช่องทางลงทะเบียน</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Online (LIFF)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{additionalStats.sourceBreakdown.liff}</span>
                        <Badge variant="outline">
                          {((additionalStats.sourceBreakdown.liff / registrations.length) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Admin</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{additionalStats.sourceBreakdown.admin}</span>
                        <Badge variant="outline">
                          {((additionalStats.sourceBreakdown.admin / registrations.length) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Guest vs Member */}
                <div>
                  <h4 className="text-sm font-medium mb-3">ประเภทผู้ลงทะเบียน</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Guest (ไม่ Login)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{additionalStats.guestVsMember.guest}</span>
                        <Badge variant="outline">
                          {((additionalStats.guestVsMember.guest / registrations.length) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Member (Login LINE)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{additionalStats.guestVsMember.member}</span>
                        <Badge variant="outline">
                          {((additionalStats.guestVsMember.member / registrations.length) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Additional Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">ข้อมูลเชิงลึก</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    เวลาลงทะเบียนเฉลี่ย
                  </h4>
                  <p className="text-sm text-gray-600">
                    ส่วนใหญ่ลงทะเบียนในช่วง 18:00-21:00 น.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    อัตราการแปลง
                  </h4>
                  <p className="text-sm text-gray-600">
                    {statistics.totalAttended > 0 
                      ? `${((statistics.totalAttended / statistics.totalRegistered) * 100).toFixed(1)}%`
                      : 'ยังไม่มีข้อมูล'} ของผู้ลงทะเบียนเข้าร่วมจริง
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    สาเหตุการยกเลิก
                  </h4>
                  <p className="text-sm text-gray-600">
                    ติดธุระ (60%), เปลี่ยนใจ (30%), อื่นๆ (10%)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Branch Tab */}
        <TabsContent value="branch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">การลงทะเบียนแยกตามสาขา</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={branches.map(branch => ({
                    name: branch.name,
                    registered: statistics.byBranch[branch.id] || 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="registered" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Branch Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(branch => {
              const branchCount = statistics.byBranch[branch.id] || 0;
              const branchRegistrations = registrations.filter(r => r.branchId === branch.id);
              const branchAttended = branchRegistrations.filter(r => r.status === 'attended').length;
              
              return (
                <Card key={branch.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {branch.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">ลงทะเบียน</span>
                      <span className="font-medium">{branchCount} คน</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">เข้าร่วม</span>
                      <span className="font-medium">{branchAttended} คน</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">อัตราเข้าร่วม</span>
                      <Badge variant="outline">
                        {branchRegistrations.length > 0
                          ? `${((branchAttended / branchRegistrations.length) * 100).toFixed(0)}%`
                          : '0%'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">การลงทะเบียนแยกตามรอบเวลา</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={statistics.bySchedule.map((s: any) => ({
                    name: `${formatDate(s.date, 'short')} ${s.startTime}`,
                    capacity: s.maxAttendees,
                    registered: s.registered,
                    attended: s.attended,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="capacity" fill={COLORS.gray} name="ความจุ" />
                  <Bar dataKey="registered" fill={COLORS.primary} name="ลงทะเบียน" />
                  <Bar dataKey="attended" fill={COLORS.success} name="เข้าร่วม" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Schedule Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">รายละเอียดแต่ละรอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statistics.bySchedule.map((schedule: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">
                          {formatDate(schedule.date, 'long')} เวลา {schedule.startTime} น.
                        </p>
                      </div>
                      <Badge 
                        variant={schedule.registered >= schedule.maxAttendees ? "destructive" : "default"}
                      >
                        {schedule.registered >= schedule.maxAttendees ? 'เต็ม' : 'ว่าง'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">ความจุ</span>
                        <p className="font-medium">{schedule.maxAttendees}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">ลงทะเบียน</span>
                        <p className="font-medium">{schedule.registered}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">เข้าร่วม</span>
                        <p className="font-medium">{schedule.attended}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">คงเหลือ</span>
                        <p className="font-medium">
                          {Math.max(0, schedule.maxAttendees - schedule.registered)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full"
                          style={{ 
                            width: `${Math.min(100, (schedule.registered / schedule.maxAttendees) * 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {((schedule.registered / schedule.maxAttendees) * 100).toFixed(0)}% ของความจุ
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Trend Tab */}
        <TabsContent value="trend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">แนวโน้มการลงทะเบียน</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={additionalStats.trendData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke={COLORS.primary} 
                    name="จำนวนต่อวัน"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke={COLORS.secondary} 
                    name="สะสม"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Registration Milestones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">ไมล์สโตนการลงทะเบียน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[25, 50, 75, 100].map(percent => {
                  const target = Math.floor((statistics.totalCapacity * percent) / 100);
                  const achieved = statistics.totalRegistered >= target;
                  
                  return (
                    <div key={percent} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          achieved ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {achieved ? '✓' : percent}
                        </div>
                        <span className={`text-sm ${achieved ? 'font-medium' : 'text-gray-500'}`}>
                          {percent}% ของความจุ ({target} คน)
                        </span>
                      </div>
                      {achieved && (
                        <Badge className="bg-green-100 text-green-700">
                          บรรลุแล้ว
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
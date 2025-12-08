'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ChevronLeft, Loader2, Calendar, Users, Clock, MapPin, User, List, CalendarDays, CalendarRange, AlertCircle } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { getParentScheduleEvents, getStudentOverallStats, StudentStats } from '@/lib/services/liff-schedule'
import { toast } from 'sonner'
import { LiffProvider } from '@/components/liff/liff-provider'
import { PageLoading, SectionLoading } from '@/components/ui/loading'
import { ScheduleEvent } from '@/components/liff/schedule-calendar'

// Import new components
import CourseList from '@/components/liff/schedule/course-list'
import CourseCalendar from '@/components/liff/schedule/course-calendar'
import MonthlyCalendar from '@/components/liff/schedule/monthly-calendar'

function ScheduleContent() {
  const router = useRouter()
  const { profile, isLoggedIn, isLoading: liffLoading, liff } = useLiff()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [overallStats, setOverallStats] = useState<Record<string, StudentStats>>({})
  const [loadingStats, setLoadingStats] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('list')

  // Check authentication
  useEffect(() => {
    if (!liffLoading) {
      if (!isLoggedIn && liff) {
        console.log('[ScheduleContent] Not logged in, redirecting...')
        liff.login()
      } else if (isLoggedIn) {
        setAuthChecked(true)
      }
    }
  }, [liffLoading, isLoggedIn, liff])

  // Load all data for the current year
  const loadYearData = useCallback(async () => {
    if (!profile?.userId || !authChecked || dataLoaded) return

    try {
      setLoading(true)
      
      // Load data for current year and next year to cover cross-year courses
      const now = new Date()
      // Start from 3 months ago to include recent past classes
      const yearStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      // End at next year to include courses that extend into next year
      const yearEnd = new Date(now.getFullYear() + 1, 11, 31) // December 31st next year
      
      console.log(`Loading data from ${yearStart.toDateString()} to ${yearEnd.toDateString()} (covering cross-year courses)`)
      
      const { events: fetchedEvents, students: studentsData } = await getParentScheduleEvents(
        profile.userId,
        yearStart,
        yearEnd
      )
      
      setEvents(fetchedEvents)
      setStudents(studentsData)
      setDataLoaded(true)
      
      // Set default selected student
      if (studentsData.length > 0 && !selectedStudentId) {
        // If only one student, select that student automatically
        if (studentsData.length === 1) {
          setSelectedStudentId(studentsData[0].student.id)
        }
        // If multiple students, show all by default
      }
      
      console.log(`Loaded ${fetchedEvents.length} events for the year`)
    } catch (error) {
      console.error('Error loading schedules:', error)
      toast.error('ไม่สามารถโหลดตารางเรียนได้')
    } finally {
      setLoading(false)
    }
  }, [profile, selectedStudentId, dataLoaded, authChecked])

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    setDataLoaded(false)
    await loadYearData()
  }, [loadYearData])

  // Load overall stats for all students
  const loadOverallStats = useCallback(async () => {
    if (!profile?.userId || students.length === 0) return

    try {
      setLoadingStats(true)
      const statsPromises = students.map(async (studentData) => {
        const stats = await getStudentOverallStats(profile.userId, studentData.student.id)
        return { studentId: studentData.student.id, stats }
      })

      const results = await Promise.all(statsPromises)
      const statsMap: Record<string, StudentStats> = {}
      results.forEach(({ studentId, stats }) => {
        statsMap[studentId] = stats
      })
      
      setOverallStats(statsMap)
    } catch (error) {
      console.error('Error loading overall stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [profile, students])

  // Initial load
  useEffect(() => {
    if (profile?.userId && authChecked) {
      loadYearData()
    }
  }, [profile?.userId, authChecked, loadYearData])

  // Load overall stats when students data is available
  useEffect(() => {
    if (students.length > 0) {
      loadOverallStats()
    }
  }, [students, loadOverallStats])

  // Handle leave request
  const handleLeaveRequest = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    setConfirmLeaveOpen(true)
  }

  // Submit leave request
  const submitLeaveRequest = async () => {
    if (!selectedEvent) return

    try {
      setIsSubmitting(true)
      
      // Get the schedule ID from the event ID (format: classId-scheduleId-studentId)
      const [classId, scheduleId] = selectedEvent.id.split('-')
      
      console.log('[LIFF] Submitting leave request:', {
        classId,
        scheduleId,
        studentId: selectedEvent.extendedProps.studentId
      })
      
      // Call API to create makeup request
      const response = await fetch('/api/liff/leave-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: selectedEvent.extendedProps.studentId,
          classId: classId,
          scheduleId: scheduleId,
          reason: 'ลาผ่านระบบ LIFF',
          type: 'scheduled', // Since parent requests in advance
        })
      })

      const data = await response.json()
      console.log('[LIFF] Leave request response:', data)

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด')
      }

      // Show success message with quota info if available
      if (data.quotaDetails) {
        toast.success('บันทึกการลาเรียนเรียบร้อยแล้ว', {
          description: `รอนัดเรียนชดเชย (ใช้สิทธิ์ ${data.quotaDetails.total}/${data.quotaLimit} - ลา ${data.quotaDetails.scheduled} + ขาด ${data.quotaDetails.absences})`
        })
      } else if (data.quotaUsed && data.quotaLimit) {
        toast.success('บันทึกการลาเรียนเรียบร้อยแล้ว', {
          description: `รอเจ้าหน้าที่นัดเรียนชดเชย (ใช้สิทธิ์ ${data.quotaUsed}/${data.quotaLimit} ครั้ง)`
        })
      } else {
        toast.success('บันทึกการลาเรียนเรียบร้อยแล้ว', {
          description: 'รอเจ้าหน้าที่นัดหมายวันเรียนชดเชยใหม่'
        })
      }
      
      setDialogOpen(false)
      setConfirmLeaveOpen(false)
      setSelectedEvent(null)
      
      // Force refresh to show red color
      if (forceRefresh) {
        setTimeout(() => {
          forceRefresh()
        }, 1000) // Increase delay
      }
    } catch (error) {
      console.error('[LIFF] Error submitting leave request:', error)
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถบันทึกการลาได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle event click
  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedEvent(event)
    setDialogOpen(true)
  }

  // Show loading while checking auth or loading initial data
  if (liffLoading || !authChecked || (loading && !dataLoaded)) {
    return <PageLoading />
  }

  // Get stats for selected student
  const selectedStudent = students.find(s => s.student.id === selectedStudentId)
  const selectedStudentStats = selectedStudentId && overallStats[selectedStudentId]
    ? overallStats[selectedStudentId]
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/liff')}
            className="text-white hover:text-white/80 -ml-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">ตารางเรียน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Student Selector - Simple buttons */}
        {students.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={!selectedStudentId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStudentId('')}
              className="whitespace-nowrap"
            >
              ทุกคน
            </Button>
            {students.map((data) => (
              <Button
                key={data.student.id}
                variant={selectedStudentId === data.student.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStudentId(data.student.id)}
                className="whitespace-nowrap"
              >
                {data.student.nickname || data.student.name}
              </Button>
            ))}
          </div>
        )}

        {/* Tabs */}
        {students.length === 0 && !loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">ไม่มีข้อมูลตารางเรียน</p>
                <Button onClick={() => router.push('/liff/profile')}>
                  กลับไปหน้าโปรไฟล์
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list" className="text-xs">
                <List className="h-4 w-4 mr-1" />
                รายการ
              </TabsTrigger>
              <TabsTrigger value="course" className="text-xs">
                <CalendarDays className="h-4 w-4 mr-1" />
                ปฏิทินคอร์ส
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs">
                <CalendarRange className="h-4 w-4 mr-1" />
                รายเดือน
              </TabsTrigger>
            </TabsList>

            {/* List View */}
            <TabsContent value="list" className="mt-4">
              {loading ? (
                <SectionLoading />
              ) : (
                <CourseList 
                  events={events}
                  selectedStudentId={selectedStudentId}
                  students={students}
                  onLeaveRequest={handleLeaveRequest}
                />
              )}
            </TabsContent>

            {/* Course Calendar View */}
            <TabsContent value="course" className="mt-4">
              {loading ? (
                <SectionLoading />
              ) : (
                <CourseCalendar 
                  events={events}
                  selectedStudentId={selectedStudentId}
                  students={students}
                  onLeaveRequest={handleLeaveRequest}
                />
              )}
            </TabsContent>

            {/* Monthly Calendar View */}
            <TabsContent value="monthly" className="mt-4">
              {loading ? (
                <SectionLoading />
              ) : (
                <MonthlyCalendar 
                  events={events}
                  selectedStudentId={selectedStudentId}
                  students={students}
                  onEventClick={handleEventClick}
                />
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Statistics - Show only in list view */}
        {activeTab === 'list' && selectedStudentStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {loadingStats ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : (
                    selectedStudentStats.totalClasses
                  )}
                </p>
                <p className="text-xs text-muted-foreground">คลาสทั้งหมด</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {loadingStats ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : (
                    selectedStudentStats.completedClasses
                  )}
                </p>
                <p className="text-xs text-muted-foreground">เรียนแล้ว</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {loadingStats ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : (
                    selectedStudentStats.upcomingClasses
                  )}
                </p>
                <p className="text-xs text-muted-foreground">กำลังจะถึง</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {loadingStats ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : (
                    selectedStudentStats.makeupClasses
                  )}
                </p>
                <p className="text-xs text-muted-foreground">เรียนชดเชย</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              รายละเอียดคลาสเรียน
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {/* Student Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {selectedEvent.extendedProps.studentNickname || selectedEvent.extendedProps.studentName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.extendedProps.studentName}
                  </p>
                </div>
              </div>

              {/* Class Type Badge */}
              <div>
                {selectedEvent.extendedProps.type === 'makeup' ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    Makeup Class
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    คลาสปกติ
                  </Badge>
                )}
              </div>

              {/* Class Details */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">คลาสเรียน</p>
                  <div className="font-medium flex items-center gap-2">
                    {selectedEvent.extendedProps.subjectColor && (
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: selectedEvent.extendedProps.subjectColor }}
                      />
                    )}
                    <span>
                      {selectedEvent.extendedProps.type === 'makeup' 
                        ? selectedEvent.extendedProps.originalClassName 
                        : selectedEvent.extendedProps.className || selectedEvent.extendedProps.subjectName}
                      {selectedEvent.extendedProps.sessionNumber && selectedEvent.extendedProps.type !== 'makeup' && (
                        <span className="text-muted-foreground ml-2">
                          (ครั้งที่ {selectedEvent.extendedProps.sessionNumber})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">วันที่และเวลา</p>
                  <p className="font-medium">
                    {selectedEvent.start.toLocaleDateString('th-TH', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm">
                    {selectedEvent.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - 
                    {selectedEvent.end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">สถานที่</p>
                  <p className="font-medium">{selectedEvent.extendedProps.branchName}</p>
                  <p className="text-sm">ห้อง {selectedEvent.extendedProps.roomName}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">ครูผู้สอน</p>
                  <p className="font-medium">ครู{selectedEvent.extendedProps.teacherName}</p>
                </div>
              </div>

              {/* Status */}
              {selectedEvent.extendedProps.status === 'completed' && (
                <div className="pt-3 border-t">
                  <Badge className="w-full justify-center" variant="default">
                    เรียนเสร็จแล้ว
                  </Badge>
                </div>
              )}
              
              {(selectedEvent.extendedProps.status === 'absent' || selectedEvent.extendedProps.status === 'leave-requested') && (
                <div className="pt-3 border-t">
                  <Badge className="w-full justify-center bg-red-600 hover:bg-red-700">
                    ลาเรียน
                  </Badge>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {selectedEvent.extendedProps.makeupScheduled 
                      ? `นัดเรียนชดเชย: ${new Date(selectedEvent.extendedProps.makeupDate!).toLocaleDateString('th-TH')} เวลา ${selectedEvent.extendedProps.makeupTime}`
                      : 'รอเจ้าหน้าที่นัดเรียนชดเชย'}
                  </p>
                </div>
              )}
              
              {/* Leave Request Button */}
              {selectedEvent.extendedProps.type === 'class' && 
               selectedEvent.extendedProps.status !== 'completed' &&
               selectedEvent.extendedProps.status !== 'absent' &&
               selectedEvent.extendedProps.status !== 'leave-requested' &&
               new Date(selectedEvent.start) > new Date() && (
                <div className="pt-3 border-t">
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={() => handleLeaveRequest(selectedEvent)}
                  >
                    ขอลาเรียน
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Leave Dialog */}
      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ยืนยันการขอลาเรียน
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {selectedEvent && (
              <>
                <div>คุณต้องการขอลาเรียนสำหรับ:</div>
                <div className="bg-gray-50 p-3 rounded-md space-y-1 text-foreground">
                  <p className="font-medium">{selectedEvent.extendedProps.studentNickname || selectedEvent.extendedProps.studentName}</p>
                  <p className="text-sm">
                    คลาส: {selectedEvent.extendedProps.className || selectedEvent.extendedProps.subjectName}
                    {selectedEvent.extendedProps.sessionNumber && (
                      <span className="text-muted-foreground"> (ครั้งที่ {selectedEvent.extendedProps.sessionNumber})</span>
                    )}
                  </p>
                  <p className="text-sm">
                    วันที่: {selectedEvent.start.toLocaleDateString('th-TH', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm">
                    เวลา: {selectedEvent.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground mt-3">
                  หลังจากยืนยันการลา ระบบจะแจ้งให้เจ้าหน้าที่นัดหมายวันเรียนชดเชยให้
                </div>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={submitLeaveRequest}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  กำลังบันทึก...
                </>
              ) : (
                'ยืนยันการลา'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">กำลังบันทึกการลาเรียน...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SchedulePage() {
  return (
    <LiffProvider requireLogin={true}>
      <ScheduleContent />
    </LiffProvider>
  );
}
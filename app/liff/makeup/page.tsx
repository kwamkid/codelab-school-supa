'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, Loader2, Calendar, CalendarOff, AlertCircle, CheckCircle, Clock, MapPin, User, Info, X } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { getParentByLineId, getStudentsByParent } from '@/lib/services/parents'
import { getMakeupClassesByStudent } from '@/lib/services/makeup'
import { getClass, getClassSchedules } from '@/lib/services/classes'
import { getTeacher } from '@/lib/services/teachers'
import { getBranch } from '@/lib/services/branches'
import { getRoom } from '@/lib/services/rooms'
import { getSubject } from '@/lib/services/subjects'
import { getEnrollmentsByStudent } from '@/lib/services/enrollments'
import { toast } from 'sonner'
import { LiffProvider } from '@/components/liff/liff-provider'
import { PageLoading } from '@/components/ui/loading'
import { formatDate, formatTime, getDayName } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ClassMakeupData {
  classId: string
  className: string
  subjectName: string
  subjectColor?: string
  makeups: any[]
  stats: {
    total: number
    pending: number
    scheduled: number
    completed: number
    selfRequested: number
    absences: number
    systemGenerated: number
    totalUsed: number
    quotaRemaining: number
  }
}

interface StudentMakeupData {
  student: {
    id: string
    name: string
    nickname?: string
  }
  classes: Record<string, ClassMakeupData>
  overallStats: {
    totalMakeups: number
    totalPending: number
    totalScheduled: number
    totalCompleted: number
  }
}

function MakeupContent() {
  const router = useRouter()
  const { profile, isLoggedIn, isLoading: liffLoading, liff } = useLiff()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [makeupData, setMakeupData] = useState<Record<string, StudentMakeupData>>({})
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [activeTab, setActiveTab] = useState('leave')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [selectedMakeup, setSelectedMakeup] = useState<any>(null)

  const MAKEUP_QUOTA = 4

  useEffect(() => {
    if (!liffLoading && isLoggedIn && profile?.userId) {
      loadData()
    } else if (!liffLoading && !isLoggedIn && liff) {
      liff.login()
    }
  }, [liffLoading, isLoggedIn, profile, liff])

  const loadData = async () => {
    if (!profile?.userId) return

    try {
      setLoading(true)

      const parent = await getParentByLineId(profile.userId)
      if (!parent) {
        toast.error('ไม่พบข้อมูลผู้ปกครอง')
        return
      }

      const studentsData = await getStudentsByParent(parent.id)
      const activeStudents = studentsData.filter(s => s.isActive)
      setStudents(activeStudents)

      const makeupDataMap: Record<string, StudentMakeupData> = {}
      let firstStudentWithData: string | null = null
      let firstClassWithData: string | null = null
      
      for (const student of activeStudents) {
        const makeups = await getMakeupClassesByStudent(student.id)
        const enrollments = await getEnrollmentsByStudent(student.id)
        const activeEnrollments = enrollments.filter(e => e.status === 'active')
        
        const classMakeupData: Record<string, ClassMakeupData> = {}
        
        for (const enrollment of activeEnrollments) {
          const classData = await getClass(enrollment.classId)
          if (!classData) continue
          
          const subject = await getSubject(classData.subjectId)
          const classMakeups = makeups.filter(m => m.originalClassId === enrollment.classId)
          
          const selfRequested = classMakeups.filter(m => 
            m.type === 'scheduled' && 
            (m.requestedBy === 'parent-liff' || m.reason?.includes('ลาผ่านระบบ LIFF'))
          ).length
          
          const systemGenerated = classMakeups.filter(m => 
            m.type === 'ad-hoc' && 
            m.requestedBy !== 'parent-liff'
          ).length
          
          let absences = 0
          try {
            const schedules = await getClassSchedules(enrollment.classId)
            schedules.forEach(schedule => {
              if (schedule.attendance) {
                const studentAttendance = schedule.attendance.find(
                  att => att.studentId === student.id && att.status === 'absent'
                )
                if (studentAttendance) {
                  const hasMakeup = classMakeups.some(m => 
                    m.originalScheduleId === schedule.id
                  )
                  if (!hasMakeup) {
                    absences++
                  }
                }
              }
            })
          } catch (error) {
            console.error('Error counting absences:', error)
          }
          
          const makeupsWithDetails = await Promise.all(
            classMakeups.map(async (makeup) => {
              try {
                let originalTeacher = null
                let branch = null
                let room = null
                let makeupBranch = null
                let makeupRoom = null
                let makeupTeacher = null

                if (classData) {
                  [originalTeacher, branch, room] = await Promise.all([
                    getTeacher(classData.teacherId),
                    getBranch(classData.branchId),
                    getRoom(classData.branchId, classData.roomId)
                  ])
                }

                if (makeup.makeupSchedule) {
                  [makeupBranch, makeupRoom, makeupTeacher] = await Promise.all([
                    getBranch(makeup.makeupSchedule.branchId),
                    getRoom(makeup.makeupSchedule.branchId, makeup.makeupSchedule.roomId),
                    makeup.makeupSchedule.teacherId ? getTeacher(makeup.makeupSchedule.teacherId) : null
                  ])
                }

                return {
                  ...makeup,
                  className: classData?.name,
                  subjectName: subject?.name,
                  subjectColor: subject?.color,
                  originalTeacherName: originalTeacher?.nickname || originalTeacher?.name,
                  branchName: branch?.name,
                  roomName: room?.name,
                  makeupBranchName: makeupBranch?.name,
                  makeupRoomName: makeupRoom?.name,
                  makeupTeacher
                }
              } catch (error) {
                console.error('Error loading makeup details:', error)
                return makeup
              }
            })
          )
          
          const sortedMakeups = makeupsWithDetails.sort((a, b) => {
            const dateA = a.originalSessionDate?.toDate ? 
              a.originalSessionDate.toDate() : new Date(a.originalSessionDate)
            const dateB = b.originalSessionDate?.toDate ? 
              b.originalSessionDate.toDate() : new Date(b.originalSessionDate)
            return dateA.getTime() - dateB.getTime()
          })
          
          const totalUsed = selfRequested + absences
          const quotaRemaining = Math.max(0, MAKEUP_QUOTA - totalUsed)
          
          classMakeupData[enrollment.classId] = {
            classId: enrollment.classId,
            className: classData.name,
            subjectName: subject?.name || '',
            subjectColor: subject?.color,
            makeups: sortedMakeups,
            stats: {
              total: classMakeups.length,
              pending: classMakeups.filter(m => m.status === 'pending').length,
              scheduled: classMakeups.filter(m => m.status === 'scheduled').length,
              completed: classMakeups.filter(m => m.status === 'completed').length,
              selfRequested,
              absences,
              systemGenerated,
              totalUsed,
              quotaRemaining
            }
          }
          
          if (!firstClassWithData && classMakeups.length > 0) {
            firstClassWithData = enrollment.classId
          }
        }
        
        const overallStats = {
          totalMakeups: Object.values(classMakeupData).reduce((sum, c) => sum + c.stats.total, 0),
          totalPending: Object.values(classMakeupData).reduce((sum, c) => sum + c.stats.pending, 0),
          totalScheduled: Object.values(classMakeupData).reduce((sum, c) => sum + c.stats.scheduled, 0),
          totalCompleted: Object.values(classMakeupData).reduce((sum, c) => sum + c.stats.completed, 0)
        }
        
        makeupDataMap[student.id] = {
          student: {
            id: student.id,
            name: student.name,
            nickname: student.nickname
          },
          classes: classMakeupData,
          overallStats
        }
        
        if (!firstStudentWithData && overallStats.totalMakeups > 0) {
          firstStudentWithData = student.id
        }
      }

      setMakeupData(makeupDataMap)
      
      if (activeStudents.length === 1) {
        setSelectedStudentId(activeStudents[0].id)
        const studentData = makeupDataMap[activeStudents[0].id]
        if (studentData) {
          const classIds = Object.keys(studentData.classes)
          if (classIds.length > 0) {
            setSelectedClassId(classIds[0])
          }
        }
      } else if (firstStudentWithData) {
        setSelectedStudentId(firstStudentWithData)
        setSelectedClassId(firstClassWithData || '')
      } else if (activeStudents.length > 0) {
        setSelectedStudentId(activeStudents[0].id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelLeave = (makeup: any) => {
    setSelectedMakeup(makeup)
    setConfirmCancelOpen(true)
  }

  const submitCancelLeave = async () => {
    if (!selectedMakeup) return

    try {
      setCancellingId(selectedMakeup.id)
      
      const response = await fetch('/api/liff/cancel-leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          makeupId: selectedMakeup.id,
          studentId: selectedMakeup.studentId,
          classId: selectedMakeup.originalClassId,
          scheduleId: selectedMakeup.originalScheduleId
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'เกิดข้อผิดพลาด')
      }

      toast.success('ยกเลิกการลาเรียนเรียบร้อยแล้ว')
      setConfirmCancelOpen(false)
      
      await loadData()
    } catch (error) {
      console.error('Error cancelling leave:', error)
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถยกเลิกการลาได้')
    } finally {
      setCancellingId(null)
    }
  }

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId)
    const studentData = makeupData[studentId]
    if (studentData) {
      const classIds = Object.keys(studentData.classes)
      if (classIds.length > 0) {
        setSelectedClassId(classIds[0])
      } else {
        setSelectedClassId('')
      }
    }
  }

  const selectedStudentData = selectedStudentId ? makeupData[selectedStudentId] : null
  const selectedClassData = selectedStudentData && selectedClassId ? 
    selectedStudentData.classes[selectedClassId] : null
  
  const canRequestMore = selectedClassData ? 
    selectedClassData.stats.totalUsed < MAKEUP_QUOTA : true

  if (liffLoading || loading) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
          <h1 className="text-xl font-bold">ข้อมูลการลาและเรียนชดเชย</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {students.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {students.map((student) => (
              <Button
                key={student.id}
                variant={selectedStudentId === student.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleStudentChange(student.id)}
                className="whitespace-nowrap"
              >
                {student.nickname || student.name}
              </Button>
            ))}
          </div>
        )}

        {selectedStudentData && Object.keys(selectedStudentData.classes).length > 0 && (
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกคลาส" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(selectedStudentData.classes).map((classData) => (
                <SelectItem key={classData.classId} value={classData.classId}>
                  <div className="flex items-center gap-2">
                    {classData.subjectColor && (
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: classData.subjectColor }}
                      />
                    )}
                    <span>{classData.className}</span>
                    {classData.stats.totalUsed > 0 && (
                      <span className="text-xs text-muted-foreground">
                        (ใช้ {classData.stats.totalUsed}/{MAKEUP_QUOTA})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedClassData && (
          <Alert className={cn(
            "border",
            canRequestMore ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"
          )}>
            <Info className={cn(
              "h-4 w-4",
              canRequestMore ? "text-blue-600" : "text-orange-600"
            )} />
            <AlertDescription>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className={canRequestMore ? "text-blue-700" : "text-orange-700"}>
                    สิทธิ์ Makeup คลาส {selectedClassData.className}: ใช้ไป {selectedClassData.stats.totalUsed} จาก {MAKEUP_QUOTA} ครั้ง
                  </span>
                  {!canRequestMore && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      เต็มแล้ว
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  (ลาล่วงหน้า {selectedClassData.stats.selfRequested} + ขาดเรียน {selectedClassData.stats.absences} ครั้ง)
                  {selectedClassData.stats.systemGenerated > 0 && (
                    <span className="text-gray-500">
                      {' '}• Makeup จากระบบ {selectedClassData.stats.systemGenerated} ครั้ง (ไม่นับใน quota)
                    </span>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {students.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CalendarOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">ไม่พบข้อมูลนักเรียน</p>
                <Button onClick={() => router.push('/liff')}>
                  กลับหน้าหลัก
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !selectedClassData || selectedClassData.makeups.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CalendarOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">ไม่มีประวัติการลาเรียนในคลาสนี้</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {selectedClassData.stats.selfRequested + selectedClassData.stats.absences}
                  </p>
                  <p className="text-xs text-muted-foreground">ลา/ขาด</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {selectedClassData.stats.quotaRemaining}
                  </p>
                  <p className="text-xs text-muted-foreground">โควต้าคงเหลือ</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {selectedClassData.stats.pending}
                  </p>
                  <p className="text-xs text-muted-foreground">รอนัด Makeup</p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="leave">วันที่ลา</TabsTrigger>
                <TabsTrigger value="makeup">ตารางเรียนชดเชย</TabsTrigger>
              </TabsList>

              <TabsContent value="leave" className="space-y-3">
                {selectedClassData.makeups.map((makeup) => {
                  const now = new Date()
                  const originalDate = makeup.originalSessionDate?.toDate ? 
                    makeup.originalSessionDate.toDate() : new Date(makeup.originalSessionDate)
                  const canCancel = makeup.status === 'pending' && 
                                   originalDate > now &&
                                   makeup.requestedBy === 'parent-liff'
                  
                  return (
                    <Card key={makeup.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {selectedClassData.subjectColor && (
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: selectedClassData.subjectColor }}
                              />
                            )}
                            <div>
                              <p className="font-medium">{selectedClassData.className}</p>
                              <p className="text-sm text-muted-foreground">
                                ครั้งที่ {makeup.originalSessionNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                makeup.status === 'completed' ? 'default' :
                                makeup.status === 'scheduled' ? 'secondary' :
                                makeup.status === 'cancelled' ? 'destructive' : 'outline'
                              }
                              className="text-xs"
                            >
                              {makeup.status === 'pending' ? 'รอนัด' :
                               makeup.status === 'scheduled' ? 'นัดแล้ว' :
                               makeup.status === 'completed' ? 'เรียนแล้ว' : 
                               'ยกเลิก'}
                            </Badge>
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleCancelLeave(makeup)}
                                disabled={cancellingId === makeup.id}
                              >
                                {cancellingId === makeup.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    ยกเลิก
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>วันที่ลา: {formatDate(makeup.originalSessionDate, 'long')}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            <span>เหตุผล: {makeup.reason}</span>
                          </div>

                          {makeup.requestedBy === 'parent-liff' && makeup.type === 'scheduled' && (
                            <div className="flex items-center gap-2 text-blue-600">
                              <Info className="h-4 w-4" />
                              <span className="text-xs">ลาผ่านระบบ (นับใน quota)</span>
                            </div>
                          )}
                          
                          {makeup.type === 'ad-hoc' && (
                            <div className="flex items-center gap-2 text-gray-500">
                              <Info className="h-4 w-4" />
                              <span className="text-xs">Makeup จากระบบ (ไม่นับใน quota)</span>
                            </div>
                          )}

                          {makeup.status === 'scheduled' && makeup.makeupSchedule && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="font-medium text-green-600 mb-1">นัดเรียนชดเชย:</p>
                              <p className="text-muted-foreground">
                                {formatDate(makeup.makeupSchedule.date, 'long')} 
                                {' '}เวลา {formatTime(makeup.makeupSchedule.startTime)} - {formatTime(makeup.makeupSchedule.endTime)}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </TabsContent>

              <TabsContent value="makeup" className="space-y-3">
                {selectedClassData.makeups
                  .filter(m => m.status === 'scheduled' || m.status === 'completed')
                  .sort((a, b) => {
                    const dateA = a.makeupSchedule?.date?.toDate ? 
                      a.makeupSchedule.date.toDate() : new Date(a.makeupSchedule?.date)
                    const dateB = b.makeupSchedule?.date?.toDate ? 
                      b.makeupSchedule.date.toDate() : new Date(b.makeupSchedule?.date)
                    return dateA - dateB
                  })
                  .map((makeup) => {
                    const makeupDate = makeup.makeupSchedule?.date?.toDate ? 
                      makeup.makeupSchedule.date.toDate() : new Date(makeup.makeupSchedule?.date)
                    const isPast = makeupDate < new Date()
                    
                    return (
                      <Card key={makeup.id} className={isPast ? 'opacity-75' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">{selectedClassData.className}</p>
                              <p className="text-sm text-muted-foreground">
                                แทนครั้งที่ {makeup.originalSessionNumber}
                              </p>
                            </div>
                            <Badge 
                              variant={makeup.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {makeup.status === 'completed' ? 'เรียนแล้ว' : 'นัดแล้ว'}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span className="font-medium">
                                {getDayName(makeupDate.getDay())}, {formatDate(makeupDate, 'long')}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>
                                {formatTime(makeup.makeupSchedule.startTime)} - {formatTime(makeup.makeupSchedule.endTime)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>
                                {makeup.makeupBranchName} - ห้อง {makeup.makeupRoomName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>
                                ครู{makeup.makeupTeacher?.nickname || makeup.makeupTeacher?.name}
                              </span>
                            </div>

                            {makeup.attendance && (
                              <div className="mt-3 pt-3 border-t">
                                {makeup.attendance.status === 'present' ? (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>เข้าเรียนแล้ว</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-red-600">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>ขาดเรียน</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  
                {selectedClassData.makeups.filter(m => m.status === 'scheduled' || m.status === 'completed').length === 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">ยังไม่มีตารางเรียนชดเชย</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ยืนยันการยกเลิกการลา
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {selectedMakeup && (
              <>
                <div>คุณต้องการยกเลิกการลาเรียนสำหรับ:</div>
                <div className="bg-gray-50 p-3 rounded-md space-y-1 text-foreground">
                  <p className="font-medium">{selectedClassData?.className}</p>
                  <p className="text-sm">
                    ครั้งที่ {selectedMakeup.originalSessionNumber}
                  </p>
                  <p className="text-sm">
                    วันที่: {formatDate(selectedMakeup.originalSessionDate, 'long')}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground mt-3">
                  หากยกเลิกการลา นักเรียนจะต้องมาเรียนตามปกติในวันดังกล่าว
                </div>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingId}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={submitCancelLeave}
              disabled={!!cancellingId}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancellingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  กำลังยกเลิก...
                </>
              ) : (
                'ยืนยันการยกเลิก'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function MakeupPage() {
  return (
    <LiffProvider requireLogin={true}>
      <MakeupContent />
    </LiffProvider>
  )
}
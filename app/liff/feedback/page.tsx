'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, Loader2, MessageSquare, Calendar, User, BookOpen, School } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { LiffProvider } from '@/components/liff/liff-provider'
import { PageLoading } from '@/components/ui/loading'
import { getParentByLineId, getStudentsByParent } from '@/lib/services/parents'
import { getStudentFeedbackHistory } from '@/lib/services/feedback'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface FeedbackData {
  id: string
  studentId: string
  studentName: string
  className: string
  subjectName: string
  sessionNumber: number
  sessionDate: Date
  feedback: string
  teacherName: string
}

function FeedbackContent() {
  const router = useRouter()
  const { profile, isLoggedIn, isLoading: liffLoading } = useLiff()
  const [loading, setLoading] = useState(true)
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  
  useEffect(() => {
    if (!liffLoading && isLoggedIn && profile?.userId) {
      loadData()
    }
  }, [liffLoading, isLoggedIn, profile])

  const loadData = async () => {
    if (!profile?.userId) return

    try {
      setLoading(true)
      
      // Get parent and students
      const parent = await getParentByLineId(profile.userId)
      if (!parent) {
        toast.error('ไม่พบข้อมูลผู้ปกครอง')
        return
      }

      const studentsData = await getStudentsByParent(parent.id)
      setStudents(studentsData.filter(s => s.isActive))
      
      if (studentsData.length > 0) {
        // Default to first student
        const defaultStudentId = studentsData[0].id
        setSelectedStudentId(defaultStudentId)
        
        // Load feedback for all students
        const allFeedbacks: FeedbackData[] = []
        for (const student of studentsData) {
          const feedbacks = await getStudentFeedbackHistory(student.id)
          allFeedbacks.push(...feedbacks.map(f => ({
            ...f,
            studentName: student.nickname || student.name
          })))
        }
        
        setFeedbacks(allFeedbacks.sort((a, b) => 
          b.sessionDate.getTime() - a.sessionDate.getTime()
        ))
      }
    } catch (error) {
      console.error('Error loading feedback:', error)
      toast.error('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(f => {
    if (selectedStudentId && f.studentId !== selectedStudentId) return false
    if (selectedSubject !== 'all' && f.subjectName !== selectedSubject) return false
    return true
  })

  // Get unique subjects
  const subjects = [...new Set(feedbacks.map(f => f.subjectName))]

  if (loading || liffLoading) return <PageLoading />

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
          <h1 className="text-xl font-bold">Teacher Feedback</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Student Selector */}
        {students.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {students.map((student) => (
              <Button
                key={student.id}
                variant={selectedStudentId === student.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStudentId(student.id)}
                className="whitespace-nowrap"
              >
                {student.nickname || student.name}
              </Button>
            ))}
          </div>
        )}

        {/* Subject Filter */}
        <Tabs value={selectedSubject} onValueChange={setSelectedSubject} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${subjects.length + 1}, 1fr)` }}>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            {subjects.map(subject => (
              <TabsTrigger key={subject} value={subject} className="text-xs">
                {subject}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Feedback List */}
        {filteredFeedbacks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">ยังไม่มี feedback จากครู</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredFeedbacks.map((feedback) => (
              <Card key={feedback.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{feedback.className}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <BookOpen className="h-3 w-3" />
                        <span>{feedback.subjectName}</span>
                        <span>•</span>
                        <span>ครั้งที่ {feedback.sessionNumber}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {formatDate(feedback.sessionDate, 'short')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{feedback.feedback}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>ครู{feedback.teacherName}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  return (
    <LiffProvider requireLogin={true}>
      <FeedbackContent />
    </LiffProvider>
  )
}
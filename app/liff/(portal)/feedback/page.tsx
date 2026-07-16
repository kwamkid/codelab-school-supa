'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, MessageSquare, Calendar, User, School } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { StudentBadge } from '@/components/ui/student-badge'
import { TeacherBadge } from '@/components/ui/teacher-badge'
import { PageLoading } from '@/components/ui/loading'
import { formatDate } from '@/lib/utils'
import { liffFetch } from '@/lib/line/liff-fetch'
import { getLiffCache, setLiffCache } from '@/lib/line/liff-cache'
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
  photos: string[]
  teacherName: string
  teacherImage?: string | null
}

// Cache stores raw (string) dates — sessionStorage JSON round-trips them — so
// revive to Date at read time.
const reviveFeedbacks = (list: any[]): FeedbackData[] =>
  (list || []).map((f: any) => ({ ...f, sessionDate: new Date(f.sessionDate) }))

function FeedbackContent() {
  const { profile, isLoggedIn, isLoading: liffLoading } = useLiff()
  const cacheKey = profile?.userId ? `feedback:${profile.userId}` : null
  const cached = cacheKey ? getLiffCache<{ students: any[]; feedbacks: any[] }>(cacheKey) : undefined
  const [loading, setLoading] = useState(!cached)
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>(cached ? reviveFeedbacks(cached.feedbacks) : [])
  const [students, setStudents] = useState<any[]>(cached?.students ?? [])
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
      // Only show the loader on first load (no cache); revalidate silently otherwise.
      if (feedbacks.length === 0) setLoading(true)

      // Fetch via server route (service role + verified LINE ID token)
      const json = await liffFetch('/api/liff/feedback', { lineUserId: profile.userId })

      const studentsData = json.students || []
      setStudents(studentsData)

      setFeedbacks(reviveFeedbacks(json.feedbacks || []))
      // Cache the raw payload (JSON-safe for the sessionStorage layer).
      if (cacheKey) setLiffCache(cacheKey, { students: studentsData, feedbacks: json.feedbacks || [] })
    } catch (error) {
      console.error('Error loading feedback:', error)
      toast.error(error instanceof Error ? `โหลด feedback ไม่ได้: ${error.message}` : 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  // Scope everything to the selected student first, so the subject chips show
  // that student's courses (not a global list that ignores the selection).
  const studentFeedbacks = selectedStudentId
    ? feedbacks.filter(f => f.studentId === selectedStudentId)
    : feedbacks
  const subjects = [...new Set(studentFeedbacks.map(f => f.subjectName))]
  const filteredFeedbacks = studentFeedbacks.filter(
    f => selectedSubject === 'all' || f.subjectName === selectedSubject
  )

  if (loading || liffLoading) return <PageLoading />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 pt-6">
        <h1 className="text-xl font-bold">Teacher Feedback</h1>
      </div>

      <div className="p-3 space-y-3">
        {/* Student Selector */}
        {students.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={!selectedStudentId ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSelectedStudentId(''); setSelectedSubject('all') }}
              className="whitespace-nowrap"
            >
              ทุกคน
            </Button>
            {students.map((student) => (
              <Button
                key={student.id}
                variant={selectedStudentId === student.id ? "default" : "outline"}
                size="sm"
                // Reset the subject filter — the new student's courses differ,
                // and a stale subject would show an empty list.
                onClick={() => { setSelectedStudentId(student.id); setSelectedSubject('all') }}
                className="whitespace-nowrap"
              >
                {student.nickname || student.name}
              </Button>
            ))}
          </div>
        )}

        {/* Subject Filter — scrolls horizontally so 3+ course names don't squeeze */}
        <Tabs value={selectedSubject} onValueChange={setSelectedSubject} className="w-full">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              {subjects.map(subject => (
                <TabsTrigger key={subject} value={subject} className="text-xs whitespace-nowrap">
                  {subject}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
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
          <div className="space-y-3">
            {filteredFeedbacks.map((feedback) => (
              <Card key={feedback.id}>
                {/* Card's own gap separates header/content — extra pb just stacks */}
                <CardHeader className="pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      {/* Same title/badge treatment as the home + schedule cards */}
                      <CardTitle className="text-lg">{feedback.subjectName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>ครั้งที่ {feedback.sessionNumber}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StudentBadge name={feedback.studentName} size="md" />
                      <span className="text-xs text-muted-foreground">{formatDate(feedback.sessionDate, 'short')}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {feedback.feedback && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-base font-normal whitespace-pre-wrap">{feedback.feedback}</p>
                      </div>
                    )}
                    {feedback.photos && feedback.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {feedback.photos.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt="รูปจากครู"
                              className="h-28 w-28 rounded-lg object-cover border"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <TeacherBadge name={feedback.teacherName} imageUrl={feedback.teacherImage} size="sm" />
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
      <FeedbackContent />
  )
}
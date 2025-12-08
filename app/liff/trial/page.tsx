// app/liff/trial/page.tsx

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GradeLevelCombobox } from "@/components/ui/grade-level-combobox"
import { 
  Loader2, 
  Phone, 
  Mail, 
  User,
  MapPin,
  School,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Users,
  MessageCircle,
  AlertTriangle,
  Search,
  Check,
  Calendar,
  Cake
} from 'lucide-react'
import { toast } from 'sonner'
import { Branch, Subject } from '@/types/models'
import Image from 'next/image'

interface StudentForm {
  name: string
  birthdate: string
  schoolName: string
  gradeLevel: string
  subjectInterests: string[]
}

// Calculate age from birthdate
function calculateAge(birthdate: Date): number {
  const today = new Date()
  const birthDate = new Date(birthdate)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

// Subject Selector Component
function SubjectSelector({ 
  subjects, 
  selectedSubjects, 
  onToggle 
}: {
  subjects: Subject[]
  selectedSubjects: string[]
  onToggle: (subjectId: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  
  // Sort subjects alphabetically and filter by search
  const filteredSubjects = useMemo(() => {
    let filtered = [...subjects]
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(subject => 
        subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subject.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subject.level.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Sort alphabetically by name
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'th'))
    
    return filtered
  }, [subjects, searchTerm])
  
  return (
    <div className="space-y-3">
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="ค้นหาวิชา..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Subject Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredSubjects.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>ไม่พบวิชาที่ค้นหา</p>
          </div>
        ) : (
          filteredSubjects.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.id)
            return (
              <div
                key={subject.id}
                onClick={() => onToggle(subject.id)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{subject.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {subject.category} • {subject.level}
                    </div>
                    {subject.ageRange && (
                      <div className="text-xs text-gray-400 mt-1">
                        อายุ {subject.ageRange.min}-{subject.ageRange.max} ปี
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="ml-2 flex-shrink-0">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                {isSelected && (
                  <Badge className="mt-2 bg-green-100 text-green-700 border-green-300">
                    เลือกแล้ว
                  </Badge>
                )}
              </div>
            )
          })
        )}
      </div>
      
      {/* Selected count */}
      {selectedSubjects.length > 0 && (
        <div className="text-sm text-gray-600 text-center pt-2 border-t">
          เลือกแล้ว {selectedSubjects.length} วิชา
        </div>
      )}
    </div>
  )
}

export default function TrialBookingPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  
  // Form data
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [contactNote, setContactNote] = useState('')
  
  // Students
  const [students, setStudents] = useState<StudentForm[]>([{
    name: '',
    birthdate: '',
    schoolName: '',
    gradeLevel: '',
    subjectInterests: []
  }])

  // Debug function
  const addDebugLog = (message: string) => {
    console.log(`[Trial Booking] ${message}`)
    setDebugInfo(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  // Load initial data
  useEffect(() => {
    let mounted = true
    
    const loadInitialData = async () => {
      try {
        addDebugLog('Starting to load initial data...')
        setLoading(true)
        setError(null)
        
        // Check if we're in browser
        if (typeof window === 'undefined') {
          addDebugLog('Not in browser environment, skipping load')
          return
        }
        
        addDebugLog('In browser environment, proceeding...')
        
        // Try to load branches
        try {
          addDebugLog('Loading branches...')
          const { getActiveBranches } = await import('@/lib/services/branches')
          const branchesData = await getActiveBranches()
          addDebugLog(`Loaded ${branchesData.length} branches`)
          
          if (mounted) {
            setBranches(branchesData.filter(b => b.isActive))
            addDebugLog(`Set ${branchesData.filter(b => b.isActive).length} active branches`)
          }
        } catch (branchError) {
          addDebugLog(`Error loading branches: ${branchError}`)
          console.error('Branch loading error:', branchError)
        }
        
        // Try to load subjects
        try {
          addDebugLog('Loading subjects...')
          const { getSubjects } = await import('@/lib/services/subjects')
          const subjectsData = await getSubjects()
          addDebugLog(`Loaded ${subjectsData.length} subjects`)
          
          if (mounted) {
            setSubjects(subjectsData.filter(s => s.isActive))
            addDebugLog(`Set ${subjectsData.filter(s => s.isActive).length} active subjects`)
          }
        } catch (subjectError) {
          addDebugLog(`Error loading subjects: ${subjectError}`)
          console.error('Subject loading error:', subjectError)
        }
        
        addDebugLog('Initial data load completed')
        
      } catch (error) {
        addDebugLog(`Critical error during load: ${error}`)
        console.error('Error loading data:', error)
        if (mounted) {
          setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่')
          toast.error('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่')
        }
      } finally {
        if (mounted) {
          setLoading(false)
          addDebugLog('Loading state set to false')
        }
      }
    }
    
    // Delay slightly to ensure client-side
    const timer = setTimeout(() => {
      loadInitialData()
    }, 100)
    
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  const addStudent = () => {
    setStudents([...students, {
      name: '',
      birthdate: '',
      schoolName: '',
      gradeLevel: '',
      subjectInterests: []
    }])
  }

  const removeStudent = (index: number) => {
    if (students.length > 1) {
      setStudents(students.filter((_, i) => i !== index))
    }
  }

  const updateStudent = (index: number, field: keyof StudentForm, value: any) => {
    const updated = [...students]
    updated[index] = { ...updated[index], [field]: value }
    setStudents(updated)
  }

  const toggleSubjectInterest = (studentIndex: number, subjectId: string) => {
    const updated = [...students]
    const interests = updated[studentIndex].subjectInterests
    
    if (interests.includes(subjectId)) {
      updated[studentIndex].subjectInterests = interests.filter(id => id !== subjectId)
    } else {
      updated[studentIndex].subjectInterests = [...interests, subjectId]
    }
    
    setStudents(updated)
  }

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setParentPhone(formatted)
  }

  const validateForm = (): boolean => {
    // Validate parent info
    if (!parentName.trim()) {
      toast.error('กรุณากรอกชื่อผู้ปกครอง')
      return false
    }
    
    if (!parentPhone || parentPhone.replace(/-/g, '').length < 10) {
      toast.error('กรุณากรอกเบอร์โทรให้ครบถ้วน')
      return false
    }
    
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      toast.error('รูปแบบอีเมลไม่ถูกต้อง')
      return false
    }
    
    if (!selectedBranch) {
      toast.error('กรุณาเลือกสาขาที่สะดวก')
      return false
    }
    
    // Validate students
    for (let i = 0; i < students.length; i++) {
      const student = students[i]
      if (!student.name.trim()) {
        toast.error(`กรุณากรอกชื่อนักเรียนคนที่ ${i + 1}`)
        return false
      }
      
      // Validate birthdate if provided
      if (student.birthdate) {
        const age = calculateAge(new Date(student.birthdate))
        if (age < 3 || age > 22) {
          toast.error(`อายุนักเรียนคนที่ ${i + 1} ควรอยู่ระหว่าง 3-22 ปี`)
          return false
        }
      }
      
      if (student.subjectInterests.length === 0) {
        toast.error(`กรุณาเลือกวิชาที่สนใจสำหรับนักเรียนคนที่ ${i + 1}`)
        return false
      }
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setSubmitting(true)
    
    try {
      const bookingData = {
        source: 'online' as const,
        parentName: parentName.trim(),
        parentPhone: parentPhone.replace(/-/g, ''),
        branchId: selectedBranch,
        students: students.map(s => {
          const studentData: any = {
            name: s.name.trim(),
            subjectInterests: s.subjectInterests
          }
          
          // Add optional fields only if they have values
          if (s.birthdate) {
            studentData.birthdate = new Date(s.birthdate)
          }
          if (s.schoolName.trim()) {
            studentData.schoolName = s.schoolName.trim()
          }
          if (s.gradeLevel) {
            studentData.gradeLevel = s.gradeLevel
          }
          
          return studentData
        }),
        status: 'new',
        ...(parentEmail.trim() && { parentEmail: parentEmail.trim() }),
        ...(contactNote.trim() && { contactNote: contactNote.trim() })
      }
      
      // ส่งข้อมูลไป API
      const response = await fetch('/api/liff/trial-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด')
      }
      
      // แสดงหน้าสำเร็จ
      setShowSuccess(true)
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
      
    } catch (error: any) {
      console.error('Error submitting booking:', error)
      toast.error(error.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  // Retry loading function
  const retryLoading = () => {
    window.location.reload()
  }

  // Show loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">กำลังโหลด...</p>
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && debugInfo.length > 0 && (
            <div className="mt-4 text-xs text-gray-500 text-left max-w-md mx-auto">
              <p className="font-semibold mb-2">Debug Log:</p>
              {debugInfo.map((log, idx) => (
                <p key={idx} className="mb-1">{log}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show error state
  if (error || (branches.length === 0 && subjects.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              
              <h2 className="text-xl font-semibold">ไม่สามารถโหลดข้อมูลได้</h2>
              
              <p className="text-gray-600">
                {error || 'ไม่สามารถโหลดข้อมูลสาขาและวิชาได้'}
              </p>
              
              {/* Debug info */}
              <Alert className="text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-semibold mb-1">ข้อมูลสำหรับแก้ไขปัญหา:</p>
                  <p>- Branches loaded: {branches.length}</p>
                  <p>- Subjects loaded: {subjects.length}</p>
                  <p>- Environment: {process.env.NODE_ENV}</p>
                  {debugInfo.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600">Debug Log</summary>
                      <div className="mt-1 space-y-1">
                        {debugInfo.map((log, idx) => (
                          <p key={idx} className="text-gray-600">{log}</p>
                        ))}
                      </div>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
              
              <Button onClick={retryLoading} className="w-full">
                ลองใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-green-800">จองทดลองเรียนสำเร็จ!</h2>
              
              <div className="space-y-2 text-gray-600">
                <p>ข้อมูลของคุณได้ถูกบันทึกเรียบร้อยแล้ว</p>
                <p className="font-medium">เจ้าหน้าที่จะติดต่อกลับภายใน 24 ชั่วโมง</p>
              </div>
              
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-left">
                  <p className="font-medium mb-1">ขั้นตอนถัดไป:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>เจ้าหน้าที่จะโทรติดต่อเพื่อยืนยันวันเวลา</li>
                    <li>นำบุตรหลานมาทดลองเรียนตามวันเวลาที่นัดหมาย</li>
                    <li>ประเมินความสนใจหลังทดลองเรียน</li>
                  </ol>
                </AlertDescription>
              </Alert>
              
              <div className="pt-4">
                <Button
                  onClick={() => {
                    // Reset form
                    setShowSuccess(false)
                    setParentName('')
                    setParentPhone('')
                    setParentEmail('')
                    setSelectedBranch('')
                    setContactNote('')
                    setStudents([{
                      name: '',
                      birthdate: '',
                      schoolName: '',
                      gradeLevel: '',
                      subjectInterests: []
                    }])
                  }}
                  variant="outline"
                  className="w-full"
                >
                  จองเพิ่ม
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="py-4">
          <div className="flex justify-center mb-2 pt-4">
            <Image
              src="/logo.svg"
              alt="CodeLab School"
              width={200}
              height={60}
              className="object-contain"
              priority
              onError={(e) => {
                // Fallback to text if logo not found
                e.currentTarget.style.display = 'none'
                const textLogo = document.getElementById('text-logo-fallback')
                if (textLogo) textLogo.style.display = 'flex'
              }}
            />
            <div 
              id="text-logo-fallback" 
              className="hidden items-center justify-center"
            >
              <div className="flex items-center gap-2">
                <School className="h-10 w-10 text-primary" />
                <h1 className="text-2xl font-bold text-primary">
                  CodeLab School
                </h1>
              </div>
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-center text-gray-800">
            จองทดลองเรียน
          </h2>
          <p className="text-center text-gray-600 text-sm px-4 mt-1">
            ให้บุตรหลานได้ลองเรียน Coding & Robotics กับเรา
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Parent Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                ข้อมูลผู้ปกครอง
              </CardTitle>
              <CardDescription>
                กรุณากรอกข้อมูลเพื่อให้เราติดต่อกลับ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="parentName">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="parentName"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุลผู้ปกครอง"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentPhone">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="parentPhone"
                      value={parentPhone}
                      onChange={handlePhoneChange}
                      placeholder="08X-XXX-XXXX"
                      className="pl-10"
                      maxLength={12}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="parentEmail">อีเมล</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="parentEmail"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="branch">
                  สาขาที่สะดวก <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                        <p className="text-sm">ไม่พบข้อมูลสาขา</p>
                      </div>
                    ) : (
                      branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{branch.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Students Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-gray-400" />
                ข้อมูลนักเรียน
              </CardTitle>
              <CardDescription>
                กรอกข้อมูลนักเรียนที่ต้องการทดลองเรียน
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {students.map((student, idx) => (
                <div key={idx} className="relative p-4 border rounded-lg space-y-4">
                  {students.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeStudent(idx)}
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="font-medium text-sm text-gray-600">
                    นักเรียนคนที่ {idx + 1}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label>
                        ชื่อ-นามสกุล <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={student.name}
                        onChange={(e) => updateStudent(idx, 'name', e.target.value)}
                        placeholder="ชื่อ-นามสกุลนักเรียน"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`birthdate-${idx}`}>
                        <Cake className="inline h-4 w-4 mr-1" />
                        วันเกิด
                      </Label>
                      <Input
                        id={`birthdate-${idx}`}
                        type="date"
                        value={student.birthdate}
                        onChange={(e) => updateStudent(idx, 'birthdate', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      {student.birthdate && (
                        <p className="text-xs text-gray-500 mt-1">
                          อายุ: {calculateAge(new Date(student.birthdate))} ปี
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>ระดับชั้น</Label>
                      <GradeLevelCombobox
                        value={student.gradeLevel}
                        onChange={(value) => updateStudent(idx, 'gradeLevel', value)}
                        placeholder="เลือกหรือพิมพ์ระดับชั้น..."
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label>โรงเรียน</Label>
                      <div className="relative">
                        <School className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={student.schoolName}
                          onChange={(e) => updateStudent(idx, 'schoolName', e.target.value)}
                          placeholder="ชื่อโรงเรียน"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label>
                      วิชาที่สนใจ <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-sm text-gray-500 mb-2">
                      เลือกได้มากกว่า 1 วิชา
                    </p>
                    {subjects.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          ไม่พบข้อมูลวิชา กรุณาติดต่อเจ้าหน้าที่
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <SubjectSelector
                        subjects={subjects}
                        selectedSubjects={student.subjectInterests}
                        onToggle={(subjectId) => toggleSubjectInterest(idx, subjectId)}
                      />
                    )}
                  </div>
                </div>
              ))}
              
              {/* Add Student Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={addStudent}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มนักเรียน
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-gray-400" />
                หมายเหตุเพิ่มเติม
              </CardTitle>
              <CardDescription>
                ระบุข้อมูลเพิ่มเติมหรือความต้องการพิเศษ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="contactNote"
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
                placeholder="เช่น ช่วงเวลาที่สะดวกให้ติดต่อ, ความต้องการพิเศษ, วันเวลาที่อยากทดลองเรียน"
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Information */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <p className="font-medium mb-2">ข้อมูลเกี่ยวกับการทดลองเรียน:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>ทดลองเรียนฟรี 1 ชั่วโมง</li>
                <li>มีอุปกรณ์ให้ใช้ในชั้นเรียน</li>
                <li>ผู้ปกครองสามารถเข้านั่งดูได้</li>
                <li>ไม่มีค่าใช้จ่ายใดๆ ทั้งสิ้น</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={submitting || branches.length === 0 || subjects.length === 0}
              className="w-full md:w-auto px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังส่งข้อมูล...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  ยืนยันการจองทดลองเรียน
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
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
import { SchoolNameCombobox } from "@/components/ui/school-name-combobox"
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
  Cake,
  ChevronLeft,
  Edit3
} from 'lucide-react'
import { SectionLoading } from '@/components/ui/loading'
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

// Inline field error component
function FieldError({ field, fieldErrors }: { field: string; fieldErrors: Record<string, string> }) {
  const error = fieldErrors[field]
  if (!error) return null
  return <p className="text-red-500 text-sm mt-1">{error}</p>
}

export default function TrialBookingPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  // Multi-step wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const totalSteps = 3

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

  // Scroll to first error field
  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstErrorKey = Object.keys(errors)[0]
    if (firstErrorKey) {
      const el = document.getElementById(firstErrorKey) || document.querySelector(`[data-field="${firstErrorKey}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Validate Step 1: Parent info
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!parentName.trim()) {
      newErrors['parentName'] = 'กรุณากรอกชื่อผู้ปกครอง'
    }

    if (!parentPhone || parentPhone.replace(/-/g, '').length < 10) {
      newErrors['parentPhone'] = 'กรุณากรอกเบอร์โทรให้ครบถ้วน (10 หลัก)'
    }

    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      newErrors['parentEmail'] = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    if (!selectedBranch) {
      newErrors['selectedBranch'] = 'กรุณาเลือกสาขาที่สะดวก'
    }

    setFieldErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      scrollToFirstError(newErrors)
      return false
    }

    return true
  }

  // Validate Step 2: Student info
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {}

    for (let i = 0; i < students.length; i++) {
      const student = students[i]

      if (!student.name.trim()) {
        newErrors[`students.${i}.name`] = `กรุณากรอกชื่อนักเรียนคนที่ ${i + 1}`
      }

      if (student.birthdate) {
        const age = calculateAge(new Date(student.birthdate))
        if (age < 3 || age > 22) {
          newErrors[`students.${i}.birthdate`] = `อายุนักเรียนควรอยู่ระหว่าง 3-22 ปี (ปัจจุบัน ${age} ปี)`
        }
      }

      if (student.subjectInterests.length === 0) {
        newErrors[`students.${i}.subjectInterests`] = `กรุณาเลือกอย่างน้อย 1 วิชาสำหรับนักเรียนคนที่ ${i + 1}`
      }
    }

    setFieldErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      scrollToFirstError(newErrors)
      return false
    }

    return true
  }

  // Legacy validateForm for the final submit (validates everything)
  const validateForm = (): boolean => {
    return validateStep1() && validateStep2()
  }

  // Handle next step
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setFieldErrors({})
        setCurrentStep(2)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setFieldErrors({})
        setCurrentStep(3)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  // Handle previous step
  const handlePrevStep = () => {
    setFieldErrors({})
    setCurrentStep(prev => Math.max(1, prev - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Final validation of all steps
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

  // Helper: get branch name by id
  const getBranchName = (branchId: string): string => {
    const branch = branches.find(b => b.id === branchId)
    return branch?.name || branchId
  }

  // Helper: get subject name by id
  const getSubjectName = (subjectId: string): string => {
    const subject = subjects.find(s => s.id === subjectId)
    return subject?.name || subjectId
  }

  // Show loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <SectionLoading text="กำลังโหลด..." />
          {/* Debug info only in development */}
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
                {error || 'ไม่สามารถโหลดข้อมูลสาขาและวิชาได้ กรุณาลองใหม่อีกครั้ง'}
              </p>

              {/* Debug info only in development */}
              {process.env.NODE_ENV === 'development' && (
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
              )}

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
                    setCurrentStep(1)
                    setFieldErrors({})
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
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { step: 1, label: 'ผู้ปกครอง' },
            { step: 2, label: 'นักเรียน' },
            { step: 3, label: 'ยืนยัน' },
          ].map(({ step, label }) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStep > step ? <Check className="h-4 w-4" /> : step}
              </div>
              <span className={`text-sm hidden sm:inline ${currentStep >= step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
              {step < 3 && <div className={`w-8 h-0.5 ${currentStep > step ? 'bg-red-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========== STEP 1: Parent Information ========== */}
          {currentStep === 1 && (
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
                    data-field="parentName"
                    value={parentName}
                    onChange={(e) => {
                      setParentName(e.target.value)
                      if (fieldErrors['parentName']) {
                        setFieldErrors(prev => { const n = {...prev}; delete n['parentName']; return n })
                      }
                    }}
                    placeholder="กรอกชื่อ-นามสกุลผู้ปกครอง"
                    className={fieldErrors['parentName'] ? 'border-red-500' : ''}
                  />
                  <FieldError field="parentName" fieldErrors={fieldErrors} />
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
                        data-field="parentPhone"
                        value={parentPhone}
                        onChange={(e) => {
                          handlePhoneChange(e)
                          if (fieldErrors['parentPhone']) {
                            setFieldErrors(prev => { const n = {...prev}; delete n['parentPhone']; return n })
                          }
                        }}
                        placeholder="08X-XXX-XXXX"
                        className={`pl-10 ${fieldErrors['parentPhone'] ? 'border-red-500' : ''}`}
                        maxLength={12}
                      />
                    </div>
                    <FieldError field="parentPhone" fieldErrors={fieldErrors} />
                  </div>

                  <div>
                    <Label htmlFor="parentEmail">อีเมล</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="parentEmail"
                        data-field="parentEmail"
                        type="email"
                        value={parentEmail}
                        onChange={(e) => {
                          setParentEmail(e.target.value)
                          if (fieldErrors['parentEmail']) {
                            setFieldErrors(prev => { const n = {...prev}; delete n['parentEmail']; return n })
                          }
                        }}
                        placeholder="example@email.com"
                        className={`pl-10 ${fieldErrors['parentEmail'] ? 'border-red-500' : ''}`}
                      />
                    </div>
                    <FieldError field="parentEmail" fieldErrors={fieldErrors} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="selectedBranch">
                    สาขาที่สะดวก <span className="text-red-500">*</span>
                  </Label>
                  <div id="selectedBranch" data-field="selectedBranch">
                    <Select
                      value={selectedBranch}
                      onValueChange={(val) => {
                        setSelectedBranch(val)
                        if (fieldErrors['selectedBranch']) {
                          setFieldErrors(prev => { const n = {...prev}; delete n['selectedBranch']; return n })
                        }
                      }}
                    >
                      <SelectTrigger className={fieldErrors['selectedBranch'] ? 'border-red-500' : ''}>
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
                  <FieldError field="selectedBranch" fieldErrors={fieldErrors} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ========== STEP 2: Students Information ========== */}
          {currentStep === 2 && (
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
                          id={`students.${idx}.name`}
                          data-field={`students.${idx}.name`}
                          value={student.name}
                          onChange={(e) => {
                            updateStudent(idx, 'name', e.target.value)
                            if (fieldErrors[`students.${idx}.name`]) {
                              setFieldErrors(prev => { const n = {...prev}; delete n[`students.${idx}.name`]; return n })
                            }
                          }}
                          placeholder="ชื่อ-นามสกุลนักเรียน"
                          className={fieldErrors[`students.${idx}.name`] ? 'border-red-500' : ''}
                        />
                        <FieldError field={`students.${idx}.name`} fieldErrors={fieldErrors} />
                      </div>

                      <div>
                        <Label htmlFor={`students.${idx}.birthdate`}>
                          <Cake className="inline h-4 w-4 mr-1" />
                          วันเกิด
                        </Label>
                        <Input
                          id={`students.${idx}.birthdate`}
                          data-field={`students.${idx}.birthdate`}
                          type="date"
                          value={student.birthdate}
                          onChange={(e) => {
                            updateStudent(idx, 'birthdate', e.target.value)
                            if (fieldErrors[`students.${idx}.birthdate`]) {
                              setFieldErrors(prev => { const n = {...prev}; delete n[`students.${idx}.birthdate`]; return n })
                            }
                          }}
                          max={new Date().toISOString().split('T')[0]}
                          className={fieldErrors[`students.${idx}.birthdate`] ? 'border-red-500' : ''}
                        />
                        {student.birthdate && !fieldErrors[`students.${idx}.birthdate`] && (
                          <p className="text-xs text-gray-500 mt-1">
                            อายุ: {calculateAge(new Date(student.birthdate))} ปี
                          </p>
                        )}
                        <FieldError field={`students.${idx}.birthdate`} fieldErrors={fieldErrors} />
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
                        <SchoolNameCombobox
                          value={student.schoolName}
                          onChange={(value) => updateStudent(idx, 'schoolName', value)}
                          placeholder="พิมพ์ชื่อโรงเรียน..."
                        />
                      </div>
                    </div>

                    <div id={`students.${idx}.subjectInterests`} data-field={`students.${idx}.subjectInterests`}>
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
                        <div className={fieldErrors[`students.${idx}.subjectInterests`] ? 'border border-red-500 rounded-lg p-2' : ''}>
                          <SubjectSelector
                            subjects={subjects}
                            selectedSubjects={student.subjectInterests}
                            onToggle={(subjectId) => {
                              toggleSubjectInterest(idx, subjectId)
                              if (fieldErrors[`students.${idx}.subjectInterests`]) {
                                setFieldErrors(prev => { const n = {...prev}; delete n[`students.${idx}.subjectInterests`]; return n })
                              }
                            }}
                          />
                        </div>
                      )}
                      <FieldError field={`students.${idx}.subjectInterests`} fieldErrors={fieldErrors} />
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
          )}

          {/* ========== STEP 2 also shows Notes ========== */}
          {currentStep === 2 && (
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
          )}

          {/* ========== STEP 3: Review & Confirm ========== */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Parent Info Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-5 w-5 text-gray-400" />
                      ข้อมูลผู้ปกครอง
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCurrentStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      แก้ไข
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-500">ชื่อ: </span>
                        <span className="font-medium">{parentName}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-500">โทร: </span>
                        <span className="font-medium">{parentPhone}</span>
                      </div>
                    </div>
                    {parentEmail && (
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-gray-500">อีเมล: </span>
                          <span className="font-medium">{parentEmail}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-gray-500">สาขา: </span>
                        <span className="font-medium">{getBranchName(selectedBranch)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Students Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="h-5 w-5 text-gray-400" />
                      ข้อมูลนักเรียน ({students.length} คน)
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCurrentStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      แก้ไข
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {students.map((student, idx) => (
                    <div key={idx} className={`${idx > 0 ? 'border-t pt-4' : ''}`}>
                      <div className="font-medium text-sm text-gray-700 mb-2">
                        นักเรียนคนที่ {idx + 1}: {student.name}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600 ml-4">
                        {student.birthdate && (
                          <div className="flex items-center gap-1">
                            <Cake className="h-3.5 w-3.5 text-gray-400" />
                            <span>วันเกิด: {new Date(student.birthdate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} (อายุ {calculateAge(new Date(student.birthdate))} ปี)</span>
                          </div>
                        )}
                        {student.gradeLevel && (
                          <div className="flex items-center gap-1">
                            <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                            <span>ระดับชั้น: {student.gradeLevel}</span>
                          </div>
                        )}
                        {student.schoolName && (
                          <div className="flex items-center gap-1">
                            <School className="h-3.5 w-3.5 text-gray-400" />
                            <span>โรงเรียน: {student.schoolName}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 ml-4">
                        <span className="text-sm text-gray-500">วิชาที่สนใจ:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {student.subjectInterests.map((subjectId) => (
                            <Badge key={subjectId} variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                              {getSubjectName(subjectId)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Notes Summary */}
              {contactNote.trim() && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageCircle className="h-5 w-5 text-gray-400" />
                        หมายเหตุ
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setCurrentStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        แก้ไข
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{contactNote}</p>
                  </CardContent>
                </Card>
              )}

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
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-4 pt-4">
            {/* Back Button */}
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                className="flex-1 md:flex-none md:w-auto px-6"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                ย้อนกลับ
              </Button>
            )}

            {/* Spacer when on step 1 */}
            {currentStep === 1 && <div />}

            {/* Next / Submit Button */}
            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="flex-1 md:flex-none md:w-auto px-8"
              >
                ถัดไป
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={submitting || branches.length === 0 || subjects.length === 0}
                className="flex-1 md:flex-none md:w-auto px-8"
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
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

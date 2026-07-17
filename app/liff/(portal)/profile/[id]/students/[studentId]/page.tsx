'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GradeLevelCombobox } from "@/components/ui/grade-level-combobox"
import { SchoolNameCombobox } from "@/components/ui/school-name-combobox"
import { ChevronLeft, User, Calendar, School, AlertCircle, Loader2 } from 'lucide-react'
import { getStudent } from '@/lib/services/parents'
import { liffFetch } from '@/lib/line/liff-fetch'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Loading } from '@/components/ui/loading'
import { useLiff } from '@/components/liff/liff-provider'

// Form schema
const formSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อ-นามสกุล'),
  nameEn: z.string().optional(),
  nickname: z.string().min(1, 'กรุณาระบุชื่อเล่น'),
  birthdate: z.string().min(1, 'กรุณาเลือกวันเกิด'),
  gender: z.enum(['M', 'F'], { required_error: 'กรุณาเลือกเพศ' }),
  gradeLevel: z.string().optional(),
  schoolName: z.string().optional(),
  allergies: z.string().optional(),
  specialNeeds: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

function EditStudentContent() {
  const router = useRouter()
  const params = useParams()
  const parentId = params.id as string
  const studentId = params.studentId as string
  const { profile, isLoggedIn, isLoading: liffLoading, liff } = useLiff()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      nameEn: '',
      nickname: '',
      birthdate: '',
      gender: 'M',
      gradeLevel: '',
      schoolName: '',
      allergies: '',
      specialNeeds: '',
      emergencyContact: '',
      emergencyPhone: '',
    }
  })

  // Check authentication
  useEffect(() => {
    if (!liffLoading) {
      if (!isLoggedIn && liff) {
        console.log('[EditStudentContent] Not logged in, redirecting...')
        liff.login({ redirectUri: window.location.href })
      } else if (isLoggedIn) {
        setAuthChecked(true)
      }
    }
  }, [liffLoading, isLoggedIn, liff])

  useEffect(() => {
    if (parentId && studentId && authChecked) {
      loadStudent()
    }
  }, [parentId, studentId, authChecked])

  const loadStudent = async () => {
    try {
      setLoading(true)
      const student = await getStudent(parentId, studentId)
      
      if (!student) {
        toast.error('ไม่พบข้อมูลนักเรียน')
        navigateBack()
        return
      }
      
      // Format birthdate - handle different types safely
      let birthdateStr = ''
      const birthdate = student.birthdate as any
      
      if (birthdate instanceof Date) {
        birthdateStr = birthdate.toISOString().split('T')[0]
      } else if (birthdate && typeof birthdate.toDate === 'function') {
        birthdateStr = birthdate.toDate().toISOString().split('T')[0]
      } else if (birthdate && birthdate.seconds) {
        birthdateStr = new Date(birthdate.seconds * 1000).toISOString().split('T')[0]
      }
      
      // Reset form with loaded data
      const formData = {
        name: student.name,
        nameEn: student.nameEn || '',
        nickname: student.nickname || '',
        birthdate: birthdateStr,
        gender: student.gender,
        gradeLevel: student.gradeLevel || '',
        schoolName: student.schoolName || '',
        allergies: student.allergies || '',
        specialNeeds: student.specialNeeds || '',
        emergencyContact: student.emergencyContact || '',
        emergencyPhone: student.emergencyPhone || '',
      }
      
      console.log('[EditStudent] Form data to reset:', formData)
      reset(formData)
      
    } catch (error) {
      console.error('Error loading student:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const navigateBack = () => {
    setNavigating(true)
    router.push('/liff/profile')
  }

  const onSubmit = async (data: FormData) => {
    try {
      setSaving(true)

      // Service-role update via LINE-verified route; ownership checked server-side.
      await liffFetch('/api/liff/student', {
        lineUserId: profile?.userId,
        studentId,
        student: {
          name: data.name,
          nameEn: data.nameEn?.trim() || null,
          nickname: data.nickname,
          birthdate: new Date(data.birthdate).toISOString(),
          gender: data.gender,
          gradeLevel: data.gradeLevel || null,
          schoolName: data.schoolName || null,
          allergies: data.allergies || null,
          specialNeeds: data.specialNeeds || null,
          emergencyContact: data.emergencyContact || null,
          emergencyPhone: data.emergencyPhone || null,
        },
      }, 'PATCH')

      toast.success('บันทึกข้อมูลเรียบร้อย')
      navigateBack()

    } catch (error: any) {
      console.error('Error saving:', error)
      toast.error(error?.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  // Calculate max date (today)
  const today = new Date().toISOString().split('T')[0]
  
  // Calculate min date (18 years ago)
  const minDate = new Date()
  minDate.setFullYear(minDate.getFullYear() - 18)
  const minDateStr = minDate.toISOString().split('T')[0]

  if (liffLoading || !authChecked || loading || navigating) {
    return <Loading fullScreen size="lg" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 pt-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={navigateBack}
            className="text-white hover:bg-white hover:text-gray-900 active:bg-white active:text-gray-900 -ml-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">แก้ไขข้อมูลนักเรียน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              ข้อมูลพื้นฐาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="name"
                    placeholder="ระบุชื่อ-นามสกุลภาษาไทย"
                  />
                )}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="nameEn">ชื่อ-นามสกุล (ภาษาอังกฤษ)</Label>
              <Controller
                name="nameEn"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    id="nameEn"
                    placeholder="เช่น Somchai Jaidee"
                  />
                )}
              />
              <p className="text-sm text-muted-foreground mt-1">
                ใช้สำหรับออกใบประกาศนียบัตร (ไม่บังคับ)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nickname">ชื่อเล่น *</Label>
                <Controller
                  name="nickname"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="nickname"
                      placeholder="ชื่อเล่น"
                    />
                  )}
                />
                {errors.nickname && (
                  <p className="text-sm text-red-500 mt-1">{errors.nickname.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="gender">เพศ *</Label>
                <Select
                  value={watch('gender')}
                  onValueChange={(value) => setValue('gender', value as 'M' | 'F')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเพศ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">ชาย</SelectItem>
                    <SelectItem value="F">หญิง</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && (
                  <p className="text-sm text-red-500 mt-1">{errors.gender.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="birthdate">วันเกิด *</Label>
              <Controller
                name="birthdate"
                control={control}
                render={({ field }) => (
                  <DateRangePicker
                    mode="single"
                    value={field.value}
                    onChange={(date) => field.onChange(date || '')}
                    maxDate={new Date()}
                    minDate={minDate}
                    placeholder="เลือกวันที่"
                  />
                )}
              />
              {errors.birthdate && (
                <p className="text-sm text-red-500 mt-1">{errors.birthdate.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* School Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              ข้อมูลการศึกษา
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schoolName">โรงเรียน</Label>
              <Controller
                name="schoolName"
                control={control}
                render={({ field }) => (
                  <SchoolNameCombobox
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="ชื่อโรงเรียน (ไม่บังคับ)"
                  />
                )}
              />
            </div>
            <div>
              <Label htmlFor="gradeLevel">ระดับชั้น</Label>
              <GradeLevelCombobox
                value={watch('gradeLevel') || ''}
                onChange={(value) => setValue('gradeLevel', value)}
                placeholder="เลือกหรือพิมพ์ระดับชั้น..."
              />
              <p className="text-xs text-gray-500 mt-1">
                เริ่มพิมพ์เพื่อค้นหา เช่น "ป", "ประถม", "Grade", "Year"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Health & Emergency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              ข้อมูลสุขภาพและฉุกเฉิน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="allergies">ประวัติการแพ้</Label>
              <Controller
                name="allergies"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="allergies"
                    placeholder="ระบุอาหาร/ยา/สิ่งที่แพ้ (ถ้ามี)"
                    rows={3}
                  />
                )}
              />
            </div>

            <div>
              <Label htmlFor="specialNeeds">ข้อควรระวังพิเศษ</Label>
              <Controller
                name="specialNeeds"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="specialNeeds"
                    placeholder="โรคประจำตัว หรือข้อควรระวังอื่นๆ (ถ้ามี)"
                    rows={3}
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emergencyContact">ผู้ติดต่อฉุกเฉิน</Label>
                <Controller
                  name="emergencyContact"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="emergencyContact"
                      placeholder="ชื่อผู้ติดต่อ"
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor="emergencyPhone">เบอร์ฉุกเฉิน</Label>
                <Controller
                  name="emergencyPhone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="emergencyPhone"
                      placeholder="0812345678"
                      maxLength={10}
                    />
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2 pb-4">
          <Button
            type="button"
            className="flex-1"
            disabled={saving}
            onClick={handleSubmit(onSubmit)}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกข้อมูล'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={navigateBack}
            disabled={saving}
          >
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function EditStudentPage() {
  return (
      <EditStudentContent />
  );
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, User, MapPin, School, Loader2 } from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { getParent, updateParent } from '@/lib/services/parents'
import { getActiveBranches } from '@/lib/services/branches'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loading } from '@/components/ui/loading'
import { LiffProvider } from '@/components/liff/liff-provider'
import { ProvinceCombobox } from '@/components/ui/province-combobox'

// Thai provinces data - removed (using ProvinceCombobox instead)

// Form schema
const formSchema = z.object({
  displayName: z.string().min(1, 'กรุณาระบุชื่อ-นามสกุล'),
  phone: z.string().regex(/^[0-9]{10}$/, 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก'),
  emergencyPhone: z.string().regex(/^[0-9]{10}$/, 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก').optional().or(z.literal('')),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')),
  preferredBranchId: z.string().optional(),
  address: z.object({
    houseNumber: z.string().optional(),
    street: z.string().optional(),
    subDistrict: z.string().optional(),
    district: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().regex(/^[0-9]{5}$/, 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก').optional().or(z.literal('')),
  })
})

type FormData = z.infer<typeof formSchema>

function EditParentProfileContent() {
  const router = useRouter()
  const params = useParams()
  const parentId = params.id as string
  const { profile, isLoggedIn, isLoading: liffLoading, liff } = useLiff()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState<Array<{id: string, name: string}>>([])
  const [authChecked, setAuthChecked] = useState(false)
  const [navigating, setNavigating] = useState(false)
  
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
      displayName: '',
      phone: '',
      emergencyPhone: '',
      email: '',
      preferredBranchId: '',
      address: {
        houseNumber: '',
        street: '',
        subDistrict: '',
        district: '',
        province: '',
        postalCode: '',
      }
    }
  })

  // Check authentication
  useEffect(() => {
    if (!liffLoading) {
      if (!isLoggedIn && liff) {
        console.log('[EditParentProfileContent] Not logged in, redirecting...')
        liff.login()
      } else if (isLoggedIn) {
        setAuthChecked(true)
      }
    }
  }, [liffLoading, isLoggedIn, liff])

  useEffect(() => {
    if (parentId && authChecked) {
      loadData()
    }
  }, [parentId, authChecked])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load parent data
      const parent = await getParent(parentId)
      console.log('[EditParent] Loaded parent data:', parent)
      
      if (!parent) {
        toast.error('ไม่พบข้อมูล')
        navigateBack()
        return
      }
      
      // Reset form with loaded data
      const formData = {
        displayName: parent.displayName || '',
        phone: parent.phone || '',
        emergencyPhone: parent.emergencyPhone || '',
        email: parent.email || '',
        preferredBranchId: parent.preferredBranchId || '',
        address: {
          houseNumber: parent.address?.houseNumber || '',
          street: parent.address?.street || '',
          subDistrict: parent.address?.subDistrict || '',
          district: parent.address?.district || '',
          province: parent.address?.province || '',
          postalCode: parent.address?.postalCode || '',
        }
      }
      
      console.log('[EditParent] Form data to reset:', formData)
      reset(formData)
      
      // Load branches
      const branchList = await getActiveBranches()
      setBranches(branchList.map(b => ({ id: b.id, name: b.name })))
      
    } catch (error) {
      console.error('Error loading data:', error)
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
      
      // Prepare update data
      const updateData: any = {
        displayName: data.displayName,
        phone: data.phone,
      }
      
      // Add optional fields
      if (data.emergencyPhone) updateData.emergencyPhone = data.emergencyPhone
      if (data.email) updateData.email = data.email
      if (data.preferredBranchId) updateData.preferredBranchId = data.preferredBranchId
      
      // Add address if any field is filled
      const hasAddress = data.address.houseNumber || data.address.street || 
                        data.address.subDistrict || data.address.district || 
                        data.address.province || data.address.postalCode
      
      if (hasAddress) {
        updateData.address = {
          houseNumber: data.address.houseNumber || '',
          street: data.address.street || '',
          subDistrict: data.address.subDistrict || '',
          district: data.address.district || '',
          province: data.address.province || '',
          postalCode: data.address.postalCode || '',
        }
      }
      
      await updateParent(parentId, updateData)
      
      toast.success('บันทึกข้อมูลเรียบร้อย')
      navigateBack()
      
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  if (liffLoading || !authChecked || loading || navigating) {
    return <Loading fullScreen text="กำลังโหลด..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={navigateBack}
            className="text-white hover:text-white/80 -ml-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">แก้ไขข้อมูลผู้ปกครอง</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              ข้อมูลส่วนตัว
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="displayName">ชื่อ-นามสกุล *</Label>
              <Controller
                name="displayName"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="displayName"
                    placeholder="ระบุชื่อ-นามสกุล"
                  />
                )}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500 mt-1">{errors.displayName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="phone"
                      placeholder="0812345678"
                      maxLength={10}
                    />
                  )}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                )}
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
                {errors.emergencyPhone && (
                  <p className="text-sm text-red-500 mt-1">{errors.emergencyPhone.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">อีเมล</Label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                  />
                )}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              ที่อยู่ (ไม่บังคับ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="houseNumber">บ้านเลขที่</Label>
                <Controller
                  name="address.houseNumber"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="houseNumber"
                      placeholder="123/45"
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor="street">ถนน</Label>
                <Controller
                  name="address.street"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="street"
                      placeholder="ถนนสุขุมวิท"
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subDistrict">แขวง/ตำบล</Label>
                <Controller
                  name="address.subDistrict"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="subDistrict"
                      placeholder="คลองตัน"
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor="district">เขต/อำเภอ</Label>
                <Controller
                  name="address.district"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="district"
                      placeholder="คลองเตย"
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="province">จังหวัด</Label>
                <ProvinceCombobox
                  value={watch('address.province') || ''}
                  onChange={(value) => setValue('address.province', value)}
                  placeholder="เลือกหรือค้นหาจังหวัด..."
                />
              </div>

              <div>
                <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
                <Controller
                  name="address.postalCode"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="postalCode"
                      placeholder="10110"
                      maxLength={5}
                    />
                  )}
                />
                {errors.address?.postalCode && (
                  <p className="text-sm text-red-500 mt-1">{errors.address.postalCode.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferred Branch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" />
              สาขาที่สะดวก
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={watch('preferredBranchId') || 'none'}
              onValueChange={(value) => setValue('preferredBranchId', value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกสาขา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่ระบุ</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export default function EditParentProfilePage() {
  return (
    <LiffProvider requireLogin={true}>
      <EditParentProfileContent />
    </LiffProvider>
  );
}
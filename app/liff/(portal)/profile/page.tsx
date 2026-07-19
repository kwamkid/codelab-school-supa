'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  School, 
  LogOut, 
  ChevronRight, 
  ChevronLeft, 
  MapPin, 
  Phone, 
  Mail, 
  Edit, 
  Trash2, 
  Plus,
  AlertCircle,
  Calendar,
  Users,
  Loader2,
  UserPlus,
  Link as LinkIcon,
  MessageCircle,
  Share2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useLiff } from '@/components/liff/liff-provider'
import { deleteStudent as deleteStudentService } from '@/lib/services/parents'
import { liffFetch } from '@/lib/line/liff-fetch'
import { toast } from 'sonner'
import type { Parent, Student, Branch } from '@/types/models'
import { Loading } from '@/components/ui/loading'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function ProfileContent() {
  const router = useRouter()
  const { liff, profile, isLoggedIn, isLoading: liffLoading } = useLiff()
  const [parentData, setParentData] = useState<Parent | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [preferredBranch, setPreferredBranch] = useState<Branch | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [parentId, setParentId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [hasParent, setHasParent] = useState<boolean | null>(null)
  
  // Delete confirmation state
  const [deleteStudentData, setDeleteStudentData] = useState<Student | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [navigating, setNavigating] = useState(false)

  // ผู้รับแจ้งเตือน LINE เพิ่มเติม (พ่อ/แม่คนที่ 2)
  interface LineRecipient { id: string; label: string | null; displayName: string | null; pictureUrl: string | null; accepted: boolean; inviteUrl: string | null }
  const [recipients, setRecipients] = useState<LineRecipient[]>([])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteLabel, setInviteLabel] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [removingRecipientId, setRemovingRecipientId] = useState<string | null>(null)

  const loadRecipients = async (lineUserId: string) => {
    try {
      const data = await liffFetch('/api/liff/recipients', { lineUserId, action: 'list' })
      if (data?.success) setRecipients(data.recipients || [])
    } catch (error) {
      console.error('Error loading recipients:', error)
    }
  }

  // แชร์ลิงก์เชิญ: ใช้ทั้งตอนสร้างใหม่ และกดแชร์ซ้ำจากแถวที่รอตอบรับ
  const shareInviteUrl = async (inviteUrl: string) => {
    const inviteText =
      `👨‍👩‍👧 คำเชิญรับการแจ้งเตือนจาก CodeLab School\n` +
      `${parentData?.displayName || 'ผู้ปกครอง'} เชิญคุณรับแจ้งเตือนตารางเรียน/ข่าวสารของบุตรหลานทาง LINE\n\n` +
      `กดลิงก์นี้เพื่อตอบรับ (ภายใน 3 วัน):\n${inviteUrl}`

    try {
      // ทางหลัก: shareTargetPicker = เลือกชื่อเพื่อน/ห้องแล้วส่งให้เลย
      // (ต้องเปิดสวิตช์ Share target picker ของ LIFF app ใน LINE Developers ก่อน)
      if (liff?.isApiAvailable?.('shareTargetPicker')) {
        await liff.shareTargetPicker([{ type: 'text', text: inviteText }])
        toast.success('ส่งคำเชิญแล้ว รอผู้รับกดตอบรับ')
        return
      }
      // fallback: เปิดหน้าแชร์ของ LINE (line.me/R/share) — ยังเลือกคนส่งได้ ไม่ใช่แค่ copy
      const shareUrl = `https://line.me/R/share?text=${encodeURIComponent(inviteText)}`
      if (liff?.openWindow) {
        liff.openWindow({ url: shareUrl, external: true })
      } else {
        window.open(shareUrl, '_blank')
      }
      toast.success('เปิดหน้าแชร์ของ LINE แล้ว เลือกคนที่จะส่งได้เลย')
    } catch (error: any) {
      // ผู้ใช้กดปิด share picker เอง ไม่ต้องเด้ง error
      if (String(error?.message || '').includes('CANCEL')) return
      // ทางสุดท้ายจริง ๆ ค่อย copy
      try {
        await navigator.clipboard.writeText(inviteText)
        toast.success('คัดลอกลิงก์เชิญแล้ว ส่งต่อให้ผู้รับได้เลย')
      } catch {
        toast.error(error?.message || 'แชร์ไม่สำเร็จ')
      }
    }
  }

  const createInvite = async () => {
    if (!profile?.userId) return
    setCreatingInvite(true)
    try {
      const data = await liffFetch('/api/liff/recipients', {
        lineUserId: profile.userId,
        action: 'invite',
        label: inviteLabel.trim(),
      })
      if (!data?.success || !data.inviteUrl) throw new Error(data?.error || 'สร้างลิงก์ไม่สำเร็จ')

      await shareInviteUrl(data.inviteUrl)
      setShowInviteForm(false)
      setInviteLabel('')
      loadRecipients(profile.userId)
    } catch (error: any) {
      toast.error(error?.message || 'สร้างคำเชิญไม่สำเร็จ')
    } finally {
      setCreatingInvite(false)
    }
  }

  const removeRecipient = async (id: string) => {
    if (!profile?.userId) return
    setRemovingRecipientId(id)
    try {
      const data = await liffFetch('/api/liff/recipients', { lineUserId: profile.userId, action: 'remove', id })
      if (!data?.success) throw new Error(data?.error || 'ลบไม่สำเร็จ')
      setRecipients((prev) => prev.filter((r) => r.id !== id))
      toast.success('ลบผู้รับการแจ้งเตือนแล้ว')
    } catch (error: any) {
      toast.error(error?.message || 'ลบไม่สำเร็จ')
    } finally {
      setRemovingRecipientId(null)
    }
  }

  // Check authentication
  useEffect(() => {
    if (!liffLoading) {
      if (!isLoggedIn && liff) {
        console.log('[ProfileContent] Not logged in, redirecting...')
        liff.login({ redirectUri: window.location.href })
      } else if (isLoggedIn) {
        setAuthChecked(true)
      }
    }
  }, [liffLoading, isLoggedIn, liff])

  useEffect(() => {
    if (profile?.userId && authChecked) {
      loadParentData(profile.userId)
    }
  }, [profile, authChecked])

  const loadParentData = async (lineUserId: string) => {
    try {
      setIsLoadingData(true)

      // Single round-trip via server route (service role + verified token / RPC)
      const data = await liffFetch('/api/liff/profile', { lineUserId })

      if (data?.hasParent && data.parent) {
        setParentData(data.parent as Parent)
        setParentId(data.parent.id)
        setHasParent(true)
        setPreferredBranch((data.preferredBranch as Branch) || null)
        setStudents((data.students || []) as Student[])
        loadRecipients(lineUserId)
      } else {
        setHasParent(false)
      }
    } catch (error) {
      console.error('Error loading parent data:', error)
      setHasParent(false)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleLogout = async () => {
    if (liff) {
      setNavigating(true)
      await liff.logout()
    }
  }

  const navigateTo = (path: string) => {
    setNavigating(true)
    router.push(path)
  }

  const calculateAge = (birthdate: any) => {
    let birth: Date;
    
    // Handle different birthdate formats
    if (birthdate?.seconds) {
      birth = new Date(birthdate.seconds * 1000);
    } else if (birthdate?.toDate && typeof birthdate.toDate === 'function') {
      birth = birthdate.toDate();
    } else if (birthdate instanceof Date) {
      birth = birthdate;
    } else if (typeof birthdate === 'string') {
      birth = new Date(birthdate);
    } else {
      console.error('Invalid birthdate format:', birthdate);
      return 0;
    }
    
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  const formatAddress = (address?: Parent['address']) => {
    if (!address) return 'ไม่ได้ระบุ'
    
    const parts = [
      address.houseNumber,
      address.street && `ถ.${address.street}`,
      address.subDistrict && `แขวง${address.subDistrict}`,
      address.district && `เขต${address.district}`,
      address.province,
      address.postalCode
    ].filter(Boolean)
    
    return parts.join(' ') || 'ไม่ได้ระบุ'
  }

  const handleDeleteStudent = async () => {
    if (!deleteStudentData || !parentId) return

    try {
      setIsDeleting(true)
      
      // Call delete function
      await deleteStudentService(parentId, deleteStudentData.id)
      
      // Update local state
      setStudents(prev => prev.filter(s => s.id !== deleteStudentData.id))
      
      toast.success('ลบข้อมูลนักเรียนเรียบร้อยแล้ว')
      setDeleteStudentData(null)
    } catch (error: any) {
      console.error('Error deleting student:', error)
      toast.error(error.message || 'ไม่สามารถลบข้อมูลได้')
    } finally {
      setIsDeleting(false)
    }
  }

  // Show loading while checking auth or loading data
  if (liffLoading || !authChecked || isLoadingData) {
    return <Loading fullScreen size="lg" text="กำลังโหลดข้อมูล..." />
  }

  // Show navigating overlay
  if (navigating) {
    return <Loading fullScreen size="lg" />
  }

  // Check if not registered - show registration prompt
  if (hasParent === false) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header with Logo - เหมือนหน้า trial */}
        <div className="bg-white shadow-sm">
          <div className="py-4">
            <div className="flex justify-center mb-2 pt-4">
              <Image
                src="/logo.svg"
                alt="CodeLab Thailand"
                width={200}
                height={60}
                className="object-contain"
                priority
                onError={(e) => {
                  // Fallback to text if logo not found
                  e.currentTarget.style.display = 'none'
                  const textLogo = document.getElementById('text-logo-fallback-register')
                  if (textLogo) textLogo.style.display = 'flex'
                }}
              />
              <div 
                id="text-logo-fallback-register" 
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
              ระบบจัดการโรงเรียน
            </h2>
            <p className="text-center text-gray-600 text-base px-4 mt-1">
              สำหรับผู้ปกครองและนักเรียน
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="max-w-md mx-auto space-y-4">
            <Card className="border-2 border-orange-200">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                    <UserPlus className="h-10 w-10 text-orange-600" />
                  </div>
                  
                  <h2 className="text-2xl font-bold">ยังไม่ได้ลงทะเบียน</h2>
                  <p className="text-gray-600">
                    กรุณาลงทะเบียนเพื่อเริ่มใช้งานระบบ
                  </p>
                </div>
                
                {/* Register button */}
                <Button 
                  className="w-full text-base bg-primary hover:bg-primary/90" 
                  size="lg"
                  onClick={() => navigateTo('/liff/register')}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  ลงทะเบียนใหม่
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-sm uppercase">
                    <span className="bg-white px-2 text-gray-500">หรือ</span>
                  </div>
                </div>
                
                {/* Connect existing account */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <LinkIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">
                        เคยลงทะเบียนที่เคาน์เตอร์แล้ว?
                      </p>
                      <p className="text-base text-blue-700 mt-1">
                        คลิกปุ่มด้านล่างเพื่อขอลิงก์เชื่อมต่อบัญชี
                      </p>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          if (liff && liff.isInClient()) {
                            try {
                              // LINE Official Account ID (without @)
                              const lineOAId = '@265lryrv'
                              const message = 'ติดต่อขอเชื่อมบัญชี LINE'
                              
                              // Create LINE URL with message
                              const lineUrl = `https://line.me/R/oaMessage/${encodeURIComponent(lineOAId)}/?${encodeURIComponent(message)}`
                              
                              // Open URL and close LIFF
                              window.location.href = lineUrl
                            } catch (error) {
                              console.error('Error:', error)
                              // Fallback: just close and let user type
                              liff.closeWindow()
                            }
                          } else {
                            // Not in LINE app
                            toast.info('กรุณาเปิดผ่าน LINE app เพื่อติดต่อ Admin')
                          }
                        }}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        ติดต่อ Admin เพื่อเชื่อมต่อบัญชี
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Back button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigateTo('/liff')}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  กลับหน้าหลัก
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateTo('/liff')}
              className="text-white hover:bg-white hover:text-gray-900 active:bg-white active:text-gray-900 -ml-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">โปรไฟล์</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-white hover:text-gray-900 active:bg-white active:text-gray-900"
            disabled={navigating}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Parent Profile Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                ข้อมูลผู้ปกครอง
              </CardTitle>
              {parentId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateTo(`/liff/profile/${parentId}`)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-0.5">
                <p className="text-sm text-muted-foreground">ชื่อ-นามสกุล</p>
                <h3 className="font-semibold text-lg">
                  {parentData?.displayName || <span className="text-red-500 text-base font-normal">ยังไม่ได้ระบุ — แตะแก้ไขเพื่อเพิ่ม</span>}
                </h3>
                {(parentData?.lineDisplayName || profile?.displayName) && (
                  <p className="text-base text-muted-foreground">
                    ชื่อ LINE: {parentData?.lineDisplayName || profile?.displayName}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-base">
                {parentData?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span>โทร: {parentData.phone}</span>
                      {parentData.emergencyPhone && (
                        <span className="text-muted-foreground ml-2">
                          (ฉุกเฉิน: {parentData.emergencyPhone})
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {parentData?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="break-all">{parentData.email}</span>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-medium">ที่อยู่: </span>
                    <span className={parentData?.address ? '' : 'text-red-500'}>
                      {formatAddress(parentData?.address)}
                    </span>
                  </div>
                </div>
              </div>

              {preferredBranch && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2 text-base">
                    <School className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">{preferredBranch.name}</p>
                      {preferredBranch.address && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {preferredBranch.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ผู้รับแจ้งเตือน LINE เพิ่มเติม (พ่อ/แม่คนที่ 2) */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                ผู้รับการแจ้งเตือน
              </CardTitle>
              <Button
                size="sm"
                variant={showInviteForm ? 'outline' : 'default'}
                className="text-sm"
                onClick={() => setShowInviteForm((v) => !v)}
              >
                {showInviteForm ? 'ปิด' : (<><UserPlus className="h-4 w-4 mr-1" />เพิ่ม</>)}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-base text-muted-foreground">
              แจ้งเตือนตารางเรียน/ข่าวสารจะส่งถึง LINE ของคุณ และผู้รับเพิ่มเติมทุกคนด้านล่าง
            </p>

            {recipients.length > 0 && (
              <div className="space-y-2">
                {recipients.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                    {r.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.pictureUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {r.displayName || r.label || 'รอตอบรับคำเชิญ'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {r.accepted ? (r.label || 'รับการแจ้งเตือนแล้ว') : 'ส่งคำเชิญแล้ว — รอกดตอบรับ'}
                      </p>
                    </div>
                    {!r.accepted && <Badge variant="secondary" className="text-sm shrink-0">รอตอบรับ</Badge>}
                    {!r.accepted && r.inviteUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 shrink-0"
                        onClick={() => shareInviteUrl(r.inviteUrl!)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 shrink-0"
                      disabled={removingRecipientId === r.id}
                      onClick={() => removeRecipient(r.id)}
                    >
                      {removingRecipientId === r.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showInviteForm && (
              <div className="space-y-2 border rounded-lg p-3">
                <p className="text-base font-medium">เชิญผู้รับการแจ้งเตือนคนใหม่</p>
                <div className="flex gap-2">
                  {['พ่อ', 'แม่'].map((l) => (
                    <Button
                      key={l}
                      type="button"
                      size="sm"
                      variant={inviteLabel === l ? 'default' : 'outline'}
                      className="text-sm"
                      onClick={() => setInviteLabel(l)}
                    >
                      {l}
                    </Button>
                  ))}
                  <Input
                    value={['พ่อ', 'แม่'].includes(inviteLabel) ? '' : inviteLabel}
                    onChange={(e) => setInviteLabel(e.target.value)}
                    placeholder="หรือพิมพ์เอง เช่น คุณยาย"
                    className="h-9 text-base flex-1"
                  />
                </div>
                <Button className="w-full" size="sm" disabled={creatingInvite} onClick={createInvite}>
                  {creatingInvite
                    ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" />กำลังสร้างคำเชิญ...</>)
                    : (<><LinkIcon className="h-4 w-4 mr-1" />ส่งคำเชิญทาง LINE</>)}
                </Button>
                <p className="text-sm text-muted-foreground">
                  ระบบจะเปิดหน้าแชร์ให้เลือกส่งหาคนที่ต้องการ (ลิงก์มีอายุ 3 วัน)
                </p>
              </div>
            )}

            {recipients.length === 0 && !showInviteForm && (
              <p className="text-base text-muted-foreground">
                ยังไม่มีผู้รับเพิ่มเติม — กด &quot;เพิ่ม&quot; เพื่อเชิญพ่อ/แม่อีกคนรับแจ้งเตือนด้วย
              </p>
            )}
          </CardContent>
        </Card>

        {/* Students Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                รายชื่อนักเรียน ({students.length} คน)
              </CardTitle>
              {parentId && (
                <Button
                  size="sm"
                  onClick={() => navigateTo(`/liff/profile/${parentId}/students/new`)}
                  disabled={navigating}
                  className="text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  เพิ่ม
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">ยังไม่มีข้อมูลนักเรียน</p>
                <Button 
                  onClick={() => navigateTo(`/liff/profile/${parentId}/students/new`)}
                  className="gap-2"
                  disabled={!parentId || navigating}
                >
                  <Users className="h-4 w-4" />
                  ลงทะเบียนนักเรียน
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="bg-gray-50 rounded-lg p-3 active:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-base">
                          {student.nickname || student.name}
                        </p>
                        <div className="text-base text-muted-foreground space-y-1 mt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{student.gradeLevel || 'ไม่ระบุชั้นเรียน'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              อายุ {calculateAge(student.birthdate)} ปี
                            </span>
                          </div>
                          {student.schoolName && (
                            <div className="flex items-center gap-1">
                              <School className="h-3 w-3" />
                              <span className="truncate">{student.schoolName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => navigateTo(`/liff/profile/${parentId}/students/${student.id}`)}
                          disabled={navigating}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteStudentData(student)}
                          disabled={navigating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {students.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>เมนูลัด</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => navigateTo('/liff/schedule')}
                disabled={navigating}
              >
                <Calendar className="h-6 w-6" />
                <span className="text-base">ตารางเรียน</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => navigateTo('/liff/makeup')}
                disabled={navigating}
              >
                <Users className="h-6 w-6" />
                <span className="text-base">Makeup Class</span>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStudentData} onOpenChange={() => setDeleteStudentData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              ยืนยันการลบข้อมูล
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบข้อมูลของ <strong>{deleteStudentData?.nickname || deleteStudentData?.name}</strong> ใช่หรือไม่?
              <br />
              <span className="text-destructive text-base mt-2 block">
                ⚠️ การลบข้อมูลนี้ไม่สามารถย้อนกลับได้
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                'ยืนยันการลบ'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function ProfilePage() {
  return (
      <ProfileContent />
  );
}
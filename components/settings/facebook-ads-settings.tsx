'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Pagination, usePagination } from '@/components/ui/pagination'
import {
  Save,
  Loader2,
  TestTube,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  Users,
  Target,
  ScrollText,
  List,
  Plus,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getFacebookAdsSettings,
  updateFacebookAdsSettings,
  validateFacebookAdsSettings,
  FacebookAdsSettings,
} from '@/lib/services/facebook-ads-settings'
import { useAuth } from '@/hooks/useAuth'

interface FBAudience {
  id: string
  name: string
  approximate_count: number
}

interface LogEntry {
  id: string
  event_type: string
  fb_event_name: string
  event_id: string
  member_id: string | null
  phone_hash: string | null
  fb_status: string
  audience_status: string
  is_resend: boolean
  created_at: string
}

interface LogSummary {
  total: number
  sent: number
  failed: number
  pending: number
  byEventType: Record<string, number>
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  register: 'สมัครสมาชิก',
  trial: 'ทดลองเรียน',
  event_join: 'เข้าร่วม Event',
  purchase: 'สมัครเรียน',
}

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; subtext: string }> = {
  register: { bg: 'bg-green-50', text: 'text-green-700', subtext: 'text-green-600' },
  trial: { bg: 'bg-amber-50', text: 'text-amber-700', subtext: 'text-amber-600' },
  event_join: { bg: 'bg-purple-50', text: 'text-purple-700', subtext: 'text-purple-600' },
  purchase: { bg: 'bg-rose-50', text: 'text-rose-700', subtext: 'text-rose-600' },
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { label: 'สำเร็จ', variant: 'default' },
  failed: { label: 'ล้มเหลว', variant: 'destructive' },
  pending: { label: 'รอดำเนินการ', variant: 'secondary' },
  skipped: { label: 'ข้าม', variant: 'outline' },
  partial: { label: 'บางส่วน', variant: 'secondary' },
}

export default function FacebookAdsSettingsComponent() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [showTestEvent, setShowTestEvent] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [settings, setSettings] = useState<FacebookAdsSettings | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logSummary, setLogSummary] = useState<LogSummary | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logTotal, setLogTotal] = useState(0)
  const [logEventFilter, setLogEventFilter] = useState('all')
  const [logStatusFilter, setLogStatusFilter] = useState('all')

  // Audience picker state
  const [audiences, setAudiences] = useState<FBAudience[]>([])
  const [audiencesLoading, setAudiencesLoading] = useState(false)
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false)
  const [audiencePickerField, setAudiencePickerField] = useState<string>('')
  const [createAudienceOpen, setCreateAudienceOpen] = useState(false)
  const [createAudienceForField, setCreateAudienceForField] = useState<string>('')
  const [newAudienceName, setNewAudienceName] = useState('')
  const [newAudienceDesc, setNewAudienceDesc] = useState('')
  const [creatingAudience, setCreatingAudience] = useState(false)

  // Bulk sync state
  const [bulkSyncOpen, setBulkSyncOpen] = useState(false)
  const [bulkSyncingType, setBulkSyncingType] = useState<string | null>(null)
  const [bulkSyncResults, setBulkSyncResults] = useState<Record<string, {
    total: number
    synced: number
    failed: number
    skipped: number
    errors: string[]
  }>>({})

  const {
    currentPage: logPage,
    pageSize: logPageSize,
    handlePageChange: handleLogPageChange,
    handlePageSizeChange: handleLogPageSizeChange,
    resetPagination: resetLogPagination,
    totalPages: logTotalPages,
  } = usePagination(10)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Load logs when filters/page change
  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPage, logPageSize, logEventFilter, logStatusFilter])

  const loadSettings = async () => {
    try {
      const data = await getFacebookAdsSettings()
      setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('ไม่สามารถโหลดการตั้งค่าได้')
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams({
        page: logPage.toString(),
        pageSize: logPageSize.toString(),
      })
      if (logEventFilter !== 'all') params.append('eventType', logEventFilter)
      if (logStatusFilter !== 'all') params.append('fbStatus', logStatusFilter)

      const res = await fetch(`/api/fb/logs?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
        setLogTotal(data.total || 0)
        setLogSummary(data.summary || null)
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings || !user) return

    const validation = validateFacebookAdsSettings(settings)
    if (!validation.isValid) {
      setErrors(validation.errors)
      toast.error('กรุณาตรวจสอบข้อมูลให้ถูกต้อง')
      return
    }

    setSaving(true)
    setErrors({})

    try {
      await updateFacebookAdsSettings(settings, user.uid)
      toast.success('บันทึกการตั้งค่า Facebook Ads เรียบร้อยแล้ว')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!settings?.fbPixelId || !settings?.fbAccessToken) {
      toast.error('กรุณาระบุ Pixel ID และ Access Token ก่อน')
      return
    }

    setTesting(true)
    try {
      const res = await fetch('/api/fb/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: settings.fbAccessToken,
          pixelId: settings.fbPixelId,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message || 'การทดสอบล้มเหลว')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการทดสอบ')
    } finally {
      setTesting(false)
    }
  }

  const handleSendTestEvent = async () => {
    if (!testPhone.trim()) {
      toast.error('กรุณาใส่เบอร์โทรสำหรับทดสอบ')
      return
    }

    setSendingTest(true)
    try {
      const res = await fetch('/api/fb/test-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('ส่ง Test Event สำเร็จ! เช็คที่ Conversion Logs ด้านล่าง')
        loadLogs() // refresh logs
      } else {
        toast.error(data.error || 'ส่ง Test Event ล้มเหลว')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่ง Test Event')
    } finally {
      setSendingTest(false)
    }
  }

  const loadAudiences = useCallback(async () => {
    setAudiencesLoading(true)
    try {
      const res = await fetch('/api/fb/list-audiences', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setAudiences(data.audiences || [])
      } else {
        toast.error(data.error || 'ไม่สามารถโหลด Audiences ได้')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการโหลด Audiences')
    } finally {
      setAudiencesLoading(false)
    }
  }, [])

  const openAudiencePicker = (fieldName: string) => {
    setAudiencePickerField(fieldName)
    setAudiencePickerOpen(true)
    if (audiences.length === 0) {
      loadAudiences()
    }
  }

  const selectAudience = (audienceId: string) => {
    if (!settings) return
    setSettings({ ...settings, [audiencePickerField]: audienceId })
    setAudiencePickerOpen(false)
    toast.success('เลือก Audience เรียบร้อย')
  }

  const openCreateAudience = (fieldName: string) => {
    setCreateAudienceForField(fieldName)
    setNewAudienceName('')
    setNewAudienceDesc('')
    setCreateAudienceOpen(true)
  }

  const handleCreateAudience = async () => {
    if (!newAudienceName.trim()) {
      toast.error('กรุณาระบุชื่อ Audience')
      return
    }

    setCreatingAudience(true)
    try {
      const res = await fetch('/api/fb/create-audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAudienceName.trim(),
          description: newAudienceDesc.trim(),
        }),
      })
      const data = await res.json()

      if (data.success && data.audienceId) {
        if (settings && createAudienceForField) {
          setSettings({ ...settings, [createAudienceForField]: data.audienceId })
        }
        setCreateAudienceOpen(false)
        toast.success(`สร้าง Audience สำเร็จ (ID: ${data.audienceId})`)
        // Refresh audience list
        loadAudiences()
      } else {
        toast.error(data.error || 'สร้าง Audience ล้มเหลว')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการสร้าง Audience')
    } finally {
      setCreatingAudience(false)
    }
  }

  const handleBulkSync = async (audienceType: string) => {
    setBulkSyncingType(audienceType)

    try {
      const res = await fetch('/api/fb/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audienceType }),
      })
      const data = await res.json()

      if (data.success) {
        setBulkSyncResults((prev) => ({
          ...prev,
          [audienceType]: {
            total: data.total,
            synced: data.synced,
            failed: data.failed,
            skipped: data.skipped,
            errors: data.errors || [],
          },
        }))
        if (data.synced > 0) {
          toast.success(`Sync สำเร็จ ${data.synced}/${data.total} คน`)
        } else if (data.total === 0) {
          toast.info('ไม่พบข้อมูลสำหรับ sync')
        }
      } else {
        toast.error(data.error || 'Bulk sync ล้มเหลว')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการ sync')
    } finally {
      setBulkSyncingType(null)
    }
  }

  const maskedToken = settings?.fbAccessToken
    ? `${'*'.repeat(20)}${settings.fbAccessToken.slice(-4)}`
    : ''

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="space-y-6">
      {/* Section 1: API Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Facebook Pixel & API
          </CardTitle>
          <CardDescription>
            ตั้งค่า Pixel ID และ Access Token สำหรับ Conversions API (CAPI)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fbPixelId">Pixel ID</Label>
              <Input
                id="fbPixelId"
                placeholder="เช่น 1148775840080456"
                value={settings.fbPixelId}
                onChange={(e) =>
                  setSettings({ ...settings, fbPixelId: e.target.value })
                }
                className={errors.fbPixelId ? 'border-red-500' : ''}
              />
              {errors.fbPixelId && (
                <p className="text-sm text-red-500">{errors.fbPixelId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fbTestEventCode">Test Event Code (optional)</Label>
              <Input
                id="fbTestEventCode"
                placeholder="จาก Events Manager (ว่าง = production)"
                value={settings.fbTestEventCode}
                onChange={(e) =>
                  setSettings({ ...settings, fbTestEventCode: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                ใส่ Test Event Code จาก Facebook Events Manager เพื่อทดสอบ ถ้าว่างจะส่งเป็น production
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fbAccessToken">Access Token</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="fbAccessToken"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Conversions API Access Token"
                  value={showToken ? settings.fbAccessToken : maskedToken}
                  onChange={(e) =>
                    setSettings({ ...settings, fbAccessToken: e.target.value })
                  }
                  onFocus={() => setShowToken(true)}
                  className={errors.fbAccessToken ? 'border-red-500' : ''}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowToken(!showToken)}
                type="button"
              >
                {showToken ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            {errors.fbAccessToken && (
              <p className="text-sm text-red-500">{errors.fbAccessToken}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adAccountId">Ad Account ID</Label>
            <Input
              id="adAccountId"
              placeholder="เช่น act_123456789 หรือ 123456789"
              value={settings.adAccountId}
              onChange={(e) =>
                setSettings({ ...settings, adAccountId: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              ใช้สำหรับสร้าง/ดึง Custom Audiences (หาได้จาก Facebook Ads Manager &gt; Settings &gt; Ad Account ID)
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !settings.fbPixelId || !settings.fbAccessToken}
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              ทดสอบการเชื่อมต่อ
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTestEvent(!showTestEvent)}
              disabled={!settings.fbPixelId || !settings.fbAccessToken}
            >
              <Send className="w-4 h-4 mr-2" />
              ส่ง Test Event
            </Button>
          </div>

          {showTestEvent && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <p className="text-sm text-muted-foreground">
                ส่ง Conversion Event จริง (CompleteRegistration) เพื่อทดสอบ pipeline ทั้งหมด
                {settings.fbTestEventCode
                  ? ` — ใช้ Test Event Code: ${settings.fbTestEventCode}`
                  : ' — ⚠️ ไม่มี Test Event Code จะส่งเป็น production'}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="เบอร์โทรทดสอบ เช่น 0812345678"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  onClick={handleSendTestEvent}
                  disabled={sendingTest || !testPhone.trim()}
                  size="sm"
                >
                  {sendingTest ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  ส่ง
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Custom Audiences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Custom Audience Mapping
          </CardTitle>
          <CardDescription>
            ใส่ Audience ID หรือกดเลือก/สร้างจากระบบ เพื่อ sync ข้อมูลอัตโนมัติ
            (ถ้าว่างจะข้ามการ sync สำหรับ segment นั้น)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { field: 'audienceAllMembers', label: 'ลูกค้าทั้งหมด', desc: 'ผู้ปกครองที่เคยสมัครเรียน (ทุกสถานะ)' },
              { field: 'audienceTrialNotEnrolled', label: 'สนใจแต่ยังไม่สมัคร', desc: 'ทดลองเรียน / เข้าร่วม Event / สมาชิกที่ยังไม่มี enrollment (จะถูกลบออกเมื่อสมัครจริง)' },
              { field: 'audienceEventAttendees', label: 'เข้าร่วม Event', desc: 'ผู้ปกครองที่เคยเข้าร่วม Event (Open House, Workshop ฯลฯ)' },
              { field: 'audienceCurrentStudents', label: 'ลูกค้าปัจจุบัน', desc: 'ผู้ปกครองที่มี enrollment active ทุกสาขา (สำหรับ exclude จาก Ad)' },
            ] as const).map(({ field, label, desc }) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{label}</Label>
                <div className="flex gap-1">
                  <Input
                    id={field}
                    placeholder="Audience ID"
                    value={settings[field]}
                    onChange={(e) =>
                      setSettings({ ...settings, [field]: e.target.value })
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    title="เลือกจาก Audiences ที่มี"
                    onClick={() => openAudiencePicker(field)}
                    disabled={!settings.adAccountId || !settings.fbAccessToken}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="สร้าง Audience ใหม่"
                    onClick={() => openCreateAudience(field)}
                    disabled={!settings.adAccountId || !settings.fbAccessToken}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          {!settings.adAccountId && (
            <p className="text-xs text-amber-600">
              กรอก Ad Account ID ด้านบนเพื่อเปิดใช้ปุ่มเลือก/สร้าง Audience
            </p>
          )}

          {settings.adAccountId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Graph API Query:</span>
              <code
                className="bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80 select-all"
                onClick={() => {
                  const cleanId = settings.adAccountId.replace(/^act_/, '')
                  const query = `act_${cleanId}/customaudiences?fields=id,name,approximate_count_lower_bound`
                  navigator.clipboard.writeText(query)
                  toast.success('คัดลอก query แล้ว')
                }}
                title="คลิกเพื่อคัดลอก"
              >
                act_{settings.adAccountId.replace(/^act_/, '')}/customaudiences?fields=id,name,approximate_count_lower_bound
              </code>
            </div>
          )}

          {/* Bulk Sync Button */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sync ข้อมูลเดิม</p>
                <p className="text-xs text-muted-foreground">
                  เพิ่มผู้ปกครองที่มีอยู่แล้วในระบบเข้า Audience (ใช้สำหรับครั้งแรกที่ตั้งค่า)
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setBulkSyncResults({})
                  setBulkSyncOpen(true)
                }}
                disabled={!settings.fbAccessToken}
              >
                <Upload className="w-4 h-4 mr-2" />
                Sync ข้อมูลเดิม
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audience Picker Dialog */}
      <Dialog open={audiencePickerOpen} onOpenChange={setAudiencePickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เลือก Custom Audience</DialogTitle>
            <DialogDescription>
              เลือก Audience จาก Ad Account ของคุณ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAudiences}
                disabled={audiencesLoading}
              >
                {audiencesLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                รีเฟรช
              </Button>
            </div>
            {audiencesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : audiences.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead className="text-right">ขนาด</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audiences.map((aud) => (
                      <TableRow key={aud.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{aud.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{aud.id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {aud.approximate_count.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectAudience(aud.id)}
                          >
                            เลือก
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                ไม่พบ Custom Audiences — ลองสร้างใหม่
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Audience Dialog */}
      <Dialog open={createAudienceOpen} onOpenChange={setCreateAudienceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>สร้าง Custom Audience ใหม่</DialogTitle>
            <DialogDescription>
              สร้าง Audience ใหม่ใน Ad Account ของคุณ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newAudienceName">ชื่อ Audience</Label>
              <Input
                id="newAudienceName"
                placeholder="เช่น All Members, Trial Not Enrolled"
                value={newAudienceName}
                onChange={(e) => setNewAudienceName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newAudienceDesc">คำอธิบาย (optional)</Label>
              <Input
                id="newAudienceDesc"
                placeholder="รายละเอียด Audience"
                value={newAudienceDesc}
                onChange={(e) => setNewAudienceDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateAudienceOpen(false)}
              disabled={creatingAudience}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreateAudience}
              disabled={creatingAudience || !newAudienceName.trim()}
            >
              {creatingAudience ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Sync Dialog */}
      <Dialog
        open={bulkSyncOpen}
        onOpenChange={(open) => {
          if (!open && bulkSyncingType !== null) return // ไม่ให้ปิดระหว่าง sync
          setBulkSyncOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={bulkSyncingType === null}>
          <DialogHeader>
            <DialogTitle>Sync ข้อมูลเดิมเข้า Audience</DialogTitle>
            <DialogDescription>
              เลือก Audience ที่ต้องการ sync ระบบจะเพิ่มผู้ปกครองที่มีอยู่แล้วเข้า Facebook Audience
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {([
              { type: 'all_members', field: 'audienceAllMembers', label: 'ลูกค้าทั้งหมด', desc: 'ผู้ปกครองที่เคยสมัครเรียน (ทุกสถานะ)' },
              { type: 'current_students', field: 'audienceCurrentStudents', label: 'ลูกค้าปัจจุบัน', desc: 'ผู้ปกครองที่มี enrollment active ทุกสาขา' },
              { type: 'trial_not_enrolled', field: 'audienceTrialNotEnrolled', label: 'สนใจแต่ยังไม่สมัคร', desc: 'trial bookings + event attendees + สมาชิกที่ไม่มี enrollment' },
              { type: 'event_attendees', field: 'audienceEventAttendees', label: 'เข้าร่วม Event', desc: 'ผู้ปกครองที่เคยเข้าร่วม Event ทั้งหมด' },
            ] as const).map(({ type, field, label, desc }) => {
              const audienceId = settings[field]
              const isConfigured = !!audienceId
              const isSyncing = bulkSyncingType === type
              const result = bulkSyncResults[type]

              return (
                <div
                  key={type}
                  className={`flex items-center justify-between p-3 border rounded-lg ${!isConfigured ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                    {!isConfigured && (
                      <p className="text-xs text-amber-600">ยังไม่ได้ตั้งค่า Audience ID</p>
                    )}
                    {isSyncing && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        กำลัง sync... ห้ามปิดหน้านี้
                      </p>
                    )}
                    {result && (
                      <div className="mt-1 flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          ทั้งหมด {result.total}
                        </Badge>
                        {result.synced > 0 && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            สำเร็จ {result.synced}
                          </Badge>
                        )}
                        {result.failed > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            ล้มเหลว {result.failed}
                          </Badge>
                        )}
                        {result.skipped > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            ข้าม {result.skipped}
                          </Badge>
                        )}
                      </div>
                    )}
                    {result && result.errors.length > 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        {result.errors[0]}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isSyncing ? 'default' : 'outline'}
                    onClick={() => handleBulkSync(type)}
                    disabled={!isConfigured || bulkSyncingType !== null}
                    className="shrink-0"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkSyncOpen(false)}
              disabled={bulkSyncingType !== null}
            >
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          บันทึกการตั้งค่า
        </Button>
      </div>

      {/* Section 3: Conversion Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5" />
                Conversion Logs
              </CardTitle>
              <CardDescription>ประวัติการส่ง conversion events</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={logsLoading}
            >
              {logsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary by Event Type */}
          {logSummary && logSummary.total > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{logSummary.total}</p>
                <p className="text-xs text-blue-600">ทั้งหมด</p>
              </div>
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => {
                const count = logSummary.byEventType[key] || 0
                const colors = EVENT_TYPE_COLORS[key] || { bg: 'bg-gray-50', text: 'text-gray-700', subtext: 'text-gray-600' }
                return (
                  <div key={key} className={`${colors.bg} rounded-lg p-3 text-center`}>
                    <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
                    <p className={`text-xs ${colors.subtext}`}>{label}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Select value={logEventFilter} onValueChange={setLogEventFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="ประเภท Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="register">สมัครสมาชิก</SelectItem>
                <SelectItem value="trial">ทดลองเรียน</SelectItem>
                <SelectItem value="event_join">เข้าร่วม Event</SelectItem>
                <SelectItem value="purchase">สมัครเรียน</SelectItem>
              </SelectContent>
            </Select>

            <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="sent">สำเร็จ</SelectItem>
                <SelectItem value="failed">ล้มเหลว</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length > 0 ? (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เวลา</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>FB Event</TableHead>
                      <TableHead>CAPI</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Re-send</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('th-TH', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {EVENT_TYPE_LABELS[log.event_type] || log.event_type}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.fb_event_name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_BADGE[log.fb_status]?.variant || 'outline'
                            }
                            className="text-xs"
                          >
                            {STATUS_BADGE[log.fb_status]?.label || log.fb_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_BADGE[log.audience_status]?.variant ||
                              'outline'
                            }
                            className="text-xs"
                          >
                            {STATUS_BADGE[log.audience_status]?.label ||
                              log.audience_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.is_resend && (
                            <Badge variant="outline" className="text-xs">
                              <Send className="w-3 h-3 mr-1" />
                              re-sent
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                currentPage={logPage}
                totalPages={logTotalPages(logTotal)}
                pageSize={logPageSize}
                totalItems={logTotal}
                onPageChange={handleLogPageChange}
                onPageSizeChange={handleLogPageSizeChange}
                pageSizeOptions={[10, 20, 50]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              ยังไม่มีประวัติการส่ง conversion events
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

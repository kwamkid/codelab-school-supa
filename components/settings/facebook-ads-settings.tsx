'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getFacebookAdsSettings,
  updateFacebookAdsSettings,
  validateFacebookAdsSettings,
  FacebookAdsSettings,
} from '@/lib/services/facebook-ads-settings'
import { useAuth } from '@/hooks/useAuth'

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
  fb_response: Record<string, unknown> | null
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
            ใส่ Audience ID จาก Facebook Ads Manager เพื่อ sync ข้อมูลอัตโนมัติ
            (ถ้าว่างจะข้ามการ sync สำหรับ segment นั้น)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audienceAllMembers">สมาชิกทั้งหมด</Label>
              <Input
                id="audienceAllMembers"
                placeholder="Audience ID"
                value={settings.audienceAllMembers}
                onChange={(e) =>
                  setSettings({ ...settings, audienceAllMembers: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                ผู้ปกครองที่สมัครสมาชิกทุกคน
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audienceTrialNotEnrolled">
                ทดลองแล้วยังไม่สมัคร
              </Label>
              <Input
                id="audienceTrialNotEnrolled"
                placeholder="Audience ID"
                value={settings.audienceTrialNotEnrolled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    audienceTrialNotEnrolled: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                ลงทะเบียนทดลองเรียนแล้ว แต่ยังไม่สมัคร (จะถูกลบออกเมื่อสมัครจริง)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audienceEventAttendees">เข้าร่วม Event</Label>
              <Input
                id="audienceEventAttendees"
                placeholder="Audience ID"
                value={settings.audienceEventAttendees}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    audienceEventAttendees: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                ผู้ปกครองที่เคยเข้าร่วม Event (Open House, Workshop ฯลฯ)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audienceCurrentStudents">ลูกค้าปัจจุบัน</Label>
              <Input
                id="audienceCurrentStudents"
                placeholder="Audience ID"
                value={settings.audienceCurrentStudents}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    audienceCurrentStudents: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                ผู้ปกครองที่สมัครเรียนจริงแล้ว (สำหรับ exclude จาก Ad)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {/* Summary */}
          {logSummary && logSummary.total > 0 && (
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="text-sm">
                ทั้งหมด {logSummary.total}
              </Badge>
              <Badge variant="default" className="text-sm">
                <CheckCircle className="w-3 h-3 mr-1" />
                สำเร็จ {logSummary.sent}
              </Badge>
              {logSummary.failed > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <XCircle className="w-3 h-3 mr-1" />
                  ล้มเหลว {logSummary.failed}
                </Badge>
              )}
              {logSummary.pending > 0 && (
                <Badge variant="secondary" className="text-sm">
                  รอ {logSummary.pending}
                </Badge>
              )}
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

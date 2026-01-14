'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Users,
  UserCheck,
  Target,
  TrendingUp,
  Loader2,
  Filter,
  RefreshCw,
  Calendar,
  ChevronRight,
  Phone,
  Eye
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useBranch } from '@/contexts/BranchContext'
import Link from 'next/link'

// Date preset helpers
const getThailandDate = () => {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

const formatDateForInput = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const getDatePresets = () => {
  const today = getThailandDate()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)

  const startOfYear = new Date(today.getFullYear(), 0, 1)

  const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1)
  const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31)

  return {
    today: {
      label: 'วันนี้',
      startDate: formatDateForInput(today),
      endDate: formatDateForInput(today)
    },
    yesterday: {
      label: 'เมื่อวาน',
      startDate: formatDateForInput(yesterday),
      endDate: formatDateForInput(yesterday)
    },
    thisWeek: {
      label: 'สัปดาห์นี้',
      startDate: formatDateForInput(startOfWeek),
      endDate: formatDateForInput(today)
    },
    thisMonth: {
      label: 'เดือนนี้',
      startDate: formatDateForInput(startOfMonth),
      endDate: formatDateForInput(today)
    },
    lastMonth: {
      label: 'เดือนที่แล้ว',
      startDate: formatDateForInput(startOfLastMonth),
      endDate: formatDateForInput(endOfLastMonth)
    },
    thisYear: {
      label: 'ปีนี้',
      startDate: formatDateForInput(startOfYear),
      endDate: formatDateForInput(today)
    },
    lastYear: {
      label: 'ปีที่แล้ว',
      startDate: formatDateForInput(startOfLastYear),
      endDate: formatDateForInput(endOfLastYear)
    },
    custom: {
      label: 'กำหนดเอง',
      startDate: '',
      endDate: ''
    }
  }
}

interface TrialStats {
  total: number
  attended: number
  absent: number
  cancelled: number
  converted: number
  attendedRate: number
  conversionRate: number
  byInterestLevel: {
    high: number
    medium: number
    low: number
    not_interested: number
    null: number
  }
  bySubject: Array<{
    subjectId: string
    subjectName: string
    total: number
    converted: number
    conversionRate: number
  }>
  byBranch: Array<{
    branchId: string
    branchName: string
    total: number
    attended: number
    converted: number
    conversionRate: number
  }>
}

interface TrialSession {
  id: string
  student_name: string
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
  attended: boolean
  interested_level: string | null
  converted: boolean
  feedback: string | null
  subject_name: string | null
  branch_name: string | null
  teacher_name: string | null
  parent_name: string | null
  parent_phone: string | null
  source: string | null
}

export default function TrialReportPage() {
  const { selectedBranchId } = useBranch()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TrialStats | null>(null)
  const [sessions, setSessions] = useState<TrialSession[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const presets = useMemo(() => getDatePresets(), [])

  const [selectedPreset, setSelectedPreset] = useState<string>('thisMonth')
  const [filters, setFilters] = useState({
    startDate: presets.thisMonth.startDate,
    endDate: presets.thisMonth.endDate
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (selectedBranchId) params.append('branchId', selectedBranchId)
      params.append('page', page.toString())
      params.append('pageSize', pageSize.toString())

      const response = await fetch(`/api/reports/trial?${params}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
        setSessions(data.sessions)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error loading trial report:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filters, selectedBranchId, page])

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    if (preset !== 'custom') {
      const presetData = presets[preset as keyof typeof presets]
      setFilters({
        startDate: presetData.startDate,
        endDate: presetData.endDate
      })
    }
    setPage(1)
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setSelectedPreset('custom')
    setFilters(prev => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const getStatusBadge = (session: TrialSession) => {
    if (session.converted) {
      return <Badge className="bg-green-100 text-green-800">ปิดการขาย</Badge>
    }
    if (session.status === 'attended' || session.attended) {
      return <Badge className="bg-blue-100 text-blue-800">เข้าเรียน</Badge>
    }
    if (session.status === 'absent') {
      return <Badge className="bg-red-100 text-red-800">ไม่มา</Badge>
    }
    if (session.status === 'cancelled') {
      return <Badge className="bg-gray-100 text-gray-800">ยกเลิก</Badge>
    }
    return <Badge className="bg-yellow-100 text-yellow-800">รอดำเนินการ</Badge>
  }

  const getInterestBadge = (level: string | null) => {
    switch (level) {
      case 'high':
        return <Badge className="bg-green-100 text-green-800">สนใจสูง</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">สนใจปานกลาง</Badge>
      case 'low':
        return <Badge className="bg-orange-100 text-orange-800">สนใจน้อย</Badge>
      case 'not_interested':
        return <Badge className="bg-red-100 text-red-800">ไม่สนใจ</Badge>
      default:
        return <Badge variant="outline">ยังไม่ประเมิน</Badge>
    }
  }

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case 'online':
        return 'ออนไลน์'
      case 'walkin':
        return 'Walk-in'
      case 'phone':
        return 'โทรศัพท์'
      default:
        return '-'
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="w-8 h-8" />
          รายงานทดลองเรียน (Free Trial)
        </h1>
        <p className="text-muted-foreground mt-2">
          สรุปข้อมูลการทดลองเรียนและอัตราการปิดการขาย
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Preset */}
            <div className="space-y-2">
              <Label>ช่วงเวลา</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(presets).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>วันที่เริ่มต้น</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>วันที่สิ้นสุด</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <Button onClick={loadData} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                รีเฟรช
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                ทดลองเรียนทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">คน</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-600">
                <UserCheck className="w-4 h-4" />
                เข้าเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.attended}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.attendedRate}% ของทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                <Target className="w-4 h-4" />
                ปิดการขาย
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.converted}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.conversionRate}% ของผู้เข้าเรียน
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-600">
                <TrendingUp className="w-4 h-4" />
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.converted} / {stats.attended} คน
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conversion Funnel */}
      {stats && stats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>
              สัดส่วนการแปลงจากทดลองเรียนสู่การสมัครเรียน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Funnel Bars */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>ทดลองเรียน (Booked)</span>
                  <span className="font-medium">{stats.total} คน</span>
                </div>
                <div className="h-8 bg-blue-500 rounded-md flex items-center justify-center text-white text-sm font-medium">
                  100%
                </div>
              </div>

              <div className="flex justify-center">
                <ChevronRight className="w-6 h-6 text-muted-foreground rotate-90" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>เข้าเรียน (Attended)</span>
                  <span className="font-medium">{stats.attended} คน</span>
                </div>
                <div
                  className="h-8 bg-indigo-500 rounded-md flex items-center justify-center text-white text-sm font-medium"
                  style={{ width: `${stats.attendedRate}%`, minWidth: '60px' }}
                >
                  {stats.attendedRate}%
                </div>
              </div>

              <div className="flex justify-center">
                <ChevronRight className="w-6 h-6 text-muted-foreground rotate-90" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>ปิดการขาย (Converted)</span>
                  <span className="font-medium">{stats.converted} คน</span>
                </div>
                <div
                  className="h-8 bg-green-500 rounded-md flex items-center justify-center text-white text-sm font-medium"
                  style={{ width: `${stats.total > 0 ? (stats.converted / stats.total) * 100 : 0}%`, minWidth: '60px' }}
                >
                  {stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interest Level & Branch Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interest Level */}
          <Card>
            <CardHeader>
              <CardTitle>ระดับความสนใจ</CardTitle>
              <CardDescription>จากผู้ที่เข้าทดลองเรียน</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>สนใจสูง</span>
                  </div>
                  <span className="font-medium">{stats.byInterestLevel.high}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>สนใจปานกลาง</span>
                  </div>
                  <span className="font-medium">{stats.byInterestLevel.medium}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>สนใจน้อย</span>
                  </div>
                  <span className="font-medium">{stats.byInterestLevel.low}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>ไม่สนใจ</span>
                  </div>
                  <span className="font-medium">{stats.byInterestLevel.not_interested}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <span>ยังไม่ประเมิน</span>
                  </div>
                  <span className="font-medium">{stats.byInterestLevel.null}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* By Branch */}
          <Card>
            <CardHeader>
              <CardTitle>แยกตามสาขา</CardTitle>
              <CardDescription>อัตราการปิดการขายแต่ละสาขา</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.byBranch.length > 0 ? (
                <div className="space-y-3">
                  {stats.byBranch.map((branch) => (
                    <div key={branch.branchId} className="flex items-center justify-between">
                      <span>{branch.branchName}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {branch.converted}/{branch.attended} คน
                        </span>
                        <Badge className={branch.conversionRate >= 30 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {branch.conversionRate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trial Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการทดลองเรียน</CardTitle>
          <CardDescription>
            แสดง {sessions.length} รายการจากทั้งหมด {total} รายการ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              ไม่พบข้อมูล
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>นักเรียน</TableHead>
                    <TableHead>วิชา</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>ที่มา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ความสนใจ</TableHead>
                    <TableHead>ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(session.scheduled_date).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{session.student_name}</div>
                        {session.parent_name && (
                          <div className="text-xs text-muted-foreground">
                            ผู้ปกครอง: {session.parent_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{session.subject_name || '-'}</TableCell>
                      <TableCell>{session.branch_name || '-'}</TableCell>
                      <TableCell>{getSourceLabel(session.source)}</TableCell>
                      <TableCell>{getStatusBadge(session)}</TableCell>
                      <TableCell>{getInterestBadge(session.interested_level)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {session.parent_phone && (
                            <a href={`tel:${session.parent_phone}`}>
                              <Button variant="ghost" size="sm">
                                <Phone className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                          <Link href={`/trial/${session.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                หน้า {page} จาก {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

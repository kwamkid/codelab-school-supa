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
  UserPlus,
  TestTube,
  Footprints,
  Loader2,
  Filter,
  RefreshCw,
  Calendar,
  CreditCard,
  DollarSign,
  TrendingUp,
  Phone,
  Eye
} from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import Link from 'next/link'

// Date preset helpers (same as trial report)
const getThailandDate = () => {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

const formatDateForInput = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
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

interface EnrollmentStats {
  total: number
  fromTrial: number
  walkIn: number
  byPaymentStatus: {
    paid: number
    partial: number
    pending: number
  }
  byStatus: {
    active: number
    completed: number
    dropped: number
    transferred: number
  }
  totalRevenue: number
  paidRevenue: number
  pendingRevenue: number
  bySubject: Array<{
    subjectId: string
    subjectName: string
    total: number
    revenue: number
  }>
  byBranch: Array<{
    branchId: string
    branchName: string
    total: number
    fromTrial: number
    revenue: number
  }>
}

interface Enrollment {
  id: string
  student_name: string
  student_nickname: string | null
  class_name: string
  subject_name: string | null
  branch_name: string | null
  enrolled_at: string
  status: string
  payment_status: string
  final_price: number
  paid_amount: number
  from_trial: boolean
  parent_name: string | null
  parent_phone: string | null
}

export default function EnrollmentReportPage() {
  const { selectedBranchId } = useBranch()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<EnrollmentStats | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const presets = useMemo(() => getDatePresets(), [])

  const [selectedPreset, setSelectedPreset] = useState<string>('thisMonth')
  const [filters, setFilters] = useState({
    startDate: presets.thisMonth.startDate,
    endDate: presets.thisMonth.endDate
  })
  const [subjectSortBy, setSubjectSortBy] = useState<'revenue' | 'students'>('revenue')

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (selectedBranchId) params.append('branchId', selectedBranchId)
      params.append('page', page.toString())
      params.append('pageSize', pageSize.toString())

      const response = await fetch(`/api/reports/enrollment?${params}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
        setEnrollments(data.enrollments)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error loading enrollment report:', error)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">กำลังเรียน</Badge>
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800">เรียนจบ</Badge>
      case 'dropped':
        return <Badge className="bg-red-100 text-red-800">ยกเลิก</Badge>
      case 'transferred':
        return <Badge className="bg-yellow-100 text-yellow-800">โอนย้าย</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">ชำระแล้ว</Badge>
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">ชำระบางส่วน</Badge>
      case 'pending':
        return <Badge className="bg-red-100 text-red-800">รอชำระ</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
          <UserPlus className="w-8 h-8" />
          รายงานการสมัครเรียน (Enrollment)
        </h1>
        <p className="text-muted-foreground mt-2">
          สรุปข้อมูลการสมัครเรียนและรายได้
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                สมัครเรียนทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">คน</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-600">
                <TestTube className="w-4 h-4" />
                จาก Trial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-3xl font-bold text-cyan-600">{stats.fromTrial}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? Math.round((stats.fromTrial / stats.total) * 100) : 0}% ของทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600">
                <Footprints className="w-4 h-4" />
                Walk-in / Direct
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-3xl font-bold text-orange-600">{stats.walkIn}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? Math.round((stats.walkIn / stats.total) * 100) : 0}% ของทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                <DollarSign className="w-4 h-4" />
                รายได้รวม
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ชำระแล้ว {formatCurrency(stats.paidRevenue)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue & Payment Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                สถานะการชำระเงิน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>ชำระแล้ว</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{stats.byPaymentStatus.paid} คน</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.total > 0 ? Math.round((stats.byPaymentStatus.paid / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>ชำระบางส่วน</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{stats.byPaymentStatus.partial} คน</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.total > 0 ? Math.round((stats.byPaymentStatus.partial / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>รอชำระ</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{stats.byPaymentStatus.pending} คน</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.total > 0 ? Math.round((stats.byPaymentStatus.pending / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ยอดค้างชำระ</span>
                    <span className="font-medium text-red-600">{formatCurrency(stats.pendingRevenue)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* By Branch */}
          <Card>
            <CardHeader>
              <CardTitle>แยกตามสาขา</CardTitle>
              <CardDescription>จำนวนการสมัครและรายได้</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.byBranch.length > 0 ? (
                <div className="space-y-3">
                  {stats.byBranch.map((branch) => (
                    <div key={branch.branchId} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{branch.branchName}</span>
                        <div className="text-xs text-muted-foreground">
                          {branch.fromTrial} จาก Trial
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{branch.total} คน</div>
                        <div className="text-xs text-green-600">{formatCurrency(branch.revenue)}</div>
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

      {/* By Subject */}
      {stats && stats.bySubject.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  แยกตามวิชา
                </CardTitle>
                <CardDescription>
                  {subjectSortBy === 'revenue' ? 'เรียงตามรายได้สูงสุด' : 'เรียงตามจำนวนนักเรียน'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={subjectSortBy === 'revenue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubjectSortBy('revenue')}
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  รายได้
                </Button>
                <Button
                  variant={subjectSortBy === 'students' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSubjectSortBy('students')}
                >
                  <Users className="w-4 h-4 mr-1" />
                  จำนวนคน
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...stats.bySubject]
                .sort((a, b) => subjectSortBy === 'revenue' ? b.revenue - a.revenue : b.total - a.total)
                .map((subject, index) => {
                  // Subject colors array
                  const colors = [
                    { bg: 'bg-gradient-to-br from-green-500 to-green-600', text: 'text-white', badge: 'bg-green-700' },
                    { bg: 'bg-gradient-to-br from-blue-500 to-blue-600', text: 'text-white', badge: 'bg-blue-700' },
                    { bg: 'bg-gradient-to-br from-purple-500 to-purple-600', text: 'text-white', badge: 'bg-purple-700' },
                    { bg: 'bg-gradient-to-br from-orange-500 to-orange-600', text: 'text-white', badge: 'bg-orange-700' },
                    { bg: 'bg-gradient-to-br from-pink-500 to-pink-600', text: 'text-white', badge: 'bg-pink-700' },
                    { bg: 'bg-gradient-to-br from-cyan-500 to-cyan-600', text: 'text-white', badge: 'bg-cyan-700' },
                    { bg: 'bg-gradient-to-br from-amber-500 to-amber-600', text: 'text-white', badge: 'bg-amber-700' },
                    { bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600', text: 'text-white', badge: 'bg-indigo-700' },
                  ]
                  const color = colors[index % colors.length]
                  const maxValue = subjectSortBy === 'revenue'
                    ? Math.max(...stats.bySubject.map(s => s.revenue))
                    : Math.max(...stats.bySubject.map(s => s.total))
                  const currentValue = subjectSortBy === 'revenue' ? subject.revenue : subject.total
                  const progressPercent = maxValue > 0 ? (currentValue / maxValue) * 100 : 0

                  return (
                    <div
                      key={subject.subjectId}
                      className={`p-4 rounded-lg ${color.bg} ${color.text} shadow-md relative overflow-hidden`}
                    >
                      {/* Rank badge */}
                      {index < 3 && (
                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full ${color.badge} flex items-center justify-center text-xs font-bold`}>
                          {index + 1}
                        </div>
                      )}

                      <div className="font-semibold text-lg mb-3">{subject.subjectName}</div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-white/30 rounded-full mb-3">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-xl sm:text-3xl font-bold">{subject.total}</div>
                          <div className="text-xs opacity-80">คน</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">{formatCurrency(subject.revenue)}</div>
                          <div className="text-xs opacity-80">รายได้</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการสมัครเรียน</CardTitle>
          <CardDescription>
            แสดง {enrollments.length} รายการจากทั้งหมด {total} รายการ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              ไม่พบข้อมูล
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่สมัคร</TableHead>
                    <TableHead>นักเรียน</TableHead>
                    <TableHead>คลาส</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>ที่มา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>การชำระเงิน</TableHead>
                    <TableHead className="text-right">ยอดเงิน</TableHead>
                    <TableHead>ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(enrollment.enrolled_at).toLocaleDateString('th-TH')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {enrollment.student_nickname || enrollment.student_name}
                        </div>
                        {enrollment.parent_name && (
                          <div className="text-xs text-muted-foreground">
                            ผู้ปกครอง: {enrollment.parent_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{enrollment.class_name}</div>
                        {enrollment.subject_name && (
                          <div className="text-xs text-muted-foreground">{enrollment.subject_name}</div>
                        )}
                      </TableCell>
                      <TableCell>{enrollment.branch_name || '-'}</TableCell>
                      <TableCell>
                        {enrollment.from_trial ? (
                          <Badge className="bg-cyan-100 text-cyan-800">
                            <TestTube className="w-3 h-3 mr-1" />
                            Trial
                          </Badge>
                        ) : (
                          <Badge variant="outline">Walk-in</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                      <TableCell>{getPaymentBadge(enrollment.payment_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{formatCurrency(enrollment.final_price)}</div>
                        {enrollment.paid_amount > 0 && enrollment.paid_amount < enrollment.final_price && (
                          <div className="text-xs text-green-600">
                            ชำระแล้ว {formatCurrency(enrollment.paid_amount)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {enrollment.parent_phone && (
                            <a href={`tel:${enrollment.parent_phone}`}>
                              <Button variant="ghost" size="sm">
                                <Phone className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                          <Link href={`/enrollments/${enrollment.id}`}>
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

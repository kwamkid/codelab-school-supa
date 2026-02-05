'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Users,
  Search,
  Loader2,
  RefreshCw,
  GraduationCap,
  School,
  Settings2,
  Merge,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface SchoolWithBranch {
  displayName: string
  count: number
  variants: string[]
  byBranch: Record<string, number>
}

interface BranchStat {
  branchId: string
  branchName: string
  count: number
}

interface StudentStats {
  total: number
  active: number
  inactive: number
  byGender: { male: number; female: number }
  byGradeLevel: Array<{
    gradeLevel: string
    category: string
    count: number
  }>
  bySchool: SchoolWithBranch[]
  byBranch: BranchStat[]
  noSchool: number
  noGrade: number
}

export default function StudentReportPage() {
  const { selectedBranchId, isAllBranches } = useBranch()
  const { isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StudentStats | null>(null)

  const [statusFilter, setStatusFilter] = useState('all')

  // School search & sort
  const [schoolSearch, setSchoolSearch] = useState('')
  const [sortKey, setSortKey] = useState<string>('count') // 'name', 'count', or branch name
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Merge UI state
  const [mergeOpen, setMergeOpen] = useState(false)
  const [allSchools, setAllSchools] = useState<Array<{ name: string; count: number }>>([])
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set())
  const [mergeTarget, setMergeTarget] = useState('')
  const [merging, setMerging] = useState(false)
  const [normalizing, setNormalizing] = useState(false)
  const [mergeSearch, setMergeSearch] = useState('')

  // Pagination for school table
  const {
    currentPage: schoolPage,
    pageSize: schoolPageSize,
    handlePageChange: handleSchoolPageChange,
    handlePageSizeChange: handleSchoolPageSizeChange,
    resetPagination: resetSchoolPagination,
    getPaginatedData: getSchoolPaginatedData,
    totalPages: schoolTotalPages,
  } = usePagination(20)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBranchId) params.append('branchId', selectedBranchId)
      params.append('status', statusFilter)
      params.append('_t', Date.now().toString())

      const response = await fetch(`/api/reports/students?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading student report:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedBranchId, statusFilter])

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
  }

  // Filter and sort schools
  const filteredSchools = useMemo(() => {
    if (!stats) return []
    let list = stats.bySchool
    if (schoolSearch) {
      const q = schoolSearch.toLowerCase()
      list = list.filter(s => s.displayName.toLowerCase().includes(q))
    }
    const sorted = [...list].sort((a, b) => {
      let valA: number | string
      let valB: number | string
      if (sortKey === 'name') {
        valA = a.displayName
        valB = b.displayName
        return sortDir === 'asc'
          ? valA.localeCompare(valB, 'th')
          : valB.localeCompare(valA, 'th')
      } else if (sortKey === 'count') {
        valA = a.count
        valB = b.count
      } else {
        // branch name
        valA = a.byBranch[sortKey] || 0
        valB = b.byBranch[sortKey] || 0
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
    })
    return sorted
  }, [stats, schoolSearch, sortKey, sortDir])

  // Reset pagination when search or sort changes
  useEffect(() => {
    resetSchoolPagination()
  }, [schoolSearch, sortKey, sortDir, resetSchoolPagination])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />
  }

  const paginatedSchools = getSchoolPaginatedData(filteredSchools)

  // Get branch names from school data for table headers
  const branchNames = useMemo(() => {
    if (!stats || !isAllBranches) return []
    const names = new Set<string>()
    for (const school of stats.bySchool) {
      for (const bName of Object.keys(school.byBranch)) {
        names.add(bName)
      }
    }
    return Array.from(names).sort()
  }, [stats, isAllBranches])

  const loadAllSchools = async () => {
    try {
      const res = await fetch(`/api/schools?_t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setAllSchools(data.schools || [])
      }
    } catch (error) {
      console.error('Error loading schools:', error)
    }
  }

  const handleOpenMerge = () => {
    setMergeOpen(true)
    setSelectedSchools(new Set())
    setMergeTarget('')
    setMergeSearch('')
    loadAllSchools()
  }

  // Filter schools in merge dialog
  const filteredMergeSchools = useMemo(() => {
    if (!mergeSearch) return allSchools
    const q = mergeSearch.toLowerCase()
    return allSchools.filter(s => s.name.toLowerCase().includes(q))
  }, [allSchools, mergeSearch])

  const handleMerge = async () => {
    if (!mergeTarget || selectedSchools.size < 2) return

    setMerging(true)
    try {
      const sources = Array.from(selectedSchools)
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'merge', target: mergeTarget, sources }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`รวมชื่อโรงเรียนสำเร็จ (อัปเดต ${data.updated} รายการ)`)
        setMergeOpen(false)
        loadData()
      } else {
        toast.error('เกิดข้อผิดพลาดในการรวมชื่อ')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการรวมชื่อ')
    } finally {
      setMerging(false)
    }
  }

  const handleNormalize = async () => {
    setNormalizing(true)
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'normalize' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Normalize สำเร็จ (อัปเดต ${data.updated} รายการ)`)
        loadAllSchools()
        loadData()
      } else {
        toast.error('เกิดข้อผิดพลาด')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setNormalizing(false)
    }
  }

  const toggleSchoolSelection = (name: string) => {
    setSelectedSchools(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
        if (mergeTarget === name) setMergeTarget('')
      } else {
        next.add(name)
      }
      return next
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            รายงานนักเรียน
          </h1>
          <p className="text-muted-foreground mt-2">
            สรุปข้อมูลนักเรียน ชั้นเรียน และโรงเรียน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="active">กำลังเรียน</SelectItem>
              <SelectItem value="inactive">ไม่ได้เรียน</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">นักเรียนทั้งหมด</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-600">กำลังเรียน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-600">ชาย</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.byGender.male.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? `${Math.round((stats.byGender.male / stats.total) * 100)}%` : '0%'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-pink-600">หญิง</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-pink-600">{stats.byGender.female.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? `${Math.round((stats.byGender.female / stats.total) * 100)}%` : '0%'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Branch Comparison (only when viewing all branches) */}
          {isAllBranches && stats.byBranch.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  แยกตามสาขา
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    const maxCount = Math.max(...stats.byBranch.map(b => b.count))
                    return stats.byBranch
                      .sort((a, b) => b.count - a.count)
                      .map((branch) => (
                        <div key={branch.branchId} className="flex items-center gap-3">
                          <span className="text-sm w-32 shrink-0 truncate" title={branch.branchName}>
                            {branch.branchName}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="bg-purple-500 h-full rounded-full transition-all"
                              style={{ width: `${(branch.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{branch.count}</span>
                        </div>
                      ))
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribution: Grade + School Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  แยกตามชั้นเรียน
                </CardTitle>
                <CardDescription>
                  {stats.noGrade > 0 && `ไม่ระบุชั้นเรียน: ${stats.noGrade} คน`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.byGradeLevel.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const maxCount = Math.max(...stats.byGradeLevel.map(g => g.count))
                      let lastCategory = ''
                      return stats.byGradeLevel.map((grade) => {
                        const showCategory = grade.category !== lastCategory
                        lastCategory = grade.category
                        return (
                          <div key={grade.gradeLevel}>
                            {showCategory && (
                              <div className="text-xs font-medium text-muted-foreground mt-3 mb-1 first:mt-0">
                                {grade.category}
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <span className="text-sm w-20 shrink-0">{grade.gradeLevel}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                <div
                                  className="bg-blue-500 h-full rounded-full transition-all"
                                  style={{ width: `${(grade.count / maxCount) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-12 text-right">{grade.count}</span>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูลชั้นเรียน</p>
                )}
              </CardContent>
            </Card>

            {/* School Chart (top 15) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <School className="w-5 h-5" />
                  แยกตามโรงเรียน (Top 15)
                </CardTitle>
                <CardDescription>
                  {stats.noSchool > 0 && `ไม่ระบุโรงเรียน: ${stats.noSchool} คน`}
                  {stats.bySchool.length > 0 && ` | ทั้งหมด ${stats.bySchool.length} โรงเรียน`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.bySchool.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const maxCount = Math.max(...stats.bySchool.map(s => s.count))
                      return stats.bySchool.slice(0, 15).map((school) => (
                        <div key={school.displayName} className="flex items-center gap-3">
                          <span className="text-sm flex-1 min-w-0 truncate" title={school.displayName}>
                            {school.displayName}
                          </span>
                          <div className="w-24 bg-gray-100 rounded-full h-5 overflow-hidden shrink-0">
                            <div
                              className="bg-green-500 h-full rounded-full transition-all"
                              style={{ width: `${(school.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-10 text-right shrink-0">{school.count}</span>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูลโรงเรียน</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* School Table (all schools with pagination + branch breakdown) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <School className="w-5 h-5" />
                    รายชื่อโรงเรียนทั้งหมด
                  </CardTitle>
                  <CardDescription>
                    {filteredSchools.length} โรงเรียน
                    {stats.noSchool > 0 && ` | ไม่ระบุโรงเรียน: ${stats.noSchool} คน`}
                  </CardDescription>
                </div>
                {isSuperAdmin() && (
                  <Button variant="outline" size="sm" onClick={handleOpenMerge}>
                    <Settings2 className="w-4 h-4 mr-1" />
                    จัดการ
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* School Search */}
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="ค้นหาโรงเรียน..."
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {filteredSchools.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  ไม่พบข้อมูล
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>
                          <button
                            className="flex items-center hover:text-foreground transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            โรงเรียน
                            <SortIcon columnKey="name" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right w-20">
                          <button
                            className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                            onClick={() => handleSort('count')}
                          >
                            จำนวน
                            <SortIcon columnKey="count" />
                          </button>
                        </TableHead>
                        {isAllBranches && branchNames.map((bName) => (
                          <TableHead key={bName} className="text-right w-20">
                            <button
                              className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                              onClick={() => handleSort(bName)}
                            >
                              <span className="text-xs">{bName}</span>
                              <SortIcon columnKey={bName} />
                            </button>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSchools.map((school, idx) => (
                        <TableRow key={school.displayName}>
                          <TableCell className="text-muted-foreground text-xs">
                            {(schoolPage - 1) * schoolPageSize + idx + 1}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{school.displayName}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {school.count}
                          </TableCell>
                          {isAllBranches && branchNames.map((bName) => (
                            <TableCell key={bName} className="text-right text-sm">
                              {school.byBranch[bName] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Pagination
                currentPage={schoolPage}
                totalPages={schoolTotalPages(filteredSchools.length)}
                pageSize={schoolPageSize}
                totalItems={filteredSchools.length}
                onPageChange={handleSchoolPageChange}
                onPageSizeChange={handleSchoolPageSizeChange}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5" />
              จัดการชื่อโรงเรียน
            </DialogTitle>
            <DialogDescription>
              เลือกชื่อโรงเรียนที่ต้องการรวม แล้วเลือกชื่อหลักที่จะใช้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Normalize Button */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm">
                <p className="font-medium">Normalize ข้อมูลทั้งหมด</p>
                <p className="text-muted-foreground text-xs">ตัดคำนำหน้า โรงเรียน/รร. อัตโนมัติ</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNormalize}
                disabled={normalizing}
              >
                {normalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Normalize'}
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อโรงเรียน..."
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* School List */}
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {filteredMergeSchools.map((school) => (
                <label
                  key={school.name}
                  className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-50 ${
                    selectedSchools.has(school.name) ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <Checkbox
                    checked={selectedSchools.has(school.name)}
                    onCheckedChange={() => toggleSchoolSelection(school.name)}
                  />
                  <span className="flex-1 text-sm">{school.name}</span>
                  <Badge variant="secondary" className="text-xs">{school.count}</Badge>
                </label>
              ))}
              {filteredMergeSchools.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {allSchools.length === 0
                    ? (normalizing ? 'กำลังโหลด...' : 'ไม่มีข้อมูลโรงเรียน')
                    : 'ไม่พบผลลัพธ์'}
                </p>
              )}
            </div>

            {/* Selected count */}
            {selectedSchools.size > 0 && (
              <p className="text-xs text-muted-foreground">
                เลือกแล้ว {selectedSchools.size} รายการ
              </p>
            )}

            {/* Merge Target Selection */}
            {selectedSchools.size >= 2 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-sm font-medium">เลือกชื่อหลักที่จะใช้:</p>
                <div className="space-y-1">
                  {Array.from(selectedSchools).map((name) => (
                    <label
                      key={name}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-blue-100 ${
                        mergeTarget === name ? 'bg-blue-100 font-medium' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="mergeTarget"
                        value={name}
                        checked={mergeTarget === name}
                        onChange={() => setMergeTarget(name)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              ปิด
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeTarget || selectedSchools.size < 2}
            >
              {merging ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Merge className="w-4 h-4 mr-1" />}
              รวมชื่อ ({selectedSchools.size} รายการ)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

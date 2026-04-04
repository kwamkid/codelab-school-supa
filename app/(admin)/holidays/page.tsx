'use client';

import { useEffect, useState } from 'react';
import { Holiday, Branch } from '@/types/models';
import { getHolidays, deleteHoliday, deleteAllHolidays } from '@/lib/services/holidays';
import { getActiveBranches } from '@/lib/services/branches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Edit, Trash2, AlertTriangle, RefreshCw, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { SectionLoading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { formatDate } from '@/lib/utils';
import HolidayDialog from '@/components/holidays/holiday-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranch } from '@/contexts/BranchContext';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { ActionButton } from '@/components/ui/action-button';
import type { ReschedulePreview } from '@/lib/services/reschedule';

export default function HolidaysPage() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFilterBranch, setSelectedFilterBranch] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [rescheduleAllDialogOpen, setRescheduleAllDialogOpen] = useState(false);
  const [rescheduleAllLoading, setRescheduleAllLoading] = useState(false);
  const [reschedulePreview, setReschedulePreview] = useState<ReschedulePreview | null>(null);
  const [reschedulePreviewLoading, setReschedulePreviewLoading] = useState(false);
  const [rescheduleStep, setRescheduleStep] = useState<'preview' | 'confirm'>('preview');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedBranchId]);

  const loadData = async () => {
    try {
      // Load holidays
      const holidaysData = await getHolidays(selectedYear);
      setHolidays(holidaysData);
      
      // Try to load branches (don't fail if error)
      try {
        const branchesData = await getActiveBranches();
        setBranches(branchesData);
      } catch (branchError) {
        console.error('Error loading branches:', branchError);
        setBranches([]); // Set empty branches
      }
    } catch (error) {
      console.error('Error loading holidays:', error);
      toast.error('ไม่สามารถโหลดข้อมูลวันหยุดได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = () => {
    setSelectedHoliday(null);
    setDialogOpen(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setDialogOpen(true);
  };

  const handleDeleteHoliday = (holiday: Holiday) => {
    setHolidayToDelete(holiday);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    
    try {
      await deleteHoliday(holidayToDelete.id);
      toast.success('ลบวันหยุดเรียบร้อยแล้ว');
      
      setDeleteDialogOpen(false);
      setHolidayToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('ไม่สามารถลบวันหยุดได้');
    }
  };

  const confirmDeleteAllHolidays = async () => {
    try {
      const count = await deleteAllHolidays(selectedYear);
      toast.success(`ลบวันหยุดทั้งหมด ${count} วันเรียบร้อยแล้ว`);
      setDeleteAllDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting all holidays:', error);
      toast.error('ไม่สามารถลบวันหยุดทั้งหมดได้');
    }
  };

  const handleOpenRescheduleDialog = async () => {
    setRescheduleAllDialogOpen(true);
    setRescheduleStep('preview');
    setReschedulePreview(null);
    setExpandedClasses(new Set());
    setReschedulePreviewLoading(true);
    try {
      const { previewRescheduleAllClasses } = await import('@/lib/services/reschedule');
      const preview = await previewRescheduleAllClasses();
      setReschedulePreview(preview);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast.error('ไม่สามารถโหลดข้อมูล preview ได้');
      setRescheduleAllDialogOpen(false);
    } finally {
      setReschedulePreviewLoading(false);
    }
  };

  const confirmRescheduleAllClasses = async () => {
    setRescheduleAllLoading(true);
    try {
      const { rescheduleAllClasses } = await import('@/lib/services/reschedule');
      const result = await rescheduleAllClasses();

      if (result.processedCount > 0) {
        toast.success(
          `จัดตารางเรียนใหม่เรียบร้อยแล้ว ประมวลผล ${result.processedCount} คลาส`,
          { duration: 5000 }
        );
      } else {
        toast.info('ไม่พบคลาสที่ต้องจัดตารางใหม่');
      }

      setRescheduleAllDialogOpen(false);
    } catch (error) {
      console.error('Error rescheduling all classes:', error);
      toast.error('ไม่สามารถจัดตารางเรียนใหม่ได้');
    } finally {
      setRescheduleAllLoading(false);
    }
  };

  const toggleExpandClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const handleHolidaySaved = () => {
    loadData();
    setDialogOpen(false);
  };

  // Filter holidays - ถ้าเลือกสาขาเฉพาะ จะแสดงเฉพาะวันหยุดที่เกี่ยวข้องกับสาขานั้น
  const getRelevantHolidays = () => {
    let relevantHolidays = holidays;
    
    // ถ้าเลือกสาขาเฉพาะจาก context แสดงเฉพาะวันหยุดที่เกี่ยวกับสาขานั้น
    if (!isAllBranches && selectedBranchId) {
      relevantHolidays = holidays.filter(holiday => {
        // วันหยุด national แสดงเสมอ
        if (holiday.type === 'national') return true;
        // วันหยุด branch ต้องมีสาขาที่เลือกอยู่ใน list
        return holiday.branches?.includes(selectedBranchId);
      });
    }
    
    // Apply additional filter จาก dropdown
    if (selectedFilterBranch === 'national') {
      return relevantHolidays.filter(h => h.type === 'national');
    } else if (selectedFilterBranch !== 'all') {
      return relevantHolidays.filter(h => 
        h.type === 'national' || h.branches?.includes(selectedFilterBranch)
      );
    }
    
    return relevantHolidays;
  };

  const filteredHolidays = getRelevantHolidays();

  // Group holidays by month
  const holidaysByMonth = filteredHolidays.reduce((acc, holiday) => {
    const month = new Date(holiday.date).getMonth();
    if (!acc[month]) acc[month] = [];
    acc[month].push(holiday);
    return acc;
  }, {} as Record<number, Holiday[]>);

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Get current and next year for year selector
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  if (loading) {
    return <SectionLoading text="กำลังโหลดข้อมูล..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
            จัดการวันหยุด
            {!isAllBranches && (
              <span className="text-red-600 text-lg ml-2">(เฉพาะสาขาที่เลือก)</span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">กำหนดวันหยุดประจำปีและวันหยุดพิเศษของแต่ละสาขา</p>
        </div>
        <div className="flex gap-2">
          <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
            <Button 
              variant="outline"
              onClick={handleOpenRescheduleDialog}
              className="border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              จัดตารางใหม่ทั้งหมด
            </Button>
          </PermissionGuard>
          <PermissionGuard action="create">
            <ActionButton 
              action="create"
              onClick={handleAddHoliday}
              className="bg-red-500 hover:bg-red-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มวันหยุด
            </ActionButton>
          </PermissionGuard>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select 
          value={selectedYear.toString()} 
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedFilterBranch} onValueChange={setSelectedFilterBranch}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="เลือกสาขา" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="national">วันหยุดทุกสาขา</SelectItem>
            {/* แสดงเฉพาะสาขาที่ user มีสิทธิ์ */}
            {isAllBranches ? (
              branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))
            ) : (
              selectedBranchId && branches
                .filter(b => b.id === selectedBranchId)
                .map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>

        {filteredHolidays.length > 0 && (
          <PermissionGuard action="delete">
            <Button 
              variant="destructive"
              onClick={() => setDeleteAllDialogOpen(true)}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ลบทั้งหมด
            </Button>
          </PermissionGuard>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">วันหยุดทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredHolidays.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">วันหยุดทุกสาขา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filteredHolidays.filter(h => h.type === 'national').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">วันหยุดประจำสาขา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredHolidays.filter(h => h.type === 'branch').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holidays by Month */}
      {Object.keys(holidaysByMonth).length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Calendar}
              title="ยังไม่มีวันหยุด"
              description="เริ่มต้นด้วยการเพิ่มวันหยุดแรก"
              action={
                <PermissionGuard action="create">
                  <ActionButton
                    action="create"
                    onClick={handleAddHoliday}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มวันหยุด
                  </ActionButton>
                </PermissionGuard>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(holidaysByMonth)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([month, monthHolidays]) => (
              <Card key={month}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {monthNames[parseInt(month)]} {selectedYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>ชื่อวันหยุด</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>สาขาที่หยุด</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthHolidays
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((holiday) => (
                          <TableRow key={holiday.id}>
                            <TableCell className="font-medium">
                              {formatDate(holiday.date, 'long')}
                            </TableCell>
                            <TableCell>{holiday.name}</TableCell>
                            <TableCell>
                              <Badge variant={
                                holiday.type === 'national' ? 'default' : 'secondary'
                              }>
                                {holiday.type === 'national' ? 'ทุกสาขา' : 'ประจำสาขา'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {holiday.type === 'national' ? (
                                <Badge variant="outline">ทุกสาขา</Badge>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {holiday.branches?.map(branchId => {
                                    const branch = branches.find(b => b.id === branchId);
                                    return branch ? (
                                      <Badge key={branchId} variant="outline" className="text-xs">
                                        {branch.name}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <PermissionGuard action="update">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditHoliday(holiday)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </PermissionGuard>
                                <PermissionGuard action="delete">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteHoliday(holiday)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </PermissionGuard>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Holiday Dialog */}
      <HolidayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        holiday={selectedHoliday}
        branches={branches}
        onSaved={handleHolidaySaved}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl">
                ยืนยันการลบวันหยุด
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="mt-4">
                <p>
                  คุณแน่ใจหรือไม่ที่จะลบวันหยุด <strong>&quot;{holidayToDelete?.name}&quot;</strong>?
                  <br />
                  วันที่ {holidayToDelete && formatDate(holidayToDelete.date, 'long')}
                </p>
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>หมายเหตุ:</strong> หลังจากลบวันหยุดแล้ว คุณสามารถใช้ปุ่ม &quot;จัดตารางใหม่ทั้งหมด&quot; 
                    เพื่อปรับตารางเรียนให้ถูกต้อง
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteHoliday}
              className="bg-red-500 hover:bg-red-600"
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Holidays Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl">
                ยืนยันการลบวันหยุดทั้งหมด
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="mt-4">
              <div className="space-y-2">
                <p>คุณแน่ใจหรือไม่ที่จะลบวันหยุดทั้งหมดในปี {selectedYear}?</p>
                <p className="font-medium text-red-600">
                  จะลบวันหยุด {filteredHolidays.length} วัน
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                  <p className="text-sm text-amber-800">
                    <strong>คำเตือน:</strong> หลังจากลบแล้ว ให้ใช้ปุ่ม &quot;จัดตารางใหม่ทั้งหมด&quot; เพื่อปรับตารางเรียน
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteAllHolidays}
              className="bg-red-500 hover:bg-red-600"
            >
              ยืนยันลบทั้งหมด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule All Classes Dialog */}
      <AlertDialog open={rescheduleAllDialogOpen} onOpenChange={(open) => {
        if (!rescheduleAllLoading) {
          setRescheduleAllDialogOpen(open);
        }
      }}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-full">
                <RefreshCw className="h-6 w-6 text-blue-600" />
              </div>
              <AlertDialogTitle className="text-xl">
                จัดตารางเรียนใหม่ทั้งหมด
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          <div className="flex-1 overflow-y-auto">
            {reschedulePreviewLoading ? (
              <AlertDialogDescription asChild>
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">กำลังตรวจสอบคลาสทั้งหมด...</span>
                </div>
              </AlertDialogDescription>
            ) : reschedulePreview && rescheduleStep === 'preview' ? (
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {reschedulePreview.affectedClasses > 0 ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                        <p className="text-amber-800">
                          พบ <strong className="text-xl">{reschedulePreview.affectedClasses}</strong> คลาส
                          ที่ต้องจัดตารางใหม่
                          (จากทั้งหมด {reschedulePreview.totalClasses} คลาส)
                        </p>
                      </div>

                      <div className="border rounded-lg divide-y max-h-[40vh] overflow-y-auto">
                        {reschedulePreview.classDetails
                          .filter(c => !c.noChange)
                          .map((cls) => {
                            const isExpanded = expandedClasses.has(cls.classId);
                            const changeCount = cls.datesToRemove.length + cls.datesToAdd.length;
                            return (
                              <div key={cls.classId} className="px-4 py-3">
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => toggleExpandClass(cls.classId)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                    <span className="font-medium text-gray-900 truncate">{cls.className}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm text-gray-500">เปลี่ยน {changeCount} วัน</span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    )}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="mt-2 pl-6 space-y-2 text-sm">
                                    {cls.datesToRemove.length > 0 && (
                                      <div className="bg-red-50 rounded p-2">
                                        <p className="text-red-700 font-medium text-xs mb-1">เอาออก:</p>
                                        <p className="text-red-600 text-xs">{cls.datesToRemove.join(', ')}</p>
                                      </div>
                                    )}
                                    {cls.datesToAdd.length > 0 && (
                                      <div className="bg-green-50 rounded p-2">
                                        <p className="text-green-700 font-medium text-xs mb-1">เพิ่มเข้ามา:</p>
                                        <p className="text-green-600 text-xs">{cls.datesToAdd.join(', ')}</p>
                                      </div>
                                    )}
                                    <p className="text-gray-500 text-xs">วันสิ้นสุดใหม่: {cls.newEndDate}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          ระบบจะจัดตารางใหม่ให้ตรงกับวันหยุดปัจจุบัน พร้อมเรียงลำดับครั้งเรียนใหม่
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-green-800 font-medium">ตารางเรียนตรงกับวันหยุดแล้ว</p>
                      <p className="text-sm text-green-600 mt-1">ทั้ง {reschedulePreview.totalClasses} คลาสไม่ต้องเปลี่ยนแปลง</p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            ) : rescheduleStep === 'confirm' ? (
              <AlertDialogDescription asChild>
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">กำลังจัดตารางใหม่... กรุณาอย่าปิดหน้าจอ</span>
                </div>
              </AlertDialogDescription>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={rescheduleAllLoading || reschedulePreviewLoading}>
              ยกเลิก
            </AlertDialogCancel>
            {reschedulePreview && rescheduleStep === 'preview' && reschedulePreview.affectedClasses > 0 && (
              <Button
                onClick={() => {
                  setRescheduleStep('confirm');
                  confirmRescheduleAllClasses();
                }}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                ยืนยันจัดตารางใหม่ ({reschedulePreview.affectedClasses} คลาส)
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
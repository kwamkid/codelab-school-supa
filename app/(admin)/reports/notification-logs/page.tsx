'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { FormSelect } from '@/components/ui/form-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';


interface NotificationLog {
  id: string;
  type: string;
  recipient_type: string;
  recipient_name: string | null;
  line_user_id: string | null;
  student_name: string | null;
  class_name: string | null;
  message_preview: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  byType: Record<string, { success: number; failed: number }>;
}

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Default: last 7 days
  const getDefault7Days = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    return { from: sevenDaysAgo.toISOString().split('T')[0], to: today };
  };

  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(getDefault7Days);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [total, setTotal] = useState(0);
  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    totalPages,
  } = usePagination(50);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (dateRange?.from) params.append('startDate', dateRange.from);
      if (dateRange?.to) params.append('endDate', dateRange.to);
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/reports/notification-logs?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentPage, pageSize, dateRange, filterType, filterStatus]);

  const handleFilterChange = (key: 'type' | 'status', value: string) => {
    const apiValue = value === 'all' ? '' : value;
    if (key === 'type') setFilterType(apiValue);
    else setFilterStatus(apiValue);
    resetPagination();
  };

  const handleDateRangeChange = (range: { from: string; to: string } | undefined) => {
    setDateRange(range);
    resetPagination();
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'class-reminder': 'แจ้งเตือนคลาส',
      'makeup-reminder': 'แจ้งเตือน Makeup',
      'makeup-scheduled': 'ยืนยัน Makeup',
      'trial-confirmation': 'ยืนยันทดลองเรียน',
      'feedback': 'ผลการเรียน',
      'schedule-change': 'เปลี่ยนตารางเรียน',
      'payment-reminder': 'แจ้งชำระเงิน'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'class-reminder': 'bg-blue-100 text-blue-800',
      'makeup-reminder': 'bg-purple-100 text-purple-800',
      'makeup-scheduled': 'bg-green-100 text-green-800',
      'trial-confirmation': 'bg-yellow-100 text-yellow-800',
      'feedback': 'bg-pink-100 text-pink-800',
      'schedule-change': 'bg-orange-100 text-orange-800',
      'payment-reminder': 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
          <Bell className="w-8 h-8" />
          Notification Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          ประวัติการส่งการแจ้งเตือนทั้งหมด
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-600">สำเร็จ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.success.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? `${((stats.success / stats.total) * 100).toFixed(1)}%` : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-600">ล้มเหลว</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? `${((stats.failed / stats.total) * 100).toFixed(1)}%` : '0%'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="w-4 h-4" />
              ตัวกรอง
            </div>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder="เลือกช่วงวันที่"
              className="w-full sm:w-auto sm:min-w-[300px]"
            />
            <FormSelect
              value={filterType || 'all'}
              onValueChange={(v) => handleFilterChange('type', v)}
              className="w-full sm:w-[180px]"
              placeholder="ประเภท: ทั้งหมด"
              options={[
                { value: 'all', label: 'ประเภท: ทั้งหมด' },
                { value: 'class-reminder', label: 'แจ้งเตือนคลาส' },
                { value: 'makeup-reminder', label: 'แจ้งเตือน Makeup' },
                { value: 'makeup-scheduled', label: 'ยืนยัน Makeup' },
                { value: 'trial-confirmation', label: 'ยืนยันทดลองเรียน' },
              ]}
            />
            <FormSelect
              value={filterStatus || 'all'}
              onValueChange={(v) => handleFilterChange('status', v)}
              className="w-full sm:w-[160px]"
              placeholder="สถานะ: ทั้งหมด"
              options={[
                { value: 'all', label: 'สถานะ: ทั้งหมด' },
                { value: 'success', label: 'สำเร็จ' },
                { value: 'failed', label: 'ล้มเหลว' },
              ]}
            />
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการแจ้งเตือน</CardTitle>
          <CardDescription>
            แสดง {logs.length} รายการจากทั้งหมด {total.toLocaleString()} รายการ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              ไม่พบข้อมูล
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>นักเรียน</TableHead>
                    <TableHead>คลาส</TableHead>
                    <TableHead>ผู้รับ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ข้อความ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(log.type)} variant="secondary">
                          {getTypeLabel(log.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.student_name || '-'}</TableCell>
                      <TableCell>{log.class_name || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{log.recipient_name || '-'}</div>
                          {log.line_user_id && (
                            <div className="text-xs text-muted-foreground">
                              {log.line_user_id.substring(0, 10)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            สำเร็จ
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            ล้มเหลว
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <Eye className="w-4 h-4 mr-1" />
                              ดูข้อความ
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Badge className={getTypeColor(log.type)} variant="secondary">
                                  {getTypeLabel(log.type)}
                                </Badge>
                                {log.status === 'success' ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    สำเร็จ
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    ล้มเหลว
                                  </Badge>
                                )}
                              </DialogTitle>
                              <DialogDescription>
                                {new Date(log.sent_at).toLocaleString('th-TH')}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                              {log.error_message && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <p className="text-sm font-medium text-red-800">Error:</p>
                                  <p className="text-sm text-red-700">{log.error_message}</p>
                                </div>
                              )}
                              <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-700 mb-2">ข้อความที่ส่ง:</p>
                                <pre className="text-sm whitespace-pre-wrap font-sans text-gray-900">
                                  {log.message_preview || '-'}
                                </pre>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>ผู้รับ: {log.recipient_name || '-'}</p>
                                <p>LINE ID: {log.line_user_id || '-'}</p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages(total)}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

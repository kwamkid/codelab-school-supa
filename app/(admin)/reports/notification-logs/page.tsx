'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

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
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('page', page.toString());
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
  }, [page, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters({
      type: '',
      status: '',
      startDate: '',
      endDate: ''
    });
    setPage(1);
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

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="w-8 h-8" />
          Notification Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          ประวัติการส่งการแจ้งเตือนทั้งหมด
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select value={filters.type} onValueChange={(v) => handleFilterChange('type', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ทั้งหมด</SelectItem>
                  <SelectItem value="class-reminder">แจ้งเตือนคลาส</SelectItem>
                  <SelectItem value="makeup-reminder">แจ้งเตือน Makeup</SelectItem>
                  <SelectItem value="makeup-scheduled">ยืนยัน Makeup</SelectItem>
                  <SelectItem value="trial-confirmation">ยืนยันทดลองเรียน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>สถานะ</Label>
              <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ทั้งหมด</SelectItem>
                  <SelectItem value="success">สำเร็จ</SelectItem>
                  <SelectItem value="failed">ล้มเหลว</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>วันที่เริ่มต้น</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>วันที่สิ้นสุด</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={handleReset}>
              รีเซ็ตตัวกรอง
            </Button>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              รีเฟรช
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
                        <div className="max-w-xs truncate text-sm">
                          {log.error_message || log.message_preview || '-'}
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
  );
}

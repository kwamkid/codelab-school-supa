'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Database, Download, Loader2, RefreshCw, CheckCircle, XCircle, HardDrive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import RestoreDialog from './restore-dialog';

interface BackupLog {
  id: string;
  backup_date: string;
  file_name: string;
  status: 'success' | 'failed' | 'restored';
  tables_count: number;
  total_rows: number;
  file_size_bytes: number;
  duration_ms: number;
  error_message?: string;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BackupLogsTab() {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/backup-logs');
      const data = await response.json();
      console.log('[BackupLogs] API response:', response.status, data);
      if (!response.ok) throw new Error(data.error || 'Failed to load logs');
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        console.error('[BackupLogs] Expected array, got:', data);
        setLogs([]);
      }
    } catch (error) {
      console.error('Error loading backup logs:', error);
      toast.error('ไม่สามารถโหลดประวัติ Backup ได้');
    } finally {
      setLoading(false);
    }
  };

  const triggerBackup = async () => {
    try {
      setBackingUp(true);
      toast.info('กำลัง Backup ข้อมูล...');

      const response = await fetch('/api/admin/trigger-backup', { method: 'POST' })
      const data = await response.json();

      if (data.success) {
        toast.success(`Backup สำเร็จ! ${data.tables_count} ตาราง, ${data.total_rows} rows`);
        await loadLogs();
      } else {
        toast.error(`Backup ล้มเหลว: ${data.error}`);
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('เกิดข้อผิดพลาดในการ Backup');
    } finally {
      setBackingUp(false);
    }
  };

  const openRestoreDialog = (fileName: string) => {
    setRestoreFileName(fileName);
    setRestoreDialogOpen(true);
  };

  const lastSuccess = logs.find(l => l.status === 'success');

  return (
    <div className="space-y-6">
      {/* สรุป */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Backup ล่าสุด</p>
                <p className="font-semibold">
                  {lastSuccess ? formatDate(lastSuccess.created_at) : 'ยังไม่เคย Backup'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">ขนาดล่าสุด</p>
                <p className="font-semibold">
                  {lastSuccess ? formatBytes(lastSuccess.file_size_bytes) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-gray-500">จำนวน Backup ทั้งหมด</p>
                <p className="font-semibold">{logs.filter(l => l.status === 'success').length} ครั้ง</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ปุ่ม Backup + Refresh */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Backup
          </CardTitle>
          <CardDescription>
            Backup ข้อมูลทั้งหมดเก็บไว้ใน Supabase Storage (เก็บ 4 สัปดาห์ล่าสุด วนทับอัตโนมัติ)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={triggerBackup} disabled={backingUp}>
              {backingUp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลัง Backup...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Backup เดี๋ยวนี้
                </>
              )}
            </Button>
            <Button variant="outline" onClick={loadLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ตาราง Logs */}
      <Card>
        <CardHeader>
          <CardTitle>ประวัติ Backup</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              ยังไม่มีประวัติ Backup
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ไฟล์</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">ตาราง</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">ขนาด</TableHead>
                  <TableHead className="text-right">ใช้เวลา</TableHead>
                  <TableHead className="text-center">Restore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {log.file_name}
                      </code>
                    </TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          สำเร็จ
                        </Badge>
                      ) : log.status === 'restored' ? (
                        <Badge className="bg-purple-100 text-purple-700">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restored
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          ล้มเหลว
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{log.tables_count}</TableCell>
                    <TableCell className="text-right">{log.total_rows?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatBytes(log.file_size_bytes)}</TableCell>
                    <TableCell className="text-right">{formatDuration(log.duration_ms)}</TableCell>
                    <TableCell className="text-center">
                      {log.status === 'success' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRestoreDialog(log.file_name)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        fileName={restoreFileName}
        onRestoreComplete={loadLogs}
      />
    </div>
  );
}

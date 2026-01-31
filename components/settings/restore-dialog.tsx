'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  onRestoreComplete?: () => void;
}

interface PreviewData {
  metadata: {
    created_at: string;
    week_number: number;
    tables_count: number;
    total_rows: number;
  };
  tables: Record<string, number>;
}

interface RestoreEvent {
  phase: string;
  status: string;
  table?: string;
  message?: string;
  progress?: number;
  total?: number;
  inserted?: number;
  deletedCount?: number;
  errors?: string[];
  error?: string;
  metadata?: PreviewData['metadata'];
  tablesRestored?: number;
  totalRowsRestored?: number;
  durationMs?: number;
}

const TABLE_DISPLAY_NAMES: Record<string, string> = {
  branches: 'สาขา',
  rooms: 'ห้องเรียน',
  parents: 'ผู้ปกครอง',
  students: 'นักเรียน',
  teachers: 'ครู',
  admin_users: 'ผู้ดูแลระบบ',
  subjects: 'วิชา',
  classes: 'คลาสเรียน',
  class_schedules: 'ตารางเรียน',
  teaching_materials: 'สื่อการสอน',
  attendance: 'การเช็คชื่อ',
  enrollments: 'การลงทะเบียน',
  enrollment_transfer_history: 'ประวัติย้ายคลาส',
  trial_bookings: 'จองทดลองเรียน',
  trial_booking_students: 'นักเรียนทดลองเรียน',
  trial_sessions: 'คลาสทดลอง',
  trial_reschedule_history: 'ประวัติเลื่อนทดลอง',
  makeup_classes: 'คลาสชดเชย',
  events: 'อีเวนท์',
  event_schedules: 'ตารางอีเวนท์',
  event_registrations: 'ลงทะเบียนอีเวนท์',
  event_registration_parents: 'ผู้ปกครองอีเวนท์',
  event_registration_students: 'นักเรียนอีเวนท์',
  notifications: 'การแจ้งเตือน',
  student_feedback: 'ผลตอบรับ',
  promotions: 'โปรโมชั่น',
  holidays: 'วันหยุด',
  settings: 'การตั้งค่า',
};

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

export default function RestoreDialog({
  open,
  onOpenChange,
  fileName,
  onRestoreComplete,
}: RestoreDialogProps) {
  const [step, setStep] = useState<'preview' | 'confirm' | 'progress' | 'complete'>('preview');
  const [confirmText, setConfirmText] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentTable, setCurrentTable] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<{
    status: 'success' | 'partial' | 'error';
    tablesRestored?: number;
    totalRowsRestored?: number;
    durationMs?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  // Load preview when dialog opens
  useEffect(() => {
    if (open && fileName) {
      loadPreview();
    } else {
      // Reset state
      setStep('preview');
      setConfirmText('');
      setPreview(null);
      setResult(null);
      setCurrentPhase('');
      setCurrentTable('');
      setProgressValue(0);
      setProgressTotal(0);
      setProgressMessage('');
    }
  }, [open, fileName]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/restore/preview?fileName=${encodeURIComponent(fileName)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load preview');
      setPreview(data);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast.error('ไม่สามารถโหลดข้อมูล Backup ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setStep('progress');
    setCurrentPhase('download');
    setProgressMessage('เริ่มต้น Restore...');

    try {
      const response = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: RestoreEvent = JSON.parse(line);
            handleStreamEvent(event);
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event: RestoreEvent = JSON.parse(buffer);
          handleStreamEvent(event);
        } catch {
          // Skip
        }
      }
    } catch (error) {
      console.error('Restore error:', error);
      setResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection error',
      });
      setStep('complete');
    }
  };

  const handleStreamEvent = (event: RestoreEvent) => {
    const { phase, status } = event;

    setCurrentPhase(phase);

    if (event.message) {
      setProgressMessage(event.message);
    }
    if (event.table) {
      setCurrentTable(event.table);
    }

    if (phase === 'delete' || phase === 'insert') {
      if (event.progress !== undefined && event.total !== undefined) {
        setProgressValue(event.progress);
        setProgressTotal(event.total);
      }
    }

    if (phase === 'complete') {
      setResult({
        status: status as 'success' | 'partial',
        tablesRestored: event.tablesRestored,
        totalRowsRestored: event.totalRowsRestored,
        durationMs: event.durationMs,
        errors: event.errors,
      });
      setStep('complete');

      if (status === 'success') {
        setTimeout(() => {
          onRestoreComplete?.();
          window.location.reload();
        }, 3000);
      }
    }

    if (phase === 'error') {
      setResult({
        status: 'error',
        error: event.error,
        durationMs: event.durationMs,
      });
      setStep('complete');
    }
  };

  const getTotalRows = () => {
    if (!preview?.tables) return 0;
    return Object.values(preview.tables).reduce((sum, count) => sum + count, 0);
  };

  const getPhaseLabel = () => {
    switch (currentPhase) {
      case 'download': return 'ดาวน์โหลด Backup';
      case 'safety_backup': return 'สร้าง Safety Backup';
      case 'delete': return 'ลบข้อมูลเก่า';
      case 'insert': return 'กำลัง Restore';
      default: return 'กำลังดำเนินการ';
    }
  };

  const canClose = step !== 'progress';

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent className="max-w-lg" onPointerDownOutside={canClose ? undefined : (e) => e.preventDefault()}>
        {/* Step 1: Preview */}
        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <RotateCcw className="h-5 w-5" />
                Restore ข้อมูลจาก Backup
              </DialogTitle>
              <DialogDescription>
                ตรวจสอบข้อมูลก่อนทำการ Restore
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>คำเตือน:</strong> การ Restore จะ<strong>แทนที่</strong>ข้อมูลทั้งหมดในระบบด้วยข้อมูลจากไฟล์ backup
                  ข้อมูลปัจจุบันจะถูกลบ!
                </AlertDescription>
              </Alert>

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : preview ? (
                <>
                  {/* Metadata */}
                  <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                    <h4 className="font-medium text-sm text-blue-800">ข้อมูล Backup</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-blue-600">ไฟล์:</span>
                        <span className="font-mono font-medium">{fileName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">สร้างเมื่อ:</span>
                        <span className="font-medium">{formatDate(preview.metadata.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">จำนวนตาราง:</span>
                        <span className="font-medium">{preview.metadata.tables_count} ตาราง</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">จำนวน rows ทั้งหมด:</span>
                        <span className="font-medium">{getTotalRows().toLocaleString()} rows</span>
                      </div>
                    </div>
                  </div>

                  {/* Per-table summary */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">ข้อมูลที่จะ Restore:</h4>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(preview.tables)
                        .filter(([, count]) => count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([table, count]) => (
                          <div key={table} className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {TABLE_DISPLAY_NAMES[table] || table}:
                            </span>
                            <span className="font-medium">{count.toLocaleString()} รายการ</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      ระบบจะสร้าง <strong>Safety Backup</strong> ของข้อมูลปัจจุบันอัตโนมัติก่อนเริ่ม Restore
                      (เก็บเป็น backup_pre_restore.json)
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  ไม่พบข้อมูล Backup
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep('confirm')}
                disabled={loading || !preview}
              >
                ดำเนินการต่อ
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-orange-600">ยืนยันการ Restore</DialogTitle>
              <DialogDescription>
                พิมพ์ <strong>&quot;RESTORE DATA&quot;</strong> เพื่อยืนยันการ Restore ข้อมูล
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยข้อมูลจาก <strong>{fileName}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirmText">ข้อความยืนยัน</Label>
                <Input
                  id="confirmText"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTORE DATA"
                  className="font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('preview');
                  setConfirmText('');
                }}
              >
                ย้อนกลับ
              </Button>
              <Button
                variant="destructive"
                onClick={handleRestore}
                disabled={confirmText !== 'RESTORE DATA'}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore ข้อมูล
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Progress */}
        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                กำลัง Restore...
              </DialogTitle>
              <DialogDescription>
                กรุณารอสักครู่ อย่าปิดหน้าต่างนี้
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{getPhaseLabel()}</span>
                  {progressTotal > 0 && (
                    <span>{progressValue} / {progressTotal}</span>
                  )}
                </div>
                <Progress
                  value={progressTotal > 0 ? (progressValue / progressTotal) * 100 : 0}
                  className="h-2"
                />
                {currentTable && (
                  <p className="text-xs text-gray-500">
                    {TABLE_DISPLAY_NAMES[currentTable] || currentTable}
                  </p>
                )}
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                {progressMessage}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  ห้ามปิดหน้าต่างนี้ระหว่างกำลัง Restore
                </AlertDescription>
              </Alert>
            </div>
          </>
        )}

        {/* Step 4: Complete / Error */}
        {step === 'complete' && result && (
          <>
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${
                result.status === 'error' ? 'text-red-600' : 'text-green-600'
              }`}>
                {result.status === 'error' ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                {result.status === 'error'
                  ? 'Restore ล้มเหลว'
                  : result.status === 'partial'
                    ? 'Restore เสร็จสิ้น (มี Error บางส่วน)'
                    : 'Restore สำเร็จ'
                }
              </DialogTitle>
              <DialogDescription>
                {result.status === 'success'
                  ? 'ระบบจะโหลดใหม่ในอีกสักครู่...'
                  : result.status === 'partial'
                    ? 'ข้อมูลส่วนใหญ่ถูก Restore แล้ว'
                    : 'เกิดข้อผิดพลาดระหว่าง Restore'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {result.status !== 'error' && (
                <div className="flex justify-center py-4">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
              )}

              {result.tablesRestored !== undefined && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ตารางที่ Restore:</span>
                    <span className="font-medium">{result.tablesRestored} ตาราง</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวน rows:</span>
                    <span className="font-medium">{result.totalRowsRestored?.toLocaleString()}</span>
                  </div>
                  {result.durationMs && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">ใช้เวลา:</span>
                      <span className="font-medium">{(result.durationMs / 1000).toFixed(1)} วินาที</span>
                    </div>
                  )}
                </div>
              )}

              {result.error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-red-600">Errors:</h4>
                  <div className="bg-red-50 rounded p-2 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {result.status !== 'success' && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  ปิด
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

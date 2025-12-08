// components/settings/factory-reset-dialog.tsx

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
  Trash2, 
  CheckCircle,
  XCircle,
  Loader2,
  Info
} from 'lucide-react';
import { 
  factoryReset, 
  getDataStatistics,
  ResetProgress 
} from '@/lib/services/factory-reset';
import { toast } from 'sonner';

interface FactoryResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FactoryResetDialog({
  open,
  onOpenChange
}: FactoryResetDialogProps) {
  const [step, setStep] = useState<'confirm' | 'verify' | 'progress' | 'complete'>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [statistics, setStatistics] = useState<Record<string, number>>({});
  const [resetProgress, setResetProgress] = useState<ResetProgress | null>(null);
  const [loading, setLoading] = useState(false);
  
  // โหลดสถิติข้อมูล
  useEffect(() => {
    if (open) {
      loadStatistics();
    } else {
      // Reset state เมื่อปิด dialog
      setStep('confirm');
      setConfirmText('');
      setResetProgress(null);
    }
  }, [open]);
  
  const loadStatistics = async () => {
    setLoading(true);
    try {
      const stats = await getDataStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสถิติได้');
    } finally {
      setLoading(false);
    }
  };
  
  const handleReset = async () => {
    setStep('progress');
    
    try {
      await factoryReset((progress) => {
        setResetProgress(progress);
      });
      
      setStep('complete');
      
      // Reload หน้าหลังจาก 3 วินาที
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Factory reset error:', error);
      toast.error('เกิดข้อผิดพลาดในการล้างข้อมูล');
      onOpenChange(false);
    }
  };
  
  const getTotalDocuments = () => {
    return Object.values(statistics).reduce((sum, count) => sum + count, 0);
  };
  
  const getCollectionDisplayName = (name: string): string => {
    const displayNames: Record<string, string> = {
      branches: 'สาขา',
      parents: 'ผู้ปกครอง',
      students: 'นักเรียน',
      subjects: 'วิชา',
      teachers: 'ครู',
      classes: 'คลาสเรียน',
      enrollments: 'การลงทะเบียน',
      promotions: 'โปรโมชั่น',
      holidays: 'วันหยุด',
      makeupClasses: 'คลาสชดเชย',
      trialBookings: 'การจองทดลองเรียน',
      notifications: 'การแจ้งเตือน'
    };
    return displayNames[name] || name;
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Step 1: Confirm */}
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                ล้างข้อมูลทั้งหมด
              </DialogTitle>
              <DialogDescription>
                การดำเนินการนี้จะลบข้อมูลทั้งหมดในระบบ ยกเว้นการตั้งค่า
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>คำเตือน:</strong> การดำเนินการนี้ไม่สามารถย้อนกลับได้!
                  ข้อมูลทั้งหมดจะถูกลบอย่างถาวร
                </AlertDescription>
              </Alert>
              
              {/* แสดงสถิติข้อมูลที่จะถูกลบ */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">ข้อมูลที่จะถูกลบ:</h4>
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {Object.entries(statistics)
                      .filter(([_, count]) => count > 0)
                      .map(([collection, count]) => (
                        <div key={collection} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {getCollectionDisplayName(collection)}:
                          </span>
                          <span className="font-medium">{count} รายการ</span>
                        </div>
                      ))}
                    {getTotalDocuments() === 0 && (
                      <p className="text-sm text-gray-500 text-center">ไม่มีข้อมูลในระบบ</p>
                    )}
                  </div>
                )}
                {getTotalDocuments() > 0 && (
                  <div className="flex justify-between font-medium text-sm pt-2 border-t">
                    <span>รวมทั้งหมด:</span>
                    <span className="text-red-600">{getTotalDocuments()} รายการ</span>
                  </div>
                )}
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>ข้อมูลที่จะไม่ถูกลบ:</strong>
                  <ul className="list-disc list-inside mt-1 text-sm">
                    <li>การตั้งค่าทั่วไป (ชื่อโรงเรียน, ที่อยู่, เบอร์โทร)</li>
                    <li>การตั้งค่า LINE Integration</li>
                    <li>บัญชีผู้ใช้ Admin</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep('verify')}
                disabled={loading || getTotalDocuments() === 0}
              >
                ดำเนินการต่อ
              </Button>
            </DialogFooter>
          </>
        )}
        
        {/* Step 2: Verify */}
        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-red-600">ยืนยันการล้างข้อมูล</DialogTitle>
              <DialogDescription>
                พิมพ์ <strong>"DELETE ALL DATA"</strong> เพื่อยืนยันการล้างข้อมูลทั้งหมด
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirmText">ข้อความยืนยัน</Label>
                <Input
                  id="confirmText"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  className="font-mono"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('confirm');
                  setConfirmText('');
                }}
              >
                ย้อนกลับ
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={confirmText !== 'DELETE ALL DATA'}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                ล้างข้อมูลทั้งหมด
              </Button>
            </DialogFooter>
          </>
        )}
        
        {/* Step 3: Progress */}
        {step === 'progress' && resetProgress && (
          <>
            <DialogHeader>
              <DialogTitle>กำลังล้างข้อมูล...</DialogTitle>
              <DialogDescription>
                กรุณารอสักครู่ อย่าปิดหน้าต่างนี้
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>กำลังล้าง: {getCollectionDisplayName(resetProgress.currentCollection)}</span>
                  <span>{resetProgress.current} / {resetProgress.total}</span>
                </div>
                <Progress 
                  value={(resetProgress.current / resetProgress.total) * 100} 
                  className="h-2"
                />
              </div>
              
              {resetProgress.status === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    เกิดข้อผิดพลาด: {resetProgress.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}
        
        {/* Step 4: Complete */}
        {step === 'complete' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                ล้างข้อมูลเสร็จสิ้น
              </DialogTitle>
              <DialogDescription>
                ข้อมูลทั้งหมดถูกลบเรียบร้อยแล้ว ระบบจะโหลดใหม่ในอีกสักครู่...
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex justify-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Bell,
  RefreshCw,
  AlertCircle,
  Calendar,
  Info
} from 'lucide-react';

interface CronResult {
  success: boolean;
  message: string;
  sentCount?: number;
  details?: any;
  timestamp: string;
}

export default function TestCronPage() {
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [remindersResult, setRemindersResult] = useState<CronResult | null>(null);
  const [statusResult, setStatusResult] = useState<CronResult | null>(null);

  const handleTestReminders = async () => {
    setLoadingReminders(true);
    setRemindersResult(null);

    try {
      const response = await fetch('/api/cron/reminders', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'your-secret-key'}`
        }
      });

      const data = await response.json();

      setRemindersResult({
        success: response.ok,
        message: data.message || (response.ok ? 'สำเร็จ' : 'ล้มเหลว'),
        sentCount: data.sentCount,
        details: data.details,
        timestamp: new Date().toLocaleString('th-TH')
      });

    } catch (error) {
      console.error('Test reminders error:', error);
      setRemindersResult({
        success: false,
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
        timestamp: new Date().toLocaleString('th-TH')
      });
    } finally {
      setLoadingReminders(false);
    }
  };

  const handleTestUpdateStatus = async () => {
    setLoadingStatus(true);
    setStatusResult(null);

    try {
      const response = await fetch('/api/cron/update-class-status', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'your-secret-key'}`
        }
      });

      const data = await response.json();

      setStatusResult({
        success: response.ok,
        message: data.message || (response.ok ? 'สำเร็จ' : 'ล้มเหลว'),
        details: data.details,
        timestamp: new Date().toLocaleString('th-TH')
      });

    } catch (error) {
      console.error('Test update status error:', error);
      setStatusResult({
        success: false,
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
        timestamp: new Date().toLocaleString('th-TH')
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="w-8 h-8" />
          ทดสอบ Cron Jobs
        </h1>
        <p className="text-muted-foreground mt-2">
          ทดสอบการทำงานของงานอัตโนมัติในระบบ
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>หมายเหตุ:</strong> การทดสอบจะทำงานจริง ไม่ใช่โหมดทดสอบ 
          กรุณาใช้ความระมัดระวังเมื่อทดสอบในระบบ Production
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cron 1: Send Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              ส่งการแจ้งเตือน
            </CardTitle>
            <CardDescription>
              ทดสอบการส่งการแจ้งเตือนคลาสเรียน, Makeup Class และ Events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">งานนี้จะทำอะไร:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>ส่งแจ้งเตือนคลาสเรียนที่จะมีพรุ่งนี้</li>
                <li>ส่งแจ้งเตือน Makeup Class ที่นัดไว้พรุ่งนี้</li>
                <li>ส่งแจ้งเตือน Events ล่วงหน้า</li>
              </ul>
              <div className="pt-2">
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  รันทุกวันเวลา 09:00
                </Badge>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleTestReminders}
              disabled={loadingReminders}
            >
              {loadingReminders ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังทดสอบ...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  ทดสอบส่งการแจ้งเตือน
                </>
              )}
            </Button>

            {/* Result */}
            {remindersResult && (
              <Alert variant={remindersResult.success ? 'default' : 'destructive'}>
                {remindersResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">{remindersResult.message}</p>
                    {remindersResult.sentCount !== undefined && (
                      <p className="text-sm">ส่งทั้งหมด: {remindersResult.sentCount} รายการ</p>
                    )}
                    {remindersResult.details && (
                      <div className="text-sm space-y-1 mt-2">
                        <p>• Class Reminders: {remindersResult.details.classReminders || 0}</p>
                        <p>• Makeup Reminders: {remindersResult.details.makeupReminders || 0}</p>
                        <p>• Event Reminders: {remindersResult.details.eventReminders || 0}</p>
                        {remindersResult.details.errors?.length > 0 && (
                          <p className="text-destructive">• Errors: {remindersResult.details.errors.length}</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{remindersResult.timestamp}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Cron 2: Update Class Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              อัพเดทสถานะคลาส
            </CardTitle>
            <CardDescription>
              ทดสอบการอัพเดทสถานะคลาสเรียนอัตโนมัติ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">งานนี้จะทำอะไร:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>เปลี่ยนสถานะคลาสเป็น "started" เมื่อถึงวันเปิดเรียน</li>
                <li>เปลี่ยนสถานะคลาสเป็น "completed" เมื่อเรียนจบ</li>
                <li>ตรวจสอบและอัพเดทคลาสทั้งหมดในระบบ</li>
              </ul>
              <div className="pt-2">
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  รันทุกวันเวลา 00:00
                </Badge>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleTestUpdateStatus}
              disabled={loadingStatus}
            >
              {loadingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังทดสอบ...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  ทดสอบอัพเดทสถานะ
                </>
              )}
            </Button>

            {/* Result */}
            {statusResult && (
              <Alert variant={statusResult.success ? 'default' : 'destructive'}>
                {statusResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">{statusResult.message}</p>
                    {statusResult.details && (
                      <div className="text-sm space-y-1 mt-2">
                        <p>• ตรวจสอบ: {statusResult.details.classesChecked || 0} คลาส</p>
                        <p>• เริ่มเรียน: {statusResult.details.classesStarted || 0} คลาส</p>
                        <p>• จบแล้ว: {statusResult.details.classesCompleted || 0} คลาส</p>
                        {statusResult.details.errors?.length > 0 && (
                          <p className="text-destructive">• Errors: {statusResult.details.errors.length}</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{statusResult.timestamp}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>คำแนะนำการทดสอบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <p className="font-medium">ตรวจสอบข้อมูลในระบบ</p>
                <p className="text-muted-foreground">
                  ตรวจสอบว่ามีคลาสที่จะเรียนพรุ่งนี้ หรือมี Makeup Class ที่นัดไว้พรุ่งนี้
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <p className="font-medium">กดปุ่มทดสอบ</p>
                <p className="text-muted-foreground">
                  เลือก Cron Job ที่ต้องการทดสอบและกดปุ่ม
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <p className="font-medium">ตรวจสอบผลลัพธ์</p>
                <p className="text-muted-foreground">
                  ดูจำนวนการแจ้งเตือนที่ส่งหรือคลาสที่อัพเดท รวมถึง error ที่เกิดขึ้น (ถ้ามี)
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div>
                <p className="font-medium">ตรวจสอบ LINE หรือฐานข้อมูล</p>
                <p className="text-muted-foreground">
                  ตรวจสอบว่าผู้ปกครองได้รับข้อความใน LINE หรือสถานะคลาสเปลี่ยนแล้วในฐานข้อมูล
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>ข้อควรระวัง:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>การทดสอบจะส่งข้อความจริงไปยังผู้ปกครอง</li>
                <li>การอัพเดทสถานะจะเปลี่ยนแปลงข้อมูลจริงในฐานข้อมูล</li>
                <li>ควรทดสอบในเวลาที่เหมาะสม เพื่อไม่รบกวนผู้ใช้</li>
                <li>ถ้าไม่มีข้อมูลที่ตรงเงื่อนไข จะไม่มีการส่งหรืออัพเดท</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Technical Info */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลเทคนิค</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">API Endpoints:</p>
              <div className="space-y-1 font-mono text-xs bg-muted p-3 rounded">
                <p>GET /api/cron/reminders</p>
                <p>GET /api/cron/update-class-status</p>
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">การตั้งค่า Production (Vercel Cron):</p>
              <div className="font-mono text-xs bg-muted p-3 rounded space-y-2">
                <p># vercel.json</p>
                <pre className="text-xs">{`{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/update-class-status",
      "schedule": "0 0 * * *"
    }
  ]
}`}</pre>
              </div>
            </div>

            <div>
              <p className="font-medium mb-1">Environment Variables:</p>
              <div className="font-mono text-xs bg-muted p-3 rounded">
                <p>CRON_SECRET=your-secret-key</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
// app/(admin)/test-makeup-notification/page.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendMakeupNotification } from '@/lib/services/line-notifications';
import { getMakeupClass } from '@/lib/services/makeup';

export default function TestMakeupNotificationPage() {
  const [makeupId, setMakeupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  // Test send notification directly
  const handleTestDirect = async () => {
    if (!makeupId.trim()) {
      setResult({
        success: false,
        message: 'กรุณาใส่ Makeup ID'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Get makeup data first
      const makeup = await getMakeupClass(makeupId);
      if (!makeup) {
        setResult({
          success: false,
          message: 'ไม่พบข้อมูล Makeup Class'
        });
        setLoading(false);
        return;
      }

      console.log('Makeup data:', makeup);

      // Check if makeup is scheduled
      if (makeup.status !== 'scheduled' || !makeup.makeupSchedule) {
        setResult({
          success: false,
          message: 'Makeup class ยังไม่ได้นัดวันเวลา หรือสถานะไม่ใช่ scheduled',
          data: makeup
        });
        setLoading(false);
        return;
      }

      // Send notification
      const success = await sendMakeupNotification(makeupId, 'scheduled');
      
      setResult({
        success,
        message: success ? 'ส่งการแจ้งเตือนสำเร็จ!' : 'ส่งการแจ้งเตือนไม่สำเร็จ',
        data: makeup
      });
    } catch (error) {
      console.error('Test error:', error);
      setResult({
        success: false,
        message: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Test via API route
  const handleTestAPI = async () => {
    if (!makeupId.trim()) {
      setResult({
        success: false,
        message: 'กรุณาใส่ Makeup ID'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test/makeup-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          makeupId,
          type: 'scheduled'
        })
      });

      const data = await response.json();
      
      setResult({
        success: response.ok,
        message: data.message || 'ดูผลลัพธ์ด้านล่าง',
        data: data
      });
    } catch (error) {
      console.error('API test error:', error);
      setResult({
        success: false,
        message: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>ทดสอบ Makeup Notification</CardTitle>
          <CardDescription>
            ทดสอบการส่งแจ้งเตือน LINE สำหรับ Makeup Class
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="makeupId">Makeup ID</Label>
            <Input
              id="makeupId"
              value={makeupId}
              onChange={(e) => setMakeupId(e.target.value)}
              placeholder="ใส่ Makeup ID ที่ต้องการทดสอบ"
            />
            <p className="text-sm text-muted-foreground">
              ใส่ ID ของ Makeup Class ที่มีสถานะ scheduled และมีการนัดวันเวลาแล้ว
            </p>
          </div>

          {/* Test Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleTestDirect}
              disabled={loading || !makeupId}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              ทดสอบ Direct Call
            </Button>
            
            <Button 
              onClick={handleTestAPI}
              disabled={loading || !makeupId}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              ทดสอบผ่าน API
            </Button>
          </div>

          {/* Result */}
          {result && (
            <Alert className={result.success ? 'border-green-200' : 'border-red-200'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                    {result.message}
                  </p>
                  
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        ดูข้อมูล Makeup Class
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-medium mb-2">วิธีใช้:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>ไปที่หน้า Makeup Management</li>
              <li>คัดลอก ID ของ Makeup ที่มีสถานะ "นัดแล้ว" (scheduled)</li>
              <li>วางใน input ด้านบน</li>
              <li>กดปุ่มทดสอบ</li>
              <li>ตรวจสอบว่ามีข้อความส่งไปยัง LINE หรือไม่</li>
            </ol>
          </div>

          {/* Debug Info */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-medium mb-2">ข้อมูลที่ต้องตรวจสอบ:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Makeup มีสถานะเป็น 'scheduled'</li>
              <li>มีข้อมูล makeupSchedule (วันเวลาที่นัด)</li>
              <li>Student มี Parent ที่เชื่อมต่อ LINE แล้ว</li>
              <li>Parent มี lineUserId</li>
              <li>LINE Settings มี Access Token ที่ถูกต้อง</li>
              <li>Template ข้อความในการตั้งค่า LINE</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
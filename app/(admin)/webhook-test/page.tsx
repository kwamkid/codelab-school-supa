'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Webhook, 
  CheckCircle, 
  XCircle,
  Copy,
  RefreshCw,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import { getLineSettings } from '@/lib/services/line-settings';

export default function WebhookTestPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getLineSettings();
      setSettings(data);
      if (typeof window !== 'undefined') {
        setWebhookUrl(`${window.location.origin}/api/webhooks/line`);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Test GET request first
      const getResponse = await fetch(webhookUrl);
      const getData = await getResponse.json();
      
      setTestResult({
        method: 'GET',
        status: getResponse.status,
        data: getData
      });

      if (getResponse.ok) {
        toast.success('Webhook endpoint ทำงานปกติ');
      } else {
        toast.error('Webhook endpoint มีปัญหา');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('ไม่สามารถเชื่อมต่อ webhook endpoint');
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTesting(false);
    }
  };

  const sendTestMessage = async () => {
    if (!settings?.messagingChannelAccessToken) {
      toast.error('กรุณาตั้งค่า Channel Access Token ก่อน');
      return;
    }

    setTesting(true);

    try {
      // Simulate webhook call
      const testEvent = {
        events: [{
          type: 'message',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: 'TEST_USER_' + Date.now()
          },
          message: {
            type: 'text',
            id: 'test_' + Date.now(),
            text: 'Test message from webhook test page'
          }
        }]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': 'test-signature' // This will fail validation but we can see the error
        },
        body: JSON.stringify(testEvent)
      });

      const result = await response.json();
      
      setTestResult({
        method: 'POST',
        status: response.status,
        data: result
      });

      if (response.status === 401) {
        toast.error('Signature validation failed (ปกติ เพราะเป็นการทดสอบ)');
      } else if (response.ok) {
        toast.success('ส่ง test event สำเร็จ');
      }
    } catch (error) {
      console.error('Send test error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่ง test event');
    } finally {
      setTesting(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('คัดลอก URL แล้ว');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-8 w-8 text-red-500" />
          ทดสอบ Webhook
        </h1>
        <p className="text-gray-600 mt-2">ทดสอบการทำงานของ webhook endpoint</p>
        {/* Debug: Show current logs */}
      <Card>
        <CardHeader>
          <CardTitle>Debug: Current Logs in Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={async () => {
              const response = await fetch('/api/webhooks/line');
              const data = await response.json();
              setTestResult({
                logsCount: data.count || 0,
                logs: data.logs || []
              });
            }}
            variant="outline"
            className="mb-4"
          >
            ดู Logs ที่เก็บอยู่
          </Button>
          
          {testResult?.logs && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">
                พบ {testResult.logs.length} logs
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {testResult.logs.map((log: any, index: number) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{log.type}</span>
                      <span className="text-gray-500">{log.userId}</span>
                    </div>
                    {log.message && (
                      <div className="text-gray-600 mt-1">{log.message}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-gray-50 font-mono text-sm"
            />
            <Button size="sm" variant="outline" onClick={copyUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={testWebhook} disabled={testing}>
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="h-4 w-4 mr-2" />
              )}
              ทดสอบ GET Request
            </Button>

            <Button onClick={sendTestMessage} disabled={testing} variant="outline">
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              ส่ง Test Event
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Status */}
      <Card>
        <CardHeader>
          <CardTitle>สถานะการตั้งค่า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Channel Secret</span>
            {settings?.messagingChannelSecret ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                ตั้งค่าแล้ว
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700">
                <XCircle className="h-3 w-3 mr-1" />
                ยังไม่ได้ตั้งค่า
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span>Channel Access Token</span>
            {settings?.messagingChannelAccessToken ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                ตั้งค่าแล้ว
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700">
                <XCircle className="h-3 w-3 mr-1" />
                ยังไม่ได้ตั้งค่า
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span>Webhook Verified</span>
            {settings?.webhookVerified ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-700">
                <XCircle className="h-3 w-3 mr-1" />
                Not Verified
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Result */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>ผลการทดสอบ</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Debug Instructions */}
      <Alert>
        <AlertDescription>
          <strong>วิธีตรวจสอบ logs:</strong>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>ทดสอบ GET Request - ควรเห็น logs ที่เก็บไว้</li>
            <li>ถ้าไม่มี logs แสดงว่ายังไม่มีข้อความเข้ามา</li>
            <li>ตรวจสอบว่า Webhook URL ใน LINE Console ตรงกับที่แสดง</li>
            <li>ตรวจสอบว่า Use webhook เปิดอยู่</li>
            <li>ลองส่งข้อความไปที่ Official Account อีกครั้ง</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}

const Badge = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
};
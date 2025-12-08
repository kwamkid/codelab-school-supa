// components/settings/line-webhook-test.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface LineWebhookTestProps {
  webhookUrl: string;
  webhookVerified: boolean;
  accessToken?: string;
}

export default function LineWebhookTest({ 
  webhookUrl, 
  webhookVerified,
  accessToken 
}: LineWebhookTestProps) {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Test webhook endpoint directly
  const testWebhookEndpoint = async () => {
    setTesting(true);
    setStatus('idle');
    
    try {
      // Test our webhook endpoint
      const response = await fetch(webhookUrl, {
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setStatus('success');
          toast.success('Webhook endpoint พร้อมใช้งาน');
          return true;
        }
      }
      
      setStatus('error');
      toast.error('Webhook endpoint ไม่สามารถเข้าถึงได้');
      return false;
      
    } catch (error) {
      setStatus('error');
      toast.error('ไม่สามารถเชื่อมต่อ Webhook endpoint');
      return false;
    } finally {
      setTesting(false);
    }
  };
  
  // Set webhook URL in LINE
  const setWebhookInLine = async () => {
    if (!accessToken) {
      toast.error('กรุณากรอก Channel Access Token ก่อน');
      return;
    }
    
    setTesting(true);
    
    try {
      const response = await fetch('/api/line/set-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          webhookUrl
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('ตั้งค่า Webhook URL ใน LINE สำเร็จ');
        // Reload to update status
        window.location.reload();
      } else {
        toast.error(result.message || 'ไม่สามารถตั้งค่า Webhook URL ได้');
      }
      
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการตั้งค่า');
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium">สถานะ Webhook</p>
          <p className="text-sm text-gray-500">
            {webhookVerified ? 'เชื่อมต่อกับ LINE แล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={webhookVerified ? 'default' : 'secondary'}>
            {webhookVerified ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Verified
              </>
            )}
          </Badge>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={testWebhookEndpoint}
          disabled={testing}
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          <span className="ml-2">ทดสอบ Endpoint</span>
        </Button>
        
        {accessToken && (
          <Button
            size="sm"
            variant="outline"
            onClick={setWebhookInLine}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">ตั้งค่า Webhook ใน LINE</span>
          </Button>
        )}
      </div>
      
      {status === 'success' && (
        <p className="text-sm text-green-600">
          ✓ Webhook endpoint ทำงานปกติ
        </p>
      )}
      
      {status === 'error' && (
        <p className="text-sm text-red-600">
          ✗ ไม่สามารถเข้าถึง Webhook endpoint ได้
        </p>
      )}
    </div>
  );
}
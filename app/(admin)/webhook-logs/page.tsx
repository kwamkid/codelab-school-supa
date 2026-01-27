'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  RefreshCw, 
  Copy,
  Info,
  User,
  Clock,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface WebhookLog {
  id: string;
  timestamp: Date;
  type: string;
  userId: string;
  userName?: string;
  message?: string;
  data: any;
}

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  // Auto refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadLogs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      // เรียก webhook endpoint โดยตรง
      const response = await fetch('/api/webhooks/line');
      const data = await response.json();
      
      console.log('Loaded data:', data); // Debug log
      
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
        // Extract unique user IDs - แก้ไขส่วนนี้
        const ids = new Set<string>(
          data.logs
            .map((log: WebhookLog) => log.userId)
            .filter((id): id is string => Boolean(id))
        );
        setUserIds(ids);
        toast.success(`โหลด ${data.logs.length} logs`);
      } else {
        console.log('No logs found in response');
        setLogs([]);
        setUserIds(new Set());
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('ไม่สามารถโหลด logs ได้');
    } finally {
      setLoading(false);
    }
  };

  const copyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId);
    toast.success('คัดลอก User ID แล้ว');
  };

  const getUserIdFromMessage = (event: any): string => {
    if (event.source?.userId) {
      return event.source.userId;
    }
    return 'Unknown';
  };

  const getEventTypeColor = (type: string): string => {
    switch (type) {
      case 'message':
        return 'bg-blue-100 text-blue-700';
      case 'follow':
        return 'bg-green-100 text-green-700';
      case 'unfollow':
        return 'bg-red-100 text-red-700';
      case 'postback':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-red-500" />
            Webhook Logs & User IDs
          </h1>
          <p className="text-gray-600 mt-2">ดู logs จาก LINE Webhook และค้นหา User ID</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Auto refresh (5s)</span>
          </label>
          <Button
            onClick={loadLogs}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Instructions */}
    <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
        <strong>วิธีหา User ID ของคุณ:</strong>
        <ol className="list-decimal list-inside mt-2 space-y-1">
        <li>เพิ่ม LINE Official Account เป็นเพื่อน</li>
        <li>ส่งข้อความอะไรก็ได้ไปที่ Official Account (พิมพ์ &quot;test&quot; หรืออะไรก็ได้)</li>
        <li>กลับมาที่หน้านี้และคลิก &quot;รีเฟรช&quot;</li>
        <li>User ID ของคุณจะแสดงในส่วน &quot;User IDs ที่พบ&quot; ด้านล่าง</li>
        </ol>
    </AlertDescription>
    </Alert>

      {/* User IDs Found */}
      {userIds.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User IDs ที่พบ
            </CardTitle>
            <CardDescription>
              คลิกที่ User ID เพื่อคัดลอก
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(userIds).map((userId) => (
                <Button
                  key={userId}
                  variant="outline"
                  size="sm"
                  onClick={() => copyUserId(userId)}
                  className="font-mono text-xs"
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {userId}
                  <Copy className="h-3 w-3 ml-2" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Logs ล่าสุด</CardTitle>
          <CardDescription>
            แสดง logs 20 รายการล่าสุด
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              กำลังโหลด...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              ยังไม่มี logs - ลองส่งข้อความไปที่ LINE Official Account
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getEventTypeColor(log.type)}>
                        {log.type}
                      </Badge>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.timestamp, 'long')} {formatDate(log.timestamp, 'time')}
                      </span>
                    </div>
                    {log.userId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyUserId(log.userId)}
                        className="font-mono text-xs"
                      >
                        <User className="h-3 w-3 mr-1" />
                        {log.userId}
                        <Copy className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                  
                  {log.message && (
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm font-medium text-gray-700">ข้อความ:</p>
                      <p className="text-sm text-gray-600">{log.message}</p>
                    </div>
                  )}
                  
                  {/* Raw Data (collapsed by default) */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      ดูข้อมูลดิบ
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
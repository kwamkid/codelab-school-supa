'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Save,
  Loader2,
  MessageSquare,
  Key,
  Webhook,
  Bot,
  TestTube,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Info,
  Send,
  User,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { 
  getLineSettings, 
  updateLineSettings,
  validateLineSettings,
  testLineChannel,
  generateWebhookUrl,
  LineSettings
} from '@/lib/services/line-settings';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LineWebhookTest from './line-webhook-test';

export default function LineSettingsComponent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<LineSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Test notification states
  const [testUserId, setTestUserId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testType, setTestType] = useState<'class' | 'makeup' | 'trial'>('class');
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);
  
  // Generate webhook URL when component mounts
  useEffect(() => {
    if (settings && typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      const webhookUrl = generateWebhookUrl(baseUrl);
      if (webhookUrl !== settings.webhookUrl) {
        setSettings({ ...settings, webhookUrl });
      }
    }
  }, [settings]);
  
  const loadSettings = async () => {
    try {
      const data = await getLineSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('ไม่สามารถโหลดการตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!settings || !user) return;

    // Validate
    const validation = validateLineSettings(settings);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('กรุณาตรวจสอบข้อมูลให้ถูกต้อง');
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      await updateLineSettings(settings, user.uid);
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };
  
  const handleTestConnection = async (type: 'login' | 'messaging') => {
    if (!settings) return;
    
    setTesting(true);
    
    try {
      let result;
      if (type === 'login') {
        result = await testLineChannel(
          settings.loginChannelId || '',
          settings.loginChannelSecret || ''
        );
      } else {
        result = await testLineChannel(
          settings.messagingChannelId || '',
          settings.messagingChannelSecret || '',
          settings.messagingChannelAccessToken
        );
      }
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการทดสอบ');
    } finally {
      setTesting(false);
    }
  };
  
  // ทดสอบส่งข้อความแจ้งเตือน
  const handleTestNotification = async () => {
    if (!testUserId.trim()) {
      toast.error('กรุณาระบุ LINE User ID');
      return;
    }
    
    setSendingTest(true);
    
    try {
      if (!settings?.messagingChannelAccessToken) {
        toast.error('กรุณาตั้งค่า Channel Access Token ก่อน');
        setSendingTest(false);
        return;
      }
      
      // เตรียมข้อมูลทดสอบตามประเภท
      let flexData;
      let template;
      let altText;
      
      switch (testType) {
        case 'class':
          flexData = {
            studentName: 'น้องทดสอบ',
            className: 'Scratch Programming',
            sessionNumber: 5,
            date: new Date(Date.now() + 86400000).toLocaleDateString('th-TH', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            startTime: '10:00',
            endTime: '11:30',
            teacherName: 'ครูทดสอบ',
            location: 'สาขาสุขุมวิท',
            roomName: 'ห้อง A'
          };
          template = 'classReminder';
          altText = '[ทดสอบ] แจ้งเตือนคลาสเรียนพรุ่งนี้';
          break;
          
        case 'makeup':
          flexData = {
            studentName: 'น้องทดสอบ',
            className: 'Python Programming',
            sessionNumber: 3,
            date: new Date(Date.now() + 172800000).toLocaleDateString('th-TH', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            startTime: '14:00',
            endTime: '15:30',
            teacherName: 'ครูชดเชย',
            location: 'สาขาพระราม 9',
            roomName: 'ห้อง B'
          };
          template = 'makeupConfirmation';
          altText = '[ทดสอบ] ยืนยันการนัด Makeup Class';
          break;
          
        case 'trial':
          flexData = {
            studentName: 'น้องทดลองเรียน',
            subjectName: 'Robotics for Kids',
            date: new Date(Date.now() + 259200000).toLocaleDateString('th-TH', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            startTime: '16:00',
            endTime: '17:00',
            location: 'สาขาเอกมัย',
            roomName: 'ห้อง Trial',
            contactPhone: '02-123-4567'
          };
          template = 'trialConfirmation';
          altText = '[ทดสอบ] ยืนยันการทดลองเรียน';
          break;
      }
      
      console.log('Sending test flex message:', { template, flexData });
      
      const response = await fetch('/api/line/send-flex-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: testUserId,
          template,
          data: flexData,
          altText,
          accessToken: settings.messagingChannelAccessToken
        })
      });
      
      const result = await response.json();
      console.log('Send result:', result);
      
      if (result.success) {
        toast.success('ส่งข้อความทดสอบสำเร็จ! กรุณาตรวจสอบ LINE');
      } else {
        toast.error(result.message || 'ไม่สามารถส่งข้อความได้');
        console.error('Send failed:', result);
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งข้อความทดสอบ');
    } finally {
      setSendingTest(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!settings) {
    return (
      <div className="text-center p-12 text-gray-500">
        ไม่สามารถโหลดข้อมูลได้
      </div>
    );
  }
  
  const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  
  return (
    <div className="space-y-6">
      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channels">
            <Key className="h-4 w-4 mr-2" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="webhook">
            <Webhook className="h-4 w-4 mr-2" />
            Webhook & LIFF
          </TabsTrigger>
          <TabsTrigger value="notification">
            <Bot className="h-4 w-4 mr-2" />
            แจ้งเตือนอัตโนมัติ
          </TabsTrigger>
          <TabsTrigger value="test">
            <TestTube className="h-4 w-4 mr-2" />
            ทดสอบ
          </TabsTrigger>
        </TabsList>
        
        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-6">
          {/* LINE Login Channel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  LINE Login Channel
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestConnection('login')}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  <span className="ml-2">ทดสอบ</span>
                </Button>
              </CardTitle>
              <CardDescription>
                ใช้สำหรับให้ผู้ปกครอง Login เข้าระบบผ่าน LINE
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loginChannelId">Channel ID</Label>
                  <Input
                    id="loginChannelId"
                    value={settings.loginChannelId || ''}
                    onChange={(e) => setSettings({...settings, loginChannelId: e.target.value})}
                    placeholder="1234567890"
                    className={errors.loginChannelId ? 'border-red-500' : ''}
                  />
                  {errors.loginChannelId && (
                    <p className="text-sm text-red-500">{errors.loginChannelId}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="loginChannelSecret">Channel Secret</Label>
                  <Input
                    id="loginChannelSecret"
                    type="password"
                    value={settings.loginChannelSecret || ''}
                    onChange={(e) => setSettings({...settings, loginChannelSecret: e.target.value})}
                    placeholder="32 ตัวอักษร"
                    className={errors.loginChannelSecret ? 'border-red-500' : ''}
                  />
                  {errors.loginChannelSecret && (
                    <p className="text-sm text-red-500">{errors.loginChannelSecret}</p>
                  )}
                </div>
              </div>
              
              {/* Callback URL */}
              <div className="space-y-2">
                <Label>Callback URL (สำหรับ LINE Login)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/line`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/api/auth/callback/line`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  คัดลอก URL นี้ไปใส่ใน Callback URL ของ LINE Login Channel
                </p>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  สร้าง LINE Login Channel ได้ที่{' '}
                  <a 
                    href="https://developers.line.biz/console/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    LINE Developers Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          {/* LINE Messaging API Channel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  LINE Messaging API Channel
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('/webhook-logs', '_blank')}
                  >
                    <User className="h-4 w-4" />
                    <span className="ml-2">ดู User ID</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection('messaging')}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    <span className="ml-2">ทดสอบ</span>
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                ใช้สำหรับส่งข้อความแจ้งเตือน
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="messagingChannelId">Channel ID</Label>
                  <Input
                    id="messagingChannelId"
                    value={settings.messagingChannelId || ''}
                    onChange={(e) => setSettings({...settings, messagingChannelId: e.target.value})}
                    placeholder="1234567890"
                    className={errors.messagingChannelId ? 'border-red-500' : ''}
                  />
                  {errors.messagingChannelId && (
                    <p className="text-sm text-red-500">{errors.messagingChannelId}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="messagingChannelSecret">Channel Secret</Label>
                  <Input
                    id="messagingChannelSecret"
                    type="password"
                    value={settings.messagingChannelSecret || ''}
                    onChange={(e) => setSettings({...settings, messagingChannelSecret: e.target.value})}
                    placeholder="32 ตัวอักษร"
                    className={errors.messagingChannelSecret ? 'border-red-500' : ''}
                  />
                  {errors.messagingChannelSecret && (
                    <p className="text-sm text-red-500">{errors.messagingChannelSecret}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="messagingChannelAccessToken">Channel Access Token</Label>
                <Textarea
                  id="messagingChannelAccessToken"
                  value={settings.messagingChannelAccessToken || ''}
                  onChange={(e) => setSettings({...settings, messagingChannelAccessToken: e.target.value})}
                  placeholder="Long-lived channel access token"
                  rows={3}
                  className={errors.messagingChannelAccessToken ? 'border-red-500' : ''}
                />
                {errors.messagingChannelAccessToken && (
                  <p className="text-sm text-red-500">{errors.messagingChannelAccessToken}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Webhook & LIFF Tab */}
        <TabsContent value="webhook" className="space-y-6">
          {/* Webhook Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook URL
              </CardTitle>
              <CardDescription>
                URL สำหรับรับข้อความจาก LINE
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={settings.webhookUrl || ''}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(settings.webhookUrl || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  คัดลอก URL นี้ไปใส่ใน LINE Developers Console
                </p>
              </div>
              
              <LineWebhookTest 
                webhookUrl={settings.webhookUrl || ''}
                webhookVerified={settings.webhookVerified}
                accessToken={settings.messagingChannelAccessToken}
              />
            </CardContent>
          </Card>
          
          {/* LIFF Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                LIFF (LINE Front-end Framework)
              </CardTitle>
              <CardDescription>
                ใช้สำหรับหน้าเว็บใน LINE เช่น ดูตารางเรียน จองทดลองเรียน
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="liffId">LIFF ID</Label>
                  <Input
                    id="liffId"
                    value={settings.liffId || ''}
                    onChange={(e) => setSettings({...settings, liffId: e.target.value})}
                    placeholder="1234567890-abcdefgh"
                    className={errors.liffId ? 'border-red-500' : ''}
                  />
                  {errors.liffId && (
                    <p className="text-sm text-red-500">{errors.liffId}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="liffChannelId">LIFF Channel ID</Label>
                  <Input
                    id="liffChannelId"
                    value={settings.liffChannelId || ''}
                    onChange={(e) => setSettings({...settings, liffChannelId: e.target.value})}
                    placeholder="1234567890"
                  />
                </div>
              </div>
              
              {/* LIFF Endpoint URL */}
              <div className="space-y-2">
                <Label>LIFF Endpoint URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/liff`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/liff`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  ใช้ URL นี้เป็น Endpoint URL เมื่อสร้าง LIFF App
                </p>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>สร้าง LIFF App ได้ที่ LINE Login Channel → LIFF tab</p>
                    <p className="text-sm">
                      <strong>Size:</strong> Full | 
                      <strong> Scope:</strong> profile, openid | 
                      <strong> Bot link:</strong> On (เลือก Messaging API channel)
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              
              {/* LIFF URLs */}
              {settings.liffId && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-sm">LIFF URLs</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">ดูตารางเรียน:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-xs">
                          https://liff.line.me/{settings.liffId}/schedule
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`https://liff.line.me/${settings.liffId}/schedule`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">จองทดลองเรียน:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-xs">
                          https://liff.line.me/{settings.liffId}/trial
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`https://liff.line.me/${settings.liffId}/trial`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">ชำระเงิน:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-xs">
                          https://liff.line.me/{settings.liffId}/payment
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`https://liff.line.me/${settings.liffId}/payment`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">โปรไฟล์:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-xs">
                          https://liff.line.me/{settings.liffId}/profile
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`https://liff.line.me/${settings.liffId}/profile`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Makeup Class:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-xs">
                          https://liff.line.me/{settings.liffId}/makeup
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`https://liff.line.me/${settings.liffId}/makeup`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notification Tab */}
        <TabsContent value="notification" className="space-y-6">
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                การแจ้งเตือนอัตโนมัติ
              </CardTitle>
              <CardDescription>
                ระบบจะส่งการแจ้งเตือนอัตโนมัติไปยังผู้ปกครองผ่าน LINE
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">เปิดใช้งานการแจ้งเตือน</Label>
                  <p className="text-sm text-gray-500">
                    ส่งข้อความแจ้งเตือนอัตโนมัติไปยังผู้ปกครอง
                  </p>
                </div>
                <Switch
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) => 
                    setSettings({...settings, enableNotifications: checked})
                  }
                />
              </div>
              
              {settings.enableNotifications && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">ประเภทการแจ้งเตือนที่ส่ง:</h4>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">แจ้งเตือนก่อนเรียน</p>
                        <p className="text-sm text-gray-500">ส่งก่อนวันเรียน 1 วัน เวลา 19:00 น.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="p-2 bg-green-100 rounded-full">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">ยืนยันการเรียนชดเชย</p>
                        <p className="text-sm text-gray-500">ส่งทันทีเมื่อนัดหมายสำเร็จ และแจ้งเตือนก่อนเรียน 1 วัน</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="p-2 bg-purple-100 rounded-full">
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">ยืนยันการทดลองเรียน</p>
                        <p className="text-sm text-gray-500">ส่งทันทีเมื่อจองสำเร็จ</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {!settings.enableNotifications && (
                <Alert className="bg-gray-50">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    การแจ้งเตือนถูกปิดอยู่ ระบบจะไม่ส่งข้อความใดๆ ไปยังผู้ปกครอง
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Test Tab */}
        <TabsContent value="test" className="space-y-6">
          {/* Advanced Test Page Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                ทดสอบการแจ้งเตือนแบบละเอียด
              </CardTitle>
              <CardDescription>
                ทดสอบส่งการแจ้งเตือนไปยังผู้ปกครองจริงผ่านระบบ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                เลือกผู้ปกครอง → นักเรียน → คลาส และทดสอบส่งการแจ้งเตือนจริงผ่านระบบ LINE
              </p>

              <Link href="/settings/line/test-notifications">
                <Button className="w-full sm:w-auto" variant="default">
                  <TestTube className="h-4 w-4 mr-2" />
                  เปิดหน้าทดสอบแบบละเอียด
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Test Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                ทดสอบส่งข้อความด่วน (Quick Test)
              </CardTitle>
              <CardDescription>
                ทดสอบส่งข้อความแจ้งเตือนแบบต่างๆ ไปยัง LINE User ID ที่ระบุโดยตรง
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>วิธีหา LINE User ID ของคุณ:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>เพิ่ม LINE Official Account เป็นเพื่อน</li>
                    <li>ส่งข้อความอะไรก็ได้ไปที่ Official Account</li>
                    <li>กดปุ่ม "ดู User ID" ด้านบน เพื่อดู webhook logs</li>
                  </ol>
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="testUserId">LINE User ID ของคุณ</Label>
                <Input
                  id="testUserId"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="U1234567890abcdef..."
                  disabled={sendingTest}
                />
                <p className="text-sm text-gray-500">
                  ใส่ User ID ของคุณเพื่อทดสอบส่งข้อความ
                </p>
              </div>
              
              {/* เลือกประเภทการแจ้งเตือน */}
              <div className="space-y-2">
                <Label>ประเภทการแจ้งเตือน</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={testType === 'class' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTestType('class')}
                  >
                    แจ้งเตือนก่อนเรียน
                  </Button>
                  <Button
                    type="button"
                    variant={testType === 'makeup' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTestType('makeup')}
                  >
                    ยืนยัน Makeup
                  </Button>
                  <Button
                    type="button"
                    variant={testType === 'trial' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTestType('trial')}
                  >
                    ยืนยันทดลองเรียน
                  </Button>
                </div>
              </div>
              
              {/* Preview */}
              <div className="space-y-2">
                <Label>ตัวอย่างข้อความที่จะส่ง</Label>
                <div className="p-4 bg-gray-50 rounded-lg">
                  {testType === 'class' && (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">🔔 แจ้งเตือนคลาสเรียนพรุ่งนี้</p>
                      <p>👦 นักเรียน: น้องทดสอบ</p>
                      <p>📚 คลาสเรียน: Scratch Programming (ครั้งที่ 5)</p>
                      <p>📅 วันที่: {new Date(Date.now() + 86400000).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p>⏰ เวลา: 10:00 - 11:30</p>
                      <p>👩‍🏫 ครูผู้สอน: ครูทดสอบ</p>
                      <p>📍 สถานที่: สาขาสุขุมวิท</p>
                      <p>🚪 ห้องเรียน: ห้อง A</p>
                    </div>
                  )}
                  
                  {testType === 'makeup' && (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">✅ ยืนยันการนัด Makeup Class</p>
                      <p>👦 นักเรียน: น้องทดสอบ</p>
                      <p>📚 คลาสเรียน: Python Programming (ครั้งที่ 3)</p>
                      <p>📅 วันที่: {new Date(Date.now() + 172800000).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p>⏰ เวลา: 14:00 - 15:30</p>
                      <p>👩‍🏫 ครูผู้สอน: ครูชดเชย</p>
                      <p>📍 สถานที่: สาขาพระราม 9</p>
                      <p>🚪 ห้องเรียน: ห้อง B</p>
                    </div>
                  )}
                  
                  {testType === 'trial' && (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">✅ ยืนยันการทดลองเรียน</p>
                      <p className="text-green-600 font-medium">จองสำเร็จแล้ว!</p>
                      <p>👦 นักเรียน: น้องทดลองเรียน</p>
                      <p>📚 วิชา: Robotics for Kids</p>
                      <p>📅 วันที่: {new Date(Date.now() + 259200000).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p>⏰ เวลา: 16:00 - 17:00</p>
                      <p>📍 สถานที่: สาขาเอกมัย</p>
                      <p>🚪 ห้องเรียน: ห้อง Trial</p>
                      <p className="text-gray-500 text-xs mt-2">หากต้องการเปลี่ยนแปลง กรุณาติดต่อ 02-123-4567</p>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                onClick={handleTestNotification}
                disabled={sendingTest || !testUserId.trim() || !settings.enableNotifications}
                className="w-full"
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังส่งข้อความทดสอบ...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    ส่งข้อความทดสอบ
                  </>
                )}
              </Button>
              
              {!settings.enableNotifications && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    การแจ้งเตือนถูกปิดอยู่ กรุณาเปิดใช้งานในแท็บ "ตั้งค่า" ก่อนทดสอบ
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          {/* Other Test Options */}
          <Card>
            <CardHeader>
              <CardTitle>เครื่องมือทดสอบอื่นๆ</CardTitle>
              <CardDescription>
                ลิงก์และเครื่องมือที่เป็นประโยชน์
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('https://developers.line.biz/console/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                เปิด LINE Developers Console
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('https://manager.line.biz/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                เปิด LINE Official Account Manager
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-red-500 hover:bg-red-600"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              บันทึกการตั้งค่า
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
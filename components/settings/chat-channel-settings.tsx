'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  TestTube,
  CheckCircle,
  Copy,
  ExternalLink,
  MessageSquare,
  Key,
  Webhook,
  Bot,
  Send,
  User,
  ArrowRight,
  Info,
  Facebook,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
} from '@/lib/services/chat';
import {
  getLineSettings,
  updateLineSettings,
  validateLineSettings,
  testLineChannel,
  generateWebhookUrl,
  LineSettings,
} from '@/lib/services/line-settings';
import { ChatChannel } from '@/types/models';
import { useAuth } from '@/hooks/useAuth';
import { SectionLoading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LineWebhookTest from './line-webhook-test';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Facebook page info from OAuth exchange API
interface FacebookPageInfo {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  pagePicture?: string;
  instagram?: {
    id: string;
    name?: string;
    username?: string;
    profilePictureUrl?: string;
  } | null;
}

export default function ChatChannelSettings() {
  const { user } = useAuth();

  // Loading
  const [loading, setLoading] = useState(true);

  // Chat channels (from chat_channels table)
  const [channels, setChannels] = useState<ChatChannel[]>([]);

  // LINE settings (from settings table — Login, LIFF, Notifications, etc.)
  const [lineSettings, setLineSettings] = useState<LineSettings | null>(null);
  const [savingLineSettings, setSavingLineSettings] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [testingLine, setTestingLine] = useState(false);

  // LINE test notification
  const [testUserId, setTestUserId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testType, setTestType] = useState<'class' | 'makeup' | 'trial'>('class');

  // FB/IG — App config (prefer env vars, fallback to manual input)
  const [fbAppId, setFbAppId] = useState(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '');
  const [fbAppSecret, setFbAppSecret] = useState(process.env.NEXT_PUBLIC_FACEBOOK_APP_SECRET || '');

  // FB/IG — OAuth flow
  const [connectingFb, setConnectingFb] = useState(false);
  const [fetchedPages, setFetchedPages] = useState<FacebookPageInfo[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [showPageSelectDialog, setShowPageSelectDialog] = useState(false);
  const [savingPages, setSavingPages] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ChatChannel | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Channel testing
  const [testingId, setTestingId] = useState<string | null>(null);

  // Collapsible sections (LINE tab)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    messaging: true,
    webhook: false,
    login: false,
    liff: false,
    notifications: false,
    test: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Load data ---
  const loadChannels = useCallback(async () => {
    try {
      const data = await getChannels();
      setChannels(data);
      // Pre-fill FB App config from first FB channel (if exists)
      const fbCh = data.find((c) => c.type === 'facebook');
      if (fbCh) {
        if (fbCh.credentials?.appId) setFbAppId(fbCh.credentials.appId);
        if (fbCh.credentials?.appSecret) setFbAppSecret(fbCh.credentials.appSecret);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  }, []);

  const loadLineSettings = useCallback(async () => {
    try {
      const data = await getLineSettings();
      setLineSettings(data);
    } catch (error) {
      console.error('Error loading LINE settings:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadChannels(), loadLineSettings()]).finally(() => setLoading(false));
  }, [loadChannels, loadLineSettings]);

  // Generate webhook URL
  useEffect(() => {
    if (lineSettings && typeof window !== 'undefined') {
      const webhookUrl = generateWebhookUrl(window.location.origin);
      if (webhookUrl !== lineSettings.webhookUrl) {
        setLineSettings({ ...lineSettings, webhookUrl });
      }
    }
  }, [lineSettings]);

  const lineChannels = channels.filter((c) => c.type === 'line');
  const fbIgChannels = channels.filter((c) => c.type === 'facebook' || c.type === 'instagram');

  // --- LINE Settings handlers ---

  const handleSaveLineSettings = async () => {
    if (!lineSettings || !user) return;
    const validation = validateLineSettings(lineSettings);
    if (!validation.isValid) {
      setLineErrors(validation.errors);
      toast.error('กรุณาตรวจสอบข้อมูลให้ถูกต้อง');
      return;
    }
    setSavingLineSettings(true);
    setLineErrors({});
    try {
      await updateLineSettings(lineSettings, user.uid);

      // Auto-sync: upsert chat_channels record so the chat webhook can find this LINE account
      if (lineSettings.messagingChannelSecret && lineSettings.messagingChannelAccessToken) {
        const credentials = {
          channelSecret: lineSettings.messagingChannelSecret,
          accessToken: lineSettings.messagingChannelAccessToken,
        };
        const existingLine = lineChannels[0]; // single LINE account
        if (existingLine) {
          await updateChannel(existingLine.id, { name: existingLine.name, credentials });
        } else {
          await createChannel({
            type: 'line',
            name: 'LINE OA',
            credentials,
            createdBy: user.uid,
          });
          await loadChannels();
        }
      }

      toast.success('บันทึกการตั้งค่า LINE เรียบร้อยแล้ว');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSavingLineSettings(false);
    }
  };

  const handleTestLineConnection = async (type: 'login' | 'messaging') => {
    if (!lineSettings) return;
    setTestingLine(true);
    try {
      const result =
        type === 'login'
          ? await testLineChannel(lineSettings.loginChannelId || '', lineSettings.loginChannelSecret || '')
          : await testLineChannel(
              lineSettings.messagingChannelId || '',
              lineSettings.messagingChannelSecret || '',
              lineSettings.messagingChannelAccessToken
            );
      result.success ? toast.success(result.message) : toast.error(result.message);
    } catch {
      toast.error('เกิดข้อผิดพลาดในการทดสอบ');
    } finally {
      setTestingLine(false);
    }
  };

  const handleTestNotification = async () => {
    if (!testUserId.trim()) { toast.error('กรุณาระบุ LINE User ID'); return; }
    if (!lineSettings?.messagingChannelAccessToken) { toast.error('กรุณาตั้งค่า Channel Access Token ก่อน'); return; }
    setSendingTest(true);
    try {
      let template: string, flexData: any, altText: string;
      switch (testType) {
        case 'class':
          template = 'classReminder';
          altText = '[ทดสอบ] แจ้งเตือนคลาสเรียนพรุ่งนี้';
          flexData = { studentName: 'น้องทดสอบ', className: 'Scratch Programming', sessionNumber: 5, date: new Date(Date.now() + 86400000).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), startTime: '10:00', endTime: '11:30', teacherName: 'ครูทดสอบ', location: 'สาขาสุขุมวิท', roomName: 'ห้อง A' };
          break;
        case 'makeup':
          template = 'makeupConfirmation';
          altText = '[ทดสอบ] ยืนยันการนัด Makeup Class';
          flexData = { studentName: 'น้องทดสอบ', className: 'Python Programming', sessionNumber: 3, date: new Date(Date.now() + 172800000).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), startTime: '14:00', endTime: '15:30', teacherName: 'ครูชดเชย', location: 'สาขาพระราม 9', roomName: 'ห้อง B' };
          break;
        case 'trial':
          template = 'trialConfirmation';
          altText = '[ทดสอบ] ยืนยันการทดลองเรียน';
          flexData = { studentName: 'น้องทดลองเรียน', subjectName: 'Robotics for Kids', date: new Date(Date.now() + 259200000).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), startTime: '16:00', endTime: '17:00', location: 'สาขาเอกมัย', roomName: 'ห้อง Trial', contactPhone: '02-123-4567' };
          break;
      }
      const res = await fetch('/api/line/send-flex-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: testUserId, template, data: flexData, altText, accessToken: lineSettings.messagingChannelAccessToken }),
      });
      const result = await res.json();
      result.success ? toast.success('ส่งข้อความทดสอบสำเร็จ!') : toast.error(result.message || 'ไม่สามารถส่งข้อความได้');
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งข้อความทดสอบ');
    } finally {
      setSendingTest(false);
    }
  };

  // --- Facebook OAuth handlers ---

  const handleConnectFacebook = () => {
    if (!fbAppId.trim()) {
      toast.error('กรุณากรอก Facebook App ID ก่อน');
      return;
    }
    setConnectingFb(true);

    const redirectUri = `${window.location.origin}/settings/chat/facebook-callback`;
    const scope = 'pages_messaging,pages_read_engagement,pages_manage_metadata,pages_show_list,business_management,public_profile';
    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${fbAppId.trim()}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

    const popup = window.open(oauthUrl, 'fb-oauth', 'width=600,height=700');

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'fb-oauth-callback') return;

      window.removeEventListener('message', handleMessage);

      if (event.data.error) {
        toast.error(`Facebook login ถูกยกเลิก: ${event.data.errorDescription || event.data.error}`);
        setConnectingFb(false);
        return;
      }

      if (!event.data.code) {
        toast.error('ไม่ได้รับ authorization code จาก Facebook');
        setConnectingFb(false);
        return;
      }

      // Exchange code for pages
      try {
        const res = await fetch('/api/admin/chat/facebook/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: event.data.code,
            appId: fbAppId.trim(),
            appSecret: fbAppSecret.trim(),
            redirectUri,
          }),
        });
        const data = await res.json();
        if (data.error) {
          toast.error(data.error);
          setConnectingFb(false);
          return;
        }

        // Filter out already connected pages
        const connectedPageIds = new Set(fbIgChannels.filter((c) => c.type === 'facebook').map((c) => c.credentials?.pageId));
        const newPages = (data.pages as FacebookPageInfo[]).filter((p) => !connectedPageIds.has(p.pageId));

        if (newPages.length === 0) {
          toast.info('เพจทั้งหมดเชื่อมต่อแล้ว');
          setConnectingFb(false);
          return;
        }

        setFetchedPages(newPages);
        setSelectedPageIds(new Set(newPages.map((p) => p.pageId)));
        setShowPageSelectDialog(true);
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ Facebook');
      } finally {
        setConnectingFb(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup if popup closed without callback
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        setTimeout(() => {
          setConnectingFb(false);
          window.removeEventListener('message', handleMessage);
        }, 1000);
      }
    }, 1000);
  };

  const handleSaveSelectedPages = async () => {
    if (selectedPageIds.size === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 เพจ');
      return;
    }
    setSavingPages(true);
    try {
      const webhookVerifyToken = crypto.randomUUID().slice(0, 16);
      for (const page of fetchedPages) {
        if (!selectedPageIds.has(page.pageId)) continue;

        const credentials: Record<string, string> = {
          appId: fbAppId.trim(),
          appSecret: fbAppSecret.trim(),
          pageAccessToken: page.pageAccessToken,
          pageId: page.pageId,
          pageName: page.pageName,
          webhookVerifyToken,
        };

        if (page.instagram) {
          credentials.instagramAccountId = page.instagram.id;
          if (page.instagram.username) credentials.instagramHandle = `@${page.instagram.username}`;
        }

        // Check if FB channel already exists for this page → update token instead of creating new
        const existingFb = channels.find(c => c.type === 'facebook' && c.platformId === page.pageId);
        if (existingFb) {
          await updateChannel(existingFb.id, {
            credentials,
            name: page.pageName,
            platformName: page.pageName,
            isActive: true,
          });
        } else {
          await createChannel({
            type: 'facebook',
            name: page.pageName,
            platformId: page.pageId,
            platformName: page.pageName,
            credentials,
            createdBy: user?.uid,
          });
        }

        // Create or update IG channel if linked
        if (page.instagram) {
          const existingIg = channels.find(c => c.type === 'instagram' && c.platformId === page.instagram!.id);
          if (existingIg) {
            await updateChannel(existingIg.id, {
              credentials,
              name: `${page.pageName} (IG)`,
              platformName: page.instagram.username || page.instagram.name,
              isActive: true,
            });
          } else {
            await createChannel({
              type: 'instagram',
              name: `${page.pageName} (IG)`,
              platformId: page.instagram.id,
              platformName: page.instagram.username || page.instagram.name,
              credentials,
              createdBy: user?.uid,
            });
          }
        }
      }

      toast.success(`เชื่อมต่อ ${selectedPageIds.size} เพจสำเร็จ กำลัง sync ข้อความเก่า...`);
      setShowPageSelectDialog(false);
      setFetchedPages([]);
      await loadChannels();

      // Auto-sync old messages in background
      fetch('/api/admin/chat/sync-messages', { method: 'POST' })
        .then(r => r.json())
        .then(result => {
          if (result.success) {
            toast.success(`Sync สำเร็จ: ${result.conversations} แชท, ${result.messagesSynced} ข้อความ`);
          }
        })
        .catch(() => {});
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSavingPages(false);
    }
  };

  // --- Common handlers ---

  const handleToggleActive = async (channel: ChatChannel) => {
    try {
      await updateChannel(channel.id, { isActive: !channel.isActive });
      toast.success(channel.isActive ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
      await loadChannels();
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChannel(deleteTarget.id);
      if (deleteTarget.type === 'facebook') {
        const linkedIg = channels.find((c) => c.type === 'instagram' && c.credentials?.pageId === deleteTarget.credentials?.pageId);
        if (linkedIg) await deleteChannel(linkedIg.id);
      }
      toast.success('ลบช่องทางสำเร็จ');
      setDeleteTarget(null);
      await loadChannels();
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestChannel = async (channel: ChatChannel) => {
    setTestingId(channel.id);
    try {
      if (channel.type === 'line') {
        const res = await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${channel.credentials?.accessToken}` } });
        if (res.ok) { const info = await res.json(); toast.success(`เชื่อมต่อสำเร็จ: ${info.displayName || info.basicId}`); }
        else toast.error('ไม่สามารถเชื่อมต่อ LINE ได้');
      } else {
        const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${channel.credentials?.pageAccessToken}`);
        if (res.ok) { const info = await res.json(); toast.success(`เชื่อมต่อสำเร็จ: ${info.name}`); }
        else toast.error('ไม่สามารถเชื่อมต่อ Facebook ได้');
      }
    } catch { toast.error('เกิดข้อผิดพลาดในการทดสอบ'); }
    finally { setTestingId(null); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  if (loading) return <SectionLoading />;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เชื่อมแชท</h1>
        <p className="text-base text-gray-500 mt-1">ตั้งค่าเชื่อมต่อ LINE, Facebook Messenger, Instagram DM</p>
      </div>

      <Tabs defaultValue="line" className="w-full">
        <TabsList>
          <TabsTrigger value="line" className="text-base">LINE</TabsTrigger>
          <TabsTrigger value="fb" className="text-base">
            Facebook / Instagram
            {fbIgChannels.filter((c) => c.type === 'facebook').length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{fbIgChannels.filter((c) => c.type === 'facebook').length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==================== LINE TAB ==================== */}
        <TabsContent value="line" className="space-y-6 mt-4">

          {/* --- Messaging API --- */}
          {lineSettings && (
            <>
              <Card>
                <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection('messaging')}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><Bot className="h-5 w-5" />LINE Messaging API</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => window.open('/webhook-logs', '_blank')}>
                          <User className="h-4 w-4 mr-1" />ดู User ID
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleTestLineConnection('messaging')} disabled={testingLine}>
                          {testingLine ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                          <span className="ml-1">ทดสอบ</span>
                        </Button>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.messaging ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-base">ใช้สำหรับรับ-ส่งข้อความแชทและแจ้งเตือน</CardDescription>
                </CardHeader>
                {expandedSections.messaging && <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base">Channel ID</Label>
                      <Input value={lineSettings.messagingChannelId || ''} onChange={(e) => setLineSettings({ ...lineSettings, messagingChannelId: e.target.value })} placeholder="1234567890" className={`text-base ${lineErrors.messagingChannelId ? 'border-red-500' : ''}`} />
                      {lineErrors.messagingChannelId && <p className="text-sm text-red-500">{lineErrors.messagingChannelId}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Channel Secret</Label>
                      <Input type="password" value={lineSettings.messagingChannelSecret || ''} onChange={(e) => setLineSettings({ ...lineSettings, messagingChannelSecret: e.target.value })} placeholder="32 ตัวอักษร" className={`text-base ${lineErrors.messagingChannelSecret ? 'border-red-500' : ''}`} />
                      {lineErrors.messagingChannelSecret && <p className="text-sm text-red-500">{lineErrors.messagingChannelSecret}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Channel Access Token</Label>
                    <Textarea value={lineSettings.messagingChannelAccessToken || ''} onChange={(e) => setLineSettings({ ...lineSettings, messagingChannelAccessToken: e.target.value })} placeholder="Long-lived channel access token" rows={3} className={`text-base ${lineErrors.messagingChannelAccessToken ? 'border-red-500' : ''}`} />
                    {lineErrors.messagingChannelAccessToken && <p className="text-sm text-red-500">{lineErrors.messagingChannelAccessToken}</p>}
                  </div>
                </CardContent>}
              </Card>

              {/* --- Webhook --- */}
              <Card>
                <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection('webhook')}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><Webhook className="h-5 w-5" />Webhook</span>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.webhook ? 'rotate-180' : ''}`} />
                  </CardTitle>
                  <CardDescription className="text-base">URL สำหรับรับข้อความจาก LINE</CardDescription>
                </CardHeader>
                {expandedSections.webhook && <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base">Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input value={lineSettings.webhookUrl || ''} readOnly className="text-base font-mono" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(lineSettings.webhookUrl || '')}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <LineWebhookTest webhookUrl={lineSettings.webhookUrl || ''} webhookVerified={lineSettings.webhookVerified} accessToken={lineSettings.messagingChannelAccessToken} />
                </CardContent>}
              </Card>

              {/* --- LINE Login --- */}
              <Card>
                <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection('login')}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><Key className="h-5 w-5" />LINE Login</span>
                    <div className="flex items-center gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => handleTestLineConnection('login')} disabled={testingLine}>
                          {testingLine ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                          <span className="ml-1">ทดสอบ</span>
                        </Button>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.login ? 'rotate-180' : ''}`} />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-base">ใช้สำหรับให้ผู้ปกครอง Login เข้าระบบผ่าน LINE</CardDescription>
                </CardHeader>
                {expandedSections.login && <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base">Channel ID</Label>
                      <Input value={lineSettings.loginChannelId || ''} onChange={(e) => setLineSettings({ ...lineSettings, loginChannelId: e.target.value })} placeholder="1234567890" className={`text-base ${lineErrors.loginChannelId ? 'border-red-500' : ''}`} />
                      {lineErrors.loginChannelId && <p className="text-sm text-red-500">{lineErrors.loginChannelId}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Channel Secret</Label>
                      <Input type="password" value={lineSettings.loginChannelSecret || ''} onChange={(e) => setLineSettings({ ...lineSettings, loginChannelSecret: e.target.value })} placeholder="32 ตัวอักษร" className={`text-base ${lineErrors.loginChannelSecret ? 'border-red-500' : ''}`} />
                      {lineErrors.loginChannelSecret && <p className="text-sm text-red-500">{lineErrors.loginChannelSecret}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Callback URL</Label>
                    <div className="flex gap-2">
                      <Input value={`${baseUrl}/api/auth/callback/line`} readOnly className="text-base font-mono" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(`${baseUrl}/api/auth/callback/line`)}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-sm text-gray-500">คัดลอก URL นี้ไปใส่ใน Callback URL ของ LINE Login Channel</p>
                  </div>
                </CardContent>}
              </Card>

              {/* --- LIFF --- */}
              <Card>
                <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection('liff')}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />LIFF (LINE Front-end Framework)</span>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.liff ? 'rotate-180' : ''}`} />
                  </CardTitle>
                  <CardDescription className="text-base">ใช้สำหรับหน้าเว็บใน LINE เช่น ดูตารางเรียน จองทดลองเรียน</CardDescription>
                </CardHeader>
                {expandedSections.liff && <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base">LIFF ID</Label>
                      <Input value={lineSettings.liffId || ''} onChange={(e) => setLineSettings({ ...lineSettings, liffId: e.target.value })} placeholder="1234567890-abcdefgh" className={`text-base ${lineErrors.liffId ? 'border-red-500' : ''}`} />
                      {lineErrors.liffId && <p className="text-sm text-red-500">{lineErrors.liffId}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">LIFF Channel ID</Label>
                      <Input value={lineSettings.liffChannelId || ''} onChange={(e) => setLineSettings({ ...lineSettings, liffChannelId: e.target.value })} placeholder="1234567890" className="text-base" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">LIFF Endpoint URL</Label>
                    <div className="flex gap-2">
                      <Input value={`${baseUrl}/liff`} readOnly className="text-base font-mono" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(`${baseUrl}/liff`)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {lineSettings.liffId && (
                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-base">LIFF URLs</h4>
                      {[
                        { label: 'ดูตารางเรียน', path: '/schedule' },
                        { label: 'จองทดลองเรียน', path: '/trial' },
                        { label: 'ชำระเงิน', path: '/payment' },
                        { label: 'โปรไฟล์', path: '/profile' },
                        { label: 'Makeup Class', path: '/makeup' },
                      ].map((liff) => (
                        <div key={liff.path} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{liff.label}:</span>
                          <div className="flex items-center gap-1">
                            <code className="bg-white px-2 py-1 rounded text-xs">https://liff.line.me/{lineSettings.liffId}{liff.path}</code>
                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`https://liff.line.me/${lineSettings.liffId}${liff.path}`)}><Copy className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>}
              </Card>

              {/* --- Notifications --- */}
              <Card>
                <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection('notifications')}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><Bot className="h-5 w-5" />การแจ้งเตือนอัตโนมัติ</span>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.notifications ? 'rotate-180' : ''}`} />
                  </CardTitle>
                  <CardDescription className="text-base">ระบบจะส่งการแจ้งเตือนอัตโนมัติไปยังผู้ปกครองผ่าน LINE</CardDescription>
                </CardHeader>
                {expandedSections.notifications && <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base">เปิดใช้งานการแจ้งเตือน</Label>
                      <p className="text-sm text-gray-500">ส่งข้อความแจ้งเตือนอัตโนมัติไปยังผู้ปกครอง</p>
                    </div>
                    <Switch checked={lineSettings.enableNotifications} onCheckedChange={(checked) => setLineSettings({ ...lineSettings, enableNotifications: checked })} />
                  </div>
                  {lineSettings.enableNotifications && (
                    <div className="grid gap-3">
                      {[
                        { icon: <MessageSquare className="h-4 w-4 text-blue-600" />, bg: 'bg-blue-100', title: 'แจ้งเตือนก่อนเรียน', desc: 'ส่งก่อนวันเรียน 1 วัน เวลา 19:00 น.' },
                        { icon: <CheckCircle className="h-4 w-4 text-green-600" />, bg: 'bg-green-100', title: 'ยืนยันการเรียนชดเชย', desc: 'ส่งทันทีเมื่อนัดหมายสำเร็จ และแจ้งเตือนก่อนเรียน 1 วัน' },
                        { icon: <MessageSquare className="h-4 w-4 text-purple-600" />, bg: 'bg-purple-100', title: 'ยืนยันการทดลองเรียน', desc: 'ส่งทันทีเมื่อจองสำเร็จ' },
                      ].map((n) => (
                        <div key={n.title} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className={`p-2 ${n.bg} rounded-full`}>{n.icon}</div>
                          <div><p className="font-medium text-sm">{n.title}</p><p className="text-sm text-gray-500">{n.desc}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>}
              </Card>

              {/* --- Test Notifications --- */}
              <Card>
                <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection('test')}>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><Send className="h-5 w-5" />ทดสอบส่งข้อความ</span>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedSections.test ? 'rotate-180' : ''}`} />
                  </CardTitle>
                  <CardDescription className="text-base">ทดสอบส่งข้อความแจ้งเตือนไปยัง LINE User ID</CardDescription>
                </CardHeader>
                {expandedSections.test && <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Link href="/settings/line/test-notifications">
                      <Button variant="outline" size="sm"><TestTube className="h-4 w-4 mr-1" />ทดสอบแบบละเอียด<ArrowRight className="h-4 w-4 ml-1" /></Button>
                    </Link>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">LINE User ID</Label>
                    <Input value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="U1234567890abcdef..." className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">ประเภทการแจ้งเตือน</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['class', 'makeup', 'trial'] as const).map((t) => (
                        <Button key={t} type="button" variant={testType === t ? 'default' : 'outline'} size="sm" onClick={() => setTestType(t)}>
                          {t === 'class' ? 'แจ้งเตือนก่อนเรียน' : t === 'makeup' ? 'ยืนยัน Makeup' : 'ยืนยันทดลองเรียน'}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleTestNotification} disabled={sendingTest || !testUserId.trim() || !lineSettings.enableNotifications} className="w-full">
                    {sendingTest ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังส่ง...</> : <><Send className="h-4 w-4 mr-2" />ส่งข้อความทดสอบ</>}
                  </Button>
                </CardContent>}
              </Card>

              {/* --- Save LINE Settings --- */}
              <div className="flex justify-end">
                <Button onClick={handleSaveLineSettings} disabled={savingLineSettings} className="bg-red-500 hover:bg-red-600">
                  {savingLineSettings ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4 mr-2" />บันทึกการตั้งค่า LINE</>}
                </Button>
              </div>

              {/* LINE Chat Channel auto-synced from Messaging API settings above */}
              {lineChannels.length > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-base text-green-800">
                    ระบบแชท LINE เชื่อมต่อแล้ว (ใช้ credentials จาก Messaging API ด้านบน)
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </TabsContent>

        {/* ==================== FB/IG TAB ==================== */}
        <TabsContent value="fb" className="space-y-6 mt-4">

          {/* --- Connect Button --- */}
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Button onClick={handleConnectFacebook} disabled={connectingFb || !fbAppId.trim() || !fbAppSecret.trim()} className="bg-blue-600 hover:bg-blue-700">
                  {connectingFb ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังเชื่อมต่อ...</> : <><Facebook className="w-4 h-4 mr-2" />เชื่อมต่อ Facebook</>}
                </Button>
                <p className="text-sm text-gray-500">Login ด้วย Facebook → เลือกเพจ → ระบบจะดึงข้อมูลให้อัตโนมัติ (รวม Instagram ที่เชื่อมอยู่)</p>
              </div>
            </CardContent>
          </Card>

          {/* --- Connected Pages --- */}
          {fbIgChannels.filter((c) => c.type === 'facebook').length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">เพจที่เชื่อมแล้ว</h3>
              {fbIgChannels.filter((c) => c.type === 'facebook').map((fbChannel) => {
                const linkedIg = fbIgChannels.find((c) => c.type === 'instagram' && c.credentials?.pageId === fbChannel.credentials?.pageId);
                return <FbIgChannelCard key={fbChannel.id} fbChannel={fbChannel} igChannel={linkedIg || null} onTest={() => handleTestChannel(fbChannel)} onToggle={() => handleToggleActive(fbChannel)} onDelete={() => setDeleteTarget(fbChannel)} testing={testingId === fbChannel.id} />;
              })}
            </div>
          )}

          {/* --- Webhook URL --- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Facebook Webhook URL</CardTitle>
              <CardDescription className="text-base">คัดลอก URL นี้ไปตั้งค่าใน Facebook App &gt; Webhooks (ใช้ร่วมกันทั้ง Messenger และ Instagram)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={`${baseUrl}/api/webhooks/facebook`} className="text-base font-mono" />
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(`${baseUrl}/api/webhooks/facebook`)}><Copy className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOGS ==================== */}

      {/* Page Selection Dialog (after Facebook OAuth) */}
      <Dialog open={showPageSelectDialog} onOpenChange={setShowPageSelectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">เลือกเพจที่ต้องการเชื่อมต่อ</DialogTitle>
            <DialogDescription className="text-base">พบ {fetchedPages.length} เพจ เลือกเพจที่ต้องการรับ-ส่งแชท</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {fetchedPages.map((page) => (
              <label key={page.pageId} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <Checkbox
                  checked={selectedPageIds.has(page.pageId)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedPageIds);
                    checked ? next.add(page.pageId) : next.delete(page.pageId);
                    setSelectedPageIds(next);
                  }}
                />
                {page.pagePicture && (
                  <img src={page.pagePicture} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate">{page.pageName}</p>
                  {page.instagram && (
                    <p className="text-sm text-pink-500">IG: @{page.instagram.username || page.instagram.name}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPageSelectDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleSaveSelectedPages} disabled={savingPages || selectedPageIds.size === 0}>
              {savingPages ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังเชื่อมต่อ...</> : <>เชื่อมต่อ {selectedPageIds.size} เพจ</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">ลบช่องทางแชท</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              คุณต้องการลบ &quot;{deleteTarget?.name}&quot; หรือไม่?
              {deleteTarget?.type === 'facebook' && ' (Instagram ที่เชื่อมอยู่จะถูกลบด้วย)'}
              {' '}การลบนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Sub-components ---

function ChannelCard({ channel, onEdit, onTest, onToggle, onDelete, testing }: {
  channel: ChatChannel; onEdit: () => void; onTest: () => void; onToggle: () => void; onDelete: () => void; testing: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-medium truncate">{channel.name}</p>
            <Badge variant={channel.isActive ? 'default' : 'secondary'} className="text-xs">{channel.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</Badge>
          </div>
          <p className="text-sm text-gray-500 truncate">Channel Secret: {channel.credentials?.channelSecret ? '••••••••' : '-'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={channel.isActive} onCheckedChange={onToggle} />
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>แก้ไข</Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FbIgChannelCard({ fbChannel, igChannel, onTest, onToggle, onDelete, testing }: {
  fbChannel: ChatChannel; igChannel: ChatChannel | null; onTest: () => void; onToggle: () => void; onDelete: () => void; testing: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-medium truncate">{fbChannel.name}</p>
            <Badge variant={fbChannel.isActive ? 'default' : 'secondary'} className="text-xs">{fbChannel.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>FB: {fbChannel.credentials?.pageName || fbChannel.platformName || '-'}</span>
            {igChannel && <span className="text-pink-500">IG: {igChannel.credentials?.instagramHandle || igChannel.platformName || 'เชื่อมแล้ว'}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={fbChannel.isActive} onCheckedChange={onToggle} />
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

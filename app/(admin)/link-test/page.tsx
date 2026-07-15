'use client';

// TEST-ONLY page for verifying the LINE parent-linking flow end-to-end.
// Creates a throwaway parent (display_name prefixed "[LINKTEST] "), shows its QR,
// and polls until the scan links a LINE account. Delete once verified in prod.

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { AlertCircle, CheckCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TestParent {
  id: string;
  display_name: string;
  phone: string;
}

export default function LinkTestPage() {
  const [name, setName] = useState('ทดสอบ ลิงก์');
  const [phone, setPhone] = useState('0990000001');
  const [creating, setCreating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState('');

  const [parent, setParent] = useState<TestParent | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [status, setStatus] = useState<any>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const call = async (body: any) => {
    const res = await fetch('/api/admin/link-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'เกิดข้อผิดพลาด');
    return data;
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError('');
      setStatus(null);
      const data = await call({ action: 'create', name, phone });
      setParent(data.parent);
      setLinkUrl(data.linkUrl);
      toast.success('สร้าง QR ทดสอบแล้ว — สแกนได้เลย');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setCleaning(true);
      const data = await call({ action: 'cleanup' });
      setParent(null);
      setLinkUrl('');
      setStatus(null);
      toast.success(`ลบข้อมูลทดสอบแล้ว ${data.deleted} รายการ`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setCleaning(false);
    }
  };

  // Poll for the link result while a test parent is pending.
  useEffect(() => {
    if (!parent || status?.linked) return;

    const check = async () => {
      try {
        const data = await call({ action: 'status', parentId: parent.id });
        setStatus(data);
        if (data.linked) toast.success('เชื่อมต่อสำเร็จ!');
      } catch {
        // transient — keep polling
      }
    };

    check();
    pollRef.current = setInterval(check, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [parent, status?.linked]);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="ทดสอบเชื่อมต่อ LINE"
        description="สร้างผู้ปกครองสมมติ + QR เพื่อทดสอบการเชื่อม LINE โดยไม่แตะข้อมูลจริง"
      />

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-base">
          หน้านี้สำหรับทดสอบเท่านั้น ข้อมูลที่สร้างจะมีชื่อขึ้นต้นด้วย{' '}
          <code className="text-sm">[LINKTEST]</code> และลบได้ด้วยปุ่มล่างสุด
          <br />
          ใช้ <strong>เบอร์สมมติที่ไม่มีในระบบ</strong> เท่านั้น (ถ้าซ้ำกับเบอร์จริง ระบบจะไม่ยอมสร้างให้)
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-base">
          <strong>ต้องเปิด openid scope ก่อน</strong> — การเชื่อมบัญชีต้องใช้ ID token จาก LINE
          ถ้าใน LINE Console ยังไม่ได้เปิด scope <code className="text-sm">openid</code>{' '}
          (LINE Login channel) ตอนกดยืนยันจะขึ้นข้อความว่าอ่านข้อมูลยืนยันตัวตนไม่ได้
          <br />
          ถ้าเจอข้อความนั้นตอนทดสอบ = ไปเปิด scope ใน Console แล้วสแกนใหม่
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>1. สร้างผู้ปกครองทดสอบ</CardTitle>
          <CardDescription>กรอกชื่อและเบอร์สมมติ แล้วกดสร้าง QR</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อผู้ปกครอง (สมมติ)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทร (สมมติ)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0990000001"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleCreate} disabled={creating || !name || !phone}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              'สร้าง QR ทดสอบ'
            )}
          </Button>
        </CardContent>
      </Card>

      {parent && linkUrl && (
        <Card>
          <CardHeader>
            <CardTitle>2. สแกนด้วยมือถือ</CardTitle>
            <CardDescription>
              เปิด LINE → สแกน QR นี้ → กรอกเบอร์ <strong>{parent.phone}</strong> → ยืนยัน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG value={linkUrl} size={220} level="M" includeMargin />
              </div>
            </div>

            <div className="text-sm text-muted-foreground break-all bg-gray-50 dark:bg-gray-900 p-3 rounded">
              {linkUrl}
            </div>

            <div className="border-t pt-4">
              <p className="text-base font-medium mb-2">สถานะ:</p>
              {status?.linked ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">เชื่อมต่อสำเร็จ!</span>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg space-y-2 text-base">
                    <div className="flex items-center gap-3">
                      {status.parent.picture_url && (
                        <img
                          src={status.parent.picture_url}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">
                          {status.parent.line_display_name || '(ไม่มีชื่อ LINE)'}
                        </p>
                        <p className="text-sm text-muted-foreground break-all">
                          LINE ID: {status.parent.line_user_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-sm">เชื่อม chat contact:</span>
                      <Badge variant={status.contactLinked ? 'default' : 'secondary'}>
                        {status.contactLinked ? 'สำเร็จ' : 'ไม่มี contact เดิม (ปกติ)'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-base">รอสแกน... (ตรวจสอบทุก 3 วินาที)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>3. ล้างข้อมูลทดสอบ</CardTitle>
          <CardDescription>ลบผู้ปกครองทดสอบทั้งหมด (เฉพาะที่ขึ้นต้นด้วย [LINKTEST])</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="destructive" onClick={handleCleanup} disabled={cleaning}>
            {cleaning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            ลบข้อมูลทดสอบทั้งหมด
          </Button>
          {parent && (
            <Button
              variant="outline"
              onClick={() => call({ action: 'status', parentId: parent.id }).then(setStatus)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              เช็คสถานะเดี๋ยวนี้
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

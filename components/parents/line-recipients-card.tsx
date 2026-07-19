'use client';

// ผู้รับแจ้งเตือน LINE เพิ่มเติมของครอบครัว (พ่อ/แม่คนที่ 2) — ฝั่งแอดมิน
// วางใต้ card "การเชื่อมต่อ LINE" ในหน้าผู้ปกครอง. อ่าน/เขียนผ่าน adminMutation
// (ตาราง parent_line_recipients เป็น service-role only). สร้างคำเชิญ → ได้ลิงก์ +
// QR ให้ผู้รับสแกน/กดใน LINE ของตัวเอง (flow ตอบรับเดียวกับที่ผู้ปกครองเชิญกันเอง)

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Bell, Copy, Check, Loader2, Trash2, UserPlus, User } from 'lucide-react';
import { toast } from 'sonner';
import { adminMutation } from '@/lib/admin-mutation';
import { parentLiffUrl } from '@/lib/line/liff-id';

interface RecipientRow {
  id: string;
  label: string | null;
  line_user_id: string | null;
  display_name: string | null;
  picture_url: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  accepted_at: string | null;
  is_active: boolean;
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

const inviteUrlOf = (token: string) => parentLiffUrl(`?recipientInvite=${token}`);

export function LineRecipientsCard({ parentId }: { parentId: string }) {
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminMutation<RecipientRow[]>({
        table: 'parent_line_recipients',
        operation: 'select',
        match: { parent_id: parentId },
        options: { order: 'created_at' },
      });
      setRows((data || []).filter((r) => r.is_active));
    } catch (e) {
      console.error('load recipients failed:', e);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const visible = rows.filter(
    (r) => r.accepted_at || !r.invite_expires_at || new Date(r.invite_expires_at) >= now
  );

  const createInvite = async () => {
    setCreating(true);
    try {
      const token = generateToken();
      await adminMutation({
        table: 'parent_line_recipients',
        operation: 'insert',
        data: {
          parent_id: parentId,
          label: label.trim() || null,
          invite_token: token,
          invite_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        },
      });
      setLabel('');
      setQrToken(token);
      await load();
      toast.success('สร้างคำเชิญแล้ว — ส่งลิงก์หรือให้สแกน QR ได้เลย');
    } catch (e: any) {
      toast.error(e?.message || 'สร้างคำเชิญไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  };

  const copyInvite = async (r: RecipientRow) => {
    if (!r.invite_token) return;
    await navigator.clipboard.writeText(inviteUrlOf(r.invite_token));
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('คัดลอกลิงก์เชิญแล้ว');
  };

  const remove = async (r: RecipientRow) => {
    setRemovingId(r.id);
    try {
      await adminMutation({
        table: 'parent_line_recipients',
        operation: 'delete',
        match: { id: r.id },
      });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      if (qrToken && r.invite_token === qrToken) setQrToken(null);
      toast.success('ลบผู้รับการแจ้งเตือนแล้ว');
    } catch (e: any) {
      toast.error(e?.message || 'ลบไม่สำเร็จ');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          ผู้รับการแจ้งเตือนเพิ่มเติม
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          แจ้งเตือน LINE (คลาส/ชดเชย/feedback ฯลฯ) จะส่งถึงผู้ปกครองหลัก และทุกคนในรายการนี้
        </p>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {visible.length > 0 && (
              <div className="space-y-2">
                {visible.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                    {r.picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.picture_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {r.display_name || r.label || 'รอตอบรับคำเชิญ'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.accepted_at ? (r.label || 'รับการแจ้งเตือนแล้ว') : 'รอกดตอบรับ (ลิงก์อายุ 3 วัน)'}
                      </p>
                    </div>
                    {!r.accepted_at && (
                      <>
                        <Badge variant="secondary" className="text-xs shrink-0">รอตอบรับ</Badge>
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => copyInvite(r)}>
                          {copiedId === r.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 shrink-0"
                      disabled={removingId === r.id}
                      onClick={() => remove(r)}
                    >
                      {removingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* QR ของคำเชิญที่เพิ่งสร้าง — ให้พ่อ/แม่สแกนจากมือถือ (เปิดใน LINE) */}
            {qrToken && (
              <div className="border rounded-lg p-4 text-center space-y-2">
                <QRCodeSVG value={inviteUrlOf(qrToken)} size={160} className="mx-auto" />
                <p className="text-xs text-gray-500">
                  ให้ผู้รับสแกน QR นี้ด้วยมือถือ (เปิดผ่านแอป LINE) เพื่อตอบรับ
                </p>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setQrToken(null)}>
                  ปิด QR
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ป้ายชื่อ เช่น พ่อ / แม่ (ไม่บังคับ)"
                className="h-9 text-sm"
              />
              <Button size="sm" className="shrink-0" disabled={creating} onClick={createInvite}>
                {creating
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : (<><UserPlus className="h-4 w-4 mr-1" />สร้างคำเชิญ</>)}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

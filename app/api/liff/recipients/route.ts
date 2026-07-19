// app/api/liff/recipients/route.ts
// ผู้รับแจ้งเตือน LINE เพิ่มเติมของครอบครัว (พ่อ/แม่คนที่ 2+)
// actions: list | invite | accept | remove — identity จาก verified LINE ID token
// (resolveLiffUser) เหมือน route LIFF อื่น ๆ. ตาราง parent_line_recipients เป็น
// service-role only จึงต้องผ่าน route นี้เท่านั้น

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { createServiceClient } from '@/lib/supabase/server';
import { parentLiffUrl } from '@/lib/line/liff-id';

export const dynamic = 'force-dynamic';

const INVITE_TTL_HOURS = 72;

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// เจ้าของครอบครัว = parents row ที่ผูกกับ LINE id ของผู้เรียก
async function findParentByLineId(lineUserId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('parents')
    .select('id, display_name, line_user_id')
    .eq('line_user_id', lineUserId)
    .maybeSingle();
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const action = body.action as string;

    // ---- accept: คนที่ถูกเชิญ (พ่อ) กดลิงก์ — ใช้ LINE id ของ "ผู้เรียก" เป็นผู้รับ
    if (action === 'accept') {
      const token = (body.token || '').trim();
      if (!token) return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });

      const { data: invite } = await (supabase as any)
        .from('parent_line_recipients')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle();

      if (!invite) {
        return NextResponse.json({ success: false, error: 'ไม่พบคำเชิญ หรือคำเชิญถูกยกเลิกแล้ว' }, { status: 404 });
      }
      if (invite.accepted_at && invite.line_user_id === user.lineUserId) {
        return NextResponse.json({ success: true, alreadyAccepted: true });
      }
      if (invite.accepted_at) {
        return NextResponse.json({ success: false, error: 'คำเชิญนี้ถูกใช้ไปแล้ว' }, { status: 409 });
      }
      if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
        return NextResponse.json({ success: false, error: 'คำเชิญหมดอายุแล้ว กรุณาให้ผู้ปกครองส่งลิงก์ใหม่' }, { status: 410 });
      }

      // LINE เดียวกับผู้รับหลัก หรือเป็นผู้รับอยู่แล้ว → ไม่ต้องเพิ่มซ้ำ
      const { data: family } = await supabase
        .from('parents')
        .select('id, line_user_id')
        .eq('id', invite.parent_id)
        .single();
      if (family?.line_user_id === user.lineUserId) {
        return NextResponse.json({ success: false, error: 'LINE นี้เป็นผู้รับหลักของครอบครัวอยู่แล้ว' }, { status: 409 });
      }
      const { data: existing } = await (supabase as any)
        .from('parent_line_recipients')
        .select('id')
        .eq('parent_id', invite.parent_id)
        .eq('line_user_id', user.lineUserId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ success: true, alreadyAccepted: true });
      }

      const { error: updateError } = await (supabase as any)
        .from('parent_line_recipients')
        .update({
          line_user_id: user.lineUserId,
          display_name: body.displayName || null,
          picture_url: body.pictureUrl || null,
          accepted_at: new Date().toISOString(),
          is_active: true,
        })
        .eq('id', invite.id);
      if (updateError) throw updateError;

      return NextResponse.json({ success: true, label: invite.label || null });
    }

    // ---- ที่เหลือ (list / invite / remove) เป็นของเจ้าของครอบครัวเท่านั้น
    const parent = await findParentByLineId(user.lineUserId);
    if (!parent) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลผู้ปกครอง' }, { status: 404 });
    }

    if (action === 'list') {
      const { data: rows } = await (supabase as any)
        .from('parent_line_recipients')
        .select('id, label, line_user_id, display_name, picture_url, invite_expires_at, accepted_at')
        .eq('parent_id', parent.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      const now = new Date();
      const recipients = (rows || [])
        // คำเชิญที่หมดอายุและยังไม่ถูกกดรับ ไม่ต้องแสดง
        .filter((r: any) => r.accepted_at || !r.invite_expires_at || new Date(r.invite_expires_at) >= now)
        .map((r: any) => ({
          id: r.id,
          label: r.label,
          displayName: r.display_name,
          pictureUrl: r.picture_url,
          accepted: !!r.accepted_at,
        }));
      return NextResponse.json({ success: true, recipients });
    }

    if (action === 'invite') {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
      const { error: insertError } = await (supabase as any)
        .from('parent_line_recipients')
        .insert({
          parent_id: parent.id,
          label: (body.label || '').trim() || null,
          invite_token: token,
          invite_expires_at: expiresAt.toISOString(),
        });
      if (insertError) throw insertError;

      const inviteUrl = parentLiffUrl(`?recipientInvite=${token}`);
      return NextResponse.json({ success: true, inviteUrl, expiresAt: expiresAt.toISOString() });
    }

    if (action === 'remove') {
      if (!body.id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
      const { error: deleteError } = await (supabase as any)
        .from('parent_line_recipients')
        .delete()
        .eq('id', body.id)
        .eq('parent_id', parent.id); // ลบได้เฉพาะของครอบครัวตัวเอง
      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[liff/recipients] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

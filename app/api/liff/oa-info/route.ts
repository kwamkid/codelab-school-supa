// app/api/liff/oa-info/route.ts
// ข้อมูล LINE OA สำหรับปุ่ม "เพิ่มเพื่อน" ใน LIFF — ผู้รับแจ้งเตือนที่ยังไม่ได้
// เพิ่มเพื่อน OA จะไม่ได้รับ push เลย จึงต้องชวนแอดจากในแอป
// basicId ไม่ได้เก็บใน settings → ดึงจาก Messaging API bot/info (cache 1 ชม.)

import { NextResponse } from 'next/server';
import { Client } from '@line/bot-sdk';
import { getLineSettings } from '@/lib/supabase/services/line-settings';

export const dynamic = 'force-dynamic';

let cached: { addFriendUrl: string; basicId: string; displayName: string } | null = null;
let cachedAt = 0;
const TTL_MS = 60 * 60 * 1000;

export async function GET() {
  try {
    if (cached && Date.now() - cachedAt < TTL_MS) {
      return NextResponse.json({ success: true, ...cached });
    }

    const settings = await getLineSettings();
    const token = (settings as any)?.messagingChannelAccessToken || (settings as any)?.channelAccessToken;
    if (!token) {
      return NextResponse.json({ success: false, error: 'LINE not configured' }, { status: 404 });
    }

    const client = new Client({ channelAccessToken: token });
    const info = await client.getBotInfo();
    const basicId = String(info.basicId || '').replace(/^@/, '');
    if (!basicId) {
      return NextResponse.json({ success: false, error: 'No basicId' }, { status: 404 });
    }

    cached = {
      basicId: `@${basicId}`,
      displayName: info.displayName || 'CodeLab School',
      addFriendUrl: `https://line.me/R/ti/p/@${basicId}`,
    };
    cachedAt = Date.now();
    return NextResponse.json({ success: true, ...cached });
  } catch (error: any) {
    console.error('[liff/oa-info] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

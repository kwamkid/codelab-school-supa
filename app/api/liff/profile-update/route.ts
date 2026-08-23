// app/api/liff/profile-update/route.ts
// Update a parent's own profile from LIFF. Identity from a verified LINE ID token;
// the data layer confirms the record belongs to that LINE user.
//
// scope: 'recipient' → ผู้รับเพิ่มเติมแก้ชื่อ/เบอร์/อีเมลของตัวเอง
// (default)          → ผู้ปกครองหลักแก้โปรไฟล์ครอบครัว

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { updateParentProfile, updateRecipientSelf } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // ผู้รับเพิ่มเติม (พ่อ/ย่า) แก้ข้อมูลติดต่อของตัวเอง — ไม่ได้แตะข้อมูลครอบครัว
    if (body.scope === 'recipient') {
      await updateRecipientSelf(user.lineUserId, body.data || {});
      return NextResponse.json({ success: true });
    }

    if (!body.parentId) {
      return NextResponse.json({ success: false, error: 'Missing parentId' }, { status: 400 });
    }

    await updateParentProfile(user.lineUserId, body.parentId, body.data || {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[liff/profile-update] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

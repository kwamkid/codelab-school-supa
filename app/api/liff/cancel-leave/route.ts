// app/api/liff/cancel-leave/route.ts
// Parent cancels a pending leave/makeup from LIFF. Identity from a verified LINE
// ID token; the data layer also confirms the student belongs to the parent.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { cancelLeave } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const result = await cancelLeave(user.lineUserId, {
      makeupId: body.makeupId,
      studentId: body.studentId,
      classId: body.classId,
      scheduleId: body.scheduleId,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status || 400 });
    }
    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('[liff/cancel-leave] Error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

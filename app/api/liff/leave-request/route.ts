// app/api/liff/leave-request/route.ts
// Parent requests leave for a class session from LIFF. Identity from a verified
// LINE ID token; the data layer also confirms the student belongs to the parent.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { requestLeave } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const result = await requestLeave(user.lineUserId, {
      studentId: body.studentId,
      classId: body.classId,
      scheduleId: body.scheduleId,
      reason: body.reason,
      type: body.type,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, quotaDetails: result.quotaDetails, quotaLimit: (result as any).limit },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการลาเรียนเรียบร้อยแล้ว',
      makeupId: result.makeupId,
      quotaUsed: result.quotaUsed,
      quotaLimit: result.quotaLimit,
      quotaDetails: result.quotaDetails,
    });
  } catch (error: any) {
    console.error('[liff/leave-request] Error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

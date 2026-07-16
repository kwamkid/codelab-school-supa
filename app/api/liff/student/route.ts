// app/api/liff/student/route.ts
// Create (POST) or update (PATCH) a student on the verified LINE parent's own
// account, from the LIFF portal. Service role + LINE-verified ownership check;
// replaces the /api/admin/mutation path that 401s for LIFF parents.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { createStudentForParent, updateStudentForParent } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลผู้ใช้ LINE' }, { status: 401 });
    }

    const result = await createStudentForParent(user.lineUserId, body.student || {});
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: result.status || 400 }
      );
    }
    return NextResponse.json({ success: true, studentId: result.studentId });
  } catch (error: any) {
    console.error('[liff/student POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'เพิ่มนักเรียนไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลผู้ใช้ LINE' }, { status: 401 });
    }
    if (!body.studentId) {
      return NextResponse.json({ success: false, error: 'Missing studentId' }, { status: 400 });
    }

    const result = await updateStudentForParent(user.lineUserId, body.studentId, body.student || {});
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: (result as any).message },
        { status: (result as any).status || 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[liff/student PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'แก้ไขข้อมูลนักเรียนไม่สำเร็จ' },
      { status: 500 }
    );
  }
}

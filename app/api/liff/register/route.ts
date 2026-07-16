// app/api/liff/register/route.ts
// Register a parent (+ first student) from LIFF. LIFF parents aren't Supabase-
// authed, so they can't use /api/admin/mutation (requireStaff → 401). Identity
// comes from a verified LINE ID token; the parent row is bound to that LINE id.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { registerParentWithStudent } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลผู้ใช้ LINE' }, { status: 401 });
    }

    const result = await registerParentWithStudent(user.lineUserId, {
      parentName: body.parentName,
      parentPhone: body.parentPhone,
      lineDisplayName: body.lineDisplayName,
      linePictureUrl: body.linePictureUrl,
      student: body.student || {},
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      parentId: result.parentId,
      studentId: result.studentId,
    });
  } catch (error: any) {
    console.error('[liff/register] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' },
      { status: 500 }
    );
  }
}

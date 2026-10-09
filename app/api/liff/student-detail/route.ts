// app/api/liff/student-detail/route.ts
// Full record of ONE student for the LIFF edit-student page. Identity from a
// verified LINE ID token; the student must belong to the caller's family
// (secondary recipients map to the primary family).

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { getStudentForFamily } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!body.studentId) {
      return NextResponse.json({ success: false, error: 'Missing studentId' }, { status: 400 });
    }

    const student = await getStudentForFamily(user.lineUserId, body.studentId);
    return NextResponse.json({ success: true, student });
  } catch (error: any) {
    console.error('[liff/student-detail] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

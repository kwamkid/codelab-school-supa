// app/api/liff/makeup/route.ts
// Makeup ("ข้อมูลการลาและเรียนชดเชย") data for the LIFF makeup page.
// Identity from a verified LINE ID token.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { getMakeupData } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { students, makeupData } = await getMakeupData(user.lineUserId);
    return NextResponse.json({ success: true, students, makeupData });
  } catch (error: any) {
    console.error('[liff/makeup] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

// app/api/liff/home/route.ts
// Combined dashboard summary (pending makeup + next class + latest feedback) in a
// single call, so the home tab loads fast. Identity from a verified LINE ID token.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { getHomeSummary } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const summary = await getHomeSummary(user.lineUserId);
    return NextResponse.json({ success: true, ...summary });
  } catch (error: any) {
    console.error('[liff/home] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

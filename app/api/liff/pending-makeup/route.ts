// app/api/liff/pending-makeup/route.ts
// Count of makeup sessions still owed (status 'pending') for the LIFF home alert.
// Identity from a verified LINE ID token.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { getPendingMakeupCount } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized', count: 0 }, { status: 401 });

    const count = await getPendingMakeupCount(user.lineUserId);
    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('[liff/pending-makeup] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed', count: 0 }, { status: 500 });
  }
}

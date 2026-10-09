// app/api/liff/last-login/route.ts
// Fire-and-forget from LiffProvider: stamp parents.last_login_at for the
// verified LINE user (replaces the old anon-key browser update).

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { touchParentLastLogin } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await touchParentLastLogin(user.lineUserId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[liff/last-login] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

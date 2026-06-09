// app/api/liff/profile/route.ts
// Parent + students (+ preferred branch) for the LIFF profile page, in one RPC.
// Identity from a verified LINE ID token.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { getProfileData } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { hasParent, parent, students, preferredBranch } = await getProfileData(user.lineUserId);
    return NextResponse.json({ success: true, hasParent, parent, students, preferredBranch });
  } catch (error: any) {
    console.error('[liff/profile] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}

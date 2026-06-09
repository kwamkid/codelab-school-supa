// app/api/liff/profile-update/route.ts
// Update a parent's own profile from LIFF. Identity from a verified LINE ID token;
// the data layer confirms the parent record belongs to that LINE user.

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { updateParentProfile } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (!body.parentId) {
      return NextResponse.json({ success: false, error: 'Missing parentId' }, { status: 400 });
    }

    await updateParentProfile(user.lineUserId, body.parentId, body.data || {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[liff/profile-update] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
